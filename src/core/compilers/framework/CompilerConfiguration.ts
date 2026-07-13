/**
 * Genesis Compiler Framework - Configuration
 *
 * Default configurations and builders for compiler setup
 */

import {
  CompilerConfiguration,
  CompilerCapabilities,
} from "./types";

/**
 * Default compiler configuration
 */
export const DEFAULT_COMPILER_CONFIG: CompilerConfiguration = {
  collectDiagnostics: true,
  collectMetrics: true,
  trackProvenance: true,
  trackLineage: true,
  failFast: false,
  maxErrors: 100,
};

/**
 * Default compiler capabilities
 */
export const DEFAULT_COMPILER_CAPABILITIES: CompilerCapabilities = {
  deterministicExecution: true,
  immutableInput: true,
  publicationGating: true,
  auditTrail: true,
  incrementalCompilation: false,
  parallelExecution: false,
};

/**
 * Build compiler configuration with defaults
 */
export function buildCompilerConfig(
  overrides?: Partial<CompilerConfiguration>
): CompilerConfiguration {
  return {
    ...DEFAULT_COMPILER_CONFIG,
    ...overrides,
  };
}

/**
 * Build compiler capabilities with defaults
 */
export function buildCompilerCapabilities(
  overrides?: Partial<CompilerCapabilities>
): CompilerCapabilities {
  return {
    ...DEFAULT_COMPILER_CAPABILITIES,
    ...overrides,
  };
}
