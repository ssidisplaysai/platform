import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  EXPECTED_ACCOUNT_ID,
  EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
  EXPECTED_FUNCTION_URL_HOST,
  EXPECTED_REGION,
  EXPECTED_SERVICE,
  parseCredentialScopeFromAuthorizationHeader,
} from "./s2g-db-admin-launcher-sigv4-preflight-lib.mjs";

const RUNNER = "scripts/staging-s2g-db-admin-invoke-runner.mjs";
const DEDICATED_ROLE_NAME = EXPECTED_DEDICATED_OPERATOR_ROLE_ARN.split(":role/")[1];
const GOOD_ARN = `arn:aws:sts::${EXPECTED_ACCOUNT_ID}:assumed-role/${DEDICATED_ROLE_NAME}/runner-test-session`;
const GOOD_RUN_ID = "s2g-dbdiag-a1b2c3d4e5";
const BODY_TEXT = JSON.stringify({ runId: GOOD_RUN_ID });
const NOW_EPOCH = 1792077000;

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function runRunner(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [RUNNER, ...args], {
      cwd: "C:\\Users\\rober\\Documents\\Genesis V2\\platform",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("close", (code) => {
      resolve({
        code,
        stdout,
        stderr,
      });
    });
  });
}

function baseArgs() {
  return [
    "--function-url", `https://${EXPECTED_FUNCTION_URL_HOST}/`,
    "--operator-caller-arn", GOOD_ARN,
    "--authorized-operator-arn", GOOD_ARN,
    "--access-key-id", "ASIAEXAMPLEACCESSKEYID",
    "--secret-access-key", "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
    "--session-token", "AQoDYXdzEO///////////wEaDDQ5OTQzNDk0NTQzNSIMEXAMPLE",
    "--credential-expiration-iso", "2035-01-01T00:00:00.000Z",
    "--request-body-text", BODY_TEXT,
    "--max-attempts", "1",
    "--retry-mode", "standard",
    "--expected-account-id", EXPECTED_ACCOUNT_ID,
    "--expected-region", EXPECTED_REGION,
    "--expected-service", EXPECTED_SERVICE,
    "--expected-function-url-host", EXPECTED_FUNCTION_URL_HOST,
    "--expected-dedicated-operator-role-arn", EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
  ];
}

function liveArgs(transportUrl) {
  return [
    "--live",
    "--owner-approval-reference", "OWNER_APPROVAL:S2G-DBDIAG-RUNNER-TEST-001",
    "--authorization-approval-reference", "OWNER_APPROVAL:S2G-DBDIAG-RUNNER-TEST-001",
    "--owner-approval-issued-at-epoch", String(NOW_EPOCH - 30),
    "--approved-run-id", GOOD_RUN_ID,
    "--authorization-launch-state", "AUTHORIZED",
    "--authorization-expires-at-epoch", String(NOW_EPOCH + 240),
    "--launcher-activation-state", "ENABLED",
    "--snapshot-broker-activation-state", "DISABLED",
    "--now-epoch", String(NOW_EPOCH),
    "--transport-url", transportUrl,
    "--transport-timeout-ms", "400",
  ];
}

async function withTempDir(fn) {
  const directory = await mkdtemp(resolve(tmpdir(), "s2g-dbdiag-runner-test-"));
  try {
    return await fn(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function createServer(handler) {
  const state = { requests: [] };
  const server = http.createServer((req, res) => handler(req, res, state));
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        state,
        url: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

test("default mode is offline and never transmits", async () => {
  const result = await runRunner(baseArgs());
  assert.equal(result.code, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.mode, "offline");
  assert.equal(payload.transmitted, false);
  assert.equal(payload.httpStatus, null);
});

test("live mode sends one exact signed request to local receiver", async () => {
  const receiver = await createServer((req, res, state) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      state.requests.push({
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      });
      res.statusCode = 202;
      res.setHeader("x-amzn-requestid", "mock-req-1");
      res.end("{\"ok\":true}");
    });
  });
  try {
    const result = await runRunner([...baseArgs(), ...liveArgs(receiver.url)]);
    assert.equal(result.code, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.mode, "live-send");
    assert.equal(payload.transmitted, true);
    assert.equal(payload.attemptCount, 1);
    assert.equal(payload.httpStatus, 202);
    assert.equal(payload.requestId, "mock-req-1");
    assert.equal(receiver.state.requests.length, 1);

    const captured = receiver.state.requests[0];
    assert.equal(captured.method, "POST");
    assert.equal(captured.url, "/");
    assert.equal(captured.headers.host, EXPECTED_FUNCTION_URL_HOST);
    assert.equal(captured.headers["x-amz-security-token"]?.length > 0, true);
    assert.equal(captured.headers["x-amz-content-sha256"], sha256Hex(BODY_TEXT));
    assert.equal(captured.body, BODY_TEXT);

    const scope = parseCredentialScopeFromAuthorizationHeader(captured.headers.authorization);
    assert.equal(scope.region, EXPECTED_REGION);
    assert.equal(scope.service, EXPECTED_SERVICE);
    assert.equal(scope.signedHeaders.includes("x-amz-security-token"), true);
    assert.equal(payload.transportIntegrity.unchanged, true);
    assert.equal(typeof payload.transportIntegrity.requestDigest, "string");
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("live mode does not retry on HTTP 403", async () => {
  const receiver = await createServer((req, res, state) => {
    state.requests.push({ url: req.url });
    req.resume();
    res.statusCode = 403;
    res.setHeader("x-amzn-requestid", "mock-req-403");
    res.end("{\"message\":\"forbidden\"}");
  });
  try {
    const result = await runRunner([...baseArgs(), ...liveArgs(receiver.url)]);
    assert.equal(result.code, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.httpStatus, 403);
    assert.equal(payload.attemptCount, 1);
    assert.equal(receiver.state.requests.length, 1);
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("live mode does not retry on HTTP 502", async () => {
  const receiver = await createServer((req, res, state) => {
    state.requests.push({ url: req.url });
    req.resume();
    res.statusCode = 502;
    res.setHeader("x-amzn-requestid", "mock-req-502");
    res.end("{\"message\":\"bad gateway\"}");
  });
  try {
    const result = await runRunner([...baseArgs(), ...liveArgs(receiver.url)]);
    assert.equal(result.code, 0);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.httpStatus, 502);
    assert.equal(payload.attemptCount, 1);
    assert.equal(receiver.state.requests.length, 1);
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("live mode does not retry after timeout", async () => {
  const receiver = await createServer((req, res, state) => {
    state.requests.push({ url: req.url });
    req.resume();
    setTimeout(() => {
      res.statusCode = 200;
      res.end("{\"ok\":true}");
    }, 1000);
  });
  try {
    const result = await runRunner([...baseArgs(), ...liveArgs(receiver.url), "--transport-timeout-ms", "100"]);
    assert.equal(result.code, 1);
    const failure = JSON.parse(result.stderr.trim());
    assert.equal(failure.code, "LIVE_SEND_TIMEOUT");
    assert.equal(receiver.state.requests.length, 1);
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("live mode does not retry after connection failure", async () => {
  const result = await runRunner([...baseArgs(), ...liveArgs("http://127.0.0.1:9")]);
  assert.equal(result.code, 1);
  const failure = JSON.parse(result.stderr.trim());
  assert.equal(typeof failure.code, "string");
  assert.notEqual(failure.code.length, 0);
});

test("rejects unauthorized live mode when owner approval is missing", async () => {
  const receiver = await createServer((req, res) => {
    req.resume();
    res.statusCode = 200;
    res.end("{}");
  });
  try {
    const args = [...baseArgs(), ...liveArgs(receiver.url)];
    const index = args.indexOf("--owner-approval-reference");
    args[index + 1] = "";
    const result = await runRunner(args);
    assert.equal(result.code, 1);
    const failure = JSON.parse(result.stderr.trim());
    assert.equal(failure.code, "OWNER_APPROVAL_REFERENCE_INVALID");
    assert.equal(receiver.state.requests.length, 0);
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("rejects generic owner approval token", async () => {
  const receiver = await createServer((req, res, state) => {
    state.requests.push({ url: req.url });
    req.resume();
    res.statusCode = 200;
    res.end("{}");
  });
  try {
    const args = [...baseArgs(), ...liveArgs(receiver.url)];
    const index = args.indexOf("--owner-approval-reference");
    args[index + 1] = "OWNER_APPROVAL";
    const authIndex = args.indexOf("--authorization-approval-reference");
    args[authIndex + 1] = "OWNER_APPROVAL";
    const result = await runRunner(args);
    assert.equal(result.code, 1);
    const failure = JSON.parse(result.stderr.trim());
    assert.equal(failure.code, "OWNER_APPROVAL_REFERENCE_INVALID");
    assert.equal(receiver.state.requests.length, 0);
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("rejects synthesized owner approval reference", async () => {
  const receiver = await createServer((req, res, state) => {
    state.requests.push({ url: req.url });
    req.resume();
    res.statusCode = 200;
    res.end("{}");
  });
  try {
    const args = [...baseArgs(), ...liveArgs(receiver.url)];
    const index = args.indexOf("--owner-approval-reference");
    args[index + 1] = "OWNER_APPROVAL:OWNER_APPROVAL-20261015T170824Z";
    const authIndex = args.indexOf("--authorization-approval-reference");
    args[authIndex + 1] = args[index + 1];
    const result = await runRunner(args);
    assert.equal(result.code, 1);
    const failure = JSON.parse(result.stderr.trim());
    assert.equal(failure.code, "OWNER_APPROVAL_REFERENCE_SYNTHESIZED");
    assert.equal(receiver.state.requests.length, 0);
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("rejects missing authorization approval reference", async () => {
  const receiver = await createServer((req, res, state) => {
    state.requests.push({ url: req.url });
    req.resume();
    res.statusCode = 200;
    res.end("{}");
  });
  try {
    const args = [...baseArgs(), ...liveArgs(receiver.url)];
    const index = args.indexOf("--authorization-approval-reference");
    args[index + 1] = "";
    const result = await runRunner(args);
    assert.equal(result.code, 1);
    const failure = JSON.parse(result.stderr.trim());
    assert.equal(failure.code, "AUTHORIZATION_APPROVAL_REFERENCE_MISSING");
    assert.equal(receiver.state.requests.length, 0);
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("rejects mismatch between owner and authorization approval references", async () => {
  const receiver = await createServer((req, res, state) => {
    state.requests.push({ url: req.url });
    req.resume();
    res.statusCode = 200;
    res.end("{}");
  });
  try {
    const args = [...baseArgs(), ...liveArgs(receiver.url)];
    const index = args.indexOf("--authorization-approval-reference");
    args[index + 1] = "OWNER_APPROVAL_MISMATCH";
    const result = await runRunner(args);
    assert.equal(result.code, 1);
    const failure = JSON.parse(result.stderr.trim());
    assert.equal(failure.code, "OWNER_APPROVAL_REFERENCE_MISMATCH");
    assert.equal(receiver.state.requests.length, 0);
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("rejects UTF-8 BOM request-body file before transport", async () => {
  const receiver = await createServer((req, res, state) => {
    state.requests.push({ url: req.url });
    req.resume();
    res.statusCode = 200;
    res.end("{}");
  });
  try {
    await withTempDir(async (directory) => {
      const filePath = resolve(directory, "invoke-body.json");
      const bomBuffer = Buffer.concat([
        Buffer.from([0xEF, 0xBB, 0xBF]),
        Buffer.from(BODY_TEXT, "utf8"),
      ]);
      await writeFile(filePath, bomBuffer);
      const args = [...baseArgs(), ...liveArgs(receiver.url)];
      const textIndex = args.indexOf("--request-body-text");
      args.splice(textIndex, 2);
      args.push("--request-body-file", filePath);
      const result = await runRunner(args);
      assert.equal(result.code, 1);
      const failure = JSON.parse(result.stderr.trim());
      assert.equal(failure.code, "INVOCATION_REQUEST_UTF8_BOM");
      assert.equal(receiver.state.requests.length, 0);
    });
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("rejects expired authorization in live mode", async () => {
  const receiver = await createServer((req, res) => {
    req.resume();
    res.statusCode = 200;
    res.end("{}");
  });
  try {
    const args = [...baseArgs(), ...liveArgs(receiver.url)];
    const idx = args.indexOf("--authorization-expires-at-epoch");
    args[idx + 1] = String(NOW_EPOCH - 1);
    const result = await runRunner(args);
    assert.equal(result.code, 1);
    const failure = JSON.parse(result.stderr.trim());
    assert.equal(failure.code, "AUTHORIZATION_EXPIRED");
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});

test("rejects source Identity Center operator session in live mode", async () => {
  const receiver = await createServer((req, res) => {
    req.resume();
    res.statusCode = 200;
    res.end("{}");
  });
  try {
    const args = [...baseArgs(), ...liveArgs(receiver.url)];
    const idx = args.indexOf("--operator-caller-arn");
    args[idx + 1] = "arn:aws:sts::452630323448:assumed-role/AWSReservedSSO_GenesisS2GDiagOperator_bef639e26f419d49/source-session";
    const idxAuth = args.indexOf("--authorized-operator-arn");
    args[idxAuth + 1] = args[idx + 1];
    const result = await runRunner(args);
    assert.equal(result.code, 1);
    const failure = JSON.parse(result.stderr.trim());
    assert.equal(failure.code, "OPERATOR_SOURCE_SESSION_FORBIDDEN");
  } finally {
    await new Promise((resolve) => receiver.server.close(resolve));
  }
});
