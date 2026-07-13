/**
 * CertificationGate.ts
 *
 * Certification gate contract for architectural certification.
 * Certification gates mark compilations as architecture-valid and stable.
 *
 * Examples: GGF Certification, Genome Certification, Architecture Freeze
 */

/**
 * Certification gate identifier
 *
 * @readonly
 */
export type CertificationGateId =
  | "ggf-certification"
  | "genome-certification"
  | "architecture-freeze"
  | "compiler-certification"
  | "deployment-certification";

/**
 * Certification level
 *
 * @readonly
 */
export type CertificationLevel = "alpha" | "beta" | "release-candidate" | "stable";

/**
 * Result of certification execution
 */
export interface CertificationResult {
  readonly gateId: CertificationGateId;
  readonly certified: boolean;
  readonly level: CertificationLevel;
  readonly message: string;
  readonly requirements: readonly string[];
  readonly violations: readonly string[];
  readonly timestamp: number;
}

/**
 * Certification gate contract
 *
 * Certification gates are immutable, read-only checks that determine
 * whether a compilation is architecture-valid and can proceed.
 *
 * Certification gates do not modify state. They only affirm or deny
 * certification based on build outputs and verification results.
 */
export interface CertificationGate {
  readonly id: CertificationGateId;
  readonly name: string;
  readonly description: string;
  readonly level: CertificationLevel;
  readonly requiredVerifications: readonly string[];
  readonly tags: readonly string[];

  /**
   * Execute certification check (non-mutating)
   *
   * @param context - Certification context
   * @returns Result of certification
   */
  readonly certify: (context: CertificationContext) => CertificationResult | Promise<CertificationResult>;
}

/**
 * Context passed to certification gate
 */
export interface CertificationContext {
  readonly buildId: string;
  readonly passId: string;
  readonly verificationResults: Record<string, boolean>;
  readonly outputs: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
}

/**
 * Certification schedule for a build
 */
export interface CertificationSchedule {
  readonly gates: readonly CertificationGate[];
  readonly parallel: boolean;
  readonly minimumLevel: CertificationLevel;
  readonly stopOnFirstFailure: boolean;
}

/**
 * Certification results for a build
 */
export interface CertificationSummary {
  readonly totalGates: number;
  readonly certifiedGates: number;
  readonly failedGates: number;
  readonly overallCertified: boolean;
  readonly achievedLevel: CertificationLevel;
  readonly results: readonly CertificationResult[];
  readonly timestamp: number;
}
