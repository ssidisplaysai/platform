import assert from "node:assert/strict";
import test from "node:test";
import { KnowledgeGraph } from "../../../src/compiler/knowledge/KnowledgeGraph";
import { KnowledgeGraphHasher } from "../../../src/compiler/knowledge/KnowledgeGraphHasher";
import { KnowledgeValidationError, KnowledgeValidator } from "../../../src/compiler/knowledge/KnowledgeValidator";

test("knowledge validator accepts valid IR", () => {
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
        confidence: 0.8,
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
          parentEvidenceRelationshipIds: [],
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
        confidence: 0.8,
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

  const hasher = new KnowledgeGraphHasher();
  const hashMaterial = {
    schemaVersion: "1.0.0" as const,
    graph,
    claimCount: 1,
    compiledFromEvidenceHash: "evidence-hash",
    generatedAt: "2026-01-01T00:00:00.000Z",
  };

  const ir = {
    ...hashMaterial,
    deterministicHash: hasher.hashIR(hashMaterial),
  };

  const validator = new KnowledgeValidator();
  validator.validateIR(ir);
  assert.equal(true, true);
});

test("knowledge validator fails with typed errors on invalid states", () => {
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
    ],
    [],
    [
      {
        id: "claim:invalid",
        claimType: "existence",
        subjectNodeId: "kn:missing",
        statement: "invalid claim",
        confidence: 2,
        evidenceNodeIds: [],
        evidenceRelationshipIds: [],
        metadata: {},
        lineage: {
          sourceId: "s1",
          parentClaimIds: [],
          parentEvidenceNodeIds: [],
          parentEvidenceRelationshipIds: [],
          transformationSteps: ["knowledge_compile"],
        },
      },
    ],
  );

  const validator = new KnowledgeValidator();

  assert.throws(() => validator.validateGraph(graph), (error: unknown) => {
    return error instanceof KnowledgeValidationError && error.code === "MISSING_CLAIM_SUBJECT";
  });
});
