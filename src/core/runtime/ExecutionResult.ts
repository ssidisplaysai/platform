/**
 * ExecutionResult.ts
 *
 * Immutable result of a single compiler pass execution within a runtime run.
 *
 * Wraps a PassExecutionRecord with pre-computed aggregate fields
 * (allVerificationsPassed, allCertificationsPassed) for convenient
 * consumption by the pipeline and report builder.
 */

import type { CompilerPassId } from "../apollo/CompilerPass.js";
import type { VerificationResult } from "../apollo/VerificationGate.js";
import type { CertificationResult } from "../apollo/CertificationGate.js";
import type { PassLifecycleStage } from "./PassExecutor.js";

/**
 * Immutable result of executing a single compiler pass.
 */
export interface ExecutionResult {
  readonly passId: CompilerPassId;
  readonly passName: string;
  readonly buildId: string;
  readonly passIndex: number;
  readonly success: boolean;
  readonly cacheHit: boolean;
  readonly durationMs: number;
  readonly outputCount: number;
  readonly stage: PassLifecycleStage;
  readonly verificationResults: readonly VerificationResult[];
  readonly certificationResults: readonly CertificationResult[];
  readonly diagnostics: readonly string[];
  readonly errors: readonly string[];
  /** True if every verification gate passed (or no gates ran). */
  readonly allVerificationsPassed: boolean;
  /** True if every certification gate passed (or no gates ran). */
  readonly allCertificationsPassed: boolean;
}

/**
 * Create an immutable ExecutionResult.
 */
export const createExecutionResult = (params: {
  readonly passId: CompilerPassId;
  readonly passName: string;
  readonly buildId: string;
  readonly passIndex: number;
  readonly success: boolean;
  readonly cacheHit: boolean;
  readonly durationMs: number;
  readonly outputCount: number;
  readonly stage: PassLifecycleStage;
  readonly verificationResults: readonly VerificationResult[];
  readonly certificationResults: readonly CertificationResult[];
  readonly diagnostics: readonly string[];
  readonly errors: readonly string[];
}): ExecutionResult =>
  Object.freeze({
    ...params,
    allVerificationsPassed: params.verificationResults.every((v) => v.passed),
    allCertificationsPassed: params.certificationResults.every((c) => c.certified),
  });
