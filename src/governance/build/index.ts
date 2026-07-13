/**
 * index.ts
 *
 * Genesis Build Report public API.
 *
 * Exports all types, utilities, and generators needed to create
 * and consume build reports.
 */

// Models
export {
  ErrorCategory,
  ErrorSeverity,
  type ClassificationResult,
  CATEGORY_RULES,
} from './models/ErrorCategory';

export type { BuildError } from './models/BuildError';
export { createBuildError, extractSubsystem } from './models/BuildError';

export type { ErrorStatistics, CategoryStatistics, SubsystemStatistics, FileStatistics, ErrorTypeStatistics } from './models/ErrorStatistics';
export { computeErrorStatistics } from './models/ErrorStatistics';

export { HealthGrade, type RepositoryHealth, type HealthDeduction, computeRepositoryHealth } from './models/RepositoryHealth';

// Build summary
export type { BuildSummary } from './BuildSummary';
export { createBuildSummary } from './BuildSummary';

// Core components
export { BuildReportGenerator, globalReportGenerator } from './BuildReportGenerator';
export { ErrorClassifier, globalErrorClassifier } from './ErrorClassifier';
export { RepositoryHealthScorer, globalHealthScorer } from './RepositoryHealthScorer';
export { parseTypeScriptOutput, extractCompilerVersion, type ParseResult, type ParseDiagnostic } from './TypeScriptErrorParser';

// Utilities
export { deepFreeze, assertFrozen } from './utils/deepFreeze';
export { computeChecksum, stripTimestamps, verifyChecksum } from './utils/checksum';
