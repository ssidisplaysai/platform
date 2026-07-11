import type { CompilerPass, CompilerPassContext } from "../../core/types";
import { stableStringify } from "../../core/stableStringify";
import { BGC_DIAGNOSTIC_CODES, createDiagnostic, sortDiagnostics } from "../diagnostics";
import {
  deterministicIdentity,
  type BusinessGenomePassResult,
  type CanonicalEvidenceAttestation,
  type GroupedEvidenceCollection,
  type GroupedEvidenceSet,
} from "../pipeline-types";

const GROUPING_RULE_ID = "bgc.grouping.rule.explicit-evidence-attributes";
const GROUPING_RULE_VERSION = "1.0.0";

function firstString(
  metadata: Readonly<Record<string, unknown>>,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function explicitConflictIndicators(metadata: Readonly<Record<string, unknown>>): string[] {
  const indicators: string[] = [];

  for (const [key, value] of Object.entries(metadata)) {
    if (key.toLowerCase().includes("conflict")) {
      indicators.push(`${key}:${stableStringify(value)}`);
    }
  }

  return indicators.sort();
}

export class EvidenceGroupingPass
  implements CompilerPass<CanonicalEvidenceAttestation, BusinessGenomePassResult<GroupedEvidenceCollection>>
{
  readonly metadata = {
    id: "bgc.evidence-grouping",
    version: "1.0.0",
    description: "Deterministically group evidence for downstream semantic correlation.",
    inputType: "canonical-evidence-attestation",
    outputType: "grouped-evidence-collection",
    dependencies: ["bgc.canonical-verification"],
    capabilities: ["evidence-grouping", "determinism"],
    lifecycle: "active" as const,
  };

  execute(
    input: CanonicalEvidenceAttestation,
    _context: CompilerPassContext,
  ): BusinessGenomePassResult<GroupedEvidenceCollection> {
    const diagnostics = [];
    const evidenceReferences = [...input.validatedEvidence.evidenceReferences].sort((a, b) =>
      a.evidenceNodeId.localeCompare(b.evidenceNodeId),
    );

    if (evidenceReferences.length === 0) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.GROUP.EMPTY_EVIDENCE_SET,
          "error",
          "No evidence references available for deterministic grouping.",
          this.metadata.id,
        ),
      );
    }

    const byGroupKey = new Map<string, GroupedEvidenceSet>();
    const membership = new Map<string, string>();

    for (const reference of evidenceReferences) {
      const metadata = reference.metadataRef;
      const keyMaterial = {
        sourceId: reference.sourceId,
        sourceType: reference.sourceType,
        origin: reference.origin,
        discoveryQuestionId: firstString(metadata, ["discoveryQuestionId", "questionId", "question_id"]),
        discoveryAnswerId: firstString(metadata, ["discoveryAnswerId", "answerId", "answer_id"]),
        evidenceCategory: firstString(metadata, ["evidenceCategory", "category"]),
        subjectReference: firstString(metadata, ["subjectReference", "subject", "subjectId"]),
        declaredContext: firstString(metadata, ["declaredContext", "context"]),
        sourceSection: firstString(metadata, ["sourceSection", "section"]),
        canonicalTopic: firstString(metadata, ["canonicalTopic", "topic", "classification"]),
      };

      const deterministicGroupKey = stableStringify(keyMaterial);
      const groupId = deterministicIdentity("bgc-group", {
        deterministicGroupKey,
        groupingRuleId: GROUPING_RULE_ID,
        groupingRuleVersion: GROUPING_RULE_VERSION,
      });

      if (membership.has(reference.evidenceNodeId) && membership.get(reference.evidenceNodeId) !== groupId) {
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.GROUP.DUPLICATE_GROUP_ASSIGNMENT,
            "error",
            `Evidence node ${reference.evidenceNodeId} was assigned to multiple groups.`,
            this.metadata.id,
            {
              evidenceNodeId: reference.evidenceNodeId,
              priorGroupId: membership.get(reference.evidenceNodeId),
              candidateGroupId: groupId,
            },
            reference.evidenceNodeId,
          ),
        );
      }

      membership.set(reference.evidenceNodeId, groupId);

      const existing = byGroupKey.get(deterministicGroupKey);
      if (!existing) {
        byGroupKey.set(deterministicGroupKey, {
          id: groupId,
          groupingRuleId: GROUPING_RULE_ID,
          groupingRuleVersion: GROUPING_RULE_VERSION,
          deterministicGroupKey,
          evidenceItemIds: [reference.evidenceNodeId],
          provenanceReferences: [reference.provenanceRef.sourceId],
          sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
          diagnostics: [],
          explicitConflictIndicators: explicitConflictIndicators(metadata),
        });
        continue;
      }

      byGroupKey.set(deterministicGroupKey, {
        ...existing,
        evidenceItemIds: [...existing.evidenceItemIds, reference.evidenceNodeId].sort(),
        provenanceReferences: [...new Set([...existing.provenanceReferences, reference.provenanceRef.sourceId])].sort(),
        explicitConflictIndicators: [...new Set([...existing.explicitConflictIndicators, ...explicitConflictIndicators(metadata)])].sort(),
      });
    }

    const groups = [...byGroupKey.values()]
      .map((group) => ({
        ...group,
        evidenceItemIds: [...group.evidenceItemIds].sort(),
        provenanceReferences: [...group.provenanceReferences].sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const uniqueEvidenceInGroups = new Set(groups.flatMap((entry) => entry.evidenceItemIds));
    if (uniqueEvidenceInGroups.size !== evidenceReferences.length) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.GROUP.EVIDENCE_PRESERVATION_MISMATCH,
          "error",
          "Evidence grouping did not preserve a one-to-one membership of evidence items.",
          this.metadata.id,
          {
            evidenceReferenceCount: evidenceReferences.length,
            groupedEvidenceCount: uniqueEvidenceInGroups.size,
          },
        ),
      );
    }

    const sortedDiagnostics = sortDiagnostics([...input.diagnostics, ...diagnostics]);
    const fatal = sortedDiagnostics.some((entry) => entry.severity === "error");

    const collection: GroupedEvidenceCollection = {
      id: deterministicIdentity("bgc-groups", {
        sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
        groupingRuleId: GROUPING_RULE_ID,
        groupingRuleVersion: GROUPING_RULE_VERSION,
        groups,
      }),
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      groups,
      diagnostics: sortedDiagnostics,
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      groupingRuleId: GROUPING_RULE_ID,
      groupingRuleVersion: GROUPING_RULE_VERSION,
      passHistory: [
        ...input.passHistory,
        {
          passId: this.metadata.id,
          version: this.metadata.version,
          status: fatal ? "failed" : "completed",
          diagnosticCount: sortedDiagnostics.length,
        },
      ],
      canonicalAttestation: input,
    };

    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output: collection,
      diagnostics: sortedDiagnostics,
      fatal,
    };
  }
}
