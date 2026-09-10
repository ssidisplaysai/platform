#!/usr/bin/env node
import { createHash } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const REQUIRED_ENVIRONMENT_NAMES = Object.freeze([
  "DATABASE_URL", "GENESIS_ENVIRONMENT", "GENESIS_DATABASE_CLASS",
  "GENESIS_ALLOW_PRODUCTION_WRITES", "GENESIS_PRODUCTION_WRITE_TOKEN",
  "GENESIS_SCRIPT_CLASS", "GLW_APP_URL", "GLW_N8N_PAGE_WEBHOOK_URL",
  "GLW_N8N_WEBHOOK_SECRET", "GLW_ADMIN_EMAIL", "GLW_ADMIN_PASSWORD",
  "GLW_AUTH_SECRET", "GLW_N8N_BASE_URL", "GLW_N8N_API_KEY",
  "GLW_PRODUCER_DATABASE_URL", "GLW_PRODUCER_WORKER_SYSTEM_TOKEN",
  "GLW_RECONCILIATION_SYSTEM_TOKEN", "GENESIS_WORDPRESS_COLLISION_AUTHORITY_KEY",
  "GLW_N8N_RESEARCH_WEBHOOK_URL", "GLW_N8N_RESEARCH_WEBHOOK_SECRET",
]);

function fail(message) { throw new Error(message); }
export function sha256Buffer(value) { return createHash("sha256").update(value).digest("hex").toUpperCase(); }
export function sha256File(path) { return sha256Buffer(readFileSync(path)); }

export function parseEnvironment(text) {
  const values = new Map();
  for (const rawLine of text.split(/\r?\n/u)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = rawLine.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) continue;
    const rawValue = match[2].trim();
    const value = rawValue.length >= 2 && rawValue.startsWith('"') && rawValue.endsWith('"') ? rawValue.slice(1, -1) : rawValue;
    if (values.has(match[1])) fail(`Duplicate environment name: ${match[1]}`);
    values.set(match[1], value);
  }
  return values;
}

export function environmentMetadata(values, requiredNames = REQUIRED_ENVIRONMENT_NAMES) {
  const metadata = {};
  for (const name of requiredNames) {
    const value = values.get(name);
    if (typeof value !== "string" || value.trim() === "") fail(`Required environment name is absent: ${name}`);
    metadata[name] = [value.length, sha256Buffer(Buffer.from(value, "utf8")).slice(0, 8)];
  }
  return metadata;
}

function portablePath(path) { return path.split(sep).join("/"); }

export function buildManifest({ releaseRoot, sourceSha, treeId, buildId, sourcePath, finalReleasePath, typecheckCertification = null, generatedAtUtc = new Date().toISOString() }) {
  const root = resolve(releaseRoot);
  const entries = [];
  let directoryCount = 0;
  let regularFileCount = 0;
  function visit(directory) {
    const children = readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const child of children) {
      const fullPath = join(directory, child.name);
      const relativePath = portablePath(relative(root, fullPath));
      const info = lstatSync(fullPath);
      if (info.isSymbolicLink()) fail(`Release contains a forbidden link: ${relativePath}`);
      if (info.isDirectory()) {
        directoryCount += 1;
        entries.push({ path: relativePath, logicalClass: "DERIVED_DIRECTORY", expectedObjectType: "DIRECTORY", hashPolicy: "NONE_OBJECT_TYPE_ONLY", linkPolicy: "NO_LINK_IN_RELEASE", expectedLength: null, expectedSha256: null });
        visit(fullPath);
      } else if (info.isFile()) {
        regularFileCount += 1;
        entries.push({ path: relativePath, logicalClass: "DERIVED_REGULAR_FILE", expectedObjectType: "REGULAR_FILE", hashPolicy: "SHA256_AND_LENGTH", linkPolicy: "NO_LINK", expectedLength: info.size, expectedSha256: sha256File(fullPath) });
      } else fail(`Unsupported release object: ${relativePath}`);
    }
  }
  visit(root);
  return {
    schemaVersion: "genesis.glw.immutable-release-manifest/v2",
    gprCert: "GLW_RESEARCH_PROVIDER_SECURITY_GATE_V1",
    contractVersion: "genesis.glw.immutable-release/v2",
    generatedAtUtc,
    canonicalIdentity: { sourceSha, treeId, buildId }, sourcePath, releasePath: finalReleasePath,
    ...(typecheckCertification ? { typecheckCertification } : {}),
    objectTransformationRules: { gitlinkMode160000: "EMPTY_GITLINK_DIRECTORY", approvedJunctions: "INTERNALIZED_MATERIALIZED_DEPENDENCY_DIRECTORY", undeclaredLinks: "FORBIDDEN", externalLinksInRelease: "FORBIDDEN" },
    approvedJunctions: [],
    summary: { expectedObjectCount: entries.length, expectedDirectoryCount: directoryCount, expectedRegularFileCount: regularFileCount, sourceRegularFileCount: null, artifactRegularFileCount: null, dependencyRegularFileCount: null, materializedRegularFileCount: null },
    entries,
  };
}

export function verifyManifest(releaseRoot, manifest) {
  const rebuilt = buildManifest({ releaseRoot, sourceSha: manifest.canonicalIdentity.sourceSha, treeId: manifest.canonicalIdentity.treeId, buildId: manifest.canonicalIdentity.buildId, sourcePath: manifest.sourcePath, finalReleasePath: manifest.releasePath, typecheckCertification: manifest.typecheckCertification, generatedAtUtc: manifest.generatedAtUtc });
  if (JSON.stringify(manifest.entries) !== JSON.stringify(rebuilt.entries)) fail("Complete immutable release verification did not pass.");
  return rebuilt.summary;
}

function replaceAssignment(text, name, value) {
  const pattern = new RegExp(`^\\$${name}\\s*=.*$`, "mu");
  if (!pattern.test(text)) fail(`Launcher assignment is missing: ${name}`);
  if (typeof value !== "string" || /["`\r\n]/u.test(value)) fail(`Launcher assignment is unsafe: ${name}`);
  return text.replace(pattern, `$${name} = "${value}"`);
}

export function renderLauncher({ template, assignments, environment }) {
  let result = template;
  for (const [name, value] of Object.entries(assignments)) result = replaceAssignment(result, name, value);
  const blockPattern = /^\$ExpectedEnvironment\s*=\s*\[ordered\]@\{[\s\S]*?^\}/mu;
  if (!blockPattern.test(result)) fail("Launcher expected-environment block is missing.");
  const lines = Object.entries(environment).map(([name, [length, fingerprint]]) => `  ${name} = @(${length}, "${fingerprint}")`);
  return result.replace(blockPattern, `$ExpectedEnvironment = [ordered]@{\n${lines.join("\n")}\n}`);
}

export function commandInvocation(command, args, platform = process.platform, commandShell = process.env.ComSpec) {
  if (platform === "win32" && command.toLowerCase().endsWith(".cmd")) {
    return { command: commandShell || "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  }
  return { command, args };
}
export function parseTypecheckDiagnostics(output) {
  return output.split(/\r?\n/u).flatMap((line) => {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/u);
    return match ? [{ file: portablePath(match[1]), line: Number(match[2]), column: Number(match[3]), code: match[4], message: match[5] }] : [];
  }).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), "en"));
}
export function typecheckBaselineFingerprint(baseline) {
  return sha256Buffer(Buffer.from(JSON.stringify({ schemaVersion: baseline.schemaVersion, certifiedSourceSha: baseline.certifiedSourceSha, command: baseline.command, expectedExitCode: baseline.expectedExitCode, sourceBlobs: baseline.sourceBlobs, diagnostics: baseline.diagnostics }), "utf8"));
}
export function certifyTypecheckBaseline({ output, exitCode, baseline, sourceBlobResolver }) {
  if (baseline.schemaVersion !== "genesis.glw.typecheck-baseline/v1") fail("Typecheck baseline schema is unsupported.");
  if (!/^[0-9a-f]{40}$/u.test(baseline.certifiedSourceSha)) fail("Typecheck baseline source SHA is invalid.");
  if (baseline.command !== "npm run typecheck:production") fail("Typecheck baseline command is invalid.");
  if (!Number.isInteger(baseline.expectedExitCode) || baseline.expectedExitCode === 0) fail("Typecheck baseline exit code must be a nonzero integer.");
  if (!Array.isArray(baseline.diagnostics) || baseline.diagnostics.length === 0) fail("Typecheck baseline diagnostics are missing.");
  if (!baseline.sourceBlobs || typeof baseline.sourceBlobs !== "object" || Array.isArray(baseline.sourceBlobs)) fail("Typecheck baseline source blobs are missing.");
  const diagnosticFiles = [...new Set(baseline.diagnostics.map((diagnostic) => diagnostic.file))].sort();
  const sourceFiles = Object.keys(baseline.sourceBlobs).sort();
  if (JSON.stringify(diagnosticFiles) !== JSON.stringify(sourceFiles)) fail("Typecheck baseline source coverage is incomplete.");
  if (sourceFiles.some((path) => path.startsWith("/") || path.includes("..") || !/^[0-9a-f]{40}$/u.test(baseline.sourceBlobs[path]))) fail("Typecheck baseline source identity is invalid.");
  if (exitCode !== baseline.expectedExitCode) fail(`Typecheck exit code changed: expected ${baseline.expectedExitCode}, found ${exitCode}.`);
  const actualDiagnostics = parseTypecheckDiagnostics(output);
  const expectedDiagnostics = [...baseline.diagnostics].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), "en"));
  if (JSON.stringify(actualDiagnostics) !== JSON.stringify(expectedDiagnostics)) fail("Production typecheck diagnostics differ from the certified baseline.");
  for (const [path, expectedBlob] of Object.entries(baseline.sourceBlobs)) {
    const actualBlob = sourceBlobResolver(path);
    if (actualBlob !== expectedBlob) fail(`Typecheck baseline source changed: ${path}.`);
  }
  const fingerprint = typecheckBaselineFingerprint({ ...baseline, diagnostics: expectedDiagnostics });
  if (baseline.fingerprint !== fingerprint) fail("Typecheck baseline fingerprint is invalid.");
  return { policy: "EXACT_DIAGNOSTIC_AND_SOURCE_BLOB_FAIL_ON_DRIFT", baselineSchemaVersion: baseline.schemaVersion, baselineFingerprint: fingerprint, diagnosticCount: actualDiagnostics.length, expectedExitCode: baseline.expectedExitCode, sourceBlobs: baseline.sourceBlobs };
}
function run(command, args, cwd) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, { cwd, stdio: "inherit", shell: false });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} failed with exit code ${result.status}`);
}
function runTypecheckWithBaseline(cwd, repository, commit, baselinePath) {
  const invocation = commandInvocation("npm.cmd", ["run", "typecheck:production"]);
  const result = spawnSync(invocation.command, invocation.args, { cwd, encoding: "utf8", shell: false });
  if (result.error) fail(`npm.cmd could not start: ${result.error.message}`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  if (baseline.certifiedSourceSha !== commit) fail("Typecheck baseline is not certified for the requested source commit.");
  return certifyTypecheckBaseline({ output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`, exitCode: result.status, baseline, sourceBlobResolver: (path) => capture("git", ["rev-parse", `${commit}:${path}`], repository) });
}
function capture(command, args, cwd) { const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false }); if (result.status !== 0) fail(result.stderr?.trim() || `${command} failed`); return result.stdout.trim(); }
function parseArgs(argv) { const options = {}; for (let i = 0; i < argv.length; i += 2) { if (!argv[i]?.startsWith("--") || argv[i + 1] === undefined) fail(`Invalid argument: ${argv[i] ?? ""}`); options[argv[i].slice(2)] = argv[i + 1]; } return options; }

export function prepare(options) {
  const repository = resolve(options.repo); const stageRoot = resolve(options.stage); const environmentPath = resolve(options.environment); const launcherTemplatePath = resolve(options.launcher); const typecheckBaselinePath = options["typecheck-baseline"] ? resolve(options["typecheck-baseline"]) : null; const commit = options.commit; const tag = options.tag ?? "glw-research-security-v1";
  if (!/^[0-9a-f]{40}$/u.test(commit)) fail("Commit must be an exact lowercase 40-character SHA.");
  if (!/^[A-Za-z0-9._-]+$/u.test(tag)) fail("Release tag contains invalid characters.");
  if (existsSync(stageRoot)) fail(`Stage path already exists: ${stageRoot}`);
  if (!existsSync(environmentPath)) fail("Protected environment file is missing.");
  if (!existsSync(launcherTemplatePath)) fail("Launcher template is missing.");
  if (typecheckBaselinePath && !existsSync(typecheckBaselinePath)) fail("Typecheck baseline file is missing.");
  if (capture("git", ["rev-parse", `${commit}^{commit}`], repository) !== commit) fail("Resolved source commit does not match the requested commit.");
  const sourcePath = join(stageRoot, "source"); const releasePath = join(stageRoot, "release"); mkdirSync(stageRoot, { recursive: false });
  try {
    run("git", ["worktree", "add", "--detach", sourcePath, commit], repository);
    run("npm.cmd", ["ci"], sourcePath);
    const typecheckCertification = typecheckBaselinePath ? runTypecheckWithBaseline(sourcePath, repository, commit, typecheckBaselinePath) : (run("npm.cmd", ["run", "typecheck:production"], sourcePath), { policy: "ZERO_DIAGNOSTICS", diagnosticCount: 0 });
    run("npm.cmd", ["run", "build"], sourcePath);
    cpSync(sourcePath, releasePath, { recursive: true, dereference: true, filter: (path) => basename(path) !== ".git" });
    const buildId = readFileSync(join(releasePath, ".next", "BUILD_ID"), "utf8").trim(); if (!/^[A-Za-z0-9_-]+$/u.test(buildId)) fail("Next build ID is missing or invalid.");
    const treeId = capture("git", ["rev-parse", `${commit}^{tree}`], repository);
    const finalReleasePath = `C:\\ProgramData\\Genesis\\GLW\\releases\\${commit}__${buildId}__${tag}`;
    const manifestPath = join(stageRoot, "GLW-Research-Security-Immutable-Release-Manifest.json");
    const finalManifestPath = `C:\\ProgramData\\Genesis\\GLW\\manifests\\GLW-Research-Security-${commit}-${buildId}.json`;
    const manifest = buildManifest({ releaseRoot: releasePath, sourceSha: commit, treeId, buildId, sourcePath, finalReleasePath, typecheckCertification });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"); verifyManifest(releasePath, manifest);
    const environment = environmentMetadata(parseEnvironment(readFileSync(environmentPath, "utf8"))); const manifestHash = sha256File(manifestPath);
    const launcher = renderLauncher({ template: readFileSync(launcherTemplatePath, "utf8"), assignments: { ReleasePath: finalReleasePath, ManifestPath: finalManifestPath, ExpectedSourceSha: commit, ExpectedTreeId: treeId, ExpectedBuildId: buildId, ExpectedManifestSha256: manifestHash, ExpectedEnvironmentSha256: sha256File(environmentPath), ExpectedPackageJsonSha256: sha256File(join(releasePath, "package.json")), ExpectedPackageLockSha256: sha256File(join(releasePath, "package-lock.json")) }, environment });
    const launcherPath = join(stageRoot, "Start-GenesisGlw.ps1.candidate"); writeFileSync(launcherPath, launcher, "utf8");
    const plan = { schemaVersion: "genesis.glw.immutable-release-plan/v1", productionMutationAuthorized: false, sourceSha: commit, treeId, buildId, stageRoot, stagedReleasePath: releasePath, finalReleasePath, stagedManifestPath: manifestPath, finalManifestPath, stagedLauncherPath: launcherPath, hashes: { manifestSha256: manifestHash, launcherSha256: sha256File(launcherPath), environmentSha256: sha256File(environmentPath), typecheckBaselineSha256: typecheckBaselinePath ? sha256File(typecheckBaselinePath) : null }, typecheckCertification, objectCounts: manifest.summary };
    writeFileSync(join(stageRoot, "release-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8"); return plan;
  } finally { if (existsSync(sourcePath)) run("git", ["worktree", "remove", "--force", sourcePath], repository); }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2); const options = parseArgs(rest);
  if (command === "prepare") { process.stdout.write(`${JSON.stringify(prepare(options), null, 2)}\n`); return; }
  if (command === "install") {
    const defaults = { environment: "C:\\ProgramData\\Genesis\\GLW\\config\\production.env", launcher: "C:\\ProgramData\\Genesis\\GLW\\bin\\Start-GenesisGlw.ps1", "evidence-root": "C:\\ProgramData\\Genesis\\GLW\\evidence\\installations", "rollback-root": "C:\\ProgramData\\Genesis\\GLW\\rollback\\immutable-installer-v1", "release-root": "C:\\ProgramData\\Genesis\\GLW\\releases", "manifest-root": "C:\\ProgramData\\Genesis\\GLW\\manifests" };
    Object.assign(options, Object.fromEntries(Object.entries(defaults).map(([name, value]) => [name, options[name] ?? value])));
    const required = ["stage", "repository", "persistence-root"];
    for (const name of required) if (!options[name]) fail(`Install option is required: --${name}.`);
    const [{ installPreparedRelease }, { createWindowsProductionAdapters }] = await Promise.all([import("./glw-immutable-installer.mjs"), import("./glw-immutable-installer-windows.mjs")]);
    const result = await installPreparedRelease({ stage: options.stage, environmentPath: options.environment, launcherPath: options.launcher, evidenceRoot: options["evidence-root"], rollbackRoot: options["rollback-root"], releaseRoot: options["release-root"], manifestRoot: options["manifest-root"], typecheckBaselinePath: options["typecheck-baseline"], sourceIdentityResolver: (sha) => ({ commit: capture("git", ["rev-parse", `${sha}^{commit}`], options.repository), tree: capture("git", ["rev-parse", `${sha}^{tree}`], options.repository) }), adapters: createWindowsProductionAdapters({ persistenceRoot: options["persistence-root"] }) });
    process.stdout.write(`${JSON.stringify({ state: result.state, sourceSha: result.prepared.plan.sourceSha, buildId: result.prepared.plan.buildId, evidencePath: result.evidencePath ?? null }, null, 2)}\n`); return;
  }
  fail("Command must be 'prepare' or 'install'.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { await main(); } catch (error) { process.stderr.write(`GLW_IMMUTABLE_RELEASE_FAILED: ${error.message}\n`); process.exitCode = 1; } }
