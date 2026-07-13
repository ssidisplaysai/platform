/**
 * BuildError.ts
 *
 * Represents a single TypeScript compiler error extracted from build output.
 *
 * BuildErrors are immutable after creation and contain all necessary information
 * for classification, health scoring, and remediation prioritization.
 */

import type { ErrorCategory, ErrorSeverity } from './ErrorCategory';

/**
 * A single TypeScript compiler error.
 *
 * All properties are readonly to ensure immutability after creation.
 */
export interface BuildError {
  /**
   * Unique identifier for this error (SHA256 hash of error details).
   */
  readonly id: string;

  /**
   * TypeScript error code (e.g., "TS2307" for "Cannot find module").
   */
  readonly code: string;

  /**
   * Human-readable error message.
   */
  readonly message: string;

  /**
   * File path where error occurred (relative to repository root).
   */
  readonly file: string;

  /**
   * Line number where error occurred (1-indexed).
   */
  readonly line: number;

  /**
   * Column number where error occurred (1-indexed).
   */
  readonly column: number;

  /**
   * Error type/category (classified deterministically).
   */
  readonly category: ErrorCategory;

  /**
   * Subsystem containing the error.
   */
  readonly subsystem: string;

  /**
   * Severity level for health scoring.
   */
  readonly severity: ErrorSeverity;

  /**
   * Full raw text from TypeScript output.
   */
  readonly rawText: string;

  /**
   * Classification reason for audit/transparency.
   */
  readonly classificationReason: string;

  /**
   * When error was parsed (ISO 8601 format, not included in canonical report).
   */
  readonly parsedAt?: string;
}

/**
 * Factory to create a BuildError.
 *
 * @param code - TypeScript error code
 * @param message - Error message
 * @param file - File path
 * @param line - Line number
 * @param column - Column number
 * @param category - Error category
 * @param subsystem - Subsystem name
 * @param severity - Error severity
 * @param rawText - Raw error text
 * @param classificationReason - Why this error was categorized this way
 * @returns Immutable BuildError object
 */
export function createBuildError(
  code: string,
  message: string,
  file: string,
  line: number,
  column: number,
  category: ErrorCategory,
  subsystem: string,
  severity: ErrorSeverity,
  rawText: string,
  classificationReason: string
): BuildError {
  return {
    id: `${code}:${file}:${line}:${column}`.toLowerCase(),
    code,
    message,
    file,
    line,
    column,
    category,
    subsystem,
    severity,
    rawText,
    classificationReason,
  };
}

/**
 * Parse a file path to extract subsystem.
 *
 * Looks at the directory structure to identify which subsystem
 * an error belongs to.
 *
 * @param filePath - File path (relative)
 * @returns Subsystem name
 */
export function extractSubsystem(filePath: string): string {
  const parts = filePath.split('/');

  // src/X/... -> subsystem is X
  if (parts[0] === 'src' && parts[1]) {
    return parts[1];
  }

  // Root level file
  if (!parts.includes('/')) {
    return 'root';
  }

  // Default
  return 'unknown';
}
