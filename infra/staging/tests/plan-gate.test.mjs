import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { runPlanGate } from "../plan-gate.mjs";

const repoRoot = resolve(import.meta.dirname, "../../..");
const fixedNow = new Date("2026-10-07T14:00:00.000Z");
const prodRoleArn = "arn:aws:iam::452630323448:role/GenesisRuntimeStack-RuntimeTaskRoleCD4DE6A7-ekuyV7pdb88Q";
const prodExecutionRoleArn = "arn:aws:iam::452630323448:role/GenesisRuntimeStack-RuntimeTaskExecutionRole9B42490-R0neRrBR8s7H";
const prodTargetGroupArn = "arn:aws:elasticloadbalancing:us-west-2:452630323448:targetgroup/genesis-production-web/1111111111111111";
const stagingTargetGroupArn = "arn:aws:elasticloadbalancing:us-west-2:452630323448:targetgroup/genesis-staging-web/2222222222222222";
const listenerArn = "arn:aws:elasticloadbalancing:us-west-2:452630323448:listener/app/Genesis/1111111111111111/2222222222222222";
const loadBalancerArn = "arn:aws:elasticloadbalancing:us-west-2:452630323448:loadbalancer/app/Genesis/1111111111111111";
const poolId = "us-west-2_3ACTeHTON";
const prodClientId = "prod-client-id";
const deployRoleArn = "arn:aws:iam::452630323448:role/GenesisGitHubDeployRole";

function parseJson(text) {
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

function option(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function contextFromArgs(args) {
  const context = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== "--context-entries") continue;
    const entry = Object.fromEntries(args[index + 1].split(",").map((part) => {
      const separator = part.indexOf("=");
      return [part.slice(0, separator), part.slice(separator + 1)];
    }));
    context[entry.ContextKeyName] = entry.ContextKeyValues;
  }
  return context;
}

function cloudTrailEvent(region, subject = "repo:ssidisplaysai/platform:ref:refs/heads/infra/genesis-staging-runtime-v1") {
  return {
    EventTime: fixedNow.toISOString(),
    CloudTrailEvent: JSON.stringify({
      eventTime: fixedNow.toISOString(),
      awsRegion: region,
      requestParameters: { roleArn: deployRoleArn },
      responseElements: { subjectFromWebIdentityToken: subject },
      userIdentity: { principalId: `AROAEXAMPLE:${subject}` },
    }),
  };
}

function createMockAws(options = {}) {
  const calls = [];
  const mock = async (service, operation, args, region) => {
    calls.push({ service, operation, args, region });
    if (options.failCall?.(service, operation, args, region)) {
      const error = new Error(options.failMessage ?? `mock denied ${service} ${operation}`);
      error.code = options.failCode;
      throw error;
    }
    if (service === "sts" && operation === "get-caller-identity") {
      return { Account: "452630323448", Arn: "arn:aws:sts::452630323448:assumed-role/GenesisGitHubDeployRole/session" };
    }
    if (service === "ecs" && operation === "describe-services") {
      return {
        services: [{
          status: "ACTIVE",
          taskDefinition: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-production-web:38",
          networkConfiguration: { awsvpcConfiguration: { securityGroups: ["sg-production-task"] } },
          loadBalancers: [{ targetGroupArn: prodTargetGroupArn }],
        }],
        failures: [],
      };
    }
    if (service === "ecs" && operation === "describe-task-definition") {
      return {
        taskDefinition: {
          taskRoleArn: prodRoleArn,
          executionRoleArn: prodExecutionRoleArn,
          containerDefinitions: [{
            name: "GenesisWebRuntime",
            image: "452630323448.dkr.ecr.us-west-2.amazonaws.com/genesis-production-runtime:c8e3da0",
            environment: [
              { name: "NODE_ENV", value: "production" },
              { name: "GENESIS_OPENAI_API_KEY", value: "never-print-this" },
              { name: "GIT_COMMIT", value: "c8e3da0d7e0bd8e04509b9c4a59dc15c34602fbe" },
              { name: "GENESIS_RUNTIME_SHA", value: "c8e3da0d7e0bd8e04509b9c4a59dc15c34602fbe" },
            ],
            secrets: [{
              name: "GENESIS_WOOCOMMERCE_WEBHOOK_SECRET",
              valueFrom: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/webhook-AbCdEf",
            }],
          }],
        },
      };
    }
    if (service === "elbv2" && operation === "describe-target-groups") {
      if (args.includes("--names")) {
        return { TargetGroups: [{
          TargetGroupArn: stagingTargetGroupArn,
          LoadBalancerArns: [loadBalancerArn],
          HealthCheckProtocol: "HTTP",
          HealthCheckPort: "traffic-port",
          HealthCheckPath: "/",
          Matcher: { HttpCode: "200" },
        }] };
      }
      return { TargetGroups: [{
        TargetGroupArn: prodTargetGroupArn,
        LoadBalancerArns: [loadBalancerArn],
        HealthCheckProtocol: "HTTP",
        HealthCheckPort: "3000",
        HealthCheckPath: "/api/health",
        Matcher: { HttpCode: "200" },
      }] };
    }
    if (service === "iam" && operation === "get-role") {
      const roleName = option(args, "--role-name");
      if (roleName === "genesis-staging-task-role" && options.stagingRoleMissing) {
        const error = new Error("NoSuchEntity");
        error.code = "NoSuchEntity";
        throw error;
      }
      return { Role: { RoleName: roleName, AssumeRolePolicyDocument: { Version: "2012-10-17", Statement: [] } } };
    }
    if (service === "elbv2" && operation === "describe-listeners") {
      return { Listeners: [{
        ListenerArn: listenerArn,
        Port: 443,
        DefaultActions: [{
          Type: "authenticate-cognito",
          AuthenticateCognitoConfig: {
            UserPoolArn: `arn:aws:cognito-idp:us-west-2:452630323448:userpool/${poolId}`,
            UserPoolClientId: prodClientId,
          },
        }],
      }] };
    }
    if (service === "elbv2" && operation === "describe-load-balancers") {
      return { LoadBalancers: [{ LoadBalancerArn: loadBalancerArn, DNSName: "genesis-alb.us-west-2.elb.amazonaws.com" }] };
    }
    if (service === "elbv2" && operation === "describe-rules") {
      return { Rules: [{ Priority: "default", Conditions: [], Actions: [{ Type: "forward" }] }] };
    }
    if (service === "elbv2" && operation === "describe-listener-certificates") {
      return { Certificates: [{ CertificateArn: "arn:aws:acm:us-west-2:452630323448:certificate/test" }] };
    }
    if (service === "elbv2" && operation === "describe-target-health") return { TargetHealthDescriptions: [] };
    if (service === "ec2" && operation === "describe-security-groups") {
      return { SecurityGroups: [{ GroupId: "sg-production-task", IpPermissions: [], IpPermissionsEgress: [] }] };
    }
    if (service === "cognito-idp" && operation === "describe-user-pool-client") {
      return { UserPoolClient: {
        ClientId: prodClientId,
        ClientName: "production-client",
        ClientSecret: "never-print-this-client-secret",
        GenerateSecret: true,
        CallbackURLs: ["https://app.glwplatform.com/callback"],
        LogoutURLs: ["https://app.glwplatform.com/"],
        AllowedOAuthFlows: ["code"],
        AllowedOAuthScopes: ["openid"],
        SupportedIdentityProviders: ["COGNITO"],
        ExplicitAuthFlows: ["ALLOW_USER_SRP_AUTH"],
      } };
    }
    if (service === "cognito-idp" && operation === "describe-user-pool") {
      return { UserPool: { Id: poolId, Domain: "genesis.auth.us-west-2.amazoncognito.com" } };
    }
    if (service === "cognito-idp" && operation === "list-user-pool-clients") {
      return { UserPoolClients: options.stagingClientSameAsProd
        ? [{ ClientName: "genesis-staging-operators-client", ClientId: prodClientId }]
        : [] };
    }
    if (service === "iam" && operation === "list-attached-role-policies") {
      const roleName = option(args, "--role-name");
      return { AttachedPolicies: roleName === "genesis-staging-task-role"
        ? (options.stagingTaskPolicy ? [{ PolicyArn: "arn:aws:iam::452630323448:policy/Unexpected" }] : [])
        : [{ PolicyArn: "arn:aws:iam::aws:policy/AmazonECS_FullAccess" }] };
    }
    if (service === "iam" && operation === "list-role-policies") {
      return { PolicyNames: option(args, "--role-name") === "genesis-staging-task-role"
        ? (options.stagingTaskInlinePolicy ? ["UnexpectedInline"] : [])
        : ["InlineDeployPolicy"] };
    }
    if (service === "iam" && operation === "get-role-policy") {
      return { PolicyDocument: {
        Version: "2012-10-17",
        Statement: [{ Effect: "Allow", Action: "sts:AssumeRole", Resource: "*", token: "never-print-this" }],
      } };
    }
    if (service === "ecr" && operation === "describe-images") {
      return { imageDetails: [{ imageDigest: "sha256:abcdef1234567890", imageTags: ["c8e3da0"] }] };
    }
    if (service === "iam" && operation === "simulate-custom-policy") {
      if (options.incompleteCustomSimulation) return {};
      const policiesIndex = args.indexOf("--policy-input-list");
      const action = option(args, "--action-names");
      const resource = option(args, "--resource-arns");
      assert.equal(args.slice(policiesIndex + 1, args.indexOf("--action-names")).length, 4);
      const policyArray = args.slice(policiesIndex + 1, args.indexOf("--action-names")).map((policy) => JSON.parse(policy));
      const cases = parseJson(await readFile(resolve(repoRoot, "infra/staging/iam/simulation-cases.json"), "utf8"));
      const context = contextFromArgs(args);
      const matched = cases.find((candidate) =>
        candidate.action === action &&
        candidate.resource === resource &&
        JSON.stringify(Object.entries(candidate.context ?? {}).sort()) === JSON.stringify(Object.entries(context).sort())
      );
      assert.ok(matched, `mock has no custom simulation case for ${action} ${resource}`);
      let decision = matched.expect === "allow"
        ? "allowed"
        : matched.requireExplicitDeny ? "explicitDeny" : "implicitDeny";
      if (options.customAllowDenied && matched.expect === "allow") decision = "implicitDeny";
      if (options.customDenyAllowed && matched.expect === "deny") decision = "allowed";
      if (options.customExplicitDenied && matched.requireExplicitDeny) decision = "implicitDeny";
      assert.equal(policyArray.length, 4);
      assert.ok(policyArray.every((policy) => Array.isArray(policy.Statement)));
      return { EvaluationResults: [{ EvalActionName: action, EvalResourceName: resource, EvalDecision: decision }] };
    }
    if (service === "iam" && operation === "simulate-principal-policy") {
      if (options.principalSimulationUnavailable) throw new Error("mock unavailable");
      const action = option(args, "--action-names");
      const resource = option(args, "--resource-arns");
      assert.equal(option(args, "--policy-source-arn"), deployRoleArn);
      return { EvaluationResults: [{
        EvalActionName: action,
        EvalResourceName: resource,
        EvalDecision: options.principalDeniedAction === action ? "implicitDeny" : "allowed",
      }] };
    }
    if (service === "cloudtrail" && operation === "lookup-events") {
      const events = options.cloudTrailEvents ?? [cloudTrailEvent(region)];
      return { Events: options.cloudTrailUnknown ? [] : events };
    }
    throw new Error(`Unexpected mock AWS API call: ${service} ${operation}`);
  };
  return { mock, calls };
}

async function executeGate(options = {}, root = repoRoot) {
  const output = [];
  const { mock, calls } = createMockAws(options);
  let error;
  try {
    await runPlanGate({
      aws: mock,
      report: (line) => output.push(line),
      now: fixedNow,
      repoRoot: root,
      resolveDns: async () => ({
        addresses: ["203.0.113.20"],
        albAddresses: ["203.0.113.20"],
        cname: "genesis-alb.us-west-2.elb.amazonaws.com.",
      }),
    });
  } catch (caught) {
    error = caught;
  }
  return { output: output.join("\n"), calls, error };
}

test("all required reads and zero simulation mismatches pass the plan gate", async () => {
  const result = await executeGate();
  assert.ifError(result.error);
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=PASS cases=32 mismatches=0/);
  assert.match(result.output, /PRINCIPAL_POLICY_SIMULATION=PASS/);
  assert.match(result.output, /ROLE_USAGE_CLEARANCE=PLATFORM_ONLY/);
  assert.ok(result.output.endsWith("GENESIS_STAGING_PLAN_GATE=PASS"));
  assert.doesNotMatch(result.output, /never-print-this/);
  assert.match(result.output, /InlineDeployPolicy/);
  assert.ok(result.calls.every(({ service, operation }) =>
    new Set([
      "sts:get-caller-identity", "ecs:describe-services", "ecs:describe-task-definition",
      "elbv2:describe-target-groups", "elbv2:describe-listeners", "elbv2:describe-load-balancers",
      "elbv2:describe-rules", "elbv2:describe-listener-certificates", "elbv2:describe-target-health",
      "ec2:describe-security-groups", "cognito-idp:describe-user-pool-client", "cognito-idp:describe-user-pool",
      "cognito-idp:list-user-pool-clients", "iam:get-role", "iam:list-attached-role-policies",
      "iam:list-role-policies", "iam:get-role-policy", "iam:simulate-custom-policy",
      "iam:simulate-principal-policy", "ecr:describe-images", "cloudtrail:lookup-events",
    ]).has(`${service}:${operation}`.toLowerCase())
  ));
});

test("staging task role with an inline policy fails closed", async () => {
  const result = await executeGate({ stagingTaskInlinePolicy: true });
  assert.ok(result.error);
  assert.match(result.error.message, /Staging task role has attached or inline permissions/);
});

test("missing staging task role is safe to create with no permissions", async () => {
  const result = await executeGate({ stagingRoleMissing: true });
  assert.ifError(result.error);
  assert.match(result.output, /Staging task role=absent; apply would create it without application permissions/);
});

test("an expected explicit deny reported as implicit fails", async () => {
  const result = await executeGate({ customExplicitDenied: true });
  assert.ok(result.error);
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=FAIL/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("incomplete custom simulation results fail", async () => {
  const result = await executeGate({ incompleteCustomSimulation: true });
  assert.ok(result.error);
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=FAIL/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("unreadable inline policy names fail closed", async () => {
  const result = await executeGate({
    failCall: (service, operation, args) =>
      service === "iam" && operation === "list-role-policies" && option(args, "--role-name") === "GenesisGitHubDeployRole",
  });
  assert.ok(result.error);
  assert.match(result.error.message, /list-role-policies failed/);
});

test("one expected allow denied fails the custom policy gate", async () => {
  const result = await executeGate({ customAllowDenied: true });
  assert.ok(result.error);
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=FAIL/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("one expected deny allowed fails the custom policy gate", async () => {
  const result = await executeGate({ customDenyAllowed: true });
  assert.ok(result.error);
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=FAIL/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("unavailable custom policy simulation fails closed", async () => {
  const result = await executeGate({
    failCall: (service, operation) => service === "iam" && operation === "simulate-custom-policy",
  });
  assert.ok(result.error);
  assert.match(result.error.message, /simulate-custom-policy failed/);
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=FAIL/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("unreadable inline policy contents fail closed", async () => {
  const result = await executeGate({
    failCall: (service, operation) => service === "iam" && operation === "get-role-policy",
  });
  assert.ok(result.error);
  assert.match(result.error.message, /get-role-policy failed/);
});

test("unreadable production Cognito client fails closed", async () => {
  const result = await executeGate({
    failCall: (service, operation) => service === "cognito-idp" && operation === "describe-user-pool-client",
  });
  assert.ok(result.error);
  assert.match(result.error.message, /describe-user-pool-client failed/);
});

test("unreadable SNI certificate list fails closed", async () => {
  const result = await executeGate({
    failCall: (service, operation) => service === "elbv2" && operation === "describe-listener-certificates",
  });
  assert.ok(result.error);
  assert.match(result.error.message, /describe-listener-certificates failed/);
});

test("production task role in an allowed staging PassRole resource fails closed", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "genesis-plan-policy-"));
  try {
    await cp(join(repoRoot, "infra"), join(tempRoot, "infra"), { recursive: true });
    const policyPath = join(tempRoot, "infra", "staging", "iam", "02-staging-compute-network-auth.json");
    const policy = JSON.parse(await readFile(policyPath, "utf8"));
    const passRole = policy.Statement.find((statement) => statement.Sid === "EcsPassRoleOnlyForStagingTaskRoles");
    passRole.Resource.push(prodRoleArn);
    await writeFile(policyPath, JSON.stringify(policy));
    const result = await executeGate({}, tempRoot);
    assert.ok(result.error);
    assert.match(result.error.message, /Production task role .* appears in an allowed staging iam:PassRole/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("staging task role with a managed policy attached fails closed", async () => {
  const result = await executeGate({ stagingTaskPolicy: true });
  assert.ok(result.error);
  assert.match(result.error.message, /Staging task role has attached or inline permissions/);
});

test("missing simulation case fails closed", async () => {
  const tempRoot = await mkdtemp(join(tmpdir(), "genesis-plan-cases-"));
  try {
    await cp(join(repoRoot, "infra"), join(tempRoot, "infra"), { recursive: true });
    const casesPath = join(tempRoot, "infra", "staging", "iam", "simulation-cases.json");
    const cases = parseJson(await readFile(casesPath, "utf8"));
    cases.pop();
    await writeFile(casesPath, JSON.stringify(cases));
    const result = await executeGate({}, tempRoot);
    assert.ok(result.error);
    assert.match(result.error.message, /Simulation case inventory is incomplete/);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("production Cognito client reuse fails closed", async () => {
  const result = await executeGate({ stagingClientSameAsProd: true });
  assert.ok(result.error);
  assert.match(result.error.message, /Staging Cognito client resolves to the production client/);
});

test("principal simulation must allow every required staging action", async () => {
  const result = await executeGate({ principalDeniedAction: "ecr:PutImage" });
  assert.ok(result.error);
  assert.match(result.error.message, /Principal policy simulation has .* staging-action mismatches/);
});

test("unavailable principal simulation fails closed", async () => {
  const result = await executeGate({ principalSimulationUnavailable: true });
  assert.ok(result.error);
  assert.match(result.output, /PRINCIPAL_POLICY_SIMULATION=FAIL/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("incomplete CloudTrail evidence is UNKNOWN and blocks role narrowing", async () => {
  const result = await executeGate({ cloudTrailUnknown: true });
  assert.ok(result.error);
  assert.match(result.output, /ROLE_USAGE_CLEARANCE=UNKNOWN/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("another repository using the deploy role is SHARED_ROLE and blocks the gate", async () => {
  const result = await executeGate({
    cloudTrailEvents: [
      cloudTrailEvent("us-east-1", "repo:another-owner/another-repo:ref:refs/heads/main"),
    ],
  });
  assert.ok(result.error);
  assert.match(result.output, /ROLE_USAGE_CLEARANCE=SHARED_ROLE/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("only the allowlisted read-only AWS APIs are issued", async () => {
  const result = await executeGate();
  assert.ifError(result.error);
  assert.ok(result.calls.some(({ service, operation, region }) => service === "cloudtrail" && operation === "lookup-events" && region === "us-east-1"));
  assert.ok(result.calls.some(({ service, operation, region }) => service === "cloudtrail" && operation === "lookup-events" && region === "us-west-2"));
  assert.ok(result.calls.every(({ service, operation }) =>
    typeof service === "string" &&
    !/^(create|update|delete|put|attach|detach|authorize|revoke|register|deregister|modify|set|add|remove)/i.test(operation)
  ));
});

test("provision.sh gates plan before AWS discovery and prints PASS only at its end", async () => {
  const script = await readFile(join(repoRoot, "infra", "staging", "provision.sh"), "utf8");
  const planBranch = script.indexOf('if [ "$MODE" = "plan" ]; then');
  const preflight = script.indexOf('node "$HERE/plan-gate.mjs" --preflight');
  const firstAwsCall = script.indexOf('aws ecs describe-services');
  const completion = script.lastIndexOf('echo "GENESIS_STAGING_PLAN_GATE=PASS"');
  const doneLog = script.lastIndexOf('log "done"');
  assert.ok(planBranch >= 0 && planBranch < preflight);
  assert.ok(preflight < firstAwsCall);
  assert.ok(doneLog < completion);
  assert.doesNotMatch(script, /report_plan_extras\s*\|\|\s*true/);
});
