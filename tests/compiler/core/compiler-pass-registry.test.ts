import assert from "node:assert/strict";
import test from "node:test";
import { CompilerPassRegistry } from "../../../src/compiler/core/CompilerPassRegistry";
import { DiscoveryCompilerPass } from "../../../src/compiler/core/passes/DiscoveryCompilerPass";
import { EvidenceCompilerPass } from "../../../src/compiler/core/passes/EvidenceCompilerPass";

test("pass registry supports registration, discovery, deprecation, and replacement", () => {
  const registry = new CompilerPassRegistry();
  registry.register(new DiscoveryCompilerPass());
  registry.register(new EvidenceCompilerPass());

  assert.equal(registry.list().length, 2);
  assert.equal(registry.resolve("discovery-pass").metadata.id, "discovery-pass");
  assert.equal(registry.discoverByCapability("evidence").length, 1);

  registry.deprecate("discovery-pass");
  assert.equal(registry.resolve("discovery-pass").metadata.lifecycle, "deprecated");

  registry.replace("discovery-pass", "new-discovery-pass");
  assert.equal(registry.resolve("discovery-pass").metadata.lifecycle, "replaced");
  assert.equal(registry.resolve("discovery-pass").metadata.replacedBy, "new-discovery-pass");
});
