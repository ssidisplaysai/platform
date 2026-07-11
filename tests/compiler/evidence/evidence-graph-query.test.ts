import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphQuery } from "../../../src/compiler/evidence/EvidenceGraphQuery";

test("graph query returns nodes, relationships, and neighbors", () => {
  const graph = new EvidenceGraph(
    [
      {
        id: "source:s1",
        nodeType: "source",
        sourceId: "s1",
        sourceType: "markdown",
        origin: "s1.md",
        confidence: 1,
        metadata: {},
        lineage: { sourceId: "s1", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "artifact:a1",
        nodeType: "artifact",
        sourceId: "s1",
        artifactId: "a1",
        versionId: "v1",
        sourceType: "markdown",
        origin: "s1.md",
        checksum: "h1",
        confidence: 1,
        metadata: {},
        lineage: { sourceId: "s1", parentNodeIds: ["source:s1"], transformationSteps: [] },
      },
    ],
    [
      {
        id: "rel:1",
        from: "source:s1",
        to: "artifact:a1",
        relationshipType: "produced",
        sourceId: "s1",
        metadata: {},
        lineage: { sourceId: "s1", parentRelationshipIds: [], transformationSteps: [] },
      },
    ],
  );

  const query = new EvidenceGraphQuery(graph);
  assert.equal(query.nodeById("source:s1")?.nodeType, "source");
  assert.equal(query.nodesByType("artifact").length, 1);
  assert.equal(query.relationshipsByType("produced").length, 1);
  assert.equal(query.outgoing("source:s1").length, 1);
  assert.equal(query.incoming("artifact:a1").length, 1);
  assert.deepEqual(query.neighbors("source:s1").map((node) => node.id), ["artifact:a1"]);
});
