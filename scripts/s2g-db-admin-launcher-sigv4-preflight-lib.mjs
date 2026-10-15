import { createHash, createHmac } from "node:crypto";

export const EXPECTED_ACCOUNT_ID = "452630323448";
export const EXPECTED_REGION = "us-west-2";
export const EXPECTED_SERVICE = "lambda";
export const EXPECTED_FUNCTION_URL_HOST = "r7sknifhujrb2ypc7rj3ycr4k40rbalj.lambda-url.us-west-2.on.aws";
export const EXPECTED_DEDICATED_OPERATOR_ROLE_ARN = "arn:aws:iam::452630323448:role/GenesisStagingS2gDbAdminD-StagingS2gDbAdminDiagnost-zeoxqigBe1Ma";
export const RUN_ID_PATTERN = /^s2g-dbdiag-[a-z0-9-]{3,55}$/;

function failure(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function assertTrue(condition, code, message = code) {
  if (!condition) throw failure(code, message);
}

function toAmzDate(input = new Date()) {
  const iso = new Date(input).toISOString();
  return iso.replace(/[:-]|\.\d{3}/g, "");
}

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function hmac(key, data) {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function deriveSigningKey(secretAccessKey, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = createHmac("sha256", kDate).update(region, "utf8").digest();
  const kService = createHmac("sha256", kRegion).update(service, "utf8").digest();
  return createHmac("sha256", kService).update("aws4_request", "utf8").digest();
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

function canonicalizePath(pathname) {
  if (!pathname || pathname === "") return "/";
  return pathname
    .split("/")
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join("/")
    .replace(/%2F/gi, "/");
}

export function buildSignedInvokeRequest(input) {
  const {
    functionUrl,
    requestBodyText,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region = EXPECTED_REGION,
    service = EXPECTED_SERVICE,
    signingDate = new Date(),
  } = input;

  const url = new URL(functionUrl);
  const amzDate = toAmzDate(signingDate);
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const payloadHash = sha256Hex(requestBodyText);
  const canonicalHeaders =
    `content-type:application/json\n`
    + `host:${url.host}\n`
    + `x-amz-date:${amzDate}\n`
    + `x-amz-security-token:${sessionToken}\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-security-token";
  const canonicalRequest = [
    "POST",
    canonicalizePath(url.pathname),
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = deriveSigningKey(secretAccessKey, dateStamp, region, service);
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");
  const authorizationHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, `
    + `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    host: url.host,
    path: canonicalizePath(url.pathname),
    amzDate,
    credentialScope,
    signedHeaders,
    authorizationHeader,
    payloadHash,
  };
}

export function validateOfflineInvocationPreflight(input) {
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

  const url = new URL(functionUrl);
  assertTrue(url.protocol === "https:", "SIGV4_URL_SCHEME_INVALID", "Function URL must use https.");
  assertTrue(url.hostname === expectedFunctionUrlHost, "SIGV4_URL_HOST_INVALID", "Function URL host does not match expected launcher host.");
  assertTrue((url.search ?? "") === "", "SIGV4_URL_QUERY_INVALID", "Function URL must not include query parameters.");
  assertTrue((url.pathname ?? "/") === "/", "SIGV4_URL_PATH_INVALID", "Function URL path must be '/'.");

  assertTrue(typeof accessKeyId === "string" && accessKeyId.length > 0, "SIGV4_ACCESS_KEY_MISSING");
  assertTrue(typeof secretAccessKey === "string" && secretAccessKey.length > 0, "SIGV4_SECRET_KEY_MISSING");
  assertTrue(typeof sessionToken === "string" && sessionToken.length > 0, "SIGV4_SESSION_TOKEN_MISSING");
  if (credentialExpirationIso) {
    const expiration = Date.parse(credentialExpirationIso);
    assertTrue(Number.isFinite(expiration), "SIGV4_CREDENTIAL_EXPIRY_INVALID", "Credential expiration must be an ISO timestamp.");
    assertTrue(expiration > Date.now(), "SIGV4_CREDENTIAL_EXPIRED", "Temporary credentials are expired.");
  }

  const expectedRoleName = roleNameFromRoleArn(expectedDedicatedOperatorRoleArn);
  const caller = parseAssumedRoleArn(operatorCallerArn);
  assertTrue(caller !== null, "OPERATOR_CALLER_ARN_INVALID", "Operator caller ARN must be an STS assumed-role ARN.");
  assertTrue(caller.accountId === expectedAccountId, "OPERATOR_ACCOUNT_INVALID", "Operator caller account mismatch.");
  assertTrue(caller.roleName === expectedRoleName, "OPERATOR_ROLE_INVALID", "Operator caller must be the dedicated diagnostic operator role session.");
  assertTrue(!caller.roleName.startsWith("AWSReservedSSO_"), "OPERATOR_SSO_SOURCE_FORBIDDEN", "Direct Identity Center source sessions are not permitted for invocation.");

  const authorized = parseAssumedRoleArn(authorizedOperatorArn);
  assertTrue(authorized !== null, "AUTHORIZED_OPERATOR_ARN_INVALID", "authorizedOperatorArn must be an STS assumed-role ARN.");
  assertTrue(authorizedOperatorArn === operatorCallerArn, "AUTHORIZED_OPERATOR_MISMATCH", "authorizedOperatorArn must exactly match the invoking operator session ARN.");

  assertTrue(maxAttempts === 1, "RETRY_POLICY_INVALID", "maxAttempts must be exactly 1.");
  assertTrue((retryMode ?? "").toLowerCase() === "standard", "RETRY_MODE_INVALID", "retryMode must be standard with maxAttempts=1.");

  const payload = JSON.parse(requestBodyText);
  const keys = Object.keys(payload);
  assertTrue(keys.length === 1 && keys[0] === "runId", "REQUEST_BODY_INVALID", "Request body must contain only runId.");
  assertTrue(typeof payload.runId === "string" && RUN_ID_PATTERN.test(payload.runId), "REQUEST_RUN_ID_INVALID", "runId format is invalid.");

  if (invocationCommandLine) {
    const provider = extractCurlSigV4Provider(invocationCommandLine);
    validateCurlSigV4Provider(provider, { expectedRegion, expectedService });
  }

  const signed = buildSignedInvokeRequest({
    functionUrl,
    requestBodyText,
    accessKeyId,
    secretAccessKey,
    sessionToken,
    region: expectedRegion,
    service: expectedService,
    signingDate,
  });
  const parsedScope = parseCredentialScopeFromAuthorizationHeader(signed.authorizationHeader);
  assertTrue(parsedScope.region === expectedRegion, "SIGV4_SCOPE_REGION_INVALID", "Signed credential scope region mismatch.");
  assertTrue(parsedScope.service === expectedService, "SIGV4_SCOPE_SERVICE_INVALID", "Signed credential scope service mismatch.");
  assertTrue(parsedScope.terminal === "aws4_request", "SIGV4_SCOPE_TERMINAL_INVALID", "Signed credential scope terminal token mismatch.");
  assertTrue(parsedScope.signedHeaders.split(";").includes("x-amz-security-token"), "SIGV4_SESSION_TOKEN_UNSIGNED", "Session token header must be signed.");

  return {
    status: "PASS",
    validatedAt: new Date().toISOString(),
    accountId: expectedAccountId,
    region: expectedRegion,
    service: expectedService,
    functionUrlHost: url.hostname,
    operatorCallerArn,
    authorizedOperatorArn,
    runId: payload.runId,
    retryPolicy: { maxAttempts, retryMode: retryMode.toLowerCase() },
    sigv4: {
      algorithm: "AWS4-HMAC-SHA256",
      credentialScope: signed.credentialScope,
      signedHeaders: parsedScope.signedHeaders,
      accessKeyIdRedacted: "REDACTED",
      signatureRedacted: "REDACTED",
      xAmzDate: signed.amzDate,
      payloadHash: signed.payloadHash,
    },
  };
}
