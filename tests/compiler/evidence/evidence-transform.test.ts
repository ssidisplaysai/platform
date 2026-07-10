import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphTransform } from "../../../src/compiler/evidence/EvidenceGraphTransform";

test("graph transforms preserve lineage and provenance", () => {
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

  const transform = new EvidenceGraphTransform();
  const tagged = transform.tagTransformation(graph, "normalize");
  const remapped = transform.remapNodeIds(tagged, { "artifact:a1": "artifact:a1:merged" }, "merge");

  const remappedNode = remapped.nodes.find((node) => node.id === "artifact:a1:merged");
  assert.equal(Boolean(remappedNode), true);
  assert.deepEqual(remappedNode?.lineage.parentNodeIds.includes("artifact:a1"), true);
  assert.deepEqual(remappedNode?.lineage.transformationSteps, ["merge", "normalize"]);

  const rel = remapped.relationships[0];
  assert.equal(rel?.to, "artifact:a1:merged");
  assert.equal(rel?.lineage.parentRelationshipIds.includes("rel:1"), true);
  assert.deepEqual(rel?.lineage.transformationSteps, ["merge", "normalize"]);
});
