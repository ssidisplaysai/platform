import { createHash, createHmac } from "node:crypto";
import https from "node:https";
import { SignatureV4 } from "@smithy/signature-v4";

export const EXPECTED_ACCOUNT_ID = "452630323448";
export const EXPECTED_REGION = "us-west-2";
export const EXPECTED_SERVICE = "lambda";
export const EXPECTED_FUNCTION_URL_HOST = "r7sknifhujrb2ypc7rj3ycr4k40rbalj.lambda-url.us-west-2.on.aws";
export const EXPECTED_DEDICATED_OPERATOR_ROLE_ARN = "arn:aws:iam::452630323448:role/GenesisStagingS2gDbAdminD-StagingS2gDbAdminDiagnost-zeoxqigBe1Ma";
export const RUN_ID_PATTERN = /^s2g-dbdiag-[a-z0-9-]{3,55}$/;
const AMZ_DATE_PATTERN = /^[0-9]{8}T[0-9]{6}Z$/;

function failure(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertTrue(condition, code, message = code) {
  if (!condition) throw failure(code, message);
}

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

class NodeSha256 {
  constructor(secret) {
    this.hash = secret
      ? createHmac("sha256", Buffer.isBuffer(secret) ? secret : Buffer.from(secret))
      : createHash("sha256");
  }

  update(data) {
    this.hash.update(data);
  }

  async digest() {
    return this.hash.digest();
  }
}

function parseAssumedRoleArn(arn) {
  const match = /^arn:aws:sts::(\d{12}):assumed-role\/([^/]+)\/([^/]+)$/.exec(arn ?? "");
  if (!match) return null;
  return {
    accountId: match[1],
    roleName: match[2],
    sessionName: match[3],
  };
}

function roleNameFromRoleArn(roleArn) {
  const match = /^arn:aws:iam::\d{12}:role\/(.+)$/.exec(roleArn ?? "");
  return match?.[1] ?? "";
}

function parseSigV4Provider(value) {
  const parts = value.split(":");
  if (parts.length !== 4) throw failure("SIGV4_PROVIDER_INVALID", "SigV4 provider must have exactly four parts.");
  const [provider, requestType, region, service] = parts;
  return { provider, requestType, region, service };
}

export function validateCurlSigV4Provider(value, { expectedRegion = EXPECTED_REGION, expectedService = EXPECTED_SERVICE } = {}) {
  const parsed = parseSigV4Provider(value);
  assertTrue(parsed.provider === "aws", "SIGV4_PROVIDER_INVALID", "SigV4 provider must start with aws.");
  assertTrue(parsed.requestType === "amz", "SIGV4_PROVIDER_INVALID", "SigV4 provider second token must be amz.");
  assertTrue(parsed.region === expectedRegion, "SIGV4_SCOPE_REGION_INVALID", "SigV4 provider region does not match expected region.");
  assertTrue(parsed.service === expectedService, "SIGV4_SCOPE_SERVICE_INVALID", "SigV4 provider service does not match expected service.");
  return parsed;
}

export function extractCurlSigV4Provider(commandLine) {
  const match = /--aws-sigv4\s+("([^"]+)"|'([^']+)'|(\S+))/.exec(commandLine ?? "");
  if (!match) throw failure("SIGV4_PROVIDER_MISSING", "Invocation command is missing --aws-sigv4.");
  return match[2] ?? match[3] ?? match[4];
}

export function parseCredentialScopeFromAuthorizationHeader(authorizationHeader) {
  const match = /Credential=([^/]+)\/([0-9]{8}\/[^/]+\/[^/]+\/aws4_request),\s*SignedHeaders=([^,]+),\s*Signature=([0-9a-f]+)/i.exec(authorizationHeader ?? "");
  if (!match) throw failure("SIGV4_AUTHORIZATION_INVALID", "Authorization header is not a valid AWS4-HMAC-SHA256 header.");
  const [, accessKeyId, scope, signedHeaders, signature] = match;
  const [dateStamp, region, service, terminal] = scope.split("/");
  return {
    accessKeyId,
    scope,
    dateStamp,
    region,
    service,
    terminal,
    signedHeaders,
    signature,
  };
}

function validateFunctionUrl(functionUrl, expectedFunctionUrlHost) {
  const url = new URL(functionUrl);
  assertTrue(url.protocol === "https:", "SIGV4_URL_SCHEME_INVALID", "Function URL must use https.");
  assertTrue(url.hostname === expectedFunctionUrlHost, "SIGV4_URL_HOST_INVALID", "Function URL host does not match expected launcher host.");
  assertTrue((url.search ?? "") === "", "SIGV4_URL_QUERY_INVALID", "Function URL must not include query parameters.");
  assertTrue((url.pathname ?? "/") === "/", "SIGV4_URL_PATH_INVALID", "Function URL path must be '/'.");
  return url;
}

function validateCredentialInput({ accessKeyId, secretAccessKey, sessionToken, credentialExpirationIso }) {
  assertTrue(typeof accessKeyId === "string" && accessKeyId.length > 0, "SIGV4_ACCESS_KEY_MISSING");
  assertTrue(typeof secretAccessKey === "string" && secretAccessKey.length > 0, "SIGV4_SECRET_KEY_MISSING");
  assertTrue(typeof sessionToken === "string" && sessionToken.length > 0, "SIGV4_SESSION_TOKEN_MISSING");
  if (credentialExpirationIso) {
    const expiration = Date.parse(credentialExpirationIso);
    assertTrue(Number.isFinite(expiration), "SIGV4_CREDENTIAL_EXPIRY_INVALID", "Credential expiration must be an ISO timestamp.");
    assertTrue(expiration > Date.now(), "SIGV4_CREDENTIAL_EXPIRED", "Temporary credentials are expired.");
  }
}

function validateOperatorIdentity({
  operatorCallerArn,
  authorizedOperatorArn,
  expectedAccountId,
  expectedDedicatedOperatorRoleArn,
}) {
  const expectedRoleName = roleNameFromRoleArn(expectedDedicatedOperatorRoleArn);
  const caller = parseAssumedRoleArn(operatorCallerArn);
  assertTrue(caller !== null, "OPERATOR_CALLER_ARN_INVALID", "Operator caller ARN must be an STS assumed-role ARN.");
  assertTrue(caller.accountId === expectedAccountId, "OPERATOR_ACCOUNT_INVALID", "Operator caller account mismatch.");
  if (caller.roleName.startsWith("AWSReservedSSO_AdministratorAccess")) {
    throw failure("OPERATOR_ADMIN_SESSION_FORBIDDEN", "AdministratorAccess sessions are forbidden for diagnostic invocation.");
  }
  if (caller.roleName.startsWith("AWSReservedSSO_GenesisS2GDiagOperator")) {
    throw failure("OPERATOR_SOURCE_SESSION_FORBIDDEN", "Source Identity Center operator session must not be used directly.");
  }
  assertTrue(caller.roleName === expectedRoleName, "OPERATOR_ROLE_INVALID", "Operator caller must be the dedicated diagnostic operator role session.");

  const authorized = parseAssumedRoleArn(authorizedOperatorArn);
  assertTrue(authorized !== null, "AUTHORIZED_OPERATOR_ARN_INVALID", "authorizedOperatorArn must be an STS assumed-role ARN.");
  assertTrue(authorizedOperatorArn === operatorCallerArn, "AUTHORIZED_OPERATOR_MISMATCH", "authorizedOperatorArn must exactly match the invoking operator session ARN.");
}

function validateRequestBody(requestBodyText) {
  const payload = JSON.parse(requestBodyText);
  const keys = Object.keys(payload);
  assertTrue(keys.length === 1 && keys[0] === "runId", "REQUEST_BODY_INVALID", "Request body must contain only runId.");
  assertTrue(typeof payload.runId === "string" && RUN_ID_PATTERN.test(payload.runId), "REQUEST_RUN_ID_INVALID", "runId format is invalid.");
  return payload;
}

function validateRetryPolicy(maxAttempts, retryMode) {
  assertTrue(maxAttempts === 1, "RETRY_POLICY_INVALID", "maxAttempts must be exactly 1.");
  assertTrue((retryMode ?? "").toLowerCase() === "standard", "RETRY_MODE_INVALID", "retryMode must be standard with maxAttempts=1.");
}

function assertHeadersForSigV4(signedHeaders, signedHeaderNames, expectedRegion, expectedService) {
  assertTrue(signedHeaders.region === expectedRegion, "SIGV4_SCOPE_REGION_INVALID", "Signed credential scope region mismatch.");
  assertTrue(signedHeaders.service === expectedService, "SIGV4_SCOPE_SERVICE_INVALID", "Signed credential scope service mismatch.");
  assertTrue(signedHeaders.terminal === "aws4_request", "SIGV4_SCOPE_TERMINAL_INVALID", "Signed credential scope terminal token mismatch.");
  assertTrue(signedHeaderNames.includes("host"), "SIGV4_HOST_UNSIGNED", "Host header must be signed.");
  assertTrue(signedHeaderNames.includes("content-type"), "SIGV4_CONTENT_TYPE_UNSIGNED", "Content-Type header must be signed.");
  assertTrue(signedHeaderNames.includes("x-amz-date"), "SIGV4_DATE_UNSIGNED", "x-amz-date header must be signed.");
  assertTrue(signedHeaderNames.includes("x-amz-security-token"), "SIGV4_SESSION_TOKEN_UNSIGNED", "Session token header must be signed.");
}

function redactInspection(prepared, runId, expectedOperatorArn, retryPolicy) {
  return {
    method: prepared.request.method,
    destinationHost: prepared.request.headers.host,
    algorithm: "AWS4-HMAC-SHA256",
    credentialScopeDate: prepared.scope.dateStamp,
    credentialScopeRegion: prepared.scope.region,
    credentialScopeService: prepared.scope.service,
    signedHeaders: prepared.signedHeaderNames,
    xAmzDate: prepared.request.headers["x-amz-date"],
    xAmzDateFormatValid: AMZ_DATE_PATTERN.test(prepared.request.headers["x-amz-date"] ?? ""),
    sessionTokenPresent: typeof prepared.request.headers["x-amz-security-token"] === "string" && prepared.request.headers["x-amz-security-token"].length > 0,
    bodySha256: prepared.request.headers["x-amz-content-sha256"] ?? "",
    requestBodySchema: { onlyRunId: true, runId },
    expectedOperatorArn,
    retryPolicy,
    credentialAccessKeyIdRedacted: "REDACTED",
    authorizationHeaderRedacted: "REDACTED",
    signatureRedacted: "REDACTED",
  };
}

export async function buildSignedInvokeRequest(input) {
  const {
    functionUrl,
    requestBodyText,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region = EXPECTED_REGION,
    service = EXPECTED_SERVICE,
    signingDate = new Date(),
    expectedFunctionUrlHost = EXPECTED_FUNCTION_URL_HOST,
    expectedAccountId = EXPECTED_ACCOUNT_ID,
    expectedDedicatedOperatorRoleArn = EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
    operatorCallerArn = "",
    authorizedOperatorArn = "",
    credentialExpirationIso = "",
    maxAttempts = 1,
    retryMode = "standard",
    invocationCommandLine = "",
  } = input;

  assertTrue(region === EXPECTED_REGION, "EXPECTED_REGION_REQUIRED", `Region must be fixed to ${EXPECTED_REGION}.`);
  assertTrue(service === EXPECTED_SERVICE, "EXPECTED_SERVICE_REQUIRED", `Service must be fixed to ${EXPECTED_SERVICE}.`);
  assertTrue(expectedFunctionUrlHost === EXPECTED_FUNCTION_URL_HOST, "EXPECTED_HOST_REQUIRED", "Expected Function URL host must match the approved launcher host.");
  assertTrue(expectedAccountId === EXPECTED_ACCOUNT_ID, "EXPECTED_ACCOUNT_REQUIRED", `Account must be fixed to ${EXPECTED_ACCOUNT_ID}.`);
  assertTrue(
    expectedDedicatedOperatorRoleArn === EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
    "EXPECTED_DEDICATED_ROLE_REQUIRED",
    "Expected dedicated operator role ARN must match the approved role.",
  );

  const url = validateFunctionUrl(functionUrl, expectedFunctionUrlHost);
  validateCredentialInput({ accessKeyId, secretAccessKey, sessionToken, credentialExpirationIso });
  validateOperatorIdentity({ operatorCallerArn, authorizedOperatorArn, expectedAccountId, expectedDedicatedOperatorRoleArn });
  const payload = validateRequestBody(requestBodyText);
  validateRetryPolicy(maxAttempts, retryMode);
  if (invocationCommandLine) {
    const provider = extractCurlSigV4Provider(invocationCommandLine);
    validateCurlSigV4Provider(provider, { expectedRegion: region, expectedService: service });
  }

  const signer = new SignatureV4({
    credentials: { accessKeyId, secretAccessKey, sessionToken },
    region,
    service,
    sha256: NodeSha256,
  });
  const request = {
    method: "POST",
    protocol: "https:",
    hostname: url.hostname,
    path: url.pathname || "/",
    query: {},
    headers: {
      host: url.hostname,
      "content-type": "application/json",
    },
    body: requestBodyText,
  };
  const signedRequest = await signer.sign(request, { signingDate });
  const authorizationHeader = signedRequest.headers?.authorization;
  assertTrue(typeof authorizationHeader === "string" && authorizationHeader.length > 0, "SIGV4_AUTHORIZATION_MISSING", "Signed request is missing Authorization header.");
  const scope = parseCredentialScopeFromAuthorizationHeader(authorizationHeader);
  const signedHeaderNames = scope.signedHeaders.split(";").map((value) => value.trim()).filter(Boolean);
  assertHeadersForSigV4(scope, signedHeaderNames, region, service);
  assertTrue(typeof signedRequest.headers["x-amz-date"] === "string", "SIGV4_DATE_MISSING", "Signed request is missing x-amz-date header.");
  assertTrue(AMZ_DATE_PATTERN.test(signedRequest.headers["x-amz-date"]), "SIGV4_DATE_INVALID", "x-amz-date must be in YYYYMMDDTHHMMSSZ format.");
  assertTrue(scope.dateStamp === signedRequest.headers["x-amz-date"].slice(0, 8), "SIGV4_DATE_SCOPE_MISMATCH", "Credential scope date must match x-amz-date.");
  const payloadHash = signedRequest.headers["x-amz-content-sha256"];
  assertTrue(typeof payloadHash === "string" && payloadHash.length > 0, "SIGV4_PAYLOAD_HASH_MISSING", "Signed request missing x-amz-content-sha256 header.");
  assertTrue(payloadHash === sha256Hex(requestBodyText), "SIGV4_PAYLOAD_HASH_MISMATCH", "Payload hash does not match request body.");

  return {
    request: {
      method: "POST",
      url: `${url.origin}${url.pathname || "/"}`,
      headers: signedRequest.headers,
      body: requestBodyText,
    },
    scope,
    signedHeaderNames,
    runId: payload.runId,
    inspection: redactInspection(
      {
        request: {
          method: "POST",
          headers: signedRequest.headers,
        },
        scope,
        signedHeaderNames,
      },
      payload.runId,
      authorizedOperatorArn,
      { maxAttempts, retryMode: retryMode.toLowerCase() },
    ),
  };
}

export function verifySignedInvokeRequest(prepared, { expectedRegion = EXPECTED_REGION, expectedService = EXPECTED_SERVICE, expectedHost = EXPECTED_FUNCTION_URL_HOST } = {}) {
  const request = prepared?.request;
  const scope = prepared?.scope;
  assertTrue(request?.method === "POST", "REQUEST_METHOD_INVALID", "Signed request method must be POST.");
  assertTrue(typeof request?.headers?.host === "string" && request.headers.host === expectedHost, "SIGV4_URL_HOST_INVALID", "Signed request host does not match expected host.");
  assertTrue(typeof request?.headers?.authorization === "string", "SIGV4_AUTHORIZATION_MISSING", "Signed request must include Authorization header.");
  const parsedScope = parseCredentialScopeFromAuthorizationHeader(request.headers.authorization);
  assertTrue(parsedScope.region === expectedRegion, "SIGV4_SCOPE_REGION_INVALID", "Signed request scope region mismatch.");
  assertTrue(parsedScope.service === expectedService, "SIGV4_SCOPE_SERVICE_INVALID", "Signed request scope service mismatch.");
  assertTrue(parsedScope.dateStamp === (request.headers["x-amz-date"] ?? "").slice(0, 8), "SIGV4_DATE_SCOPE_MISMATCH", "Scope date must match x-amz-date date.");
  const expectedHash = sha256Hex(request.body ?? "");
  assertTrue(request.headers["x-amz-content-sha256"] === expectedHash, "SIGV4_PAYLOAD_HASH_MISMATCH", "Signed request payload hash mismatch.");
  assertTrue(typeof request.headers["x-amz-security-token"] === "string" && request.headers["x-amz-security-token"].length > 0, "SIGV4_SESSION_TOKEN_MISSING", "Signed request must include session token.");
  assertTrue(scope?.scope === parsedScope.scope, "SIGV4_SCOPE_TAMPERED", "Scope metadata mismatch.");
  return { status: "PASS" };
}

function createHttpsTransport(timeoutMs = 12_000) {
  return (request) => new Promise((resolve, reject) => {
    const url = new URL(request.url);
    const req = https.request({
      method: request.method,
      hostname: url.hostname,
      path: url.pathname,
      headers: request.headers,
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body,
        });
      });
    });
    req.on("timeout", () => req.destroy(failure("LIVE_SEND_TIMEOUT", "Live send timed out.")));
    req.on("error", reject);
    req.write(request.body ?? "");
    req.end();
  });
}

export async function executeSignedInvokeRequest({
  prepared,
  mode = "offline",
  maxAttempts = 1,
  allowLiveSend = false,
  transport,
}) {
  validateRetryPolicy(maxAttempts, "standard");
  verifySignedInvokeRequest(prepared, {
    expectedRegion: EXPECTED_REGION,
    expectedService: EXPECTED_SERVICE,
    expectedHost: EXPECTED_FUNCTION_URL_HOST,
  });
  if (mode !== "offline" && mode !== "live-send") {
    throw failure("REQUEST_MODE_INVALID", "Mode must be offline or live-send.");
  }
  if (mode === "offline") {
    return {
      status: "PASS",
      mode: "offline",
      transmitted: false,
      inspection: prepared.inspection,
    };
  }
  if (!allowLiveSend) {
    throw failure("LIVE_SEND_NOT_ALLOWED", "Live send mode requires explicit allowLiveSend=true.");
  }
  const send = transport ?? createHttpsTransport();
  const response = await send(prepared.request);
  return {
    status: "PASS",
    mode: "live-send",
    transmitted: true,
    attemptCount: 1,
    inspection: prepared.inspection,
    response: {
      statusCode: response.statusCode,
      headers: response.headers,
      body: response.body,
    },
  };
}

export async function validateOfflineInvocationPreflight(input) {
  const {
    expectedAccountId = EXPECTED_ACCOUNT_ID,
    expectedRegion = EXPECTED_REGION,
    expectedService = EXPECTED_SERVICE,
    expectedFunctionUrlHost = EXPECTED_FUNCTION_URL_HOST,
    expectedDedicatedOperatorRoleArn = EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
    functionUrl,
    operatorCallerArn,
    authorizedOperatorArn,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    credentialExpirationIso = "",
    requestBodyText,
    maxAttempts = 1,
    retryMode = "standard",
    invocationCommandLine = "",
    signingDate = new Date(),
  } = input;

  const prepared = await buildSignedInvokeRequest({
    functionUrl,
    requestBodyText,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region: expectedRegion,
    service: expectedService,
    signingDate,
    expectedFunctionUrlHost,
    expectedAccountId,
    expectedDedicatedOperatorRoleArn,
    operatorCallerArn,
    authorizedOperatorArn,
    credentialExpirationIso,
    maxAttempts,
    retryMode,
    invocationCommandLine,
  });
  verifySignedInvokeRequest(prepared, { expectedRegion, expectedService, expectedHost: expectedFunctionUrlHost });
  return {
    status: "PASS",
    validatedAt: new Date().toISOString(),
    accountId: expectedAccountId,
    region: expectedRegion,
    service: expectedService,
    functionUrlHost: expectedFunctionUrlHost,
    operatorCallerArn,
    authorizedOperatorArn,
    runId: prepared.runId,
    retryPolicy: { maxAttempts, retryMode: retryMode.toLowerCase() },
    sigv4: {
      algorithm: prepared.inspection.algorithm,
      credentialScope: `${prepared.inspection.credentialScopeDate}/${prepared.inspection.credentialScopeRegion}/${prepared.inspection.credentialScopeService}/aws4_request`,
      signedHeaders: prepared.inspection.signedHeaders.join(";"),
      accessKeyIdRedacted: prepared.inspection.credentialAccessKeyIdRedacted,
      signatureRedacted: prepared.inspection.signatureRedacted,
      xAmzDate: prepared.inspection.xAmzDate,
      payloadHash: prepared.inspection.bodySha256,
    },
    inspection: prepared.inspection,
  };
}
