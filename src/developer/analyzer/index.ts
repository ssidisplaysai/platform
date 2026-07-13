/**
 * index.ts
 * Public API exports for the Genesis Repository Analyzer.
 *
 * This module provides the stable public API for repository analysis.
 * All exports are readonly and immutable after import.
 */

// Core analyzer
export { RepositoryAnalyzer } from './RepositoryAnalyzer';

// Component classes
export { RepositoryScanner } from './RepositoryScanner';
export { DocumentParser } from './DocumentParser';
export { AuthorityClassifier } from './AuthorityClassifier';
export { DependencyGraphBuilder } from './DependencyGraphBuilder';
export { ConflictDetector } from './ConflictDetector';
export { HealthCalculator } from './HealthCalculator';
export { ReportGenerator } from './ReportGenerator';

// Interfaces
export type { IRepositoryAnalyzer } from './interfaces/Analyzer';
export type { IRepositoryScanner } from './interfaces/Scanner';
export type { IReportGenerator, ReportFormat } from './interfaces/Reporter';

// Models
export type { Authority } from './models/Authority';
export {
  AuthorityLevel,
  createAuthority,
} from './models/Authority';

export type { RepositoryDocument } from './models/RepositoryDocument';
export { createRepositoryDocument } from './models/RepositoryDocument';

export type { RepositoryConflict } from './models/RepositoryConflict';
export {
  ConflictCategory,
  ConflictSeverity,
  createRepositoryConflict,
} from './models/RepositoryConflict';

export type { RepositoryHealth } from './models/RepositoryHealth';
export { createRepositoryHealth } from './models/RepositoryHealth';

export type { RepositoryReport, DependencyEdge } from './models/RepositoryReport';
export { createRepositoryReport } from './models/RepositoryReport';
