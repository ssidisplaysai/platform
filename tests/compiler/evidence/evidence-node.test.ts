import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceNode } from "../../../src/compiler/evidence/EvidenceNode";

test("evidence node carries provenance-first required fields", () => {
  const node: EvidenceNode = {
    id: "source:s-1",
    nodeType: "source",
    sourceId: "s-1",
    sourceType: "markdown",
    origin: "file:///knowledge.md",
    confidence: 1,
    discoveredAt: "2026-01-01T00:00:00.000Z",
    metadata: { key: "value" },
    lineage: {
      sourceId: "s-1",
      parentNodeIds: [],
      transformationSteps: [],
    },
  };

  assert.equal(node.id, "source:s-1");
  assert.equal(node.lineage.sourceId, "s-1");
  assert.deepEqual(node.lineage.parentNodeIds, []);
  assert.equal(node.confidence, 1);
});
