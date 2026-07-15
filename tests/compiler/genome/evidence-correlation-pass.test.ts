import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphHasher } from "../../../src/compiler/evidence/EvidenceGraphHasher";
import type { EvidenceIR } from "../../../src/compiler/evidence/EvidenceIR";
import {
  BusinessGenomeCompiler,
  BusinessGenomePassRegistry,
  CanonicalVerificationPass,
  EvidenceCorrelationPass,
  EvidenceGroupingPass,
  InputValidationPass,
} from "../../../src/compiler/genome";
import { buildCompilerInput } from "./helpers";

const inputPass = new InputValidationPass();
const canonicalPass = new CanonicalVerificationPass();
const groupingPass = new EvidenceGroupingPass();
const correlationPass = new EvidenceCorrelationPass();

const CTX = { sessionId: "s-corr-1", pipelineVersion: "1.0.0" };

function groupedEvidence(ir?: EvidenceIR) {
  const input = ir
    ? buildCompilerInput({ evidenceIR: ir, evidenceIrIdentity: buildIRIdentity(ir) })
    : buildCompilerInput();

  const inputResult = inputPass.execute(input, CTX);
  if (inputResult.fatal) throw new Error("InputValidationPass unexpectedly fatal");

  const canonResult = canonicalPass.execute(inputResult.output, CTX);
  if (canonResult.fatal) throw new Error("CanonicalVerificationPass unexpectedly fatal");

  const groupResult = groupingPass.execute(canonResult.output, CTX);
  if (groupResult.fatal) throw new Error("EvidenceGroupingPass unexpectedly fatal");

  return groupResult.output;
}

function buildIRIdentity(ir: EvidenceIR): string {
  const hasher = new EvidenceGraphHasher();
  return `source_${hasher.hashIR(ir)}_v1`;
}

/**
 * Build an Evidence IR where two artifacts share the same declared subject reference
 * so they should be correlated by Rule 2 (identical-subject-reference).
 */
function buildIRWithSharedSubjectReference(): EvidenceIR {
  const metadata = {
    gps0001Version: "1.0",
    gps0002Version: "1.0",
    canonicalizationVersion: "1.0",
    canonicalValidationStatus: "verified",
  };

  const graph = new EvidenceGraph(
    [
      {
        id: "source:src-x",
        nodeType: "source",
        sourceId: "src-x",
        sourceType: "markdown",
        origin: "fixture-x.md",
        confidence: 1,
        metadata,
        lineage: { sourceId: "src-x", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "artifact:art-x",
        nodeType: "artifact",
        sourceId: "src-x",
        artifactId: "art-x",
        versionId: "v1",
        sourceType: "markdown",
        origin: "fixture-x.md",
        checksum: "checksum-x",
        confidence: 0.85,
        metadata: {
          ...metadata,
          questionId: "q-x1",
          answerId: "a-x1",
          category: "observation",
          context: "sales",
          canonicalTopic: "topic-x",
          subjectReference: "acme-corp",
        },
        lineage: { sourceId: "src-x", parentNodeIds: ["source:src-x"], transformationSteps: [] },
      },
      {
        id: "source:src-y",
        nodeType: "source",
        sourceId: "src-y",
        sourceType: "markdown",
        origin: "fixture-y.md",
        confidence: 1,
        metadata,
        lineage: { sourceId: "src-y", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "artifact:art-y",
        nodeType: "artifact",
        sourceId: "src-y",
        artifactId: "art-y",
        versionId: "v1",
        sourceType: "markdown",
        origin: "fixture-y.md",
        checksum: "checksum-y",
        confidence: 0.9,
        metadata: {
          ...metadata,
          questionId: "q-y1",
          answerId: "a-y1",
          category: "constraint",
          context: "operations",
          canonicalTopic: "topic-y",
          subjectReference: "acme-corp",
        },
        lineage: { sourceId: "src-y", parentNodeIds: ["source:src-y"], transformationSteps: [] },
      },
    ],
    [
      {
        id: "rel:src-x->art-x",
        from: "source:src-x",
        to: "artifact:art-x",
        relationshipType: "produced",
        sourceId: "src-x",
        metadata: {},
        lineage: { sourceId: "src-x", parentRelationshipIds: [], transformationSteps: [] },
      },
      {
        id: "rel:src-y->art-y",
        from: "source:src-y",
        to: "artifact:art-y",
        relationshipType: "produced",
        sourceId: "src-y",
        metadata: {},
        lineage: { sourceId: "src-y", parentRelationshipIds: [], transformationSteps: [] },
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

  return { ...hashMaterial, deterministicHash: hasher.hashIR(hashMaterial) };
}

/**
 * Build an Evidence IR where two artifact nodes have an explicit cross-group
 * IR relationship (derived_from), which should trigger Rule 1 correlation.
 */
function buildIRWithCrossGroupRelationship(): EvidenceIR {
  const metadata = {
    gps0001Version: "1.0",
    gps0002Version: "1.0",
    canonicalizationVersion: "1.0",
    canonicalValidationStatus: "verified",
  };

  const graph = new EvidenceGraph(
    [
      {
        id: "source:src-p",
        nodeType: "source",
        sourceId: "src-p",
        sourceType: "markdown",
        origin: "fixture-p.md",
        confidence: 1,
        metadata,
        lineage: { sourceId: "src-p", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "artifact:art-p",
        nodeType: "artifact",
        sourceId: "src-p",
        artifactId: "art-p",
        versionId: "v1",
        sourceType: "markdown",
        origin: "fixture-p.md",
        checksum: "checksum-p",
        confidence: 0.85,
        metadata: {
          ...metadata,
          questionId: "q-p1",
          answerId: "a-p1",
          category: "observation",
          context: "primary",
          canonicalTopic: "topic-primary",
        },
        lineage: { sourceId: "src-p", parentNodeIds: ["source:src-p"], transformationSteps: [] },
      },
      {
        id: "source:src-q",
        nodeType: "source",
        sourceId: "src-q",
        sourceType: "markdown",
        origin: "fixture-q.md",
        confidence: 1,
        metadata,
        lineage: { sourceId: "src-q", parentNodeIds: [], transformationSteps: [] },
      },
      {
        id: "artifact:art-q",
        nodeType: "artifact",
        sourceId: "src-q",
        artifactId: "art-q",
        versionId: "v1",
        sourceType: "markdown",
        origin: "fixture-q.md",
        checksum: "checksum-q",
        confidence: 0.9,
        metadata: {
          ...metadata,
          questionId: "q-q1",
          answerId: "a-q1",
          category: "constraint",
          context: "derived",
          canonicalTopic: "topic-derived",
        },
        lineage: { sourceId: "src-q", parentNodeIds: ["source:src-q"], transformationSteps: [] },
      },
    ],
    [
      {
        id: "rel:src-p->art-p",
        from: "source:src-p",
        to: "artifact:art-p",
        relationshipType: "produced",
        sourceId: "src-p",
        metadata: {},
        lineage: { sourceId: "src-p", parentRelationshipIds: [], transformationSteps: [] },
      },
      {
        id: "rel:src-q->art-q",
        from: "source:src-q",
        to: "artifact:art-q",
        relationshipType: "produced",
        sourceId: "src-q",
        metadata: {},
        lineage: { sourceId: "src-q", parentRelationshipIds: [], transformationSteps: [] },
      },
      // Explicit cross-group IR relationship: art-q is derived from art-p.
      {
        id: "rel:art-p->art-q",
        from: "artifact:art-p",
        to: "artifact:art-q",
        relationshipType: "derived_from",
        sourceId: "src-q",
        metadata: {},
        lineage: { sourceId: "src-q", parentRelationshipIds: ["rel:src-q->art-q"], transformationSteps: [] },
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

  return { ...hashMaterial, deterministicHash: hasher.hashIR(hashMaterial) };
}

// ─── Core Pass Contract Tests ──────────────────────────────────────────────

test("pass metadata declares correct id and dependency", () => {
  assert.equal(correlationPass.metadata.id, "bgc.evidence-correlation");
  assert.deepEqual(correlationPass.metadata.dependencies, ["bgc.evidence-grouping"]);
  assert.equal(correlationPass.metadata.version.length > 0, true);
});

test("pass is registered as BGC-PASS-004 (4th in pipeline order)", () => {
  const registry = new BusinessGenomePassRegistry();
  const ordered = registry.executablePassOrder().map((p) => p.metadata.id);
  assert.equal(ordered.indexOf("bgc.evidence-correlation"), 3);
});

// ─── Base Fixture: No Correlation ─────────────────────────────────────────

test("all evidence is preserved after correlation (no-correlation fixture)", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  assert.equal(result.fatal, false);

  const inputItemIds = grouped.groups.flatMap((g) => g.evidenceItemIds).sort();
  const clusteredItemIds = result.output.clusters.flatMap((c) => c.evidenceItemIds).sort();

  assert.deepEqual(clusteredItemIds, inputItemIds);
});

test("each group appears in exactly one cluster (no-correlation fixture)", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  const allGroupIds = result.output.clusters.flatMap((c) => c.memberGroupIds);
  const uniqueGroupIds = [...new Set(allGroupIds)];

  assert.equal(allGroupIds.length, uniqueGroupIds.length);
  assert.equal(uniqueGroupIds.length, grouped.groups.length);
});

test("uncorrelated groups each form their own singleton cluster", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  // The default fixture has 2 groups with different sources and topics.
  // They should not correlate → 2 singleton clusters.
  assert.equal(result.output.clusters.every((c) => c.memberGroupIds.length === 1), true);
  assert.equal(result.output.clusters.length, grouped.groups.length);
});

// ─── Determinism Tests ────────────────────────────────────────────────────

test("identical inputs produce identical cluster IDs across runs", () => {
  const grouped = groupedEvidence();
  const first = correlationPass.execute(grouped, CTX);
  const second = correlationPass.execute(grouped, CTX);

  assert.deepEqual(
    first.output.clusters.map((c) => c.id),
    second.output.clusters.map((c) => c.id),
  );
});

test("identical inputs produce byte-identical JSON output across runs", () => {
  const grouped = groupedEvidence();
  const first = correlationPass.execute(grouped, CTX);
  const second = correlationPass.execute(grouped, CTX);

  assert.equal(JSON.stringify(first.output), JSON.stringify(second.output));
});

test("permuted group input produces identical cluster output", () => {
  const grouped = groupedEvidence();
  const permuted = {
    ...grouped,
    groups: [...grouped.groups].reverse(),
  };

  const first = correlationPass.execute(grouped, CTX);
  const second = correlationPass.execute(permuted, CTX);

  assert.deepEqual(
    first.output.clusters.map((c) => c.id).sort(),
    second.output.clusters.map((c) => c.id).sort(),
  );
});

test("cluster IDs are stable and do not depend on timestamps or UUIDs", () => {
  const grouped = groupedEvidence();
  const results = [1, 2, 3, 4, 5].map(() => correlationPass.execute(grouped, CTX));
  const idSets = results.map((r) =>
    r.output.clusters
      .map((c) => c.id)
      .sort()
      .join("|"),
  );

  const unique = new Set(idSets);
  assert.equal(unique.size, 1, "All runs should produce identical cluster IDs");
});

// ─── Cluster Ordering ─────────────────────────────────────────────────────

test("clusters are returned in deterministic lexicographic order", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  const ids = result.output.clusters.map((c) => c.id);
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(ids, sorted);
});

test("evidence item IDs within clusters are sorted deterministically", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  for (const cluster of result.output.clusters) {
    const sorted = [...cluster.evidenceItemIds].sort((a, b) => a.localeCompare(b));
    assert.deepEqual([...cluster.evidenceItemIds], sorted);
  }
});

test("member group IDs within clusters are sorted deterministically", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  for (const cluster of result.output.clusters) {
    const sorted = [...cluster.memberGroupIds].sort((a, b) => a.localeCompare(b));
    assert.deepEqual([...cluster.memberGroupIds], sorted);
  }
});

// ─── Provenance Preservation ──────────────────────────────────────────────

test("all provenance references from input groups are present in clusters", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  const inputProvenance = new Set(grouped.groups.flatMap((g) => g.provenanceReferences));
  const clusterProvenance = new Set(result.output.clusters.flatMap((c) => c.provenanceReferences));

  for (const ref of inputProvenance) {
    assert.equal(clusterProvenance.has(ref), true, `Provenance reference missing: ${ref}`);
  }
});

test("sourceEvidenceIrIdentity is preserved on each cluster", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  for (const cluster of result.output.clusters) {
    assert.equal(cluster.sourceEvidenceIrIdentity, grouped.sourceEvidenceIrIdentity);
  }
});

test("groupedEvidence reference on output preserves input groups", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  assert.deepEqual(result.output.groupedEvidence.groups, grouped.groups);
  assert.equal(result.output.groupedEvidence.sourceEvidenceIrIdentity, grouped.sourceEvidenceIrIdentity);
});

// ─── Pass History ─────────────────────────────────────────────────────────

test("pass history is accumulated and includes bgc.evidence-correlation", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  const historyIds = result.output.passHistory.map((h) => h.passId);
  assert.equal(historyIds.includes("bgc.input-validation"), true);
  assert.equal(historyIds.includes("bgc.canonical-verification"), true);
  assert.equal(historyIds.includes("bgc.evidence-grouping"), true);
  assert.equal(historyIds.includes("bgc.evidence-correlation"), true);
});

test("evidence-correlation pass history entry records completed status", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  const entry = result.output.passHistory.find((h) => h.passId === "bgc.evidence-correlation");
  assert.ok(entry, "Pass history entry not found for bgc.evidence-correlation");
  assert.equal(entry.status, "completed");
  assert.equal(entry.version.length > 0, true);
});

// ─── No Semantic Interpretation ───────────────────────────────────────────

test("output does not contain semantic class assignments", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  const serialized = JSON.stringify(result.output);
  assert.equal(serialized.includes("semanticClass"), false);
  assert.equal(serialized.includes("organization"), false);
  assert.equal(serialized.includes("capability"), false);
  assert.equal(serialized.includes("actor"), false);
});

test("output does not contain Business Genome artifacts", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  const serialized = JSON.stringify(result.output);
  assert.equal(serialized.includes("semanticGraph"), false);
  assert.equal(serialized.includes("businessGenome"), false);
});

// ─── Correlation by Identical Subject Reference (Rule 2) ──────────────────

test("groups with identical declared subjectReference are correlated into one cluster", () => {
  const ir = buildIRWithSharedSubjectReference();
  const grouped = groupedEvidence(ir);
  const result = correlationPass.execute(grouped, CTX);

  assert.equal(result.fatal, false);

  // Two groups should merge into one cluster.
  assert.equal(result.output.clusters.length, 1);
  assert.equal(result.output.clusters[0].memberGroupIds.length, 2);
});

test("subject-reference correlation records correct rule ID in correlationBases", () => {
  const ir = buildIRWithSharedSubjectReference();
  const grouped = groupedEvidence(ir);
  const result = correlationPass.execute(grouped, CTX);

  const cluster = result.output.clusters[0];
  const basisRuleIds = cluster.correlationBases.map((b) => b.ruleId);
  assert.equal(
    basisRuleIds.includes("bgc.correlation.rule.identical-declared-subject-reference"),
    true,
  );
});

test("subject-reference correlated cluster has deterministic ID across runs", () => {
  const ir = buildIRWithSharedSubjectReference();
  const grouped = groupedEvidence(ir);
  const first = correlationPass.execute(grouped, CTX);
  const second = correlationPass.execute(grouped, CTX);

  assert.equal(first.output.clusters[0].id, second.output.clusters[0].id);
});

test("subject-reference correlated cluster preserves all evidence items", () => {
  const ir = buildIRWithSharedSubjectReference();
  const grouped = groupedEvidence(ir);
  const result = correlationPass.execute(grouped, CTX);

  const inputItemIds = grouped.groups.flatMap((g) => g.evidenceItemIds).sort();
  const clusteredItemIds = result.output.clusters.flatMap((c) => c.evidenceItemIds).sort();

  assert.deepEqual(clusteredItemIds, inputItemIds);
});

// ─── Correlation by Explicit IR Cross-Group Relationship (Rule 1) ─────────

test("groups linked by explicit IR derived_from relationship are correlated", () => {
  const ir = buildIRWithCrossGroupRelationship();
  const grouped = groupedEvidence(ir);
  const result = correlationPass.execute(grouped, CTX);

  assert.equal(result.fatal, false);
  // The two artifact groups should be correlated by the explicit derived_from relationship.
  assert.equal(result.output.clusters.length, 1);
  assert.equal(result.output.clusters[0].memberGroupIds.length, 2);
});

test("IR-relationship correlation records the relationship ID and type in basis details", () => {
  const ir = buildIRWithCrossGroupRelationship();
  const grouped = groupedEvidence(ir);
  const result = correlationPass.execute(grouped, CTX);

  const cluster = result.output.clusters[0];
  const irBasis = cluster.correlationBases.find(
    (b) => b.ruleId === "bgc.correlation.rule.explicit-ir-cross-group-relationship",
  );

  assert.ok(irBasis, "Expected IR relationship basis not found");
  assert.equal(irBasis.details["relationshipType"], "derived_from");
  assert.equal(typeof irBasis.details["relationshipId"], "string");
});

test("IR-relationship correlation preserves all evidence items", () => {
  const ir = buildIRWithCrossGroupRelationship();
  const grouped = groupedEvidence(ir);
  const result = correlationPass.execute(grouped, CTX);

  const inputItemIds = grouped.groups.flatMap((g) => g.evidenceItemIds).sort();
  const clusteredItemIds = result.output.clusters.flatMap((c) => c.evidenceItemIds).sort();

  assert.deepEqual(clusteredItemIds, inputItemIds);
});

// ─── Conflict Preservation ────────────────────────────────────────────────

test("conflict indicators from input groups are preserved on clusters", () => {
  const grouped = groupedEvidence();

  // Inject a conflict indicator into the first group.
  const groupsWithConflict = grouped.groups.map((g, i) =>
    i === 0
      ? { ...g, explicitConflictIndicators: ["conflict:duplicate-subject"] }
      : g,
  );
  const groupedWithConflict = { ...grouped, groups: groupsWithConflict };

  const result = correlationPass.execute(groupedWithConflict, CTX);

  const conflictedCluster = result.output.clusters.find(
    (c) => c.explicitConflictIndicators.length > 0,
  );

  assert.ok(conflictedCluster, "Expected a cluster with conflict indicators");
  assert.equal(conflictedCluster.explicitConflictIndicators.includes("conflict:duplicate-subject"), true);
});

// ─── Collection-Level Invariants ──────────────────────────────────────────

test("collection ID is deterministic for equivalent inputs", () => {
  const grouped = groupedEvidence();
  const first = correlationPass.execute(grouped, CTX);
  const second = correlationPass.execute(grouped, CTX);

  assert.equal(first.output.id, second.output.id);
});

test("sourceEvidenceIrIdentity on collection matches grouped evidence source", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  assert.equal(result.output.sourceEvidenceIrIdentity, grouped.sourceEvidenceIrIdentity);
});

test("correlationRuleVersion is recorded on the collection", () => {
  const grouped = groupedEvidence();
  const result = correlationPass.execute(grouped, CTX);

  assert.equal(typeof result.output.correlationRuleVersion, "string");
  assert.equal(result.output.correlationRuleVersion.length > 0, true);
});

// ─── Business Genome Is Not Published ────────────────────────────────────

test("M1.3 does not emit BusinessGenomeArtifact or SemanticGraph", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildCompilerInput());

  assert.equal(result.status, "intermediate");
  assert.equal(result.intermediate.correlatedEvidence !== null, true);
  assert.equal(result.intermediate.publication?.publicationStatus, "published");

  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("semanticGraph"), false);
  assert.equal(serialized.includes("businessGenomeArtifact"), false);
});

test("compiler completes through bgc.evidence-correlation through bgc.relationship-resolution", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildCompilerInput());

  assert.equal(result.execution.completedPasses.includes("bgc.evidence-correlation"), true);
  assert.equal(result.execution.completedPasses.includes("bgc.semantic-resolution"), true);
  assert.equal(result.execution.completedPasses.includes("bgc.semantic-consolidation"), true);
  assert.equal(result.execution.completedPasses.includes("bgc.relationship-resolution"), true);
  assert.equal(result.execution.completedPasses.includes("bgc.identity-assignment"), true);
  assert.equal(result.execution.completedPasses.includes("bgc.business-genome-publication"), true);
});
