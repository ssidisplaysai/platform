const RUN_ID_PATTERN = /^s2g-run-[a-z0-9-]{3,55}$/;
const ARN_PATTERN = /^arn:aws:[a-z0-9-]+:[a-z0-9-]*:\d{12}:.+$/;

function failure(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function parseInvokerArn(event) {
  const arn = event?.requestContext?.authorizer?.iam?.userArn;
  if (typeof arn !== "string" || !ARN_PATTERN.test(arn)) throw failure("READER_BROKER_UNAUTHENTICATED");
  return arn;
}

function parseAccountIdFromArn(arn) {
  const parts = arn.split(":");
  return parts.length >= 5 ? parts[4] : "";
}

function parseBody(event) {
  if (!event || typeof event !== "object") throw failure("READER_BROKER_REQUEST_INVALID");
  if (!event.body) throw failure("READER_BROKER_RUN_ID_REQUIRED");
  let payload;
  try {
    payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    throw failure("READER_BROKER_REQUEST_INVALID");
  }
  if (payload.roleArn || payload.tags || payload.sessionTags) throw failure("READER_BROKER_OVERRIDE_REJECTED");
  if (typeof payload.runId !== "string" || !RUN_ID_PATTERN.test(payload.runId)) {
    throw failure("READER_BROKER_RUN_ID_INVALID");
  }
  return { runId: payload.runId };
}

export async function issueReaderSession(event, { config, deps }) {
  if (!config?.expectedAccountId || !config?.readerRoleArn) throw failure("READER_BROKER_CONFIG_INVALID");
  const request = parseBody(event);
  const invokerArn = parseInvokerArn(event);
  if (parseAccountIdFromArn(invokerArn) !== config.expectedAccountId) throw failure("READER_BROKER_CROSS_ACCOUNT_DENIED");

  const authorization = await deps.getRunAuthorization(request.runId);
  if (!authorization) throw failure("READER_BROKER_RUN_NOT_AUTHORIZED");
  if (authorization.status !== "APPROVED") throw failure("READER_BROKER_RUN_NOT_APPROVED");
  if (!Number.isInteger(authorization.expiresAtEpoch) || authorization.expiresAtEpoch <= deps.nowEpochSeconds()) {
    throw failure("READER_BROKER_RUN_AUTHORIZATION_EXPIRED");
  }
  if (authorization.operatorArn !== invokerArn) throw failure("READER_BROKER_OPERATOR_NOT_AUTHORIZED");
  if (authorization.readerRoleArn !== config.readerRoleArn) throw failure("READER_BROKER_ROLE_MISMATCH");

  const sessionName = `s2g-reader-${request.runId}`.slice(0, 64);
  const assumed = await deps.assumeRole({
    roleArn: config.readerRoleArn,
    roleSessionName: sessionName,
    durationSeconds: 900,
    tags: [{ Key: "reconciliation-run-id", Value: request.runId }],
  });
  const credentials = assumed?.Credentials;
  if (!credentials?.AccessKeyId || !credentials?.SecretAccessKey || !credentials?.SessionToken) {
    throw failure("READER_BROKER_STS_FAILED");
  }
  return {
    statusCode: 200,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
    body: JSON.stringify({
      outcome: "SESSION_ISSUED",
      runId: request.runId,
      scopePrefix: `exports/${request.runId}/`,
      credentials: {
        accessKeyId: credentials.AccessKeyId,
        secretAccessKey: credentials.SecretAccessKey,
        sessionToken: credentials.SessionToken,
        expiration: credentials.Expiration,
      },
    }),
  };
}

export function mapReaderBrokerFailureCode(error) {
  const code = typeof error?.code === "string" ? error.code : "";
  const known = new Set([
    "READER_BROKER_UNAUTHENTICATED",
    "READER_BROKER_REQUEST_INVALID",
    "READER_BROKER_RUN_ID_REQUIRED",
    "READER_BROKER_RUN_ID_INVALID",
    "READER_BROKER_OVERRIDE_REJECTED",
    "READER_BROKER_CONFIG_INVALID",
    "READER_BROKER_CROSS_ACCOUNT_DENIED",
    "READER_BROKER_RUN_NOT_AUTHORIZED",
    "READER_BROKER_RUN_NOT_APPROVED",
    "READER_BROKER_RUN_AUTHORIZATION_EXPIRED",
    "READER_BROKER_OPERATOR_NOT_AUTHORIZED",
    "READER_BROKER_ROLE_MISMATCH",
    "READER_BROKER_STS_FAILED",
  ]);
  return known.has(code) ? code : "READER_BROKER_FAILED";
}
