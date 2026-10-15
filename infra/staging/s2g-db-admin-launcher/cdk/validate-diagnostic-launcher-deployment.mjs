import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
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
  validateLauncherTemplateGuards,
  validatePackagingOnlyAssetEvidence,
  validatePackagingOnlyChangeSetScope,
  validateStackIdentity,
  validateStackStateForMode,
  validateUpdateChangeSetParameters,
  validateUpdateChangeSetScope,
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
    expectedChangeSetArn: "",
    expectedActivationState: "DISABLED",
    expectedApprovedTaskArn: "arn:aws:ecs:us-west-2:452630323448:task-definition/genesis-staging-s2g-db-admin-diagnostic:1",
    expectedOperatorAssumerPrincipalArn: "arn:aws:iam::452630323448:role/aws-reserved/sso.amazonaws.com/us-west-2/AWSReservedSSO_GenesisS2GDiagOperator_bef639e26f419d49",
    expectedRepoSha: "",
    expectedCurrentCodeSha256: "",
    expectedProposedCodeSha256: "",
    expectedProposedZipSha256: "",
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
    else if (token === "--expected-change-set-arn") options.expectedChangeSetArn = argv[++index];
    else if (token === "--expected-activation-state") options.expectedActivationState = argv[++index];
    else if (token === "--expected-approved-task-arn") options.expectedApprovedTaskArn = argv[++index];
    else if (token === "--expected-operator-assumer-principal-arn") options.expectedOperatorAssumerPrincipalArn = argv[++index];
    else if (token === "--expected-repo-sha") options.expectedRepoSha = argv[++index];
    else if (token === "--expected-current-code-sha256") options.expectedCurrentCodeSha256 = argv[++index];
    else if (token === "--expected-proposed-code-sha256") options.expectedProposedCodeSha256 = argv[++index];
    else if (token === "--expected-proposed-zip-sha256") options.expectedProposedZipSha256 = argv[++index];
    else if (token === "--allow-rollback-complete") options.allowRollbackComplete = true;
    else throw new Error(`Unknown option: ${token}`);
  }
  if (!["create", "update", "update-packaging"].includes(options.mode)) {
    throw new Error("Unknown mode. Use --mode create, --mode update, or --mode update-packaging.");
  }
  if ((options.mode === "update" || options.mode === "update-packaging") && !options.changeSetName) {
    throw new Error("--change-set-name is required in update mode.");
  }
  if (!options.expectedChangeSetArn) options.expectedChangeSetArn = options.changeSetName;
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

function runGitHeadSha() {
  const output = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return String(output).trim();
}

async function synthArtifacts(stackName) {
  const outDir = await mkdtemp(resolve(process.cwd(), ".tmp-s2g-db-admin-launcher-"));
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
    services.push(item ?? {
      serviceName, status: "MISSING", desiredCount: 0, runningCount: 0, pendingCount: 0, deployments: [],
    });
  }
  return services;
}

function gatherRelativeImports(source) {
  const imports = [];
  const importRegex = /^\s*import(?:\s+[^'"]+?\s+from\s+)?["']([^"']+)["'];?$/gm;
  const exportRegex = /^\s*export\s+[^'"]+?\s+from\s+["']([^"']+)["'];?$/gm;
  let match;
  while ((match = importRegex.exec(source)) !== null) imports.push(match[1]);
  while ((match = exportRegex.exec(source)) !== null) imports.push(match[1]);
  return imports.filter((specifier) => specifier.startsWith(".") || specifier.startsWith("/"));
}

async function listFilesRecursive(root) {
  const files = [];
  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = resolve(current, entry.name);
      if (entry.isDirectory()) await walk(absolute);
      else files.push(absolute.slice(root.length + 1).replace(/\\/g, "/"));
    }
  }
  await walk(root);
  return files.sort();
}

async function collectPackagingAssetEvidence(artifacts) {
  const lambdaAsset = extractLauncherLambdaAsset({
    template: artifacts.template,
    assetManifest: artifacts.assetManifest,
  });
  if (!lambdaAsset.sourcePath) {
    throw new Error("DEPLOYMENT_PREFLIGHT_PACKAGING_SOURCE_PATH_MISSING");
  }
  const sourcePath = resolve(artifacts.outDir, lambdaAsset.sourcePath);
  const packageFiles = await listFilesRecursive(sourcePath);
  const missingLocalImports = [];
  const absoluteImports = [];
  const queue = ["diagnostic-launcher-lambda.mjs"];
  const visited = new Set();
  while (queue.length > 0) {
    const current = queue.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const source = await readFile(resolve(sourcePath, current), "utf8");
    const imports = gatherRelativeImports(source);
    for (const specifier of imports) {
      if (specifier.startsWith("/")) {
        absoluteImports.push({ file: current, specifier });
        continue;
      }
      const resolved = resolve(resolve(sourcePath, current), "..", specifier)
        .slice(sourcePath.length + 1)
        .replace(/\\/g, "/");
      if (!packageFiles.includes(resolved)) {
        missingLocalImports.push({ file: current, specifier, resolved });
      } else if (resolved.endsWith(".mjs")) {
        queue.push(resolved);
      }
    }
  }

  let handlerImportStatus = "ok";
  try {
    const moduleUrl = `${pathToFileURL(resolve(sourcePath, "diagnostic-launcher-lambda.mjs")).href}?t=${Date.now()}`;
    const loaded = await import(moduleUrl);
    if (typeof loaded.handler !== "function") handlerImportStatus = "missing-handler";
  } catch (error) {
    handlerImportStatus = `error:${error?.code ?? "unknown"}`;
  }

  const zipPath = resolve(artifacts.outDir, "launcher-asset-validation.zip");
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `if(Test-Path '${zipPath.replace(/'/g, "''")}'){Remove-Item '${zipPath.replace(/'/g, "''")}' -Force}; Compress-Archive -Path '${sourcePath.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -CompressionLevel Optimal`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const zipBytes = await readFile(zipPath);
  const zipSha256Hex = createHash("sha256").update(zipBytes).digest("hex");
  const proposedCodeSha256 = createHash("sha256").update(zipBytes).digest("base64");
  return {
    packageFiles,
    missingLocalImports,
    absoluteImports,
    handlerImportStatus,
    zipSha256Hex,
    proposedCodeSha256,
  };
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

    if (options.expectedRepoSha) {
      const currentSha = runGitHeadSha();
      if (currentSha !== options.expectedRepoSha) {
        throw new Error(`DEPLOYMENT_PREFLIGHT_REPO_SHA_MISMATCH:${currentSha}`);
      }
    }

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
        mode: options.mode,
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
      validateUpdateChangeSetParameters({
        expectedChangeSetArn: options.expectedChangeSetArn,
        changeSetArn: changeSetResult.data?.ChangeSetId ?? "",
        changeSetParameters: changeSetResult.data?.Parameters ?? [],
        deployedStackParameters: stack?.Parameters ?? [],
        expectedOperatorAssumerPrincipalArn: options.expectedOperatorAssumerPrincipalArn,
      });
      validateUpdateChangeSetScope(changeSetResult.data, {
        expectedStackName: options.stackName,
        allowedLogicalIds: [
          "DbAdminDiagnosticLauncherEnabledPolicy21B6A083",
          "DbAdminDiagnosticLauncherFunction4A98B30B",
          "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4",
          "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C",
        ],
        expectedResourceChanges: [
          { logicalResourceId: "DbAdminDiagnosticLauncherEnabledPolicy21B6A083", action: "Add" },
          { logicalResourceId: "DbAdminDiagnosticLauncherFunction4A98B30B", action: "Modify", replacement: "False" },
          { logicalResourceId: "DbAdminDiagnosticLauncherFunctionFunctionUrlF0CCD3F4", action: "Modify", replacement: "Conditional" },
          { logicalResourceId: "StagingS2gDbAdminDiagnosticOperatorEnabledPolicy648A5B6C", action: "Add" },
        ],
      });
      changeSetSummary = {
        changeSetName: changeSetResult.data?.ChangeSetName ?? options.changeSetName,
        changeSetArn: changeSetResult.data?.ChangeSetId ?? "",
        status: changeSetResult.data?.Status ?? "UNKNOWN",
        executionStatus: changeSetResult.data?.ExecutionStatus ?? "UNKNOWN",
        type: changeSetResult.data?.ChangeSetType ?? "UNKNOWN",
        actionCount: Array.isArray(changeSetResult.data?.Changes) ? changeSetResult.data.Changes.length : 0,
      };
    } else if (options.mode === "update-packaging") {
      const configResult = runAwsJson(["lambda", "get-function-configuration", "--function-name", "GenesisStagingS2gDbAdminD-DbAdminDiagnosticLaunche-kMTHCJYmy24Q"], options);
      if (!configResult.ok) throw new Error("DEPLOYMENT_PREFLIGHT_LAMBDA_CONFIGURATION_READ_FAILED");
      if (options.expectedCurrentCodeSha256 && configResult.data?.CodeSha256 !== options.expectedCurrentCodeSha256) {
        throw new Error("DEPLOYMENT_PREFLIGHT_CURRENT_CODE_SHA_MISMATCH");
      }

      const changeSetResult = runAwsJson(["cloudformation", "describe-change-set", "--change-set-name", options.changeSetName], options);
      if (!changeSetResult.ok) throw new Error(`DEPLOYMENT_PREFLIGHT_CHANGE_SET_READ_FAILED:${options.changeSetName}`);
      validateUpdateChangeSetParameters({
        expectedChangeSetArn: options.expectedChangeSetArn,
        changeSetArn: changeSetResult.data?.ChangeSetId ?? "",
        changeSetParameters: changeSetResult.data?.Parameters ?? [],
        deployedStackParameters: stack?.Parameters ?? [],
        expectedOperatorAssumerPrincipalArn: options.expectedOperatorAssumerPrincipalArn,
        expectedProposedActivationState: "DISABLED",
      });
      validatePackagingOnlyChangeSetScope(changeSetResult.data, {
        expectedStackName: options.stackName,
      });

      const packagingEvidence = await collectPackagingAssetEvidence(artifacts);
      validatePackagingOnlyAssetEvidence({
        packageFiles: packagingEvidence.packageFiles,
        requiredFiles: [
          "diagnostic-launcher-lambda.mjs",
          "diagnostic-launcher-core.mjs",
          "s2g-db-admin-diagnostic-contract.mjs",
        ],
        missingLocalImports: packagingEvidence.missingLocalImports,
        absoluteImports: packagingEvidence.absoluteImports,
        handlerImportStatus: packagingEvidence.handlerImportStatus,
        zipSha256Hex: packagingEvidence.zipSha256Hex,
        expectedZipSha256Hex: options.expectedProposedZipSha256,
        proposedCodeSha256: packagingEvidence.proposedCodeSha256,
        expectedCodeSha256: options.expectedProposedCodeSha256,
      });

      changeSetSummary = {
        changeSetName: changeSetResult.data?.ChangeSetName ?? options.changeSetName,
        changeSetArn: changeSetResult.data?.ChangeSetId ?? "",
        status: changeSetResult.data?.Status ?? "UNKNOWN",
        executionStatus: changeSetResult.data?.ExecutionStatus ?? "UNKNOWN",
        type: changeSetResult.data?.ChangeSetType ?? "UNKNOWN",
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
