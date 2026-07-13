import type { CompilerPass, CompilerPassContext } from "../../core/types";
import { stableStringify } from "../../core/stableStringify";
import { BGC_DIAGNOSTIC_CODES, createDiagnostic, sortDiagnostics } from "../diagnostics";
import {
  deterministicIdentity,
  type BusinessGenomePassResult,
  type ConsolidatedSemantic,
  type ConsolidatedSemanticCollection,
  type SemanticCandidate,
  type SemanticCandidateCollection,
  type SemanticConflictReference,
  type SemanticMergeContext,
  type SemanticMergeResult,
  type SemanticMergeRule,
} from "../pipeline-types";
import { updatePassHistory } from "../pipeline-types";

// ─── Merge Rules ──────────────────────────────────────────────────────────

/**
 * Deterministic merge rules for semantic consolidation.
 *
 * Only explicit, governed consolidation rules are supported in M1.5:
 * 1. Identical semantic class + identical normalized designation
 * 2. Identical semantic class + identical semantic identity hash
 * 3. Explicit governed equivalence metadata (if present)
 *
 * Never merge:
 * - Different semantic classes
 * - Conflicting candidates
 * - Without explicit governing rule
 */
export const SEMANTIC_CONSOLIDATION_RULES: readonly SemanticMergeRule[] = [
  {
    id: "bgc.consolidation.rule.identical-class-and-designation",
    version: "1.0.0",
    description:
      "Consolidates semantic candidates with identical semantic class and identical normalized designation.",
    matchCriteria: "identical-class-and-designation",
    rationaleCode: "BGC-RATIONALE-CONSOLIDATION-001",
  },
  {
    id: "bgc.consolidation.rule.identical-semantic-identity",
    version: "1.0.0",
    description: "Consolidates semantic candidates with identical deterministic semantic identity hash.",
    matchCriteria: "identical-semantic-identity",
    rationaleCode: "BGC-RATIONALE-CONSOLIDATION-002",
  },
];

// ─── Normalization ────────────────────────────────────────────────────────

/**
 * Normalize designation for comparison (lowercase, trim whitespace, collapse multiple spaces).
 */
function normalizeDesignation(designation: string): string {
  return designation
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Derive a deterministic semantic identity from a candidate.
 * Used for exact match consolidation.
 */
function deriveCandidateSemanticIdentity(candidate: SemanticCandidate): string {
  return deterministicIdentity("bgc-candidate-identity", {
    semanticClass: candidate.semanticClass,
    normalizedDesignation: normalizeDesignation(candidate.designation),
    ruleId: candidate.resolutionRuleId,
    evidence: candidate.evidenceItemIds.slice().sort(),
  });
}

// ─── Consolidation Logic ──────────────────────────────────────────────────

/**
 * Check if two candidates can be consolidated according to merge rules.
 * Returns merge rule ID if consolidation should occur, undefined if not.
 */
function findMergeRule(candidate1: SemanticCandidate, candidate2: SemanticCandidate): string | undefined {
  // Never consolidate different semantic classes
  if (candidate1.semanticClass !== candidate2.semanticClass) {
    return undefined;
  }

  // Never consolidate if either has conflicts
  if (candidate1.conflictReferences.length > 0 || candidate2.conflictReferences.length > 0) {
    return undefined;
  }

  // Rule 1: Identical class + identical normalized designation
  if (normalizeDesignation(candidate1.designation) === normalizeDesignation(candidate2.designation)) {
    return SEMANTIC_CONSOLIDATION_RULES[0]!.id;
  }

  // Rule 2: Identical semantic identity hash
  const id1 = deriveCandidateSemanticIdentity(candidate1);
  const id2 = deriveCandidateSemanticIdentity(candidate2);
  if (id1 === id2) {
    return SEMANTIC_CONSOLIDATION_RULES[1]!.id;
  }

  return undefined;
}

/**
 * Build a consolidated semantic entity from a group of equivalent candidates.
 */
function buildConsolidatedSemantic(
  candidates: readonly SemanticCandidate[],
  mergeRuleId: string,
  consolidationContext: SemanticMergeContext,
): ConsolidatedSemantic {
  // Merge rule must exist
  const rule = SEMANTIC_CONSOLIDATION_RULES.find((r) => r.id === mergeRuleId);
  if (!rule) {
    throw new Error(`Unknown merge rule: ${mergeRuleId}`);
  }

  // All candidates must have same class (enforced by merge logic)
  const semanticClass = candidates[0]!.semanticClass;

  // Use first designation as canonical
  const designation = candidates[0]!.designation;

  // Merge all assertions, deduplicating by assertionId
  const assertionMap = new Map(candidates.flatMap((c) => c.assertions.map((a) => [a.assertionId, a])));
  const assertions = Array.from(assertionMap.values()).sort((a, b) => a.assertionId.localeCompare(b.assertionId));

  // Merge all evidence lineage
  const evidenceClusterIds = Array.from(
    new Set(candidates.flatMap((c) => c.evidenceClusterIds)),
  )
    .sort();
  const evidenceGroupIds = Array.from(
    new Set(candidates.flatMap((c) => c.evidenceGroupIds)),
  )
    .sort();
  const evidenceItemIds = Array.from(
    new Set(candidates.flatMap((c) => c.evidenceItemIds)),
  )
    .sort();
  const provenanceReferences = Array.from(
    new Set(candidates.flatMap((c) => c.provenanceReferences)),
  )
    .sort();

  // Check for conflicts in any candidate
  const conflictReferences = Array.from(
    new Map(
      candidates
        .flatMap((c) => c.conflictReferences)
        .map((cf) => [cf.conflictId, cf]),
    ).values(),
  ).sort((a, b) => a.conflictId.localeCompare(b.conflictId));

  const hasConflicts = conflictReferences.length > 0;

  // Certainty: if any candidate is uncertain or has conflicts, mark uncertain
  const certainty = {
    state: (candidates.some((c) => c.certainty.state === "uncertain" || c.conflictReferences.length > 0)
      ? "uncertain"
      : "certain") as "certain" | "uncertain",
    confidence: candidates.every((c) => c.certainty.state === "certain" && c.conflictReferences.length === 0)
      ? 1.0
      : 0.5,
  };

  // Validation: inherit from first candidate, add consolidation note
  const validationStatus = {
    valid: candidates.every((c) => c.validationStatus.valid),
    violations: Array.from(
      new Set(candidates.flatMap((c) => c.validationStatus.violations)),
    ).sort(),
  };

  // Consolidated ID (deterministic from all contributing candidates)
  const consolidatedId = deterministicIdentity("bgc-consolidated-semantic", {
    semanticClass,
    designation,
    mergedCandidateIds: candidates.map((c) => c.id).sort(),
    mergeRuleId,
    evidence: evidenceItemIds,
  });

  return {
    id: consolidatedId,
    semanticClass,
    designation,
    assertions,
    contributingCandidates: [...candidates].sort((a, b) => a.id.localeCompare(b.id)),
    mergedCandidateCount: candidates.length,
    evidenceClusterIds,
    evidenceGroupIds,
    evidenceItemIds,
    provenanceReferences,
    sourceEvidenceIrIdentity: candidates[0]!.sourceEvidenceIrIdentity,
    conflictReferences,
    hasConflicts,
    consolidationRuleId: rule.id,
    consolidationRuleVersion: rule.version,
    certainty,
    validationStatus,
    consolidationContext,
    diagnostics: [],
  };
}

// ─── SemanticConsolidationPass Implementation ──────────────────────────────

export class SemanticConsolidationPass implements CompilerPass<SemanticCandidateCollection, ConsolidatedSemanticCollection> {
  readonly metadata = {
    id: "bgc.semantic-consolidation",
    version: "1.0.0",
    dependencies: ["bgc.semantic-resolution"],
    description:
      "Deterministically identifies and consolidates semantic candidates that represent the same enterprise concept. All evidence, provenance, and conflicts are preserved.",
  };

  execute(
    input: SemanticCandidateCollection,
    context: CompilerPassContext,
  ): BusinessGenomePassResult<ConsolidatedSemanticCollection> {
    const passId = this.metadata.id;
    const passVersion = this.metadata.version;
    const diagnostics: CompilerDiagnostic[] = [];

    try {
      // Phase 1: Validate input
      if (!input || !input.candidates) {
        const diagnostic = createDiagnostic(
          BGC_DIAGNOSTIC_CODES.PIPELINE.MISSING_REQUIRED_PASS_OUTPUT,
          "error",
          "Input SemanticCandidateCollection is missing or invalid",
          passId,
          { expectedPass: "bgc.semantic-resolution" },
        );
        diagnostics.push(diagnostic);
        return {
          passId,
          passVersion,
          output: {
            id: deterministicIdentity("bgc-consolidated-semantic-collection", { error: "missing-input" }),
            sourceEvidenceIrIdentity: input?.sourceEvidenceIrIdentity ?? "unknown",
            consolidatedSemantics: [],
            mergeResults: [],
            diagnostics: sortDiagnostics(diagnostics),
            passId,
            passVersion,
            specificationVersion: input?.specificationVersion ?? "1.0.0",
            compilerVersion: input?.compilerVersion ?? "1.0.0",
            consolidationRuleVersion: "1.0.0",
            passHistory: updatePassHistory(
              input?.passHistory ?? [],
              passId,
              passVersion,
              "failed",
              diagnostics.length,
            ),
            semanticCandidates: input || ({} as SemanticCandidateCollection),
          },
          diagnostics,
          fatal: true,
        };
      }

      // Phase 2: Build consolidation groups using union-find
      const candidateMap = new Map(input.candidates.map((c) => [c.id, c]));
      const parentMap = new Map<string, string>();
      const mergeRuleMap = new Map<string, string>();

      // Initialize union-find
      for (const candidate of input.candidates) {
        parentMap.set(candidate.id, candidate.id);
      }

      // Find function with path compression
      const find = (id: string): string => {
        const parent = parentMap.get(id);
        if (!parent || parent === id) {
          return id;
        }
        const root = find(parent);
        parentMap.set(id, root);
        return root;
      };

      // Consolidation logic: for each candidate, check against all others
      const candidates = Array.from(input.candidates).sort((a, b) => a.id.localeCompare(b.id));

      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const candidate1 = candidates[i]!;
          const candidate2 = candidates[j]!;

          const root1 = find(candidate1.id);
          const root2 = find(candidate2.id);

          if (root1 === root2) {
            continue; // Already in same group
          }

          // Check if merge rule applies
          const mergeRuleId = findMergeRule(candidate1, candidate2);
          if (mergeRuleId) {
            // Merge: union(root1, root2)
            parentMap.set(root2, root1);
            mergeRuleMap.set(root2, mergeRuleId);
          }
        }
      }

      // Phase 3: Build consolidated entities
      const groupMap = new Map<string, SemanticCandidate[]>();
      for (const candidate of input.candidates) {
        const root = find(candidate.id);
        if (!groupMap.has(root)) {
          groupMap.set(root, []);
        }
        groupMap.get(root)!.push(candidate);
      }

      const consolidatedSemantics: ConsolidatedSemantic[] = [];
      const mergeResults: SemanticMergeResult[] = [];

      for (const [rootId, group] of groupMap) {
        // Determine merge rule (empty string for unconsolidated singletons)
        const mergeRuleId =
          group.length > 1
            ? mergeRuleMap.get(rootId) || SEMANTIC_CONSOLIDATION_RULES[0]!.id
            : SEMANTIC_CONSOLIDATION_RULES[0]!.id;

        const mergeRule = SEMANTIC_CONSOLIDATION_RULES.find((r) => r.id === mergeRuleId);
        if (!mergeRule) {
          continue;
        }

        const consolidationContext: SemanticMergeContext = {
          passId,
          passVersion,
          compilerVersion: input.compilerVersion,
          specificationVersion: input.specificationVersion,
          ruleId: mergeRule.id,
          ruleVersion: mergeRule.version,
          matchCriteria: mergeRule.matchCriteria,
          mergedCandidateIds: group.map((c) => c.id).sort(),
        };

        const consolidated = buildConsolidatedSemantic(group, mergeRule.id, consolidationContext);
        consolidatedSemantics.push(consolidated);

        // Record merge result
        mergeResults.push({
          consolidatedSemanticId: consolidated.id,
          mergedCandidateIds: group.map((c) => c.id).sort(),
          mergeRuleId: mergeRule.id,
          matchCriteria: mergeRule.matchCriteria,
          diagnostics:
            group.length > 1
              ? [
                  createDiagnostic(
                    BGC_DIAGNOSTIC_CODES.CONS.CONSOLIDATION_APPLIED,
                    "info",
                    `Consolidated ${group.length} semantic candidates (${mergeRule.matchCriteria})`,
                    passId,
                    { consolidatedSemanticId: consolidated.id, mergeRuleId: mergeRule.id },
                  ),
                ]
              : [],
        });
      }

      // Sort consolidated semantics deterministically
      consolidatedSemantics.sort((a, b) => a.id.localeCompare(b.id));
      mergeResults.sort((a, b) => a.consolidatedSemanticId.localeCompare(b.consolidatedSemanticId));

      // Phase 4: Build output collection
      const collectionId = deterministicIdentity("bgc-consolidated-semantic-collection", {
        count: consolidatedSemantics.length,
        ids: consolidatedSemantics.map((c) => c.id).sort(),
        sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      });

      // Collect diagnostics from merge results
      const allDiagnostics = [
        ...diagnostics,
        ...mergeResults.flatMap((mr) => mr.diagnostics),
      ];

      const output: ConsolidatedSemanticCollection = {
        id: collectionId,
        sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
        consolidatedSemantics,
        mergeResults,
        diagnostics: sortDiagnostics(allDiagnostics),
        passId,
        passVersion,
        specificationVersion: input.specificationVersion,
        compilerVersion: input.compilerVersion,
        consolidationRuleVersion: "1.0.0",
        passHistory: updatePassHistory(
          input.passHistory,
          passId,
          passVersion,
          "completed",
          allDiagnostics.length,
        ),
        semanticCandidates: input,
      };

      return {
        passId,
        passVersion,
        output,
        diagnostics: sortDiagnostics(allDiagnostics),
        fatal: false,
      };
    } catch (error) {
      const errorDiagnostic = createDiagnostic(
        BGC_DIAGNOSTIC_CODES.PIPELINE.PASS_EXECUTION_FAILED,
        "fatal",
        `Semantic consolidation pass execution failed: ${error instanceof Error ? error.message : String(error)}`,
        passId,
        { error: error instanceof Error ? error.message : String(error) },
      );
      diagnostics.push(errorDiagnostic);

      return {
        passId,
        passVersion,
        output: {
          id: deterministicIdentity("bgc-consolidated-semantic-collection", { error: "execution-failed" }),
          sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
          consolidatedSemantics: [],
          mergeResults: [],
          diagnostics: sortDiagnostics(diagnostics),
          passId,
          passVersion,
          specificationVersion: input.specificationVersion,
          compilerVersion: input.compilerVersion,
          consolidationRuleVersion: "1.0.0",
          passHistory: updatePassHistory(
            input.passHistory,
            passId,
            passVersion,
            "failed",
            diagnostics.length,
          ),
          semanticCandidates: input,
        },
        diagnostics: sortDiagnostics(diagnostics),
        fatal: true,
      };
    }
  }
}

export { SEMANTIC_CONSOLIDATION_RULES };
export const CONSOLIDATION_RULES_BY_CRITERIA = new Map(SEMANTIC_CONSOLIDATION_RULES.map((r) => [r.matchCriteria, r]));
