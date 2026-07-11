import assert from "node:assert/strict";
import test from "node:test";
import type { KnowledgeNode } from "../../../src/compiler/knowledge/KnowledgeNode";

test("knowledge node carries evidence-grounded lineage", () => {
  const node: KnowledgeNode = {
    id: "kn:source:s1",
    nodeType: "source_record",
    sourceId: "s1",
    sourceType: "markdown",
    origin: "source.md",
    confidence: 1,
    evidenceNodeId: "source:s1",
    metadata: { key: "value" },
    lineage: {
      sourceId: "s1",
      parentKnowledgeNodeIds: [],
      parentEvidenceNodeIds: [],
      transformationSteps: ["knowledge_compile"],
    },
  };

  assert.equal(node.id, "kn:source:s1");
  assert.equal(node.evidenceNodeId, "source:s1");
  assert.deepEqual(node.lineage.transformationSteps, ["knowledge_compile"]);
});
