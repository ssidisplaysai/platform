import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphHasher } from "../../../src/compiler/evidence/EvidenceGraphHasher";
import type { EvidenceIR } from "../../../src/compiler/evidence/EvidenceIR";
import { KnowledgeCompiler } from "../../../src/compiler/knowledge/KnowledgeCompiler";

function buildEvidenceIR(): EvidenceIR {
  const graph = new EvidenceGraph(
    [
      {
        id: "source:s1",
        nodeType: "source",
        sourceId: "s1",
        sourceType: "markdown",
        origin: "s1.md",
        confidence: 1,
        metadata: { source: true },
        lineage: { sourceId: "s1", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "artifact:a1",
        nodeType: "artifact",
        sourceId: "s1",
        artifactId: "a1",
        versionId: "v1",
        sourceType: "markdown",
        origin: "s1.md",
        checksum: "h1",
        confidence: 0.95,
        metadata: { artifact: true },
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

test("repeated compilation produces identical KnowledgeIR", () => {
  const compiler = new KnowledgeCompiler();
  const evidenceIR = buildEvidenceIR();

  const first = compiler.compile(evidenceIR);
  const second = compiler.compile(evidenceIR);

  assert.equal(first.deterministicHash, second.deterministicHash);
  assert.equal(JSON.stringify(first.graph.toObject()), JSON.stringify(second.graph.toObject()));
  assert.deepEqual(first, second);
});
