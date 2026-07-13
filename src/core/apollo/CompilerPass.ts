/**
 * CompilerPass.ts
 *
 * Compiler pass contract defining the immutable interface for all
 * compiler stages in the Genesis compilation pipeline.
 *
 * Every compiler pass (Discovery, Evidence, Genome, Blueprint, Generation)
 * exposes this contract without modification.
 */

import type { VerificationGate, VerificationSchedule } from "./VerificationGate.js";
import type { CertificationGate, CertificationSchedule } from "./CertificationGate.js";

/**
 * Compiler pass identifier
 *
 * @readonly
 */
export type CompilerPassId =
  | "discovery"
  | "evidence"
  | "business-genome"
  | "genome"
  | "canonical-blueprint"
  | "blueprint"
  | "generation"
  | "deployment";

/**
 * Compiler pass stage in the pipeline
 *
 * @readonly
 */
export type CompilerStage = "import" | "transform" | "validate" | "generate" | "verify" | "certify" | "deploy";

/**
 * Input source to a compiler pass
 */
export interface CompilerInput {
  readonly type: string;
  readonly required: boolean;
  readonly description: string;
}

/**
 * Output artifact from a compiler pass
 */
export interface CompilerOutput {
  readonly type: string;
  readonly format: string;
  readonly description: string;
}

/**
 * Dependency on another compiler pass
 */
export interface CompilerPassDependency {
  readonly passId: CompilerPassId;
  readonly stage: CompilerStage;
  readonly optional: boolean;
}

/**
 * Immutable compiler pass contract
 *
 * Every compiler pass implements this interface.
 * Passes are stateless, deterministic, and immutable.
 */
export interface CompilerPass {
  readonly id: CompilerPassId;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly stage: CompilerStage;

  /**
   * Semantic version of this pass
   *
   * Used for incremental compilation to determine cache validity.
   */
  readonly schemaVersion: string;

  /**
   * Pass dependencies (other passes that must execute first)
   */
  readonly dependencies: readonly CompilerPassDependency[];

  /**
   * Input types expected by this pass
   */
  readonly inputs: readonly CompilerInput[];

  /**
   * Output types produced by this pass
   */
  readonly outputs: readonly CompilerOutput[];

  /**
   * Tags for categorization
   */
  readonly tags: readonly string[];

  /**
   * Verification gates that must pass before moving to next stage
   */
  readonly verificationSchedule: VerificationSchedule;

  /**
   * Certification gates required before deployment
   */
  readonly certificationSchedule: CertificationSchedule;

  /**
   * Execute this compiler pass
   *
   * @param inputs - Immutable input objects
   * @param context - Execution context
   * @returns Immutable output objects
   *
   * Must be deterministic: same inputs always produce same outputs.
   * Must not modify inputs or context.
   */
  readonly execute: (inputs: Record<string, unknown>, context: CompilerPassContext) => Promise<Record<string, unknown>>;

  /**
   * Dry-run execution (read-only planning only)
   *
   * @param inputs - Input objects for analysis
   * @param context - Execution context
   * @returns Execution plan without actual execution
   */
  readonly plan: (inputs: Record<string, unknown>, context: CompilerPassContext) => Promise<ExecutionPlan>;
}

/**
 * Context provided to compiler pass execution
 */
export interface CompilerPassContext {
  readonly passId: CompilerPassId;
  readonly buildId: string;
  readonly timestamp: number;
  readonly metadata: Record<string, unknown>;
  readonly cacheKey?: string;
}

/**
 * Plan for executing a compiler pass (no execution yet)
 */
export interface ExecutionPlan {
  readonly passId: CompilerPassId;
  readonly outputCount: number;
  readonly estimatedDuration: number;
  readonly dependencies: readonly CompilerPassId[];
  readonly verificationGates: readonly string[];
  readonly certificationGates: readonly string[];
  readonly deterministic: boolean;
}

/**
 * Result of executing a compiler pass
 */
export interface PassExecutionResult {
  readonly passId: CompilerPassId;
  readonly buildId: string;
  readonly success: boolean;
  readonly outputCount: number;
  readonly duration: number;
  readonly cacheHit: boolean;
  readonly outputs: Record<string, unknown>;
  readonly diagnostics: readonly string[];
}

/**
 * Immutable, readonly compiler pass registry entry
 *
 * Passes are stored immutably and accessed read-only.
 */
export interface PassRegistryEntry {
  readonly pass: CompilerPass;
  readonly registered: number;
  readonly immutable: true;
}
