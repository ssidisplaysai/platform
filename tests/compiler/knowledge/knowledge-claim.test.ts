import assert from "node:assert/strict";
import test from "node:test";
import type { KnowledgeClaim } from "../../../src/compiler/knowledge/KnowledgeClaim";

test("knowledge claim preserves evidence references", () => {
  const claim: KnowledgeClaim = {
    id: "claim:artifact:a1",
    claimType: "existence",
    subjectNodeId: "kn:artifact:a1",
    statement: "Evidence artifact a1 exists from source s1",
    confidence: 0.92,
    evidenceNodeIds: ["source:s1", "artifact:a1"],
    evidenceRelationshipIds: ["rel:source:s1->artifact:a1"],
    metadata: {},
    lineage: {
      sourceId: "s1",
      parentClaimIds: [],
      parentEvidenceNodeIds: ["source:s1", "artifact:a1"],
      parentEvidenceRelationshipIds: ["rel:source:s1->artifact:a1"],
      transformationSteps: ["knowledge_compile"],
    },
  };

  assert.equal(claim.claimType, "existence");
  assert.equal(claim.evidenceNodeIds.length, 2);
  assert.equal(claim.evidenceRelationshipIds.length, 1);
});
