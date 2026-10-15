import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import {
  EXPECTED_ACCOUNT_ID,
  EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
  EXPECTED_FUNCTION_URL_HOST,
  EXPECTED_REGION,
  EXPECTED_SERVICE,
  runSdkFunctionUrlInvocation,
} from "./s2g-db-admin-launcher-sigv4-preflight-lib.mjs";

function failure(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isLoopbackHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function parseBoolean(value, label) {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw failure("RUNNER_ARG_INVALID", `${label} must be true or false.`);
}

function parseInteger(value, label) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) throw failure("RUNNER_ARG_INVALID", `${label} must be an integer.`);
  return parsed;
}

function createTransport({ transportUrl, timeoutMs, allowNonLocalTransport }) {
  if (!transportUrl) return undefined;
  const destination = new URL(transportUrl);
  if (!allowNonLocalTransport && !isLoopbackHost(destination.hostname)) {
    throw failure("TRANSPORT_ENDPOINT_FORBIDDEN", "transport-url must target localhost/127.0.0.1/::1 unless allow-nonlocal-transport=true.");
  }
  const client = destination.protocol === "https:" ? https : http;
  if (destination.protocol !== "https:" && destination.protocol !== "http:") {
    throw failure("TRANSPORT_SCHEME_INVALID", "transport-url must use http or https.");
  }
  return (request) => new Promise((resolve, reject) => {
    const signedUrl = new URL(request.url);
    const req = client.request({
      protocol: destination.protocol,
      hostname: destination.hostname,
      port: destination.port || undefined,
      method: request.method,
      path: `${signedUrl.pathname}${signedUrl.search ?? ""}`,
      headers: request.headers,
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("timeout", () => req.destroy(failure("LIVE_SEND_TIMEOUT", "Live send timed out.")));
    req.on("error", reject);
    req.write(request.body ?? "");
    req.end();
  });
}

function parseArgs(argv) {
  const options = {
    live: false,
    functionUrl: "",
    operatorCallerArn: "",
    authorizedOperatorArn: "",
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    credentialExpirationIso: "",
    requestBodyText: "",
    requestBodyFile: "",
    maxAttempts: 1,
    retryMode: "standard",
    invocationCommandLine: "",
    expectedAccountId: EXPECTED_ACCOUNT_ID,
    expectedRegion: EXPECTED_REGION,
    expectedService: EXPECTED_SERVICE,
    expectedFunctionUrlHost: EXPECTED_FUNCTION_URL_HOST,
    expectedDedicatedOperatorRoleArn: EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
    ownerApprovalReference: "",
    authorizationApprovalReference: "",
    ownerApprovalIssuedAtEpoch: Number.NaN,
    approvedRunId: "",
    authorizationLaunchState: "",
    authorizationExpiresAtEpoch: Number.NaN,
    launcherActivationState: "",
    snapshotBrokerActivationState: "",
    nowEpoch: Math.floor(Date.now() / 1000),
    transportUrl: "",
    transportTimeoutMs: 12000,
    allowNonLocalTransport: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--live") options.live = true;
    else if (token === "--function-url") options.functionUrl = argv[++index] ?? "";
    else if (token === "--operator-caller-arn") options.operatorCallerArn = argv[++index] ?? "";
    else if (token === "--authorized-operator-arn") options.authorizedOperatorArn = argv[++index] ?? "";
    else if (token === "--access-key-id") options.accessKeyId = argv[++index] ?? "";
    else if (token === "--secret-access-key") options.secretAccessKey = argv[++index] ?? "";
    else if (token === "--session-token") options.sessionToken = argv[++index] ?? "";
    else if (token === "--credential-expiration-iso") options.credentialExpirationIso = argv[++index] ?? "";
    else if (token === "--request-body-text") options.requestBodyText = argv[++index] ?? "";
    else if (token === "--request-body-file") options.requestBodyFile = argv[++index] ?? "";
    else if (token === "--max-attempts") options.maxAttempts = parseInteger(argv[++index], "--max-attempts");
    else if (token === "--retry-mode") options.retryMode = argv[++index] ?? "";
    else if (token === "--invocation-command-line") options.invocationCommandLine = argv[++index] ?? "";
    else if (token === "--expected-account-id") options.expectedAccountId = argv[++index] ?? "";
    else if (token === "--expected-region") options.expectedRegion = argv[++index] ?? "";
    else if (token === "--expected-service") options.expectedService = argv[++index] ?? "";
    else if (token === "--expected-function-url-host") options.expectedFunctionUrlHost = argv[++index] ?? "";
    else if (token === "--expected-dedicated-operator-role-arn") options.expectedDedicatedOperatorRoleArn = argv[++index] ?? "";
    else if (token === "--owner-approval-reference") options.ownerApprovalReference = argv[++index] ?? "";
    else if (token === "--authorization-approval-reference") options.authorizationApprovalReference = argv[++index] ?? "";
    else if (token === "--owner-approval-issued-at-epoch") options.ownerApprovalIssuedAtEpoch = parseInteger(argv[++index], "--owner-approval-issued-at-epoch");
    else if (token === "--approved-run-id") options.approvedRunId = argv[++index] ?? "";
    else if (token === "--authorization-launch-state") options.authorizationLaunchState = argv[++index] ?? "";
    else if (token === "--authorization-expires-at-epoch") options.authorizationExpiresAtEpoch = parseInteger(argv[++index], "--authorization-expires-at-epoch");
    else if (token === "--launcher-activation-state") options.launcherActivationState = argv[++index] ?? "";
    else if (token === "--snapshot-broker-activation-state") options.snapshotBrokerActivationState = argv[++index] ?? "";
    else if (token === "--now-epoch") options.nowEpoch = parseInteger(argv[++index], "--now-epoch");
    else if (token === "--transport-url") options.transportUrl = argv[++index] ?? "";
    else if (token === "--transport-timeout-ms") options.transportTimeoutMs = parseInteger(argv[++index], "--transport-timeout-ms");
    else if (token === "--allow-nonlocal-transport") options.allowNonLocalTransport = parseBoolean(argv[++index], "--allow-nonlocal-transport");
    else throw failure("RUNNER_ARG_UNKNOWN", `Unknown argument: ${token}`);
  }

  if (!options.functionUrl) throw failure("RUNNER_ARG_REQUIRED", "--function-url is required.");
  if (!options.operatorCallerArn) throw failure("RUNNER_ARG_REQUIRED", "--operator-caller-arn is required.");
  if (!options.authorizedOperatorArn) throw failure("RUNNER_ARG_REQUIRED", "--authorized-operator-arn is required.");
  if (!options.accessKeyId) throw failure("RUNNER_ARG_REQUIRED", "--access-key-id is required.");
  if (!options.secretAccessKey) throw failure("RUNNER_ARG_REQUIRED", "--secret-access-key is required.");
  if (!options.sessionToken) throw failure("RUNNER_ARG_REQUIRED", "--session-token is required.");

  if (options.requestBodyFile) {
    options.requestBodyText = readFileSync(options.requestBodyFile, "utf8");
  }
  if (!options.requestBodyText) throw failure("RUNNER_ARG_REQUIRED", "--request-body-text or --request-body-file is required.");

  if (!options.live) {
    options.ownerApprovalReference = "";
    options.authorizationApprovalReference = "";
    options.approvedRunId = "";
    options.authorizationLaunchState = "";
    options.launcherActivationState = "";
    options.snapshotBrokerActivationState = "";
  }

  return options;
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const transport = createTransport({
    transportUrl: options.transportUrl,
    timeoutMs: options.transportTimeoutMs,
    allowNonLocalTransport: options.allowNonLocalTransport,
  });

  const result = await runSdkFunctionUrlInvocation({
    live: options.live,
    functionUrl: options.functionUrl,
    operatorCallerArn: options.operatorCallerArn,
    authorizedOperatorArn: options.authorizedOperatorArn,
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    sessionToken: options.sessionToken,
    credentialExpirationIso: options.credentialExpirationIso,
    requestBodyText: options.requestBodyText,
    maxAttempts: options.maxAttempts,
    retryMode: options.retryMode,
    invocationCommandLine: options.invocationCommandLine,
    expectedAccountId: options.expectedAccountId,
    expectedRegion: options.expectedRegion,
    expectedService: options.expectedService,
    expectedFunctionUrlHost: options.expectedFunctionUrlHost,
    expectedDedicatedOperatorRoleArn: options.expectedDedicatedOperatorRoleArn,
    ownerApprovalReference: options.ownerApprovalReference,
    authorizationApprovalReference: options.authorizationApprovalReference,
    ownerApprovalIssuedAtEpoch: options.ownerApprovalIssuedAtEpoch,
    approvedRunId: options.approvedRunId,
    authorizationLaunchState: options.authorizationLaunchState,
    authorizationExpiresAtEpoch: options.authorizationExpiresAtEpoch,
    launcherActivationState: options.launcherActivationState,
    snapshotBrokerActivationState: options.snapshotBrokerActivationState,
    nowEpoch: options.nowEpoch,
    transport,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  const code = typeof error?.code === "string" ? error.code : "SDK_INVOKE_RUNNER_FAILED";
  const message = typeof error?.message === "string" && error.message.length > 0 ? error.message : "SDK invoke runner failed.";
  process.stderr.write(`${JSON.stringify({ status: "FAIL", code, message })}\n`);
  process.exitCode = 1;
}
