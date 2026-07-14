/**
 * RuntimeMetrics.ts
 *
 * Runtime metrics accumulator.
 *
 * Metrics are incremented throughout execution and read out as an
 * immutable snapshot at any point. No timestamps are included in
 * deterministic hashes — execution duration is recorded separately.
 */

/**
 * Immutable snapshot of runtime metrics at a point in time.
 */
export interface RuntimeMetricsSnapshot {
  /** Total passes in the plan. */
  readonly passCount: number;
  /** Passes completed (success or failure). */
  readonly passesAttempted: number;
  /** Passes that completed successfully. */
  readonly passesSucceeded: number;
  /** Passes that failed. */
  readonly passesFailed: number;
  /** Passes served from cache (subset of passesSucceeded). */
  readonly cacheHitCount: number;
  /** Total artifacts registered. */
  readonly artifactCount: number;
  /** Total verification gate executions. */
  readonly verificationCount: number;
  /** Verification gates that passed. */
  readonly verificationPassCount: number;
  /** Verification gates that failed. */
  readonly verificationFailCount: number;
  /** Total certification gate executions. */
  readonly certificationCount: number;
  /** Certification gates that passed. */
  readonly certificationPassCount: number;
  /** Certification gates that failed. */
  readonly certificationFailCount: number;
  /** Total execution duration (milliseconds). */
  readonly executionDurationMs: number;
  /** Total warnings accumulated. */
  readonly warningCount: number;
  /** Total errors accumulated. */
  readonly errorCount: number;
  /** Fraction of passes that succeeded (0–1). */
  readonly successRate: number;
  /** Fraction of completed passes served from cache (0–1). */
  readonly cacheHitRate: number;
}

/**
 * Mutable metrics accumulator.
 * All mutation methods are void; state is only observable via snapshot().
 */
export interface RuntimeMetrics {
  readonly setTotalPasses: (count: number) => void;
  readonly recordPassSucceeded: (cacheHit: boolean) => void;
  readonly recordPassFailed: () => void;
  readonly recordArtifact: () => void;
  readonly recordVerification: (passed: boolean) => void;
  readonly recordCertification: (passed: boolean) => void;
  readonly recordWarning: () => void;
  readonly recordError: () => void;
  readonly setDurationMs: (ms: number) => void;
  /** Return an immutable snapshot of current metrics. */
  readonly snapshot: () => RuntimeMetricsSnapshot;
}

/**
 * Create a new RuntimeMetrics accumulator.
 */
export const createRuntimeMetrics = (): RuntimeMetrics => {
  let passCount = 0;
  let passesSucceeded = 0;
  let passesFailed = 0;
  let cacheHitCount = 0;
  let artifactCount = 0;
  let verificationCount = 0;
  let verificationPassCount = 0;
  let verificationFailCount = 0;
  let certificationCount = 0;
  let certificationPassCount = 0;
  let certificationFailCount = 0;
  let executionDurationMs = 0;
  let warningCount = 0;
  let errorCount = 0;

  const setTotalPasses = (count: number): void => { passCount = count; };
  const recordPassSucceeded = (cacheHit: boolean): void => { passesSucceeded++; if (cacheHit) cacheHitCount++; };
  const recordPassFailed = (): void => { passesFailed++; };
  const recordArtifact = (): void => { artifactCount++; };
  const recordWarning = (): void => { warningCount++; };
  const recordError = (): void => { errorCount++; };
  const setDurationMs = (ms: number): void => { executionDurationMs = ms; };
  const recordVerification = (passed: boolean): void => {
    verificationCount++;
    if (passed) verificationPassCount++; else verificationFailCount++;
  };
  const recordCertification = (passed: boolean): void => {
    certificationCount++;
    if (passed) certificationPassCount++; else certificationFailCount++;
  };

  const snapshot = (): RuntimeMetricsSnapshot => {
    const passesAttempted = passesSucceeded + passesFailed;
    const successRate = passesAttempted > 0 ? passesSucceeded / passesAttempted : 1;
    const cacheHitRate = passesSucceeded > 0 ? cacheHitCount / passesSucceeded : 0;
    return Object.freeze({
      passCount,
      passesAttempted,
      passesSucceeded,
      passesFailed,
      cacheHitCount,
      artifactCount,
      verificationCount,
      verificationPassCount,
      verificationFailCount,
      certificationCount,
      certificationPassCount,
      certificationFailCount,
      executionDurationMs,
      warningCount,
      errorCount,
      successRate,
      cacheHitRate,
    });
  };

  return Object.freeze({
    setTotalPasses, recordPassSucceeded, recordPassFailed, recordArtifact,
    recordVerification, recordCertification, recordWarning, recordError,
    setDurationMs, snapshot,
  });
};
