/**
 * RuntimeStatistics.ts
 *
 * Immutable statistics computed from a completed ExecutionReport.
 *
 * RuntimeStatistics are post-run analytics distinct from RuntimeMetrics
 * (which accumulates during execution). Statistics are derived from the
 * final report and provide aggregate quality indicators.
 */

import type { ExecutionReport } from "./ExecutionReport.js";

/**
 * Immutable runtime statistics.
 */
export interface RuntimeStatistics {
  readonly buildId: string;
  readonly totalPasses: number;
  readonly successfulPasses: number;
  readonly failedPasses: number;
  readonly cachedPasses: number;
  readonly totalArtifacts: number;
  readonly verifiedArtifacts: number;
  readonly certifiedArtifacts: number;
  readonly totalVerifications: number;
  readonly passedVerifications: number;
  readonly failedVerifications: number;
  readonly totalCertifications: number;
  readonly passedCertifications: number;
  readonly failedCertifications: number;
  readonly totalDurationMs: number;
  readonly averagePassDurationMs: number;
  readonly totalWarnings: number;
  readonly totalErrors: number;
  readonly fatalErrors: number;
  /** Fraction of passes that succeeded (0–1). */
  readonly successRate: number;
  /** Fraction of verification gates that passed (0–1). */
  readonly verificationPassRate: number;
  /** Fraction of certification gates that passed (0–1). */
  readonly certificationPassRate: number;
  /** Fraction of passes served from cache (0–1). */
  readonly cacheHitRate: number;
  /** True if every pass succeeded, no fatal errors, all gates passed. */
  readonly isFullSuccess: boolean;
}

/**
 * Compute immutable RuntimeStatistics from a completed ExecutionReport.
 */
export const computeRuntimeStatistics = (report: ExecutionReport): RuntimeStatistics => {
  const totalPasses = report.passResults.length;
  const successfulPasses = report.passResults.filter((r) => r.success).length;
  const failedPasses = totalPasses - successfulPasses;
  const cachedPasses = report.passResults.filter((r) => r.cacheHit).length;

  const totalVerifications = report.metrics.verificationCount;
  const passedVerifications = report.metrics.verificationPassCount;
  const failedVerifications = report.metrics.verificationFailCount;

  const totalCertifications = report.metrics.certificationCount;
  const passedCertifications = report.metrics.certificationPassCount;
  const failedCertifications = report.metrics.certificationFailCount;

  const totalDurationMs = report.metrics.executionDurationMs;
  const averagePassDurationMs =
    totalPasses > 0 ? Math.round(totalDurationMs / totalPasses) : 0;

  const verifiedArtifacts = report.artifacts.filter(
    (a) => a.verificationState === "passed",
  ).length;
  const certifiedArtifacts = report.artifacts.filter(
    (a) => a.certificationState === "certified",
  ).length;

  const fatalErrors = report.errors.filter((e) => e.fatal).length;

  const successRate = totalPasses > 0 ? successfulPasses / totalPasses : 1;
  const verificationPassRate =
    totalVerifications > 0 ? passedVerifications / totalVerifications : 1;
  const certificationPassRate =
    totalCertifications > 0 ? passedCertifications / totalCertifications : 1;
  const cacheHitRate = totalPasses > 0 ? cachedPasses / totalPasses : 0;

  const isFullSuccess =
    failedPasses === 0 &&
    failedVerifications === 0 &&
    failedCertifications === 0 &&
    fatalErrors === 0;

  return Object.freeze({
    buildId: report.buildId,
    totalPasses,
    successfulPasses,
    failedPasses,
    cachedPasses,
    totalArtifacts: report.artifacts.length,
    verifiedArtifacts,
    certifiedArtifacts,
    totalVerifications,
    passedVerifications,
    failedVerifications,
    totalCertifications,
    passedCertifications,
    failedCertifications,
    totalDurationMs,
    averagePassDurationMs,
    totalWarnings: report.warnings.length,
    totalErrors: report.errors.length,
    fatalErrors,
    successRate,
    verificationPassRate,
    certificationPassRate,
    cacheHitRate,
    isFullSuccess,
  });
};
