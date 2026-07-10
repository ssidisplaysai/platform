import assert from "node:assert/strict";
import test from "node:test";
import { CompilerVersionManager } from "../../../src/compiler/core/CompilerVersionManager";

test("version manager tracks pass versions and deprecations", () => {
  const versions = new CompilerVersionManager();
  versions.registerPassVersion("discovery-pass", "1.0.0");
  versions.markPassDeprecated("legacy-pass", "discovery-pass");

  const snapshot = versions.getSnapshot();
  assert.equal(snapshot.passVersions["discovery-pass"], "1.0.0");
  assert.deepEqual(snapshot.migrationMetadata.deprecatedPasses, ["legacy-pass"]);
  assert.equal(snapshot.migrationMetadata.replacements["legacy-pass"], "discovery-pass");
});
