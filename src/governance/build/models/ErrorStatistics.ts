/**
 * ErrorStatistics.ts
 *
 * Aggregated error statistics for a build report.
 *
 * Statistics are computed deterministically and immutable.
 */

import type { BuildError } from './BuildError';
import type { ErrorCategory, ErrorSeverity } from './ErrorCategory';

/**
 * Statistics for errors in a specific category.
 */
export interface CategoryStatistics {
  readonly category: ErrorCategory;
  readonly count: number;
  readonly percentage: number;
  readonly severities: Readonly<Record<ErrorSeverity, number>>;
}

/**
 * Statistics for errors in a specific subsystem.
 */
export interface SubsystemStatistics {
  readonly name: string;
  readonly count: number;
  readonly percentage: number;
  readonly categories: Readonly<Record<ErrorCategory, number>>;
}

/**
 * Statistics for errors in a specific file.
 */
export interface FileStatistics {
  readonly file: string;
  readonly count: number;
  readonly percentage: number;
  readonly categories: Readonly<Record<ErrorCategory, number>>;
  readonly lines: readonly number[];
}

/**
 * Error type frequency statistics.
 */
export interface ErrorTypeStatistics {
  readonly type: string;
  readonly count: number;
  readonly percentage: number;
  readonly examples: readonly string[];
}

/**
 * Complete aggregated error statistics.
 *
 * All statistics are computed deterministically and immutable.
 */
export interface ErrorStatistics {
  readonly totalErrors: number;
  readonly totalWarnings: number;
  readonly errorsByCategory: readonly CategoryStatistics[];
  readonly errorsBySubsystem: readonly SubsystemStatistics[];
  readonly errorsByFile: readonly FileStatistics[];
  readonly topErrorTypes: readonly ErrorTypeStatistics[];
  readonly topAffectedFiles: readonly FileStatistics[];
}

/**
 * Compute error statistics from a list of errors.
 *
 * All statistics are computed deterministically:
 * - Sorted lexicographically where appropriate
 * - No randomness or timestamps
 * - Repeated calls with identical input produce identical output
 *
 * @param errors - Array of build errors
 * @returns Statistics object (immutable)
 */
export function computeErrorStatistics(errors: readonly BuildError[]): ErrorStatistics {
  if (errors.length === 0) {
    return {
      totalErrors: 0,
      totalWarnings: 0,
      errorsByCategory: [],
      errorsBySubsystem: [],
      errorsByFile: [],
      topErrorTypes: [],
      topAffectedFiles: [],
    };
  }

  // Count by category
  const categoryMap = new Map<ErrorCategory, Map<ErrorSeverity, number>>();
  const subsystemMap = new Map<string, Map<ErrorCategory, number>>();
  const fileMap = new Map<string, Set<number>>();
  const errorTypeMap = new Map<string, string[]>();

  for (const error of errors) {
    // By category
    if (!categoryMap.has(error.category)) {
      categoryMap.set(error.category, new Map());
    }
    const severityCount = categoryMap.get(error.category)!;
    severityCount.set(error.severity, (severityCount.get(error.severity) ?? 0) + 1);

    // By subsystem
    if (!subsystemMap.has(error.subsystem)) {
      subsystemMap.set(error.subsystem, new Map());
    }
    const categoryCount = subsystemMap.get(error.subsystem)!;
    categoryCount.set(error.category, (categoryCount.get(error.category) ?? 0) + 1);

    // By file
    if (!fileMap.has(error.file)) {
      fileMap.set(error.file, new Set());
    }
    fileMap.get(error.file)!.add(error.line);

    // By error type
    if (!errorTypeMap.has(error.code)) {
      errorTypeMap.set(error.code, []);
    }
    errorTypeMap.get(error.code)!.push(error.message);
  }

  // Build category statistics (sorted lexicographically)
  const categoryStats: CategoryStatistics[] = Array.from(categoryMap.entries())
    .map(([category, severities]) => ({
      category,
      count: Array.from(severities.values()).reduce((a, b) => a + b, 0),
      percentage: 0, // computed after
      severities: Object.freeze(
        Object.fromEntries(severities.entries()) as Record<ErrorSeverity, number>
      ),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));

  // Compute percentages
  for (let i = 0; i < categoryStats.length; i++) {
    const stat = categoryStats[i];
    (stat as any).percentage = Math.round((stat.count / errors.length) * 100);
  }

  // Build subsystem statistics (sorted by name)
  const subsystemStats: SubsystemStatistics[] = Array.from(subsystemMap.entries())
    .map(([name, categories]) => ({
      name,
      count: Array.from(categories.values()).reduce((a, b) => a + b, 0),
      percentage: 0, // computed after
      categories: Object.freeze(
        Object.fromEntries(categories.entries()) as Record<ErrorCategory, number>
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Compute percentages
  for (let i = 0; i < subsystemStats.length; i++) {
    const stat = subsystemStats[i];
    (stat as any).percentage = Math.round((stat.count / errors.length) * 100);
  }

  // Build file statistics (sorted by count descending, then by name)
  const fileStats: FileStatistics[] = Array.from(fileMap.entries())
    .map(([file, lines]) => ({
      file,
      count: errors.filter(e => e.file === file).length,
      percentage: 0, // computed after
      categories: Object.freeze({} as Record<ErrorCategory, number>),
      lines: Array.from(lines).sort((a, b) => a - b),
    }))
    .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));

  // Compute percentages and categories for files
  for (let i = 0; i < fileStats.length; i++) {
    const file = fileStats[i].file;
    const stat = fileStats[i];
    (stat as any).percentage = Math.round((stat.count / errors.length) * 100);

    const fileCategoryMap = new Map<ErrorCategory, number>();
    for (const error of errors.filter(e => e.file === file)) {
      fileCategoryMap.set(error.category, (fileCategoryMap.get(error.category) ?? 0) + 1);
    }
    (stat as any).categories = Object.freeze(
      Object.fromEntries(fileCategoryMap.entries()) as Record<ErrorCategory, number>
    );
  }

  // Build error type statistics (sorted by count descending)
  const errorTypeStats: ErrorTypeStatistics[] = Array.from(errorTypeMap.entries())
    .map(([type, messages]) => ({
      type,
      count: messages.length,
      percentage: 0, // computed after
      examples: Array.from(new Set(messages.slice(0, 3))),
    }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  // Compute percentages for error types
  for (let i = 0; i < errorTypeStats.length; i++) {
    const stat = errorTypeStats[i];
    (stat as any).percentage = Math.round((stat.count / errors.length) * 100);
  }

  // Top affected files (already sorted)
  const topAffectedFiles = fileStats.slice(0, 10);

  return Object.freeze({
    totalErrors: errors.length,
    totalWarnings: 0, // TS compiler doesn't distinguish in this context
    errorsByCategory: Object.freeze(categoryStats),
    errorsBySubsystem: Object.freeze(subsystemStats),
    errorsByFile: Object.freeze(fileStats),
    topErrorTypes: Object.freeze(errorTypeStats.slice(0, 10)),
    topAffectedFiles: Object.freeze(topAffectedFiles),
  });
}
