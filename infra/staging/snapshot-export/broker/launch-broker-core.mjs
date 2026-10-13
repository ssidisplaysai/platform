const RUN_ID_PATTERN = /^s2g-run-[a-z0-9-]{3,55}$/;
const ARN_PATTERN = /^arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:.+$/;

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseInvokerArn(event) {
  const arn = event?.requestContext?.authorizer?.iam?.userArn;
  if (typeof arn !== "string" || !ARN_PATTERN.test(arn)) throw failure("BROKER_UNAUTHENTICATED");
  return arn;
}

function parseAccountIdFromArn(arn) {
  const parts = arn.split(":");
  return parts.length >= 5 ? parts[4] : "";
}

function parseBody(event) {
  if (!event || typeof event !== "object") throw failure("BROKER_REQUEST_INVALID");
  if (!event.body) throw failure("BROKER_RUN_ID_REQUIRED");
  let payload;
  try {
    payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    throw failure("BROKER_REQUEST_INVALID");
  }
  if (payload.clusterArn || payload.taskDefinitionArn || payload.overrides || payload.containerOverrides) {
    throw failure("BROKER_OVERRIDES_REJECTED");
  }
  if (typeof payload.runId !== "string" || !RUN_ID_PATTERN.test(payload.runId)) {
    throw failure("BROKER_RUN_ID_INVALID");
  }
  return {
    runId: payload.runId,
    requestNonce: typeof payload.requestNonce === "string" ? payload.requestNonce : "none",
  };
}

function validateConfig(config) {
  if (!config || typeof config !== "object") throw failure("BROKER_CONFIG_INVALID");
  if (config.brokerActivationState !== "DISABLED" && config.brokerActivationState !== "ENABLED") {
    throw failure("BROKER_CONFIG_INVALID");
  }
  if (config.brokerActivationState === "DISABLED") return;
  const required = [
    "expectedAccountId",
    "stagingClusterArn",
    "approvedTaskDefinitionArn",
    "taskContainerName",
    "subnets",
    "securityGroups",
  ];
  if (required.some((key) => !config[key])) throw failure("BROKER_CONFIG_INVALID");
  if (!Array.isArray(config.subnets) || config.subnets.length === 0) throw failure("BROKER_CONFIG_INVALID");
  if (!Array.isArray(config.securityGroups) || config.securityGroups.length === 0) throw failure("BROKER_CONFIG_INVALID");
  if (!Number.isInteger(config.claimTtlSeconds) || config.claimTtlSeconds < 30 || config.claimTtlSeconds > 900) {
    throw failure("BROKER_CONFIG_INVALID");
  }
  if (!config.approvedTaskDefinitionArn.includes("genesis-staging-snapshot-export:")) {
    throw failure("BROKER_TASK_DEFINITION_UNAPPROVED");
  }
}

function ensureStagingArns(config) {
  const blocked = [config.stagingClusterArn, config.approvedTaskDefinitionArn].some((value) =>
    /genesis-production-web|genesis-share-to-grow-production/i.test(value));
  if (blocked) throw failure("BROKER_PRODUCTION_RESOURCE_REJECTED");
}

export async function authorizeAndLaunchSnapshotExport(event, { config, deps }) {
  validateConfig(config);
  if (config.brokerActivationState === "DISABLED") throw failure("BROKER_DISABLED");
  ensureStagingArns(config);
  const request = parseBody(event);
  const invokerArn = parseInvokerArn(event);
  if (parseAccountIdFromArn(invokerArn) !== config.expectedAccountId) throw failure("BROKER_CROSS_ACCOUNT_DENIED");

  const authorization = await deps.getRunAuthorization(request.runId);
  if (!authorization) throw failure("BROKER_RUN_NOT_AUTHORIZED");
  if (authorization.status !== "APPROVED") throw failure("BROKER_RUN_NOT_APPROVED");
  if (!Number.isInteger(authorization.expiresAtEpoch) || authorization.expiresAtEpoch <= deps.nowEpochSeconds()) {
    throw failure("BROKER_RUN_AUTHORIZATION_EXPIRED");
  }
  if (authorization.operatorArn !== invokerArn) throw failure("BROKER_OPERATOR_NOT_AUTHORIZED");
  if (authorization.approvedTaskDefinitionArn !== config.approvedTaskDefinitionArn) {
    throw failure("BROKER_TASK_DEFINITION_MISMATCH");
  }
  if (authorization.launchState === "LAUNCHED") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        outcome: "IDEMPOTENT_ALREADY_LAUNCHED",
        runId: request.runId,
        launchTaskArn: authorization.launchTaskArn ?? null,
      }),
    };
  }

  const taskDefinition = await deps.describeTaskDefinition(config.approvedTaskDefinitionArn);
  const container = taskDefinition?.taskDefinition?.containerDefinitions?.find(
    ({ name }) => name === config.taskContainerName,
  );
  if (!container || typeof container.image !== "string" || !container.image.includes("@sha256:")) {
    throw failure("BROKER_TASK_IMAGE_NOT_IMMUTABLE");
  }

  const launchClaim = await deps.claimRunLaunch({
    runId: request.runId,
    requestNonce: request.requestNonce,
    invokerArn,
    claimedAt: deps.nowIso(),
    claimExpiresAtEpoch: deps.nowEpochSeconds() + config.claimTtlSeconds,
  });
  if (launchClaim?.status === "ALREADY_LAUNCHED") {
    return {
      statusCode: 200,
      body: JSON.stringify({
        outcome: "IDEMPOTENT_ALREADY_LAUNCHED",
        runId: request.runId,
        launchTaskArn: launchClaim.launchTaskArn ?? null,
      }),
    };
  }
  if (launchClaim?.status === "CLAIM_IN_PROGRESS") {
    return {
      statusCode: 202,
      body: JSON.stringify({
        outcome: "CLAIM_IN_PROGRESS",
        runId: request.runId,
      }),
    };
  }

  const runTaskResponse = await deps.runTask({
    clientToken: request.runId,
    cluster: config.stagingClusterArn,
    taskDefinition: config.approvedTaskDefinitionArn,
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
        command: [
          "node",
          "scripts/share-to-grow-snapshot-export.mjs",
          "--run-id",
          request.runId,
        ],
      }],
    },
  });

  const taskArn = runTaskResponse?.tasks?.[0]?.taskArn;
  if (typeof taskArn !== "string" || taskArn.length === 0) throw failure("BROKER_ECS_RUN_TASK_FAILED");
  await deps.recordRunLaunch({
    runId: request.runId,
    taskArn,
    launchedAt: deps.nowIso(),
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

export function mapLaunchBrokerFailureCode(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const known = new Set([
    "BROKER_UNAUTHENTICATED",
    "BROKER_REQUEST_INVALID",
    "BROKER_RUN_ID_REQUIRED",
    "BROKER_RUN_ID_INVALID",
    "BROKER_OVERRIDES_REJECTED",
    "BROKER_CONFIG_INVALID",
    "BROKER_DISABLED",
    "BROKER_PRODUCTION_RESOURCE_REJECTED",
    "BROKER_CROSS_ACCOUNT_DENIED",
    "BROKER_RUN_NOT_AUTHORIZED",
    "BROKER_RUN_NOT_APPROVED",
    "BROKER_RUN_AUTHORIZATION_EXPIRED",
    "BROKER_OPERATOR_NOT_AUTHORIZED",
    "BROKER_TASK_DEFINITION_MISMATCH",
    "BROKER_TASK_DEFINITION_UNAPPROVED",
    "BROKER_TASK_IMAGE_NOT_IMMUTABLE",
    "BROKER_ECS_RUN_TASK_FAILED",
  ]);
  return known.has(code) ? code : "BROKER_FAILED";
}
