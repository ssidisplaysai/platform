import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceRelationship } from "../../../src/compiler/evidence/EvidenceRelationship";

test("evidence relationship carries lineage and type", () => {
  const relationship: EvidenceRelationship = {
    id: "rel:1",
    from: "source:s-1",
    to: "artifact:a-1",
    relationshipType: "produced",
    sourceId: "s-1",
    metadata: { quality: "high" },
    lineage: {
      sourceId: "s-1",
      parentRelationshipIds: [],
      transformationSteps: [],
    },
  };

  assert.equal(relationship.relationshipType, "produced");
  assert.equal(relationship.lineage.sourceId, "s-1");
  assert.deepEqual(relationship.lineage.parentRelationshipIds, []);
});
