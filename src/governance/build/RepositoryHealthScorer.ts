/**
 * RepositoryHealthScorer.ts
 *
 * Calculate repository health scores deterministically.
 *
 * This module imports the health computation logic and exposes
 * a scorer interface.
 */

import { computeRepositoryHealth, type RepositoryHealth } from './models/RepositoryHealth';
import type { ErrorStatistics } from './models/ErrorStatistics';

/**
 * Repository health scorer.
 *
 * Computes health scores from error statistics deterministically.
 */
export class RepositoryHealthScorer {
  /**
   * Score a repository based on error statistics.
   *
   * @param stats - Error statistics from parsed errors
   * @returns Health assessment with score, grade, and deductions
   */
  score(stats: ErrorStatistics): RepositoryHealth {
    return computeRepositoryHealth(stats);
  }
}

/**
 * Global scorer instance.
 */
export const globalHealthScorer = new RepositoryHealthScorer();
