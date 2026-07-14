/**
 * ExecutionReport.ts
 *
 * Immutable execution report produced at the end of a runtime run.
 *
 * The ExecutionReport is the definitive, permanent record of everything
 * that occurred during a compilation run: passes executed, artifacts
 * generated, verifications and certifications run, warnings, errors,
 * metrics, and artifact checksums for determinism proof.
 */

import type { CompilerPassId } from "../apollo/CompilerPass.js";
import type { ArtifactEntry } from "./ArtifactRegistry.js";
import type { ExecutionResult } from "./ExecutionResult.js";
import type { RuntimeMetricsSnapshot } from "./RuntimeMetrics.js";
import type { RuntimeStatus } from "./RuntimeStatus.js";

/**
 * Warning recorded during execution.
 */
export interface ExecutionWarning {
  readonly passId: CompilerPassId | "runtime";
  readonly message: string;
}

/**
 * Error recorded during execution.
 */
export interface ExecutionError {
  readonly passId: CompilerPassId | "runtime";
  readonly code: string;
  readonly message: string;
  readonly fatal: boolean;
}

/**
 * High-level summary included at the top of the report.
 */
export interface ExecutionSummary {
  readonly buildId: string;
  readonly companyId: string;
  readonly environment: string;
  readonly status: RuntimeStatus;
  readonly successful: boolean;
  readonly totalPasses: number;
  readonly passesExecuted: number;
  readonly passesSucceeded: number;
  readonly passesFailed: number;
  readonly artifactsGenerated: number;
  readonly verificationsRun: number;
  readonly verificationsPassed: number;
  readonly certificationsRun: number;
  readonly certificationsPassed: number;
  readonly durationMs: number;
  readonly cacheHitRate: number;
}

/**
 * Immutable execution report.
 */
export interface ExecutionReport {
  /** Unique report identifier derived from buildId. */
  readonly reportId: string;

  /** Build this report covers. */
  readonly buildId: string;

  /** High-level build summary. */
  readonly summary: ExecutionSummary;

  /** Ordered results of each executed compiler pass. */
  readonly passResults: readonly ExecutionResult[];

  /** All artifacts generated during the run. */
  readonly artifacts: readonly ArtifactEntry[];

  /** All warnings collected. */
  readonly warnings: readonly ExecutionWarning[];

  /** All errors collected. */
  readonly errors: readonly ExecutionError[];

  /** Runtime metrics snapshot. */
  readonly metrics: RuntimeMetricsSnapshot;

  /**
   * Artifact checksums keyed by artifactId.
   * Provides determinism proof: same build must produce identical checksums.
   */
  readonly artifactChecksums: ReadonlyMap<string, string>;

  /** Epoch milliseconds at report generation. */
  readonly generatedAt: number;

  /** True if all verification gates passed across all passes. */
  readonly verificationsPassed: boolean;

  /** True if all certification gates passed across all passes. */
  readonly certificationsPassed: boolean;
}

/**
 * Create an immutable ExecutionReport.
 */
export const createExecutionReport = (params: {
  readonly reportId: string;
  readonly buildId: string;
  readonly summary: ExecutionSummary;
  readonly passResults: readonly ExecutionResult[];
  readonly artifacts: readonly ArtifactEntry[];
  readonly warnings: readonly ExecutionWarning[];
  readonly errors: readonly ExecutionError[];
  readonly metrics: RuntimeMetricsSnapshot;
  readonly generatedAt: number;
}): ExecutionReport => {
  const artifactChecksums: ReadonlyMap<string, string> = new Map(
    params.artifacts.map((a) => [a.artifactId, a.checksum]),
  );
  const verificationsPassed = params.passResults.every((r) => r.allVerificationsPassed);
  const certificationsPassed = params.passResults.every((r) => r.allCertificationsPassed);

  return Object.freeze({
    ...params,
    artifactChecksums,
    verificationsPassed,
    certificationsPassed,
  });
};
