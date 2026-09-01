import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildManifest, environmentMetadata, parseEnvironment, renderLauncher, verifyManifest } from "./glw-immutable-release.mjs";

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
test("launcher rendering replaces authority and environment blocks", () => {
  const template = `$ReleasePath = "old"\n$ExpectedSourceSha = "old"\n$ExpectedEnvironment = [ordered]@{\n  OLD = @(1, "AAAA")\n}\n`;
  const rendered = renderLauncher({ template, assignments: { ReleasePath: "new", ExpectedSourceSha: "c".repeat(40) }, environment: { A: [1, "559AEAD0"] } });
  assert.match(rendered, /\$ReleasePath = "new"/u); assert.match(rendered, /A = @\(1, "559AEAD0"\)/u); assert.doesNotMatch(rendered, /OLD =/u);
});
