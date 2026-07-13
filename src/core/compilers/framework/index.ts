/**
 * Genesis Compiler Framework - Public API
 *
 * Main exports for framework consumers
 */

// Core Compiler
export { GenesisCompiler } from "./GenesisCompiler";

// Types
export type {
  CompilerPass,
  PassResult,
  PassMetrics,
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticSummary,
  ArtifactVersion,
  ArtifactChecksum,
  ArtifactIdentity,
  ProvenanceEntry,
  ProvenanceIndex,
  LineageEntry,
  LineageIndex,
  CompilerManifest,
  PublicationDecision,
  PublicationResult,
  ValidationRule,
  ValidationRuleResult,
  ValidationContext,
  CompilerExecutionMetrics,
  CompilerExecutionSummary,
  CompilationState,
  CompilationStateMetadata,
  CompilerConfiguration,
  CompilerCapabilities,
  CompilerResult,
  CompilerMetadata,
} from "./types";

// Configuration
export {
  DEFAULT_COMPILER_CONFIG,
  DEFAULT_COMPILER_CAPABILITIES,
  buildCompilerConfig,
  buildCompilerCapabilities,
} from "./CompilerConfiguration";

// Execution Context
export {
  StateThreader,
  PassRegistry,
  DiagnosticAccumulator,
  ExecutionTimer,
} from "./CompilerExecutionContext";

// Metadata
export {
  ManifestGenerator,
  MetadataBuilder,
  PublicationGate,
  MetricsAggregator,
} from "./CompilerMetadata";

// Utilities
export {
  createChecksum,
  createArtifactIdentity,
  parseArtifactVersion,
  createArtifactVersion,
  stableStringify,
  getCurrentTimestamp,
  sleep,
  deepFreeze,
  verifyNotModified,
  deepCopy,
} from "./CompilerUtilities";
