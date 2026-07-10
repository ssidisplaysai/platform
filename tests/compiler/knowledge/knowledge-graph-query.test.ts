import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeGraph } from "../../../src/compiler/knowledge/KnowledgeGraph";
import { KnowledgeGraphQuery } from "../../../src/compiler/knowledge/KnowledgeGraphQuery";

test("knowledge graph query returns nodes, claims, relationships, and neighbors", () => {
  const graph = new KnowledgeGraph(
    [
      {
        id: "kn:source:s1",
        nodeType: "source_record",
        sourceId: "s1",
        sourceType: "markdown",
        origin: "s1.md",
        confidence: 1,
        evidenceNodeId: "source:s1",
        metadata: {},
        lineage: {
          sourceId: "s1",
          parentKnowledgeNodeIds: [],
          parentEvidenceNodeIds: [],
          transformationSteps: ["knowledge_compile"],
        },
      },
      {
        id: "kn:artifact:a1",
        nodeType: "artifact_record",
        sourceId: "s1",
        sourceType: "markdown",
        origin: "s1.md",
        confidence: 1,
        evidenceNodeId: "artifact:a1",
        metadata: {},
        lineage: {
          sourceId: "s1",
          parentKnowledgeNodeIds: ["kn:source:s1"],
          parentEvidenceNodeIds: ["source:s1"],
          transformationSteps: ["knowledge_compile"],
        },
      },
    ],
    [
      {
        id: "krel:1",
        from: "kn:source:s1",
        to: "kn:artifact:a1",
        relationshipType: "supported_by",
        sourceId: "s1",
        evidenceRelationshipId: "rel:1",
        metadata: {},
        lineage: {
          sourceId: "s1",
          parentKnowledgeRelationshipIds: [],
          parentEvidenceRelationshipIds: ["rel:1"],
          transformationSteps: ["knowledge_compile"],
        },
      },
    ],
    [
      {
        id: "claim:1",
        claimType: "existence",
        subjectNodeId: "kn:artifact:a1",
        statement: "artifact exists",
        confidence: 1,
        evidenceNodeIds: ["artifact:a1", "source:s1"],
        evidenceRelationshipIds: ["rel:1"],
        metadata: {},
        lineage: {
          sourceId: "s1",
          parentClaimIds: [],
          parentEvidenceNodeIds: ["artifact:a1", "source:s1"],
          parentEvidenceRelationshipIds: ["rel:1"],
          transformationSteps: ["knowledge_compile"],
        },
      },
    ],
  );

  const query = new KnowledgeGraphQuery(graph);

  assert.equal(query.nodeById("kn:source:s1")?.nodeType, "source_record");
  assert.equal(query.claimById("claim:1")?.claimType, "existence");
  assert.equal(query.nodesByType("artifact_record").length, 1);
  assert.equal(query.relationshipsByType("supported_by").length, 1);
  assert.equal(query.claimsBySubjectNode("kn:artifact:a1").length, 1);
  assert.equal(query.claimsByEvidenceNode("artifact:a1").length, 1);
  assert.equal(query.outgoing("kn:source:s1").length, 1);
  assert.equal(query.incoming("kn:artifact:a1").length, 1);
  assert.deepEqual(query.neighbors("kn:source:s1").map((node) => node.id), ["kn:artifact:a1"]);
});
