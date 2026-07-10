import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphMerger } from "../../../src/compiler/evidence/EvidenceGraphMerger";

test("graph merger merges duplicate nodes deterministically", () => {
  const graphA = new EvidenceGraph(
    [
      {
        id: "source:s1",
        nodeType: "source",
        sourceId: "s1",
        sourceType: "markdown",
        origin: "s1.md",
        confidence: 0.8,
        metadata: { a: 1 },
        lineage: { sourceId: "s1", parentNodeIds: [], transformationSteps: ["ingest"] },
      },
    ],
    [],
  );

  const graphB = new EvidenceGraph(
    [
      {
        id: "source:s1",
        nodeType: "source",
        sourceId: "s1",
        sourceType: "markdown",
        origin: "s1.md",
        confidence: 1,
        metadata: { b: 2 },
        lineage: { sourceId: "s1", parentNodeIds: ["legacy:s1"], transformationSteps: ["merge"] },
      },
    ],
    [],
  );

  const merger = new EvidenceGraphMerger();
  const merged = merger.merge(graphA, graphB);

  assert.equal(merged.nodes.length, 1);
  assert.equal(merged.nodes[0]?.confidence, 1);
  assert.deepEqual(merged.nodes[0]?.metadata, { a: 1, b: 2 });
  assert.deepEqual(merged.nodes[0]?.lineage.parentNodeIds, ["legacy:s1"]);
  assert.deepEqual(merged.nodes[0]?.lineage.transformationSteps, ["ingest", "merge"]);
});
