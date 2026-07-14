/**
 * RuntimeContext.ts
 *
 * Immutable runtime context snapshot combining execution context with
 * the runtime's own read-only state at a specific point in execution.
 *
 * Created as an immutable snapshot at key lifecycle transitions.
 * Never mutated — each transition produces a new snapshot.
 */

import type { ExecutionContext } from "./ExecutionContext.js";
import type { RuntimeConfiguration } from "./RuntimeConfiguration.js";
import type { RuntimeStatus } from "./RuntimeStatus.js";

/**
 * Immutable runtime context snapshot.
 */
export interface RuntimeContext {
  /** Immutable execution context for this run. */
  readonly executionContext: ExecutionContext;

  /** Enterprise Runtime version. */
  readonly runtimeVersion: string;

  /** Runtime status at the moment this snapshot was taken. */
  readonly status: RuntimeStatus;

  /** Number of compiler passes completed at snapshot time. */
  readonly passesCompleted: number;

  /** Number of compiler passes remaining at snapshot time. */
  readonly passesRemaining: number;

  /** Number of artifacts registered at snapshot time. */
  readonly artifactCount: number;

  /** Number of verification gates completed at snapshot time. */
  readonly verificationsCompleted: number;

  /** Number of certification gates completed at snapshot time. */
  readonly certificationsCompleted: number;

  /** Warning count accumulated at snapshot time. */
  readonly warningCount: number;

  /** Error count accumulated at snapshot time. */
  readonly errorCount: number;

  /** Epoch milliseconds when this snapshot was taken. */
  readonly snapshotTime: number;

  /** Convenience accessor for the runtime configuration. */
  readonly configuration: RuntimeConfiguration;
}

/**
 * Create an immutable RuntimeContext snapshot.
 */
export const createRuntimeContext = (params: {
  readonly executionContext: ExecutionContext;
  readonly runtimeVersion: string;
  readonly status: RuntimeStatus;
  readonly passesCompleted: number;
  readonly passesRemaining: number;
  readonly artifactCount: number;
  readonly verificationsCompleted: number;
  readonly certificationsCompleted: number;
  readonly warningCount: number;
  readonly errorCount: number;
  readonly snapshotTime: number;
}): RuntimeContext =>
  Object.freeze({
    ...params,
    configuration: params.executionContext.configuration,
  });
