/**
 * ExecutionContext.ts
 *
 * Immutable execution context passed throughout a single compilation run.
 * Created once before execution begins and never modified.
 *
 * Contains all contextual facts needed by the runtime and every compiler
 * pass: identifiers, paths, versions, targets, configuration.
 */

import type { RuntimeConfiguration } from "./RuntimeConfiguration.js";

/**
 * Target runtime environment.
 */
export type RuntimeEnvironment = "development" | "staging" | "production" | "test";

/**
 * Immutable execution context.
 *
 * Every field is readonly. The object is Object.freeze()-enforced.
 * No field is mutated during execution.
 */
export interface ExecutionContext {
  /** Unique identifier for this build execution. */
  readonly buildId: string;

  /** Company or workspace being compiled. */
  readonly companyId: string;

  /** Absolute path to the workspace root. */
  readonly workspace: string;

  /** Target deployment environment. */
  readonly environment: RuntimeEnvironment;

  /** Semantic version of the compiler toolchain. */
  readonly compilerVersion: string;

  /** Semantic version of the Enterprise Runtime. */
  readonly runtimeVersion: string;

  /** Output targets requested for this build. */
  readonly requestedTargets: readonly string[];

  /** Execution start time (epoch milliseconds, from BuildPlan). */
  readonly startTime: number;

  /** Immutable runtime configuration for this run. */
  readonly configuration: RuntimeConfiguration;

  /** Optional correlation ID for distributed tracing. */
  readonly correlationId: string | undefined;
}

/**
 * Create an immutable ExecutionContext.
 */
export const createExecutionContext = (params: {
  readonly buildId: string;
  readonly companyId: string;
  readonly workspace: string;
  readonly environment: RuntimeEnvironment;
  readonly compilerVersion: string;
  readonly runtimeVersion: string;
  readonly requestedTargets: readonly string[];
  readonly startTime: number;
  readonly configuration: RuntimeConfiguration;
  readonly correlationId?: string | undefined;
}): ExecutionContext =>
  Object.freeze({
    buildId: params.buildId,
    companyId: params.companyId,
    workspace: params.workspace,
    environment: params.environment,
    compilerVersion: params.compilerVersion,
    runtimeVersion: params.runtimeVersion,
    requestedTargets: Object.freeze([...params.requestedTargets]),
    startTime: params.startTime,
    configuration: params.configuration,
    correlationId: params.correlationId,
  });
