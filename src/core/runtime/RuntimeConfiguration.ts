/**
 * RuntimeConfiguration.ts
 *
 * Immutable configuration for the Enterprise Runtime.
 * Created once before execution begins and never modified.
 */

/**
 * Logging verbosity level.
 */
export type LoggingLevel = "debug" | "info" | "warn" | "error";

/**
 * Artifact retention policy.
 */
export type ArtifactRetention = "all" | "final-only" | "none";

/**
 * Immutable runtime configuration.
 * All properties are readonly. parallelExecution is always false.
 */
export interface RuntimeConfiguration {
  /**
   * Parallel execution is permanently disabled.
   * The Enterprise Runtime is single-threaded and deterministic.
   */
  readonly parallelExecution: false;

  /**
   * Whether verification gates are invoked for each compiler pass.
   */
  readonly verificationEnabled: boolean;

  /**
   * Whether certification gates are invoked for each compiler pass.
   */
  readonly certificationEnabled: boolean;

  /**
   * Artifact retention policy after execution.
   */
  readonly artifactRetention: ArtifactRetention;

  /**
   * Logging verbosity.
   */
  readonly loggingLevel: LoggingLevel;

  /**
   * Whether to halt execution on the first pass failure.
   */
  readonly stopOnFirstFailure: boolean;

  /**
   * Maximum number of artifacts allowed in the registry per run.
   */
  readonly maxArtifactCount: number;

  /**
   * Whether pass dependency constraints are validated at runtime.
   */
  readonly enforcePassDependencies: boolean;
}

/**
 * Default production configuration.
 */
export const DEFAULT_RUNTIME_CONFIGURATION: RuntimeConfiguration = Object.freeze({
  parallelExecution: false,
  verificationEnabled: true,
  certificationEnabled: true,
  artifactRetention: "all",
  loggingLevel: "info",
  stopOnFirstFailure: false,
  maxArtifactCount: 10_000,
  enforcePassDependencies: true,
} as const);

/**
 * Create an immutable RuntimeConfiguration, merging overrides into the default.
 * parallelExecution is always coerced to false.
 */
export const createRuntimeConfiguration = (
  overrides: Partial<Omit<RuntimeConfiguration, "parallelExecution">> = {},
): RuntimeConfiguration =>
  Object.freeze({
    ...DEFAULT_RUNTIME_CONFIGURATION,
    ...overrides,
    parallelExecution: false,
  } as RuntimeConfiguration);
