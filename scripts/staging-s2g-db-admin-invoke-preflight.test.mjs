import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { SignatureV4 } from "@smithy/signature-v4";
import {
  EXPECTED_ACCOUNT_ID,
  EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
  EXPECTED_FUNCTION_URL_HOST,
  EXPECTED_REGION,
  EXPECTED_SERVICE,
  buildSignedInvokeRequest,
  executeSignedInvokeRequest,
  validateOfflineInvocationPreflight,
} from "./s2g-db-admin-launcher-sigv4-preflight-lib.mjs";

class NodeSha256 {
  constructor(secret) {
    this.hash = secret
      ? createHmac("sha256", Buffer.isBuffer(secret) ? secret : Buffer.from(secret))
      : createHash("sha256");
  }
  update(data) {
    this.hash.update(data);
  }
  digest() {
    return this.hash.digest();
  }
}

const GOOD_RUN_ID = "s2g-dbdiag-ab12cd34ef56";
const DEDICATED_ROLE_NAME = EXPECTED_DEDICATED_OPERATOR_ROLE_ARN.split(":role/")[1];
const GOOD_ARN = `arn:aws:sts::${EXPECTED_ACCOUNT_ID}:assumed-role/${DEDICATED_ROLE_NAME}/integration-test-session`;
const FUTURE_EXPIRATION = "2035-01-01T00:00:00.000Z";
const DATE_OVERRIDE = "20261015T120000Z";
const DATE_STAMP = DATE_OVERRIDE.slice(0, 8);
const GOOD_BODY = JSON.stringify({ runId: GOOD_RUN_ID });

function baseOptions(overrides = {}) {
  return {
    accessKeyId: "ASIAEXAMPLEACCESSKEYID",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    sessionToken: "AQoDYXdzEO///////////wEaDDQ5OTQzNDk0NTQzNSIMEXAMPLE",
    credentialExpirationIso: FUTURE_EXPIRATION,
    runId: GOOD_RUN_ID,
    requestBodyText: GOOD_BODY,
    functionUrl: `https://${EXPECTED_FUNCTION_URL_HOST}/`,
    operatorCallerArn: GOOD_ARN,
    authorizedOperatorArn: GOOD_ARN,
    expectedAccountId: EXPECTED_ACCOUNT_ID,
    expectedRegion: EXPECTED_REGION,
    expectedService: EXPECTED_SERVICE,
    expectedFunctionUrlHost: EXPECTED_FUNCTION_URL_HOST,
    expectedDedicatedOperatorRoleArn: EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
    maxAttempts: 1,
    signingDate: new Date(Date.UTC(2026, 9, 15, 12, 0, 0)),
    ...overrides,
  };
}

async function getPrepared(overrides = {}) {
  return buildSignedInvokeRequest(baseOptions(overrides));
}

test("offline preflight succeeds with valid dedicated operator session", async () => {
  const result = await validateOfflineInvocationPreflight(baseOptions());
  assert.equal(result.status, "PASS");
  assert.equal(result.operatorCallerArn, GOOD_ARN);
  assert.equal(result.authorizedOperatorArn, GOOD_ARN);
  assert.equal(result.sigv4.credentialScope, `${DATE_STAMP}/${EXPECTED_REGION}/${EXPECTED_SERVICE}/aws4_request`);
  assert.equal(result.sigv4.signedHeaders.includes("x-amz-security-token"), true);
  assert.equal(result.retryPolicy.maxAttempts, 1);
});

test("signature matches independent AWS SDK signer reference", async () => {
  const prepared = await getPrepared();
  const body = JSON.stringify({ runId: GOOD_RUN_ID });
  const signer = new SignatureV4({
    credentials: {
      accessKeyId: baseOptions().accessKeyId,
      secretAccessKey: baseOptions().secretAccessKey,
      sessionToken: baseOptions().sessionToken,
    },
    region: EXPECTED_REGION,
    service: EXPECTED_SERVICE,
    sha256: NodeSha256,
  });
  const signed = await signer.sign({
    method: "POST",
    protocol: "https:",
    hostname: EXPECTED_FUNCTION_URL_HOST,
    path: "/",
    headers: {
      host: EXPECTED_FUNCTION_URL_HOST,
      "content-type": "application/json",
    },
    body,
  }, { signingDate: new Date(Date.UTC(2026, 9, 15, 12, 0, 0)) });
  assert.equal(prepared.request.headers.authorization, signed.headers.authorization);
  assert.equal(prepared.request.headers["x-amz-content-sha256"], signed.headers["x-amz-content-sha256"]);
});

test("rejects wrong region", async () => {
  await assert.rejects(
    () => validateOfflineInvocationPreflight(baseOptions({ expectedRegion: "us-east-1" })),
    { code: "EXPECTED_REGION_REQUIRED" }
  );
});

test("rejects wrong service", async () => {
  await assert.rejects(
    () => validateOfflineInvocationPreflight(baseOptions({ expectedService: "execute-api" })),
    { code: "EXPECTED_SERVICE_REQUIRED" }
  );
});

test("rejects wrong host", async () => {
  await assert.rejects(
    () => validateOfflineInvocationPreflight(baseOptions({ expectedFunctionUrlHost: "example.com" })),
    { code: "EXPECTED_HOST_REQUIRED" }
  );
});

test("rejects missing STS token", async () => {
  const options = baseOptions();
  options.sessionToken = "";
  await assert.rejects(() => validateOfflineInvocationPreflight(options), { code: "SIGV4_SESSION_TOKEN_MISSING" });
});

test("rejects source SSO session ARN", async () => {
  const options = baseOptions();
  options.operatorCallerArn = "arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_GenesisS2GDiagOperator_bef639e26f419d49/source-session";
  options.authorizedOperatorArn = options.operatorCallerArn;
  await assert.rejects(() => validateOfflineInvocationPreflight(options), { code: "OPERATOR_SOURCE_SESSION_FORBIDDEN" });
});

test("rejects AdministratorAccess session", async () => {
  const options = baseOptions();
  options.operatorCallerArn = "arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_AdministratorAccess_bef639e26f419d49/session-1";
  options.authorizedOperatorArn = options.operatorCallerArn;
  await assert.rejects(() => validateOfflineInvocationPreflight(options), { code: "OPERATOR_ADMIN_SESSION_FORBIDDEN" });
});

test("rejects operator-session mismatch", async () => {
  await assert.rejects(
    () => validateOfflineInvocationPreflight(baseOptions({ authorizedOperatorArn: `arn:aws:sts::${EXPECTED_ACCOUNT_ID}:assumed-role/${DEDICATED_ROLE_NAME}/different-session` })),
    { code: "AUTHORIZED_OPERATOR_MISMATCH" }
  );
});

test("rejects expired session", async () => {
  await assert.rejects(
    () => validateOfflineInvocationPreflight(baseOptions({ credentialExpirationIso: "2020-01-01T00:00:00.000Z" })),
    { code: "SIGV4_CREDENTIAL_EXPIRED" }
  );
});

test("rejects invalid runId", async () => {
  await assert.rejects(
    () => validateOfflineInvocationPreflight(baseOptions({ requestBodyText: JSON.stringify({ runId: "BAD_RUN_ID" }) })),
    { code: "REQUEST_RUN_ID_INVALID" }
  );
});

test("rejects extra JSON fields", async () => {
  await assert.rejects(
    () => validateOfflineInvocationPreflight(baseOptions({ requestBodyText: JSON.stringify({ runId: GOOD_RUN_ID, extra: "field" }) })),
    { code: "REQUEST_BODY_INVALID" }
  );
});

test("rejects UTF-8 BOM in request body", async () => {
  await assert.rejects(
    () => validateOfflineInvocationPreflight(baseOptions({ requestBodyText: `\uFEFF${GOOD_BODY}` })),
    { code: "INVOCATION_REQUEST_UTF8_BOM" }
  );
});

test("rejects invalid JSON request body", async () => {
  await assert.rejects(
    () => validateOfflineInvocationPreflight(baseOptions({ requestBodyText: "{\"runId\":\"oops\"" })),
    { code: "REQUEST_BODY_JSON_INVALID" }
  );
});

test("offline mode cannot transmit requests", async () => {
  const prepared = await getPrepared();
  let called = false;
  const result = await executeSignedInvokeRequest({
    prepared,
    mode: "offline",
    maxAttempts: 1,
    allowLiveSend: false,
    transport: async () => {
      called = true;
      return { statusCode: 200, headers: {} };
    },
  });
  assert.equal(called, false);
  assert.equal(result.transmitted, false);
});

test("live mode requires explicit allowLiveSend and maxAttempts=1", async () => {
  const prepared = await getPrepared();
  await assert.rejects(
    () => executeSignedInvokeRequest({ prepared, mode: "live-send", maxAttempts: 1, allowLiveSend: false, transport: async () => ({ statusCode: 200, headers: {} }) }),
    { code: "LIVE_SEND_NOT_ALLOWED" }
  );
  await assert.rejects(
    () => executeSignedInvokeRequest({ prepared, mode: "live-send", maxAttempts: 2, allowLiveSend: true, transport: async () => ({ statusCode: 200, headers: {} }) }),
    { code: "RETRY_POLICY_INVALID" }
  );
});

test("live mode performs exactly one attempt without retries", async () => {
  const prepared = await getPrepared();
  let attempts = 0;
  await assert.rejects(
    () =>
      executeSignedInvokeRequest({
        prepared,
        mode: "live-send",
        maxAttempts: 1,
        allowLiveSend: true,
        transport: async () => {
          attempts += 1;
          throw new Error("synthetic network failure");
        },
      }),
    /synthetic network failure/
  );
  assert.equal(attempts, 1);
});

test("rejects request body mutation after signing", async () => {
  const prepared = await getPrepared();
  const mutated = {
    ...prepared,
    request: {
      ...prepared.request,
      body: JSON.stringify({ runId: GOOD_RUN_ID.replace("ab12", "xy34") }),
      headers: { ...prepared.request.headers },
    },
  };
  await assert.rejects(
    () => executeSignedInvokeRequest({ prepared: mutated, mode: "offline", maxAttempts: 1, allowLiveSend: false }),
    { code: "SIGV4_PAYLOAD_HASH_MISMATCH" }
  );
});

test("rejects content hash mismatch", async () => {
  const prepared = await getPrepared();
  const mutated = {
    ...prepared,
    request: {
      ...prepared.request,
      headers: {
        ...prepared.request.headers,
        "x-amz-content-sha256": "0000000000000000000000000000000000000000000000000000000000000000",
      },
    },
  };
  await assert.rejects(
    () => executeSignedInvokeRequest({ prepared: mutated, mode: "offline", maxAttempts: 1, allowLiveSend: false }),
    { code: "SIGV4_PAYLOAD_HASH_MISMATCH" }
  );
});

test("rejects date and scope mismatch", async () => {
  const prepared = await getPrepared();
  const withBadDate = {
    ...prepared,
    request: {
      ...prepared.request,
      headers: {
        ...prepared.request.headers,
        "x-amz-date": "20261016T010101Z",
      },
    },
  };
  await assert.rejects(
    () => executeSignedInvokeRequest({ prepared: withBadDate, mode: "offline", maxAttempts: 1, allowLiveSend: false }),
    { code: "SIGV4_DATE_SCOPE_MISMATCH" }
  );

  const withBadScope = {
    ...prepared,
    scope: {
      ...prepared.scope,
      dateStamp: DATE_STAMP,
      region: "us-east-1",
      service: EXPECTED_SERVICE,
      scope: `${DATE_STAMP}/us-east-1/${EXPECTED_SERVICE}/aws4_request`,
    },
  };
  await assert.rejects(
    () => executeSignedInvokeRequest({ prepared: withBadScope, mode: "offline", maxAttempts: 1, allowLiveSend: false }),
    { code: "SIGV4_SCOPE_TAMPERED" }
  );
});
