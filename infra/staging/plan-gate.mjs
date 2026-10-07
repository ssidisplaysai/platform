import { execFileSync } from "node:child_process";
import { lookup, resolveCname } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";

const ACCOUNT_ID = "452630323448";
const REGION = "us-west-2";
const DEPLOY_ROLE = "GenesisGitHubDeployRole";
const DEPLOY_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/${DEPLOY_ROLE}`;
const PRODUCTION_TASK_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/GenesisRuntimeStack-RuntimeTaskRoleCD4DE6A7-ekuyV7pdb88Q`;
const PRODUCTION_EXECUTION_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/GenesisRuntimeStack-RuntimeTaskExecutionRole9B42490-R0neRrBR8s7H`;
const PRODUCTION_TASK_FAMILY = "genesis-production-web";
const PRODUCTION_ECR_REPOSITORY = "genesis-production-runtime";
const STAGING_TASK_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/genesis-staging-task-role`;
const STAGING_EXECUTION_ROLE_ARN = `arn:aws:iam::${ACCOUNT_ID}:role/genesis-staging-execution-role`;
const STAGING_HOST = "staging.glwplatform.com";
const SIMULATION_CASE_COUNT = 52;
export const SIMULATION_CONTEXT_TYPES = Object.freeze([
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
]);
export const DEFAULT_SIMULATION_CONTEXT = Object.freeze({
  "aws:RequestTag/Environment": Object.freeze({ value: "nonstaging", type: "string" }),
  "aws:ResourceTag/Environment": Object.freeze({ value: "nonstaging", type: "string" }),
  "iam:PassedToService": Object.freeze({ value: "invalid.amazonaws.com", type: "string" }),
  "iam:PolicyARN": Object.freeze({ value: "arn:aws:iam::aws:policy/ReadOnlyAccess", type: "string" }),
  "iam:AWSServiceName": Object.freeze({ value: "invalid.amazonaws.com", type: "string" }),
  "elasticfilesystem:CreateAction": Object.freeze({ value: "None", type: "string" }),
  "ec2:CreateAction": Object.freeze({ value: "None", type: "string" }),
  "elasticloadbalancing:CreateAction": Object.freeze({ value: "None", type: "string" }),
});
const SAFE_SIMULATION_DIAGNOSTIC_KEYS = new Set([
  "aws:RequestTag/Environment",
  "aws:ResourceTag/Environment",
  "aws:TagKeys",
  "iam:PassedToService",
  "iam:PolicyARN",
  "iam:AWSServiceName",
  "ec2:CreateAction",
  "elasticloadbalancing:CreateAction",
]);
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

function productionRevision(taskDefinitionArn) {
  const match = /^arn:aws:ecs:us-west-2:452630323448:task-definition\/genesis-production-web:(\d+)$/.exec(taskDefinitionArn ?? "");
  assert(match, `Production task definition ARN is invalid: ${String(taskDefinitionArn)}`);
  const revision = Number(match[1]);
  assert(Number.isSafeInteger(revision) && revision > 0, `Production task definition revision is invalid: ${match[1]}`);
  return revision;
}

function validateProductionService(response, label = "Production ECS service") {
  const failures = requiredArray(response.failures, `${label} failures`);
  assert(failures.length === 0, `${label} response includes failures`);
  const services = requiredArray(response.services, label);
  assert(services.length === 1, `${label} is missing or ambiguous`);
  const service = asObject(services[0], label);
  assert(service.serviceName === PRODUCTION_TASK_FAMILY, `${label} returned an unexpected service`);
  assert(service.status === "ACTIVE", `${label} is missing or not ACTIVE`);
  const taskDefinitionArn = service.taskDefinition;
  productionRevision(taskDefinitionArn);
  const deployments = requiredArray(service.deployments, `${label} deployments`);
  const primaryDeployments = deployments.filter((deployment) => deployment.status === "PRIMARY");
  assert(primaryDeployments.length === 1, `${label} must have exactly one PRIMARY deployment`);
  const primary = primaryDeployments[0];
  assert(primary.taskDefinition === taskDefinitionArn, `${label} PRIMARY task definition differs from the service task definition`);
  assert(Number.isInteger(service.desiredCount) && service.desiredCount >= 1, `${label} desiredCount must be at least 1`);
  assert(service.runningCount === service.desiredCount, `${label} runningCount does not match desiredCount`);
  assert(service.pendingCount === 0, `${label} has pending tasks`);
  assert(primary.desiredCount === service.desiredCount, `${label} PRIMARY desiredCount does not match the service`);
  assert(primary.runningCount === primary.desiredCount, `${label} PRIMARY runningCount does not match desiredCount`);
  assert(primary.pendingCount === 0, `${label} PRIMARY deployment has pending tasks`);
  assert(primary.rolloutState === "COMPLETED", `${label} PRIMARY rollout is not COMPLETED`);
  return { service, primary, taskDefinitionArn, revision: productionRevision(taskDefinitionArn) };
}

async function verifyProductionSnapshot({ call, snapshot, report }) {
  productionRevision(snapshot);
  const response = await call("ecs", "describe-services", [
    "--cluster", "genesis-production", "--services", PRODUCTION_TASK_FAMILY,
  ]);
  const services = requiredArray(response.services, "Production ECS service");
  assert(services.length === 1, "Production ECS service is unavailable or ambiguous at plan completion");
  const endingService = asObject(services[0], "Production ECS service at plan completion");
  const endingArn = endingService.taskDefinition;
  if (endingArn !== snapshot) {
    report(`PRODUCTION_TASK_DEFINITION_STARTING_ARN=${snapshot}`);
    report(`PRODUCTION_TASK_DEFINITION_ENDING_ARN=${endingArn ?? "<unavailable>"}`);
    throw new Error(`PRODUCTION_CHANGED_DURING_PLAN starting=${snapshot} ending=${endingArn ?? "<unavailable>"}`);
  }
  validateProductionService(response, "Production ECS service at plan completion");
  report("PRODUCTION_TASK_DEFINITION_STABLE_DURING_PLAN=PASS");
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

export function contextArguments(context = {}, contextTypes = {}) {
  assert(
    Object.keys(contextTypes).every((key) => Object.hasOwn(context, key)),
    "IAM simulation context types contain a key without a context value",
  );
  const entries = Object.entries(context).map(([key, value]) => {
    const values = Array.isArray(value) ? value : [value];
    const type = contextTypes[key] ?? (Array.isArray(value) ? "stringList" : "string");
    assert(
      SIMULATION_CONTEXT_TYPES.includes(type),
      `Unsupported IAM simulation context type for ${key}: ${type}`,
    );
    assert(values.length > 0 && values.every((item) => ["string", "number", "boolean"].includes(typeof item)),
      `Invalid IAM simulation context values for ${key}`);
    return {
      ContextKeyName: key,
      ContextKeyValues: values.map(String),
      ContextKeyType: type,
    };
  });
  return entries.length ? ["--context-entries", JSON.stringify(entries)] : [];
}

export function policyConditionKeys(policyDocuments) {
  return [...new Set(policyDocuments.flatMap((document) =>
    (document.Statement ?? []).flatMap((statement) =>
      Object.values(statement.Condition ?? {}).flatMap((operator) => Object.keys(operator ?? {}))
    )
  ))].sort();
}

export function effectiveSimulationContext(testCase, conditionKeys) {
  const unreviewedKeys = conditionKeys.filter((key) => !Object.hasOwn(DEFAULT_SIMULATION_CONTEXT, key));
  assert(
    unreviewedKeys.length === 0,
    `IAM policy condition keys have no reviewed simulation defaults: ${unreviewedKeys.join(",")}`,
  );
  const context = Object.fromEntries(
    Object.entries(DEFAULT_SIMULATION_CONTEXT).map(([key, { value }]) => [key, value]),
  );
  const contextTypes = Object.fromEntries(
    Object.entries(DEFAULT_SIMULATION_CONTEXT).map(([key, { type }]) => [key, type]),
  );
  Object.assign(context, testCase.context ?? {});
  for (const [key, value] of Object.entries(testCase.context ?? {})) {
    if (testCase.contextTypes && Object.hasOwn(testCase.contextTypes, key)) {
      contextTypes[key] = testCase.contextTypes[key];
    } else if (!Object.hasOwn(contextTypes, key)) {
      contextTypes[key] = Array.isArray(value) ? "stringList" : "string";
    }
  }
  if (testCase.contextTypes) {
    for (const key of Object.keys(testCase.contextTypes)) {
      assert(Object.hasOwn(context, key), `Simulation context type has no value for ${key}`);
    }
  }
  for (const key of conditionKeys) {
    assert(Object.hasOwn(context, key), `Effective simulation context is missing policy condition key ${key}`);
    assert(Object.hasOwn(contextTypes, key), `Effective simulation context has no type for policy condition key ${key}`);
  }
  return { context, contextTypes };
}

function contextSignature(context = {}) {
  return Object.entries(context).sort(([left], [right]) => left.localeCompare(right));
}

function caseSignature(testCase) {
  return JSON.stringify([
    testCase.action,
    testCase.resource,
    testCase.expect,
    testCase.verificationMode ?? "",
    contextSignature(testCase.context),
    contextSignature(testCase.contextTypes),
  ]);
}

export function validateElbCreateRuleTagAuthorization(policyDocuments, simulationCases) {
  const specialCases = simulationCases.filter((testCase) =>
    testCase.verificationMode === "aws-dependent-action-static"
  );
  assert(specialCases.length === 1, "Expected exactly one AWS-dependent ELB tag-on-create case");
  const tagCase = specialCases[0];
  assert(
    tagCase.action === "elasticloadbalancing:AddTags" &&
    tagCase.expect === "allow" &&
    tagCase.context?.["elasticloadbalancing:CreateAction"] === "CreateRule" &&
    tagCase.context?.["aws:RequestTag/Environment"] === "staging" &&
    /^arn:aws:elasticloadbalancing:[^:]+:\d+:listener-rule\/app\/[^/]+\/[^/]+\/[^/]+\/rule-[^/]+$/.test(tagCase.resource),
    "AWS-dependent case is not the reviewed staging AddTags during CreateRule case",
  );
  assert(
    simulationCases.every((testCase) =>
      testCase === tagCase || testCase.verificationMode === undefined
    ),
    "Unknown simulation verification mode",
  );

  const allowStatements = policyDocuments.flatMap((document) => document.Statement ?? [])
    .filter((statement) =>
      statement.Effect === "Allow" &&
      (Array.isArray(statement.Action) ? statement.Action : [statement.Action])
        .includes("elasticloadbalancing:AddTags")
    );
  assert(allowStatements.length === 1, "Expected one reviewed allow statement for ELB AddTags");
  const addTags = allowStatements[0];
  const conditions = addTags.Condition?.StringEquals;
  assert(
    (Array.isArray(addTags.Action) ? addTags.Action : [addTags.Action]).length === 1 &&
    addTags.Resource === "*" &&
    conditions?.["elasticloadbalancing:CreateAction"] === "CreateRule" &&
    conditions?.["aws:RequestTag/Environment"] === "staging" &&
    Object.keys(conditions).length === 2 &&
    Object.keys(addTags.Condition).length === 1,
    "ELB AddTags policy must use Resource * with exact CreateRule and staging-tag conditions",
  );

  const listenerArn = tagCase.resource
    .replace(":listener-rule/", ":listener/")
    .replace(/\/rule-[^/]+$/, "");
  const createRuleCase = simulationCases.find((testCase) =>
    testCase.action === "elasticloadbalancing:CreateRule" &&
    testCase.resource === listenerArn &&
    testCase.expect === "allow" &&
    testCase.context?.["aws:RequestTag/Environment"] === "staging"
  );
  assert(createRuleCase, "ELB AddTags dependent authorization has no matching staging CreateRule simulation");

  const addTagsCases = simulationCases.filter((testCase) =>
    testCase.action === "elasticloadbalancing:AddTags" &&
    testCase.resource === tagCase.resource
  );
  const noCreateActionDeny = addTagsCases.find((testCase) =>
    testCase !== tagCase &&
    testCase.expect === "deny" &&
    testCase.context?.["elasticloadbalancing:CreateAction"] === "None" &&
    testCase.context?.["aws:RequestTag/Environment"] === "staging"
  );
  const productionTagDeny = addTagsCases.find((testCase) =>
    testCase !== tagCase &&
    testCase.expect === "deny" &&
    testCase.context?.["elasticloadbalancing:CreateAction"] === "CreateRule" &&
    testCase.context?.["aws:RequestTag/Environment"] === "production"
  );
  assert(noCreateActionDeny, "Missing standalone ELB AddTags deny simulation");
  assert(productionTagDeny, "Missing production-tagged ELB AddTags deny simulation");
  return { tagCase, createRuleCase, noCreateActionDeny, productionTagDeny };
}

function simulationResult(response, testCase, apiName, report) {
  const results = requiredArray(response?.EvaluationResults, `${apiName} ${testCase.action}`);
  assert(results.length === 1, `${apiName} ${testCase.action} returned ${results.length} results; expected exactly one`);
  const result = asObject(results[0], `${apiName} result`);
  assert(result.EvalActionName === testCase.action, `${apiName} returned an incomplete or mismatched action result`);
  assert(result.EvalResourceName === testCase.resource, `${apiName} returned an incomplete or mismatched resource result`);
  assert(
    ["allowed", "explicitDeny", "implicitDeny"].includes(result.EvalDecision),
    `${apiName} returned ambiguous decision ${String(result.EvalDecision)}`,
  );
  const missingContextValues = result.MissingContextValues ?? [];
  if (missingContextValues.length) {
    const keys = missingContextValues.map((value) => (
      typeof value === "string" ? value : value.ContextKeyName ?? JSON.stringify(value)
    ));
    report(`SIMULATION_MISSING_CONTEXT action=${testCase.action} resource=${testCase.resource} keys=${keys.join(",")}`);
    throw new Error(`${apiName} returned unresolved context values for ${testCase.action} on ${testCase.resource}`);
  }
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
    "--cluster", "genesis-production", "--services", PRODUCTION_TASK_FAMILY,
  ]);
  const {
    service: productionService,
    taskDefinitionArn: productionTaskDefinitionArn,
    revision: productionTaskDefinitionRevision,
  } = validateProductionService(serviceResponse);
  const productionTaskGroup = requiredArray(productionService.networkConfiguration?.awsvpcConfiguration?.securityGroups, "Production task security groups")[0];
  const productionTargetGroupArn = requiredArray(productionService.loadBalancers, "Production service target groups")[0]?.targetGroupArn;
  assert(productionTaskDefinitionArn && productionTaskGroup && productionTargetGroupArn, "Production ECS service response is incomplete");
  report(`PRODUCTION_TASK_DEFINITION_SNAPSHOT=${productionTaskDefinitionArn}`);
  report(`PRODUCTION_TASK_DEFINITION_REVISION=${productionTaskDefinitionRevision}`);
  report("PRODUCTION_SERVICE_HEALTH=PASS");

  const taskDefinitionResponse = await call("ecs", "describe-task-definition", [
    "--task-definition", productionTaskDefinitionArn,
  ]);
  const taskDefinition = asObject(taskDefinitionResponse.taskDefinition, "Production task definition");
  assert(taskDefinition.family === PRODUCTION_TASK_FAMILY, "Production task definition family is unexpected");
  assert(taskDefinition.taskDefinitionArn === productionTaskDefinitionArn, "Described task definition does not match the production service snapshot");
  assert(taskDefinition.revision === productionTaskDefinitionRevision, "Described task definition revision does not match the production service snapshot");
  assert(taskDefinition.status === "ACTIVE", "Current production task definition is not ACTIVE");
  assert(taskDefinition.taskRoleArn === PRODUCTION_TASK_ROLE_ARN, "Production task role differs from the reviewed architecture");
  assert(taskDefinition.executionRoleArn === PRODUCTION_EXECUTION_ROLE_ARN, "Production execution role differs from the reviewed architecture");
  const productionTaskRoleArn = taskDefinition.taskRoleArn;
  const productionExecutionRoleArn = taskDefinition.executionRoleArn;
  assert(taskDefinition.networkMode === "awsvpc", "Production task network mode is not awsvpc");
  assert(
    Array.isArray(taskDefinition.requiresCompatibilities) &&
    taskDefinition.requiresCompatibilities.length === 1 &&
    taskDefinition.requiresCompatibilities[0] === "FARGATE",
    "Production task compatibility must be exactly FARGATE",
  );
  assert(String(taskDefinition.cpu) === "512", "Production task CPU must be 512");
  assert(String(taskDefinition.memory) === "1024", "Production task memory must be 1024");
  assert(
    taskDefinition.runtimePlatform?.operatingSystemFamily === "LINUX" &&
    taskDefinition.runtimePlatform?.cpuArchitecture === "X86_64",
    "Production task runtime platform must be LINUX/X86_64",
  );
  const containers = requiredArray(taskDefinition.containerDefinitions, "Production task definition containers");
  assert(containers.length === 1, "Production task definition contains unexpected containers");
  const container = containers.find((candidate) => candidate.name === "GenesisWebRuntime");
  assert(container?.image, "Production GenesisWebRuntime container or image is missing");
  assert(container.essential === true, "Production GenesisWebRuntime must be essential");
  const portMappings = requiredArray(container.portMappings ?? [], "Production runtime container port mappings");
  assert(
    portMappings.length === 1 &&
    portMappings[0].containerPort === 3000 &&
    (!portMappings[0].hostPort || portMappings[0].hostPort === 3000) &&
    (!portMappings[0].protocol || portMappings[0].protocol.toLowerCase() === "tcp"),
    "Production GenesisWebRuntime must expose only TCP port 3000",
  );
  assert(requiredArray(container.mountPoints ?? [], "Production runtime container mount points").length === 0,
    "Production GenesisWebRuntime has an unapproved mount point");
  assert(requiredArray(container.volumesFrom ?? [], "Production runtime container volumesFrom").length === 0,
    "Production GenesisWebRuntime has an unapproved volumesFrom entry");
  assert(requiredArray(taskDefinition.volumes ?? [], "Production task definition volumes").length === 0,
    "Production task definition has an unapproved volume");

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
  const imageMatch = /^452630323448\.dkr\.ecr\.us-west-2\.amazonaws\.com\/([^:@]+)(?::([^/@]+)|@(sha256:[a-fA-F0-9]{64}))$/.exec(image);
  assert(imageMatch, "Production image URI must use the reviewed us-west-2 ECR registry and include a tag or digest");
  const imageRepository = imageMatch[1];
  const imageTag = imageMatch[2] ?? "";
  const imageDigest = imageMatch[3] ?? "";
  assert(imageRepository === PRODUCTION_ECR_REPOSITORY, `Production image repository must be ${PRODUCTION_ECR_REPOSITORY}`);
  const imageDetailsResponse = await call("ecr", "describe-images", [
    "--repository-name", imageRepository,
    "--image-ids", imageDigest ? `imageDigest=${imageDigest}` : `imageTag=${imageTag}`,
  ]);
  const imageDetails = requiredArray(imageDetailsResponse.imageDetails, "Production ECR image metadata");
  assert(
    imageDetails.length === 1 &&
    /^sha256:[a-fA-F0-9]{64}$/.test(imageDetails[0].imageDigest ?? "") &&
    (!imageDigest || imageDetails[0].imageDigest === imageDigest) &&
    imageDetails[0].imagePushedAt,
    "Production ECR image metadata is incomplete or does not match the image digest",
  );
  report("PRODUCTION_STRUCTURE_VALIDATION=PASS");
  report(`PRODUCTION_IMAGE_URI=${image}`);
  report(`PRODUCTION_IMAGE_DIGEST=${imageDetails[0].imageDigest}`);
  report(`PRODUCTION_IMAGE_TAGS=${JSON.stringify(imageDetails[0].imageTags ?? [])}`);
  report(`PRODUCTION_IMAGE_PUSHED_AT=${imageDetails[0].imagePushedAt}`);

  const productionTaskRoleName = lastArnComponent(productionTaskRoleArn);
  const policyDocuments = [];
  for (const fileName of PROPOSED_POLICY_FILES) {
    const document = JSON.parse(await readFile(resolve(repoRoot, "infra/staging/iam", fileName), "utf8"));
    assert(document.Version && Array.isArray(document.Statement), `${fileName} is not a valid IAM policy document`);
    policyDocuments.push(document);
  }
  const conditionKeys = policyConditionKeys(policyDocuments);
  effectiveSimulationContext({}, conditionKeys);
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
  const elbTagAuthorization = validateElbCreateRuleTagAuthorization(policyDocuments, simulationCases);
  assert(simulationCases.some((testCase) =>
    testCase.action === "iam:PassRole" &&
    testCase.resource === productionTaskRoleArn &&
    testCase.expect === "deny" &&
    testCase.requireExplicitDeny === true
  ), "Simulation cases are missing the explicit production-task-role PassRole deny");

  let customMismatchCount = 0;
  const customDecisions = new Map();
  try {
    for (const testCase of simulationCases) {
      if (testCase === elbTagAuthorization.tagCase) continue;
      const effectiveContext = effectiveSimulationContext(testCase, conditionKeys);
      const contextKeys = Object.keys(effectiveContext.context).sort();
      report(`SIMULATION_CONTEXT action=${testCase.action} resource=${testCase.resource} keys=${contextKeys.join(",")}`);
      report(`SIMULATION_CONTEXT_TYPES ${Object.entries(effectiveContext.contextTypes)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, type]) => `${key}:${type}`).join(",")}`);
      report(`SIMULATION_CONTEXT_VALUES ${contextKeys
        .filter((key) => SAFE_SIMULATION_DIAGNOSTIC_KEYS.has(key))
        .map((key) => `${key}=${JSON.stringify(effectiveContext.context[key])}`).join(",")}`);
      const args = [
        "--policy-input-list",
        ...policyDocuments.map((document) => JSON.stringify(document)),
        "--action-names", testCase.action,
        "--resource-arns", testCase.resource,
        ...contextArguments(effectiveContext.context, effectiveContext.contextTypes),
      ];
      const response = await call("iam", "simulate-custom-policy", args);
      const result = simulationResult(response, testCase, "SimulateCustomPolicy", report);
      customDecisions.set(testCase, result.EvalDecision);
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
  if (customMismatchCount > 0) {
    report(`CUSTOM_POLICY_SIMULATION=FAIL cases=${simulationCases.length} mismatches=${customMismatchCount}`);
  }
  assert(customMismatchCount === 0, `Custom policy simulation has ${customMismatchCount} mismatches`);
  assert(
    customDecisions.get(elbTagAuthorization.createRuleCase) === "allowed",
    "ELB CreateRule staging simulation did not allow the tag-on-create operation",
  );
  for (const negativeCase of [elbTagAuthorization.noCreateActionDeny, elbTagAuthorization.productionTagDeny]) {
    assert(
      ["explicitDeny", "implicitDeny"].includes(customDecisions.get(negativeCase)),
      "ELB AddTags negative simulation did not remain denied",
    );
  }
  // ELB AddTags with elasticloadbalancing:CreateAction is dependent authorization evaluated by ELB during CreateRule with tags; standalone IAM simulation does not reproduce the complete service create operation.
  report("ELB_CREATE_RULE_TAG_AUTHORIZATION=PASS");
  report(`CUSTOM_POLICY_SIMULATION=PASS cases=${simulationCases.length} mismatches=0`);

  let principalMismatchCount = 0;
  try {
    for (const testCase of simulationCases.filter((candidate) =>
      candidate.expect === "allow" && candidate.verificationMode !== "aws-dependent-action-static"
    )) {
      const effectiveContext = effectiveSimulationContext(testCase, conditionKeys);
      const response = await call("iam", "simulate-principal-policy", [
        "--policy-source-arn", DEPLOY_ROLE_ARN,
        "--action-names", testCase.action,
        "--resource-arns", testCase.resource,
        ...contextArguments(effectiveContext.context, effectiveContext.contextTypes),
      ]);
      const result = simulationResult(response, testCase, "SimulatePrincipalPolicy", report);
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

  const commit = container.environment?.find((item) => item.name === "GIT_COMMIT")?.value ?? "";
  const runtimeSha = container.environment?.find((item) => item.name === "GENESIS_RUNTIME_SHA")?.value ?? "";
  const commitValues = [...new Set([commit, runtimeSha].filter(Boolean))];
  const repositoryConfirmed = commitValues.length > 0 && commitValues.every((value) => {
    if (!/^[0-9a-f]{7,40}$/i.test(value)) return false;
    try {
      execFileSync("git", ["-C", repoRoot, "cat-file", "-e", `${value}^{commit}`], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });
  const commitProvenance = commitValues.length === 0
    ? "ABSENT"
    : repositoryConfirmed ? "REPOSITORY_CONFIRMED" : "REPOSITORY_NOT_FOUND";

  const dnsResult = await resolveDns(STAGING_HOST, loadBalancer.DNSName);
  const sharesAlbAddress = dnsResult.addresses.some((address) => dnsResult.albAddresses.includes(address));
  const stagingDns = {
    result: !dnsResult.addresses.length ? "does not resolve" : sharesAlbAddress ? "resolves to the Genesis ALB" : "resolves, but not to the Genesis ALB",
    addresses: dnsResult.addresses,
    albAddresses: dnsResult.albAddresses,
    cname: dnsResult.cname,
  };

  report(`AWS caller=${callerArn}`);
  report(`PRODUCTION_COMMIT_PROVENANCE=${commitProvenance}`);
  if (commitProvenance !== "REPOSITORY_CONFIRMED") report("PRODUCTION_PROVENANCE_REVIEW=REQUIRED");
  report(`Production environment names/disposition=${JSON.stringify(environmentRows)}`);
  report(`Production secret names/source ARNs/disposition=${JSON.stringify(secretRows)}`);
  report(`Production GIT_COMMIT=${commit || "<absent>"}`);
  report(`Production GENESIS_RUNTIME_SHA=${runtimeSha || "<absent>"}`);
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
  if (emitPass) {
    await verifyProductionSnapshot({ call, snapshot: productionTaskDefinitionArn, report });
    report("GENESIS_STAGING_PLAN_GATE=PASS");
  }
  return { roleUsageClearance, simulationCases: simulationCases.length };
}

if (process.argv[1] && isAbsolute(process.argv[1]) && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const snapshotIndex = process.argv.indexOf("--verify-snapshot");
  const execution = snapshotIndex >= 0
    ? verifyProductionSnapshot({
      call: async (service, operation, args = [], region = REGION) => {
        assert(READ_ONLY_APIS.has(`${service}:${operation}`.toLowerCase()), `Refusing non-read-only AWS call ${service} ${operation}`);
        try {
          return asObject(await defaultAws(service, operation, args, region), `${service} ${operation}`);
        } catch (error) {
          throw new Error(`Required read ${service} ${operation} failed: ${error.message}`);
        }
      },
      snapshot: process.argv[snapshotIndex + 1],
      report: (line) => console.log(line),
    })
    : runPlanGate({ emitPass: !process.argv.includes("--preflight") });
  execution.catch((error) => {
    console.error(`PLAN_GATE_FAILURE=${error.message}`);
    process.exitCode = 1;
  });
}
