import type { CompilerPass, CompilerPassContext } from "../../core/types";
import { stableStringify } from "../../core/stableStringify";
import { BGC_DIAGNOSTIC_CODES, createDiagnostic, sortDiagnostics } from "../diagnostics";
import {
  deterministicIdentity,
  type BusinessGenomePassResult,
  type CorrelationBasis,
  type CorrelatedEvidenceCollection,
  type EvidenceCluster,
  type GroupedEvidenceCollection,
  type GroupedEvidenceSet,
} from "../pipeline-types";

const CORRELATION_RULE_EXPLICIT_IR_RELATIONSHIP =
  "bgc.correlation.rule.explicit-ir-cross-group-relationship";
const CORRELATION_RULE_IDENTICAL_SUBJECT_REFERENCE =
  "bgc.correlation.rule.identical-declared-subject-reference";
const CORRELATION_RULE_VERSION = "1.0.0";

/**
 * Deterministic union-find structure for clustering groups.
 *
 * Uses lexicographic ordering to guarantee deterministic root selection
 * regardless of union call order.
 */
class DeterministicUnionFind {
  private readonly parent = new Map<string, string>();

  find(id: string): string {
    if (!this.parent.has(id)) {
      this.parent.set(id, id);
    }

    const parent = this.parent.get(id) as string;
    if (parent === id) {
      return id;
    }

    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === rootB) {
      return;
    }

    // Lexicographically smaller root wins for determinism.
    if (rootA < rootB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootA, rootB);
    }
  }

  allRoots(ids: readonly string[]): Map<string, string[]> {
    const byRoot = new Map<string, string[]>();

    for (const id of [...ids].sort()) {
      const root = this.find(id);
      const members = byRoot.get(root) ?? [];
      members.push(id);
      byRoot.set(root, members);
    }

    return byRoot;
  }
}

/**
 * Extract the declared subjectReference from a deterministicGroupKey.
 *
 * The group key is produced by stableStringify(), which emits sorted JSON-like
 * output but uses literal `undefined` for missing values (not `null`). This
 * makes the output invalid JSON, so we use a targeted regex instead of
 * JSON.parse to reliably extract the string-typed subjectReference field.
 */
function extractSubjectReference(deterministicGroupKey: string): string | undefined {
  const match = /"subjectReference":"([^"]+)"/.exec(deterministicGroupKey);

  if (match && match[1] && match[1].length > 0) {
    return match[1];
  }

  return undefined;
}

/**
 * Build a mapping from evidence item ID to group ID from a GroupedEvidenceCollection.
 */
function buildItemToGroupIndex(groups: readonly GroupedEvidenceSet[]): Map<string, string> {
  const index = new Map<string, string>();

  for (const group of groups) {
    for (const itemId of group.evidenceItemIds) {
      index.set(itemId, group.id);
    }
  }

  return index;
}

export class EvidenceCorrelationPass
  implements CompilerPass<GroupedEvidenceCollection, BusinessGenomePassResult<CorrelatedEvidenceCollection>>
{
  readonly metadata = {
    id: "bgc.evidence-correlation",
    version: "1.0.0",
    description:
      "Deterministically correlate Evidence Groups describing the same underlying enterprise reality.",
    inputType: "grouped-evidence-collection",
    outputType: "correlated-evidence-collection",
    dependencies: ["bgc.evidence-grouping"],
    capabilities: ["evidence-correlation", "determinism", "conflict-preservation"],
    lifecycle: "active" as const,
  };

  execute(
    input: GroupedEvidenceCollection,
    _context: CompilerPassContext,
  ): BusinessGenomePassResult<CorrelatedEvidenceCollection> {
    const diagnostics = [];
    const groups = [...input.groups].sort((a, b) => a.id.localeCompare(b.id));

    if (groups.length === 0) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.CORR.NO_GROUPS_TO_CORRELATE,
          "warning",
          "No evidence groups available for correlation. Producing empty cluster collection.",
          this.metadata.id,
        ),
      );

      const sortedDiagnostics = sortDiagnostics([...input.diagnostics, ...diagnostics]);

      const collection: CorrelatedEvidenceCollection = {
        id: deterministicIdentity("bgc-clusters", {
          sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
          correlationRuleVersion: CORRELATION_RULE_VERSION,
          clusters: [],
        }),
        sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
        clusters: [],
        diagnostics: sortedDiagnostics,
        passId: this.metadata.id,
        passVersion: this.metadata.version,
        correlationRuleVersion: CORRELATION_RULE_VERSION,
        passHistory: [
          ...input.passHistory,
          {
            passId: this.metadata.id,
            version: this.metadata.version,
            status: "completed",
            diagnosticCount: sortedDiagnostics.length,
          },
        ],
        groupedEvidence: input,
      };

      return {
        passId: this.metadata.id,
        passVersion: this.metadata.version,
        output: collection,
        diagnostics: sortedDiagnostics,
        fatal: false,
      };
    }

    const uf = new DeterministicUnionFind();

    // Initialize all group IDs in the union-find.
    for (const group of groups) {
      uf.find(group.id);
    }

    const correlationBasisByPair = new Map<string, CorrelationBasis[]>();

    // Rule 1: Explicit cross-group IR relationships.
    const itemToGroup = buildItemToGroupIndex(groups);
    const evidenceIR = input.canonicalAttestation.validatedEvidence.evidenceIR;

    for (const relationship of [...evidenceIR.graph.relationships].sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const fromGroup = itemToGroup.get(relationship.from);
      const toGroup = itemToGroup.get(relationship.to);

      if (fromGroup === undefined || toGroup === undefined || fromGroup === toGroup) {
        continue;
      }

      const pairKey = [fromGroup, toGroup].sort().join("|");
      const existing = correlationBasisByPair.get(pairKey) ?? [];

      const alreadyHasIRBasis = existing.some((b) => b.ruleId === CORRELATION_RULE_EXPLICIT_IR_RELATIONSHIP);
      if (!alreadyHasIRBasis) {
        existing.push({
          ruleId: CORRELATION_RULE_EXPLICIT_IR_RELATIONSHIP,
          participatingGroupIds: [fromGroup, toGroup].sort(),
          details: {
            relationshipId: relationship.id,
            relationshipType: relationship.relationshipType,
            fromNodeId: relationship.from,
            toNodeId: relationship.to,
          },
        });
        correlationBasisByPair.set(pairKey, existing);
      }

      uf.union(fromGroup, toGroup);
    }

    // Rule 2: Identical declared subject reference across groups.
    const bySubjectReference = new Map<string, GroupedEvidenceSet[]>();

    for (const group of groups) {
      const subjectReference = extractSubjectReference(group.deterministicGroupKey);

      if (subjectReference === undefined) {
        continue;
      }

      const bucket = bySubjectReference.get(subjectReference) ?? [];
      bucket.push(group);
      bySubjectReference.set(subjectReference, bucket);
    }

    for (const [subjectReference, subjectGroups] of [...bySubjectReference.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (subjectGroups.length < 2) {
        continue;
      }

      const sortedSubjectGroups = [...subjectGroups].sort((a, b) => a.id.localeCompare(b.id));

      for (let i = 0; i < sortedSubjectGroups.length - 1; i++) {
        const groupA = sortedSubjectGroups[i];
        const groupB = sortedSubjectGroups[i + 1];
        const pairKey = [groupA.id, groupB.id].sort().join("|");

        const existing = correlationBasisByPair.get(pairKey) ?? [];

        const alreadyHasSubjectBasis = existing.some(
          (b) => b.ruleId === CORRELATION_RULE_IDENTICAL_SUBJECT_REFERENCE,
        );

        if (!alreadyHasSubjectBasis) {
          existing.push({
            ruleId: CORRELATION_RULE_IDENTICAL_SUBJECT_REFERENCE,
            participatingGroupIds: [groupA.id, groupB.id].sort(),
            details: {
              subjectReference,
              groupAId: groupA.id,
              groupBId: groupB.id,
            },
          });
          correlationBasisByPair.set(pairKey, existing);
        }

        uf.union(groupA.id, groupB.id);
      }
    }

    // Build clusters from union-find roots.
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const clustersByRoot = uf.allRoots(groups.map((g) => g.id));
    const clusters: EvidenceCluster[] = [];
    const assignedGroups = new Set<string>();

    for (const [root, memberGroupIds] of [...clustersByRoot.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const sortedMemberGroupIds = [...memberGroupIds].sort();
      const memberGroups = sortedMemberGroupIds.map((id) => groupById.get(id) as GroupedEvidenceSet);

      const evidenceItemIds = [
        ...new Set(memberGroups.flatMap((g) => g.evidenceItemIds)),
      ].sort();

      const provenanceReferences = [
        ...new Set(memberGroups.flatMap((g) => g.provenanceReferences)),
      ].sort();

      const explicitConflictIndicators = [
        ...new Set(memberGroups.flatMap((g) => g.explicitConflictIndicators)),
      ].sort();

      // Collect all correlation bases that involve any pair within this cluster.
      const clusterBases: CorrelationBasis[] = [];
      const memberGroupSet = new Set(sortedMemberGroupIds);

      for (const [pairKey, bases] of [...correlationBasisByPair.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const [groupA, groupB] = pairKey.split("|");
        if (memberGroupSet.has(groupA) && memberGroupSet.has(groupB)) {
          for (const basis of bases) {
            clusterBases.push(basis);
          }
        }
      }

      // Check for duplicate cluster assignment.
      for (const groupId of sortedMemberGroupIds) {
        if (assignedGroups.has(groupId)) {
          diagnostics.push(
            createDiagnostic(
              BGC_DIAGNOSTIC_CODES.CORR.DUPLICATE_CLUSTER_ASSIGNMENT,
              "error",
              `Evidence group ${groupId} was assigned to multiple clusters.`,
              this.metadata.id,
              { groupId, clusterRoot: root },
              groupId,
            ),
          );
        }
        assignedGroups.add(groupId);
      }

      const deterministicClusterKey = stableStringify({
        memberGroupIds: sortedMemberGroupIds,
        correlationRuleVersion: CORRELATION_RULE_VERSION,
        sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      });

      const clusterId = deterministicIdentity("bgc-cluster", {
        deterministicClusterKey,
        root,
      });

      const clusterDiagnostics = [];

      // Emit diagnostic if correlated groups have cross-cluster conflicts.
      if (sortedMemberGroupIds.length > 1 && explicitConflictIndicators.length > 0) {
        clusterDiagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.CORR.CROSS_CLUSTER_CONFLICT_DETECTED,
            "warning",
            `Evidence cluster ${clusterId} contains correlated groups with conflict indicators. Conflicts preserved for downstream resolution.`,
            this.metadata.id,
            {
              clusterId,
              memberGroupIds: sortedMemberGroupIds,
              explicitConflictIndicators,
            },
            clusterId,
          ),
        );
      }

      const activeRuleIds = [
        ...new Set(clusterBases.map((b) => b.ruleId)),
      ].sort();

      clusters.push({
        id: clusterId,
        correlationRuleIds: activeRuleIds,
        correlationRuleVersion: CORRELATION_RULE_VERSION,
        deterministicClusterKey,
        memberGroupIds: sortedMemberGroupIds,
        evidenceItemIds,
        provenanceReferences,
        sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
        correlationBases: [...clusterBases].sort((a, b) =>
          a.ruleId.localeCompare(b.ruleId),
        ),
        diagnostics: clusterDiagnostics,
        explicitConflictIndicators,
      });

      for (const d of clusterDiagnostics) {
        diagnostics.push(d);
      }
    }

    const sortedClusters = [...clusters].sort((a, b) => a.id.localeCompare(b.id));

    // Verify evidence preservation.
    const allInputItemIds = new Set(groups.flatMap((g) => g.evidenceItemIds));
    const allClusteredItemIds = new Set(sortedClusters.flatMap((c) => c.evidenceItemIds));

    if (allInputItemIds.size !== allClusteredItemIds.size) {
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.CORR.EVIDENCE_PRESERVATION_MISMATCH,
          "error",
          "Evidence correlation did not preserve all evidence items from the input groups.",
          this.metadata.id,
          {
            inputItemCount: allInputItemIds.size,
            clusteredItemCount: allClusteredItemIds.size,
          },
        ),
      );
    }

    const sortedDiagnostics = sortDiagnostics([...input.diagnostics, ...diagnostics]);
    const fatal = sortedDiagnostics.some((d) => d.severity === "error");

    const collection: CorrelatedEvidenceCollection = {
      id: deterministicIdentity("bgc-clusters", {
        sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
        correlationRuleVersion: CORRELATION_RULE_VERSION,
        clusters: sortedClusters,
      }),
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      clusters: sortedClusters,
      diagnostics: sortedDiagnostics,
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      correlationRuleVersion: CORRELATION_RULE_VERSION,
      passHistory: [
        ...input.passHistory,
        {
          passId: this.metadata.id,
          version: this.metadata.version,
          status: fatal ? "failed" : "completed",
          diagnosticCount: sortedDiagnostics.length,
        },
      ],
      groupedEvidence: input,
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
