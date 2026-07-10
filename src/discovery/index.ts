/**
 * Genesis Discovery Engine
 *
 * Stage 1 of the Genesis Enterprise Compiler.
 *
 * This module implements the Discovery Import Pipeline:
 *
 *   Discovery Source
 *     ↓
 *   Discovery Document
 *     ↓
 *   Discovery Evidence (DiscoveryInterview)
 *
 * Public API surface:
 *
 *   DiscoveryPipeline  — main entry point for importing files
 *   DiscoveryDocument  — normalized document model
 *   DiscoveryInterview — structured interview evidence model
 *   JsonDiscoveryExporter — serialize results to JSON
 *
 * This module does NOT implement Evidence IR or any later compiler stage.
 */

// Pipeline
export { DiscoveryPipeline } from './pipeline';

// Importer layer
export type { IDiscoveryImporter, DiscoveryImportInput } from './importer';
export { PdfDiscoveryImporter } from './importer';

// Parser layer
export type { IRawParser, IStructureParser, IRawParseResult } from './parser';
export { PdfRawParser, InterviewStructureParser } from './parser';

// Validation layer
export { DiscoveryValidator } from './validation';

// Exporter layer
export type { IDiscoveryExporter, ExporterOutput } from './exporters';
export { JsonDiscoveryExporter } from './exporters';

// Diagnostics
export { DiagnosticsCollector } from './diagnostics';

// All models
export type {
  DiscoverySourceType,
  DiscoveryBlockType,
  DiagnosticSeverity,
  DiscoveryDiagnostic,
  DiscoveryMetadata,
  DiscoveryBlock,
  DiscoveryPage,
  DiscoverySource,
  DiscoveryDocument,
  DiscoveryAnswer,
  DiscoveryQuestion,
  DiscoverySection,
  DiscoveryInterview,
  DiscoveryValidationResult,
  DiscoveryImportResult,
} from './models';

export { DiagnosticCode } from './models';
