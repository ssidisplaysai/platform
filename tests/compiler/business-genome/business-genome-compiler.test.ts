import assert from "node:assert/strict";
import test from "node:test";
import type {
  KnowledgeEntity,
  KnowledgeFact,
  KnowledgeIR,
  KnowledgeRelationship,
  KnowledgeConflict,
} from "../../../src/compiler/knowledge/KnowledgeIR";
import { BusinessGenomeCompiler } from "../../../src/compiler/business-genome/BusinessGenomeCompiler";

function baseTemporal() {
  return {
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: null,
    observedAt: "2026-01-01T00:00:00.000Z",
    compiledAt: "2026-01-01T00:00:00.000Z",
    supersedes: null,
    supersededBy: null,
  } as const;
}

function baseConfidence(value = 0.8) {
  return {
    initial: value,
    current: value,
    method: "fixture",
    factors: {},
    lastUpdated: "2026-01-01T00:00:00.000Z",
    evidenceConfidence: value,
    corroborationCount: 2,
    sourceDiversity: 2,
    sourceRecency: 1,
    conflictState: "resolved" as const,
    validationResult: "valid" as const,
    qualityScore: value,
    rationale: ["fixture"],
  };
}

function baseVersion() {
  return {
    semver: "1.0.0",
    revision: 1,
    timestamp: "2026-01-01T00:00:00.000Z",
    reason: "fixture",
  };
}

function baseProvenance() {
  return {
    sourceEvidenceId: "ev-1",
    sourceEvidenceIdentity: "ev-1",
    sourceDocument: "interview.md",
    sourceInterviewId: "int-1",
    sourceType: "markdown",
    sourceOrigin: "interview.md",
    compilerStage: "stage-3-knowledge-compiler",
    compilerVersion: "1.0.1",
    transformationVersion: "1.0.1",
    validationResult: "valid" as const,
  };
}

function baseLineage(sourceKnowledgeId: string) {
  return {
    sourceEvidenceId: "ev-1",
    contributingEvidenceIds: ["ev-1", "ev-2"],
    compilerVersion: "1.0.1",
    compiledAt: "2026-01-01T00:00:00.000Z",
    stage: "knowledge_compile",
    tracePath: ["stage-1-evidence", "knowledge_compile"],
    sourceKnowledgeId,
  };
}

function buildKnowledgeIR(): KnowledgeIR {
  const entityA: KnowledgeEntity = {
    kind: "entity",
    knowledgeId: "k-entity-a",
    identity: "k-entity-a",
    canonicalName: "Operations Team",
    canonicalContent: "Role owner capability process policy rule responsibility resource event metric objective",
    evidenceIds: ["ev-1", "ev-2"],
    provenance: baseProvenance(),
    lineage: baseLineage("k-entity-a"),
    confidence: baseConfidence(0.84),
    temporalValidity: baseTemporal(),
    version: baseVersion(),
    metadata: { domain: "operations" },
    entityType: "organization",
    factIds: ["k-fact-1"],
    relationshipIds: ["k-rel-1"],
    clusterIds: ["k-cluster-1"],
  };

  const entityB: KnowledgeEntity = {
    kind: "entity",
    knowledgeId: "k-entity-b",
    identity: "k-entity-b",
    canonicalName: "Platform System",
    canonicalContent: "Resource system supports workflow event trigger",
    evidenceIds: ["ev-3"],
    provenance: { ...baseProvenance(), sourceEvidenceId: "ev-3", sourceEvidenceIdentity: "ev-3" },
    lineage: baseLineage("k-entity-b"),
    confidence: baseConfidence(0.76),
    temporalValidity: baseTemporal(),
    version: baseVersion(),
    metadata: { domain: "platform" },
    entityType: "system",
    factIds: ["k-fact-2"],
    relationshipIds: ["k-rel-1"],
    clusterIds: ["k-cluster-1"],
  };

  const fact1: KnowledgeFact = {
    kind: "fact",
    knowledgeId: "k-fact-1",
    identity: "k-fact-1",
    canonicalName: "Policy Statement",
    canonicalContent: "Policy rule must enforce capability process metric objective",
    evidenceIds: ["ev-1"],
    provenance: baseProvenance(),
    lineage: baseLineage("k-fact-1"),
    confidence: baseConfidence(0.82),
    temporalValidity: baseTemporal(),
    version: baseVersion(),
    metadata: { source: "interview" },
    subjectEntityId: "k-entity-a",
    canonicalStatement: "Policy requires deterministic process and metrics",
    evidenceNodeIds: ["ev-node-1"],
    relationshipIds: ["k-rel-1"],
    conflictIds: ["k-conf-1"],
  };

  const fact2: KnowledgeFact = {
    ...fact1,
    knowledgeId: "k-fact-2",
    identity: "k-fact-2",
    canonicalName: "Workflow Trigger",
    canonicalContent: "Event trigger starts workflow process and allocates resource",
    subjectEntityId: "k-entity-b",
    conflictIds: [],
  };

  const relationship: KnowledgeRelationship = {
    kind: "relationship",
    knowledgeId: "k-rel-1",
    identity: "k-rel-1",
    canonicalName: "supports",
    canonicalContent: "Operations Team supports Platform System",
    evidenceIds: ["ev-2"],
    provenance: baseProvenance(),
    lineage: {
      ...baseLineage("k-rel-1"),
      parentKnowledgeRelationshipIds: [],
      parentEvidenceRelationshipIds: [],
    },
    confidence: baseConfidence(0.8),
    temporalValidity: baseTemporal(),
    version: baseVersion(),
    metadata: {},
    sourceEntityId: "k-entity-a",
    targetEntityId: "k-entity-b",
    relationshipType: "supports",
    relationshipId: "k-rel-1",
    conflictIds: [],
  };

  const conflict: KnowledgeConflict = {
    kind: "conflict",
    knowledgeId: "k-conf-1",
    identity: "k-conf-1",
    canonicalName: "Policy Conflict",
    canonicalContent: "Conflicting policy assertions",
    evidenceIds: ["ev-1", "ev-2"],
    provenance: baseProvenance(),
    lineage: baseLineage("k-conf-1"),
    confidence: baseConfidence(0.5),
    temporalValidity: baseTemporal(),
    version: baseVersion(),
    metadata: {},
    conflictType: "contradictory_fact",
    status: "non_blocking",
    required: false,
    blocking: false,
    entityIds: ["k-entity-a", "k-entity-b"],
    relationshipIds: ["k-rel-1"],
  };

  return {
    schemaVersion: "1.0.0",
    graph: undefined as never,
    claimCount: 2,
    compiledFromEvidenceHash: "evidence-hash",
    generatedAt: "2026-01-01T00:00:00.000Z",
    deterministicHash: "1".repeat(64),
    compilationContext: {
      compilerVersion: "1.0.1",
      pipelineVersion: "1.0.1",
      compiledAt: "2026-01-01T00:00:00.000Z",
      sourceEvidenceHash: "evidence-hash",
      sourceEvidenceCount: 3,
      sourceTypes: ["markdown"],
      sourceIds: ["int-1"],
    },
    entities: [entityA, entityB],
    facts: [fact1, fact2],
    relationships: [relationship],
    clusters: [],
    conflicts: [conflict],
    temporalValidity: [baseTemporal()],
    diagnostics: [],
    metrics: undefined,
    claims: [],
    sourceNodes: [
      {
        id: "kn-source-1",
        nodeType: "artifact_record",
        sourceId: "int-1",
        sourceType: "markdown",
        origin: "interview.md",
        confidence: 1,
        evidenceNodeId: "ev-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        modifiedAt: "2026-01-01T00:00:00.000Z",
        discoveredAt: "2026-01-01T00:00:00.000Z",
        metadata: {},
        lineage: {
          sourceId: "int-1",
          parentKnowledgeNodeIds: [],
          parentEvidenceNodeIds: [],
          transformationSteps: [],
        },
      },
    ],
  };
}

test("business genome compiler projects entities and relationships", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildKnowledgeIR());

  assert.equal(result.businessGenome.entities.length, 2);
  assert.equal(result.businessGenome.relationships.length, 1);
});

test("compiler extracts capability/process/policy/role/responsibility artifacts", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildKnowledgeIR());

  assert.equal(result.businessGenome.capabilities.length > 0, true);
  assert.equal(result.businessGenome.processes.length > 0, true);
  assert.equal(result.businessGenome.policies.length > 0, true);
  assert.equal(result.businessGenome.rules.length > 0, true);
  assert.equal(result.businessGenome.roles.length > 0, true);
  assert.equal(result.businessGenome.responsibilities.length > 0, true);
});

test("compiler identifies resources/events/workflows/constraints/metrics/objectives", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildKnowledgeIR());

  assert.equal(result.businessGenome.resources.length > 0, true);
  assert.equal(result.businessGenome.events.length > 0, true);
  assert.equal(result.businessGenome.workflows.length > 0, true);
  assert.equal(result.businessGenome.constraints.length > 0, true);
  assert.equal(result.businessGenome.metrics.length > 0, true);
  assert.equal(result.businessGenome.objectives.length > 0, true);
});

test("compiler preserves conflicts and confidence deterministically", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildKnowledgeIR());

  assert.equal(result.businessGenome.conflicts.length, 1);
  assert.equal(result.businessGenome.conflicts[0].status, "non_blocking");
  assert.equal(result.businessGenome.entities[0].confidence.current > 0, true);
});

test("compiler preserves provenance and lineage on all projected objects", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildKnowledgeIR());

  for (const entity of result.businessGenome.entities) {
    assert.equal(Boolean(entity.provenance.sourceKnowledgeId), true);
    assert.equal(entity.lineage.transformationPath.includes("stage-4-business-genome-compiler"), true);
  }
});

test("compiler output is immutable", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildKnowledgeIR());

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.businessGenome), true);
  assert.throws(() => {
    (result.businessGenome.entities as unknown as unknown[]).push({} as never);
  }, /object is not extensible|read only|frozen/i);
});

test("input-order determinism yields stable genome ids and serialization", () => {
  const compiler = new BusinessGenomeCompiler();
  const base = buildKnowledgeIR();
  const reversed: KnowledgeIR = {
    ...base,
    entities: [...(base.entities ?? [])].reverse(),
    facts: [...(base.facts ?? [])].reverse(),
    relationships: [...(base.relationships ?? [])].reverse(),
    conflicts: [...(base.conflicts ?? [])].reverse(),
  };

  const first = compiler.compile(base);
  const second = compiler.compile(reversed);

  assert.equal(first.deterministicHash, second.deterministicHash);
  assert.deepEqual(
    first.businessGenome.entities.map((entry) => entry.identity.id),
    second.businessGenome.entities.map((entry) => entry.identity.id),
  );
  assert.equal(first.deterministicSerialization, second.deterministicSerialization);
});
