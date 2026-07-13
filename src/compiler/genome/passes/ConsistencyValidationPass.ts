import type { CompilerDiagnostic, CompilerPassContext } from "../../core/types";
import type { CompilerPass, CompilerPassMetadata } from "../../core/types";
import type {
  BusinessGenomeGraph,
  BusinessGenomePassResult,
  BusinessGenomeValidationResult,
  GraphInvariantViolation,
  ValidationSummary,
  ValidationContext,
} from "../pipeline-types";
import { stableStringify } from "../../core/stableStringify";
import { SourceHash } from "../../provenance/SourceHash";
import { createDiagnostic, BGC_DIAGNOSTIC_CODES, sortDiagnostics } from "../diagnostics";

/**
 * Validation rules following GPS-0001 standard.
 *
 * All validation rules are versioned, deterministic, and non-modifying.
 * Every validated graph preserves all structural properties.
 */
export const CONSISTENCY_VALIDATION_RULES = [
  {
    id: "bgc.validation.rule.unique-node-identities",
    version: "1.0.0",
    description: "Verify that all node identities are unique within the graph",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.validation.rule.unique-edge-identities",
    version: "1.0.0",
    description: "Verify that all edge identities are unique within the graph",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.validation.rule.source-node-exists",
    version: "1.0.0",
    description: "Verify that every edge references a valid source node",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.validation.rule.target-node-exists",
    version: "1.0.0",
    description: "Verify that every edge references a valid target node",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.validation.rule.node-provenance",
    version: "1.0.0",
    description: "Verify that every node contains provenance references",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.validation.rule.edge-provenance",
    version: "1.0.0",
    description: "Verify that every edge contains provenance references",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.validation.rule.lineage-preservation",
    version: "1.0.0",
    description: "Verify that evidence lineage is completely preserved",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.validation.rule.deterministic-ordering",
    version: "1.0.0",
    description: "Verify that nodes and edges are deterministically ordered",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.validation.rule.graph-identity-reproducible",
    version: "1.0.0",
    description: "Verify that graph identity is reproducible from current content",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.validation.rule.compiler-metadata-present",
    version: "1.0.0",
    description: "Verify that all required compiler metadata is present",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
] as const;

/**
 * BGC-PASS-010: Consistency Validation
 *
 * Validates the Business Genome Graph against all compiler invariants.
 * This pass diagnoses structural issues but NEVER modifies the graph.
 *
 * Input: BusinessGenomeGraph (M1.8)
 * Output: BusinessGenomeValidationResult (M1.9)
 *
 * Key invariants:
 * - Graph structure is NEVER modified
 * - Graph is NEVER published
 * - All violations are documented
 * - Validation is deterministic and reproducible
 */
export class ConsistencyValidationPass
  implements CompilerPass<BusinessGenomeGraph, BusinessGenomePassResult<BusinessGenomeValidationResult>>
{
  readonly metadata: CompilerPassMetadata = {
    id: "bgc.consistency-validation",
    version: "1.0.0",
    dependencies: ["bgc.graph-construction"],
    description:
      "Deterministically validates Business Genome Graph for structural integrity and compiler invariant conformance",
    inputType: "business-genome-graph",
    outputType: "business-genome-validation-result",
    capabilities: ["validation", "determinism", "gps-0001-compliance", "non-modifying"],
    lifecycle: "active" as const,
  };

  execute(
    input: BusinessGenomeGraph,
    context: CompilerPassContext,
  ): BusinessGenomePassResult<BusinessGenomeValidationResult> {
    const diagnostics: CompilerDiagnostic[] = [];

    // Validate input
    if (!input || !input.id || !input.nodes || !input.edges) {
      const diagnostic = createDiagnostic(
        BGC_DIAGNOSTIC_CODES.PIPELINE.MISSING_REQUIRED_PASS_OUTPUT,
        "error",
        "Input BusinessGenomeGraph is missing or invalid",
        this.metadata.id,
      );
      diagnostics.push(diagnostic);
      return this.buildFatalResult(input, diagnostics);
    }

    const violations: GraphInvariantViolation[] = [];

    // Validate invariant 1: Unique node identities
    const nodeIds = input.nodes.map((n) => n.id);
    const duplicateNodeIds = this.findDuplicates(nodeIds);
    if (duplicateNodeIds.length > 0) {
      for (const nodeId of duplicateNodeIds) {
        violations.push({
          violationCode: BGC_DIAGNOSTIC_CODES.VALID.DUPLICATE_NODE_IDENTITY,
          violationSeverity: "error",
          invariantType: "unique-node-identities",
          description: `Duplicate node identity found: ${nodeId}`,
          affectedNodeIds: [nodeId],
          diagnosticDetails: { nodeId },
        });
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.VALID.DUPLICATE_NODE_IDENTITY,
            "error",
            `Duplicate node identity: ${nodeId}`,
            this.metadata.id,
            { nodeId },
          ),
        );
      }
    }

    // Validate invariant 2: Unique edge identities
    const edgeIds = input.edges.map((e) => e.id);
    const duplicateEdgeIds = this.findDuplicates(edgeIds);
    if (duplicateEdgeIds.length > 0) {
      for (const edgeId of duplicateEdgeIds) {
        violations.push({
          violationCode: BGC_DIAGNOSTIC_CODES.VALID.DUPLICATE_EDGE_IDENTITY,
          violationSeverity: "error",
          invariantType: "unique-edge-identities",
          description: `Duplicate edge identity found: ${edgeId}`,
          affectedEdgeIds: [edgeId],
          diagnosticDetails: { edgeId },
        });
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.VALID.DUPLICATE_EDGE_IDENTITY,
            "error",
            `Duplicate edge identity: ${edgeId}`,
            this.metadata.id,
            { edgeId },
          ),
        );
      }
    }

    // Build node ID set for orphan detection
    const nodeIdSet = new Set(nodeIds);

    // Validate invariant 3: Every edge source exists
    for (const edge of input.edges) {
      if (!nodeIdSet.has(edge.sourceNodeId)) {
        violations.push({
          violationCode: BGC_DIAGNOSTIC_CODES.VALID.ORPHAN_EDGE_SOURCE_NODE,
          violationSeverity: "error",
          invariantType: "source-node-exists",
          description: `Edge ${edge.id} references non-existent source node: ${edge.sourceNodeId}`,
          affectedEdgeIds: [edge.id],
          diagnosticDetails: { edgeId: edge.id, sourceNodeId: edge.sourceNodeId },
        });
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.VALID.ORPHAN_EDGE_SOURCE_NODE,
            "error",
            `Orphan source node for edge ${edge.id}`,
            this.metadata.id,
            { edgeId: edge.id, sourceNodeId: edge.sourceNodeId },
          ),
        );
      }
    }

    // Validate invariant 4: Every edge target exists
    for (const edge of input.edges) {
      if (!nodeIdSet.has(edge.targetNodeId)) {
        violations.push({
          violationCode: BGC_DIAGNOSTIC_CODES.VALID.ORPHAN_EDGE_TARGET_NODE,
          violationSeverity: "error",
          invariantType: "target-node-exists",
          description: `Edge ${edge.id} references non-existent target node: ${edge.targetNodeId}`,
          affectedEdgeIds: [edge.id],
          diagnosticDetails: { edgeId: edge.id, targetNodeId: edge.targetNodeId },
        });
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.VALID.ORPHAN_EDGE_TARGET_NODE,
            "error",
            `Orphan target node for edge ${edge.id}`,
            this.metadata.id,
            { edgeId: edge.id, targetNodeId: edge.targetNodeId },
          ),
        );
      }
    }

    // Validate invariant 5: Every node contains provenance
    for (const node of input.nodes) {
      if (!node.provenanceReferences || node.provenanceReferences.length === 0) {
        violations.push({
          violationCode: BGC_DIAGNOSTIC_CODES.VALID.NODE_MISSING_PROVENANCE,
          violationSeverity: "error",
          invariantType: "node-provenance-present",
          description: `Node ${node.id} is missing provenance references`,
          affectedNodeIds: [node.id],
          diagnosticDetails: { nodeId: node.id },
        });
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.VALID.NODE_MISSING_PROVENANCE,
            "error",
            `Node missing provenance: ${node.id}`,
            this.metadata.id,
            { nodeId: node.id },
          ),
        );
      }
    }

    // Validate invariant 6: Every edge contains provenance
    for (const edge of input.edges) {
      if (!edge.provenanceReferences || edge.provenanceReferences.length === 0) {
        violations.push({
          violationCode: BGC_DIAGNOSTIC_CODES.VALID.EDGE_MISSING_PROVENANCE,
          violationSeverity: "error",
          invariantType: "edge-provenance-present",
          description: `Edge ${edge.id} is missing provenance references`,
          affectedEdgeIds: [edge.id],
          diagnosticDetails: { edgeId: edge.id },
        });
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.VALID.EDGE_MISSING_PROVENANCE,
            "error",
            `Edge missing provenance: ${edge.id}`,
            this.metadata.id,
            { edgeId: edge.id },
          ),
        );
      }
    }

    // Validate invariant 7: Lineage preserved
    for (const node of input.nodes) {
      if (!node.evidenceLineage || node.evidenceLineage.length === 0) {
        violations.push({
          violationCode: BGC_DIAGNOSTIC_CODES.VALID.LINEAGE_NOT_PRESERVED,
          violationSeverity: "warning",
          invariantType: "lineage-preserved",
          description: `Node ${node.id} has no evidence lineage`,
          affectedNodeIds: [node.id],
          diagnosticDetails: { nodeId: node.id },
        });
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.VALID.LINEAGE_NOT_PRESERVED,
            "warning",
            `Node lineage missing: ${node.id}`,
            this.metadata.id,
            { nodeId: node.id },
          ),
        );
      }
    }

    for (const edge of input.edges) {
      if (!edge.evidenceLineage || edge.evidenceLineage.length === 0) {
        violations.push({
          violationCode: BGC_DIAGNOSTIC_CODES.VALID.LINEAGE_NOT_PRESERVED,
          violationSeverity: "warning",
          invariantType: "lineage-preserved",
          description: `Edge ${edge.id} has no evidence lineage`,
          affectedEdgeIds: [edge.id],
          diagnosticDetails: { edgeId: edge.id },
        });
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.VALID.LINEAGE_NOT_PRESERVED,
            "warning",
            `Edge lineage missing: ${edge.id}`,
            this.metadata.id,
            { edgeId: edge.id },
          ),
        );
      }
    }

    // Validate invariant 8: Deterministic ordering
    const sortedNodeIds = [...nodeIds].sort();
    const sortedEdgeIds = [...edgeIds].sort();

    if (!this.arraysEqual(nodeIds, sortedNodeIds)) {
      violations.push({
        violationCode: BGC_DIAGNOSTIC_CODES.VALID.DETERMINISTIC_ORDERING_VIOLATION,
        violationSeverity: "error",
        invariantType: "deterministic-ordering",
        description: "Nodes are not sorted deterministically",
        diagnosticDetails: { reason: "node-ordering" },
      });
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.VALID.DETERMINISTIC_ORDERING_VIOLATION,
          "error",
          "Nodes not sorted deterministically",
          this.metadata.id,
          { reason: "node-ordering" },
        ),
      );
    }

    if (!this.arraysEqual(edgeIds, sortedEdgeIds)) {
      violations.push({
        violationCode: BGC_DIAGNOSTIC_CODES.VALID.DETERMINISTIC_ORDERING_VIOLATION,
        violationSeverity: "error",
        invariantType: "deterministic-ordering",
        description: "Edges are not sorted deterministically",
        diagnosticDetails: { reason: "edge-ordering" },
      });
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.VALID.DETERMINISTIC_ORDERING_VIOLATION,
          "error",
          "Edges not sorted deterministically",
          this.metadata.id,
          { reason: "edge-ordering" },
        ),
      );
    }

    // Validate invariant 9: Graph identity reproducible
    const expectedGraphId = this.deriveGraphIdentity({
      nodeIds: sortedNodeIds,
      edgeIds: sortedEdgeIds,
    });

    if (input.id !== expectedGraphId) {
      violations.push({
        violationCode: BGC_DIAGNOSTIC_CODES.VALID.GRAPH_IDENTITY_NOT_REPRODUCIBLE,
        violationSeverity: "error",
        invariantType: "graph-identity-reproducible",
        description: `Graph identity mismatch: expected ${expectedGraphId}, got ${input.id}`,
        diagnosticDetails: { expectedId: expectedGraphId, actualId: input.id },
      });
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.VALID.GRAPH_IDENTITY_NOT_REPRODUCIBLE,
          "error",
          "Graph identity not reproducible",
          this.metadata.id,
          { expectedId: expectedGraphId, actualId: input.id },
        ),
      );
    }

    // Validate invariant 10: Compiler metadata present
    const metadataViolations: string[] = [];
    if (!input.passId) metadataViolations.push("passId");
    if (!input.passVersion) metadataViolations.push("passVersion");
    if (!input.specificationVersion) metadataViolations.push("specificationVersion");
    if (!input.compilerVersion) metadataViolations.push("compilerVersion");
    if (!input.sourceEvidenceIrIdentity) metadataViolations.push("sourceEvidenceIrIdentity");

    if (metadataViolations.length > 0) {
      violations.push({
        violationCode: BGC_DIAGNOSTIC_CODES.VALID.COMPILER_METADATA_MISSING,
        violationSeverity: "error",
        invariantType: "compiler-metadata-present",
        description: `Missing compiler metadata: ${metadataViolations.join(", ")}`,
        diagnosticDetails: { missingFields: metadataViolations },
      });
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.VALID.COMPILER_METADATA_MISSING,
          "error",
          `Missing metadata: ${metadataViolations.join(", ")}`,
          this.metadata.id,
          { missingFields: metadataViolations },
        ),
      );
    }

    // Build validation summary
    const summary = this.buildValidationSummary(violations);

    // Build validation context
    const validationContext: ValidationContext = {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      gps0001Version: "1.0.0",
      gps0002Version: "1.0.0",
      compilerVersion: input.compilerVersion,
      specificationVersion: input.specificationVersion,
      validationTimestamp: "2024-01-01T00:00:00Z", // Deterministic
      validationRuleId: CONSISTENCY_VALIDATION_RULES[0].id,
      validationRuleVersion: CONSISTENCY_VALIDATION_RULES[0].version,
    };

    // Compute deterministic validation history checksum
    const validationHistoryChecksum = this.deriveValidationChecksum({
      violations: violations.sort((a, b) => a.violationCode.localeCompare(b.violationCode)),
      summary,
      context: validationContext,
    });

    // Sort violations and diagnostics deterministically
    const sortedViolations = violations.sort((a, b) =>
      a.violationCode.localeCompare(b.violationCode),
    );
    const sortedDiagnostics = sortDiagnostics(diagnostics);

    // Build validation result
    const validationResult: BusinessGenomeValidationResult = {
      graphId: input.id,
      sourceEvidenceIrIdentity: input.sourceEvidenceIrIdentity,
      validationStatus:
        summary.invariantsFailed === 0
          ? summary.warningViolations === 0
            ? "valid"
            : "valid-with-warnings"
          : "invalid",
      violations: sortedViolations,
      summary,
      context: validationContext,
      diagnostics: sortedDiagnostics,
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      specificationVersion: input.specificationVersion,
      compilerVersion: input.compilerVersion,
      validationHistoryChecksum,
      passHistory: input.passHistory,
      businessGenomeGraph: input, // Preserve original graph (NOT modified)
    };

    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output: validationResult,
      diagnostics: sortedDiagnostics,
      fatal: summary.invariantsFailed > 0,
    };
  }

  private findDuplicates(items: readonly string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const item of items) {
      if (seen.has(item)) {
        duplicates.add(item);
      }
      seen.add(item);
    }

    return Array.from(duplicates).sort();
  }

  private arraysEqual(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  private buildValidationSummary(violations: readonly GraphInvariantViolation[]): ValidationSummary {
    const errorViolations = violations.filter((v) => v.violationSeverity === "error").length;
    const warningViolations = violations.filter((v) => v.violationSeverity === "warning").length;
    const infoViolations = violations.filter((v) => v.violationSeverity === "info").length;

    return {
      totalInvariants: CONSISTENCY_VALIDATION_RULES.length,
      invariantsPassed: CONSISTENCY_VALIDATION_RULES.length - new Set(violations.map((v) => v.invariantType)).size,
      invariantsFailed: new Set(violations.map((v) => v.invariantType)).size,
      violationCount: violations.length,
      errorViolations,
      warningViolations,
      infoViolations,
      validationStatus:
        violations.length === 0
          ? "passed"
          : warningViolations > 0 && errorViolations === 0
            ? "warnings"
            : "failed",
    };
  }

  private deriveGraphIdentity(data: { readonly nodeIds: readonly string[]; readonly edgeIds: readonly string[] }): string {
    const checksum = SourceHash.sha256(stableStringify(data));
    return `bg.graph_${checksum}_v1`;
  }

  private deriveValidationChecksum(data: {
    readonly violations: readonly GraphInvariantViolation[];
    readonly summary: ValidationSummary;
    readonly context: ValidationContext;
  }): string {
    return SourceHash.sha256(stableStringify(data));
  }

  private buildFatalResult(
    input: BusinessGenomeGraph,
    diagnostics: CompilerDiagnostic[],
  ): BusinessGenomePassResult<BusinessGenomeValidationResult> {
    const emptyResult: BusinessGenomeValidationResult = {
      graphId: input?.id ?? "unknown",
      sourceEvidenceIrIdentity: input?.sourceEvidenceIrIdentity ?? "",
      validationStatus: "invalid",
      violations: [],
      summary: {
        totalInvariants: CONSISTENCY_VALIDATION_RULES.length,
        invariantsPassed: 0,
        invariantsFailed: CONSISTENCY_VALIDATION_RULES.length,
        violationCount: 0,
        errorViolations: 0,
        warningViolations: 0,
        infoViolations: 0,
        validationStatus: "failed",
      },
      context: {
        passId: this.metadata.id,
        passVersion: this.metadata.version,
        gps0001Version: "1.0.0",
        gps0002Version: "1.0.0",
        compilerVersion: input?.compilerVersion ?? "unknown",
        specificationVersion: input?.specificationVersion ?? "unknown",
        validationTimestamp: "2024-01-01T00:00:00Z",
        validationRuleId: CONSISTENCY_VALIDATION_RULES[0].id,
        validationRuleVersion: CONSISTENCY_VALIDATION_RULES[0].version,
      },
      diagnostics: sortDiagnostics(diagnostics),
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      specificationVersion: input?.specificationVersion ?? "unknown",
      compilerVersion: input?.compilerVersion ?? "unknown",
      validationHistoryChecksum: "",
      passHistory: input?.passHistory ?? [],
      businessGenomeGraph: input ?? ({} as BusinessGenomeGraph),
    };

    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output: emptyResult,
      diagnostics: sortDiagnostics(diagnostics),
      fatal: true,
    };
  }
}
