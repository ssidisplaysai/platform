/**
 * GES-0002 / M1.5 — Semantic Consolidation: Compiler Proof Test Suite
 *
 * Each test proves a COMPILER INVARIANT, not an implementation detail.
 * Tests are organized by invariant class:
 *   I. Pass contract and integration
 *   II. Deterministic consolidation
 *   III. Conflict preservation
 *   IV. Provenance preservation
 *   V. No relationship resolution
 *   VI. No graph construction
 *   VII. Stability proofs (determinism)
 *   VIII. Architecture boundary
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  BusinessGenomeCompiler,
  SemanticConsolidationPass,
  SEMANTIC_CONSOLIDATION_RULES,
} from "../../../src/compiler/genome";
import type { SemanticCandidateCollection, SemanticCandidate } from "../../../src/compiler/genome";
import { buildCompilerInput } from "./helpers";

// ─── Pass instances and shared context ────────────────────────────────────

const consolidationPass = new SemanticConsolidationPass();
const CTX = { sessionId: "s-cons-proof", pipelineVersion: "1.0.0" };

// ─── Test Fixtures ────────────────────────────────────────────────────────

/**
 * Helper: Build a minimal semantic candidate for testing.
 */
function buildCandidate(
  id: string,
  semanticClass: string,
  designation: string,
  conflicted = false,
): SemanticCandidate {
  return {
    id,
    semanticClass,
    designation,
    assertions: [],
    evidenceClusterIds: ["ec-001"],
    evidenceGroupIds: ["eg-001"],
    evidenceItemIds: ["ei-001"],
    provenanceReferences: ["prov-001"],
    sourceEvidenceIrIdentity: "ev-ir-001",
    resolutionRuleId: "rule-001",
    resolutionRuleVersion: "1.0.0",
    certainty: { state: "certain", confidence: 1.0 },
    conflictReferences: conflicted ? [{ conflictId: "cfx-001", conflictingSemanticClasses: ["customer", "supplier"], conflictingRuleIds: ["r-1", "r-2"], evidenceClusterIds: ["ec-001"], notes: [] }] : [],
    validationStatus: { valid: true, violations: [] },
    resolutionContext: {
      passId: "bgc.semantic-resolution",
      passVersion: "1.0.0",
      compilerVersion: "1.0.0",
      specificationVersion: "1.0.0",
      ruleId: "rule-001",
      ruleVersion: "1.0.0",
      rationaleCode: "BGC-RATIONALE-001",
    },
    diagnostics: [],
  };
}

/**
 * Helper: Build a minimal semantic candidate collection.
 */
function buildSemanticCandidateCollection(candidates: SemanticCandidate[]): SemanticCandidateCollection {
  return {
    id: "scc-001",
    sourceEvidenceIrIdentity: "ev-ir-001",
    candidates,
    resolutionResults: [],
    diagnostics: [],
    passId: "bgc.semantic-resolution",
    passVersion: "1.0.0",
    specificationVersion: "1.0.0",
    compilerVersion: "1.0.0",
    passHistory: [],
    correlatedEvidence: undefined as never,
  };
}

// ─── INVARIANT I: Pass Contract ────────────────────────────────────────────

test("I.1 consolidation pass has correct ID", () => {
  assert.equal(consolidationPass.metadata.id, "bgc.semantic-consolidation");
});

test("I.2 consolidation pass depends on semantic-resolution", () => {
  assert.equal(consolidationPass.metadata.dependencies.includes("bgc.semantic-resolution"), true);
});

test("I.3 consolidation pass version is 1.0.0", () => {
  assert.equal(consolidationPass.metadata.version, "1.0.0");
});

// ─── INVARIANT II: Deterministic Consolidation ─────────────────────────────

test("II.1 identical class and designation consolidate", () => {
  const c1 = buildCandidate("sc-001", "constraint", "Performance SLA");
  const c2 = buildCandidate("sc-002", "constraint", "Performance SLA");
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal(result.output.consolidatedSemantics.length, 1, "Should have 1 consolidated semantic");
  assert.equal(result.output.consolidatedSemantics[0].mergedCandidateCount, 2, "Should merge 2 candidates");
});

test("II.2 identical class but different designation do NOT consolidate", () => {
  const c1 = buildCandidate("sc-001", "constraint", "Performance SLA");
  const c2 = buildCandidate("sc-002", "constraint", "Security Requirement");
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal(result.output.consolidatedSemantics.length, 2, "Should have 2 separate consolidated semantics");
  assert.equal(result.output.consolidatedSemantics[0].mergedCandidateCount, 1, "First should merge 1");
  assert.equal(result.output.consolidatedSemantics[1].mergedCandidateCount, 1, "Second should merge 1");
});

test("II.3 different semantic classes never consolidate", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const c2 = buildCandidate("sc-002", "capability", "SLA");
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal(result.output.consolidatedSemantics.length, 2, "Should not consolidate different classes");
});

test("II.4 case-insensitive designation normalization", () => {
  const c1 = buildCandidate("sc-001", "constraint", "Performance SLA");
  const c2 = buildCandidate("sc-002", "constraint", "PERFORMANCE SLA");
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal(result.output.consolidatedSemantics.length, 1, "Should normalize case for matching");
});

test("II.5 whitespace normalization in designation", () => {
  const c1 = buildCandidate("sc-001", "constraint", "Performance  SLA");
  const c2 = buildCandidate("sc-002", "constraint", "Performance SLA");
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal(result.output.consolidatedSemantics.length, 1, "Should normalize whitespace");
});

test("II.6 merge rule recorded in consolidation context", () => {
  const c1 = buildCandidate("sc-001", "constraint", "Performance SLA");
  const c2 = buildCandidate("sc-002", "constraint", "Performance SLA");
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  const consolidated = result.output.consolidatedSemantics[0];
  assert.equal(typeof consolidated.consolidationRuleId, "string");
  assert.equal(consolidated.consolidationContext.ruleId, consolidated.consolidationRuleId);
});

// ─── INVARIANT III: Conflict Preservation ──────────────────────────────────

test("III.1 conflicting candidates do NOT consolidate", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA", true);
  const c2 = buildCandidate("sc-002", "constraint", "SLA", false);
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal(result.output.consolidatedSemantics.length, 2, "Conflicting candidates should NOT merge");
});

test("III.2 conflict references preserved in consolidated semantic", () => {
  const conflictRef = {
    conflictId: "cfx-001",
    conflictingSemanticClasses: ["customer", "supplier"] as const,
    conflictingRuleIds: ["r-1", "r-2"],
    evidenceClusterIds: ["ec-001"],
    notes: [] as readonly string[],
  };
  const c1 = buildCandidate("sc-001", "customer", "ACME");
  c1.conflictReferences = [conflictRef] as any;
  const collection = buildSemanticCandidateCollection([c1]);
  const result = consolidationPass.execute(collection, CTX);

  const consolidated = result.output.consolidatedSemantics[0];
  assert.equal(consolidated.hasConflicts, true, "Should mark hasConflicts");
  assert.equal(consolidated.conflictReferences.length, 1, "Should preserve conflict");
});

test("III.3 consolidated semantic marked uncertain if any candidate conflicts", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA", true);
  const collection = buildSemanticCandidateCollection([c1]);
  const result = consolidationPass.execute(collection, CTX);

  const consolidated = result.output.consolidatedSemantics[0];
  assert.equal(consolidated.certainty.state, "uncertain");
});

// ─── INVARIANT IV: Provenance Preservation ───────────────────────────────

test("IV.1 evidenceClusterIds preserved from all candidates", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const c2 = buildCandidate("sc-002", "constraint", "SLA");
  c1.evidenceClusterIds = ["ec-001"];
  c2.evidenceClusterIds = ["ec-002"];
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  const consolidated = result.output.consolidatedSemantics[0];
  assert.equal(consolidated.evidenceClusterIds.length, 2);
  assert.equal(consolidated.evidenceClusterIds.includes("ec-001"), true);
  assert.equal(consolidated.evidenceClusterIds.includes("ec-002"), true);
});

test("IV.2 evidenceItemIds preserved from all candidates", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const c2 = buildCandidate("sc-002", "constraint", "SLA");
  c1.evidenceItemIds = ["ei-001", "ei-002"];
  c2.evidenceItemIds = ["ei-003"];
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  const consolidated = result.output.consolidatedSemantics[0];
  assert.equal(consolidated.evidenceItemIds.length, 3);
});

test("IV.3 provenanceReferences preserved from all candidates", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const c2 = buildCandidate("sc-002", "constraint", "SLA");
  c1.provenanceReferences = ["prov-001"];
  c2.provenanceReferences = ["prov-002"];
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  const consolidated = result.output.consolidatedSemantics[0];
  assert.equal(consolidated.provenanceReferences.length, 2);
});

test("IV.4 contributing candidates preserved in consolidation", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const c2 = buildCandidate("sc-002", "constraint", "SLA");
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  const consolidated = result.output.consolidatedSemantics[0];
  assert.equal(consolidated.contributingCandidates.length, 2);
  assert.equal(consolidated.contributingCandidates.map((c) => c.id).includes("sc-001"), true);
  assert.equal(consolidated.contributingCandidates.map((c) => c.id).includes("sc-002"), true);
});

test("IV.5 sourceEvidenceIrIdentity preserved", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const collection = buildSemanticCandidateCollection([c1]);
  collection.sourceEvidenceIrIdentity = "ev-ir-test-123";
  const result = consolidationPass.execute(collection, CTX);

  const consolidated = result.output.consolidatedSemantics[0];
  assert.equal(consolidated.sourceEvidenceIrIdentity, "ev-ir-test-123");
});

// ─── INVARIANT V: No Relationship Resolution ──────────────────────────────

test("V.1 output contains no relationship objects", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const collection = buildSemanticCandidateCollection([c1]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal((result.output as any).relationships, undefined);
  assert.equal((result.output as any).relationshipGraph, undefined);
});

test("V.2 consolidation does not resolve inter-semantic relationships", () => {
  const c1 = buildCandidate("sc-001", "customer", "ACME");
  const c2 = buildCandidate("sc-002", "supplier", "Vendor Inc");
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal(result.output.consolidatedSemantics.length, 2, "Should produce 2 separate consolidations");
});

// ─── INVARIANT VI: No Graph Construction ───────────────────────────────────

test("VI.1 output contains no semantic graph", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const collection = buildSemanticCandidateCollection([c1]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal((result.output as any).graph, undefined);
  assert.equal((result.output as any).semanticGraph, undefined);
});

test("VI.2 consolidation does not construct graph", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const c2 = buildCandidate("sc-002", "capability", "Performance");
  const collection = buildSemanticCandidateCollection([c1, c2]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal((result.output as any).nodes, undefined);
  assert.equal((result.output as any).edges, undefined);
});

// ─── INVARIANT VII: Stability Proofs (Determinism) ────────────────────────

test("VII.1 identical input produces identical consolidation IDs (run 1 vs run 2)", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const c2 = buildCandidate("sc-002", "constraint", "SLA");
  const collection = buildSemanticCandidateCollection([c1, c2]);

  const result1 = consolidationPass.execute(collection, CTX);
  const result2 = consolidationPass.execute(collection, CTX);

  assert.equal(result1.output.consolidatedSemantics[0].id, result2.output.consolidatedSemantics[0].id);
});

test("VII.2 consolidation ID stable across 5 repeated executions", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const c1 = buildCandidate("sc-001", "constraint", "SLA");
    const c2 = buildCandidate("sc-002", "constraint", "SLA");
    const collection = buildSemanticCandidateCollection([c1, c2]);
    const result = consolidationPass.execute(collection, CTX);
    ids.add(result.output.consolidatedSemantics[0].id);
  }

  assert.equal(ids.size, 1, "Should have identical ID across all 5 runs");
});

test("VII.3 byte-identical JSON serialization across runs", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const c2 = buildCandidate("sc-002", "constraint", "SLA");
  const collection = buildSemanticCandidateCollection([c1, c2]);

  const result1 = consolidationPass.execute(collection, CTX);
  const result2 = consolidationPass.execute(collection, CTX);

  const json1 = JSON.stringify(result1.output);
  const json2 = JSON.stringify(result2.output);
  assert.equal(json1, json2, "JSON must be byte-identical");
});

test("VII.4 merge results sorted deterministically", () => {
  const candidates = [];
  for (let i = 0; i < 3; i++) {
    candidates.push(buildCandidate(`sc-00${i}`, "constraint", "SLA"));
  }
  const collection = buildSemanticCandidateCollection(candidates);
  const result = consolidationPass.execute(collection, CTX);

  const ids = result.output.mergeResults.map((mr) => mr.consolidatedSemanticId);
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(ids, sorted, "Merge results should be in lexicographic order");
});

test("VII.5 consolidated semantics sorted deterministically", () => {
  const candidates = [];
  for (let i = 0; i < 3; i++) {
    candidates.push(buildCandidate(`sc-00${i}`, "constraint", `SLA-${i}`));
  }
  const collection = buildSemanticCandidateCollection(candidates);
  const result = consolidationPass.execute(collection, CTX);

  const ids = result.output.consolidatedSemantics.map((cs) => cs.id);
  const sorted = [...ids].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(ids, sorted, "Consolidated semantics should be in lexicographic order");
});

// ─── INVARIANT VIII: Architecture Boundary ───────────────────────────────

test("VIII.1 consolidation does not create Business Genome objects", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const collection = buildSemanticCandidateCollection([c1]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal((result.output as any).businessGenomeId, undefined);
  assert.equal((result.output as any).businessGenomeArtifact, undefined);
});

test("VIII.2 consolidation does not publish genome", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const collection = buildSemanticCandidateCollection([c1]);
  const result = consolidationPass.execute(collection, CTX);

  assert.equal((result.output as any).published, undefined);
  assert.equal((result.output as any).publishedAt, undefined);
});

test("VIII.3 consolidation preserves semantic candidates reference", () => {
  const c1 = buildCandidate("sc-001", "constraint", "SLA");
  const collection = buildSemanticCandidateCollection([c1]);
  const result = consolidationPass.execute(collection, CTX);

  assert.ok(result.output.semanticCandidates, "Should preserve semantic candidates collection");
  assert.equal(result.output.semanticCandidates.id, collection.id);
});

// ─── Integration: Verify Rules Catalog ──────────────────────────────────────

test("Consolidation rules are deterministic and versioned", () => {
  assert.equal(SEMANTIC_CONSOLIDATION_RULES.length, 2);
  for (const rule of SEMANTIC_CONSOLIDATION_RULES) {
    assert.ok(rule.id);
    assert.ok(rule.version);
    assert.ok(rule.description);
    assert.ok(rule.matchCriteria);
    assert.ok(rule.rationaleCode);
  }
});

test("Rule IDs are stable", () => {
  assert.equal(SEMANTIC_CONSOLIDATION_RULES[0].id, "bgc.consolidation.rule.identical-class-and-designation");
  assert.equal(SEMANTIC_CONSOLIDATION_RULES[1].id, "bgc.consolidation.rule.identical-semantic-identity");
});
