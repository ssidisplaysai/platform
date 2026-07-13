/**
 * BuildResult.ts
 *
 * Immutable build execution result.
 * Represents the outcome of a build compilation.
 */

import type { CompilerPassId, PassExecutionResult } from "./CompilerPass.js";
import type { VerificationSummary } from "./VerificationGate.js";
import type { CertificationSummary } from "./CertificationGate.js";

/**
 * Overall build status
 */
export type BuildStatus = "success" | "partial" | "failed" | "cancelled";

/**
 * Build execution result
 *
 * Immutable record of what happened during build execution.
 * Never modified after creation.
 */
export interface BuildResult {
  readonly buildId: string;
  readonly timestamp: number;
  readonly startTime: number;
  readonly endTime: number;
  readonly duration: number;

  readonly status: BuildStatus;
  readonly successful: boolean;

  /**
   * Results from each compiler pass
   */
  readonly passResults: ReadonlyMap<CompilerPassId, PassExecutionResult>;

  /**
   * Overall verification results
   */
  readonly verificationResults: VerificationSummary;

  /**
   * Overall certification results
   */
  readonly certificationResults: CertificationSummary;

  /**
   * Artifacts produced
   */
  readonly artifacts: readonly ArtifactRecord[];

  /**
   * Diagnostic messages
   */
  readonly diagnostics: readonly DiagnosticMessage[];

  /**
   * Errors encountered
   */
  readonly errors: readonly ErrorRecord[];

  /**
   * Warnings
   */
  readonly warnings: readonly string[];

  /**
   * Cache hit rate (0-1)
   */
  readonly cacheHitRate: number;

  /**
   * Total passes executed
   */
  readonly passesExecuted: number;

  /**
   * Passes that were cached
   */
  readonly passesCached: number;

  /**
   * Immutability marker
   */
  readonly readonly: true;

  /**
   * Get a summary of the build result
   */
  readonly summary: () => BuildResultSummary;

  /**
   * Get pass result by ID
   */
  readonly getPassResult: (passId: CompilerPassId) => PassExecutionResult | undefined;

  /**
   * Check if all required gates passed
   */
  readonly gatesPassed: () => boolean;
}

/**
 * Artifact produced during build
 */
export interface ArtifactRecord {
  readonly passId: CompilerPassId;
  readonly artifactId: string;
  readonly path: string;
  readonly type: string;
  readonly size: number;
  readonly checksum: string;
  readonly deterministic: boolean;
}

/**
 * Diagnostic message from build
 */
export interface DiagnosticMessage {
  readonly level: "info" | "warning" | "error" | "debug";
  readonly passId: CompilerPassId;
  readonly message: string;
  readonly timestamp: number;
}

/**
 * Error record
 */
export interface ErrorRecord {
  readonly passId: CompilerPassId;
  readonly code: string;
  readonly message: string;
  readonly details: Record<string, unknown>;
  readonly fatal: boolean;
}

/**
 * Summary of build result
 */
export interface BuildResultSummary {
  readonly buildId: string;
  readonly status: BuildStatus;
  readonly duration: number;
  readonly passesExecuted: number;
  readonly passesCached: number;
  readonly artifactsProduced: number;
  readonly errorsCount: number;
  readonly warningsCount: number;
  readonly verificationsPassed: boolean;
  readonly certificationsPassed: boolean;
  readonly cacheHitRate: number;
}

/**
 * Create a build result
 *
 * @param buildId - Build identifier
 * @param timestamp - Result timestamp
 * @param duration - Total build duration
 * @param status - Build status
 * @returns Build result
 */
export const createBuildResult = (
  buildId: string,
  timestamp: number,
  startTime: number,
  endTime: number,
  status: BuildStatus,
): BuildResult => {
  const passResults = new Map<CompilerPassId, PassExecutionResult>();
  const artifacts: ArtifactRecord[] = [];
  const diagnostics: DiagnosticMessage[] = [];
  const errors: ErrorRecord[] = [];
  const warnings: string[] = [];

  const emptyVerificationSummary: VerificationSummary = {
    totalGates: 0,
    passedGates: 0,
    failedGates: 0,
    results: [],
    overallPassed: true,
    totalDuration: 0,
  };

  const emptyCertificationSummary: CertificationSummary = {
    totalGates: 0,
    certifiedGates: 0,
    failedGates: 0,
    overallCertified: true,
    achievedLevel: "alpha",
    results: [],
    timestamp,
  };

  const getPassResult = (passId: CompilerPassId): PassExecutionResult | undefined => {
    return passResults.get(passId);
  };

  const gatesPassed = (): boolean => {
    return emptyVerificationSummary.overallPassed && emptyCertificationSummary.overallCertified;
  };

  const summary = (): BuildResultSummary => {
    const executed = passResults.size;
    const cached = Array.from(passResults.values()).filter((r) => r.cacheHit).length;
    const hitRate = executed > 0 ? cached / executed : 0;

    return {
      buildId,
      status,
      duration: endTime - startTime,
      passesExecuted: executed,
      passesCached: cached,
      artifactsProduced: artifacts.length,
      errorsCount: errors.length,
      warningsCount: warnings.length,
      verificationsPassed: emptyVerificationSummary.overallPassed,
      certificationsPassed: emptyCertificationSummary.overallCertified,
      cacheHitRate: hitRate,
    };
  };

  const result: BuildResult = {
    buildId,
    timestamp,
    startTime,
    endTime,
    duration: endTime - startTime,
    status,
    successful: status === "success",
    passResults: passResults as ReadonlyMap<CompilerPassId, PassExecutionResult>,
    verificationResults: emptyVerificationSummary,
    certificationResults: emptyCertificationSummary,
    artifacts: Object.freeze(artifacts),
    diagnostics: Object.freeze(diagnostics),
    errors: Object.freeze(errors),
    warnings: Object.freeze(warnings),
    cacheHitRate: passResults.size > 0 ? 0 : 0,
    passesExecuted: passResults.size,
    passesCached: 0,
    readonly: true,
    summary,
    getPassResult,
    gatesPassed,
  };

  return Object.freeze(result);
};
