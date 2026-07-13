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
  assert.equal(listed.some((entry) => entry.id === "bgc.semantic-resolution"), true);
  assert.equal(listed.some((entry) => entry.id === "bgc.semantic-consolidation"), true);
  assert.equal(listed.some((entry) => entry.id === "bgc.relationship-resolution"), true);
  assert.equal(listed.some((entry) => entry.id === "bgc.identity-assignment"), true);
  assert.equal(listed.some((entry) => entry.id === "bgc.graph-construction"), true);
  assert.equal(listed.some((entry) => entry.id === "bgc.consistency-validation"), true);

  const canonical = registry.resolve("bgc.canonical-verification");
  const grouping = registry.resolve("bgc.evidence-grouping");
  const correlation = registry.resolve("bgc.evidence-correlation");
  const resolution = registry.resolve("bgc.semantic-resolution");
  const consolidation = registry.resolve("bgc.semantic-consolidation");
  const relationships = registry.resolve("bgc.relationship-resolution");
  const identity = registry.resolve("bgc.identity-assignment");
  const graph = registry.resolve("bgc.graph-construction");
  const validation = registry.resolve("bgc.consistency-validation");

  assert.deepEqual(canonical.metadata.dependencies, ["bgc.input-validation"]);
  assert.deepEqual(grouping.metadata.dependencies, ["bgc.canonical-verification"]);
  assert.deepEqual(correlation.metadata.dependencies, ["bgc.evidence-grouping"]);
  assert.deepEqual(resolution.metadata.dependencies, ["bgc.evidence-correlation"]);
  assert.deepEqual(consolidation.metadata.dependencies, ["bgc.semantic-resolution"]);
  assert.deepEqual(relationships.metadata.dependencies, ["bgc.semantic-consolidation"]);
  assert.deepEqual(identity.metadata.dependencies, ["bgc.relationship-resolution"]);
  assert.deepEqual(graph.metadata.dependencies, ["bgc.identity-assignment"]);
  assert.deepEqual(validation.metadata.dependencies, ["bgc.graph-construction"]);

  const ordered = registry.executablePassOrder().map((entry) => entry.metadata.id);
  assert.deepEqual(ordered, [
    "bgc.input-validation",
    "bgc.canonical-verification",
    "bgc.evidence-grouping",
    "bgc.evidence-correlation",
    "bgc.semantic-resolution",
    "bgc.semantic-consolidation",
    "bgc.relationship-resolution",
    "bgc.identity-assignment",
    "bgc.graph-construction",
    "bgc.consistency-validation",
  ]);
});
