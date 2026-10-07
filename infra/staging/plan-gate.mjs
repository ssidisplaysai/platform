import { execFileSync } from "node:child_process";
import { lookup, resolveCname } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";

const ACCOUNT_ID = "452630323448";
const REGION = "us-west-2";
const DEPLOY_ROLE = "GenesisGitHubDeployRole";
const DEPLOY_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/${DEPLOY_ROLE}`;
const STAGING_TASK_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/genesis-staging-task-role`;
const STAGING_EXECUTION_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/genesis-staging-execution-role`;
const STAGING_HOST = "staging.glwplatform.com";
const SIMULATION_CASE_COUNT = 32;
const PROPOSED_POLICY_FILES = [
  "01-read-only-production-inspection.json",
  "02-staging-compute-network-auth.json",
  "03-staging-data-iam.json",
  "04-production-guardrails-deny.json",
];
const READ_ONLY_APIS = new Set([
  "sts:get-caller-identity",
  "ecs:describe-services",
  "ecs:describe-task-definition",
  "elbv2:describe-target-groups",
  "elbv2:describe-listeners",
  "elbv2:describe-rules",
  "elbv2:describe-listener-certificates",
  "elbv2:describe-load-balancers",
  "elbv2:describe-target-health",
  "ec2:describe-security-groups",
  "cognito-idp:describe-user-pool-client",
  "cognito-idp:describe-user-pool",
  "cognito-idp:list-user-pool-clients",
  "iam:get-role",
  "iam:list-attached-role-policies",
  "iam:list-role-policies",
  "iam:get-role-policy",
  "iam:simulate-custom-policy",
  "iam:simulate-principal-policy",
  "ecr:describe-images",
  "cloudtrail:lookup-events",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJson(value) {
  return JSON.parse(value.replace(/^\uFEFF/, ""));
}

function asObject(value, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} returned invalid JSON`);
  return value;
}

function requiredArray(value, label) {
  assert(Array.isArray(value), `${label} response is missing its required array`);
  return value;
}

function lastArnComponent(value) {
  return String(value ?? "").split("/").at(-1);
}

function roleNameFromArn(value) {
  return String(value ?? "").split(":role/")[1] ?? lastArnComponent(value);
}

function redactPolicy(value) {
  if (Array.isArray(value)) return value.map(redactPolicy);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        /secret|password|token|credential|private.?key/i.test(key) ? "<redacted>" : redactPolicy(child),
      ]),
    );
  }
  return value;
}

function contextArguments(context = {}) {
  const args = [];
  for (const [key, value] of Object.entries(context)) {
    args.push("--context-entries", `ContextKeyName=${key},ContextKeyValues=${value},ContextKeyType=string`);
  }
  return args;
}

function contextSignature(context = {}) {
  return Object.entries(context).sort(([left], [right]) => left.localeCompare(right));
}

function caseSignature(testCase) {
  return JSON.stringify([
    testCase.action,
    testCase.resource,
    testCase.expect,
    contextSignature(testCase.context),
  ]);
}

function simulationResult(response, testCase, apiName) {
  const results = requiredArray(response?.EvaluationResults, `${apiName} ${testCase.action}`);
  assert(results.length === 1, `${apiName} ${testCase.action} returned ${results.length} results; expected exactly one`);
  const result = asObject(results[0], `${apiName} result`);
  assert(result.EvalActionName === testCase.action, `${apiName} returned an incomplete or mismatched action result`);
  assert(result.EvalResourceName === testCase.resource, `${apiName} returned an incomplete or mismatched resource result`);
  assert(
    ["allowed", "explicitDeny", "implicitDeny"].includes(result.EvalDecision),
    `${apiName} returned ambiguous decision ${String(result.EvalDecision)}`,
  );
  assert(!result.MissingContextValues?.length, `${apiName} returned unresolved context values`);
  return result;
}

function normalizePolicyDocument(value, label) {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      try {
        value = JSON.parse(decodeURIComponent(value));
      } catch {
        throw new Error(`${label} policy document is not readable JSON`);
      }
    }
  }
  return redactPolicy(asObject(value, label));
}

function operationArgs(service, operation, args, region) {
  const list = [service, operation, ...args];
  if (region) list.push("--region", region);
  list.push("--output", "json");
  return list;
}

function defaultAws(service, operation, args, region) {
  const key = `${service}:${operation}`.toLowerCase();
  assert(READ_ONLY_APIS.has(key), `Refusing non-allowlisted AWS API call: ${service} ${operation}`);
  try {
    const output = execFileSync("aws", operationArgs(service, operation, args, region), {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
    try {
      return JSON.parse(output);
    } catch {
      throw new Error(`${service} ${operation} returned invalid JSON`);
    }
  } catch (error) {
    const detail = error.stderr?.toString().trim();
    const wrapped = new Error(`${service} ${operation} failed${detail ? `: ${detail}` : ""}`);
    wrapped.code = error.code;
    wrapped.stderr = detail;
    throw wrapped;
  }
}

function classifyEnvironment(name, value, allowlist) {
  const denied = allowlist.deny.includes(name) ||
    allowlist.denyPatterns.some((pattern) => new RegExp(pattern).test(name));
  if (allowlist.overrides.includes(name)) return "overridden-by-staging";
  if (denied) return "denied";
  if (allowlist.environment.allow.includes(name)) return "copy";
  if (allowlist.environment.allowIfLoopbackValue.includes(name)) {
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(value)
      ? "copy"
      : "excluded-non-loopback";
  }
  return "unclassified-excluded";
}

function classifySecret(name, allowlist) {
  if (allowlist.overrides.includes(name)) return "overridden-by-staging";
  if (
    allowlist.deny.includes(name) ||
    allowlist.denyPatterns.some((pattern) => new RegExp(pattern).test(name))
  ) return "denied";
  if (allowlist.secrets.allow.includes(name)) return "copy";
  if (allowlist.secrets.reviewRequired.includes(name)) return "excluded-review-required";
  return "unclassified-excluded";
}

function policyAllowsProductionPassRole(policies, productionTaskRoleArn) {
  return policies.some((policy) => {
    for (const statement of policy.Statement ?? []) {
      if (statement.Effect !== "Allow") continue;
      const actions = Array.isArray(statement.Action) ? statement.Action : [statement.Action];
      const grantsPassRole = actions.some((action) => {
        if (typeof action !== "string") return false;
        const regex = new RegExp(`^${action.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");
        return regex.test("iam:PassRole");
      });
      if (!grantsPassRole) continue;
      const resources = Array.isArray(statement.Resource) ? statement.Resource : [statement.Resource];
      if (resources.some((resource) => {
        if (typeof resource !== "string") return false;
        const regex = new RegExp(`^${resource.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
        return regex.test(productionTaskRoleArn);
      })) return true;
    }
    return false;
  });
}

function roleSubject(event) {
  let cloudTrailEvent;
  try {
    cloudTrailEvent = JSON.parse(event.CloudTrailEvent ?? "{}");
  } catch {
    return { subject: "", principal: "" };
  }
  const response = cloudTrailEvent.responseElements ?? {};
  const user = cloudTrailEvent.userIdentity ?? {};
  const subject = response.subjectFromWebIdentityToken ?? response.subject ?? "";
  return { subject: String(subject), principal: String(user.principalId ?? "") };
}

function classifyRoleUsage(events) {
  if (events.length === 0) return "UNKNOWN";
  let unknown = false;
  for (const event of events) {
    const { subject, principal } = event;
    const identity = subject || principal;
    if (!identity) {
      unknown = true;
      continue;
    }
    if (!identity.includes("repo:ssidisplaysai/platform:")) return "SHARED_ROLE";
  }
  return unknown ? "UNKNOWN" : "PLATFORM_ONLY";
}

export async function runPlanGate({
  aws = defaultAws,
  report = (line) => console.log(line),
  now = new Date(),
  repoRoot = fileURLToPath(new URL("../..", import.meta.url)),
  emitPass = true,
  resolveDns = async (_host, albDns) => {
    try {
      const [addresses, albAddresses, cnames] = await Promise.all([
        lookup(STAGING_HOST, { all: true }),
        lookup(albDns, { all: true }),
        resolveCname(STAGING_HOST).catch(() => []),
      ]);
      return {
        addresses: addresses.map(({ address }) => address),
        albAddresses: albAddresses.map(({ address }) => address),
        cname: cnames[0] ?? "",
      };
    } catch {
      try {
        const [addresses, cnames] = await Promise.all([
          lookup(STAGING_HOST, { all: true }),
          resolveCname(STAGING_HOST).catch(() => []),
        ]);
        return { addresses: addresses.map(({ address }) => address), albAddresses: [], cname: cnames[0] ?? "" };
      } catch {
        return { addresses: [], albAddresses: [], cname: "" };
      }
    }
  },
} = {}) {
  const call = async (service, operation, args = [], region = REGION) => {
    assert(READ_ONLY_APIS.has(`${service}:${operation}`.toLowerCase()), `Refusing non-read-only AWS call ${service} ${operation}`);
    try {
      return asObject(await aws(service, operation, args, region), `${service} ${operation}`);
    } catch (error) {
      const wrapped = new Error(`Required read ${service} ${operation} failed: ${error.message}`);
      wrapped.code = error.code;
      throw wrapped;
    }
  };

  report("=== Genesis staging approval plan (read-only) ===");
  const identity = await call("sts", "get-caller-identity");
  assert(identity.Account === ACCOUNT_ID, `Unexpected AWS account ${String(identity.Account)}`);
  const callerArn = identity.Arn;

  const serviceResponse = await call("ecs", "describe-services", [
    "--cluster", "genesis-production", "--services", "genesis-production-web",
  ]);
  const productionService = requiredArray(serviceResponse.services, "Production ECS service")[0];
  assert(productionService?.status === "ACTIVE", "Production ECS service is missing or not ACTIVE");
  assert(requiredArray(serviceResponse.failures, "Production ECS service failures").length === 0, "Production ECS service response includes failures");
  const productionTaskDefinitionArn = productionService.taskDefinition;
  const productionTaskGroup = requiredArray(productionService.networkConfiguration?.awsvpcConfiguration?.securityGroups, "Production task security groups")[0];
  const productionTargetGroupArn = requiredArray(productionService.loadBalancers, "Production service target groups")[0]?.targetGroupArn;
  assert(productionTaskDefinitionArn && productionTaskGroup && productionTargetGroupArn, "Production ECS service response is incomplete");
  assert(
    /\/genesis-production-web:38$/.test(productionTaskDefinitionArn),
    `Production service task definition differs from the reviewed genesis-production-web:38 reference: ${productionTaskDefinitionArn}`,
  );

  const taskDefinitionResponse = await call("ecs", "describe-task-definition", [
    "--task-definition", productionTaskDefinitionArn,
  ]);
  const taskDefinition = asObject(taskDefinitionResponse.taskDefinition, "Production task definition");
  const productionTaskRoleArn = taskDefinition.taskRoleArn;
  const productionExecutionRoleArn = taskDefinition.executionRoleArn;
  assert(productionTaskRoleArn && productionExecutionRoleArn, "Production task role or execution role is missing");
  const container = requiredArray(taskDefinition.containerDefinitions, "Production task definition containers")
    .find((candidate) => candidate.name === "GenesisWebRuntime");
  assert(container?.image, "Production GenesisWebRuntime container or image is missing");

  const productionRoles = [productionTaskRoleArn, productionExecutionRoleArn];
  for (const arn of productionRoles) {
    await call("iam", "get-role", ["--role-name", roleNameFromArn(arn)]);
  }

  const productionTargetResponse = await call("elbv2", "describe-target-groups", [
    "--target-group-arns", productionTargetGroupArn,
  ]);
  const productionTargetGroup = requiredArray(productionTargetResponse.TargetGroups, "Production target groups")[0];
  assert(productionTargetGroup?.TargetGroupArn === productionTargetGroupArn, "Production target group could not be read");

  const stagingTargetResponse = await call("elbv2", "describe-target-groups", [
    "--names", "genesis-staging-web",
  ]);
  const stagingTargetGroup = requiredArray(stagingTargetResponse.TargetGroups, "Staging target groups")[0];
  assert(stagingTargetGroup?.TargetGroupArn, "Staging target group could not be read");
  assert(stagingTargetGroup.TargetGroupArn !== productionTargetGroupArn, "Staging target group resolves to production target group");
  for (const [label, targetGroup] of [
    ["Production", productionTargetGroup],
    ["Staging", stagingTargetGroup],
  ]) {
    assert(
      targetGroup.HealthCheckProtocol &&
      targetGroup.HealthCheckPort &&
      targetGroup.HealthCheckPath &&
      targetGroup.Matcher?.HttpCode,
      `${label} target-group health check is incomplete`,
    );
  }
  const loadBalancerArn = requiredArray(productionTargetGroup.LoadBalancerArns, "Production target group load balancers")[0];
  assert(loadBalancerArn, "Production target group has no load balancer");

  const productionSgResponse = await call("ec2", "describe-security-groups", [
    "--group-ids", productionTaskGroup,
  ]);
  const productionSecurityGroup = requiredArray(productionSgResponse.SecurityGroups, "Production task security groups")[0];
  assert(productionSecurityGroup?.GroupId === productionTaskGroup, "Production task security group could not be read");

  const listenerResponse = await call("elbv2", "describe-listeners", [
    "--load-balancer-arn", loadBalancerArn,
  ]);
  const listeners = requiredArray(listenerResponse.Listeners, "HTTPS listeners");
  const httpsListeners = listeners.filter((listener) => listener.Port === 443);
  assert(httpsListeners.length === 1 && httpsListeners[0].ListenerArn, "HTTPS:443 listener is missing or ambiguous");
  const listener = httpsListeners[0];
  const loadBalancerResponse = await call("elbv2", "describe-load-balancers", [
    "--load-balancer-arns", loadBalancerArn,
  ]);
  const loadBalancer = requiredArray(loadBalancerResponse.LoadBalancers, "Production load balancers")[0];
  assert(loadBalancer?.LoadBalancerArn === loadBalancerArn && loadBalancer.DNSName, "Production load balancer or DNS name is missing");
  const rulesResponse = await call("elbv2", "describe-rules", ["--listener-arn", listener.ListenerArn]);
  const rules = requiredArray(rulesResponse.Rules, "HTTPS listener rules");
  assert(rules.length > 0, "HTTPS listener rules are empty");
  const certificateResponse = await call("elbv2", "describe-listener-certificates", [
    "--listener-arn", listener.ListenerArn,
  ]);
  const certificates = requiredArray(certificateResponse.Certificates, "HTTPS listener certificates");
  assert(certificates.length > 0, "HTTPS listener certificate list is empty");

  const defaultCognito = requiredArray(listener.DefaultActions, "HTTPS listener default actions")
    .find((action) => action.Type === "authenticate-cognito")?.AuthenticateCognitoConfig;
  assert(defaultCognito, "HTTPS listener default action does not provide Cognito configuration");
  const poolArn = defaultCognito.UserPoolArn;
  const productionClientId = defaultCognito.UserPoolClientId;
  const poolId = lastArnComponent(poolArn);
  assert(poolArn && poolId && productionClientId, "Production Cognito pool/client configuration is incomplete");
  const productionClientResponse = await call("cognito-idp", "describe-user-pool-client", [
    "--user-pool-id", poolId, "--client-id", productionClientId,
  ]);
  const productionClient = asObject(productionClientResponse.UserPoolClient, "Production Cognito client");
  assert(productionClient.ClientId === productionClientId, "Production Cognito client read returned a different client");
  const poolResponse = await call("cognito-idp", "describe-user-pool", ["--user-pool-id", poolId]);
  const userPool = asObject(poolResponse.UserPool, "Production Cognito user pool");
  assert(userPool.Id === poolId, "Production Cognito pool read returned a different pool");

  const clients = [];
  let paginationToken;
  do {
    const args = ["--user-pool-id", poolId, "--max-results", "60"];
    if (paginationToken) args.push("--next-token", paginationToken);
    const page = await call("cognito-idp", "list-user-pool-clients", args);
    clients.push(...requiredArray(page.UserPoolClients, "Cognito user pool clients"));
    paginationToken = page.NextToken;
  } while (paginationToken);
  const stagingClients = clients.filter((client) => client.ClientName === "genesis-staging-operators-client");
  assert(stagingClients.length <= 1, "Multiple staging Cognito clients have the reserved staging client name");
  const stagingClientId = stagingClients[0]?.ClientId ?? "";
  assert(!stagingClientId || stagingClientId !== productionClientId, "Staging Cognito client resolves to the production client");

  const deployRoleResponse = await call("iam", "get-role", ["--role-name", DEPLOY_ROLE]);
  const deployRole = asObject(deployRoleResponse.Role, "Deploy role");
  const attachedResponse = await call("iam", "list-attached-role-policies", ["--role-name", DEPLOY_ROLE]);
  const attachedPolicies = requiredArray(attachedResponse.AttachedPolicies, "Deploy-role attached policies");
  const inlineResponse = await call("iam", "list-role-policies", ["--role-name", DEPLOY_ROLE]);
  const inlineNames = requiredArray(inlineResponse.PolicyNames, "Deploy-role inline policy names");
  const inlinePolicies = [];
  for (const policyName of inlineNames) {
    const policyResponse = await call("iam", "get-role-policy", [
      "--role-name", DEPLOY_ROLE, "--policy-name", policyName,
    ]);
    assert(policyResponse.PolicyDocument, `Inline policy ${policyName} has no readable policy document`);
    inlinePolicies.push({ name: policyName, document: normalizePolicyDocument(policyResponse.PolicyDocument, policyName) });
  }

  let stagingTaskRole = { exists: false, attached: [], inline: [] };
  try {
    await call("iam", "get-role", ["--role-name", "genesis-staging-task-role"]);
    stagingTaskRole.exists = true;
    const [attached, inline] = await Promise.all([
      call("iam", "list-attached-role-policies", ["--role-name", "genesis-staging-task-role"]),
      call("iam", "list-role-policies", ["--role-name", "genesis-staging-task-role"]),
    ]);
    stagingTaskRole.attached = requiredArray(attached.AttachedPolicies, "Staging task-role attached policies");
    stagingTaskRole.inline = requiredArray(inline.PolicyNames, "Staging task-role inline policy names");
    assert(
      stagingTaskRole.attached.length === 0 && stagingTaskRole.inline.length === 0,
      "Staging task role has attached or inline permissions",
    );
  } catch (error) {
    if (error.code !== "NoSuchEntity" && !/NoSuchEntity|cannot be found/i.test(error.message)) throw error;
  }

  const allowlist = JSON.parse(await readFile(resolve(repoRoot, "infra/staging/runtime-env-allowlist.json"), "utf8"));
  const environmentRows = requiredArray(container.environment ?? [], "Production container environment").map(({ name, value }) => {
    assert(typeof name === "string" && name.length > 0, "Production environment entry is missing its name");
    return { name, disposition: classifyEnvironment(name, value ?? "", allowlist) };
  });
  const secretRows = requiredArray(container.secrets ?? [], "Production container secrets").map(({ name, valueFrom }) => {
    assert(typeof name === "string" && name.length > 0 && typeof valueFrom === "string" && valueFrom.length > 0, "Production secret entry is incomplete");
    return { name, sourceArn: valueFrom, disposition: classifySecret(name, allowlist) };
  });
  const image = container.image;
  const imageRepository = image.match(/^[^/]+\/([^:@]+)/)?.[1];
  const imageDigest = image.match(/@(sha256:[a-fA-F0-9]+)$/)?.[1];
  const imageTag = image.includes("@") ? "" : image.match(/:([^/:]+)$/)?.[1] ?? "";
  assert(imageRepository && (imageDigest || imageTag), "Production image URI does not include a usable repository and tag/digest");
  const imageDetailsResponse = await call("ecr", "describe-images", [
    "--repository-name", imageRepository,
    "--image-ids", imageDigest ? `imageDigest=${imageDigest}` : `imageTag=${imageTag}`,
  ]);
  const imageDetails = requiredArray(imageDetailsResponse.imageDetails, "Production ECR image metadata");
  assert(imageDetails.length === 1 && imageDetails[0].imageDigest, "Production ECR image metadata is incomplete");

  const productionTaskRoleName = lastArnComponent(productionTaskRoleArn);
  const policyDocuments = [];
  for (const fileName of PROPOSED_POLICY_FILES) {
    const document = JSON.parse(await readFile(resolve(repoRoot, "infra/staging/iam", fileName), "utf8"));
    assert(document.Version && Array.isArray(document.Statement), `${fileName} is not a valid IAM policy document`);
    policyDocuments.push(document);
  }
  assert(
    !policyAllowsProductionPassRole(policyDocuments, productionTaskRoleArn),
    `Production task role ${productionTaskRoleName} appears in an allowed staging iam:PassRole resource`,
  );
  const simulationCases = parseJson(await readFile(resolve(repoRoot, "infra/staging/iam/simulation-cases.json"), "utf8"));
  assert(
    Array.isArray(simulationCases) && simulationCases.length === SIMULATION_CASE_COUNT,
    `Simulation case inventory is incomplete: found ${simulationCases?.length ?? "invalid"}; expected ${SIMULATION_CASE_COUNT}`,
  );
  const caseSet = new Set();
  for (const testCase of simulationCases) {
    assert(
      testCase && typeof testCase.action === "string" && testCase.action &&
      typeof testCase.resource === "string" && testCase.resource &&
      ["allow", "deny"].includes(testCase.expect) &&
      testCase.context && typeof testCase.context === "object" && !Array.isArray(testCase.context),
      "Simulation case is incomplete or ambiguous",
    );
    const signature = caseSignature(testCase);
    assert(!caseSet.has(signature), `Duplicate simulation case: ${testCase.action} on ${testCase.resource}`);
    caseSet.add(signature);
  }
  assert(simulationCases.some((testCase) =>
    testCase.action === "iam:PassRole" &&
    testCase.resource === productionTaskRoleArn &&
    testCase.expect === "deny" &&
    testCase.requireExplicitDeny === true
  ), "Simulation cases are missing the explicit production-task-role PassRole deny");

  let customMismatchCount = 0;
  try {
    for (const testCase of simulationCases) {
      const args = [
        "--policy-input-list",
        ...policyDocuments.map((document) => JSON.stringify(document)),
        "--action-names", testCase.action,
        "--resource-arns", testCase.resource,
        ...contextArguments(testCase.context),
      ];
      const response = await call("iam", "simulate-custom-policy", args);
      const result = simulationResult(response, testCase, "SimulateCustomPolicy");
      const matches = testCase.expect === "allow"
        ? result.EvalDecision === "allowed"
        : testCase.requireExplicitDeny
          ? result.EvalDecision === "explicitDeny"
          : ["explicitDeny", "implicitDeny"].includes(result.EvalDecision);
      if (!matches) {
        customMismatchCount += 1;
        report(`CUSTOM_POLICY_MISMATCH action=${testCase.action} resource=${testCase.resource} expected=${testCase.expect}${testCase.requireExplicitDeny ? "/explicitDeny" : ""} actual=${result.EvalDecision}`);
      }
    }
  } catch (error) {
    report(`CUSTOM_POLICY_SIMULATION=FAIL reason=${error.message}`);
    throw error;
  }
  report(`CUSTOM_POLICY_SIMULATION=${customMismatchCount === 0 ? "PASS" : "FAIL"} cases=${simulationCases.length} mismatches=${customMismatchCount}`);
  assert(customMismatchCount === 0, `Custom policy simulation has ${customMismatchCount} mismatches`);

  let principalMismatchCount = 0;
  try {
    for (const testCase of simulationCases.filter((candidate) => candidate.expect === "allow")) {
      const response = await call("iam", "simulate-principal-policy", [
        "--policy-source-arn", DEPLOY_ROLE_ARN,
        "--action-names", testCase.action,
        "--resource-arns", testCase.resource,
        ...contextArguments(testCase.context),
      ]);
      const result = simulationResult(response, testCase, "SimulatePrincipalPolicy");
      report(`PRINCIPAL_POLICY_RESULT action=${testCase.action} resource=${testCase.resource} decision=${result.EvalDecision}`);
      if (result.EvalDecision !== "allowed") {
        principalMismatchCount += 1;
        report(`PRINCIPAL_POLICY_NOT_ALLOWED action=${testCase.action} resource=${testCase.resource} decision=${result.EvalDecision}`);
      }
    }
  } catch (error) {
    report(`PRINCIPAL_POLICY_SIMULATION=FAIL reason=${error.message}`);
    throw error;
  }
  report(`PRINCIPAL_POLICY_SIMULATION=${principalMismatchCount === 0 ? "PASS" : "FAIL"} requiredStagingActions=${simulationCases.filter((candidate) => candidate.expect === "allow").length} mismatches=${principalMismatchCount}`);
  assert(principalMismatchCount === 0, `Principal policy simulation has ${principalMismatchCount} staging-action mismatches`);

  const roleUsageEvents = [];
  let roleUsageClearance = "UNKNOWN";
  let roleUsageError = "";
  const startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  try {
    for (const region of ["us-east-1", "us-west-2"]) {
      let nextToken;
      do {
        const args = [
          "--lookup-attributes", "AttributeKey=EventName,AttributeValue=AssumeRoleWithWebIdentity",
          "--start-time", startTime, "--end-time", now.toISOString(), "--max-results", "50",
        ];
        if (nextToken) args.push("--next-token", nextToken);
        const page = await call("cloudtrail", "lookup-events", args, region);
        for (const lookupEvent of requiredArray(page.Events, `CloudTrail ${region} events`)) {
          let event;
          try {
            event = JSON.parse(lookupEvent.CloudTrailEvent ?? "{}");
          } catch {
            throw new Error(`CloudTrail returned invalid event JSON in ${region}`);
          }
          if (event.requestParameters?.roleArn !== DEPLOY_ROLE_ARN) continue;
          roleUsageEvents.push({
            timestamp: event.eventTime ?? lookupEvent.EventTime ?? "",
            region: event.awsRegion ?? region,
            roleArn: event.requestParameters.roleArn,
            ...roleSubject(lookupEvent),
          });
        }
        nextToken = page.NextToken;
      } while (nextToken);
    }
    roleUsageClearance = classifyRoleUsage(roleUsageEvents);
  } catch (error) {
    roleUsageError = error.message;
    roleUsageClearance = "UNKNOWN";
  }
  report("=== CloudTrail AssumeRoleWithWebIdentity usage (last 90 days) ===");
  for (const event of roleUsageEvents) {
    report(`timestamp=${event.timestamp || "<unknown>"} region=${event.region} role=${event.roleArn} subject=${event.subject || "<unavailable>"} principal=${event.principal || "<unavailable>"}`);
  }
  if (roleUsageError) report(`CloudTrail evidence unavailable/incomplete: ${roleUsageError}`);
  report(`ROLE_USAGE_CLEARANCE=${roleUsageClearance}`);
  assert(
    roleUsageClearance === "PLATFORM_ONLY",
    `Role usage does not clear the role for narrowing (${roleUsageClearance})`,
  );

  const targetHealth = [];
  for (const [label, targetGroup] of [
    ["production", productionTargetGroup],
    ["staging", stagingTargetGroup],
  ]) {
    const response = await call("elbv2", "describe-target-health", [
      "--target-group-arn", targetGroup.TargetGroupArn,
    ]);
    targetHealth.push({ label, states: requiredArray(response.TargetHealthDescriptions, `${label} target health`) });
  }

  const commit = container.environment?.find((item) => item.name === "GIT_COMMIT")?.value ?? "<not set>";
  const runtimeSha = container.environment?.find((item) => item.name === "GENESIS_RUNTIME_SHA")?.value ?? "<not set>";
  const provenanceValues = [...new Set([commit, runtimeSha, imageTag].filter((value) => value && value !== "<not set>"))];
  const provenance = provenanceValues.map((value) => {
    if (!/^[0-9a-f]{7,40}$/i.test(value)) return { value, result: "CANNOT be tied to repository (not a commit SHA)" };
    try {
      execFileSync("git", ["-C", repoRoot, "cat-file", "-e", `${value}^{commit}`], { stdio: "ignore" });
      return { value, result: "CAN be tied to repository" };
    } catch {
      return { value, result: "CANNOT be tied to repository" };
    }
  });

  const dnsResult = await resolveDns(STAGING_HOST, loadBalancer.DNSName);
  const sharesAlbAddress = dnsResult.addresses.some((address) => dnsResult.albAddresses.includes(address));
  const stagingDns = {
    result: !dnsResult.addresses.length ? "does not resolve" : sharesAlbAddress ? "resolves to the Genesis ALB" : "resolves, but not to the Genesis ALB",
    addresses: dnsResult.addresses,
    albAddresses: dnsResult.albAddresses,
    cname: dnsResult.cname,
  };

  report(`AWS caller=${callerArn}`);
  report(`Production environment names/disposition=${JSON.stringify(environmentRows)}`);
  report(`Production secret names/source ARNs/disposition=${JSON.stringify(secretRows)}`);
  report(`Production image=${image} digest=${imageDetails[0].imageDigest} tags=${JSON.stringify(imageDetails[0].imageTags ?? [])}`);
  report(`Production GIT_COMMIT=${commit}`);
  report(`Production GENESIS_RUNTIME_SHA=${runtimeSha}`);
  for (const item of provenance) report(`Provenance ${item.value}: ${item.result}`);
  report(`Production Cognito client (ClientSecret excluded)=${JSON.stringify({
    ClientName: productionClient.ClientName,
    GenerateSecret: productionClient.GenerateSecret,
    CallbackURLs: productionClient.CallbackURLs,
    LogoutURLs: productionClient.LogoutURLs,
    AllowedOAuthFlows: productionClient.AllowedOAuthFlows,
    AllowedOAuthScopes: productionClient.AllowedOAuthScopes,
    AllowedOAuthFlowsUserPoolClient: productionClient.AllowedOAuthFlowsUserPoolClient,
    SupportedIdentityProviders: productionClient.SupportedIdentityProviders,
    ExplicitAuthFlows: productionClient.ExplicitAuthFlows,
    DefaultRedirectURI: productionClient.DefaultRedirectURI,
    RefreshTokenValidity: productionClient.RefreshTokenValidity,
    AccessTokenValidity: productionClient.AccessTokenValidity,
    IdTokenValidity: productionClient.IdTokenValidity,
    TokenValidityUnits: productionClient.TokenValidityUnits,
    PreventUserExistenceErrors: productionClient.PreventUserExistenceErrors,
    EnableTokenRevocation: productionClient.EnableTokenRevocation,
  })}`);
  report(`Production Cognito pool domain=${userPool.Domain ?? "<not set>"}`);
  report(`Listener=${listener.ListenerArn} defaultActions=${JSON.stringify(listener.DefaultActions.map(({ Type }) => Type))}`);
  report(`Listener rules=${JSON.stringify(rules.map(({ Priority, Conditions, Actions }) => ({ Priority, Conditions, Actions: Actions?.map(({ Type }) => Type) })))}`);
  report(`SNI certificates=${JSON.stringify(certificates.map(({ CertificateArn }) => CertificateArn))}`);
  report(`Production target-group health check=${JSON.stringify({
    protocol: productionTargetGroup.HealthCheckProtocol,
    port: productionTargetGroup.HealthCheckPort,
    path: productionTargetGroup.HealthCheckPath,
    matcher: productionTargetGroup.Matcher?.HttpCode,
  })}`);
  report(`Staging target-group health check=${JSON.stringify({
    protocol: stagingTargetGroup.HealthCheckProtocol,
    port: stagingTargetGroup.HealthCheckPort,
    path: stagingTargetGroup.HealthCheckPath,
    matcher: stagingTargetGroup.Matcher?.HttpCode,
  })}`);
  report(`Target health=${JSON.stringify(targetHealth.map(({ label, states }) => ({ label, states: states.map(({ Target, TargetHealth }) => ({ target: Target, state: TargetHealth?.State })) })))}`);
  report(`Deploy role trust=${JSON.stringify(deployRole.AssumeRolePolicyDocument ?? {})}`);
  report(`Deploy-role attached policies=${JSON.stringify(attachedPolicies)}`);
  report(`Deploy-role inline policies=${JSON.stringify(inlinePolicies)}`);
  report(`Staging task role=${stagingTaskRole.exists ? "present with no attached or inline policies" : "absent; apply would create it without application permissions"}`);
  report(`Staging iam:PassRole resources=${JSON.stringify([STAGING_EXECUTION_ROLE_ARN, STAGING_TASK_ROLE_ARN])} passedTo=ecs-tasks.amazonaws.com`);
  report(`Staging Cognito client=${stagingClientId || "<not created>"} productionClient=${productionClientId}`);
  report(`DNS ${STAGING_HOST}=${stagingDns.result} addresses=${JSON.stringify(stagingDns.addresses)} cname=${stagingDns.cname || "<none>"}`);
  if (!stagingDns.addresses.length) {
    const albDns = loadBalancer.DNSName;
    report(`DNS CNAME target required=${albDns || "<read from existing Genesis ALB>"}`);
  }
  report("Read-only approval inspection and policy simulations completed; no infrastructure has been applied.");
  if (emitPass) report("GENESIS_STAGING_PLAN_GATE=PASS");
  return { roleUsageClearance, simulationCases: simulationCases.length };
}

if (process.argv[1] && isAbsolute(process.argv[1]) && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  runPlanGate({ emitPass: !process.argv.includes("--preflight") }).catch((error) => {
    console.error(`PLAN_GATE_FAILURE=${error.message}`);
    process.exitCode = 1;
  });
}
