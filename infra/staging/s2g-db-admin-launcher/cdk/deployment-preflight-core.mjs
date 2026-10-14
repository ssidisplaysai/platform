const REQUIRED_STACK_NAME = "GenesisStagingS2gDbAdminDiagnosticLauncherStack";
const REQUIRED_TABLE_NAME = "genesis-staging-s2g-db-admin-diagnostic-launches";
const PROTECTED_ECS_SERVICES = Object.freeze([
  "genesis-production-web",
  "genesis-share-to-grow-production",
  "genesis-staging-web",
]);

function failure(code, detail) {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  if (detail) error.detail = detail;
  return error;
}

function asObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw failure("DEPLOYMENT_PREFLIGHT_INVALID_DATA", `${label} must be an object`);
  }
  return value;
}

export function validateLauncherTemplateGuards(template) {
  const root = asObject(template, "template");
  const parameters = asObject(root.Parameters, "template.Parameters");
  const resources = asObject(root.Resources, "template.Resources");

  if (!parameters.LauncherActivationState || parameters.LauncherActivationState.Default !== "DISABLED") {
    throw failure("DEPLOYMENT_PREFLIGHT_ACTIVATION_NOT_DISABLED");
  }
  const allowed = parameters.LauncherActivationState.AllowedValues ?? [];
  if (JSON.stringify(allowed) !== JSON.stringify(["DISABLED", "ENABLED"])) {
    throw failure("DEPLOYMENT_PREFLIGHT_ACTIVATION_VALUES_INVALID");
  }
  if (!parameters.ApprovedDiagnosticTaskDefinitionArn || parameters.ApprovedDiagnosticTaskDefinitionArn.Default !== "") {
    throw failure("DEPLOYMENT_PREFLIGHT_TASK_ARN_DEFAULT_NOT_EMPTY");
  }

  const enabledPolicy = resources.DbAdminDiagnosticLauncherEnabledPolicy21B6A083;
  if (!enabledPolicy || enabledPolicy.Condition !== "LauncherEnabledCondition") {
    throw failure("DEPLOYMENT_PREFLIGHT_ENABLED_POLICY_UNGUARDED");
  }
  const operatorEnabledPolicy = resources.StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C;
  if (!operatorEnabledPolicy || operatorEnabledPolicy.Condition !== "LauncherEnabledCondition") {
    throw failure("DEPLOYMENT_PREFLIGHT_OPERATOR_POLICY_UNGUARDED");
  }

  const json = JSON.stringify(root);
  if (/genesis-production-web|genesis-share-to-grow-production/i.test(json)) {
    throw failure("DEPLOYMENT_PREFLIGHT_PRODUCTION_RESOURCE_REFERENCE");
  }
}

export function extractLauncherLambdaAsset({ template, assetManifest }) {
  const templateRoot = asObject(template, "template");
  const resources = asObject(templateRoot.Resources, "template.Resources");
  const lambdaFunction = asObject(resources.DbAdminDiagnosticLauncherFunction4A98B30B, "launcher lambda resource");
  const code = asObject(lambdaFunction.Properties?.Code, "launcher lambda code");
  const bucketIsSubString = typeof code.S3Bucket === "object" && typeof code.S3Bucket["Fn::Sub"] === "string";
  const bucketIsSubArray = typeof code.S3Bucket === "object" && Array.isArray(code.S3Bucket["Fn::Sub"]);
  if (!bucketIsSubString && !bucketIsSubArray) {
    throw failure("DEPLOYMENT_PREFLIGHT_UNEXPECTED_BUCKET_TOKEN");
  }
  if (typeof code.S3Key !== "string" || !code.S3Key.endsWith(".zip")) {
    throw failure("DEPLOYMENT_PREFLIGHT_UNEXPECTED_KEY");
  }

  const manifestRoot = asObject(assetManifest, "asset manifest");
  const files = asObject(manifestRoot.files, "asset manifest files");
  const lambdaAsset = Object.values(files).find((entry) => entry?.displayName === "DbAdminDiagnosticLauncherFunction/Code");
  if (!lambdaAsset) throw failure("DEPLOYMENT_PREFLIGHT_ASSET_ENTRY_MISSING");
  const destination = Object.values(lambdaAsset.destinations ?? {})[0];
  if (!destination || typeof destination.objectKey !== "string" || typeof destination.bucketName !== "string") {
    throw failure("DEPLOYMENT_PREFLIGHT_ASSET_DESTINATION_INVALID");
  }

  if (destination.objectKey !== code.S3Key) {
    throw failure("DEPLOYMENT_PREFLIGHT_ASSET_KEY_MISMATCH");
  }

  return {
    templateKey: code.S3Key,
    manifestKey: destination.objectKey,
    manifestBucketToken: destination.bucketName,
    sourcePath: lambdaAsset.source?.path ?? null,
  };
}

export function evaluateRecoverySafety({
  stackName,
  stackStatus,
  retainedTableExists,
  allowRollbackComplete = false,
}) {
  validateStackStateForMode({
    stackName,
    stackStatus,
    retainedTableExists,
    mode: "create",
    allowRollbackComplete,
  });
}

export function validateStackStateForMode({
  stackName,
  stackStatus,
  retainedTableExists,
  mode,
  allowRollbackComplete = false,
}) {
  if (stackName !== REQUIRED_STACK_NAME) throw failure("DEPLOYMENT_PREFLIGHT_STACK_NAME_MISMATCH");
  if (mode !== "create" && mode !== "update") throw failure("DEPLOYMENT_PREFLIGHT_MODE_INVALID");
  if (mode === "create") {
    if (stackStatus === "CREATE_COMPLETE") throw failure("DEPLOYMENT_PREFLIGHT_STACK_ALREADY_EXISTS");
    if (stackStatus === "ROLLBACK_COMPLETE" && !allowRollbackComplete) {
      throw failure("DEPLOYMENT_PREFLIGHT_ROLLBACK_REQUIRES_REVIEW");
    }
    if (retainedTableExists) throw failure("DEPLOYMENT_PREFLIGHT_RETAINED_TABLE_CONFLICT", REQUIRED_TABLE_NAME);
    return;
  }
  if (stackStatus !== "CREATE_COMPLETE") throw failure("DEPLOYMENT_PREFLIGHT_STACK_NOT_CREATE_COMPLETE");
  if (!retainedTableExists) throw failure("DEPLOYMENT_PREFLIGHT_TABLE_MISSING_FOR_UPDATE", REQUIRED_TABLE_NAME);
}

export function validateStackIdentity(stack, expectedStackName) {
  const item = asObject(stack, "stack");
  if (item.StackName !== expectedStackName) throw failure("DEPLOYMENT_PREFLIGHT_STACK_NAME_MISMATCH");
  if (typeof item.StackId !== "string" || !item.StackId.includes(`stack/${expectedStackName}/`)) {
    throw failure("DEPLOYMENT_PREFLIGHT_STACK_ID_MISMATCH");
  }
}

export function validateUpdateChangeSetScope(changeSet, { expectedStackName, allowedLogicalIds = [] } = {}) {
  const item = asObject(changeSet, "change set");
  if (item.StackName !== expectedStackName) throw failure("DEPLOYMENT_PREFLIGHT_CHANGE_SET_STACK_MISMATCH");
  if (item.Status !== "CREATE_COMPLETE") throw failure("DEPLOYMENT_PREFLIGHT_CHANGE_SET_NOT_READY");
  if (item.ExecutionStatus !== "AVAILABLE") throw failure("DEPLOYMENT_PREFLIGHT_CHANGE_SET_NOT_AVAILABLE");
  const changes = Array.isArray(item.Changes) ? item.Changes : [];
  if (changes.length === 0) throw failure("DEPLOYMENT_PREFLIGHT_CHANGE_SET_EMPTY");
  const allowed = new Set(allowedLogicalIds);
  for (const entry of changes) {
    const resourceChange = asObject(entry.ResourceChange, "change set resource change");
    if (resourceChange.Action !== "Modify") throw failure("DEPLOYMENT_PREFLIGHT_CHANGE_SET_UNEXPECTED_ACTION");
    if (resourceChange.Replacement === "True" || resourceChange.Replacement === "Conditional") {
      throw failure("DEPLOYMENT_PREFLIGHT_CHANGE_SET_REPLACEMENT");
    }
    if (allowed.size > 0 && !allowed.has(resourceChange.LogicalResourceId)) {
      throw failure("DEPLOYMENT_PREFLIGHT_CHANGE_SET_SCOPE_UNEXPECTED", resourceChange.LogicalResourceId);
    }
  }
}

export function validateActivationState({
  launcherActivationState,
  approvedDiagnosticTaskDefinitionArn,
  expectedActivationState,
  expectedApprovedTaskArn,
}) {
  if (launcherActivationState !== expectedActivationState) {
    throw failure("DEPLOYMENT_PREFLIGHT_ACTIVATION_STATE_MISMATCH");
  }
  if ((approvedDiagnosticTaskDefinitionArn ?? "") !== (expectedApprovedTaskArn ?? "")) {
    throw failure("DEPLOYMENT_PREFLIGHT_APPROVED_TASK_ARN_MISMATCH");
  }
}

export function evaluateProtectedServiceHealth(services) {
  if (!Array.isArray(services) || services.length === 0) {
    throw failure("DEPLOYMENT_PREFLIGHT_PROTECTED_SERVICES_MISSING");
  }
  for (const expectedServiceName of PROTECTED_ECS_SERVICES) {
    const item = services.find((service) => service?.serviceName === expectedServiceName);
    if (!item) throw failure("DEPLOYMENT_PREFLIGHT_PROTECTED_SERVICE_MISSING", expectedServiceName);
    if (item.status !== "ACTIVE") throw failure("DEPLOYMENT_PREFLIGHT_PROTECTED_SERVICE_INACTIVE", expectedServiceName);
    if (item.runningCount !== item.desiredCount) {
      throw failure("DEPLOYMENT_PREFLIGHT_PROTECTED_SERVICE_COUNT_MISMATCH", expectedServiceName);
    }
    if (item.pendingCount !== 0) throw failure("DEPLOYMENT_PREFLIGHT_PROTECTED_SERVICE_PENDING", expectedServiceName);
    const deployments = Array.isArray(item.deployments) ? item.deployments : [];
    if (deployments.some((deployment) => deployment?.rolloutState !== "COMPLETED")) {
      throw failure("DEPLOYMENT_PREFLIGHT_PROTECTED_SERVICE_ROLLOUT_INCOMPLETE", expectedServiceName);
    }
  }
}

export function validateCallerIdentity(identity, requiredAccount) {
  const item = asObject(identity, "sts get-caller-identity response");
  if (item.Account !== requiredAccount) throw failure("DEPLOYMENT_PREFLIGHT_ACCOUNT_MISMATCH");
  if (!String(item.Arn ?? "").startsWith("arn:aws:sts::")) throw failure("DEPLOYMENT_PREFLIGHT_NON_ASSUMED_ROLE");
}

export function normalizeStackStatus(raw) {
  if (!raw) return "STACK_ABSENT";
  return String(raw);
}

export const DEPLOYMENT_PREFLIGHT_CONSTANTS = Object.freeze({
  REQUIRED_STACK_NAME,
  REQUIRED_TABLE_NAME,
  PROTECTED_ECS_SERVICES,
});
