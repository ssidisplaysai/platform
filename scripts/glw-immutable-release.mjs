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

export function buildManifest({ releaseRoot, sourceSha, treeId, buildId, sourcePath, finalReleasePath, generatedAtUtc = new Date().toISOString() }) {
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
    objectTransformationRules: { gitlinkMode160000: "EMPTY_GITLINK_DIRECTORY", approvedJunctions: "INTERNALIZED_MATERIALIZED_DEPENDENCY_DIRECTORY", undeclaredLinks: "FORBIDDEN", externalLinksInRelease: "FORBIDDEN" },
    approvedJunctions: [],
    summary: { expectedObjectCount: entries.length, expectedDirectoryCount: directoryCount, expectedRegularFileCount: regularFileCount, sourceRegularFileCount: null, artifactRegularFileCount: null, dependencyRegularFileCount: null, materializedRegularFileCount: null },
    entries,
  };
}

export function verifyManifest(releaseRoot, manifest) {
  const rebuilt = buildManifest({ releaseRoot, sourceSha: manifest.canonicalIdentity.sourceSha, treeId: manifest.canonicalIdentity.treeId, buildId: manifest.canonicalIdentity.buildId, sourcePath: manifest.sourcePath, finalReleasePath: manifest.releasePath, generatedAtUtc: manifest.generatedAtUtc });
  if (JSON.stringify(manifest.entries) !== JSON.stringify(rebuilt.entries)) fail("Complete immutable release verification did not pass.");
  return rebuilt.summary;
}

function replaceAssignment(text, name, value) {
  const pattern = new RegExp(`^\\$${name}\\s*=.*$`, "mu");
  if (!pattern.test(text)) fail(`Launcher assignment is missing: ${name}`);
  return text.replace(pattern, `$${name} = "${value.replaceAll('"', '`"')}"`);
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
function run(command, args, cwd) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, { cwd, stdio: "inherit", shell: false });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} failed with exit code ${result.status}`);
}
function capture(command, args, cwd) { const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false }); if (result.status !== 0) fail(result.stderr?.trim() || `${command} failed`); return result.stdout.trim(); }
function parseArgs(argv) { const options = {}; for (let i = 0; i < argv.length; i += 2) { if (!argv[i]?.startsWith("--") || argv[i + 1] === undefined) fail(`Invalid argument: ${argv[i] ?? ""}`); options[argv[i].slice(2)] = argv[i + 1]; } return options; }

export function prepare(options) {
  const repository = resolve(options.repo); const stageRoot = resolve(options.stage); const environmentPath = resolve(options.environment); const launcherTemplatePath = resolve(options.launcher); const commit = options.commit; const tag = options.tag ?? "glw-research-security-v1";
  if (!/^[0-9a-f]{40}$/u.test(commit)) fail("Commit must be an exact lowercase 40-character SHA.");
  if (existsSync(stageRoot)) fail(`Stage path already exists: ${stageRoot}`);
  if (!existsSync(environmentPath)) fail("Protected environment file is missing.");
  if (!existsSync(launcherTemplatePath)) fail("Launcher template is missing.");
  if (capture("git", ["rev-parse", `${commit}^{commit}`], repository) !== commit) fail("Resolved source commit does not match the requested commit.");
  const sourcePath = join(stageRoot, "source"); const releasePath = join(stageRoot, "release"); mkdirSync(stageRoot, { recursive: false });
  try {
    run("git", ["worktree", "add", "--detach", sourcePath, commit], repository);
    run("npm.cmd", ["ci"], sourcePath); run("npm.cmd", ["run", "typecheck:production"], sourcePath); run("npm.cmd", ["run", "build"], sourcePath);
    cpSync(sourcePath, releasePath, { recursive: true, dereference: true, filter: (path) => basename(path) !== ".git" });
    const buildId = readFileSync(join(releasePath, ".next", "BUILD_ID"), "utf8").trim(); if (!buildId) fail("Next build ID is missing.");
    const treeId = capture("git", ["rev-parse", `${commit}^{tree}`], repository);
    const finalReleasePath = `C:\\ProgramData\\Genesis\\GLW\\releases\\${commit}__${buildId}__${tag}`;
    const manifestPath = join(stageRoot, "GLW-Research-Security-Immutable-Release-Manifest.json");
    const finalManifestPath = `C:\\ProgramData\\Genesis\\GLW\\manifests\\GLW-Research-Security-${commit}-${buildId}.json`;
    const manifest = buildManifest({ releaseRoot: releasePath, sourceSha: commit, treeId, buildId, sourcePath, finalReleasePath });
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"); verifyManifest(releasePath, manifest);
    const environment = environmentMetadata(parseEnvironment(readFileSync(environmentPath, "utf8"))); const manifestHash = sha256File(manifestPath);
    const launcher = renderLauncher({ template: readFileSync(launcherTemplatePath, "utf8"), assignments: { ReleasePath: finalReleasePath, ManifestPath: finalManifestPath, ExpectedSourceSha: commit, ExpectedTreeId: treeId, ExpectedBuildId: buildId, ExpectedManifestSha256: manifestHash, ExpectedEnvironmentSha256: sha256File(environmentPath), ExpectedPackageJsonSha256: sha256File(join(releasePath, "package.json")), ExpectedPackageLockSha256: sha256File(join(releasePath, "package-lock.json")) }, environment });
    const launcherPath = join(stageRoot, "Start-GenesisGlw.ps1.candidate"); writeFileSync(launcherPath, launcher, "utf8");
    const plan = { schemaVersion: "genesis.glw.immutable-release-plan/v1", productionMutationAuthorized: false, sourceSha: commit, treeId, buildId, stageRoot, stagedReleasePath: releasePath, finalReleasePath, stagedManifestPath: manifestPath, finalManifestPath, stagedLauncherPath: launcherPath, hashes: { manifestSha256: manifestHash, launcherSha256: sha256File(launcherPath), environmentSha256: sha256File(environmentPath) }, objectCounts: manifest.summary };
    writeFileSync(join(stageRoot, "release-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8"); return plan;
  } finally { if (existsSync(sourcePath)) run("git", ["worktree", "remove", "--force", sourcePath], repository); }
}

function main() { const [command, ...rest] = process.argv.slice(2); if (command !== "prepare") fail("Only the non-production 'prepare' command is available in v1."); process.stdout.write(`${JSON.stringify(prepare(parseArgs(rest)), null, 2)}\n`); }
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { main(); } catch (error) { process.stderr.write(`GLW_IMMUTABLE_RELEASE_PREPARE_FAILED: ${error.message}\n`); process.exitCode = 1; } }
