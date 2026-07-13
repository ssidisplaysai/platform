/**
 * scorer.test.ts
 *
 * Tests for health scoring.
 */

import { computeRepositoryHealth, HealthGrade } from '../models/RepositoryHealth';
import { computeErrorStatistics } from '../models/ErrorStatistics';
import { createBuildError } from '../models/BuildError';
import { ErrorCategory, ErrorSeverity } from '../models/ErrorCategory';

describe('RepositoryHealthScorer', () => {
  describe('scoring', () => {
    it('returns perfect score for zero errors', () => {
      const stats = computeErrorStatistics([]);
      const health = computeRepositoryHealth(stats);

      expect(health.score).toBe(100);
      expect(health.grade).toBe(HealthGrade.A);
    });

    it('deducts points for errors', () => {
      const errors = [
        createBuildError(
          'TS2322',
          'Type mismatch',
          'src/app.ts',
          10,
          5,
          ErrorCategory.CORE,
          'core',
          ErrorSeverity.HIGH,
          'error TS2322: Type mismatch',
          'High severity'
        ),
      ];
      const stats = computeErrorStatistics(errors);
      const health = computeRepositoryHealth(stats);

      expect(health.score).toBeLessThan(100);
      expect(health.deductions).toHaveLength(1);
      expect(health.deductions[0].deduction).toBe(5); // HIGH = 5 points
    });

    it('applies correct severity weights', () => {
      const lowError = createBuildError('TS2322', 'msg', 'file.ts', 1, 1, ErrorCategory.TESTS, 'tests', ErrorSeverity.LOW, 'raw', 'reason');
      const mediumError = createBuildError('TS2322', 'msg', 'file.ts', 2, 1, ErrorCategory.CORE, 'core', ErrorSeverity.MEDIUM, 'raw', 'reason');
      const highError1 = createBuildError('TS2322', 'msg', 'file.ts', 3, 1, ErrorCategory.RUNTIME, 'runtime', ErrorSeverity.HIGH, 'raw', 'reason');
      const highError2 = createBuildError('TS2322', 'msg', 'file.ts', 4, 1, ErrorCategory.CONFIGURATION, 'config', ErrorSeverity.HIGH, 'raw', 'reason');

      const errors = [lowError, mediumError, highError1, highError2];
      const stats = computeErrorStatistics(errors);
      const health = computeRepositoryHealth(stats);

      // Score should be: 100 - (1 + 3 + 5 + 5) = 86
      expect(health.score).toBe(86);
    });

    it('grades correctly', () => {
      const testCases = [
        { score: 95, expected: HealthGrade.A },
        { score: 85, expected: HealthGrade.B },
        { score: 75, expected: HealthGrade.C },
        { score: 65, expected: HealthGrade.D },
        { score: 50, expected: HealthGrade.F },
      ];

      for (const testCase of testCases) {
        // Create enough errors to reach desired score
        const errorCount = 100 - testCase.score;
        const errors = [];
        for (let i = 0; i < errorCount; i++) {
          errors.push(
            createBuildError(
              `TS${2300 + i}`,
              'msg',
              'file.ts',
              i + 1,
              1,
              ErrorCategory.TESTS,
              'tests',
              ErrorSeverity.LOW,
              'raw',
              'reason'
            )
          );
        }

        const stats = computeErrorStatistics(errors);
        const health = computeRepositoryHealth(stats);
        expect(health.grade).toBe(testCase.expected);
      }
    });

    it('never produces negative score', () => {
      const errors = [];
      for (let i = 0; i < 50; i++) {
        errors.push(
          createBuildError(
            `TS${2300 + i}`,
            'msg',
            'file.ts',
            i + 1,
            1,
            ErrorCategory.CORE,
            'core',
            ErrorSeverity.HIGH,
            'raw',
            'reason'
          )
        );
      }

      const stats = computeErrorStatistics(errors);
      const health = computeRepositoryHealth(stats);

      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.grade).toBe(HealthGrade.F);
    });

    it('produces deterministic results', () => {
      const errors = [
        createBuildError('TS2322', 'Type mismatch', 'src/app.ts', 10, 5, ErrorCategory.CORE, 'core', ErrorSeverity.HIGH, 'raw1', 'reason1'),
        createBuildError('TS2307', 'Cannot find module', 'src/main.ts', 20, 1, ErrorCategory.COMPILER, 'compiler', ErrorSeverity.MEDIUM, 'raw2', 'reason2'),
      ];

      const stats = computeErrorStatistics(errors);
      const health1 = computeRepositoryHealth(stats);
      const health2 = computeRepositoryHealth(stats);

      expect(health1.score).toBe(health2.score);
      expect(health1.grade).toBe(health2.grade);
      expect(health1.totalDeduction).toBe(health2.totalDeduction);
    });

    it('sorts deductions deterministically', () => {
      const errors = [
        createBuildError('TS2322', 'msg', 'file1.ts', 1, 1, ErrorCategory.TESTS, 'tests', ErrorSeverity.LOW, 'raw', 'reason'),
        createBuildError('TS2322', 'msg', 'file2.ts', 1, 1, ErrorCategory.CORE, 'core', ErrorSeverity.HIGH, 'raw', 'reason'),
        createBuildError('TS2322', 'msg', 'file3.ts', 1, 1, ErrorCategory.CORE, 'core', ErrorSeverity.MEDIUM, 'raw', 'reason'),
      ];

      const stats = computeErrorStatistics(errors);
      const health = computeRepositoryHealth(stats);

      // Should be sorted by deduction amount descending
      expect(health.deductions[0].severity).toBe(ErrorSeverity.HIGH); // 5 points
      expect(health.deductions[1].severity).toBe(ErrorSeverity.MEDIUM); // 3 points
      expect(health.deductions[2].severity).toBe(ErrorSeverity.LOW); // 1 point
    });

    it('generates meaningful summary', () => {
      const errors = [
        createBuildError('TS2322', 'msg', 'src/app.ts', 1, 1, ErrorCategory.CORE, 'core', ErrorSeverity.HIGH, 'raw', 'reason'),
      ];

      const stats = computeErrorStatistics(errors);
      const health = computeRepositoryHealth(stats);

      expect(health.summary).toContain(health.grade);
      expect(health.summary).toContain(health.score.toString());
      expect(health.summary).toContain('error(s)');
    });

    it('is frozen/immutable', () => {
      const stats = computeErrorStatistics([]);
      const health = computeRepositoryHealth(stats);

      expect(Object.isFrozen(health)).toBe(true);
      expect(Object.isFrozen(health.deductions)).toBe(true);
    });
  });
});
