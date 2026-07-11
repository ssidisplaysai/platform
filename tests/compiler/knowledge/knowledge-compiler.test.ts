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
        metadata: { category: "source" },
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
        confidence: 0.9,
        metadata: { category: "artifact" },
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
        metadata: { confidenceBand: "high" },
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

test("knowledge compiler transforms EvidenceGraph into KnowledgeGraph", () => {
  const compiler = new KnowledgeCompiler();
  const ir = compiler.compile(buildEvidenceIR());

  assert.equal(ir.schemaVersion, "1.0.0");
  assert.equal(ir.graph.nodes.length, 2);
  assert.equal(ir.graph.relationships.length, 1);
  assert.equal(ir.graph.claims.length, 1);
  assert.equal(ir.claimCount, 1);
  assert.equal(ir.compiledFromEvidenceHash.length > 0, true);

  const claim = ir.graph.claims[0];
  assert.equal(Boolean(claim), true);
  assert.deepEqual(claim?.evidenceNodeIds, ["artifact:a1", "source:s1"]);
  assert.deepEqual(claim?.evidenceRelationshipIds, ["rel:source:s1->artifact:a1"]);
});
