import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildManifest, certifyTypecheckBaseline, commandInvocation, environmentMetadata, parseEnvironment, renderLauncher, typecheckBaselineFingerprint, verifyManifest } from "./glw-immutable-release.mjs";

const diagnostic = { file: "src/example.ts", line: 10, column: 2, code: "TS2322", message: "Type 'null' is not assignable to type 'string'." };
function baseline(overrides = {}) {
  const value = { schemaVersion: "genesis.glw.typecheck-baseline/v1", certifiedSourceSha: "a".repeat(40), command: "npm run typecheck:production", expectedExitCode: 2, sourceBlobs: { "src/example.ts": "b".repeat(40) }, diagnostics: [diagnostic], ...overrides };
  return { ...value, fingerprint: typecheckBaselineFingerprint(value) };
}

test("environment metadata never contains secret values", () => {
  const metadata = environmentMetadata(parseEnvironment('A="secret-value"\nB=https://example.test\n'), ["A", "B"]);
  assert.equal(metadata.A[0], 12); assert.equal(metadata.A[1].length, 8); assert.equal(JSON.stringify(metadata).includes("secret-value"), false);
});
test("missing and duplicate environment names fail closed", () => {
  assert.throws(() => environmentMetadata(parseEnvironment("A=x\n"), ["A", "B"])); assert.throws(() => parseEnvironment("A=x\nA=y\n"));
});
test("manifest accounts for every object and detects mutation", () => {
  const root = mkdtempSync(join(tmpdir(), "glw-release-test-"));
  try {
    mkdirSync(join(root, "nested")); writeFileSync(join(root, "a.txt"), "alpha"); writeFileSync(join(root, "nested", "b.txt"), "beta");
    const manifest = buildManifest({ releaseRoot: root, sourceSha: "a".repeat(40), treeId: "b".repeat(40), buildId: "build-1", sourcePath: "stage-source", finalReleasePath: "final-release", generatedAtUtc: "2026-09-01T00:00:00.000Z" });
    assert.equal(manifest.summary.expectedObjectCount, 3); assert.doesNotThrow(() => verifyManifest(root, manifest)); writeFileSync(join(root, "a.txt"), "changed"); assert.throws(() => verifyManifest(root, manifest));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("manifest records differential typecheck certification", () => {
  const root = mkdtempSync(join(tmpdir(), "glw-release-typecheck-test-"));
  try {
    writeFileSync(join(root, "a.txt"), "alpha");
    const typecheckCertification = { policy: "EXACT_DIAGNOSTIC_AND_SOURCE_BLOB_FAIL_ON_DRIFT", baselineFingerprint: "c".repeat(64), diagnosticCount: 1 };
    const manifest = buildManifest({ releaseRoot: root, sourceSha: "a".repeat(40), treeId: "b".repeat(40), buildId: "build-1", sourcePath: "stage-source", finalReleasePath: "final-release", typecheckCertification, generatedAtUtc: "2026-09-01T00:00:00.000Z" });
    assert.deepEqual(manifest.typecheckCertification, typecheckCertification); assert.doesNotThrow(() => verifyManifest(root, manifest));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test("launcher rendering replaces authority and environment blocks", () => {
  const template = `$ReleasePath = "old"\n$ExpectedSourceSha = "old"\n$ExpectedEnvironment = [ordered]@{\n  OLD = @(1, "AAAA")\n}\n`;
  const rendered = renderLauncher({ template, assignments: { ReleasePath: "new", ExpectedSourceSha: "c".repeat(40) }, environment: { A: [1, "559AEAD0"] } });
  assert.match(rendered, /\$ReleasePath = "new"/u); assert.match(rendered, /A = @\(1, "559AEAD0"\)/u); assert.doesNotMatch(rendered, /OLD =/u);
});
test("Windows cmd shims are launched through the configured command shell", () => {
  assert.deepEqual(commandInvocation("npm.cmd", ["ci"], "win32", "C:\\Windows\\System32\\cmd.exe"), {
    command: "C:\\Windows\\System32\\cmd.exe",
    args: ["/d", "/s", "/c", "npm.cmd", "ci"],
  });
  assert.deepEqual(commandInvocation("git", ["status"], "win32", "cmd.exe"), {
    command: "git",
    args: ["status"],
  });
});
test("exact certified typecheck baseline permits continuation", () => {
  const result = certifyTypecheckBaseline({ output: `src/example.ts(10,2): error TS2322: Type 'null' is not assignable to type 'string'.`, exitCode: 2, baseline: baseline(), sourceBlobResolver: () => "b".repeat(40) });
  assert.equal(result.diagnosticCount, 1); assert.equal(result.policy, "EXACT_DIAGNOSTIC_AND_SOURCE_BLOB_FAIL_ON_DRIFT");
});
test("new or changed typecheck diagnostics fail closed", () => {
  const certified = baseline();
  assert.throws(() => certifyTypecheckBaseline({ output: `src/example.ts(10,2): error TS2322: Type 'null' is not assignable to type 'string'.\nsrc/new.ts(1,1): error TS2304: Cannot find name 'missing'.`, exitCode: 2, baseline: certified, sourceBlobResolver: () => "b".repeat(40) }));
  assert.throws(() => certifyTypecheckBaseline({ output: `src/example.ts(11,2): error TS2322: Type 'null' is not assignable to type 'string'.`, exitCode: 2, baseline: certified, sourceBlobResolver: () => "b".repeat(40) }));
  assert.throws(() => certifyTypecheckBaseline({ output: `src/example.ts(10,2): error TS2345: Type 'null' is not assignable to type 'string'.`, exitCode: 2, baseline: certified, sourceBlobResolver: () => "b".repeat(40) }));
  assert.throws(() => certifyTypecheckBaseline({ output: "", exitCode: 0, baseline: certified, sourceBlobResolver: () => "b".repeat(40) }));
});
test("changed baseline source or fingerprint fails closed", () => {
  const certified = baseline();
  assert.throws(() => certifyTypecheckBaseline({ output: `src/example.ts(10,2): error TS2322: Type 'null' is not assignable to type 'string'.`, exitCode: 2, baseline: certified, sourceBlobResolver: () => "c".repeat(40) }));
  assert.throws(() => certifyTypecheckBaseline({ output: `src/example.ts(10,2): error TS2322: Type 'null' is not assignable to type 'string'.`, exitCode: 2, baseline: { ...certified, fingerprint: "0".repeat(64) }, sourceBlobResolver: () => "b".repeat(40) }));
  assert.throws(() => certifyTypecheckBaseline({ output: `src/example.ts(10,2): error TS2322: Type 'null' is not assignable to type 'string'.`, exitCode: 2, baseline: baseline({ command: "npm run build" }), sourceBlobResolver: () => "b".repeat(40) }));
  assert.throws(() => certifyTypecheckBaseline({ output: `src/example.ts(10,2): error TS2322: Type 'null' is not assignable to type 'string'.`, exitCode: 2, baseline: baseline({ sourceBlobs: { "src/other.ts": "b".repeat(40) } }), sourceBlobResolver: () => "b".repeat(40) }));
});
