import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPECTED_ACCOUNT_ID,
  EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
  EXPECTED_FUNCTION_URL_HOST,
  EXPECTED_REGION,
  EXPECTED_SERVICE,
  extractCurlSigV4Provider,
  validateCurlSigV4Provider,
  validateOfflineInvocationPreflight,
} from "./s2g-db-admin-launcher-sigv4-preflight-lib.mjs";

function baseInput(overrides = {}) {
  return {
    functionUrl: "https://r7sknifhujrb2ypc7rj3ycr4k40rbalj.lambda-url.us-west-2.on.aws/",
    operatorCallerArn: "arn:aws:sts::452630323448:assumed-role/GenesisStagingS2gDbAdminD-StagingS2gDbAdminDiagnost-zeoxqigBe1Ma/s2g-dbdiag-operator-20261015T1300Z",
    authorizedOperatorArn: "arn:aws:sts::452630323448:assumed-role/GenesisStagingS2gDbAdminD-StagingS2gDbAdminDiagnost-zeoxqigBe1Ma/s2g-dbdiag-operator-20261015T1300Z",
    accessKeyId: "ASIAEXAMPLEKEY123456",
    secretAccessKey: "secretEXAMPLE1234567890",
    sessionToken: "tokenEXAMPLE123",
    credentialExpirationIso: "2026-10-16T00:00:00.000Z",
    requestBodyText: JSON.stringify({ runId: "s2g-dbdiag-testabc123" }),
    maxAttempts: 1,
    retryMode: "standard",
    invocationCommandLine: "curl.exe --retry 0 --aws-sigv4 \"aws:amz:us-west-2:lambda\"",
    expectedAccountId: EXPECTED_ACCOUNT_ID,
    expectedRegion: EXPECTED_REGION,
    expectedService: EXPECTED_SERVICE,
    expectedFunctionUrlHost: EXPECTED_FUNCTION_URL_HOST,
    expectedDedicatedOperatorRoleArn: EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
    signingDate: new Date("2026-10-15T13:00:56.000Z"),
    ...overrides,
  };
}

function assertCode(fn, expectedCode) {
  assert.throws(fn, (error) => error?.code === expectedCode);
}

test("accepts correct us-west-2/lambda scope and body", () => {
  const result = validateOfflineInvocationPreflight(baseInput());
  assert.equal(result.status, "PASS");
  assert.equal(result.sigv4.credentialScope, "20261015/us-west-2/lambda/aws4_request");
  assert.equal(result.sigv4.accessKeyIdRedacted, "REDACTED");
  assert.equal(result.sigv4.signatureRedacted, "REDACTED");
});

test("rejects wrong region", () => {
  assertCode(
    () => validateOfflineInvocationPreflight(baseInput({ expectedRegion: "us-east-1" })),
    "SIGV4_SCOPE_REGION_INVALID",
  );
});

test("rejects wrong service", () => {
  assertCode(
    () => validateOfflineInvocationPreflight(baseInput({ expectedService: "execute-api" })),
    "SIGV4_SCOPE_SERVICE_INVALID",
  );
});

test("rejects missing session token", () => {
  assertCode(
    () => validateOfflineInvocationPreflight(baseInput({ sessionToken: "" })),
    "SIGV4_SESSION_TOKEN_MISSING",
  );
});

test("rejects incorrect operator role", () => {
  assertCode(
    () => validateOfflineInvocationPreflight(baseInput({
      operatorCallerArn: "arn:aws:sts::452630323448:assumed-role/SomeOtherRole/session",
      authorizedOperatorArn: "arn:aws:sts::452630323448:assumed-role/SomeOtherRole/session",
    })),
    "OPERATOR_ROLE_INVALID",
  );
});

test("rejects direct source identity center session ARN", () => {
  const sourceSessionArn = "arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_GenesisS2GDiagOperator_bef639e26f419d49/Robert";
  assertCode(
    () => validateOfflineInvocationPreflight(baseInput({
      operatorCallerArn: sourceSessionArn,
      authorizedOperatorArn: sourceSessionArn,
    })),
    "OPERATOR_ROLE_INVALID",
  );
});

test("rejects mismatched authorizedOperatorArn", () => {
  assertCode(
    () => validateOfflineInvocationPreflight(baseInput({
      authorizedOperatorArn: "arn:aws:sts::452630323448:assumed-role/GenesisStagingS2gDbAdminD-StagingS2gDbAdminDiagnost-zeoxqigBe1Ma/other-session",
    })),
    "AUTHORIZED_OPERATOR_MISMATCH",
  );
});

test("rejects expired credentials when expiration is provided", () => {
  assertCode(
    () => validateOfflineInvocationPreflight(baseInput({ credentialExpirationIso: "2025-10-15T13:00:00.000Z" })),
    "SIGV4_CREDENTIAL_EXPIRED",
  );
});

test("rejects unexpected function url host", () => {
  assertCode(
    () => validateOfflineInvocationPreflight(baseInput({ functionUrl: "https://example.com/" })),
    "SIGV4_URL_HOST_INVALID",
  );
});

test("rejects invalid request body shape", () => {
  assertCode(
    () => validateOfflineInvocationPreflight(baseInput({ requestBodyText: JSON.stringify({ runId: "s2g-dbdiag-testabc123", override: true }) })),
    "REQUEST_BODY_INVALID",
  );
});

test("detects inline shell provider failures where reproducible", () => {
  assertCode(
    () => validateCurlSigV4Provider("aws:amz:lambda:us-west-2"),
    "SIGV4_SCOPE_REGION_INVALID",
  );
  assertCode(
    () => extractCurlSigV4Provider("curl.exe --retry 0 -X POST"),
    "SIGV4_PROVIDER_MISSING",
  );
});

test("performs offline validation without network calls", () => {
  let fetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("network should not be called");
  };
  try {
    validateOfflineInvocationPreflight(baseInput());
    assert.equal(fetchCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
