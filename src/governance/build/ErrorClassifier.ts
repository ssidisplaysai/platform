/**
 * ErrorClassifier.ts
 *
 * Deterministic classification of TypeScript errors.
 *
 * Maps errors to categories based on:
 * - File path patterns
 * - Error codes
 * - Error message content
 *
 * Classification is deterministic: identical errors always receive
 * identical classifications across runs.
 */

import type { BuildError } from './models/BuildError';
import type { ClassificationResult } from './models/ErrorCategory';
import { ErrorCategory, ErrorSeverity, CATEGORY_RULES } from './models/ErrorCategory';

/**
 * Error type patterns.
 *
 * Used to classify the semantic type of an error based on its code
 * and message.
 */
const ERROR_TYPE_PATTERNS = [
  {
    name: 'Cannot find module',
    pattern: /TS2307|cannot find module/i,
    code: 'TS2307',
  },
  {
    name: 'Implicit any',
    pattern: /TS7006|TS7005|implicitly has type 'any'/i,
    code: 'TS7006',
  },
  {
    name: 'Readonly violation',
    pattern: /TS2540|cannot assign to readonly/i,
    code: 'TS2540',
  },
  {
    name: 'Missing property',
    pattern: /TS2741|property .* is missing/i,
    code: 'TS2741',
  },
  {
    name: 'Unknown export',
    pattern: /TS2305|has no exported member/i,
    code: 'TS2305',
  },
  {
    name: 'Object literal mismatch',
    pattern: /TS2322|Type .* is not assignable to type/i,
    code: 'TS2322',
  },
  {
    name: 'Syntax error',
    pattern: /TS1005|TS1009|',' expected|';' expected/i,
    code: 'TS1005',
  },
  {
    name: 'Configuration error',
    pattern: /TS5107|option compilerOptions|tsconfig/i,
    code: 'TS5107',
  },
];

/**
 * Classify a TypeScript error deterministically.
 *
 * Applies rules in order:
 * 1. Check file path patterns (CATEGORY_RULES)
 * 2. Extract error type from code/message
 * 3. Default to COMPILER category if no match
 *
 * @param error - Partial error to classify
 * @returns Classification result with category, severity, and reason
 */
export class ErrorClassifier {
  /**
   * Classify a single error.
   *
   * @param error - Partial error object
   * @returns Classification with category, severity, and reason
   */
  classify(error: Partial<BuildError>): ClassificationResult {
    const file = error.file || 'unknown';
    const code = error.code || '';
    const message = error.message || '';

    // Try path-based rules first
    for (const rule of CATEGORY_RULES) {
      if (rule.pattern.test(file)) {
        const errorType = this.extractErrorType(code, message);
        return {
          category: rule.category,
          severity: rule.severity,
          subsystem: error.subsystem || 'unknown',
          reason: `File path matches pattern: ${file} categorized as ${rule.category} (${errorType})`,
        };
      }
    }

    // Default to COMPILER if no match
    const errorType = this.extractErrorType(code, message);
    return {
      category: ErrorCategory.COMPILER,
      severity: ErrorSeverity.MEDIUM,
      subsystem: error.subsystem || 'unknown',
      reason: `No path pattern matched, defaulted to COMPILER category (error type: ${errorType})`,
    };
  }

  /**
   * Extract error type from code and message.
   *
   * @param code - TypeScript error code (e.g., "TS2307")
   * @param message - Error message
   * @returns Error type description
   */
  private extractErrorType(code: string, message: string): string {
    for (const pattern of ERROR_TYPE_PATTERNS) {
      if (pattern.pattern.test(code) || pattern.pattern.test(message)) {
        return pattern.name;
      }
    }
    return 'Other';
  }
}

/**
 * Global error classifier instance.
 */
export const globalErrorClassifier = new ErrorClassifier();
