import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphHasher } from "../../../src/compiler/evidence/EvidenceGraphHasher";
import type { EvidenceIR } from "../../../src/compiler/evidence/EvidenceIR";
import type { BusinessGenomeCompilerInput } from "../../../src/compiler/genome";

export function buildEvidenceIR(overrides?: {
  metadata?: Record<string, unknown>;
  deterministicHash?: string;
}): EvidenceIR {
  const metadata = {
    gps0001Version: "1.0",
    gps0002Version: "1.0",
    canonicalizationVersion: "1.0",
    canonicalValidationStatus: "verified",
    ...(overrides?.metadata ?? {}),
  };

  const graph = new EvidenceGraph(
    [
      {
        id: "source:source-a",
        nodeType: "source",
        sourceId: "source-a",
        sourceType: "markdown",
        origin: "fixture-a.md",
        confidence: 1,
        metadata,
        lineage: { sourceId: "source-a", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "artifact:artifact-a",
        nodeType: "artifact",
        sourceId: "source-a",
        artifactId: "artifact-a",
        versionId: "v1",
        sourceType: "markdown",
        origin: "fixture-a.md",
        checksum: "checksum-a",
        confidence: 0.9,
        metadata: {
          ...metadata,
          questionId: "q1",
          answerId: "a1",
          category: "observation",
          context: "sales",
          canonicalTopic: "topic-a",
        },
        lineage: { sourceId: "source-a", parentNodeIds: ["source:source-a"], transformationSteps: [] },
      },
      {
        id: "source:source-b",
        nodeType: "source",
        sourceId: "source-b",
        sourceType: "markdown",
        origin: "fixture-b.md",
        confidence: 1,
        metadata,
        lineage: { sourceId: "source-b", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "artifact:artifact-b",
        nodeType: "artifact",
        sourceId: "source-b",
        artifactId: "artifact-b",
        versionId: "v1",
        sourceType: "markdown",
        origin: "fixture-b.md",
        checksum: "checksum-b",
        confidence: 0.8,
        metadata: {
          ...metadata,
          questionId: "q2",
          answerId: "a2",
          category: "constraint",
          context: "operations",
          canonicalTopic: "topic-b",
        },
        lineage: { sourceId: "source-b", parentNodeIds: ["source:source-b"], transformationSteps: [] },
      },
    ],
    [
      {
        id: "rel:source:source-a->artifact:artifact-a",
        from: "source:source-a",
        to: "artifact:artifact-a",
        relationshipType: "produced",
        sourceId: "source-a",
        metadata: {},
        lineage: { sourceId: "source-a", parentRelationshipIds: [], transformationSteps: [] },
      },
      {
        id: "rel:source:source-b->artifact:artifact-b",
        from: "source:source-b",
        to: "artifact:artifact-b",
        relationshipType: "produced",
        sourceId: "source-b",
        metadata: {},
        lineage: { sourceId: "source-b", parentRelationshipIds: [], transformationSteps: [] },
      },
    ],
  );

  const hasher = new EvidenceGraphHasher();
  const hashMaterial = {
    schemaVersion: "1.0.0" as const,
    graph,
    artifactCount: 2,
    generatedAt: "2026-01-01T00:00:00.000Z",
  };

  return {
    ...hashMaterial,
    deterministicHash: overrides?.deterministicHash ?? hasher.hashIR(hashMaterial),
  };
}

export function buildCompilerInput(overrides?: Partial<BusinessGenomeCompilerInput>): BusinessGenomeCompilerInput {
  const base: BusinessGenomeCompilerInput = {
    evidenceIR: buildEvidenceIR(),
    evidenceIrIdentity: "source_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa_v1",
    compilerContext: {
      sessionId: "bgc-session-1",
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
      checksumReferences: ["checksum-a", "checksum-b"],
    },
  };

  return {
    ...base,
    ...overrides,
    compilerContext: {
      ...base.compilerContext,
      ...(overrides?.compilerContext ?? {}),
    },
    upstreamValidation: {
      ...base.upstreamValidation,
      ...(overrides?.upstreamValidation ?? {}),
    },
    canonicalMetadata: {
      ...base.canonicalMetadata,
      ...(overrides?.canonicalMetadata ?? {}),
    },
  };
}
