import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphHasher } from "../../../src/compiler/evidence/EvidenceGraphHasher";

test("graph hash is stable across repeated runs", () => {
  const graph = new EvidenceGraph(
    [
      {
        id: "source:s1",
        nodeType: "source",
        sourceId: "s1",
        sourceType: "json",
        origin: "s1.json",
        confidence: 1,
        metadata: { key: "value" },
        lineage: { sourceId: "s1", parentNodeIds: [], transformationSteps: [] },
      },
    ],
    [],
  );

  const hasher = new EvidenceGraphHasher();
  const first = hasher.hashGraph(graph);
  const second = hasher.hashGraph(graph);

  assert.equal(first, second);
});
