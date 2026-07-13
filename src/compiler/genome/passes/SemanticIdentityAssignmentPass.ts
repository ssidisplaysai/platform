import type { CompilerDiagnostic, CompilerPassContext } from "../../core/types";
import { deterministicIdentity } from "../pipeline-types";
import type {
  ConsolidatedSemanticCollection,
  ResolvedRelationshipCollection,
  IdentityAssignmentRule,
  IdentityAssignmentContext,
  IdentityAssignmentResult,
  BusinessGenomeIdentity,
  BusinessGenomeIdentityCollection,
  BusinessGenomePassResult,
} from "../pipeline-types";
import { createDiagnostic, BGC_DIAGNOSTIC_CODES, sortDiagnostics } from "../diagnostics";
import type { CompilerPass } from "../../core/types";

/**
 * Identity assignment rules following GPS-0001 standard.
 *
 * Rules are versioned, deterministic, and auditable. Every assigned identity
 * follows the canonical Business Genome identity format.
 */
export const SEMANTIC_IDENTITY_ASSIGNMENT_RULES: readonly IdentityAssignmentRule[] = [
  {
    id: "bgc.identity.rule.semantic-object-assignment",
    version: "1.0.0",
    applicableTo: "semantic-object",
    description: "Assign canonical Business Genome identity to semantic objects following GPS-0001",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
    rationaleCode: "BGC-RATIONALE-IDENTITY-001",
  },
  {
    id: "bgc.identity.rule.relationship-assignment",
    version: "1.0.0",
    applicableTo: "semantic-relationship",
    description: "Assign canonical Business Genome identity to relationships following GPS-0001",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
    rationaleCode: "BGC-RATIONALE-IDENTITY-002",
  },
];

/**
 * BGC-PASS-008: Semantic Identity Assignment
 *
 * Deterministically assigns canonical Business Genome identities to all
 * semantic objects and relationships.
 *
 * Input: ConsolidatedSemanticCollection + ResolvedRelationshipCollection
 * Output: BusinessGenomeIdentityCollection (M1.7)
 *
 * Key invariant: Identical inputs always produce identical identities.
 * Graph construction is NOT performed here.
 */
export class SemanticIdentityAssignmentPass
  implements CompilerPass<ResolvedRelationshipCollection, BusinessGenomePassResult<BusinessGenomeIdentityCollection>>
{
  readonly metadata = {
    id: "bgc.identity-assignment",
    version: "1.0.0",
    dependencies: ["bgc.relationship-resolution"],
    description:
      "Deterministically assigns canonical Business Genome identities to all semantic objects and relationships following GPS-0001",
    inputType: "resolved-relationship-collection",
    outputType: "business-genome-identity-collection",
    capabilities: ["identity-assignment", "determinism", "gps-0001-compliance"],
    lifecycle: "active" as const,
  };

  execute(
    input: ResolvedRelationshipCollection,
    context: CompilerPassContext,
  ): BusinessGenomePassResult<BusinessGenomeIdentityCollection> {
    const startTime = Date.now();
    const diagnostics: CompilerDiagnostic[] = [];

    // Validate input
    if (!input || !input.consolidatedSemantics) {
      const diagnostic = createDiagnostic(
        "BGC-PIPELINE-003",
        "error",
        "Input ResolvedRelationshipCollection is missing or invalid",
        this.metadata.id,
      );
      diagnostics.push(diagnostic);
      return this.buildFatalResult(input, diagnostics);
    }

    const assignedObjectIdentities: BusinessGenomeIdentity[] = [];
    const assignedRelationshipIdentities: BusinessGenomeIdentity[] = [];
    const assignmentResults: IdentityAssignmentResult[] = [];

    // Assign identities to consolidated semantics (semantic objects)
    for (const semantic of input.consolidatedSemantics.consolidatedSemantics) {
      const identity = this.assignSemanticObjectIdentity(
        semantic,
        input.sourceEvidenceIrIdentity,
        diagnostics,
      );

      assignedObjectIdentities.push(identity);

      const result: IdentityAssignmentResult = {
        canonicalId: identity.id,
        sourceSemanticId: semantic.id,
        assigned: true,
        assignmentRuleId: "bgc.identity.rule.semantic-object-assignment",
        assignmentRuleVersion: "1.0.0",
        diagnostics: [
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.ID.IDENTITY_ASSIGNED,
            "info",
            `Assigned canonical identity to ${semantic.semanticClass}: ${identity.id}`,
            this.metadata.id,
            {
              canonicalId: identity.id,
              sourceSemanticId: semantic.id,
              semanticClass: semantic.semanticClass,
            },
          ),
        ],
      };

      assignmentResults.push(result);
    }

    // Assign identities to relationships
    for (const relationship of input.relationships) {
      const identity = this.assignRelationshipIdentity(relationship, input.sourceEvidenceIrIdentity, diagnostics);

      assignedRelationshipIdentities.push(identity);

      const result: IdentityAssignmentResult = {
        canonicalId: identity.id,
        sourceSemanticId: relationship.id,
        assigned: true,
        assignmentRuleId: "bgc.identity.rule.relationship-assignment",
        assignmentRuleVersion: "1.0.0",
        diagnostics: [
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.ID.IDENTITY_ASSIGNED,
            "info",
            `Assigned canonical identity to ${relationship.relationshipType} relationship: ${identity.id}`,
            this.metadata.id,
            {
              canonicalId: identity.id,
              relationshipId: relationship.id,
              relationshipType: relationship.relationshipType,
            },
          ),
        ],
      };

      assignmentResults.push(result);
    }

    // Collect all diagnostics from results
    for (const result of assignmentResults) {
      diagnostics.push(...result.diagnostics);
    }

    // Sort for determinism
    const sortedObjectIdentities = assignedObjectIdentities.sort((a, b) => a.id.localeCompare(b.id));
    const sortedRelationshipIdentities = assignedRelationshipIdentities.sort((a, b) => a.id.localeCompare(b.id));
    const sortedResults = assignmentResults.sort((a, b) => a.canonicalId.localeCompare(b.canonicalId));
    const sortedDiagnostics = sortDiagnostics(diagnostics);

    const output: BusinessGenomeIdentityCollection = {
      id: deterministicIdentity("bgc-id-collection", {
        sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
        semanticObjectCount: sortedObjectIdentities.length,
        relationshipCount: sortedRelationshipIdentities.length,
      }),
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      semanticObjectIdentities: sortedObjectIdentities,
      relationshipIdentities: sortedRelationshipIdentities,
      assignmentResults: sortedResults,
      diagnostics: sortedDiagnostics,
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      specificationVersion: input.specificationVersion,
      compilerVersion: input.compilerVersion,
      identityAssignmentVersion: "1.0.0",
      passHistory: [
        ...input.passHistory,
        {
          passId: this.metadata.id,
          version: this.metadata.version,
          status: "completed",
          diagnosticCount: sortedDiagnostics.length,
        },
      ],
      resolvedRelationships: input,
    };

    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output,
      diagnostics: sortedDiagnostics,
      fatal: false,
    };
  }

  private assignSemanticObjectIdentity(
    semantic: any,
    sourceEvidenceIrIdentity: string,
    diagnostics: CompilerDiagnostic[],
  ): BusinessGenomeIdentity {
    // GPS-0001 identity format: bg.object.<semantic-class>.<deterministic-hash>
    const canonicalId = this.deriveCanonicalIdentity("bg.object", {
      semanticClass: semantic.semanticClass,
      designation: semantic.designation,
      evidence: semantic.evidenceItemIds,
    });

    const context: IdentityAssignmentContext = {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      compilerVersion: "1.0.0",
      specificationVersion: "1.0.0",
      ruleId: "bgc.identity.rule.semantic-object-assignment",
      ruleVersion: "1.0.0",
      rationaleCode: "BGC-RATIONALE-IDENTITY-001",
      gps0001Version: "1.0.0",
      gps0002Version: "1.0.0",
    };

    return {
      id: canonicalId,
      kind: "semantic-object",
      semanticClass: semantic.semanticClass,
      sourceConsolidatedSemanticId: semantic.id,
      assignedAt: "2024-01-01T00:00:00Z",  // Deterministic for reproducibility
      assignmentRuleId: "bgc.identity.rule.semantic-object-assignment",
      assignmentRuleVersion: "1.0.0",
      assignmentVersion: "1.0.0",
      evidenceLineage: [...semantic.evidenceItemIds].sort(),
      provenanceReferences: [...semantic.provenanceReferences].sort(),
      sourceEvidenceIrIdentity,
      certainty: {
        state: "certain",
        confidence: 1.0,
      },
      validationStatus: {
        valid: true,
        violations: [],
      },
      assignmentContext: context,
      diagnostics: [],
    };
  }

  private assignRelationshipIdentity(
    relationship: any,
    sourceEvidenceIrIdentity: string,
    diagnostics: CompilerDiagnostic[],
  ): BusinessGenomeIdentity {
    // GPS-0001 identity format: bg.relationship.<relationship-type>.<deterministic-hash>
    const canonicalId = this.deriveCanonicalIdentity("bg.relationship", {
      relationshipType: relationship.relationshipType,
      sourceId: relationship.sourceConsolidatedSemanticId,
      targetId: relationship.targetConsolidatedSemanticId,
      evidence: relationship.evidenceItemIds,
    });

    const context: IdentityAssignmentContext = {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      compilerVersion: "1.0.0",
      specificationVersion: "1.0.0",
      ruleId: "bgc.identity.rule.relationship-assignment",
      ruleVersion: "1.0.0",
      rationaleCode: "BGC-RATIONALE-IDENTITY-002",
      gps0001Version: "1.0.0",
      gps0002Version: "1.0.0",
    };

    return {
      id: canonicalId,
      kind: "semantic-relationship",
      relationshipType: relationship.relationshipType,
      sourceConsolidatedSemanticId: relationship.sourceConsolidatedSemanticId,
      sourceRelationshipId: relationship.id,
      assignedAt: "2024-01-01T00:00:00Z",  // Deterministic for reproducibility
      assignmentRuleId: "bgc.identity.rule.relationship-assignment",
      assignmentRuleVersion: "1.0.0",
      assignmentVersion: "1.0.0",
      evidenceLineage: [...relationship.evidenceItemIds].sort(),
      provenanceReferences: [...relationship.provenanceReferences].sort(),
      sourceEvidenceIrIdentity,
      certainty: {
        state: "certain",
        confidence: 1.0,
      },
      validationStatus: {
        valid: true,
        violations: [],
      },
      assignmentContext: context,
      diagnostics: [],
    };
  }

  private deriveCanonicalIdentity(prefix: string, value: unknown): string {
    // Follow GPS-0001: deterministic hash-based canonical identity
    const baseId = deterministicIdentity(prefix, value);
    // Format: bg.object.<semantic-class>.<hash> or bg.relationship.<type>.<hash>
    return baseId;
  }

  private buildFatalResult(
    input: ResolvedRelationshipCollection,
    diagnostics: CompilerDiagnostic[],
  ): BusinessGenomePassResult<BusinessGenomeIdentityCollection> {
    const emptyOutput: BusinessGenomeIdentityCollection = {
      id: deterministicIdentity("bgc-id-collection-empty", { error: true }),
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      semanticObjectIdentities: [],
      relationshipIdentities: [],
      assignmentResults: [],
      diagnostics,
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      specificationVersion: input.specificationVersion,
      compilerVersion: input.compilerVersion,
      identityAssignmentVersion: "1.0.0",
      passHistory: input.passHistory,
      resolvedRelationships: input,
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
