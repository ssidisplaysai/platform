import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeGraph } from "../../../src/compiler/knowledge/KnowledgeGraph";

test("knowledge graph sorts nodes, relationships, and claims deterministically", () => {
  const graph = new KnowledgeGraph(
    [
      {
        id: "kn:source:b",
        nodeType: "source_record",
        sourceId: "b",
        sourceType: "json",
        origin: "b.json",
        confidence: 1,
        evidenceNodeId: "source:b",
        metadata: {},
        lineage: {
          sourceId: "b",
          parentKnowledgeNodeIds: [],
          parentEvidenceNodeIds: [],
          transformationSteps: ["knowledge_compile"],
        },
      },
      {
        id: "kn:source:a",
        nodeType: "source_record",
        sourceId: "a",
        sourceType: "markdown",
        origin: "a.md",
        confidence: 1,
        evidenceNodeId: "source:a",
        metadata: {},
        lineage: {
          sourceId: "a",
          parentKnowledgeNodeIds: [],
          parentEvidenceNodeIds: [],
          transformationSteps: ["knowledge_compile"],
        },
      },
    ],
    [
      {
        id: "krel:z",
        from: "kn:source:b",
        to: "kn:source:a",
        relationshipType: "derived_from",
        sourceId: "b",
        evidenceRelationshipId: "rel:z",
        metadata: {},
        lineage: {
          sourceId: "b",
          parentKnowledgeRelationshipIds: [],
          parentEvidenceRelationshipIds: [],
          transformationSteps: ["knowledge_compile"],
        },
      },
      {
        id: "krel:a",
        from: "kn:source:a",
        to: "kn:source:b",
        relationshipType: "derived_from",
        sourceId: "a",
        evidenceRelationshipId: "rel:a",
        metadata: {},
        lineage: {
          sourceId: "a",
          parentKnowledgeRelationshipIds: [],
          parentEvidenceRelationshipIds: [],
          transformationSteps: ["knowledge_compile"],
        },
      },
    ],
    [
      {
        id: "claim:z",
        claimType: "existence",
        subjectNodeId: "kn:source:b",
        statement: "z",
        confidence: 1,
        evidenceNodeIds: ["source:b"],
        evidenceRelationshipIds: ["rel:z"],
        metadata: {},
        lineage: {
          sourceId: "b",
          parentClaimIds: [],
          parentEvidenceNodeIds: ["source:b"],
          parentEvidenceRelationshipIds: ["rel:z"],
          transformationSteps: ["knowledge_compile"],
        },
      },
      {
        id: "claim:a",
        claimType: "existence",
        subjectNodeId: "kn:source:a",
        statement: "a",
        confidence: 1,
        evidenceNodeIds: ["source:a"],
        evidenceRelationshipIds: ["rel:a"],
        metadata: {},
        lineage: {
          sourceId: "a",
          parentClaimIds: [],
          parentEvidenceNodeIds: ["source:a"],
          parentEvidenceRelationshipIds: ["rel:a"],
          transformationSteps: ["knowledge_compile"],
        },
      },
    ],
  );

  assert.deepEqual(graph.nodes.map((node) => node.id), ["kn:source:a", "kn:source:b"]);
  assert.deepEqual(graph.relationships.map((relationship) => relationship.id), ["krel:a", "krel:z"]);
  assert.deepEqual(graph.claims.map((claim) => claim.id), ["claim:a", "claim:z"]);
});
