import {
  S2G_DB_ADMIN_DIAGNOSTIC_COMMAND,
  S2G_DB_ADMIN_DIAGNOSTIC_FAMILY,
} from "../../s2g-db-admin-diagnostic-contract.mjs";

const RUN_ID_PATTERN = /^s2g-dbdiag-[a-z0-9-]{3,55}$/;
const ARN_PATTERN = /^arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:.+$/;
const TASK_FAMILY_FRAGMENT = `task-definition/${S2G_DB_ADMIN_DIAGNOSTIC_FAMILY}:`;
const AUTH_SCHEMA_VERSION = "2026-10-13";
const AUTH_PURPOSE = "STAGING_DB_ADMIN_READONLY_DIAGNOSTIC";
const AUTH_MAX_LAUNCH_ATTEMPTS = 1;
const TERMINAL_STATES = new Set(["CLAIMED", "LAUNCHED", "LAUNCH_FAILED", "OUTCOME_UNKNOWN"]);

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseInvokerArn(event) {
  const arn = event?.requestContext?.authorizer?.iam?.userArn;
  if (typeof arn !== "string" || !ARN_PATTERN.test(arn)) throw failure("DIAG_LAUNCHER_UNAUTHENTICATED");
  return arn;
}

function parseAccountIdFromArn(arn) {
  const parts = arn.split(":");
  return parts.length >= 5 ? parts[4] : "";
}

function parseBody(event) {
  if (!event || typeof event !== "object") throw failure("DIAG_LAUNCHER_REQUEST_INVALID");
  if (!event.body) throw failure("DIAG_LAUNCHER_RUN_ID_REQUIRED");
  let payload;
  try {
    payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    throw failure("DIAG_LAUNCHER_REQUEST_INVALID");
  }
  if (
    payload.clusterArn
    || payload.taskDefinitionArn
    || payload.overrides
    || payload.containerOverrides
    || payload.sql
    || payload.command
    || payload.environment
  ) {
    throw failure("DIAG_LAUNCHER_OVERRIDES_REJECTED");
  }
  if (typeof payload.runId !== "string" || !RUN_ID_PATTERN.test(payload.runId)) {
    throw failure("DIAG_LAUNCHER_RUN_ID_INVALID");
  }
  return { runId: payload.runId };
}

function validateConfig(config) {
  if (!config || typeof config !== "object") throw failure("DIAG_LAUNCHER_CONFIG_INVALID");
  if (config.launcherActivationState !== "DISABLED" && config.launcherActivationState !== "ENABLED") {
    throw failure("DIAG_LAUNCHER_CONFIG_INVALID");
  }
  if (config.launcherActivationState === "DISABLED") return;

  const required = [
    "expectedAccountId",
    "expectedRegion",
    "stagingClusterArn",
    "approvedDiagnosticTaskDefinitionArn",
    "approvedDiagnosticImageDigest",
    "taskContainerName",
    "subnets",
    "securityGroups",
    "approvedNetworkIdentity",
    "expectedDatabaseHost",
    "expectedDatabaseName",
    "approvedAdminSecretArn",
  ];
  if (required.some((key) => !config[key])) throw failure("DIAG_LAUNCHER_CONFIG_INVALID");
  if (!Array.isArray(config.subnets) || config.subnets.length === 0) throw failure("DIAG_LAUNCHER_CONFIG_INVALID");
  if (!Array.isArray(config.securityGroups) || config.securityGroups.length === 0) throw failure("DIAG_LAUNCHER_CONFIG_INVALID");
  if (!config.approvedDiagnosticTaskDefinitionArn.includes(TASK_FAMILY_FRAGMENT)) {
    throw failure("DIAG_LAUNCHER_TASK_DEFINITION_UNAPPROVED");
  }
  if (!/^sha256:[0-9a-f]{64}$/.test(config.approvedDiagnosticImageDigest)) {
    throw failure("DIAG_LAUNCHER_CONFIG_INVALID");
  }
}

function validateAuthorizationRecord(record, { runId, invokerArn, config, nowEpochSeconds }) {
  if (!record) throw failure("DIAG_LAUNCHER_RUN_NOT_AUTHORIZED");
  if (record.runId !== runId) throw failure("DIAG_LAUNCHER_RUN_NOT_AUTHORIZED");
  if (record.purpose !== AUTH_PURPOSE) throw failure("DIAG_LAUNCHER_RUN_PURPOSE_MISMATCH");
  if (record.schemaVersion !== AUTH_SCHEMA_VERSION) throw failure("DIAG_LAUNCHER_RUN_SCHEMA_UNSUPPORTED");
  if (record.launchState === "LAUNCHED") return "already-launched";
  if (TERMINAL_STATES.has(record.launchState)) throw failure("DIAG_LAUNCHER_RUN_ALREADY_CONSUMED");
  if (record.launchState !== "AUTHORIZED") throw failure("DIAG_LAUNCHER_RUN_NOT_AUTHORIZED");

  if (!Number.isInteger(record.expiresAtEpoch) || record.expiresAtEpoch <= nowEpochSeconds) {
    throw failure("DIAG_LAUNCHER_RUN_AUTHORIZATION_EXPIRED");
  }
  if (record.authorizedOperatorArn !== invokerArn) throw failure("DIAG_LAUNCHER_OPERATOR_NOT_AUTHORIZED");
  if (record.approvedDiagnosticTaskDefinitionArn !== config.approvedDiagnosticTaskDefinitionArn) {
    throw failure("DIAG_LAUNCHER_TASK_DEFINITION_MISMATCH");
  }
  if (record.approvedClusterArn !== config.stagingClusterArn) throw failure("DIAG_LAUNCHER_CLUSTER_MISMATCH");
  if (record.approvedDiagnosticImageDigest !== config.approvedDiagnosticImageDigest) {
    throw failure("DIAG_LAUNCHER_TASK_IMAGE_DIGEST_MISMATCH");
  }
  if (record.approvedNetworkIdentity !== config.approvedNetworkIdentity) {
    throw failure("DIAG_LAUNCHER_NETWORK_IDENTITY_MISMATCH");
  }
  if (record.maxLaunchAttempts !== AUTH_MAX_LAUNCH_ATTEMPTS) {
    throw failure("DIAG_LAUNCHER_MAX_ATTEMPTS_MISMATCH");
  }
}

function rejectProductionTargets(config) {
  const blockedClusterOrTask =
    /genesis-production-web|genesis-share-to-grow-production/i.test(config.stagingClusterArn)
    || /genesis-production-web|genesis-share-to-grow-production/i.test(config.approvedDiagnosticTaskDefinitionArn);
  const blockedDatabaseTarget = /genesis-production-postgres/i.test(config.expectedDatabaseHost);
  if (blockedClusterOrTask || blockedDatabaseTarget) throw failure("DIAG_LAUNCHER_PRODUCTION_RESOURCE_REJECTED");
}

function validateTaskDefinition(taskDefinitionResponse, config) {
  const taskDefinition = taskDefinitionResponse?.taskDefinition;
  if (!taskDefinition || taskDefinition.taskDefinitionArn !== config.approvedDiagnosticTaskDefinitionArn) {
    throw failure("DIAG_LAUNCHER_TASK_DEFINITION_MISMATCH");
  }
  const container = taskDefinition.containerDefinitions?.find(({ name }) => name === config.taskContainerName);
  if (!container || typeof container.image !== "string" || !container.image.includes("@sha256:")) {
    throw failure("DIAG_LAUNCHER_TASK_IMAGE_NOT_IMMUTABLE");
  }
  if (!container.image.endsWith(`@${config.approvedDiagnosticImageDigest}`)) {
    throw failure("DIAG_LAUNCHER_TASK_IMAGE_DIGEST_MISMATCH");
  }
  if (JSON.stringify(container.command ?? []) !== JSON.stringify(S2G_DB_ADMIN_DIAGNOSTIC_COMMAND)) {
    throw failure("DIAG_LAUNCHER_TASK_COMMAND_MISMATCH");
  }
  const environment = new Map((container.environment ?? []).map(({ name, value }) => [name, value]));
  if (
    environment.get("GENESIS_ENVIRONMENT") !== "staging"
    || environment.get("DB_HOST") !== config.expectedDatabaseHost
    || environment.get("DB_NAME") !== config.expectedDatabaseName
  ) {
    throw failure("DIAG_LAUNCHER_TASK_DB_TARGET_INVALID");
  }
  const secrets = new Map((container.secrets ?? []).map(({ name, valueFrom }) => [name, valueFrom]));
  const adminUserSecret = secrets.get("DB_ADMIN_USERNAME");
  const adminPasswordSecret = secrets.get("DB_ADMIN_PASSWORD");
  if (
    !adminUserSecret?.startsWith(`${config.approvedAdminSecretArn}:username::`)
    || !adminPasswordSecret?.startsWith(`${config.approvedAdminSecretArn}:password::`)
    || secrets.size !== 2
  ) {
    throw failure("DIAG_LAUNCHER_TASK_SECRET_SCOPE_INVALID");
  }
}

export async function authorizeAndLaunchDbAdminDiagnostic(event, { config, deps }) {
  validateConfig(config);
  if (config.launcherActivationState === "DISABLED") throw failure("DIAG_LAUNCHER_DISABLED");
  rejectProductionTargets(config);
  const request = parseBody(event);
  const invokerArn = parseInvokerArn(event);
  if (parseAccountIdFromArn(invokerArn) !== config.expectedAccountId) throw failure("DIAG_LAUNCHER_CROSS_ACCOUNT_DENIED");

  const existing = await deps.getLaunchRecord(request.runId);
  const authorizationState = validateAuthorizationRecord(existing, {
    runId: request.runId,
    invokerArn,
    config,
    nowEpochSeconds: deps.nowEpochSeconds(),
  });
  if (authorizationState === "already-launched") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        outcome: "IDEMPOTENT_ALREADY_LAUNCHED",
        runId: request.runId,
        launchTaskArn: existing.launchTaskArn ?? null,
      }),
    };
  }

  const taskDefinition = await deps.describeTaskDefinition(config.approvedDiagnosticTaskDefinitionArn);
  validateTaskDefinition(taskDefinition, config);

  const claim = await deps.claimLaunch({
    runId: request.runId,
    invokerArn,
    nowEpochSeconds: deps.nowEpochSeconds(),
    claimedAt: deps.nowIso(),
  });
  if (claim?.status === "ALREADY_LAUNCHED") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        outcome: "IDEMPOTENT_ALREADY_LAUNCHED",
        runId: request.runId,
        launchTaskArn: claim.launchTaskArn ?? null,
      }),
    };
  }
  if (claim?.status === "CLAIM_IN_PROGRESS" || claim?.status === "ALREADY_CONSUMED") {
    return {
      statusCode: 409,
      body: JSON.stringify({
        outcome: "AUTHORIZATION_CONSUMED_OR_IN_PROGRESS",
        runId: request.runId,
      }),
    };
  }
  if (claim?.status === "AUTHORIZATION_EXPIRED") {
    throw failure("DIAG_LAUNCHER_RUN_AUTHORIZATION_EXPIRED");
  }
  if (claim?.status === "AUTHORIZATION_CONTRACT_MISMATCH") {
    throw failure("DIAG_LAUNCHER_RUN_CONTRACT_MISMATCH");
  }
  if (claim?.status !== "CLAIMED") {
    throw failure("DIAG_LAUNCHER_RUN_NOT_AUTHORIZED");
  }

  let runTaskResponse;
  try {
    runTaskResponse = await deps.runTask({
      clientToken: request.runId,
      cluster: config.stagingClusterArn,
      taskDefinition: config.approvedDiagnosticTaskDefinitionArn,
      launchType: "FARGATE",
      enableECSManagedTags: true,
      enableExecuteCommand: false,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: config.subnets,
          securityGroups: config.securityGroups,
          assignPublicIp: "DISABLED",
        },
      },
      overrides: {
        containerOverrides: [{
          name: config.taskContainerName,
          command: [...S2G_DB_ADMIN_DIAGNOSTIC_COMMAND],
        }],
      },
    });
  } catch (error) {
    await deps.recordLaunchOutcomeUnknown?.({
      runId: request.runId,
      attemptedAt: deps.nowIso(),
      operatorArn: invokerArn,
      failureCode: error?.code ?? "RUN_TASK_THROW",
    });
    throw failure("DIAG_LAUNCHER_ECS_RUN_TASK_OUTCOME_UNKNOWN");
  }

  const taskFailures = Array.isArray(runTaskResponse?.failures) ? runTaskResponse.failures : [];
  if (taskFailures.length > 0) {
    await deps.recordLaunchFailure?.({
      runId: request.runId,
      attemptedAt: deps.nowIso(),
      operatorArn: invokerArn,
      failureCode: taskFailures[0]?.reason ?? "RUN_TASK_FAILURE",
    });
    throw failure("DIAG_LAUNCHER_ECS_RUN_TASK_FAILED");
  }

  const taskArn = runTaskResponse?.tasks?.[0]?.taskArn;
  if (typeof taskArn !== "string" || taskArn.length === 0) {
    await deps.recordLaunchOutcomeUnknown?.({
      runId: request.runId,
      attemptedAt: deps.nowIso(),
      operatorArn: invokerArn,
      failureCode: "TASK_ARN_MISSING",
    });
    throw failure("DIAG_LAUNCHER_ECS_RUN_TASK_OUTCOME_UNKNOWN");
  }
  await deps.recordLaunch({
    runId: request.runId,
    taskArn,
    launchedAt: deps.nowIso(),
    operatorArn: invokerArn,
  });
  return {
    statusCode: 200,
    body: JSON.stringify({
      outcome: "LAUNCHED",
      runId: request.runId,
      launchTaskArn: taskArn,
    }),
  };
}

export function mapDiagnosticLauncherFailureCode(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const known = new Set([
    "DIAG_LAUNCHER_UNAUTHENTICATED",
    "DIAG_LAUNCHER_REQUEST_INVALID",
    "DIAG_LAUNCHER_RUN_ID_REQUIRED",
    "DIAG_LAUNCHER_RUN_ID_INVALID",
    "DIAG_LAUNCHER_OVERRIDES_REJECTED",
    "DIAG_LAUNCHER_CONFIG_INVALID",
    "DIAG_LAUNCHER_DISABLED",
    "DIAG_LAUNCHER_PRODUCTION_RESOURCE_REJECTED",
    "DIAG_LAUNCHER_CROSS_ACCOUNT_DENIED",
    "DIAG_LAUNCHER_OPERATOR_NOT_AUTHORIZED",
    "DIAG_LAUNCHER_RUN_NOT_AUTHORIZED",
    "DIAG_LAUNCHER_RUN_NOT_APPROVED",
    "DIAG_LAUNCHER_RUN_AUTHORIZATION_EXPIRED",
    "DIAG_LAUNCHER_RUN_SCHEMA_UNSUPPORTED",
    "DIAG_LAUNCHER_RUN_PURPOSE_MISMATCH",
    "DIAG_LAUNCHER_RUN_ALREADY_CONSUMED",
    "DIAG_LAUNCHER_RUN_CONTRACT_MISMATCH",
    "DIAG_LAUNCHER_CLUSTER_MISMATCH",
    "DIAG_LAUNCHER_NETWORK_IDENTITY_MISMATCH",
    "DIAG_LAUNCHER_MAX_ATTEMPTS_MISMATCH",
    "DIAG_LAUNCHER_TASK_DEFINITION_UNAPPROVED",
    "DIAG_LAUNCHER_TASK_DEFINITION_MISMATCH",
    "DIAG_LAUNCHER_TASK_IMAGE_NOT_IMMUTABLE",
    "DIAG_LAUNCHER_TASK_IMAGE_DIGEST_MISMATCH",
    "DIAG_LAUNCHER_TASK_COMMAND_MISMATCH",
    "DIAG_LAUNCHER_TASK_DB_TARGET_INVALID",
    "DIAG_LAUNCHER_TASK_SECRET_SCOPE_INVALID",
    "DIAG_LAUNCHER_ECS_RUN_TASK_FAILED",
    "DIAG_LAUNCHER_ECS_RUN_TASK_OUTCOME_UNKNOWN",
  ]);
  return known.has(code) ? code : "DIAG_LAUNCHER_FAILED";
}
