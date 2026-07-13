/**
 * Genesis Compiler Framework - Metadata Management
 *
 * Manages artifact metadata, identity, and manifest generation
 */

import {
  ArtifactChecksum,
  CompilerManifest,
  CompilerMetadata,
  DiagnosticSummary,
  PassMetrics,
  ArtifactVersion,
  CompilationState,
  PassResult,
  PublicationDecision,
} from "./types";
import {
  createChecksum,
  createArtifactIdentity,
  getCurrentTimestamp,
} from "./CompilerUtilities";

/**
 * Manifest generator - creates compilation manifest
 */
export class ManifestGenerator {
  /**
   * Generate compilation manifest
   */
  public generate(
    compilerName: string,
    compilerVersion: string,
    startTimestamp: string,
    passResults: PassResult<any>[],
    diagnosticSummary: DiagnosticSummary
  ): CompilerManifest {
    // Calculate duration from first and last pass
    const timestamps = passResults.map((p) => new Date(p.timestamp).getTime());
    const startMs = new Date(startTimestamp).getTime();
    const endMs = Math.max(...timestamps);
    const durationMs = Math.max(endMs - startMs, 0);

    // Build pass history
    const passHistory: PassMetrics[] = passResults.map(
      (result, index) => ({
        passId: result.passId,
        executionOrder: index + 1,
        executionTimeMs: result.executionTimeMs,
        diagnosticCounts: {
          errors: result.diagnostics.filter((d) => d.severity === "error")
            .length,
          warnings: result.diagnostics.filter((d) => d.severity === "warning")
            .length,
          infos: result.diagnostics.filter((d) => d.severity === "info").length,
        },
      })
    );

    return {
      compilerName,
      compilerVersion,
      compilationTimestamp: startTimestamp,
      compilationDurationMs: durationMs,
      passHistory,
      diagnosticSummary,
      checksums: {},
    };
  }
}

/**
 * Metadata builder - constructs compiler metadata
 */
export class MetadataBuilder<TArtifact> {
  /**
   * Build metadata for compiled artifact
   */
  public build(
    compilerName: string,
    compilerVersion: string,
    artifactIdentity: string,
    artifactVersion: ArtifactVersion,
    schemaVersion: string,
    compilationTimestamp: string,
    manifest: CompilerManifest,
    inputChecksum: ArtifactChecksum,
    outputArtifact?: TArtifact,
    publicationDecision?: PublicationDecision
  ): CompilerMetadata {
    // Create output checksum if artifact provided
    let outputChecksum: ArtifactChecksum | undefined;
    if (outputArtifact) {
      outputChecksum = createChecksum(outputArtifact);
    }

    return {
      artifactIdentity: {
        id: artifactIdentity,
        prefix: compilerName,
        hash: artifactIdentity.split("_")[1] || "unknown",
        schemaVersion,
      },
      artifactVersion,
      manifest,
      schemaVersion,
      compilerVersion,
      compilationTimestamp,
      inputChecksum,
      outputChecksum,
      published: publicationDecision?.canPublish || false,
      publicationDecision: publicationDecision || {
        canPublish: false,
        blocked: true,
        blockedBy: [],
      },
    };
  }
}

/**
 * Publication gate - controls publication based on validation
 */
export class PublicationGate {
  /**
   * Check if artifact can be published
   *
   * RULES:
   * - No errors allowed
   * - Validation must be complete
   * - Input artifact must exist
   */
  public canPublish(
    hasErrors: boolean,
    hasInput: boolean,
    validationComplete: boolean
  ): boolean {
    if (hasErrors) {
      return false; // Errors block publication
    }

    if (!hasInput) {
      return false; // No input artifact
    }

    if (!validationComplete) {
      return false; // Validation not complete
    }

    return true;
  }

  /**
   * Make publication decision
   */
  public decide(
    hasErrors: boolean,
    hasInput: boolean,
    validationComplete: boolean,
    validationErrors: string[] = []
  ): PublicationDecision {
    const canPublish = this.canPublish(hasErrors, hasInput, validationComplete);

    const blockedBy: string[] = [];
    if (hasErrors) {
      blockedBy.push("compilation_errors");
    }
    if (!hasInput) {
      blockedBy.push("missing_input");
    }
    if (!validationComplete) {
      blockedBy.push("validation_incomplete");
    }
    blockedBy.push(...validationErrors);

    return {
      canPublish,
      blocked: !canPublish,
      reason: canPublish
        ? undefined
        : `Publication blocked: ${blockedBy.join(", ")}`,
      blockedBy,
    };
  }
}

/**
 * Metrics aggregator - collects and aggregates metrics
 */
export class MetricsAggregator {
  /**
   * Calculate quality score (0-100)
   *
   * Scoring:
   * - Base: 100
   * - Each error: -50
   * - Each warning: -10
   * - Each info: -1
   */
  public calculateQualityScore(diagnosticSummary: DiagnosticSummary): number {
    let score = 100;

    score -= diagnosticSummary.errors * 50;
    score -= diagnosticSummary.warnings * 10;
    score -= diagnosticSummary.infos * 1;

    return Math.max(0, score);
  }

  /**
   * Calculate total execution time
   */
  public calculateTotalExecutionTime(passMetrics: PassMetrics[]): number {
    return passMetrics.reduce((sum, p) => sum + p.executionTimeMs, 0);
  }

  /**
   * Get slowest passes
   */
  public getSlowestPasses(
    passMetrics: PassMetrics[],
    limit: number = 5
  ): PassMetrics[] {
    return [...passMetrics]
      .sort((a, b) => b.executionTimeMs - a.executionTimeMs)
      .slice(0, limit);
  }

  /**
   * Get passes with most diagnostics
   */
  public getProblematicPasses(
    passMetrics: PassMetrics[],
    limit: number = 5
  ): PassMetrics[] {
    return [...passMetrics]
      .sort(
        (a, b) =>
          (b.diagnosticCounts.errors +
            b.diagnosticCounts.warnings +
            b.diagnosticCounts.infos) -
          (a.diagnosticCounts.errors +
            a.diagnosticCounts.warnings +
            a.diagnosticCounts.infos)
      )
      .slice(0, limit);
  }
}
