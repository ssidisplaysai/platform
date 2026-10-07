import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  contextArguments,
  DEFAULT_SIMULATION_CONTEXT,
  effectiveSimulationContext,
  policyConditionKeys,
  runPlanGate,
  SIMULATION_CONTEXT_TYPES,
} from "../plan-gate.mjs";

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

function asArray(value) {
  return Array.isArray(value) ? value : [value];
}

function matchesPattern(pattern, value) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  return new RegExp(`^${escaped}$`, "i").test(value);
}

function statementMatchesCase(statement, simulationCase) {
  const actionMatches = asArray(statement.Action ?? []).some((action) => matchesPattern(action, simulationCase.action));
  if (!actionMatches) return false;
  const resources = asArray(statement.Resource ?? []);
  if (resources.length && !resources.some((resource) => matchesPattern(resource, simulationCase.resource))) return false;
  return !statement.NotResource || !asArray(statement.NotResource).some((resource) => matchesPattern(resource, simulationCase.resource));
}

function conditionKeys(statement) {
  return Object.values(statement.Condition ?? {}).flatMap((operator) => Object.keys(operator));
}

function option(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function contextFromArgs(args) {
  const context = {};
  const contextTypes = {};
  const optionCount = args.filter((argument) => argument === "--context-entries").length;
  assert.ok(optionCount <= 1, "context entries must use at most one list option");
  const index = args.indexOf("--context-entries");
  if (index >= 0) {
    const entries = JSON.parse(args[index + 1]);
    assert.ok(Array.isArray(entries), "--context-entries must contain one JSON list");
    for (const entry of entries) {
      context[entry.ContextKeyName] = entry.ContextKeyType.endsWith("List")
        ? entry.ContextKeyValues
        : entry.ContextKeyValues[0];
      contextTypes[entry.ContextKeyName] = entry.ContextKeyType;
    }
  }
  return { context, contextTypes };
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
  let productionServiceReads = 0;
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
      productionServiceReads += 1;
      const initialRevision = options.productionRevision ?? 38;
      const revision = options.changeDuringPlan && productionServiceReads > 1
        ? options.changedProductionRevision ?? initialRevision + 1
        : initialRevision;
      const taskDefinitionArn = `arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-production-web:${revision}`;
      const desiredCount = options.unhealthyService === "zero-desired" ? 0 : 1;
      const runningCount = options.unhealthyService === "not-running" ? 0 : desiredCount;
      const primaryTaskDefinition = options.primaryTaskDefinitionMismatch
        ? `${taskDefinitionArn}-unexpected`
        : taskDefinitionArn;
      const primaryDeployment = {
        status: "PRIMARY",
        taskDefinition: primaryTaskDefinition,
        desiredCount,
        runningCount,
        pendingCount: options.unhealthyService === "pending" ? 1 : 0,
        rolloutState: options.rolloutIncomplete ? "IN_PROGRESS" : "COMPLETED",
      };
      return {
        services: [{
          serviceName: "genesis-production-web",
          status: options.unhealthyService === "inactive" ? "DRAINING" : "ACTIVE",
          taskDefinition: taskDefinitionArn,
          desiredCount,
          runningCount,
          pendingCount: options.unhealthyService === "pending" ? 1 : 0,
          deployments: options.multiplePrimary
            ? [primaryDeployment, { ...primaryDeployment }]
            : [primaryDeployment],
          networkConfiguration: { awsvpcConfiguration: { securityGroups: ["sg-production-task"] } },
          loadBalancers: [{ targetGroupArn: prodTargetGroupArn }],
        }],
        failures: options.serviceFailures ? [{ reason: "mock failure" }] : [],
      };
    }
    if (service === "ecs" && operation === "describe-task-definition") {
      const revision = options.productionRevision ?? 38;
      const taskDefinitionArn = `arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-production-web:${revision}`;
      const container = {
        name: "GenesisWebRuntime",
        essential: true,
        image: `452630323448.dkr.ecr.us-west-2.amazonaws.com/${options.wrongImageRepository ?? "genesis-production-runtime"}:c8e3da0`,
        portMappings: options.wrongPort
          ? [{ containerPort: 3001, hostPort: 3001, protocol: "tcp" }]
          : [{ containerPort: 3000, hostPort: 3000, protocol: "tcp" }],
        mountPoints: options.unexpectedMount ? [{ sourceVolume: "unexpected", containerPath: "/unexpected" }] : [],
        volumesFrom: [],
        environment: [
          { name: "NODE_ENV", value: "production" },
          { name: "GENESIS_OPENAI_API_KEY", value: "never-print-this" },
          ...(options.commitProvenance === "absent" ? [] : [
            { name: "GIT_COMMIT", value: options.commitProvenance === "missing" ? "ffffffffffffffffffffffffffffffffffffffff" : "c8e3da0d7e0bd8e04509b9c4a59dc15c34602fbe" },
            { name: "GENESIS_RUNTIME_SHA", value: options.commitProvenance === "missing" ? "ffffffffffffffffffffffffffffffffffffffff" : "c8e3da0d7e0bd8e04509b9c4a59dc15c34602fbe" },
          ]),
        ],
        secrets: [{
          name: "GENESIS_WOOCOMMERCE_WEBHOOK_SECRET",
          valueFrom: "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/webhook-AbCdEf",
        }],
      };
      const containers = [container];
      if (options.unexpectedContainer) containers.push({ name: "unexpected-container", image: "unexpected" });
      return {
        taskDefinition: {
          taskDefinitionArn,
          revision,
          family: options.wrongFamily ? "unexpected-family" : "genesis-production-web",
          status: "ACTIVE",
          taskRoleArn: options.wrongTaskRole ? "arn:aws:iam::452630323448:role/unexpected-task-role" : prodRoleArn,
          executionRoleArn: options.wrongExecutionRole ? "arn:aws:iam::452630323448:role/unexpected-execution-role" : prodExecutionRoleArn,
          networkMode: options.wrongNetworkMode ? "bridge" : "awsvpc",
          requiresCompatibilities: options.wrongCompatibility ? ["EC2"] : ["FARGATE"],
          cpu: options.wrongCpu ? "1024" : "512",
          memory: options.wrongMemory ? "2048" : "1024",
          runtimePlatform: options.wrongRuntimePlatform
            ? { operatingSystemFamily: "LINUX", cpuArchitecture: "ARM64" }
            : { operatingSystemFamily: "LINUX", cpuArchitecture: "X86_64" },
          containerDefinitions: containers,
          volumes: options.unexpectedVolume ? [{ name: "unexpected" }] : [],
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
      return {
        imageDetails: [{
          imageDigest: `sha256:${"a".repeat(64)}`,
          imageTags: ["c8e3da0"],
          imagePushedAt: fixedNow.toISOString(),
        }],
      };
    }
    if (service === "iam" && operation === "simulate-custom-policy") {
      if (options.incompleteCustomSimulation) return {};
      const policiesIndex = args.indexOf("--policy-input-list");
      const action = option(args, "--action-names");
      const resource = option(args, "--resource-arns");
      assert.equal(args.slice(policiesIndex + 1, args.indexOf("--action-names")).length, 4);
      const policyArray = args.slice(policiesIndex + 1, args.indexOf("--action-names")).map((policy) => JSON.parse(policy));
      const cases = parseJson(await readFile(resolve(repoRoot, "infra/staging/iam/simulation-cases.json"), "utf8"));
      const { context, contextTypes } = contextFromArgs(args);
      const conditionKeys = policyConditionKeys(policyArray);
      const matched = cases.find((candidate) => {
        const effective = effectiveSimulationContext(candidate, conditionKeys);
        return candidate.action === action &&
          candidate.resource === resource &&
          JSON.stringify(Object.entries(effective.context).sort()) === JSON.stringify(Object.entries(context).sort()) &&
          JSON.stringify(Object.entries(effective.contextTypes).sort()) === JSON.stringify(Object.entries(contextTypes).sort());
      });
      assert.ok(matched, `mock has no custom simulation case for ${action} ${resource}`);
      let decision = matched.expect === "allow"
        ? "allowed"
        : matched.requireExplicitDeny ? "explicitDeny" : "implicitDeny";
      if (options.customAllowDenied && matched.expect === "allow") decision = "implicitDeny";
      if (options.customDenyAllowed && matched.expect === "deny") decision = "allowed";
      if (options.customExplicitDenied && matched.requireExplicitDeny) decision = "implicitDeny";
      if (
        options.missingSimulationContext &&
        (!options.missingSimulationResource || resource === options.missingSimulationResource)
      ) {
        return {
          EvaluationResults: [{
            EvalActionName: action,
            EvalResourceName: resource,
            EvalDecision: decision,
            MissingContextValues: options.missingSimulationContext,
          }],
        };
      }
      assert.equal(policyArray.length, 4);
      assert.ok(policyArray.every((policy) => Array.isArray(policy.Statement)));
      return { EvaluationResults: [{ EvalActionName: action, EvalResourceName: resource, EvalDecision: decision }] };
    }
    if (service === "iam" && operation === "simulate-principal-policy") {
      if (options.principalSimulationUnavailable) throw new Error("mock unavailable");
      const action = option(args, "--action-names");
      const resource = option(args, "--resource-arns");
      assert.equal(option(args, "--policy-source-arn"), deployRoleArn);
      const { context } = contextFromArgs(args);
      assert.ok(Object.keys(DEFAULT_SIMULATION_CONTEXT).every((key) => Object.hasOwn(context, key)));
      return { EvaluationResults: [{
        EvalActionName: action,
        EvalResourceName: resource,
        EvalDecision: options.principalDeniedAction === action ? "implicitDeny" : "allowed",
        MissingContextValues: options.missingPrincipalSimulationContext,
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
  assert.match(result.output, /PRODUCTION_TASK_DEFINITION_SNAPSHOT=arn:aws:ecs:us-west-2:452630323448:task-definition\/genesis-production-web:38/);
  assert.match(result.output, /PRODUCTION_TASK_DEFINITION_REVISION=38/);
  assert.match(result.output, /PRODUCTION_SERVICE_HEALTH=PASS/);
  assert.match(result.output, /PRODUCTION_STRUCTURE_VALIDATION=PASS/);
  assert.match(result.output, /PRODUCTION_IMAGE_URI=.*genesis-production-runtime:c8e3da0/);
  assert.match(result.output, /PRODUCTION_IMAGE_DIGEST=sha256:a{64}/);
  assert.match(result.output, /PRODUCTION_IMAGE_TAGS=\["c8e3da0"\]/);
  assert.match(result.output, /PRODUCTION_IMAGE_PUSHED_AT=/);
  assert.match(result.output, /PRODUCTION_COMMIT_PROVENANCE=(REPOSITORY_CONFIRMED|REPOSITORY_NOT_FOUND|ABSENT)/);
  assert.match(result.output, /PRODUCTION_TASK_DEFINITION_STABLE_DURING_PLAN=PASS/);
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=PASS cases=43 mismatches=0/);
  assert.match(result.output, /PRINCIPAL_POLICY_SIMULATION=PASS/);
  assert.match(result.output, /ROLE_USAGE_CLEARANCE=PLATFORM_ONLY/);
  assert.ok(result.output.endsWith("GENESIS_STAGING_PLAN_GATE=PASS"));
  assert.doesNotMatch(result.output, /never-print-this/);
  assert.match(result.output, /GENESIS_OPENAI_API_KEY.*unclassified-excluded/);
  assert.match(result.output, /GENESIS_WOOCOMMERCE_WEBHOOK_SECRET.*overridden-by-staging/);
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
  const simulationCalls = result.calls.filter(({ service, operation }) =>
    service === "iam" && ["simulate-custom-policy", "simulate-principal-policy"].includes(operation)
  );
  const customSimulationCalls = simulationCalls.filter(({ operation }) => operation === "simulate-custom-policy");
  const principalSimulationCalls = simulationCalls.filter(({ operation }) => operation === "simulate-principal-policy");
  const cases = parseJson(await readFile(join(repoRoot, "infra/staging/iam/simulation-cases.json"), "utf8"));
  assert.equal(customSimulationCalls.length, 43);
  assert.equal(principalSimulationCalls.length, cases.filter((item) => item.expect === "allow").length);
  for (const { args } of simulationCalls) {
    const { context } = contextFromArgs(args);
    assert.ok(Object.keys(DEFAULT_SIMULATION_CONTEXT).every((key) => Object.hasOwn(context, key)));
  }
  const stagingCreateSecretCall = customSimulationCalls.find(({ args }) =>
    option(args, "--action-names") === "secretsmanager:CreateSecret" &&
    option(args, "--resource-arns").includes("genesis/staging/")
  );
  const productionCreateSecretCall = customSimulationCalls.find(({ args }) =>
    option(args, "--action-names") === "secretsmanager:CreateSecret" &&
    option(args, "--resource-arns").includes("genesis/production/")
  );
  assert.ok(stagingCreateSecretCall);
  assert.ok(productionCreateSecretCall);
  for (const call of [stagingCreateSecretCall, productionCreateSecretCall]) {
    assert.equal(call.args.filter((argument) => argument === "--context-entries").length, 1);
    assert.ok(Array.isArray(JSON.parse(option(call.args, "--context-entries"))));
  }
  const productionEntries = JSON.parse(option(productionCreateSecretCall.args, "--context-entries"));
  const productionContext = Object.fromEntries(productionEntries.map((entry) => [
    entry.ContextKeyName,
    entry.ContextKeyType.endsWith("List") ? entry.ContextKeyValues : entry.ContextKeyValues[0],
  ]));
  const productionContextTypes = Object.fromEntries(productionEntries.map((entry) => [
    entry.ContextKeyName,
    entry.ContextKeyType,
  ]));
  assert.deepEqual(Object.keys(DEFAULT_SIMULATION_CONTEXT).sort(), [
    "aws:RequestTag/Environment",
    "aws:ResourceTag/Environment",
    "ec2:CreateAction",
    "elasticfilesystem:CreateAction",
    "elasticloadbalancing:CreateAction",
    "iam:AWSServiceName",
    "iam:PassedToService",
    "iam:PolicyARN",
  ].sort());
  assert.equal(productionContext["aws:RequestTag/Environment"], "production");
  assert.equal(productionContext["aws:ResourceTag/Environment"], "nonstaging");
  assert.equal(productionContext["iam:PassedToService"], "invalid.amazonaws.com");
  assert.equal(productionContext["iam:PolicyARN"], "arn:aws:iam::aws:policy/ReadOnlyAccess");
  assert.equal(productionContext["iam:AWSServiceName"], "invalid.amazonaws.com");
  assert.equal(productionContext["ec2:CreateAction"], "None");
  assert.equal(productionContext["elasticloadbalancing:CreateAction"], "None");
  assert.equal(productionContext["aws:TagKeys"][0], "Environment");
  assert.equal(productionContextTypes["aws:TagKeys"], "stringList");
  assert.equal(productionContextTypes["iam:PolicyARN"], "string");

  const stagingSecretPrincipalCall = principalSimulationCalls.find(({ args }) =>
    option(args, "--action-names") === "secretsmanager:CreateSecret" &&
    option(args, "--resource-arns").includes("genesis/staging/")
  );
  assert.ok(stagingSecretPrincipalCall);
  assert.equal(stagingSecretPrincipalCall.args.filter((argument) => argument === "--context-entries").length, 1);
  const stagingEntries = JSON.parse(option(stagingSecretPrincipalCall.args, "--context-entries"));
  assert.deepEqual(
    stagingEntries.map((entry) => entry.ContextKeyName).sort(),
    [...Object.keys(DEFAULT_SIMULATION_CONTEXT), "aws:TagKeys"].sort(),
  );
  assert.equal(
    stagingEntries.find((entry) => entry.ContextKeyName === "aws:RequestTag/Environment").ContextKeyValues[0],
    "staging",
  );
  assert.equal(stagingEntries.find((entry) => entry.ContextKeyName === "iam:PolicyARN").ContextKeyType, "string");
  assert.match(result.output, /SIMULATION_CONTEXT action=secretsmanager:CreateSecret resource=.*genesis\/production\/other-AbCdEf keys=/);
  assert.match(result.output, /SIMULATION_CONTEXT_VALUES .*aws:RequestTag\/Environment="production"/);
});

test("all conditioned policy statements matched by simulation cases have complete context keys", async () => {
  const cases = parseJson(await readFile(join(repoRoot, "infra/staging/iam/simulation-cases.json"), "utf8"));
  const policyFiles = [
    "01-read-only-production-inspection.json",
    "02-staging-compute-network-auth.json",
    "03-staging-data-iam.json",
    "04-production-guardrails-deny.json",
  ];
  assert.equal(cases.length, 43);
  const policies = [];
  for (const file of policyFiles) {
    const policy = parseJson(await readFile(join(repoRoot, "infra/staging/iam", file), "utf8"));
    policies.push(policy);
    for (const statement of policy.Statement.filter((candidate) => candidate.Condition)) {
      const matchingCases = cases.filter((simulationCase) => statementMatchesCase(statement, simulationCase));
      assert.ok(matchingCases.length > 0, `${file}:${statement.Sid} has no simulation case`);
      const keys = conditionKeys(statement);
      for (const simulationCase of matchingCases) {
        for (const key of keys) {
          assert.ok(
            Object.hasOwn(simulationCase.context ?? {}, key),
            `${simulationCase.action} on ${simulationCase.resource} lacks ${key} for ${file}:${statement.Sid}`,
          );
        }
      }
    }
  }
  const policyKeys = policyConditionKeys(policies);
  assert.deepEqual(policyKeys, Object.keys(DEFAULT_SIMULATION_CONTEXT).sort());
  assert.deepEqual(
    Object.fromEntries(policyKeys.map((key) => [key, DEFAULT_SIMULATION_CONTEXT[key].type])),
    {
      "aws:RequestTag/Environment": "string",
      "aws:ResourceTag/Environment": "string",
      "ec2:CreateAction": "string",
      "elasticfilesystem:CreateAction": "string",
      "elasticloadbalancing:CreateAction": "string",
      "iam:AWSServiceName": "string",
      "iam:PassedToService": "string",
      "iam:PolicyARN": "string",
    },
  );
  assert.deepEqual([...SIMULATION_CONTEXT_TYPES].sort(), [
    "string",
    "stringList",
    "numeric",
    "numericList",
    "boolean",
    "booleanList",
    "ip",
    "ipList",
    "binary",
    "binaryList",
    "date",
    "dateList",
  ].sort());
  for (const simulationCase of cases) {
    const effective = effectiveSimulationContext(simulationCase, policyKeys);
    assert.ok(policyKeys.every((key) => Object.hasOwn(effective.context, key)));
    assert.ok(policyKeys.every((key) => Object.hasOwn(effective.contextTypes, key)));
    assert.ok(Object.values(effective.contextTypes).every((type) => SIMULATION_CONTEXT_TYPES.includes(type)));
  }
  assert.ok(cases.every((simulationCase) =>
    Object.values(simulationCase.contextTypes ?? {}).every((type) => SIMULATION_CONTEXT_TYPES.includes(type))
  ));
  assert.ok(!SIMULATION_CONTEXT_TYPES.includes("arn"));
  assert.ok(!SIMULATION_CONTEXT_TYPES.includes("arnList"));
  const secretCreateCases = cases.filter((item) => item.action === "secretsmanager:CreateSecret");
  assert.equal(secretCreateCases.length, 2);
  for (const item of secretCreateCases) {
    assert.ok(Object.hasOwn(item.context, "aws:RequestTag/Environment"));
    assert.deepEqual(item.context["aws:TagKeys"], ["Environment"]);
    assert.equal(item.contextTypes["aws:TagKeys"], "stringList");
  }
});

test("neutral IAM context defaults are conservative, typed, and case overrides take precedence", async () => {
  assert.equal(DEFAULT_SIMULATION_CONTEXT["aws:RequestTag/Environment"].value, "nonstaging");
  assert.equal(DEFAULT_SIMULATION_CONTEXT["aws:ResourceTag/Environment"].value, "nonstaging");
  assert.equal(DEFAULT_SIMULATION_CONTEXT["iam:PassedToService"].value, "invalid.amazonaws.com");
  assert.equal(DEFAULT_SIMULATION_CONTEXT["iam:PolicyARN"].value, "arn:aws:iam::aws:policy/ReadOnlyAccess");
  assert.equal(DEFAULT_SIMULATION_CONTEXT["iam:PolicyARN"].type, "string");
  assert.equal(DEFAULT_SIMULATION_CONTEXT["iam:AWSServiceName"].value, "invalid.amazonaws.com");
  assert.equal(DEFAULT_SIMULATION_CONTEXT["ec2:CreateAction"].value, "None");
  assert.equal(DEFAULT_SIMULATION_CONTEXT["elasticfilesystem:CreateAction"].value, "None");
  assert.equal(DEFAULT_SIMULATION_CONTEXT["elasticloadbalancing:CreateAction"].value, "None");

  const cases = parseJson(await readFile(join(repoRoot, "infra/staging/iam/simulation-cases.json"), "utf8"));
  const policies = await Promise.all([
    "01-read-only-production-inspection.json",
    "02-staging-compute-network-auth.json",
    "03-staging-data-iam.json",
    "04-production-guardrails-deny.json",
  ].map(async (file) => parseJson(await readFile(join(repoRoot, "infra/staging/iam", file), "utf8"))));
  const conditionKeys = policyConditionKeys(policies);
  const passRole = cases.find((item) => item.action === "iam:PassRole" && item.expect === "allow");
  const effectivePassRole = effectiveSimulationContext(passRole, conditionKeys);
  assert.equal(effectivePassRole.context["iam:PassedToService"], "ecs-tasks.amazonaws.com");
  assert.equal(effectivePassRole.context["aws:RequestTag/Environment"], "nonstaging");
  assert.equal(effectivePassRole.contextTypes["iam:PolicyARN"], "string");
  const executionPolicy = cases.find((item) =>
    item.action === "iam:AttachRolePolicy" && item.expect === "allow"
  );
  const effectiveExecutionPolicy = effectiveSimulationContext(executionPolicy, conditionKeys);
  assert.equal(
    effectiveExecutionPolicy.context["iam:PolicyARN"],
    "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
  );
  assert.equal(effectiveExecutionPolicy.contextTypes["iam:PolicyARN"], "string");
  const securityGroupTag = cases.find((item) =>
    item.action === "ec2:CreateTags" && item.expect === "allow"
  );
  const effectiveSecurityGroupTag = effectiveSimulationContext(securityGroupTag, conditionKeys);
  assert.equal(effectiveSecurityGroupTag.context["aws:RequestTag/Environment"], "staging");
  assert.equal(effectiveSecurityGroupTag.context["ec2:CreateAction"], "CreateSecurityGroup");
  assert.throws(
    () => effectiveSimulationContext(passRole, [...conditionKeys, "iam:UnreviewedCondition"]),
    /no reviewed simulation defaults: iam:UnreviewedCondition/,
  );
});

test("IAM context entries use one AWS CLI JSON list with scalar, ARN-string, and list values", () => {
  const args = contextArguments({
    "aws:RequestTag/Environment": "staging",
    "iam:PolicyARN": "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
    "aws:TagKeys": ["Environment", "Owner"],
  }, { "iam:PolicyARN": "string" });
  assert.equal(args.filter((argument) => argument === "--context-entries").length, 1);
  assert.equal(args.length, 2);
  const entries = JSON.parse(option(args, "--context-entries"));
  assert.ok(Array.isArray(entries));
  assert.deepEqual(entries, [
    { ContextKeyName: "aws:RequestTag/Environment", ContextKeyValues: ["staging"], ContextKeyType: "string" },
    {
      ContextKeyName: "iam:PolicyARN",
      ContextKeyValues: ["arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"],
      ContextKeyType: "string",
    },
    { ContextKeyName: "aws:TagKeys", ContextKeyValues: ["Environment", "Owner"], ContextKeyType: "stringList" },
  ]);
  assert.deepEqual(contextFromArgs(args), {
    context: {
      "aws:RequestTag/Environment": "staging",
      "iam:PolicyARN": "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
      "aws:TagKeys": ["Environment", "Owner"],
    },
    contextTypes: {
      "aws:RequestTag/Environment": "string",
      "iam:PolicyARN": "string",
      "aws:TagKeys": "stringList",
    },
  });
  assert.throws(
    () => contextArguments({ "iam:PolicyARN": "arn:aws:iam::aws:policy/ReadOnlyAccess" }, { "iam:PolicyARN": "arn" }),
    /Unsupported IAM simulation context type for iam:PolicyARN: arn/,
  );
  assert.throws(
    () => contextArguments({ "iam:PolicyARN": "arn:aws:iam::aws:policy/ReadOnlyAccess" }, { "iam:PolicyARN": "arnList" }),
    /Unsupported IAM simulation context type for iam:PolicyARN: arnList/,
  );
  assert.throws(() => contextFromArgs([...args, ...args]), /at most one list option/);
  assert.throws(() => contextFromArgs(["--context-entries", "not-json"]), SyntaxError);
});

test("verify workflow checks out the requested staging ref and prints safe provenance", async () => {
  const workflow = await readFile(join(repoRoot, ".github/workflows/genesis-staging-bootstrap.yml"), "utf8");
  assert.match(workflow, /default:\s*infra\/genesis-staging-runtime-v1/);
  assert.match(workflow, /uses:\s*actions\/checkout@v4[\s\S]*?with:\s*\n\s+ref:\s*\$\{\{\s*inputs\.ref\s*\}\}/);
  assert.match(workflow, /STAGING_EXECUTION_GIT_SHA=\$staging_sha/);
  assert.match(workflow, /STAGING_EXECUTION_GIT_BRANCH=\$staging_branch/);
  assert.match(workflow, /STAGING_EXPECTED_REF=infra\/genesis-staging-runtime-v1/);
  assert.match(workflow, /git log -1 --format='%H %s'/);
  assert.doesNotMatch(workflow, /git remote -v/);
});

test("missing IAM simulation context reports action, resource, and keys then fails closed", async () => {
  const result = await executeGate({ missingSimulationContext: ["aws:RequestTag/Environment", "iam:PassedToService"] });
  assert.ok(result.error);
  assert.match(
    result.output,
    /SIMULATION_MISSING_CONTEXT action=secretsmanager:CreateSecret resource=arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis\/staging\/woocommerce-webhook-secret-AbCdEf keys=aws:RequestTag\/Environment,iam:PassedToService/,
  );
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=FAIL/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("missing principal-policy simulation context also reports details and fails closed", async () => {
  const result = await executeGate({ missingPrincipalSimulationContext: ["iam:PolicyARN"] });
  assert.ok(result.error);
  assert.match(
    result.output,
    /SIMULATION_MISSING_CONTEXT action=secretsmanager:CreateSecret resource=arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis\/staging\/woocommerce-webhook-secret-AbCdEf keys=iam:PolicyARN/,
  );
  assert.match(result.output, /PRINCIPAL_POLICY_SIMULATION=FAIL/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("staging and production CreateSecret cases use complete, distinct request-tag context", async () => {
  const cases = parseJson(await readFile(join(repoRoot, "infra/staging/iam/simulation-cases.json"), "utf8"));
  const staging = cases.find((item) =>
    item.action === "secretsmanager:CreateSecret" && item.resource.includes("genesis/staging/")
  );
  const production = cases.find((item) =>
    item.action === "secretsmanager:CreateSecret" && item.resource.includes("genesis/production/")
  );
  assert.ok(staging);
  assert.ok(production);
  assert.equal(staging.expect, "allow");
  assert.equal(staging.context["aws:RequestTag/Environment"], "staging");
  assert.deepEqual(staging.context["aws:TagKeys"], ["Environment"]);
  assert.equal(staging.contextTypes["aws:TagKeys"], "stringList");
  assert.equal(production.expect, "deny");
  assert.equal(production.requireExplicitDeny, undefined);
  assert.equal(production.context["aws:RequestTag/Environment"], "production");
  assert.deepEqual(production.context["aws:TagKeys"], ["Environment"]);
  assert.equal(production.contextTypes["aws:TagKeys"], "stringList");

  const policy = parseJson(await readFile(join(repoRoot, "infra/staging/iam/02-staging-compute-network-auth.json"), "utf8"));
  const secretStatement = policy.Statement.find((statement) => statement.Sid === "SecretsStagingWebhook");
  assert.ok(secretStatement.Action.includes("secretsmanager:CreateSecret"));
  assert.equal(
    secretStatement.Resource,
    "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/staging/woocommerce-webhook-secret-*",
  );
  assert.doesNotMatch(secretStatement.Resource, /production/);
  assert.equal(secretStatement.Condition, undefined);

  const result = await executeGate();
  assert.ifError(result.error);
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=PASS cases=43 mismatches=0/);
});

test("missing production CreateSecret context remains visible and fails closed", async () => {
  const resource = "arn:aws:secretsmanager:us-west-2:452630323448:secret:genesis/production/other-AbCdEf";
  const result = await executeGate({
    missingSimulationContext: ["aws:RequestTag/Environment", "aws:TagKeys"],
    missingSimulationResource: resource,
  });
  assert.ok(result.error);
  assert.ok(result.output.includes(
    `SIMULATION_MISSING_CONTEXT action=secretsmanager:CreateSecret resource=${resource} keys=aws:RequestTag/Environment,aws:TagKeys`,
  ));
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=FAIL/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("required IAM simulation contexts preserve PassRole, tagging, and service-link constraints", async () => {
  const cases = parseJson(await readFile(join(repoRoot, "infra/staging/iam/simulation-cases.json"), "utf8"));
  const find = (action, resourcePart, expect) => {
    const item = cases.find((candidate) =>
      candidate.action === action &&
      candidate.resource.includes(resourcePart) &&
      candidate.expect === expect
    );
    assert.ok(item, `Missing ${expect} case for ${action} ${resourcePart}`);
    return item;
  };
  assert.equal(find("iam:PassRole", "genesis-staging-execution-role", "allow").context["iam:PassedToService"], "ecs-tasks.amazonaws.com");
  const productionPassRole = find("iam:PassRole", "GenesisRuntimeStack-RuntimeTaskRole", "deny");
  assert.equal(productionPassRole.requireExplicitDeny, true);
  assert.equal(productionPassRole.context["iam:PassedToService"], "ecs-tasks.amazonaws.com");
  const nonEcsPassRole = find("iam:PassRole", "genesis-staging-task-role", "deny");
  assert.equal(nonEcsPassRole.context["iam:PassedToService"], "lambda.amazonaws.com");
  assert.equal(nonEcsPassRole.requireExplicitDeny, undefined);
  const attachExecution = find("iam:AttachRolePolicy", "genesis-staging-execution-role", "allow");
  assert.equal(attachExecution.context["iam:PolicyARN"], "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy");
  assert.equal(attachExecution.contextTypes["iam:PolicyARN"], "string");
  const deniedAttach = find("iam:AttachRolePolicy", "genesis-staging-task-role", "deny");
  assert.equal(deniedAttach.contextTypes["iam:PolicyARN"], "string");
  assert.equal(find("iam:CreateServiceLinkedRole", "elasticfilesystem.amazonaws.com", "allow").context["iam:AWSServiceName"], "elasticfilesystem.amazonaws.com");
  assert.equal(find("ec2:CreateSecurityGroup", "security-group/", "allow").context["aws:RequestTag/Environment"], "staging");
  const sgTag = find("ec2:CreateTags", "security-group/", "allow");
  assert.equal(sgTag.context["aws:RequestTag/Environment"], "staging");
  assert.equal(sgTag.context["ec2:CreateAction"], "CreateSecurityGroup");
  assert.equal(find("elasticloadbalancing:CreateRule", "listener/app/", "allow").context["aws:RequestTag/Environment"], "staging");
  const elbTag = find("elasticloadbalancing:AddTags", "listener-rule/", "allow");
  assert.equal(elbTag.context["aws:RequestTag/Environment"], "staging");
  assert.equal(elbTag.context["elasticloadbalancing:CreateAction"], "CreateRule");
  assert.equal(find("ec2:AuthorizeSecurityGroupIngress", "sg-0123456789abcdef0", "allow").context["aws:ResourceTag/Environment"], "staging");
  assert.ok(cases.filter((item) => item.expect === "deny").every((item) => item.context && typeof item.context === "object"));
});

test("EFS and ELB tag-on-create policies use AWS resource and CreateAction semantics", async () => {
  const cases = parseJson(await readFile(join(repoRoot, "infra/staging/iam/simulation-cases.json"), "utf8"));
  const efs = parseJson(await readFile(join(repoRoot, "infra/staging/iam/03-staging-data-iam.json"), "utf8"));
  const elb = parseJson(await readFile(join(repoRoot, "infra/staging/iam/02-staging-compute-network-auth.json"), "utf8"));
  const statement = (policy, sid) => {
    const result = policy.Statement.find((candidate) => candidate.Sid === sid);
    assert.ok(result, `Missing statement ${sid}`);
    return result;
  };
  const find = (action, resourcePart, expect, contextPredicate = () => true) => {
    const result = cases.find((candidate) =>
      candidate.action === action &&
      candidate.resource.includes(resourcePart) &&
      candidate.expect === expect &&
      contextPredicate(candidate.context)
    );
    assert.ok(result, `Missing ${expect} case for ${action} ${resourcePart}`);
    return result;
  };

  // CreateFileSystem has no IAM resource type, so AWS requires Resource "*".
  const createFileSystem = statement(efs, "EfsCreateStagingFileSystem");
  assert.deepEqual(createFileSystem.Action, ["elasticfilesystem:CreateFileSystem"]);
  assert.equal(createFileSystem.Resource, "*");
  assert.equal(createFileSystem.Condition.StringEquals["aws:RequestTag/Environment"], "staging");
  const createFsAllow = find("elasticfilesystem:CreateFileSystem", "*", "allow");
  const createFsDeny = cases.find((candidate) =>
    candidate.action === "elasticfilesystem:CreateFileSystem" &&
    candidate.resource === "*" &&
    candidate.expect === "deny" &&
    candidate.context["aws:RequestTag/Environment"] === "production"
  );
  assert.ok(createFsDeny);
  assert.equal(createFsAllow.context["aws:RequestTag/Environment"], "staging");

  const createAccessPoint = statement(efs, "EfsCreateStagingAccessPoint");
  assert.deepEqual(createAccessPoint.Action, ["elasticfilesystem:CreateAccessPoint"]);
  assert.equal(createAccessPoint.Resource, "arn:aws:elasticfilesystem:us-west-2:452630323448:file-system/*");
  assert.notEqual(createAccessPoint.Resource, "*");
  assert.equal(find("elasticfilesystem:CreateAccessPoint", "file-system/", "allow").context["aws:RequestTag/Environment"], "staging");

  const tagEfsOnCreate = statement(efs, "EfsTagStagingResourcesOnCreate");
  assert.deepEqual(tagEfsOnCreate.Resource, [
    "arn:aws:elasticfilesystem:us-west-2:452630323448:file-system/*",
    "arn:aws:elasticfilesystem:us-west-2:452630323448:access-point/*",
  ]);
  assert.deepEqual(tagEfsOnCreate.Condition.StringEquals["elasticfilesystem:CreateAction"], [
    "CreateFileSystem",
    "CreateAccessPoint",
  ]);
  assert.equal(tagEfsOnCreate.Condition.StringEquals["aws:RequestTag/Environment"], "staging");
  assert.equal(find(
    "elasticfilesystem:TagResource",
    "file-system/",
    "allow",
    (context) => context["elasticfilesystem:CreateAction"] === "CreateFileSystem",
  ).context["aws:RequestTag/Environment"], "staging");
  assert.equal(find(
    "elasticfilesystem:TagResource",
    "access-point/",
    "allow",
    (context) => context["elasticfilesystem:CreateAction"] === "CreateAccessPoint",
  ).context["aws:RequestTag/Environment"], "staging");
  assert.ok(find(
    "elasticfilesystem:TagResource",
    "file-system/",
    "deny",
    (context) => context["elasticfilesystem:CreateAction"] === "None",
  ));
  assert.ok(efs.Statement.filter((candidate) =>
    candidate.Action?.some((action) => action.startsWith("elasticfilesystem:")) &&
    !["EfsCreateStagingFileSystem", "EfsDescribe"].includes(candidate.Sid)
  ).every((candidate) => candidate.Resource !== "*"));

  // AWS's ELB tag-on-create pattern uses Resource "*" and CreateAction to deny standalone AddTags.
  const addTags = statement(elb, "ElbRuleTagOnCreate");
  assert.deepEqual(addTags.Action, ["elasticloadbalancing:AddTags"]);
  assert.equal(addTags.Resource, "*");
  assert.equal(addTags.Condition.StringEquals["elasticloadbalancing:CreateAction"], "CreateRule");
  assert.equal(addTags.Condition.StringEquals["aws:RequestTag/Environment"], "staging");
  const allowRuleArn = find("elasticloadbalancing:AddTags", "listener-rule/", "allow", (context) =>
    context["elasticloadbalancing:CreateAction"] === "CreateRule" &&
    context["aws:RequestTag/Environment"] === "staging"
  );
  assert.match(allowRuleArn.resource, /:listener-rule\/app\/[^/]+\/[^/]+\/[^/]+\/rule-[^/]+$/);
  assert.ok(find("elasticloadbalancing:AddTags", "listener-rule/", "deny", (context) =>
    context["elasticloadbalancing:CreateAction"] === "None" &&
    context["aws:RequestTag/Environment"] === "staging"
  ));
  assert.ok(find("elasticloadbalancing:AddTags", "listener-rule/", "deny", (context) =>
    context["elasticloadbalancing:CreateAction"] === "CreateRule" &&
    context["aws:RequestTag/Environment"] === "production"
  ));

  const result = await executeGate();
  assert.ifError(result.error);
  assert.match(result.output, /CUSTOM_POLICY_SIMULATION=PASS cases=43 mismatches=0/);
});

test("production guardrail deny simulations remain explicit and context-complete", async () => {
  const cases = parseJson(await readFile(join(repoRoot, "infra/staging/iam/simulation-cases.json"), "utf8"));
  const required = [
    ["secretsmanager:GetSecretValue", "genesis/production/", true],
    ["ecs:UpdateService", "genesis-production-web", true],
    ["cognito-idp:UpdateUserPoolClient", "us-west-2_3ACTeHTON", true],
    ["iam:PassRole", "GenesisRuntimeStack-RuntimeTaskRole", true],
    ["ecr:PutImage", "genesis-production-runtime", true],
    ["elasticloadbalancing:ModifyTargetGroup", "some-production-tg", true],
    ["elasticloadbalancing:ModifyListener", "listener/app/", true],
    ["ec2:AuthorizeSecurityGroupIngress", "sg-02f456f2dea97f1be", true],
  ];
  for (const [action, resourcePart, explicit] of required) {
    const item = cases.find((candidate) =>
      candidate.action === action &&
      candidate.resource.includes(resourcePart) &&
      candidate.expect === "deny"
    );
    assert.ok(item, `Missing production guardrail simulation for ${action} ${resourcePart}`);
    assert.equal(item.requireExplicitDeny, explicit);
    assert.ok(item.context && typeof item.context === "object");
  }
});

for (const revision of [38, 39, 40, 1042]) {
  test(`current production revision ${revision} passes when reviewed invariants hold`, async () => {
    const result = await executeGate({ productionRevision: revision });
    assert.ifError(result.error);
    assert.match(result.output, new RegExp(`PRODUCTION_TASK_DEFINITION_REVISION=${revision}(?:\\n|$)`));
    assert.match(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
  });
}

test("wrong production task role fails closed", async () => {
  const result = await executeGate({ wrongTaskRole: true });
  assert.ok(result.error);
  assert.match(result.error.message, /task role differs from the reviewed architecture/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("wrong production execution role fails closed", async () => {
  const result = await executeGate({ wrongExecutionRole: true });
  assert.ok(result.error);
  assert.match(result.error.message, /execution role differs from the reviewed architecture/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("wrong production image repository fails closed", async () => {
  const result = await executeGate({ wrongImageRepository: "unexpected-runtime" });
  assert.ok(result.error);
  assert.match(result.error.message, /image repository must be genesis-production-runtime/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("wrong production CPU or memory fails closed", async (t) => {
  for (const options of [{ wrongCpu: true }, { wrongMemory: true }]) {
    await t.test(JSON.stringify(options), async () => {
      const result = await executeGate(options);
      assert.ok(result.error);
      assert.match(result.error.message, /CPU must be 512|memory must be 1024/);
      assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
    });
  }
});

test("wrong production network mode fails closed", async () => {
  const result = await executeGate({ wrongNetworkMode: true });
  assert.ok(result.error);
  assert.match(result.error.message, /network mode is not awsvpc/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("wrong production runtime platform fails closed", async () => {
  const result = await executeGate({ wrongRuntimePlatform: true });
  assert.ok(result.error);
  assert.match(result.error.message, /runtime platform must be LINUX\/X86_64/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("unhealthy or ambiguous production service fails closed", async (t) => {
  for (const [name, options, expected] of [
    ["not running", { unhealthyService: "not-running" }, /runningCount does not match desiredCount/],
    ["zero desired", { unhealthyService: "zero-desired" }, /desiredCount must be at least 1/],
    ["pending task", { unhealthyService: "pending" }, /has pending tasks/],
    ["inactive", { unhealthyService: "inactive" }, /missing or not ACTIVE/],
    ["response failures", { serviceFailures: true }, /response includes failures/],
    ["multiple primary deployments", { multiplePrimary: true }, /exactly one PRIMARY deployment/],
    ["primary task definition mismatch", { primaryTaskDefinitionMismatch: true }, /PRIMARY task definition differs/],
  ]) {
    await t.test(name, async () => {
      const result = await executeGate(options);
      assert.ok(result.error);
      assert.match(result.error.message, expected);
      assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
    });
  }
});

test("production rollout that is not completed fails closed", async () => {
  const result = await executeGate({ rolloutIncomplete: true });
  assert.ok(result.error);
  assert.match(result.error.message, /PRIMARY rollout is not COMPLETED/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("production task definition change during plan fails with both snapshot ARNs", async () => {
  const result = await executeGate({ productionRevision: 40, changeDuringPlan: true });
  assert.ok(result.error);
  assert.match(result.error.message, /PRODUCTION_CHANGED_DURING_PLAN/);
  assert.match(result.output, /PRODUCTION_TASK_DEFINITION_STARTING_ARN=.*:40/);
  assert.match(result.output, /PRODUCTION_TASK_DEFINITION_ENDING_ARN=.*:41/);
  assert.doesNotMatch(result.output, /PRODUCTION_TASK_DEFINITION_STABLE_DURING_PLAN=PASS/);
  assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("missing repository commit provenance requires review without blocking infrastructure safety", async () => {
  const result = await executeGate({ commitProvenance: "missing" });
  assert.ifError(result.error);
  assert.match(result.output, /PRODUCTION_COMMIT_PROVENANCE=REPOSITORY_NOT_FOUND/);
  assert.match(result.output, /PRODUCTION_PROVENANCE_REVIEW=REQUIRED/);
  assert.doesNotMatch(result.output, /PRODUCTION_COMMIT_PROVENANCE=REPOSITORY_CONFIRMED/);
  assert.match(result.output, /PRODUCTION_STRUCTURE_VALIDATION=PASS/);
  assert.match(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("absent repository commit provenance is reported as ABSENT and requires review", async () => {
  const result = await executeGate({ commitProvenance: "absent" });
  assert.ifError(result.error);
  assert.match(result.output, /PRODUCTION_COMMIT_PROVENANCE=ABSENT/);
  assert.match(result.output, /PRODUCTION_PROVENANCE_REVIEW=REQUIRED/);
  assert.match(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
});

test("unexpected production mount points, volumes, containers, and ports fail closed", async (t) => {
  for (const [name, options, expected] of [
    ["mount", { unexpectedMount: true }, /unapproved mount point/],
    ["volume", { unexpectedVolume: true }, /unapproved volume/],
    ["container", { unexpectedContainer: true }, /unexpected containers/],
    ["port", { wrongPort: true }, /only TCP port 3000/],
    ["family", { wrongFamily: true }, /family is unexpected/],
    ["compatibility", { wrongCompatibility: true }, /compatibility must be exactly FARGATE/],
  ]) {
    await t.test(name, async () => {
      const result = await executeGate(options);
      assert.ok(result.error);
      assert.match(result.error.message, expected);
      assert.doesNotMatch(result.output, /GENESIS_STAGING_PLAN_GATE=PASS/);
    });
  }
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

test("provision.sh uses the plan snapshot and verifies stability immediately before PASS", async () => {
  const script = await readFile(join(repoRoot, "infra", "staging", "provision.sh"), "utf8");
  const planBranch = script.indexOf('if [ "$MODE" = "plan" ]; then');
  const preflight = script.indexOf('node "$HERE/plan-gate.mjs" --preflight');
  const firstAwsCall = script.indexOf('aws ecs describe-services');
  const snapshotExtraction = script.indexOf("PRODUCTION_TASK_DEFINITION_SNAPSHOT=");
  const completion = script.lastIndexOf('echo "GENESIS_STAGING_PLAN_GATE=PASS"');
  const doneLog = script.lastIndexOf('log "done"');
  const finalSnapshotCheck = script.lastIndexOf('node "$HERE/plan-gate.mjs" --verify-snapshot "$PROD_TASKDEF_REF"');
  assert.ok(planBranch >= 0 && planBranch < preflight);
  assert.ok(preflight < firstAwsCall);
  assert.ok(snapshotExtraction > preflight && snapshotExtraction < firstAwsCall);
  assert.ok(doneLog < finalSnapshotCheck && finalSnapshotCheck < completion);
  assert.ok(doneLog < completion);
  assert.doesNotMatch(script, /genesis-production-web:38/);
  assert.doesNotMatch(script, /report_plan_extras\s*\|\|\s*true/);
  assert.match(script, /PLAN_GATE_PREFLIGHT_OUTPUT="\$\(node "\$HERE\/plan-gate\.mjs" --preflight 2>&1\)"/);
  assert.match(script, /printf '%s\\n' "\$PLAN_GATE_PREFLIGHT_OUTPUT" >&2\s+exit "\$PLAN_GATE_PREFLIGHT_STATUS"/);
});
