/**
 * RepositoryHealth.ts
 *
 * Repository health score and grade calculation.
 *
 * The health score is computed deterministically from error statistics
 * using a weighted scoring algorithm.
 */

import type { ErrorStatistics } from './ErrorStatistics';
import { ErrorSeverity } from './ErrorCategory';

/**
 * Health grade representing repository quality.
 */
export enum HealthGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  D = 'D',
  F = 'F',
}

/**
 * Repository health summary.
 */
export interface RepositoryHealth {
  readonly score: number;
  readonly grade: HealthGrade;
  readonly stats: ErrorStatistics;
  readonly deductions: readonly HealthDeduction[];
  readonly totalDeduction: number;
  readonly summary: string;
}

/**
 * Individual health score deduction.
 */
export interface HealthDeduction {
  readonly category: string;
  readonly count: number;
  readonly severity: ErrorSeverity;
  readonly deduction: number;
  readonly reason: string;
}

/**
 * Severity weight mapping for health scoring.
 *
 * Higher weights mean more severe impact on health score.
 */
const SEVERITY_WEIGHTS: Readonly<Record<ErrorSeverity, number>> = {
  [ErrorSeverity.LOW]: 1,
  [ErrorSeverity.MEDIUM]: 3,
  [ErrorSeverity.HIGH]: 5,
};

/**
 * Compute repository health from error statistics.
 *
 * Algorithm:
 * 1. Start with score of 100
 * 2. For each error, apply weighted deduction based on severity
 * 3. Ensure score never goes below 0
 * 4. Map score to grade
 *
 * This algorithm is deterministic and documented:
 * - Identical input always produces identical output
 * - No randomness or timestamps
 * - Repeated runs are consistent
 *
 * @param stats - Error statistics
 * @returns Health assessment
 */
export function computeRepositoryHealth(stats: ErrorStatistics): RepositoryHealth {
  const deductions: HealthDeduction[] = [];
  let totalDeduction = 0;

  // Apply deductions for each error
  for (const categoryStats of stats.errorsByCategory) {
    for (const [severity, count] of Object.entries(categoryStats.severities)) {
      if (count > 0) {
        const weight = SEVERITY_WEIGHTS[severity as ErrorSeverity];
        const deduction = weight * count;

        deductions.push({
          category: categoryStats.category,
          count,
          severity: severity as ErrorSeverity,
          deduction,
          reason: `${count} ${severity.toLowerCase()} ${categoryStats.category} error(s)`,
        });

        totalDeduction += deduction;
      }
    }
  }

  // Sort deductions deterministically (by deduction amount desc, then category)
  deductions.sort((a, b) => b.deduction - a.deduction || a.category.localeCompare(b.category));

  // Calculate final score (never negative)
  const score = Math.max(0, 100 - totalDeduction);

  // Map score to grade
  const grade = mapScoreToGrade(score);

  // Build summary
  const summary = buildHealthSummary(score, grade, stats);

  return Object.freeze({
    score,
    grade,
    stats,
    deductions: Object.freeze(deductions),
    totalDeduction,
    summary,
  });
}

/**
 * Map numeric health score to letter grade.
 *
 * @param score - Numeric score (0-100)
 * @returns Letter grade
 */
function mapScoreToGrade(score: number): HealthGrade {
  if (score >= 90) return HealthGrade.A;
  if (score >= 80) return HealthGrade.B;
  if (score >= 70) return HealthGrade.C;
  if (score >= 60) return HealthGrade.D;
  return HealthGrade.F;
}

/**
 * Build human-readable health summary.
 *
 * @param score - Numeric score
 * @param grade - Letter grade
 * @param stats - Error statistics
 * @returns Summary string
 */
function buildHealthSummary(score: number, grade: HealthGrade, stats: ErrorStatistics): string {
  const errors = stats.totalErrors;

  if (errors === 0) {
    return `Grade ${grade}: Perfect health (${score} points). No errors detected.`;
  }

  const topCategory = stats.errorsByCategory[0];
  const topFile = stats.topAffectedFiles[0];

  let summary = `Grade ${grade}: ${score} points. Found ${errors} error(s). `;

  if (topCategory) {
    summary += `Most common: ${topCategory.category} (${topCategory.count}). `;
  }

  if (topFile) {
    summary += `Top affected: ${topFile.file} (${topFile.count} error(s)).`;
  }

  return summary;
}
