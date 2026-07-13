import type { CompilerDiagnostic, CompilerPassContext, CompilerPass, CompilerPassMetadata } from "../../core/types";
import { deterministicIdentity } from "../pipeline-types";
import type {
  ConsolidatedSemanticCollection,
  RelationshipRule,
  RelationshipResolutionContext,
  RelationshipResolutionResult,
  ResolvedRelationship,
  ResolvedRelationshipCollection,
  BusinessGenomePassResult,
  SemanticConflictReference,
} from "../pipeline-types";
import { createDiagnostic, BGC_DIAGNOSTIC_CODES, sortDiagnostics } from "../diagnostics";

/**
 * Deterministic relationship rules for explicit semantic relationships.
 *
 * Rules are evidence-backed and versioned. Only explicit evidence signals
 * trigger relationship creation.
 */
export const SEMANTIC_RELATIONSHIP_RULES: readonly RelationshipRule[] = [
  {
    id: "bgc.relationship.rule.customer-purchased-product",
    version: "1.0.0",
    relationshipType: "purchased",
    sourceSemanticClass: "customer",
    targetSemanticClass: "product",
    description: "Customer PURCHASED Product (explicit evidence only)",
    requiredEvidenceSignal: "purchase-transaction|order-fulfillment|sales-record",
    rationaleCode: "BGC-RATIONALE-RELATIONSHIP-001",
  },
  {
    id: "bgc.relationship.rule.policy-governs-process",
    version: "1.0.0",
    relationshipType: "governs",
    sourceSemanticClass: "policy",
    targetSemanticClass: "process",
    description: "Policy GOVERNS Process (explicit evidence only)",
    requiredEvidenceSignal: "governance-statement|policy-requirement|process-control",
    rationaleCode: "BGC-RATIONALE-RELATIONSHIP-002",
  },
  {
    id: "bgc.relationship.rule.organization-owns-asset",
    version: "1.0.0",
    relationshipType: "owns",
    sourceSemanticClass: "organization",
    targetSemanticClass: "asset",
    description: "Organization OWNS Asset (explicit evidence only)",
    requiredEvidenceSignal: "ownership-record|asset-assignment|resource-allocation",
    rationaleCode: "BGC-RATIONALE-RELATIONSHIP-003",
  },
  {
    id: "bgc.relationship.rule.supplier-provides-product",
    version: "1.0.0",
    relationshipType: "provides",
    sourceSemanticClass: "supplier",
    targetSemanticClass: "product",
    description: "Supplier PROVIDES Product (explicit evidence only)",
    requiredEvidenceSignal: "supply-agreement|product-catalog|vendor-contract",
    rationaleCode: "BGC-RATIONALE-RELATIONSHIP-004",
  },
];

// Indexed by sourceClass -> targetClass -> rule for efficient lookup
const RELATIONSHIP_RULES_BY_CLASSES = new Map<string, Map<string, RelationshipRule>>();

for (const rule of SEMANTIC_RELATIONSHIP_RULES) {
  if (!RELATIONSHIP_RULES_BY_CLASSES.has(rule.sourceSemanticClass)) {
    RELATIONSHIP_RULES_BY_CLASSES.set(rule.sourceSemanticClass, new Map());
  }

  const targetMap = RELATIONSHIP_RULES_BY_CLASSES.get(rule.sourceSemanticClass)!;
  targetMap.set(rule.targetSemanticClass, rule);
}

/**
 * BGC-PASS-007: Semantic Relationship Resolution
 *
 * Deterministically identifies and resolves explicit semantic relationships
 * between consolidated semantic concepts.
 *
 * Input: ConsolidatedSemanticCollection (from M1.5)
 * Output: ResolvedRelationshipCollection (M1.6)
 *
 * Key invariant: Only relationships backed by explicit evidence are created.
 * No inference, no AI, no fuzzy matching.
 */
export class SemanticRelationshipResolutionPass implements CompilerPass<ConsolidatedSemanticCollection, BusinessGenomePassResult<ResolvedRelationshipCollection>> {
  readonly metadata: CompilerPassMetadata = {
    id: "bgc.relationship-resolution",
    version: "1.0.0",
    dependencies: ["bgc.semantic-consolidation"],
    description:
      "Deterministically identifies and resolves explicit semantic relationships between consolidated semantic concepts",
    inputType: "consolidated-semantic-collection",
    outputType: "resolved-relationship-collection",
    capabilities: ["relationship-resolution", "determinism", "non-modifying"],
    lifecycle: "active" as const,
  };

  execute(
    input: ConsolidatedSemanticCollection,
    context: CompilerPassContext,
  ): BusinessGenomePassResult<ResolvedRelationshipCollection> {
    const startTime = Date.now();
    const diagnostics: CompilerDiagnostic[] = [];

    // Validate input
    if (!input || !input.consolidatedSemantics) {
      const diagnostic = createDiagnostic(
        "BGC-PIPELINE-003",
        "error",
        "Input ConsolidatedSemanticCollection is missing or invalid",
        this.metadata.id,
      );
      diagnostics.push(diagnostic);
      return this.buildFatalResult(input, diagnostics);
    }

    // Extract consolidated semantics for deduplication
    const consolidatedById = new Map(input.consolidatedSemantics.map((s) => [s.id, s]));

    // Build relationship candidates
    const relationshipCandidates: RelationshipResolutionResult[] = [];
    const resolvedRelationships: ResolvedRelationship[] = [];

    // For each pair of consolidated semantics, check if relationship rule applies
    const consolidatedArray = Array.from(consolidatedById.values());

    for (let i = 0; i < consolidatedArray.length; i++) {
      const source = consolidatedArray[i];

      for (let j = 0; j < consolidatedArray.length; j++) {
        if (i === j) continue; // No self-relationships

        const target = consolidatedArray[j];

        // Check if rule exists for this class pair
        const rule = this.findApplicableRule(source.semanticClass, target.semanticClass);

        if (!rule) {
          // No rule: no relationship created
          const result: RelationshipResolutionResult = {
            relationshipId: "",
            sourceConsolidatedSemanticId: source.id,
            targetConsolidatedSemanticId: target.id,
            relationshipType: "",
            ruleId: "",
            ruleVersion: "",
            applied: false,
            diagnostics: [
              createDiagnostic(
                BGC_DIAGNOSTIC_CODES.REL.RELATIONSHIP_PREVENTED_BY_CLASS_MISMATCH,
                "info",
                `No relationship rule for ${source.semanticClass} → ${target.semanticClass}`,
                this.metadata.id,
                {
                  sourceClass: source.semanticClass,
                  targetClass: target.semanticClass,
                  sourceId: source.id,
                  targetId: target.id,
                },
              ),
            ],
          };
          relationshipCandidates.push(result);
          continue;
        }

        // Check for conflicts in either semantic
        if (source.hasConflicts || target.hasConflicts) {
          const result: RelationshipResolutionResult = {
            relationshipId: "",
            sourceConsolidatedSemanticId: source.id,
            targetConsolidatedSemanticId: target.id,
            relationshipType: rule.relationshipType,
            ruleId: rule.id,
            ruleVersion: rule.version,
            applied: false,
            diagnostics: [
              createDiagnostic(
                BGC_DIAGNOSTIC_CODES.REL.RELATIONSHIP_PREVENTED_BY_CONFLICT,
                "warning",
                `Relationship blocked: conflicting consolidated semantic ${source.hasConflicts ? "source" : "target"}`,
                this.metadata.id,
                {
                  ruleId: rule.id,
                  sourceId: source.id,
                  targetId: target.id,
                },
              ),
            ],
          };
          relationshipCandidates.push(result);
          continue;
        }

        // Check for explicit evidence signal in either consolidated semantic
        const hasEvidenceSignal = this.hasEvidenceSignalForRelationship(source, target, rule);

        if (!hasEvidenceSignal) {
          const result: RelationshipResolutionResult = {
            relationshipId: "",
            sourceConsolidatedSemanticId: source.id,
            targetConsolidatedSemanticId: target.id,
            relationshipType: rule.relationshipType,
            ruleId: rule.id,
            ruleVersion: rule.version,
            applied: false,
            diagnostics: [
              createDiagnostic(
                BGC_DIAGNOSTIC_CODES.REL.RELATIONSHIP_PREVENTED_BY_MISSING_EVIDENCE,
                "info",
                `No explicit evidence for relationship: ${rule.relationshipType}`,
                this.metadata.id,
                {
                  ruleId: rule.id,
                  sourceId: source.id,
                  targetId: target.id,
                  requiredSignal: rule.requiredEvidenceSignal,
                },
              ),
            ],
          };
          relationshipCandidates.push(result);
          continue;
        }

        // Build resolved relationship
        const relationship = this.buildResolvedRelationship(
          source,
          target,
          rule,
          input.sourceEvidenceIrIdentity,
          diagnostics,
        );

        const result: RelationshipResolutionResult = {
          relationshipId: relationship.id,
          sourceConsolidatedSemanticId: source.id,
          targetConsolidatedSemanticId: target.id,
          relationshipType: rule.relationshipType,
          ruleId: rule.id,
          ruleVersion: rule.version,
          applied: true,
          diagnostics: [
            createDiagnostic(
              BGC_DIAGNOSTIC_CODES.REL.RELATIONSHIP_RESOLVED,
              "info",
              `Relationship resolved: ${rule.relationshipType} (${source.semanticClass} → ${target.semanticClass})`,
              this.metadata.id,
              {
                relationshipId: relationship.id,
                ruleId: rule.id,
                relationshipType: rule.relationshipType,
              },
            ),
          ],
        };

        relationshipCandidates.push(result);
        resolvedRelationships.push(relationship);
      }
    }

    // Sort for determinism
    const sortedRelationships = resolvedRelationships.sort((a, b) => a.id.localeCompare(b.id));
    const sortedResults = relationshipCandidates.sort((a, b) =>
      (a.relationshipId || "").localeCompare(b.relationshipId || ""),
    );

    // Collect all diagnostics
    for (const result of sortedResults) {
      diagnostics.push(...result.diagnostics);
    }

    const sortedDiagnostics = sortDiagnostics(diagnostics);

    const output: ResolvedRelationshipCollection = {
      id: deterministicIdentity("bgc-rel-collection", {
        sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
        relationshipCount: sortedRelationships.length,
      }),
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      relationships: sortedRelationships,
      resolutionResults: sortedResults,
      diagnostics: sortedDiagnostics,
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      specificationVersion: input.specificationVersion,
      compilerVersion: input.compilerVersion,
      relationshipRuleVersion: "1.0.0",
      passHistory: [
        ...input.passHistory,
        {
          passId: this.metadata.id,
          version: this.metadata.version,
          status: "completed",
          diagnosticCount: sortedDiagnostics.length,
        },
      ],
      consolidatedSemantics: input,
    };

    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output,
      diagnostics: sortedDiagnostics,
      fatal: false,
    };
  }

  private findApplicableRule(sourceClass: string, targetClass: string): RelationshipRule | undefined {
    return RELATIONSHIP_RULES_BY_CLASSES.get(sourceClass)?.get(targetClass);
  }

  private hasEvidenceSignalForRelationship(source: any, target: any, rule: RelationshipRule): boolean {
    // Check source evidence for signals matching rule requirement
    const signals = rule.requiredEvidenceSignal.split("|");
    const sourceEvidenceSet = new Set(source.evidenceItemIds || []);
    const targetEvidenceSet = new Set(target.evidenceItemIds || []);

    // Simple heuristic: check if any evidence item contains relationship keywords
    for (const item of sourceEvidenceSet) {
      for (const signal of signals) {
        if (item.toLowerCase().includes(signal.toLowerCase())) {
          return true;
        }
      }
    }

    for (const item of targetEvidenceSet) {
      for (const signal of signals) {
        if (item.toLowerCase().includes(signal.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  }

  private buildResolvedRelationship(
    source: any,
    target: any,
    rule: RelationshipRule,
    sourceEvidenceIrIdentity: string,
    diagnostics: CompilerDiagnostic[],
  ): ResolvedRelationship {
    // Merge evidence from both semantics
    const mergedEvidenceClusterIds = [
      ...new Set([...(source.evidenceClusterIds || []), ...(target.evidenceClusterIds || [])]),
    ].sort();
    const mergedEvidenceGroupIds = [
      ...new Set([...(source.evidenceGroupIds || []), ...(target.evidenceGroupIds || [])]),
    ].sort();
    const mergedEvidenceItemIds = [
      ...new Set([...(source.evidenceItemIds || []), ...(target.evidenceItemIds || [])]),
    ].sort();
    const mergedProvenanceReferences = [
      ...new Set([...(source.provenanceReferences || []), ...(target.provenanceReferences || [])]),
    ].sort();

    const resolutionContext: RelationshipResolutionContext = {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      compilerVersion: source.consolidationContext?.compilerVersion || "1.0.0",
      specificationVersion: source.consolidationContext?.specificationVersion || "1.0.0",
      ruleId: rule.id,
      ruleVersion: rule.version,
      rationaleCode: rule.rationaleCode,
    };

    const relationshipId = deterministicIdentity("bgc-rel", {
      sourceId: source.id,
      targetId: target.id,
      relationshipType: rule.relationshipType,
      ruleId: rule.id,
      evidence: mergedEvidenceItemIds,
    });

    return {
      id: relationshipId,
      relationshipType: rule.relationshipType,
      sourceConsolidatedSemanticId: source.id,
      targetConsolidatedSemanticId: target.id,
      sourceSemanticClass: source.semanticClass,
      targetSemanticClass: target.semanticClass,
      resolutionRuleId: rule.id,
      resolutionRuleVersion: rule.version,
      evidenceClusterIds: mergedEvidenceClusterIds,
      evidenceGroupIds: mergedEvidenceGroupIds,
      evidenceItemIds: mergedEvidenceItemIds,
      provenanceReferences: mergedProvenanceReferences,
      sourceEvidenceIrIdentity,
      certainty: {
        state: "certain",
        confidence: 1.0,
      },
      conflictReferences: [],
      validationStatus: {
        valid: true,
        violations: [],
      },
      resolutionContext,
      diagnostics: [],
    };
  }

  private buildFatalResult(
    input: ConsolidatedSemanticCollection,
    diagnostics: CompilerDiagnostic[],
  ): BusinessGenomePassResult<ResolvedRelationshipCollection> {
    const emptyOutput: ResolvedRelationshipCollection = {
      id: deterministicIdentity("bgc-rel-collection-empty", { error: true }),
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      relationships: [],
      resolutionResults: [],
      diagnostics,
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      specificationVersion: input.specificationVersion,
      compilerVersion: input.compilerVersion,
      relationshipRuleVersion: "1.0.0",
      passHistory: input.passHistory,
      consolidatedSemantics: input,
    };

    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output: emptyOutput,
      diagnostics,
      fatal: true,
    };
  }
}
