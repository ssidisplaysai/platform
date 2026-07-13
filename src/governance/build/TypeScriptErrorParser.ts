/**
 * TypeScriptErrorParser.ts
 *
 * Parse raw TypeScript compiler output to extract structured errors.
 *
 * Accepts output from `npx tsc --noEmit` and tolerates malformed lines.
 * Never throws on invalid input, instead accumulates diagnostic messages.
 */

import type { BuildError } from './models/BuildError';
import { createBuildError, extractSubsystem } from './models/BuildError';
import { ErrorCategory, ErrorSeverity } from './models/ErrorCategory';

/**
 * Parser diagnostic.
 *
 * Accumulated during parsing to track warnings and issues with input.
 */
export interface ParseDiagnostic {
  readonly level: 'warning' | 'error';
  readonly message: string;
  readonly line?: number;
}

/**
 * Result of parsing TypeScript compiler output.
 */
export interface ParseResult {
  readonly errors: readonly BuildError[];
  readonly diagnostics: readonly ParseDiagnostic[];
  readonly compilerVersion?: string;
}

/**
 * TypeScript error line format:
 *
 * path/to/file.ts(line,col): error TSxxxx: Message text
 *
 * Example:
 * src/app.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
 */
const ERROR_LINE_PATTERN = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d{4}):\s+(.+)$/;

/**
 * Parse raw TypeScript compiler output.
 *
 * Handles:
 * - Multiline errors (only first line is parsed)
 * - Malformed lines (skipped with diagnostic)
 * - Mixed error and warning lines
 * - Empty lines and whitespace
 * - Unknown error codes (treated as COMPILER category)
 *
 * Never throws on invalid input. Instead, accumulates diagnostics.
 *
 * @param output - Raw compiler output
 * @param classify - Function to classify errors (called for each error)
 * @returns Parse result with errors and diagnostics
 */
export function parseTypeScriptOutput(
  output: string,
  classify: (error: Partial<BuildError>) => { category: ErrorCategory; severity: ErrorSeverity; reason: string }
): ParseResult {
  const errors: BuildError[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  const lines = output.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    const match = line.match(ERROR_LINE_PATTERN);

    if (!match) {
      diagnostics.push({
        level: 'warning',
        message: `Failed to parse error line (line ${i + 1}): ${line.substring(0, 80)}`,
        line: i + 1,
      });
      continue;
    }

    const [, filePath, lineNum, colNum, , code, message] = match;

    const lineNumber = parseInt(lineNum, 10);
    const columnNumber = parseInt(colNum, 10);

    if (isNaN(lineNumber) || isNaN(columnNumber)) {
      diagnostics.push({
        level: 'warning',
        message: `Invalid line or column number (line ${i + 1})`,
        line: i + 1,
      });
      continue;
    }

    // Extract subsystem
    const subsystem = extractSubsystem(filePath);

    // Classify error
    const partialError: Partial<BuildError> = {
      code,
      message,
      file: filePath,
      line: lineNumber,
      column: columnNumber,
      subsystem,
    };

    const classification = classify(partialError);

    // Create error
    const error = createBuildError(
      code,
      message,
      filePath,
      lineNumber,
      columnNumber,
      classification.category,
      subsystem,
      classification.severity,
      line,
      classification.reason
    );

    errors.push(error);
  }

  return {
    errors: errors.sort((a, b) => {
      // Sort deterministically: by file, then line, then column
      if (a.file !== b.file) return a.file.localeCompare(b.file);
      if (a.line !== b.line) return a.line - b.line;
      return a.column - b.column;
    }),
    diagnostics: Object.freeze(diagnostics),
    compilerVersion: extractCompilerVersion(output),
  };
}

/**
 * Extract TypeScript version from compiler output.
 *
 * Looks for lines like "Version 5.1.6" or similar.
 *
 * @param output - Raw compiler output
 * @returns Version string if found, undefined otherwise
 */
export function extractCompilerVersion(output: string): string | undefined {
  const versionMatch = output.match(/(?:Version|version)\s+(\d+\.\d+\.\d+(?:-\w+)?)/);
  return versionMatch ? versionMatch[1] : undefined;
}
