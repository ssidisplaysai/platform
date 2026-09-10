import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";

const PLAN_SCHEMA = "genesis.glw.immutable-release-plan/v1";
const MANIFEST_SCHEMA = "genesis.glw.immutable-release-manifest/v2";
const EXACT_SHA = /^[0-9a-f]{40}$/u;
const EXACT_SHA256 = /^[0-9A-F]{64}$/u;

function fail(message) { throw new Error(message); }
function portable(path) { return path.split(sep).join("/"); }
function sha256Buffer(value) { return createHash("sha256").update(value).digest("hex").toUpperCase(); }
function sha256File(path) { return sha256Buffer(readFileSync(path)); }
function samePath(left, right) { return normalize(resolve(left)).toLowerCase() === normalize(resolve(right)).toLowerCase(); }
function requireExact(value, expected, name) { if (value !== expected) fail(`${name} mismatch.`); }
function requireAbsolute(path, name) { if (typeof path !== "string" || !isAbsolute(path)) fail(`${name} must be absolute.`); return resolve(path); }
function stableProductionIdentity(snapshot) { return JSON.stringify({ pid: snapshot.pid, launcherPid: snapshot.launcherPid, sourceSha: snapshot.sourceSha, buildId: snapshot.buildId, releasePath: snapshot.releasePath, sidecarPid: snapshot.sidecarPid, sidecarHealthy: snapshot.sidecarHealthy, promotionEnabled: snapshot.promotionEnabled, persistence: snapshot.persistence }); }

export function inspectTree(root) {
  const entries = [];
  function visit(directory) {
    const children = readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, "en"));
    for (const child of children) {
      const path = join(directory, child.name); const info = lstatSync(path); const relativePath = portable(relative(root, path));
      if (info.isSymbolicLink() || info.isSocket() || info.isFIFO() || info.isBlockDevice() || info.isCharacterDevice()) fail(`Forbidden release object: ${relativePath}`);
      if (info.isDirectory()) { entries.push({ path: relativePath, type: "DIRECTORY", length: null, sha256: null }); visit(path); }
      else if (info.isFile()) entries.push({ path: relativePath, type: "REGULAR_FILE", length: info.size, sha256: sha256File(path) });
      else fail(`Unsupported release object: ${relativePath}`);
    }
  }
  visit(root); return entries;
}

export function verifyTree(root, manifest) {
  const actual = inspectTree(root);
  const expected = manifest.entries.map((entry) => ({ path: entry.path, type: entry.expectedObjectType, length: entry.expectedLength, sha256: entry.expectedSha256 }));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail("Complete immutable release verification failed.");
  const directories = actual.filter((entry) => entry.type === "DIRECTORY").length;
  const files = actual.length - directories;
  requireExact(actual.length, manifest.summary.expectedObjectCount, "Object count");
  requireExact(directories, manifest.summary.expectedDirectoryCount, "Directory count");
  requireExact(files, manifest.summary.expectedRegularFileCount, "Regular file count");
  return { objectCount: actual.length, directoryCount: directories, regularFileCount: files, reparsePointCount: 0 };
}

function launcherAssignment(text, name) {
  const match = text.match(new RegExp(`^\\$${name}\\s*=\\s*"([^"]+)"$`, "mu"));
  if (!match) fail(`Candidate launcher assignment is missing: ${name}`);
  return match[1];
}
function validateCurrentLauncherAuthority(text, before, environmentPath, environmentHash) {
  requireExact(samePath(launcherAssignment(text, "ReleasePath"), before.releasePath), true, "Current launcher release path");
  requireExact(samePath(launcherAssignment(text, "EnvironmentPath"), environmentPath), true, "Current launcher environment path");
  requireExact(launcherAssignment(text, "ExpectedSourceSha"), before.sourceSha, "Current launcher source SHA");
  requireExact(launcherAssignment(text, "ExpectedBuildId"), before.buildId, "Current launcher build ID");
  requireExact(launcherAssignment(text, "ExpectedEnvironmentSha256"), environmentHash, "Current launcher environment hash");
}

export function validatePreparedStage(stagePath, environmentPath, options = {}) {
  const stage = requireAbsolute(stagePath, "Stage path");
  const planPath = join(stage, "release-plan.json");
  if (!existsSync(planPath)) fail("Prepared release plan is missing.");
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  requireExact(plan.schemaVersion, PLAN_SCHEMA, "Release plan schema");
  requireExact(plan.productionMutationAuthorized, false, "Prepare mutation authority");
  if (!EXACT_SHA.test(plan.sourceSha) || !EXACT_SHA.test(plan.treeId)) fail("Prepared source identity is invalid.");
  if (typeof plan.buildId !== "string" || !plan.buildId || /[\\/]/u.test(plan.buildId)) fail("Prepared build ID is invalid.");
  requireExact(samePath(plan.stageRoot, stage), true, "Stage root");
  if (options.sourceIdentityResolver) {
    const source = options.sourceIdentityResolver(plan.sourceSha);
    requireExact(source.commit, plan.sourceSha, "Source commit"); requireExact(source.tree, plan.treeId, "Source tree");
  }
  const stagedReleasePath = requireAbsolute(plan.stagedReleasePath, "Staged release path");
  const stagedManifestPath = requireAbsolute(plan.stagedManifestPath, "Staged manifest path");
  const stagedLauncherPath = requireAbsolute(plan.stagedLauncherPath, "Staged launcher path");
  if (!samePath(stagedReleasePath, join(stage, "release")) || !samePath(stagedManifestPath, join(stage, "GLW-Research-Security-Immutable-Release-Manifest.json")) || !samePath(stagedLauncherPath, join(stage, "Start-GenesisGlw.ps1.candidate"))) fail("Prepared stage contains an external path.");
  for (const path of [stagedReleasePath, stagedManifestPath, stagedLauncherPath]) if (!existsSync(path)) fail(`Prepared artifact is missing: ${path}`);
  if (!EXACT_SHA256.test(plan.hashes.manifestSha256) || !EXACT_SHA256.test(plan.hashes.launcherSha256) || !EXACT_SHA256.test(plan.hashes.environmentSha256)) fail("Prepared hashes are invalid.");
  requireExact(sha256File(stagedManifestPath), plan.hashes.manifestSha256, "Manifest hash");
  requireExact(sha256File(stagedLauncherPath), plan.hashes.launcherSha256, "Launcher hash");
  if (environmentPath) requireExact(sha256File(environmentPath), plan.hashes.environmentSha256, "Environment hash");
  if (plan.hashes.typecheckBaselineSha256 && !options.typecheckBaselinePath) fail("Certified typecheck baseline path is required.");
  if (plan.hashes.typecheckBaselineSha256) requireExact(sha256File(options.typecheckBaselinePath), plan.hashes.typecheckBaselineSha256, "Typecheck baseline hash");
  const manifest = JSON.parse(readFileSync(stagedManifestPath, "utf8"));
  requireExact(manifest.schemaVersion, MANIFEST_SCHEMA, "Manifest schema");
  requireExact(manifest.canonicalIdentity.sourceSha, plan.sourceSha, "Manifest source SHA");
  requireExact(manifest.canonicalIdentity.treeId, plan.treeId, "Manifest tree ID");
  requireExact(manifest.canonicalIdentity.buildId, plan.buildId, "Manifest build ID");
  requireExact(samePath(manifest.releasePath, plan.finalReleasePath), true, "Manifest release path");
  requireExact(JSON.stringify(manifest.typecheckCertification ?? null), JSON.stringify(plan.typecheckCertification ?? null), "Typecheck certification");
  requireExact(JSON.stringify(plan.objectCounts), JSON.stringify(manifest.summary), "Release plan object counts");
  const releasePrefix = `${plan.sourceSha}__${plan.buildId}__`; const releaseName = basename(plan.finalReleasePath);
  if (!releaseName.startsWith(releasePrefix) || releaseName.length === releasePrefix.length) fail("Final release tag identity is invalid.");
  requireExact(basename(plan.finalManifestPath), `GLW-Research-Security-${plan.sourceSha}-${plan.buildId}.json`, "Final manifest identity");
  const tree = verifyTree(stagedReleasePath, manifest);
  const launcher = readFileSync(stagedLauncherPath, "utf8");
  requireExact(samePath(launcherAssignment(launcher, "ReleasePath"), plan.finalReleasePath), true, "Launcher release path");
  requireExact(samePath(launcherAssignment(launcher, "ManifestPath"), plan.finalManifestPath), true, "Launcher manifest path");
  if (environmentPath) requireExact(samePath(launcherAssignment(launcher, "EnvironmentPath"), environmentPath), true, "Launcher environment path");
  requireExact(launcherAssignment(launcher, "ExpectedSourceSha"), plan.sourceSha, "Launcher source SHA");
  requireExact(launcherAssignment(launcher, "ExpectedTreeId"), plan.treeId, "Launcher tree ID");
  requireExact(launcherAssignment(launcher, "ExpectedBuildId"), plan.buildId, "Launcher build ID");
  requireExact(launcherAssignment(launcher, "ExpectedManifestSha256"), plan.hashes.manifestSha256, "Launcher manifest hash");
  requireExact(launcherAssignment(launcher, "ExpectedEnvironmentSha256"), plan.hashes.environmentSha256, "Launcher environment hash");
  if (!launcher.includes('[Environment]::SetEnvironmentVariable("GIT_COMMIT", $ExpectedSourceSha, "Process")') || !launcher.includes('[Environment]::SetEnvironmentVariable("NODE_ENV", "production", "Process")')) fail("Candidate launcher runtime identity is invalid.");
  if (launcher.includes("GLW_CAMPAIGN_LAUNCH_PRODUCTION_ENABLED") || launcher.includes("GLW_CAMPAIGN_LAUNCH_CERTIFIED_RELEASE")) fail("Candidate launcher contains campaign promotion configuration.");
  if (!samePath(dirname(plan.finalReleasePath), options.releaseRoot ?? dirname(plan.finalReleasePath)) || !samePath(dirname(plan.finalManifestPath), options.manifestRoot ?? dirname(plan.finalManifestPath))) fail("Final installation root is not authorized.");
  return { stage, plan, manifest, launcher, tree, paths: { planPath, stagedReleasePath, stagedManifestPath, stagedLauncherPath, finalReleasePath: resolve(plan.finalReleasePath), finalManifestPath: resolve(plan.finalManifestPath) } };
}

export function createInstallEvidence(input) {
  return { schemaVersion: "genesis.glw.immutable-installation-evidence/v1", transactionId: input.transactionId, startedAtUtc: input.startedAtUtc, completedAtUtc: input.completedAtUtc, result: input.result, stagePath: input.stagePath, sourceSha: input.sourceSha, treeId: input.treeId, buildId: input.buildId, tag: input.tag, hashes: input.hashes, previousRuntime: input.previousRuntime, installedRuntime: input.installedRuntime, health: input.health, persistence: input.persistence, acl: input.acl, rollback: input.rollback, operator: { elevatedAdministrator: input.elevatedAdministrator }, secretsRecorded: false };
}

export function createNodeInstallerAdapters(overrides = {}) {
  const base = {
    now: () => new Date().toISOString(), transactionId: () => randomUUID(), isElevatedAdministrator: () => false,
    isPromotionEnvironmentSafe: () => false,
    pathExists: existsSync, copyTree: (source, target) => cpSync(source, target, { recursive: true, dereference: true, errorOnExist: true, force: false }),
    copyFile: (source, target) => cpSync(source, target, { errorOnExist: true, force: false }), removeTree: (path) => rmSync(path, { recursive: true, force: true }), removeFile: (path) => rmSync(path, { force: true }),
    makeDirectory: (path) => mkdirSync(path, { recursive: true }), readText: (path) => readFileSync(path, "utf8"), writeText: (path, text) => writeFileSync(path, text, "utf8"), hashFile: sha256File, verifyTree,
    readBytes: (path) => readFileSync(path), writeBytes: (path, bytes) => writeFileSync(path, bytes),
    inspectProduction: async () => fail("Production inspection adapter is required."), captureLauncherSecurity: () => fail("Launcher security adapter is required."),
    grantTemporaryLauncherWrite: () => fail("Launcher ACL adapter is required."), replaceLauncher: () => fail("Launcher replacement adapter is required."), restoreLauncherSecurity: () => fail("Launcher security restoration adapter is required."), verifyLauncherSecurity: () => fail("Launcher security verification adapter is required."),
    stopRuntimeOnce: async () => fail("Runtime stop adapter is required."), startProtectedLauncherOnce: async () => fail("Runtime start adapter is required."), verifyInstalledRuntime: async () => fail("Runtime verification adapter is required."),
  };
  return { ...base, ...overrides };
}

export async function installPreparedRelease({ stage, environmentPath, launcherPath, evidenceRoot, rollbackRoot, releaseRoot, manifestRoot, typecheckBaselinePath, sourceIdentityResolver, adapters = createNodeInstallerAdapters() }) {
  if (!adapters.isElevatedAdministrator()) fail("High-integrity Administrator authority is required.");
  if (!adapters.isPromotionEnvironmentSafe()) fail("Installer process promotion environment is not fail-closed.");
  const prepared = validatePreparedStage(stage, environmentPath, { releaseRoot, manifestRoot, typecheckBaselinePath, sourceIdentityResolver });
  const startedAtUtc = adapters.now(); const transactionId = adapters.transactionId();
  const before = await adapters.inspectProduction(prepared);
  if (!before.healthy || before.port !== 3001 || !before.expectedGenesisRuntime || !before.releasePath || before.promotionEnabled || !before.persistence || before.persistence.ownershipCollisionCount !== 0 || before.persistence.unreconciledCount !== 0 || !before.sidecarHealthy) fail("Current production preflight failed closed.");
  const finalReleaseExists = adapters.pathExists(prepared.paths.finalReleasePath); const finalManifestExists = adapters.pathExists(prepared.paths.finalManifestPath);
  if (finalReleaseExists || finalManifestExists) {
    if (finalReleaseExists && finalManifestExists && before.sourceSha === prepared.plan.sourceSha && before.buildId === prepared.plan.buildId && before.releasePath && samePath(before.releasePath, prepared.paths.finalReleasePath)) {
      adapters.verifyTree(prepared.paths.finalReleasePath, prepared.manifest); requireExact(adapters.hashFile(prepared.paths.finalManifestPath), prepared.plan.hashes.manifestSha256, "Installed manifest hash"); requireExact(adapters.hashFile(launcherPath), prepared.plan.hashes.launcherSha256, "Installed launcher hash"); const currentSecurity = adapters.captureLauncherSecurity(launcherPath); adapters.verifyLauncherSecurity(launcherPath, currentSecurity); return { state: "ALREADY_INSTALLED_AND_RUNNING", prepared, before };
    }
    fail("Conflicting final release or manifest already exists.");
  }
  const launcherSecurity = adapters.captureLauncherSecurity(launcherPath); const previousLauncher = adapters.readBytes(launcherPath); const previousLauncherHash = adapters.hashFile(launcherPath);
  validateCurrentLauncherAuthority(adapters.readText(launcherPath), before, environmentPath, prepared.plan.hashes.environmentSha256);
  let materialized = false; let manifestInstalled = false; let launcherChanged = false; let runtimeStopped = false; let newLauncherPid = null; let rollback = { required: false, attempted: false, succeeded: null, error: null };
  try {
    const mutationBoundary = await adapters.inspectProduction(prepared);
    if (!mutationBoundary.healthy || stableProductionIdentity(mutationBoundary) !== stableProductionIdentity(before)) fail("Production state changed before the mutation boundary.");
    materialized = true; adapters.copyTree(prepared.paths.stagedReleasePath, prepared.paths.finalReleasePath);
    adapters.verifyTree(prepared.paths.finalReleasePath, prepared.manifest);
    adapters.makeDirectory(dirname(prepared.paths.finalManifestPath)); manifestInstalled = true; adapters.copyFile(prepared.paths.stagedManifestPath, prepared.paths.finalManifestPath);
    requireExact(adapters.hashFile(prepared.paths.finalManifestPath), prepared.plan.hashes.manifestSha256, "Installed manifest hash");
    adapters.makeDirectory(rollbackRoot); const launcherBackup = join(rollbackRoot, `Start-GenesisGlw.${transactionId}.rollback.ps1`); adapters.writeBytes(launcherBackup, previousLauncher);
    requireExact(adapters.hashFile(launcherBackup), previousLauncherHash, "Launcher rollback hash");
    adapters.grantTemporaryLauncherWrite(launcherPath, launcherSecurity); launcherChanged = true;
    try { adapters.replaceLauncher(prepared.paths.stagedLauncherPath, launcherPath); }
    finally { adapters.restoreLauncherSecurity(launcherPath, launcherSecurity); }
    requireExact(adapters.hashFile(launcherPath), prepared.plan.hashes.launcherSha256, "Installed launcher hash"); adapters.verifyLauncherSecurity(launcherPath, launcherSecurity);
    await adapters.stopRuntimeOnce(before); runtimeStopped = true;
    newLauncherPid = await adapters.startProtectedLauncherOnce(launcherPath, 3001);
    const after = await adapters.verifyInstalledRuntime(prepared, before);
    if (!after.healthy || after.sourceSha !== prepared.plan.sourceSha || after.buildId !== prepared.plan.buildId || !samePath(after.releasePath, prepared.paths.finalReleasePath) || after.promotionEnabled || !after.sidecarHealthy || after.sidecarPid !== before.sidecarPid || after.persistence.campaignHash !== before.persistence.campaignHash || after.persistence.targetHash !== before.persistence.targetHash || after.persistence.executionHash !== before.persistence.executionHash || after.persistence.campaignCount !== before.persistence.campaignCount || after.persistence.targetCount !== before.persistence.targetCount || after.persistence.executionCount !== before.persistence.executionCount || after.persistence.ownershipCollisionCount !== 0 || after.persistence.unreconciledCount !== 0) fail("Post-install production verification failed closed.");
    const evidence = createInstallEvidence({ transactionId, startedAtUtc, completedAtUtc: adapters.now(), result: "PASS", stagePath: prepared.stage, sourceSha: prepared.plan.sourceSha, treeId: prepared.plan.treeId, buildId: prepared.plan.buildId, tag: prepared.paths.finalReleasePath.split("__").at(-1), hashes: prepared.plan.hashes, previousRuntime: before, installedRuntime: after, health: { before: before.health, after: after.health }, persistence: { before: before.persistence, after: after.persistence }, acl: { ownerBefore: launcherSecurity.owner, ownerAfter: launcherSecurity.owner, sddlFingerprintBefore: sha256Buffer(Buffer.from(launcherSecurity.sddl)), sddlFingerprintAfter: sha256Buffer(Buffer.from(launcherSecurity.sddl)) }, rollback, elevatedAdministrator: true });
    adapters.makeDirectory(evidenceRoot); const evidencePath = join(evidenceRoot, `install-${transactionId}.json`); adapters.writeText(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    return { state: "INSTALLED", prepared, before, after, evidencePath };
  } catch (error) {
    rollback = { required: launcherChanged || materialized || manifestInstalled || runtimeStopped, attempted: false, succeeded: null, error: null };
    if (rollback.required) {
      rollback.attempted = true;
      try {
        if (runtimeStopped && newLauncherPid) await adapters.stopRuntimeOnce({ launcherPid: newLauncherPid, pid: newLauncherPid });
        if (launcherChanged) { adapters.grantTemporaryLauncherWrite(launcherPath, launcherSecurity); try { adapters.writeBytes(launcherPath, previousLauncher); } finally { adapters.restoreLauncherSecurity(launcherPath, launcherSecurity); } requireExact(adapters.hashFile(launcherPath), previousLauncherHash, "Rollback launcher hash"); adapters.verifyLauncherSecurity(launcherPath, launcherSecurity); }
        if (runtimeStopped) { await adapters.startProtectedLauncherOnce(launcherPath, 3001); await adapters.verifyInstalledRuntime({ plan: { sourceSha: before.sourceSha, buildId: before.buildId }, paths: { finalReleasePath: before.releasePath } }, before); }
        if (manifestInstalled) adapters.removeFile(prepared.paths.finalManifestPath); if (materialized) adapters.removeTree(prepared.paths.finalReleasePath); rollback.succeeded = true;
      } catch (rollbackError) { rollback.succeeded = false; rollback.error = rollbackError instanceof Error ? rollbackError.message : String(rollbackError); }
    }
    try {
      adapters.makeDirectory(evidenceRoot); const evidence = createInstallEvidence({ transactionId, startedAtUtc, completedAtUtc: adapters.now(), result: "FAIL", stagePath: prepared.stage, sourceSha: prepared.plan.sourceSha, treeId: prepared.plan.treeId, buildId: prepared.plan.buildId, tag: prepared.paths.finalReleasePath.split("__").at(-1), hashes: prepared.plan.hashes, previousRuntime: before, installedRuntime: null, health: { before: before.health, after: null }, persistence: { before: before.persistence, after: null }, acl: launcherSecurity ? { ownerBefore: launcherSecurity.owner, ownerAfter: null, sddlFingerprintBefore: sha256Buffer(Buffer.from(launcherSecurity.sddl)), sddlFingerprintAfter: null } : null, rollback, elevatedAdministrator: true }); adapters.writeText(join(evidenceRoot, `install-${transactionId}-failed.json`), `${JSON.stringify(evidence, null, 2)}\n`);
    } catch { /* Primary and rollback failures retain precedence. */ }
    const failure = new Error(`Immutable installation failed: ${error instanceof Error ? error.message : String(error)}; rollback=${rollback.succeeded === false ? "FAILED" : rollback.attempted ? "PASS" : "NOT_REQUIRED"}`); failure.cause = error; failure.rollback = rollback; throw failure;
  }
}
