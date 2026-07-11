import type { CompilerPass, CompilerPassContext } from "../../core/types";
import { stableStringify } from "../../core/stableStringify";
import { BUSINESS_GENOME_SEMANTIC_CLASSES, isBusinessGenomeSemanticClass } from "../types";
import { BGC_DIAGNOSTIC_CODES, createDiagnostic, sortDiagnostics } from "../diagnostics";
import {
  deterministicIdentity,
  type BusinessGenomePassResult,
  type CorrelatedEvidenceCollection,
  type EvidenceCluster,
  type SemanticAssertion,
  type SemanticCandidateCollection,
  type SemanticCandidate,
  type SemanticConflictReference,
  type SemanticEvidenceSignal,
  type SemanticResolutionContext,
  type SemanticResolutionResult,
  type SemanticResolutionRule,
  type ValidatedEvidenceReference,
} from "../pipeline-types";

// ─── Rationale Codes ──────────────────────────────────────────────────────

const RATIONALE_CATEGORY_MATCH = "BGC-RATIONALE-001";
const RATIONALE_TYPE_MATCH = "BGC-RATIONALE-002";
const RATIONALE_EXPLICIT_CLASS_MATCH = "BGC-RATIONALE-003";

// ─── Supported Semantic Classes in M1.4 ──────────────────────────────────
//
// Only classes with clear, unambiguous direct mappings from explicit Evidence
// IR metadata fields are supported in M1.4.
//
// Unsupported in M1.4 (require interpretation or lack explicit signal):
//   goal, risk, decision, location, time, business-rule
//
// Not a semantic class (evidence type descriptor, not enterprise concept):
//   observation, inference
//
// Evidence category "observation" is intentionally excluded: it describes the
// nature of the evidence, not the semantic entity being described.

const SUPPORTED_CLASSES_IN_M1_4 = new Set<string>([
  "constraint",
  "capability",
  "process",
  "event",
  "resource",
  "asset",
  "product",
  "policy",
  "customer",
  "supplier",
  "actor",
  "organization",
  "responsibility",
]);

const UNSUPPORTED_CLASSES_IN_M1_4 = new Set<string>(
  BUSINESS_GENOME_SEMANTIC_CLASSES.filter((c) => !SUPPORTED_CLASSES_IN_M1_4.has(c)),
);

// ─── Resolution Rules ─────────────────────────────────────────────────────

/**
 * One rule per supported class. Each rule covers three explicit signal paths
 * (semanticClass > category > type) and records the rationaleCode in each hit.
 */
export const SEMANTIC_RESOLUTION_RULES: readonly SemanticResolutionRule[] = [
  ...Array.from(SUPPORTED_CLASSES_IN_M1_4).sort().map(
    (cls): SemanticResolutionRule => ({
      id: `bgc.semantic.rule.explicit-evidence-signal.${cls}`,
      version: "1.0.0",
      targetSemanticClass: cls,
      description: `Resolves to '${cls}' when any evidence item explicitly declares category, type, or semanticClass as '${cls}'.`,
      requiredSignalField: "category | type | semanticClass",
      requiredSignalValue: cls,
      rationaleCode: RATIONALE_CATEGORY_MATCH,
    }),
  ),
];

const RULE_BY_CLASS = new Map(SEMANTIC_RESOLUTION_RULES.map((r) => [r.targetSemanticClass, r]));

// ─── Signal Extraction ────────────────────────────────────────────────────

/**
 * Extract all explicit semantic signals from a single evidence item's metadata.
 * Uses three ordered signal fields; ALL matches are returned (not just first),
 * so within-item conflicts are visible.
 */
function extractSignalsFromMetadata(
  metadata: Readonly<Record<string, unknown>>,
  evidenceItemId: string,
): SemanticEvidenceSignal[] {
  const signals: SemanticEvidenceSignal[] = [];

  const checks: ReadonlyArray<{ readonly field: string; readonly rationaleCode: string }> = [
    { field: "semanticClass", rationaleCode: RATIONALE_EXPLICIT_CLASS_MATCH },
    { field: "category", rationaleCode: RATIONALE_CATEGORY_MATCH },
    { field: "type", rationaleCode: RATIONALE_TYPE_MATCH },
  ];

  for (const { field, rationaleCode } of checks) {
    const value = metadata[field];
    if (typeof value === "string" && SUPPORTED_CLASSES_IN_M1_4.has(value)) {
      signals.push({
        evidenceItemId,
        signalField: field,
        signalValue: value,
        semanticClass: value,
        ruleId: `bgc.semantic.rule.explicit-evidence-signal.${value}`,
        rationaleCode,
      });
    }
  }

  return signals;
}

/**
 * Collect all semantic signals from a cluster's evidence items.
 */
function collectClusterSignals(
  cluster: EvidenceCluster,
  refIndex: ReadonlyMap<string, ValidatedEvidenceReference>,
): SemanticEvidenceSignal[] {
  const signals: SemanticEvidenceSignal[] = [];

  for (const itemId of [...cluster.evidenceItemIds].sort()) {
    const ref = refIndex.get(itemId);
    if (!ref) {
      continue;
    }

    signals.push(...extractSignalsFromMetadata(ref.metadataRef, itemId));
  }

  return signals;
}

/**
 * Determine the unique semantic classes signalled by a cluster's evidence.
 * Returns sorted for determinism.
 */
function uniqueClassesFromSignals(signals: readonly SemanticEvidenceSignal[]): string[] {
  return [...new Set(signals.map((s) => s.semanticClass))].sort();
}

// ─── Designation Extraction ───────────────────────────────────────────────

/**
 * Extract the best available explicit designation from evidence.
 * Uses canonicalTopic first, then subjectReference, then cluster ID.
 * Never infers a name from freeform text.
 */
function extractDesignation(
  signals: readonly SemanticEvidenceSignal[],
  refIndex: ReadonlyMap<string, ValidatedEvidenceReference>,
  cluster: EvidenceCluster,
): string {
  for (const signal of signals) {
    const ref = refIndex.get(signal.evidenceItemId);
    if (!ref) {
      continue;
    }

    const topic = ref.metadataRef["canonicalTopic"];
    if (typeof topic === "string" && topic.length > 0) {
      return topic;
    }

    const subject = ref.metadataRef["subjectReference"];
    if (typeof subject === "string" && subject.length > 0) {
      return subject;
    }
  }

  return cluster.id;
}

// ─── Provenance Helpers ───────────────────────────────────────────────────

function collectMetadataStrings(
  cluster: EvidenceCluster,
  refIndex: ReadonlyMap<string, ValidatedEvidenceReference>,
  field: string,
): readonly string[] {
  const collected: string[] = [];

  for (const itemId of [...cluster.evidenceItemIds].sort()) {
    const ref = refIndex.get(itemId);
    if (!ref) {
      continue;
    }

    const value = ref.metadataRef[field];
    if (typeof value === "string" && value.length > 0) {
      collected.push(value);
    }
  }

  return [...new Set(collected)].sort();
}

// ─── Candidate Construction ───────────────────────────────────────────────

function buildCandidate(
  cluster: EvidenceCluster,
  semanticClass: string,
  signals: readonly SemanticEvidenceSignal[],
  refIndex: ReadonlyMap<string, ValidatedEvidenceReference>,
  compilerVersion: string,
  specificationVersion: string,
  evidenceIrSchemaVersion: string,
): SemanticCandidate {
  const rule = RULE_BY_CLASS.get(semanticClass) as SemanticResolutionRule;
  const classSignals = signals.filter((s) => s.semanticClass === semanticClass);

  const assertions: SemanticAssertion[] = classSignals.map((signal) => ({
    assertionId: deterministicIdentity("bgc-sa", {
      evidenceItemId: signal.evidenceItemId,
      attribute: signal.signalField,
      value: signal.signalValue,
      clusterId: cluster.id,
    }),
    attribute: signal.signalField,
    value: signal.signalValue,
    evidenceItemIds: [signal.evidenceItemId],
    ruleId: signal.ruleId,
    ruleVersion: rule.version,
    rationaleCode: signal.rationaleCode,
  }));

  const sortedAssertions = [...assertions].sort((a, b) => a.assertionId.localeCompare(b.assertionId));

  const designation = extractDesignation(classSignals, refIndex, cluster);

  const resolutionContext: SemanticResolutionContext = {
    passId: "bgc.semantic-resolution",
    passVersion: "1.0.0",
    compilerVersion,
    specificationVersion,
    ruleId: rule.id,
    ruleVersion: rule.version,
    rationaleCode: classSignals[0]?.rationaleCode ?? RATIONALE_CATEGORY_MATCH,
  };

  const candidateId = deterministicIdentity("bgc-sc", {
    semanticClass,
    clusterId: cluster.id,
    resolutionRuleId: rule.id,
    sourceEvidenceIrIdentity: cluster.sourceEvidenceIrIdentity,
  });

  const questionIds = collectMetadataStrings(cluster, refIndex, "questionId");
  const answerIds = collectMetadataStrings(cluster, refIndex, "answerId");

  const candidateDiagnostics =
    !isBusinessGenomeSemanticClass(semanticClass)
      ? [
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.SEM.INVALID_SEMANTIC_CLASS,
            "error",
            `Semantic class '${semanticClass}' is not a valid BGS-0001 class.`,
            "bgc.semantic-resolution",
            { semanticClass, clusterId: cluster.id },
            candidateId,
          ),
        ]
      : [];

  return {
    id: candidateId,
    semanticClass,
    designation,
    assertions: sortedAssertions,
    evidenceClusterIds: [cluster.id],
    evidenceGroupIds: [...cluster.memberGroupIds].sort(),
    evidenceItemIds: [...cluster.evidenceItemIds].sort(),
    provenanceReferences: [...cluster.provenanceReferences].sort(),
    sourceEvidenceIrIdentity: cluster.sourceEvidenceIrIdentity,
    resolutionRuleId: rule.id,
    resolutionRuleVersion: rule.version,
    certainty: {
      state: "certain",
      confidence: 1.0,
    },
    conflictReferences: [],
    validationStatus: {
      valid: candidateDiagnostics.length === 0,
      violations: candidateDiagnostics.map((d) => d.message),
    },
    resolutionContext,
    diagnostics: candidateDiagnostics,
  };
}

function buildConflictedResult(
  cluster: EvidenceCluster,
  signals: readonly SemanticEvidenceSignal[],
  uniqueClasses: readonly string[],
  passId: string,
): SemanticResolutionResult {
  const conflictId = deterministicIdentity("bgc-conflict", {
    clusterId: cluster.id,
    conflictingClasses: [...uniqueClasses].sort(),
  });

  const conflictRef: SemanticConflictReference = {
    conflictId,
    conflictingSemanticClasses: [...uniqueClasses].sort(),
    conflictingRuleIds: [...new Set(signals.map((s) => s.ruleId))].sort(),
    evidenceClusterIds: [cluster.id],
    notes: [
      `Cluster ${cluster.id} signals ${uniqueClasses.length} incompatible semantic classes: ${uniqueClasses.join(", ")}.`,
      "Conflict preserved for governed downstream resolution.",
    ],
  };

  const diagnostic = createDiagnostic(
    BGC_DIAGNOSTIC_CODES.SEM.CONFLICTING_SEMANTIC_CLASSIFICATIONS,
    "warning",
    `Evidence cluster ${cluster.id} explicitly signals ${uniqueClasses.length} incompatible semantic classes: ${uniqueClasses.join(", ")}. No candidate created. Conflict preserved for downstream resolution.`,
    passId,
    {
      clusterId: cluster.id,
      conflictId,
      conflictingSemanticClasses: uniqueClasses,
      conflictingRuleIds: conflictRef.conflictingRuleIds,
    },
    cluster.id,
  );

  // Produce a single conflicted candidate to preserve all evidence and conflict references
  const conflictedCandidateId = deterministicIdentity("bgc-sc", {
    conflict: conflictId,
    clusterId: cluster.id,
    sourceEvidenceIrIdentity: cluster.sourceEvidenceIrIdentity,
  });

  const conflictedCandidate: SemanticCandidate = {
    id: conflictedCandidateId,
    semanticClass: "__conflicted__",
    designation: cluster.id,
    assertions: [],
    evidenceClusterIds: [cluster.id],
    evidenceGroupIds: [...cluster.memberGroupIds].sort(),
    evidenceItemIds: [...cluster.evidenceItemIds].sort(),
    provenanceReferences: [...cluster.provenanceReferences].sort(),
    sourceEvidenceIrIdentity: cluster.sourceEvidenceIrIdentity,
    resolutionRuleId: "bgc.semantic.rule.conflict-preservation",
    resolutionRuleVersion: "1.0.0",
    certainty: {
      state: "uncertain",
      confidence: 0.0,
    },
    conflictReferences: [conflictRef],
    validationStatus: {
      valid: false,
      violations: [
        `Conflicting semantic classes: ${uniqueClasses.join(", ")}`,
      ],
    },
    resolutionContext: {
      passId,
      passVersion: "1.0.0",
      compilerVersion: "unknown",
      specificationVersion: "unknown",
      ruleId: "bgc.semantic.rule.conflict-preservation",
      ruleVersion: "1.0.0",
      rationaleCode: "BGC-RATIONALE-CONFLICT",
    },
    diagnostics: [diagnostic],
  };

  return {
    clusterId: cluster.id,
    candidates: [conflictedCandidate],
    diagnostics: [diagnostic],
    unsupported: false,
    unsupportedReason: undefined,
  };
}

// ─── Pass Implementation ──────────────────────────────────────────────────

export class SemanticResolutionPass
  implements CompilerPass<CorrelatedEvidenceCollection, BusinessGenomePassResult<SemanticCandidateCollection>>
{
  readonly metadata = {
    id: "bgc.semantic-resolution",
    version: "1.0.0",
    description:
      "Deterministically resolve correlated evidence into evidence-backed provisional semantic candidates.",
    inputType: "correlated-evidence-collection",
    outputType: "semantic-candidate-collection",
    dependencies: ["bgc.evidence-correlation"],
    capabilities: ["semantic-resolution", "determinism", "conflict-preservation"],
    lifecycle: "active" as const,
  };

  execute(
    input: CorrelatedEvidenceCollection,
    _context: CompilerPassContext,
  ): BusinessGenomePassResult<SemanticCandidateCollection> {
    const passId = this.metadata.id;
    const diagnostics = [];

    const validatedView = input.groupedEvidence.canonicalAttestation.validatedEvidence;
    const compilerVersion = validatedView.compilerVersion;
    const specificationVersion = validatedView.specificationVersion;
    const evidenceIrSchemaVersion = validatedView.evidenceIR.schemaVersion;

    // Build an index from evidence node ID to its validated reference.
    const refIndex = new Map<string, ValidatedEvidenceReference>();
    for (const ref of validatedView.evidenceReferences) {
      refIndex.set(ref.evidenceNodeId, ref);
    }

    const clusters = [...input.clusters].sort((a, b) => a.id.localeCompare(b.id));
    const resolutionResults: SemanticResolutionResult[] = [];

    for (const cluster of clusters) {
      const result = this.resolveCluster(
        cluster,
        refIndex,
        compilerVersion,
        specificationVersion,
        evidenceIrSchemaVersion,
        passId,
      );
      resolutionResults.push(result);
    }

    const allCandidates = resolutionResults
      .flatMap((r) => r.candidates)
      .sort((a, b) => a.id.localeCompare(b.id));

    const allDiagnostics = resolutionResults.flatMap((r) => r.diagnostics);

    const sortedDiagnostics = sortDiagnostics([...input.diagnostics, ...diagnostics, ...allDiagnostics]);
    const fatal = sortedDiagnostics.some((d) => d.severity === "error");

    const collection: SemanticCandidateCollection = {
      id: deterministicIdentity("bgc-scc", {
        sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
        candidates: allCandidates.map((c) => c.id),
      }),
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      candidates: allCandidates,
      resolutionResults: [...resolutionResults].sort((a, b) => a.clusterId.localeCompare(b.clusterId)),
      diagnostics: sortedDiagnostics,
      passId,
      passVersion: this.metadata.version,
      specificationVersion,
      compilerVersion,
      passHistory: [
        ...input.passHistory,
        {
          passId,
          version: this.metadata.version,
          status: fatal ? "failed" : "completed",
          diagnosticCount: sortedDiagnostics.length,
        },
      ],
      correlatedEvidence: input,
    };

    return {
      passId,
      passVersion: this.metadata.version,
      output: collection,
      diagnostics: sortedDiagnostics,
      fatal,
    };
  }

  private resolveCluster(
    cluster: EvidenceCluster,
    refIndex: ReadonlyMap<string, ValidatedEvidenceReference>,
    compilerVersion: string,
    specificationVersion: string,
    evidenceIrSchemaVersion: string,
    passId: string,
  ): SemanticResolutionResult {
    const clusterDiagnostics = [];

    // Detect missing provenance: items in the cluster not found in the reference index.
    // Per architecture, all items must be traceable to validated evidence references.
    for (const itemId of [...cluster.evidenceItemIds].sort()) {
      if (!refIndex.has(itemId)) {
        clusterDiagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.SEM.MISSING_PROVENANCE,
            "warning",
            `Cluster ${cluster.id} contains evidence item ${itemId} that is not present in the validated evidence reference index. Provenance cannot be verified for this item.`,
            passId,
            { clusterId: cluster.id, missingEvidenceItemId: itemId },
            cluster.id,
          ),
        );
      }
    }

    // Check for any unsupported class signals first (not in M1.4 scope)
    for (const itemId of [...cluster.evidenceItemIds].sort()) {
      const ref = refIndex.get(itemId);
      if (!ref) {
        continue;
      }

      for (const field of ["semanticClass", "category", "type"] as const) {
        const value = ref.metadataRef[field];
        if (typeof value === "string" && isBusinessGenomeSemanticClass(value) && UNSUPPORTED_CLASSES_IN_M1_4.has(value)) {
          const diagnostic = createDiagnostic(
            BGC_DIAGNOSTIC_CODES.SEM.UNSUPPORTED_SEMANTIC_CLASSIFICATION,
            "warning",
            `Cluster ${cluster.id} contains evidence item ${itemId} with class '${value}' which is a valid BGS-0001 class but is not supported for semantic resolution in M1.4. Preserved without candidate.`,
            passId,
            { clusterId: cluster.id, evidenceItemId: itemId, semanticClass: value, field },
            cluster.id,
          );

          return {
            clusterId: cluster.id,
            candidates: [],
            diagnostics: sortDiagnostics([...clusterDiagnostics, diagnostic]),
            unsupported: true,
            unsupportedReason: `Semantic class '${value}' is valid per BGS-0001 but not supported in M1.4.`,
          };
        }
      }
    }

    const signals = collectClusterSignals(cluster, refIndex);
    const uniqueClasses = uniqueClassesFromSignals(signals);

    // No explicit supported signal found
    if (uniqueClasses.length === 0) {
      const diagnostic = createDiagnostic(
        BGC_DIAGNOSTIC_CODES.SEM.INSUFFICIENT_EXPLICIT_EVIDENCE,
        "warning",
        `Cluster ${cluster.id} contains no explicit governed semantic signal supported by M1.4 resolution rules. Preserved without candidate.`,
        passId,
        { clusterId: cluster.id, evidenceItemIds: cluster.evidenceItemIds },
        cluster.id,
      );

      return {
        clusterId: cluster.id,
        candidates: [],
        diagnostics: sortDiagnostics([...clusterDiagnostics, diagnostic]),
        unsupported: true,
        unsupportedReason: "No explicit governed semantic signal found.",
      };
    }

    // Conflict: multiple incompatible classes
    if (uniqueClasses.length > 1) {
      const conflictResult = buildConflictedResult(cluster, signals, uniqueClasses, passId);
      return {
        ...conflictResult,
        diagnostics: sortDiagnostics([...clusterDiagnostics, ...conflictResult.diagnostics]),
      };
    }

    // Single class: produce a candidate
    const semanticClass = uniqueClasses[0];

    const candidate = buildCandidate(
      cluster,
      semanticClass,
      signals,
      refIndex,
      compilerVersion,
      specificationVersion,
      evidenceIrSchemaVersion,
    );

    return {
      clusterId: cluster.id,
      candidates: [candidate],
      diagnostics: sortDiagnostics([...clusterDiagnostics, ...candidate.diagnostics]),
      unsupported: false,
      unsupportedReason: undefined,
    };
  }
}

export { SUPPORTED_CLASSES_IN_M1_4, UNSUPPORTED_CLASSES_IN_M1_4 };
