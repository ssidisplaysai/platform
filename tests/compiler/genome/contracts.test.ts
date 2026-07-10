import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphHasher } from "../../../src/compiler/evidence/EvidenceGraphHasher";
import type { EvidenceIR } from "../../../src/compiler/evidence/EvidenceIR";
import {
  BUSINESS_GENOME_RELATIONSHIP_CLASSES,
  BUSINESS_GENOME_SEMANTIC_CLASSES,
  checksumBusinessGenomeArtifact,
  deterministicSemanticGraphSerialization,
  isBusinessGenomeRelationshipClass,
  isBusinessGenomeSemanticClass,
  toDeterministicSemanticGraph,
  type BusinessGenomeCompilerInput,
  type SemanticObject,
  type SemanticRelationship,
} from "../../../src/compiler/genome";

function buildEvidenceIR(): EvidenceIR {
  const graph = new EvidenceGraph(
    [
      {
        id: "source:s1",
        nodeType: "source",
        sourceId: "s1",
        sourceType: "markdown",
        origin: "fixture.md",
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
        origin: "fixture.md",
        checksum: "h1",
        confidence: 0.9,
        metadata: {},
        lineage: { sourceId: "s1", parentNodeIds: ["source:s1"], transformationSteps: [] },
      },
    ],
    [
      {
        id: "rel:source:s1->artifact:a1",
        from: "source:s1",
        to: "artifact:a1",
        relationshipType: "produced",
        sourceId: "s1",
        metadata: {},
        lineage: { sourceId: "s1", parentRelationshipIds: [], transformationSteps: [] },
      },
    ],
  );

  const hasher = new EvidenceGraphHasher();
  const hashMaterial = {
    schemaVersion: "1.0.0" as const,
    graph,
    artifactCount: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
  };

  return {
    ...hashMaterial,
    deterministicHash: hasher.hashIR(hashMaterial),
  };
}

function semanticObject(id: string): SemanticObject {
  return {
    id,
    semanticClass: "organization",
    canonicalName: `Org ${id}`,
    assertions: { key: "value" },
    certainty: { state: "certain", confidence: 1 },
    conflict: { hasConflict: false, conflictingEvidenceItemIds: [], notes: [] },
    provenance: {
      evidenceItemIds: ["artifact:a1"],
      discoveryQuestionIds: ["q1"],
      discoveryAnswerIds: ["a1"],
      sourceDocumentIds: ["source:s1"],
      transformationSteps: ["input_validation"],
      compilerStage: "genome-contract-test",
      validationStatus: { valid: true, violations: [] },
      versionContext: {
        specificationVersion: "1.0.0",
        compilerVersion: "1.0.0",
        evidenceIrSchemaVersion: "1.0.0",
      },
    },
    validationStatus: { valid: true, violations: [] },
    version: "1.0.0",
  };
}

function semanticRelationship(id: string, sourceSemanticId: string, targetSemanticId: string): SemanticRelationship {
  return {
    id,
    relationshipClass: "dependency",
    sourceSemanticId,
    targetSemanticId,
    certainty: { state: "uncertain", confidence: 0.75 },
    conflict: { hasConflict: false, conflictingEvidenceItemIds: [], notes: [] },
    provenance: {
      evidenceItemIds: ["artifact:a1"],
      discoveryQuestionIds: ["q1"],
      discoveryAnswerIds: ["a1"],
      sourceDocumentIds: ["source:s1"],
      transformationSteps: ["relationship_resolution"],
      compilerStage: "genome-contract-test",
      validationStatus: { valid: true, violations: [] },
      versionContext: {
        specificationVersion: "1.0.0",
        compilerVersion: "1.0.0",
        evidenceIrSchemaVersion: "1.0.0",
      },
    },
    validationStatus: { valid: true, violations: [] },
    version: "1.0.0",
  };
}

test("semantic classes are restricted to approved BGS-0001 constructs", () => {
  assert.equal(BUSINESS_GENOME_SEMANTIC_CLASSES.length, 19);
  assert.equal(isBusinessGenomeSemanticClass("actor"), true);
  assert.equal(isBusinessGenomeSemanticClass("business-rule"), true);
  assert.equal(isBusinessGenomeSemanticClass("relationship"), false);
});

test("relationship classes are restricted to narrower approved constructs", () => {
  assert.deepEqual(BUSINESS_GENOME_RELATIONSHIP_CLASSES, [
    "ownership",
    "dependency",
    "participation",
    "composition",
    "aggregation",
    "reference",
    "containment",
    "lifecycle",
    "influence",
  ]);
  assert.equal(isBusinessGenomeRelationshipClass("dependency"), true);
  assert.equal(isBusinessGenomeRelationshipClass("association"), false);
  assert.equal(isBusinessGenomeRelationshipClass("inheritance"), false);
});

test("semantic objects require identity and provenance contract fields", () => {
  const object = semanticObject("sem:org:1");
  assert.equal(object.id.length > 0, true);
  assert.equal(object.provenance.evidenceItemIds.length > 0, true);
  assert.equal(object.provenance.sourceDocumentIds.length > 0, true);
});

test("semantic relationships require valid endpoint identities", () => {
  const graph = {
    semanticObjects: [semanticObject("sem:org:1"), semanticObject("sem:org:2")],
    semanticRelationships: [semanticRelationship("srel:1", "sem:org:1", "sem:org:2")],
  };

  const canonical = toDeterministicSemanticGraph(graph);
  assert.equal(canonical.semanticRelationships.length, 1);

  assert.throws(() => {
    toDeterministicSemanticGraph({
      semanticObjects: [semanticObject("sem:org:1")],
      semanticRelationships: [semanticRelationship("srel:bad", "sem:org:1", "sem:missing")],
    });
  }, /unresolved endpoints/);
});

test("BusinessGenome compiler input accepts Evidence IR", () => {
  const input: BusinessGenomeCompilerInput = {
    evidenceIR: buildEvidenceIR(),
    evidenceIrIdentity: "source_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_v1",
    compilerContext: {
      sessionId: "session-1",
      pipelineVersion: "1.0.0",
    },
    compilerVersion: "1.0.0",
    specificationVersion: "1.0.0",
    upstreamValidation: {
      status: "valid",
      validator: "evidence-validator",
    },
    canonicalMetadata: {
      gps0001Version: "1.0",
      gps0002Version: "1.0",
      canonicalizationVersion: "1.0",
      identityStandardVersion: "1.0",
      canonicalValidationStatus: "verified",
      checksumReferences: ["abc"],
    },
  };

  assert.equal(input.evidenceIR.schemaVersion, "1.0.0");
  assert.equal(input.evidenceIR.artifactCount, 1);
});

test("canonical graph serialization is deterministic for equivalent fixtures", () => {
  const objectA = semanticObject("sem:org:1");
  const objectB = semanticObject("sem:org:2");
  const relationship = semanticRelationship("srel:1", objectA.id, objectB.id);

  const first = deterministicSemanticGraphSerialization({
    semanticObjects: [objectA, objectB],
    semanticRelationships: [relationship],
  });

  const second = deterministicSemanticGraphSerialization({
    semanticObjects: [objectB, objectA],
    semanticRelationships: [relationship],
  });

  assert.equal(first, second);
});

test("equivalent BusinessGenome artifact fixtures checksum deterministically", () => {
  const objectA = semanticObject("sem:org:1");
  const objectB = semanticObject("sem:org:2");
  const relationship = semanticRelationship("srel:1", objectA.id, objectB.id);

  const baseArtifact = {
    id: "bg:artifact:1",
    version: "1.0.0",
    specificationVersion: "1.0.0",
    compilerVersion: "1.0.0",
    semanticGraph: {
      semanticObjects: [objectA, objectB],
      semanticRelationships: [relationship],
    },
    validationResult: { valid: true, violations: [] },
    diagnostics: [],
    provenanceIndex: {
      [objectA.id]: ["artifact:a1"],
      [objectB.id]: ["artifact:a1"],
    },
    manifestReference: "manifest:1",
  };

  const first = checksumBusinessGenomeArtifact(baseArtifact);
  const second = checksumBusinessGenomeArtifact({
    ...baseArtifact,
    semanticGraph: {
      semanticObjects: [objectB, objectA],
      semanticRelationships: [relationship],
    },
  });

  assert.equal(first, second);
});
