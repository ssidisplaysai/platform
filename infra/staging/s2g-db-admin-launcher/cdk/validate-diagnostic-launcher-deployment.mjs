import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { App } from "aws-cdk-lib";
import { createStagingS2gDbAdminLauncherStack } from "./staging-s2g-db-admin-launcher-stack.mjs";
import {
  DEPLOYMENT_PREFLIGHT_CONSTANTS,
  evaluateRecoverySafety,
  extractLauncherLambdaAsset,
  normalizeStackStatus,
  validateCallerIdentity,
  validateLauncherTemplateGuards,
} from "./deployment-preflight-core.mjs";

function parseArgs(argv) {
  const options = {
    profile: "genesis-production",
    region: "us-west-2",
    accountId: "452630323448",
    stackName: DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_STACK_NAME,
    snapshotStackName: "GenesisStagingSnapshotExportStack",
    allowRollbackComplete: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--profile") options.profile = argv[++index];
    else if (token === "--region") options.region = argv[++index];
    else if (token === "--account-id") options.accountId = argv[++index];
    else if (token === "--stack-name") options.stackName = argv[++index];
    else if (token === "--snapshot-stack-name") options.snapshotStackName = argv[++index];
    else if (token === "--allow-rollback-complete") options.allowRollbackComplete = true;
    else throw new Error(`Unknown option: ${token}`);
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

    const tableResult = runAwsJson(["dynamodb", "describe-table", "--table-name", DEPLOYMENT_PREFLIGHT_CONSTANTS.REQUIRED_TABLE_NAME], options);
    const retainedTableExists = tableResult.ok;

    evaluateRecoverySafety({
      stackName: options.stackName,
      stackStatus,
      retainedTableExists,
      allowRollbackComplete: options.allowRollbackComplete,
    });

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

    const summary = {
      status: "PASS",
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
