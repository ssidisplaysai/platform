/**
 * VerificationGate.ts
 *
 * Non-modifying verification contract for compile-time checks.
 * Verification gates validate compiler outputs without modifying them.
 *
 * Examples: TypeScript compilation, determinism checks, renderer tests
 */

/**
 * Verification gate identifier
 *
 * @readonly
 */
export type VerificationGateId =
  | "typescript"
  | "determinism"
  | "renderer-tests"
  | "compiler-tests"
  | "genome-validation"
  | "schema-validation"
  | "registry-validation"
  | "artifact-determinism";

/**
 * Result of verification execution
 */
export interface VerificationResult {
  readonly gateId: VerificationGateId;
  readonly passed: boolean;
  readonly message: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly duration: number; // milliseconds
}

/**
 * Verification gate contract
 *
 * Verification gates are immutable, read-only checks that validate
 * compiler outputs. They never modify state or generate artifacts.
 */
export interface VerificationGate {
  readonly id: VerificationGateId;
  readonly name: string;
  readonly description: string;
  readonly severity: "required" | "recommended" | "informational";
  readonly tags: readonly string[];

  /**
   * Execute verification (non-mutating)
   *
   * @param context - Verification context with inputs and outputs
   * @returns Result of verification
   */
  readonly verify: (context: VerificationContext) => VerificationResult | Promise<VerificationResult>;
}

/**
 * Context passed to verification gate
 */
export interface VerificationContext {
  readonly passId: string;
  readonly inputs: Record<string, unknown>;
  readonly outputs: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
}

/**
 * Verification schedule for a compiler pass
 */
export interface VerificationSchedule {
  readonly gates: readonly VerificationGate[];
  readonly parallel: boolean;
  readonly stopOnFirstFailure: boolean;
}

/**
 * Verification results for a build
 */
export interface VerificationSummary {
  readonly totalGates: number;
  readonly passedGates: number;
  readonly failedGates: number;
  readonly results: readonly VerificationResult[];
  readonly overallPassed: boolean;
  readonly totalDuration: number;
}
