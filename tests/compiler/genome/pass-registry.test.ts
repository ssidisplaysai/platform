import assert from "node:assert/strict";
import test from "node:test";
import { BusinessGenomePassRegistry } from "../../../src/compiler/genome";

test("registry includes required implemented passes with deterministic dependency chain", () => {
  const registry = new BusinessGenomePassRegistry();
  const listed = registry.list();

  assert.equal(listed.some((entry) => entry.id === "bgc.input-validation"), true);
  assert.equal(listed.some((entry) => entry.id === "bgc.canonical-verification"), true);
  assert.equal(listed.some((entry) => entry.id === "bgc.evidence-grouping"), true);
  assert.equal(listed.some((entry) => entry.id === "bgc.evidence-correlation"), true);

  const canonical = registry.resolve("bgc.canonical-verification");
  const grouping = registry.resolve("bgc.evidence-grouping");
  const correlation = registry.resolve("bgc.evidence-correlation");

  assert.deepEqual(canonical.metadata.dependencies, ["bgc.input-validation"]);
  assert.deepEqual(grouping.metadata.dependencies, ["bgc.canonical-verification"]);
  assert.deepEqual(correlation.metadata.dependencies, ["bgc.evidence-grouping"]);

  const ordered = registry.executablePassOrder().map((entry) => entry.metadata.id);
  assert.deepEqual(ordered, [
    "bgc.input-validation",
    "bgc.canonical-verification",
    "bgc.evidence-grouping",
    "bgc.evidence-correlation",
  ]);
});
