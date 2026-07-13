import type { CompilerDiagnostic, CompilerPassContext, CompilerPassMetadata } from "../../core/types";
import type { CompilerPass } from "../../core/types";
import type {
  BusinessGenomeGraph,
  BusinessGenomeValidationResult,
  BusinessGenomePassResult,
  BusinessGenomeArtifact,
  BusinessGenomePublicationResult,
  BusinessGenomePublicationStatus,
  BusinessGenomeProvenanceIndex,
  BusinessGenomeLineageIndex,
  BusinessGenomeArtifactManifest,
  BusinessGenomeChecksumSet,
  BusinessGenomePublicationContext,
} from "../pipeline-types";
import { stableStringify } from "../../core/stableStringify";
import { SourceHash } from "../../provenance/SourceHash";
import { createDiagnostic, BGC_DIAGNOSTIC_CODES, sortDiagnostics } from "../diagnostics";

/**
 * Publication precondition rules following GPS standards.
 *
 * Publication may occur only when blocking validation failures are absent.
 * Warnings may proceed if permitted by existing governance and architecture.
 */
export const PUBLICATION_PRECONDITIONS = [
  {
    id: "bgc.publication.rule.no-blocking-errors",
    version: "1.0.0",
    description: "Verify that validation does not contain blocking publication failures",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.publication.rule.graph-present",
    version: "1.0.0",
    description: "Verify that validated BusinessGenomeGraph is present",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.publication.rule.validation-result-present",
    version: "1.0.0",
    description: "Verify that BusinessGenomeValidationResult is present",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.publication.rule.provenance-complete",
    version: "1.0.0",
    description: "Verify that all provenance is complete and traceable",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
  {
    id: "bgc.publication.rule.lineage-complete",
    version: "1.0.0",
    description: "Verify that lineage chain is complete through all compiler passes",
    gps0001Version: "1.0.0",
    gps0002Version: "1.0.0",
  },
] as const;

/**
 * BGC-PASS-011: Business Genome Publication
 *
 * Packages a validated BusinessGenomeGraph into a canonical, versioned,
 * deterministic BusinessGenomeArtifact.
 *
 * Input: BusinessGenomeValidationResult + BusinessGenomeGraph
 * Output: BusinessGenomeArtifact (on successful publication)
 * Output: null artifact + diagnostics (on blocked publication)
 *
 * This pass does not:
 * - modify the graph
 * - repair validation failures
 * - synthesize missing nodes or edges
 * - change semantic meaning
 * - consolidate semantics
 * - resolve relationships
 * - reassign identities
 */
export class BusinessGenomePublicationPass
  implements CompilerPass<BusinessGenomeValidationResult, BusinessGenomePassResult<BusinessGenomePublicationResult>>
{
  readonly metadata: CompilerPassMetadata = {
    id: "bgc.business-genome-publication",
    version: "1.0.0",
    dependencies: ["bgc.consistency-validation"],
    description:
      "Packages validated Business Genome Graph into canonical, versioned, deterministic Business Genome Artifact",
    inputType: "business-genome-validation-result",
    outputType: "business-genome-artifact",
    capabilities: ["publication", "determinism", "gps-0001-compliance", "non-modifying", "artifact-generation"],
    lifecycle: "active" as const,
  };

  async execute(
    input: BusinessGenomeValidationResult,
    context: CompilerPassContext,
  ): Promise<BusinessGenomePassResult<BusinessGenomePublicationResult>> {
    const diagnostics: CompilerDiagnostic[] = [];

    // Validate input contract
    if (!input.businessGenomeGraph) {
      return this.buildFatalResult(input, [
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.PUB.MISSING_GRAPH,
          "error",
          "Required: BusinessGenomeGraph must be present for publication",
          this.metadata.id,
          { reason: "graph_missing" },
        ),
      ]);
    }

    if (!input) {
      return this.buildFatalResult(
        { businessGenomeGraph: { nodes: [], edges: [] } as any } as BusinessGenomeValidationResult,
        [
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.PUB.MISSING_VALIDATION_RESULT,
            "error",
            "Required: BusinessGenomeValidationResult must be present for publication",
            this.metadata.id,
            { reason: "validation_result_missing" },
          ),
        ],
      );
    }

    // Check publication preconditions
    const preconditionViolations = this.checkPublicationPreconditions(input);
    if (preconditionViolations.length > 0) {
      diagnostics.push(...preconditionViolations);
    }

    // Publication blocking rule: blocking validation failures prevent publication
    const shouldPublish = this.canPublish(input, preconditionViolations);

    if (!shouldPublish) {
      // Add blocking diagnostic if validation status is invalid
      if (input.validationStatus === "invalid") {
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.PUB.VALIDATION_BLOCKS_PUBLICATION,
            "error",
            "Invalid validation status blocks publication. Graph is not eligible for artifact creation.",
            this.metadata.id,
            { validationStatus: input.validationStatus },
          ),
        );
      }
      
      // Publication blocked - return result with no artifact
      const result = this.buildBlockedResult(input, diagnostics);
      return {
        passId: this.metadata.id,
        passVersion: this.metadata.version,
        output: result,
        diagnostics: sortDiagnostics(diagnostics),
        fatal: false,
      };
    }

    // Publication proceeding - build artifact
    try {
      // Check for missing provenance and add diagnostic if found
      const nodesWithoutProvenance = input.businessGenomeGraph.nodes.filter(
        (node) => !node.provenanceReferences || node.provenanceReferences.length === 0,
      );
      if (nodesWithoutProvenance.length > 0) {
        diagnostics.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.PUB.MISSING_PROVENANCE,
            "warning",
            `${nodesWithoutProvenance.length} nodes have missing or incomplete provenance references`,
            this.metadata.id,
            { nodeCount: nodesWithoutProvenance.length, nodeIds: nodesWithoutProvenance.map((n) => n.id) },
          ),
        );
      }

      // Build provenance index (deterministic)
      const provenanceIndex = this.buildProvenanceIndex(input.businessGenomeGraph);
      diagnostics.push(
        createDiagnostic(
          "BGC-PUB-INFO-PROVENANCE",
          "info",
          `Provenance index constructed with ${provenanceIndex.entries.length} node entries`,
          this.metadata.id,
          { entryCount: provenanceIndex.entries.length },
        ),
      );

      // Build lineage index (deterministic)
      const lineageIndex = this.buildLineageIndex(input.businessGenomeGraph, input.passHistory);
      diagnostics.push(
        createDiagnostic(
          "BGC-PUB-INFO-LINEAGE",
          "info",
          `Lineage index constructed with ${lineageIndex.entries.length} entries`,
          this.metadata.id,
          { entryCount: lineageIndex.entries.length },
        ),
      );

      // Calculate checksums (deterministic)
      const checksums = this.calculateChecksums(input.businessGenomeGraph);

      // Create manifest (deterministic)
      const manifest = this.buildManifest(
        input,
        checksums,
        "published",
      );

      // Create publication context
      const publicationContext: BusinessGenomePublicationContext = {
        passId: this.metadata.id,
        passVersion: this.metadata.version,
        compilerVersion: input.compilerVersion,
        specificationVersion: input.specificationVersion,
        businessGenomeSpecificationVersion: "1.0.0",
        gps0001Version: input.context.gps0001Version,
        gps0002Version: input.context.gps0002Version,
        publicationTimestamp: "2024-01-01T00:00:00Z",
        publicationRuleId: "bgc.publication.rule.no-blocking-errors",
        publicationRuleVersion: "1.0.0",
      };

      // Derive artifact identity (deterministic)
      const artifactIdentity = this.deriveArtifactIdentity({
        graphId: input.graphId,
        validationStatus: input.validationStatus,
        compilerVersion: input.compilerVersion,
        specificationVersion: input.specificationVersion,
      });

      // Create artifact
      const artifact: BusinessGenomeArtifact = {
        artifactIdentity,
        artifactVersion: "1.0.0",
        schemaVersion: "1.0.0",
        businessGenomeSpecificationVersion: "1.0.0",
        compilerVersion: input.compilerVersion,
        pipelineVersion: "1.0.0",
        businessGenomeGraph: input.businessGenomeGraph,
        validationResult: input,
        compilationDiagnostics: input.diagnostics,
        provenanceIndex,
        lineageIndex,
        manifest,
        graphChecksum: checksums.graphChecksum,
        artifactChecksum: checksums.artifactChecksum,
        sourceManifestReferences: [],
        gps0001Version: input.context.gps0001Version,
        gps0002Version: input.context.gps0002Version,
        publicationMetadata: publicationContext,
        passHistory: input.passHistory,
      };

      // Create publication result
      const result: BusinessGenomePublicationResult = {
        publicationStatus: "published",
        artifact,
        diagnostics: [
          ...diagnostics,
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.PUB.ARTIFACT_SUCCESSFULLY_PUBLISHED,
            "info",
            `Business Genome Artifact published successfully (${artifactIdentity})`,
            this.metadata.id,
            { artifactIdentity, nodeCount: artifact.businessGenomeGraph.nodes.length, edgeCount: artifact.businessGenomeGraph.edges.length },
          ),
        ],
        passId: this.metadata.id,
        passVersion: this.metadata.version,
        specificationVersion: input.specificationVersion,
        compilerVersion: input.compilerVersion,
        validationResult: input,
        graph: input.businessGenomeGraph,
      };

      return {
        passId: this.metadata.id,
        passVersion: this.metadata.version,
        output: result,
        diagnostics: sortDiagnostics(result.diagnostics),
        fatal: false,
      };
    } catch (error) {
      // Publication failed - return result with no artifact
      const errorMsg = error instanceof Error ? error.message : "Unknown error during publication";
      diagnostics.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.PUB.PUBLICATION_INVARIANT_VIOLATION,
          "error",
          `Publication failed: ${errorMsg}`,
          this.metadata.id,
          { error: errorMsg },
        ),
      );

      const result = this.buildFailedResult(input, diagnostics);
      return {
        passId: this.metadata.id,
        passVersion: this.metadata.version,
        output: result,
        diagnostics: sortDiagnostics(diagnostics),
        fatal: false,
      };
    }
  }

  private checkPublicationPreconditions(input: BusinessGenomeValidationResult): CompilerDiagnostic[] {
    const violations: CompilerDiagnostic[] = [];

    // Check: Graph has nodes and edges
    if (input.businessGenomeGraph.nodes.length === 0 && input.businessGenomeGraph.edges.length === 0) {
      violations.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.PUB.PUBLICATION_INVARIANT_VIOLATION,
          "warning",
          "Graph is empty: no nodes or edges present",
          this.metadata.id,
          { reason: "empty_graph" },
        ),
      );
    }

    // Check: Provenance complete
    for (const node of input.businessGenomeGraph.nodes) {
      if (!node.provenanceReferences || node.provenanceReferences.length === 0) {
        violations.push(
          createDiagnostic(
            BGC_DIAGNOSTIC_CODES.PUB.MISSING_PROVENANCE,
            "warning",
            `Node provenance incomplete: ${node.id}`,
            this.metadata.id,
            { nodeId: node.id },
          ),
        );
      }
    }

    // Check: Graph integrity
    if (!input.businessGenomeGraph.businessGenomeIdentityCollection) {
      violations.push(
        createDiagnostic(
          BGC_DIAGNOSTIC_CODES.PUB.PUBLICATION_INVARIANT_VIOLATION,
          "error",
          "Graph identity collection missing",
          this.metadata.id,
          { reason: "identity_collection_missing" },
        ),
      );
    }

    return violations;
  }

  private canPublish(input: BusinessGenomeValidationResult, preconditionViolations: CompilerDiagnostic[]): boolean {
    // Block if validation shows invalid status
    if (input.validationStatus === "invalid") {
      return false;
    }

    // Block if precondition violations include errors
    const hasBlockingErrors = preconditionViolations.some((d) => d.severity === "error");
    if (hasBlockingErrors) {
      return false;
    }

    // Otherwise, publication may proceed
    return true;
  }

  private buildProvenanceIndex(graph: BusinessGenomeGraph): BusinessGenomeProvenanceIndex {
    const entries = graph.nodes.map((node) => ({
      nodeId: node.id,
      evidenceReferences: [...(node.provenanceReferences || [])].sort(),
      sourceDocuments: [...(node.evidenceLineage || [])].sort(),
      discoveryReferences: [], // Populated from identity collection if available
    }));

    const edgeEntries = graph.edges.map((edge) => ({
      edgeId: edge.id,
      evidenceReferences: [...(edge.provenanceReferences || [])].sort(),
      sourceDocuments: [...(edge.evidenceLineage || [])].sort(),
    }));

    return {
      entries: entries.sort((a, b) => a.nodeId.localeCompare(b.nodeId)),
      edgeEntries: edgeEntries.sort((a, b) => a.edgeId.localeCompare(b.edgeId)),
    };
  }

  private buildLineageIndex(
    graph: BusinessGenomeGraph,
    passHistory: readonly { readonly passId: string; readonly version: string; readonly status: string; readonly diagnosticCount: number }[],
  ): BusinessGenomeLineageIndex {
    const entries = [
      {
        artifactId: graph.id,
        traceChain: passHistory
          .filter((entry) => entry.status === "completed")
          .map((entry) => ({
            stage: entry.passId,
            stageIdentity: `${entry.passId}_${entry.version}`,
            stageVersion: entry.version,
            timestamp: "2024-01-01T00:00:00Z",
          })),
      },
    ];

    return {
      entries,
    };
  }

  private calculateChecksums(graph: BusinessGenomeGraph): BusinessGenomeChecksumSet {
    const graphChecksum = SourceHash.sha256(stableStringify(graph));
    const artifactChecksum = SourceHash.sha256(
      stableStringify({
        graph,
        publicationTimestamp: "2024-01-01T00:00:00Z",
      }),
    );
    const manifestChecksum = SourceHash.sha256(
      stableStringify({
        compilerVersion: "1.0.0",
        pipelineVersion: "1.0.0",
      }),
    );

    return {
      graphChecksum,
      artifactChecksum,
      manifestChecksum,
    };
  }

  private buildManifest(
    input: BusinessGenomeValidationResult,
    checksums: BusinessGenomeChecksumSet,
    status: BusinessGenomePublicationStatus,
  ): BusinessGenomeArtifactManifest {
    return {
      compilerVersion: input.compilerVersion,
      pipelineVersion: "1.0.0",
      specificationVersion: input.specificationVersion,
      businessGenomeSpecificationVersion: "1.0.0",
      gps0001Version: input.context.gps0001Version,
      gps0002Version: input.context.gps0002Version,
      passListAndVersions: input.passHistory.map((entry) => ({
        passId: entry.passId,
        version: entry.version,
      })),
      sourceManifestReferences: [],
      graphIdentity: input.graphId,
      artifactIdentity: this.deriveArtifactIdentity({
        graphId: input.graphId,
        validationStatus: input.validationStatus,
        compilerVersion: input.compilerVersion,
        specificationVersion: input.specificationVersion,
      }),
      graphChecksum: checksums.graphChecksum,
      artifactChecksum: checksums.artifactChecksum,
      validationStatus: input.validationStatus,
      diagnosticSummary: {
        totalDiagnostics: input.diagnostics.length,
        errors: input.diagnostics.filter((d) => d.severity === "error").length,
        warnings: input.diagnostics.filter((d) => d.severity === "warning").length,
        infos: input.diagnostics.filter((d) => d.severity === "info").length,
      },
      publicationStatus: status,
      publicationTimestamp: "2024-01-01T00:00:00Z",
    };
  }

  private deriveArtifactIdentity(data: {
    readonly graphId: string;
    readonly validationStatus: string;
    readonly compilerVersion: string;
    readonly specificationVersion: string;
  }): string {
    const checksum = SourceHash.sha256(stableStringify(data));
    return `bgc-artifact_${checksum}_v1`;
  }

  private buildBlockedResult(input: BusinessGenomeValidationResult, diagnostics: CompilerDiagnostic[]): BusinessGenomePublicationResult {
    diagnostics.push(
      createDiagnostic(
        BGC_DIAGNOSTIC_CODES.PUB.VALIDATION_BLOCKS_PUBLICATION,
        "error",
        "Publication blocked: validation failures prevent publication",
        this.metadata.id,
        { validationStatus: input.validationStatus },
      ),
    );

    return {
      publicationStatus: "blocked",
      artifact: null,
      diagnostics: sortDiagnostics(diagnostics),
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      specificationVersion: input.specificationVersion,
      compilerVersion: input.compilerVersion,
      validationResult: input,
      graph: input.businessGenomeGraph,
    };
  }

  private buildFailedResult(input: BusinessGenomeValidationResult, diagnostics: CompilerDiagnostic[]): BusinessGenomePublicationResult {
    return {
      publicationStatus: "failed",
      artifact: null,
      diagnostics: sortDiagnostics(diagnostics),
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      specificationVersion: input.specificationVersion,
      compilerVersion: input.compilerVersion,
      validationResult: input,
      graph: input.businessGenomeGraph,
    };
  }

  private buildFatalResult(input: BusinessGenomeValidationResult | any, diagnostics: CompilerDiagnostic[]): BusinessGenomePassResult<BusinessGenomePublicationResult> {
    return {
      passId: this.metadata.id,
      passVersion: this.metadata.version,
      output: {
        publicationStatus: "failed",
        artifact: null,
        diagnostics: sortDiagnostics(diagnostics),
        passId: this.metadata.id,
        passVersion: this.metadata.version,
        specificationVersion: input?.specificationVersion ?? "1.0.0",
        compilerVersion: input?.compilerVersion ?? "1.0.0",
        validationResult: input,
        graph: input?.businessGenomeGraph ?? ({ nodes: [], edges: [] } as any),
      },
      diagnostics: sortDiagnostics(diagnostics),
      fatal: false,
    };
  }
}
