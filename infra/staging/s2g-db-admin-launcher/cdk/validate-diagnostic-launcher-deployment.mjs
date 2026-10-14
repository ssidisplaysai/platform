import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { App } from "aws-cdk-lib";
import { createStagingS2gDbAdminLauncherStack } from "./staging-s2g-db-admin-launcher-stack.mjs";
import {
  DEPLOYMENT_PREFLIGHT_CONSTANTS,
  evaluateProtectedServiceHealth,
  evaluateRecoverySafety,
  extractLauncherLambdaAsset,
  normalizeStackStatus,
  validateActivationState,
  validateCallerIdentity,
  validateStackIdentity,
  validateStackStateForMode,
  validateUpdateChangeSetScope,
  validateLauncherTemplateGuards,
} from "./deployment-preflight-core.mjs";

function parseArgs(argv) {
  const options = {
    profile: "genesis-production",
    region: "us-west-2",
    accountId: "452630323448",
    stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    snapshotStackName: "GenesisStagingSnapshotExportStack",
    mode: "create",
    changeSetName: "",
    expectedActivationState: "DISABLED",
    expectedApprovedTaskArn: "",
    allowRollbackComplete: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--profile") options.profile = argv[++index];
    else if (token === "--region") options.region = argv[++index];
    else if (token === "--account-id") options.accountId = argv[++index];
    else if (token === "--stack-name") options.stackName = argv[++index];
    else if (token === "--snapshot-stack-name") options.snapshotStackName = argv[++index];
    else if (token === "--mode") options.mode = argv[++index];
    else if (token === "--change-set-name") options.changeSetName = argv[++index];
    else if (token === "--expected-activation-state") options.expectedActivationState = argv[++index];
    else if (token === "--expected-approved-task-arn") options.expectedApprovedTaskArn = argv[++index];
    else if (token === "--allow-rollback-complete") options.allowRollbackComplete = true;
    else throw new Error(`Unknown option: ${token}`);
  }
  if (options.mode !== "create" && options.mode !== "update") {
    throw new Error("Unknown mode. Use --mode create or --mode update.");
  }
  if (options.mode === "update" && !options.changeSetName) {
    throw new Error("--change-set-name is required in update mode.");
  }
  return options;
}

function parseJson(value) {
  return JSON.parse(String(value).replace(/^\uFEFF/, ""));
}

function runAwsJson(args, { region, profile }) {
  const base = ["--region", region, "--profile", profile, ...args, "--output", "json"];
  try {
    const output = execFileSync("aws", base, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, data: parseJson(output) };
  } catch (error) {
    const message = String(error.stderr || error.stdout || error.message || "");
    return { ok: false, message };
  }
}

async function synthArtifacts(stackName) {
  const outDir = await mkdtemp(join(tmpdir(), "s2g-db-admin-launcher-"));
  const app = new App({ outdir: outDir });
  createStagingS2gDbAdminLauncherStack(app, stackName);
  app.synth();
  const templatePath = resolve(outDir, `${stackName}.template.json`);
  const manifestPath = resolve(outDir, "manifest.json");
  const assetManifestPath = resolve(outDir, `${stackName}.assets.json`);
  const template = parseJson(await readFile(templatePath, "utf8"));
  const manifest = parseJson(await readFile(manifestPath, "utf8"));
  const assetManifest = parseJson(await readFile(assetManifestPath, "utf8"));
  return {
    outDir,
    templatePath,
    manifestPath,
    assetManifestPath,
    template,
    manifest,
    assetManifest,
  };
}

function bucketName(accountId, region) {
  return `cdk-hnb659fds-assets-${accountId}-${region}`;
}

function getParameterValue(stack, parameterKey) {
  return stack?.Parameters?.find((item) => item.ParameterKey === parameterKey)?.ParameterValue ?? "";
}

function describeProtectedServices(options) {
  const services = [];
  for (const serviceName of DEPLOYMENT_PREFLIGHT_CONSTANTS.PROTECTED_ECS_SERVICES) {
    const result = runAwsJson([
      "ecs",
      "describe-services",
      "--cluster",
      "arn:aws:ecs:us-west-2:452630323448:cluster/genesis-production",
      "--services",
      serviceName,
    ], options);
    if (!result.ok) throw new Error(`DEPLOYMENT_PREFLIGHT_PROTECTED_SERVICES_READ_FAILED:${serviceName}`);
    const item = result.data?.services?.[0];
    services.push(item ?? { serviceName, status: "MISSING", desiredCount: 0, runningCount: 0, pendingCount: 0, deployments: [] });
  }
  return services;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const artifacts = await synthArtifacts(options.stackName);
  try {
    validateLauncherTemplateGuards(artifacts.template);
    const lambdaAsset = extractLauncherLambdaAsset({
      template: artifacts.template,
      assetManifest: artifacts.assetManifest,
    });

    const identityResult = runAwsJson(["sts", "get-caller-identity"], options);
    if (!identityResult.ok) throw new Error(`DEPLOYMENT_PREFLIGHT_STS_FAILED:${identityResult.message}`);
    validateCallerIdentity(identityResult.data, options.accountId);

    const stackResult = runAwsJson(["cloudformation", "describe-stacks", "--stack-name", options.stackName], options);
    const stackStatus = stackResult.ok ? normalizeStackStatus(stackResult.data?.Stacks?.[0]?.StackStatus) : "STACK_ABSENT";
    const stack = stackResult.ok ? stackResult.data?.Stacks?.[0] : null;

    const tableResult = runAwsJson(["dynamodb", "describe-table", "--table-name", DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_TABLE_NAME], options);
    const retainedTableExists = tableResult.ok;

    if (options.mode === "create") {
      evaluateRecoverySafety({
        stackName: options.stackName,
        stackStatus,
        retainedTableExists,
        allowRollbackComplete: options.allowRollbackComplete,
      });
    } else {
      validateStackStateForMode({
        stackName: options.stackName,
        stackStatus,
        retainedTableExists,
        mode: "update",
      });
      validateStackIdentity(stack, options.stackName);
      validateActivationState({
        launcherActivationState: getParameterValue(stack, "LauncherActivationState"),
        approvedDiagnosticTaskDefinitionArn: getParameterValue(stack, "ApprovedDiagnosticTaskDefinitionArn"),
        expectedActivationState: options.expectedActivationState,
        expectedApprovedTaskArn: options.expectedApprovedTaskArn,
      });
    }

    const assetBucket = bucketName(options.accountId, options.region);
    const objectResult = runAwsJson([
      "s3api",
      "head-object",
      "--bucket",
      assetBucket,
      "--key",
      lambdaAsset.templateKey,
    ], options);
    if (!objectResult.ok) throw new Error(`DEPLOYMENT_PREFLIGHT_ASSET_MISSING:${assetBucket}/${lambdaAsset.templateKey}`);

    const snapshotResult = runAwsJson(["cloudformation", "describe-stacks", "--stack-name", options.snapshotStackName], options);
    if (!snapshotResult.ok) throw new Error(`DEPLOYMENT_PREFLIGHT_SNAPSHOT_STACK_READ_FAILED:${options.snapshotStackName}`);
    const snapshotStack = snapshotResult.data?.Stacks?.[0];
    const brokerState = snapshotStack?.Parameters?.find((item) => item.ParameterKey === "BrokerActivationState")?.ParameterValue ?? "UNKNOWN";
    if (brokerState !== "DISABLED") throw new Error(`DEPLOYMENT_PREFLIGHT_SNAPSHOT_BROKER_NOT_DISABLED:${brokerState}`);

    const protectedServices = describeProtectedServices(options);
    evaluateProtectedServiceHealth(protectedServices);

    let changeSetSummary = null;
    if (options.mode === "update") {
      const changeSetResult = runAwsJson(["cloudformation", "describe-change-set", "--change-set-name", options.changeSetName], options);
      if (!changeSetResult.ok) throw new Error(`DEPLOYMENT_PREFLIGHT_CHANGE_SET_READ_FAILED:${options.changeSetName}`);
      validateUpdateChangeSetScope(changeSetResult.data, {
        expectedStackName: options.stackName,
        allowedLogicalIds: [
          "DbAdminDiagnosticLauncherFunction4A98B30B",
          "DbAdminDiagnosticLauncherEnabledPolicy21B6A083",
          "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C",
        ],
      });
      changeSetSummary = {
        changeSetName: changeSetResult.data?.ChangeSetName ?? options.changeSetName,
        status: changeSetResult.data?.Status ?? "UNKNOWN",
        executionStatus: changeSetResult.data?.ExecutionStatus ?? "UNKNOWN",
        actionCount: Array.isArray(changeSetResult.data?.Changes) ? changeSetResult.data.Changes.length : 0,
      };
    }

    const summary = {
      status: "PASS",
      mode: options.mode,
      stackName: options.stackName,
      profile: options.profile,
      region: options.region,
      accountId: options.accountId,
      stackStatus,
      retainedTableExists,
      assetBucket,
      lambdaAssetKey: lambdaAsset.templateKey,
      lambdaAssetSourcePath: lambdaAsset.sourcePath,
      synthesizedTemplatePath: artifacts.templatePath,
      synthesizedAssetManifestPath: artifacts.assetManifestPath,
      snapshotStackName: options.snapshotStackName,
      snapshotBrokerActivationState: brokerState,
      expectedActivationState: options.expectedActivationState,
      expectedApprovedTaskArn: options.expectedApprovedTaskArn,
      protectedServices: DEPLOYMENT_PREFLIGHT_CONSTANTS.PROTECTED_ECS_SERVICES,
      changeSet: changeSetSummary,
      callerArn: identityResult.data.Arn,
    };
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await rm(artifacts.outDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const code = typeof error?.code === "string" ? error.code : "DEPLOYMENT_PREFLIGHT_FAILED";
  const message = typeof error?.message === "string" ? error.message : "Unknown preflight failure";
  console.error(JSON.stringify({ status: "FAIL", code, message }, null, 2));
  process.exit(1);
});
