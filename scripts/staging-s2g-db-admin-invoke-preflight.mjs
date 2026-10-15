import { readFileSync } from "node:fs";
import {
  EXPECTED_ACCOUNT_ID,
  EXPECTED_DEDICATED_OPERATOR_ROLE_ARN,
  EXPECTED_FUNCTION_URL_HOST,
  EXPECTED_REGION,
  EXPECTED_SERVICE,
  validateOfflineInvocationPreflight,
} from "./s2g-db-admin-launcher-sigv4-preflight-lib.mjs";

function parseArgs(argv) {
  const options = {
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
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--function-url") options.functionUrl = argv[++index] ?? "";
    else if (token === "--operator-caller-arn") options.operatorCallerArn = argv[++index] ?? "";
    else if (token === "--authorized-operator-arn") options.authorizedOperatorArn = argv[++index] ?? "";
    else if (token === "--access-key-id") options.accessKeyId = argv[++index] ?? "";
    else if (token === "--secret-access-key") options.secretAccessKey = argv[++index] ?? "";
    else if (token === "--session-token") options.sessionToken = argv[++index] ?? "";
    else if (token === "--credential-expiration-iso") options.credentialExpirationIso = argv[++index] ?? "";
    else if (token === "--request-body-text") options.requestBodyText = argv[++index] ?? "";
    else if (token === "--request-body-file") options.requestBodyFile = argv[++index] ?? "";
    else if (token === "--max-attempts") options.maxAttempts = Number.parseInt(argv[++index] ?? "NaN", 10);
    else if (token === "--retry-mode") options.retryMode = argv[++index] ?? "";
    else if (token === "--invocation-command-line") options.invocationCommandLine = argv[++index] ?? "";
    else if (token === "--expected-account-id") options.expectedAccountId = argv[++index] ?? "";
    else if (token === "--expected-region") options.expectedRegion = argv[++index] ?? "";
    else if (token === "--expected-service") options.expectedService = argv[++index] ?? "";
    else if (token === "--expected-function-url-host") options.expectedFunctionUrlHost = argv[++index] ?? "";
    else if (token === "--expected-dedicated-operator-role-arn") options.expectedDedicatedOperatorRoleArn = argv[++index] ?? "";
    else throw new Error(`Unknown argument: ${token}`);
  }

  if (!options.functionUrl) throw new Error("--function-url is required.");
  if (!options.operatorCallerArn) throw new Error("--operator-caller-arn is required.");
  if (!options.authorizedOperatorArn) throw new Error("--authorized-operator-arn is required.");
  if (!options.accessKeyId) throw new Error("--access-key-id is required.");
  if (!options.secretAccessKey) throw new Error("--secret-access-key is required.");
  if (!options.sessionToken) throw new Error("--session-token is required.");
  if (options.requestBodyFile) {
    options.requestBodyText = readFileSync(options.requestBodyFile, "utf8");
  }
  if (!options.requestBodyText) throw new Error("--request-body-text or --request-body-file is required.");

  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = validateOfflineInvocationPreflight(options);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  const code = typeof error?.code === "string" ? error.code : "SIGV4_PREFLIGHT_FAILED";
  const message = typeof error?.message === "string" && error.message.length > 0 ? error.message : "SigV4 preflight failed.";
  process.stderr.write(`${JSON.stringify({ status: "FAIL", code, message })}\n`);
  process.exitCode = 1;
}
