import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphHasher } from "../../../src/compiler/evidence/EvidenceGraphHasher";
import type { EvidenceIR } from "../../../src/compiler/evidence/EvidenceIR";
import { KnowledgeCompiler } from "../../../src/compiler/knowledge/KnowledgeCompiler";

function buildEvidenceIR(order: "forward" | "reverse" = "forward"): EvidenceIR {
  const nodes = [
    {
      id: "source:s1",
      nodeType: "source" as const,
      sourceId: "s1",
      sourceType: "markdown" as const,
      origin: "s1.md",
      confidence: 1,
      metadata: { category: "source" },
      lineage: { sourceId: "s1", parentNodeIds: [], transformationSteps: [] },
    },
    {
      id: "artifact:a1:primary",
      nodeType: "artifact" as const,
      sourceId: "s1",
      artifactId: "a1",
      versionId: "v1",
      sourceType: "markdown" as const,
      origin: "s1.md",
      checksum: "h1",
      confidence: 0.95,
      metadata: { category: "artifact-primary" },
      lineage: { sourceId: "s1", parentNodeIds: ["source:s1"], transformationSteps: [] },
    },
    {
      id: "artifact:a1:secondary",
      nodeType: "artifact" as const,
      sourceId: "s1",
      artifactId: "a1",
      versionId: "v1",
      sourceType: "markdown" as const,
      origin: "s1.md",
      checksum: "h2",
      confidence: 0.7,
      metadata: { category: "artifact-secondary" },
      lineage: { sourceId: "s1", parentNodeIds: ["source:s1"], transformationSteps: [] },
    },
  ];

  const relationships = [
    {
      id: "rel:source:s1->artifact:a1:primary",
      from: "source:s1",
      to: "artifact:a1:primary",
      relationshipType: "produced" as const,
      sourceId: "s1",
      metadata: { confidenceBand: "high" },
      lineage: { sourceId: "s1", parentRelationshipIds: [], transformationSteps: [] },
    },
    {
      id: "rel:source:s1->artifact:a1:secondary",
      from: "source:s1",
      to: "artifact:a1:secondary",
      relationshipType: "produced" as const,
      sourceId: "s1",
      metadata: { confidenceBand: "medium" },
      lineage: { sourceId: "s1", parentRelationshipIds: [], transformationSteps: [] },
    },
  ];

  const graph = new EvidenceGraph(order === "forward" ? nodes : [...nodes].reverse(), order === "forward" ? relationships : [...relationships].reverse());
  const hasher = new EvidenceGraphHasher();
  const hashMaterial = {
    schemaVersion: "1.0.0" as const,
    graph,
    artifactCount: 2,
    generatedAt: "2026-01-01T00:00:00.000Z",
  };

  return {
    ...hashMaterial,
    deterministicHash: hasher.hashIR(hashMaterial),
  };
}

test("knowledge compiler is deterministic across input order", () => {
  const compiler = new KnowledgeCompiler();

  const forward = compiler.compile(buildEvidenceIR("forward"));
  const reverse = compiler.compile(buildEvidenceIR("reverse"));

  assert.equal(forward.deterministicHash, reverse.deterministicHash);
  assert.deepEqual(forward.entities?.map((entity) => entity.identity), reverse.entities?.map((entity) => entity.identity));
  assert.deepEqual(forward.facts?.map((fact) => fact.identity), reverse.facts?.map((fact) => fact.identity));
  assert.deepEqual(forward.conflicts?.map((conflict) => conflict.identity), reverse.conflicts?.map((conflict) => conflict.identity));
});

test("knowledge compiler preserves duplicate evidence as canonical conflict information", () => {
  const compiler = new KnowledgeCompiler();
  const result = compiler.compile(buildEvidenceIR());

  assert.equal(result.clusters?.length, 1);
  assert.equal(result.entities?.length, 1);
  assert.equal(result.facts?.length, 2);
  assert.equal(result.conflicts?.length, 1);
  assert.equal(result.metrics?.duplicateClaimsConsolidated, 1);
  assert.equal(result.metrics?.blockingConflicts, 1);
  assert.equal(result.clusters?.[0]?.resolved, false);
  assert.equal(result.clusters?.[0]?.resolutionState, "blocking");
  assert.deepEqual(result.clusters?.[0]?.conflictIds, result.conflicts?.map((conflict) => conflict.identity));
});

test("knowledge compiler preserves non-blocking conflicts as represented artifacts", () => {
  const graph = new EvidenceGraph(
    [
      {
        id: "source:s1",
        nodeType: "source",
        sourceId: "s1",
        sourceType: "markdown",
        origin: "s1.md",
        confidence: 1,
        metadata: { category: "source" },
        lineage: { sourceId: "s1", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "artifact:a1:low",
        nodeType: "artifact",
        sourceId: "s1",
        artifactId: "a1",
        versionId: "v1",
        sourceType: "markdown",
        origin: "s1.md",
        checksum: "same-checksum",
        confidence: 0.55,
        metadata: { category: "artifact-low" },
        lineage: { sourceId: "s1", parentNodeIds: ["source:s1"], transformationSteps: [] },
      },
      {
        id: "artifact:a1:high",
        nodeType: "artifact",
        sourceId: "s1",
        artifactId: "a1",
        versionId: "v1",
        sourceType: "markdown",
        origin: "s1.md",
        checksum: "same-checksum",
        confidence: 0.88,
        metadata: { category: "artifact-high" },
        lineage: { sourceId: "s1", parentNodeIds: ["source:s1"], transformationSteps: [] },
      },
    ],
    [
      {
        id: "rel:source:s1->artifact:a1:low",
        from: "source:s1",
        to: "artifact:a1:low",
        relationshipType: "produced",
        sourceId: "s1",
        metadata: {},
        lineage: { sourceId: "s1", parentRelationshipIds: [], transformationSteps: [] },
      },
      {
        id: "rel:source:s1->artifact:a1:high",
        from: "source:s1",
        to: "artifact:a1:high",
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
    artifactCount: 2,
    generatedAt: "2026-01-01T00:00:00.000Z",
  };

  const compiler = new KnowledgeCompiler();
  const result = compiler.compile({
    ...hashMaterial,
    deterministicHash: hasher.hashIR(hashMaterial),
  });

  assert.equal(result.conflicts?.length, 1);
  assert.equal(result.conflicts?.[0]?.status, "non_blocking");
  assert.equal(result.conflicts?.[0]?.blocking, false);
  assert.equal(result.metrics?.blockingConflicts, 0);
  assert.equal(result.clusters?.[0]?.resolutionState, "non_blocking");
  assert.equal(result.clusters?.[0]?.resolved, true);
});

test("knowledge compiler returns an immutable canonical snapshot", () => {
  const compiler = new KnowledgeCompiler();
  const result = compiler.compile(buildEvidenceIR());

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.entities), true);
  assert.equal(Object.isFrozen(result.facts), true);
  assert.equal(Object.isFrozen(result.relationships), true);
  assert.equal(Object.isFrozen(result.clusters), true);

  assert.throws(() => {
    (result.entities as unknown as unknown[]).push({} as never);
  }, /object is not extensible|read only|frozen/i);
});