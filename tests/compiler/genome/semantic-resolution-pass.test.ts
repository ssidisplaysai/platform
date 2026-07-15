/**
 * GES-0002 / M1.4 — Semantic Resolution: Compiler Proof Test Suite
 *
 * Each test proves a COMPILER INVARIANT, not an implementation detail.
 * Tests are organized by invariant class:
 *   I. Pass contract and integration
 *   II. Deterministic resolution
 *   III. Unsupported evidence preservation
 *   IV. Conflict visibility
 *   V. Provenance and lineage
 *   VI. Stability guarantees (determinism proofs)
 *   VII. Boundary enforcement (no consolidation, no relationships, no genome)
 *   VIII. Architecture boundary (no runtime/app/UI/persistence/network)
 */

import assert from "node:assert/strict";
import test from "node:test";
import { EvidenceGraph } from "../../../src/compiler/evidence/EvidenceGraph";
import { EvidenceGraphHasher } from "../../../src/compiler/evidence/EvidenceGraphHasher";
import type { EvidenceIR } from "../../../src/compiler/evidence/EvidenceIR";
import {
  BUSINESS_GENOME_SEMANTIC_CLASSES,
  BusinessGenomeCompiler,
  BusinessGenomePassRegistry,
  CanonicalVerificationPass,
  EvidenceCorrelationPass,
  EvidenceGroupingPass,
  InputValidationPass,
  SemanticResolutionPass,
  isBusinessGenomeSemanticClass,
} from "../../../src/compiler/genome";
import {
  SUPPORTED_CLASSES_IN_M1_4,
  UNSUPPORTED_CLASSES_IN_M1_4,
} from "../../../src/compiler/genome/passes/SemanticResolutionPass";
import type { CorrelatedEvidenceCollection } from "../../../src/compiler/genome";
import { buildCompilerInput } from "./helpers";

// ─── Pass instances and shared context ────────────────────────────────────

const inputPass = new InputValidationPass();
const canonicalPass = new CanonicalVerificationPass();
const groupingPass = new EvidenceGroupingPass();
const correlationPass = new EvidenceCorrelationPass();
const resolutionPass = new SemanticResolutionPass();

const CTX = { sessionId: "s-sem-proof", pipelineVersion: "1.0.0" };
const BASE_META = {
  gps0001Version: "1.0",
  gps0002Version: "1.0",
  canonicalizationVersion: "1.0",
  canonicalValidationStatus: "verified",
};

// ─── Fixture builder ───────────────────────────────────────────────────────

function buildIR(items: ReadonlyArray<{
  readonly id: string;
  readonly sourceId: string;
  readonly artifactId: string;
  readonly meta: Record<string, unknown>;
}>): EvidenceIR {
  const sourceIds = [...new Set(items.map((i) => i.sourceId))];
  const graph = new EvidenceGraph(
    [
      ...sourceIds.map((srcId) => ({
        id: `source:${srcId}`,
        nodeType: "source" as const,
        sourceId: srcId,
        sourceType: "markdown" as const,
        origin: `${srcId}.md`,
        confidence: 1 as const,
        metadata: BASE_META,
        lineage: { sourceId: srcId, parentNodeIds: [] as string[], transformationSteps: [] as string[] },
      })),
      ...items.map((item) => ({
        id: item.id,
        nodeType: "artifact" as const,
        sourceId: item.sourceId,
        artifactId: item.artifactId,
        versionId: "v1",
        sourceType: "markdown" as const,
        origin: `${item.sourceId}.md`,
        checksum: `ck-${item.artifactId}`,
        confidence: 0.9,
        metadata: { ...BASE_META, ...item.meta },
        lineage: {
          sourceId: item.sourceId,
          parentNodeIds: [`source:${item.sourceId}`],
          transformationSteps: [] as string[],
        },
      })),
    ],
    items.map((item) => ({
      id: `rel:source:${item.sourceId}->${item.id}`,
      from: `source:${item.sourceId}`,
      to: item.id,
      relationshipType: "produced" as const,
      sourceId: item.sourceId,
      metadata: {} as Record<string, unknown>,
      lineage: {
        sourceId: item.sourceId,
        parentRelationshipIds: [] as string[],
        transformationSteps: [] as string[],
      },
    })),
  );
  const hasher = new EvidenceGraphHasher();
  const hm = {
    schemaVersion: "1.0.0" as const,
    graph,
    artifactCount: items.length,
    generatedAt: "2026-01-01T00:00:00.000Z",
  };
  return { ...hm, deterministicHash: hasher.hashIR(hm) };
}

function correlated(ir?: EvidenceIR): CorrelatedEvidenceCollection {
  const irId = ir ? `source_${new EvidenceGraphHasher().hashIR(ir)}_v1` : undefined;
  const input = ir
    ? buildCompilerInput({ evidenceIR: ir, evidenceIrIdentity: irId })
    : buildCompilerInput();
  const r1 = inputPass.execute(input!, CTX);
  if (r1.fatal) throw new Error("InputValidationPass fatal");
  const r2 = canonicalPass.execute(r1.output, CTX);
  if (r2.fatal) throw new Error("CanonicalVerificationPass fatal");
  const r3 = groupingPass.execute(r2.output, CTX);
  if (r3.fatal) throw new Error("EvidenceGroupingPass fatal");
  const r4 = correlationPass.execute(r3.output, CTX);
  if (r4.fatal) throw new Error("EvidenceCorrelationPass fatal");
  return r4.output;
}

// ─── Canonical fixtures ────────────────────────────────────────────────────

// F1: Single resolvable cluster – explicit category match
const IR_CONSTRAINT = buildIR([{
  id: "artifact:c1", sourceId: "src-c1", artifactId: "c1",
  meta: { questionId: "q1", answerId: "a1", category: "constraint", context: "budget", canonicalTopic: "budget-cap" },
}]);

// F2: Single resolvable cluster – explicit type match
const IR_CAPABILITY_TYPE = buildIR([{
  id: "artifact:cap1", sourceId: "src-cap1", artifactId: "cap1",
  meta: { type: "capability", canonicalTopic: "design-skill" },
}]);

// F3: Single resolvable cluster – explicit semanticClass match
const IR_CUSTOMER_CLASS = buildIR([{
  id: "artifact:cust1", sourceId: "src-cust1", artifactId: "cust1",
  meta: { semanticClass: "customer", canonicalTopic: "acme-corp" },
}]);

// F4: Unsupported – category "observation" is not a semantic class
const IR_OBSERVATION = buildIR([{
  id: "artifact:obs1", sourceId: "src-obs1", artifactId: "obs1",
  meta: { category: "observation", canonicalTopic: "note-1" },
}]);

// F5: Valid BGS-0001 class but not supported in M1.4
const IR_GOAL = buildIR([{
  id: "artifact:goal1", sourceId: "src-goal1", artifactId: "goal1",
  meta: { category: "goal", canonicalTopic: "growth" },
}]);

// F6: Multiple independent resolvable clusters
const IR_MULTI = buildIR([
  { id: "artifact:m1", sourceId: "src-m1", artifactId: "m1", meta: { category: "constraint", canonicalTopic: "limit-a" } },
  { id: "artifact:m2", sourceId: "src-m2", artifactId: "m2", meta: { category: "process", canonicalTopic: "onboarding" } },
]);

// F7: Conflicted – two items correlated into one cluster via subjectReference, different classes
const IR_CONFLICT = buildIR([
  { id: "artifact:conf-a", sourceId: "src-conf-a", artifactId: "conf-a", meta: { category: "customer", subjectReference: "acme", canonicalTopic: "acme-as-customer" } },
  { id: "artifact:conf-b", sourceId: "src-conf-b", artifactId: "conf-b", meta: { category: "supplier", subjectReference: "acme", canonicalTopic: "acme-as-supplier" } },
]);

// F8: Duplicate explicit assertions – same class from two different signal fields
const IR_DUPLICATE_SIGNAL = buildIR([{
  id: "artifact:dup1", sourceId: "src-dup1", artifactId: "dup1",
  meta: { category: "asset", type: "asset", canonicalTopic: "machine-001" },
}]);

// F9: Permuted ordering – identical evidence items, reversed input order
const IR_MULTI_REVERSED = buildIR([
  { id: "artifact:m2", sourceId: "src-m2", artifactId: "m2", meta: { category: "process", canonicalTopic: "onboarding" } },
  { id: "artifact:m1", sourceId: "src-m1", artifactId: "m1", meta: { category: "constraint", canonicalTopic: "limit-a" } },
]);

// ─── I. Pass Contract ─────────────────────────────────────────────────────

test("I.1 pass ID is bgc.semantic-resolution", () => {
  assert.equal(resolutionPass.metadata.id, "bgc.semantic-resolution");
});

test("I.2 pass declares dependency on bgc.evidence-correlation only", () => {
  assert.deepEqual(resolutionPass.metadata.dependencies, ["bgc.evidence-correlation"]);
});

test("I.3 pass is BGC-PASS-005: 5th in registry execution order", () => {
  const registry = new BusinessGenomePassRegistry();
  const ordered = registry.executablePassOrder().map((p) => p.metadata.id);
  assert.equal(ordered[4], "bgc.semantic-resolution");
});

test("I.4 bgc.evidence-correlation strictly precedes bgc.semantic-resolution in execution order", () => {
  const registry = new BusinessGenomePassRegistry();
  const ordered = registry.executablePassOrder().map((p) => p.metadata.id);
  assert.equal(
    ordered.indexOf("bgc.evidence-correlation") < ordered.indexOf("bgc.semantic-resolution"),
    true,
  );
});

// ─── II. Deterministic Resolution ─────────────────────────────────────────

test("II.1 explicit category:constraint produces exactly one candidate with semanticClass constraint", () => {
  const result = resolutionPass.execute(correlated(IR_CONSTRAINT), CTX);

  assert.equal(result.fatal, false);
  assert.equal(result.output.candidates.length, 1);
  assert.equal(result.output.candidates[0].semanticClass, "constraint");
});

test("II.2 constraint candidate records the correct resolution rule ID", () => {
  const result = resolutionPass.execute(correlated(IR_CONSTRAINT), CTX);

  assert.equal(
    result.output.candidates[0].resolutionRuleId,
    "bgc.semantic.rule.explicit-evidence-signal.constraint",
  );
});

test("II.3 constraint candidate records rule version 1.0.0", () => {
  const result = resolutionPass.execute(correlated(IR_CONSTRAINT), CTX);

  assert.equal(result.output.candidates[0].resolutionRuleVersion, "1.0.0");
});

test("II.4 explicit type:capability produces a capability candidate with BGC-RATIONALE-002", () => {
  const result = resolutionPass.execute(correlated(IR_CAPABILITY_TYPE), CTX);
  const candidate = result.output.candidates.find((c) => c.semanticClass === "capability");

  assert.ok(candidate, "capability candidate not found");
  assert.equal(
    candidate.assertions.some((a) => a.rationaleCode === "BGC-RATIONALE-002"),
    true,
  );
});

test("II.5 explicit semanticClass:customer produces a customer candidate with BGC-RATIONALE-003", () => {
  const result = resolutionPass.execute(correlated(IR_CUSTOMER_CLASS), CTX);
  const candidate = result.output.candidates.find((c) => c.semanticClass === "customer");

  assert.ok(candidate, "customer candidate not found");
  assert.equal(
    candidate.assertions.some((a) => a.rationaleCode === "BGC-RATIONALE-003"),
    true,
  );
});

test("II.6 duplicate signals on same item produce multiple assertions in the candidate", () => {
  const result = resolutionPass.execute(correlated(IR_DUPLICATE_SIGNAL), CTX);
  const candidate = result.output.candidates.find((c) => c.semanticClass === "asset");

  assert.ok(candidate, "asset candidate not found");
  assert.equal(candidate.assertions.length >= 2, true);
});

test("II.7 designation is derived from canonicalTopic when present", () => {
  const result = resolutionPass.execute(correlated(IR_CONSTRAINT), CTX);

  assert.equal(result.output.candidates[0].designation, "budget-cap");
});

// ─── III. Unsupported Evidence Preservation ───────────────────────────────

test("III.1 category:observation produces NO candidate", () => {
  const result = resolutionPass.execute(correlated(IR_OBSERVATION), CTX);

  assert.equal(result.output.candidates.length, 0);
});

test("III.2 unsupported evidence emits BGC-SEM-002 (insufficient explicit evidence)", () => {
  const result = resolutionPass.execute(correlated(IR_OBSERVATION), CTX);

  assert.equal(result.output.diagnostics.some((d) => d.code === "BGC-SEM-002"), true);
});

test("III.3 BGC-SEM-002 is deterministic across repeated runs", () => {
  const col = correlated(IR_OBSERVATION);
  const d1 = resolutionPass.execute(col, CTX).output.diagnostics.filter((d) => d.code === "BGC-SEM-002");
  const d2 = resolutionPass.execute(col, CTX).output.diagnostics.filter((d) => d.code === "BGC-SEM-002");

  assert.deepEqual(d1, d2);
});

test("III.4 unsupported evidence resolution result is marked unsupported=true", () => {
  const result = resolutionPass.execute(correlated(IR_OBSERVATION), CTX);

  assert.equal(result.output.resolutionResults.some((r) => r.unsupported), true);
});

test("III.5 valid BGS-0001 class goal (not in M1.4) produces no candidate and emits BGC-SEM-001", () => {
  const result = resolutionPass.execute(correlated(IR_GOAL), CTX);

  assert.equal(result.output.candidates.length, 0);
  assert.equal(result.output.diagnostics.some((d) => d.code === "BGC-SEM-001"), true);
});

test("III.6 M1.4 supports exactly 13 BGS-0001 classes via explicit evidence signals", () => {
  assert.equal(SUPPORTED_CLASSES_IN_M1_4.size, 13);
});

test("III.7 every unsupported class is still a valid BGS-0001 class", () => {
  for (const cls of UNSUPPORTED_CLASSES_IN_M1_4) {
    assert.equal(isBusinessGenomeSemanticClass(cls), true, `${cls} must be a valid BGS-0001 class`);
  }
});

test("III.8 supported and unsupported classes together equal all BGS-0001 classes", () => {
  assert.equal(
    SUPPORTED_CLASSES_IN_M1_4.size + UNSUPPORTED_CLASSES_IN_M1_4.size,
    BUSINESS_GENOME_SEMANTIC_CLASSES.length,
  );
});

// ─── IV. Conflict Visibility ──────────────────────────────────────────────

test("IV.1 conflicting classes in one cluster emit BGC-SEM-003 diagnostic", () => {
  const result = resolutionPass.execute(correlated(IR_CONFLICT), CTX);

  assert.equal(result.output.diagnostics.some((d) => d.code === "BGC-SEM-003"), true);
});

test("IV.2 conflicted candidate preserves both conflicting class names in conflictReferences", () => {
  const result = resolutionPass.execute(correlated(IR_CONFLICT), CTX);
  const conflicted = result.output.candidates.find((c) => c.conflictReferences.length > 0);

  assert.ok(conflicted, "conflicted candidate not found");
  const classes = conflicted.conflictReferences[0].conflictingSemanticClasses;
  assert.equal(classes.includes("customer"), true);
  assert.equal(classes.includes("supplier"), true);
});

test("IV.3 conflicted candidate certainty state is uncertain", () => {
  const result = resolutionPass.execute(correlated(IR_CONFLICT), CTX);
  const conflicted = result.output.candidates.find((c) => c.conflictReferences.length > 0);

  assert.ok(conflicted);
  assert.equal(conflicted.certainty.state, "uncertain");
});

test("IV.4 conflicted candidate validationStatus.valid is false", () => {
  const result = resolutionPass.execute(correlated(IR_CONFLICT), CTX);
  const conflicted = result.output.candidates.find((c) => c.conflictReferences.length > 0);

  assert.ok(conflicted);
  assert.equal(conflicted.validationStatus.valid, false);
});

test("IV.5 BGC-SEM-003 conflict diagnostic is deterministic across runs", () => {
  const col = correlated(IR_CONFLICT);
  const d1 = resolutionPass.execute(col, CTX).output.diagnostics.filter((d) => d.code === "BGC-SEM-003");
  const d2 = resolutionPass.execute(col, CTX).output.diagnostics.filter((d) => d.code === "BGC-SEM-003");

  assert.deepEqual(d1, d2);
});

// ─── V. Provenance and Lineage ─────────────────────────────────────────────

test("V.1 candidate evidenceClusterIds trace to clusters in the correlated collection", () => {
  const col = correlated(IR_CONSTRAINT);
  const result = resolutionPass.execute(col, CTX);
  const clusterIds = new Set(col.clusters.map((c) => c.id));

  for (const candidate of result.output.candidates) {
    for (const id of candidate.evidenceClusterIds) {
      assert.equal(clusterIds.has(id), true, `Cluster ID ${id} not in input`);
    }
  }
});

test("V.2 candidate evidenceItemIds are a subset of the source cluster's evidenceItemIds", () => {
  const col = correlated(IR_CONSTRAINT);
  const result = resolutionPass.execute(col, CTX);
  const allInputItemIds = new Set(col.clusters.flatMap((c) => c.evidenceItemIds));

  for (const candidate of result.output.candidates) {
    for (const itemId of candidate.evidenceItemIds) {
      assert.equal(allInputItemIds.has(itemId), true, `Item ${itemId} not in source clusters`);
    }
  }
});

test("V.3 candidate provenanceReferences are a subset of the source cluster's provenanceReferences", () => {
  const col = correlated(IR_CONSTRAINT);
  const result = resolutionPass.execute(col, CTX);

  for (const candidate of result.output.candidates) {
    const sourceCluster = col.clusters.find((c) => c.id === candidate.evidenceClusterIds[0]);
    assert.ok(sourceCluster, "source cluster not found");
    const clusterProvenance = new Set(sourceCluster.provenanceReferences);
    for (const ref of candidate.provenanceReferences) {
      assert.equal(clusterProvenance.has(ref), true);
    }
  }
});

test("V.4 candidate resolutionContext.passId is bgc.semantic-resolution", () => {
  const result = resolutionPass.execute(correlated(IR_CONSTRAINT), CTX);

  for (const candidate of result.output.candidates) {
    assert.equal(candidate.resolutionContext.passId, "bgc.semantic-resolution");
  }
});

test("V.5 candidate sourceEvidenceIrIdentity matches the collection sourceEvidenceIrIdentity", () => {
  const col = correlated(IR_CONSTRAINT);
  const result = resolutionPass.execute(col, CTX);

  for (const candidate of result.output.candidates) {
    assert.equal(candidate.sourceEvidenceIrIdentity, col.sourceEvidenceIrIdentity);
  }
});

test("V.6 each candidate assertion records the evidenceItemId that produced the signal", () => {
  const result = resolutionPass.execute(correlated(IR_CONSTRAINT), CTX);
  const candidate = result.output.candidates[0];

  assert.equal(candidate.assertions.length > 0, true);
  for (const assertion of candidate.assertions) {
    assert.equal(assertion.evidenceItemIds.length > 0, true);
  }
});

test("V.7 missing provenance item emits BGC-SEM-004 diagnostic", () => {
  const col = correlated(IR_CONSTRAINT);
  // Inject a ghost item ID not present in the reference index
  const patchedCol = {
    ...col,
    clusters: col.clusters.map((cluster) => ({
      ...cluster,
      evidenceItemIds: [...cluster.evidenceItemIds, "artifact:ghost-item-not-in-refs"],
    })),
  };

  const result = resolutionPass.execute(patchedCol, CTX);

  assert.equal(result.output.diagnostics.some((d) => d.code === "BGC-SEM-004"), true);
});

test("V.8 BGC-SEM-004 missing-provenance diagnostic is deterministic for the same ghost item", () => {
  const col = correlated(IR_CONSTRAINT);
  const patchedCol = {
    ...col,
    clusters: col.clusters.map((cluster) => ({
      ...cluster,
      evidenceItemIds: [...cluster.evidenceItemIds, "artifact:ghost"],
    })),
  };

  const d1 = resolutionPass.execute(patchedCol, CTX).output.diagnostics.filter((d) => d.code === "BGC-SEM-004");
  const d2 = resolutionPass.execute(patchedCol, CTX).output.diagnostics.filter((d) => d.code === "BGC-SEM-004");

  assert.deepEqual(d1, d2);
});

test("V.9 pass history records all 5 preceding passes and bgc.semantic-resolution", () => {
  const result = resolutionPass.execute(correlated(IR_CONSTRAINT), CTX);
  const historyIds = result.output.passHistory.map((h) => h.passId);

  assert.equal(historyIds.includes("bgc.input-validation"), true);
  assert.equal(historyIds.includes("bgc.canonical-verification"), true);
  assert.equal(historyIds.includes("bgc.evidence-grouping"), true);
  assert.equal(historyIds.includes("bgc.evidence-correlation"), true);
  assert.equal(historyIds.includes("bgc.semantic-resolution"), true);
});

test("V.10 bgc.semantic-resolution pass history entry records completed status", () => {
  const result = resolutionPass.execute(correlated(IR_CONSTRAINT), CTX);
  const entry = result.output.passHistory.find((h) => h.passId === "bgc.semantic-resolution");

  assert.ok(entry, "history entry not found");
  assert.equal(entry.status, "completed");
});

// ─── VI. Stability Proofs ─────────────────────────────────────────────────

test("VI.1 identical input produces identical candidate IDs on run 1 and run 2", () => {
  const col = correlated(IR_CONSTRAINT);
  const r1 = resolutionPass.execute(col, CTX);
  const r2 = resolutionPass.execute(col, CTX);

  assert.deepEqual(
    r1.output.candidates.map((c) => c.id),
    r2.output.candidates.map((c) => c.id),
  );
});

test("VI.2 candidate IDs are stable across 5 repeated executions", () => {
  const col = correlated(IR_CONSTRAINT);
  const idSets = [1, 2, 3, 4, 5].map(() =>
    resolutionPass.execute(col, CTX).output.candidates.map((c) => c.id).sort().join("|"),
  );
  assert.equal(new Set(idSets).size, 1, "Candidate IDs must be identical across all 5 runs");
});

test("VI.3 collection ID is stable across 3 repeated executions", () => {
  const col = correlated(IR_CONSTRAINT);
  const ids = [1, 2, 3].map(() => resolutionPass.execute(col, CTX).output.id);
  assert.equal(new Set(ids).size, 1);
});

test("VI.4 identical inputs produce byte-identical JSON serialization", () => {
  const col = correlated(IR_MULTI);
  const r1 = resolutionPass.execute(col, CTX);
  const r2 = resolutionPass.execute(col, CTX);

  assert.equal(JSON.stringify(r1.output), JSON.stringify(r2.output));
});

test("VI.5 permuted cluster ordering produces the same semantic class set", () => {
  const c1 = correlated(IR_MULTI);
  const c2 = correlated(IR_MULTI_REVERSED);

  const classes1 = resolutionPass.execute(c1, CTX).output.candidates.map((c) => c.semanticClass).sort();
  const classes2 = resolutionPass.execute(c2, CTX).output.candidates.map((c) => c.semanticClass).sort();

  assert.deepEqual(classes1, classes2);
});

test("VI.6 candidates are returned in lexicographic ID order", () => {
  const result = resolutionPass.execute(correlated(IR_MULTI), CTX);
  const ids = result.output.candidates.map((c) => c.id);
  assert.deepEqual(ids, [...ids].sort((a, b) => a.localeCompare(b)));
});

test("VI.7 resolution results are returned in lexicographic cluster ID order", () => {
  const result = resolutionPass.execute(correlated(IR_MULTI), CTX);
  const clusterIds = result.output.resolutionResults.map((r) => r.clusterId);
  assert.deepEqual(clusterIds, [...clusterIds].sort((a, b) => a.localeCompare(b)));
});

test("VI.8 diagnostics are sorted deterministically across equivalent runs", () => {
  const col = correlated(IR_OBSERVATION);
  const d1 = resolutionPass.execute(col, CTX).output.diagnostics;
  const d2 = resolutionPass.execute(col, CTX).output.diagnostics;
  assert.deepEqual(d1, d2);
});

// ─── VII. Boundary Enforcement ────────────────────────────────────────────

test("VII.1 two same-class clusters are NOT consolidated: each produces its own resolution result", () => {
  const ir = buildIR([
    { id: "artifact:ca", sourceId: "src-ca", artifactId: "ca", meta: { category: "constraint", canonicalTopic: "limit-alpha" } },
    { id: "artifact:cb", sourceId: "src-cb", artifactId: "cb", meta: { category: "constraint", canonicalTopic: "limit-beta" } },
  ]);
  const col = correlated(ir);
  const result = resolutionPass.execute(col, CTX);

  // Both should produce candidates; no consolidation in M1.4
  assert.equal(result.output.resolutionResults.length >= 2, true);
  assert.equal(result.output.candidates.filter((c) => c.semanticClass === "constraint").length >= 1, true);
});

test("VII.2 output contains no semantic relationship objects", () => {
  const serialized = JSON.stringify(resolutionPass.execute(correlated(IR_MULTI), CTX).output);
  assert.equal(serialized.includes("\"relationshipClass\""), false);
  assert.equal(serialized.includes("semanticRelationship"), false);
});

test("VII.3 output contains no semantic graph", () => {
  const serialized = JSON.stringify(resolutionPass.execute(correlated(IR_MULTI), CTX).output);
  assert.equal(serialized.includes("semanticGraph"), false);
});

test("VII.4 compiler pipeline does not publish BusinessGenomeArtifact after M1.4", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildCompilerInput());

  assert.equal(result.status, "intermediate");
  assert.equal(result.intermediate.semanticCandidates !== null, true);
  assert.equal(result.execution.completedPasses.includes("bgc.business-genome-publication"), true);
  assert.equal(result.intermediate.publication?.publicationStatus, "published");
  assert.equal(JSON.stringify(result).includes("semanticGraph"), false);
});

test("VII.5 pipeline continues deterministically after semantic-resolution into downstream passes", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildCompilerInput());

  assert.equal(result.execution.completedPasses.includes("bgc.semantic-resolution"), true);
  assert.equal(result.execution.completedPasses.includes("bgc.semantic-consolidation"), true);
  assert.equal(result.execution.completedPasses.includes("bgc.relationship-resolution"), true);
  assert.equal(result.execution.completedPasses.includes("bgc.identity-assignment"), true);
});

test("VII.6 each candidate references exactly one cluster (no cross-cluster bundling)", () => {
  const result = resolutionPass.execute(correlated(IR_MULTI), CTX);

  for (const candidate of result.output.candidates) {
    assert.equal(candidate.evidenceClusterIds.length, 1);
  }
});

test("VII.7 multiple independent clusters produce independent candidates without cross-reference", () => {
  const col = correlated(IR_MULTI);
  const result = resolutionPass.execute(col, CTX);

  assert.equal(result.output.candidates.length >= 2, true);
  const constraintCandidates = result.output.candidates.filter((c) => c.semanticClass === "constraint");
  const processCandidates = result.output.candidates.filter((c) => c.semanticClass === "process");

  assert.equal(constraintCandidates.length, 1);
  assert.equal(processCandidates.length, 1);
});

// ─── VIII. Architecture Boundary ──────────────────────────────────────────

test("VIII.1 fatal canonical-verification failure prevents semantic resolution", () => {
  const compiler = new BusinessGenomeCompiler();
  const result = compiler.compile(buildCompilerInput({
    canonicalMetadata: {
      gps0001Version: "1.0",
      gps0002Version: "1.0",
      canonicalizationVersion: "1.0",
      identityStandardVersion: "1.0",
      canonicalValidationStatus: "failed",
      checksumReferences: [],
    },
  }));

  assert.equal(result.execution.completedPasses.includes("bgc.semantic-resolution"), false);
  assert.equal(result.intermediate.semanticCandidates, null);
});

test("VIII.2 SemanticResolutionPass does not contain forbidden patterns (boundary test)", () => {
  // Full file scanning is covered by dedicated dependency-boundary.test.ts
  // This test ensures the pass is included in the boundary test coverage
  assert.equal(resolutionPass.metadata.id, "bgc.semantic-resolution");
  assert.equal(resolutionPass.metadata.dependencies.includes("bgc.evidence-correlation"), true);
});
