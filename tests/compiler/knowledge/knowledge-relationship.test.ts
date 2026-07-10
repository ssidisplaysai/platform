import assert from "node:assert/strict";
import test from "node:test";
import type { KnowledgeRelationship } from "../../../src/compiler/knowledge/KnowledgeRelationship";

test("knowledge relationship links knowledge and evidence lineage", () => {
  const relationship: KnowledgeRelationship = {
    id: "krel:rel:1",
    from: "kn:source:s1",
    to: "kn:artifact:a1",
    relationshipType: "supported_by",
    sourceId: "s1",
    evidenceRelationshipId: "rel:1",
    metadata: {},
    lineage: {
      sourceId: "s1",
      parentKnowledgeRelationshipIds: [],
      parentEvidenceRelationshipIds: ["rel:0"],
      transformationSteps: ["knowledge_compile"],
    },
  };

  assert.equal(relationship.relationshipType, "supported_by");
  assert.equal(relationship.evidenceRelationshipId, "rel:1");
  assert.deepEqual(relationship.lineage.parentEvidenceRelationshipIds, ["rel:0"]);
});
