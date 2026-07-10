import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeGraph } from "../../../src/compiler/knowledge/KnowledgeGraph";
import { KnowledgeGraphHasher } from "../../../src/compiler/knowledge/KnowledgeGraphHasher";

test("knowledge graph hash is stable across repeated runs", () => {
  const graph = new KnowledgeGraph(
    [
      {
        id: "kn:source:s1",
        nodeType: "source_record",
        sourceId: "s1",
        sourceType: "json",
        origin: "s1.json",
        confidence: 1,
        evidenceNodeId: "source:s1",
        metadata: { key: "value" },
        lineage: {
          sourceId: "s1",
          parentKnowledgeNodeIds: [],
          parentEvidenceNodeIds: [],
          transformationSteps: ["knowledge_compile"],
        },
      },
    ],
    [],
    [],
  );

  const hasher = new KnowledgeGraphHasher();
  const first = hasher.hashGraph(graph);
  const second = hasher.hashGraph(graph);

  assert.equal(first, second);
});
