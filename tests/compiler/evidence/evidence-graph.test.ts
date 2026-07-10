import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";

test("evidence graph sorts nodes and relationships deterministically", () => {
  const graph = new EvidenceGraph(
    [
      {
        id: "source:b",
        nodeType: "source",
        sourceId: "b",
        sourceType: "json",
        origin: "b.json",
        confidence: 1,
        metadata: {},
        lineage: { sourceId: "b", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "source:a",
        nodeType: "source",
        sourceId: "a",
        sourceType: "markdown",
        origin: "a.md",
        confidence: 1,
        metadata: {},
        lineage: { sourceId: "a", parentNodeIds: [], transformationSteps: [] },
      },
    ],
    [
      {
        id: "rel:z",
        from: "source:b",
        to: "source:a",
        relationshipType: "derived_from",
        sourceId: "b",
        metadata: {},
        lineage: { sourceId: "b", parentRelationshipIds: [], transformationSteps: [] },
      },
      {
        id: "rel:a",
        from: "source:a",
        to: "source:b",
        relationshipType: "derived_from",
        sourceId: "a",
        metadata: {},
        lineage: { sourceId: "a", parentRelationshipIds: [], transformationSteps: [] },
      },
    ],
  );

  assert.deepEqual(graph.nodes.map((node) => node.id), ["source:a", "source:b"]);
  assert.deepEqual(graph.relationships.map((relationship) => relationship.id), ["rel:a", "rel:z"]);
});
