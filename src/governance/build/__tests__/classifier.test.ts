/**
 * classifier.test.ts
 *
 * Tests for error classification.
 */

import { ErrorClassifier } from '../ErrorClassifier';
import { ErrorCategory, ErrorSeverity } from '../models/ErrorCategory';

describe('ErrorClassifier', () => {
  const classifier = new ErrorClassifier();

  describe('classification', () => {
    it('classifies generated code errors', () => {
      const result = classifier.classify({
        file: '.next/types/app.ts',
        code: 'TS2307',
        message: 'Cannot find module',
        subsystem: 'generated',
      });

      expect(result.category).toBe(ErrorCategory.GENERATED_CODE);
      expect(result.severity).toBe(ErrorSeverity.LOW);
    });

    it('classifies discovery subsystem errors', () => {
      const result = classifier.classify({
        file: 'src/discovery/parser.ts',
        code: 'TS2322',
        message: 'Type mismatch',
        subsystem: 'discovery',
      });

      expect(result.category).toBe(ErrorCategory.DISCOVERY);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('classifies repository compiler errors', () => {
      const result = classifier.classify({
        file: 'src/developer/analyzer/RepositoryCompiler.ts',
        code: 'TS2322',
        message: 'Type mismatch',
        subsystem: 'developer',
      });

      expect(result.category).toBe(ErrorCategory.REPOSITORY_COMPILER);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('classifies core domain errors', () => {
      const result = classifier.classify({
        file: 'src/core/runtime/Engine.ts',
        code: 'TS2322',
        message: 'Type mismatch',
        subsystem: 'core',
      });

      expect(result.category).toBe(ErrorCategory.RUNTIME);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
    });

    it('classifies test errors', () => {
      const result = classifier.classify({
        file: 'src/utils/__tests__/helper.test.ts',
        code: 'TS2322',
        message: 'Type mismatch',
        subsystem: 'utils',
      });

      expect(result.category).toBe(ErrorCategory.TESTS);
      expect(result.severity).toBe(ErrorSeverity.LOW);
    });

    it('classifies configuration errors', () => {
      const result = classifier.classify({
        file: 'tsconfig.json',
        code: 'TS5107',
        message: 'Configuration error',
        subsystem: 'root',
      });

      expect(result.category).toBe(ErrorCategory.CONFIGURATION);
      expect(result.severity).toBe(ErrorSeverity.HIGH);
    });

    it('defaults to COMPILER for unknown patterns', () => {
      const result = classifier.classify({
        file: 'unknown/file.ts',
        code: 'TS2322',
        message: 'Type mismatch',
        subsystem: 'unknown',
      });

      expect(result.category).toBe(ErrorCategory.COMPILER);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('handles empty file path', () => {
      const result = classifier.classify({
        file: '',
        code: 'TS2307',
        message: 'Cannot find module',
      });

      expect(result.category).toBe(ErrorCategory.COMPILER);
    });

    it('handles missing properties', () => {
      const result = classifier.classify({});

      expect(result.category).toBe(ErrorCategory.COMPILER);
      expect(result.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('provides classification reason', () => {
      const result = classifier.classify({
        file: 'src/discovery/parser.ts',
        code: 'TS2322',
        message: 'Type mismatch',
        subsystem: 'discovery',
      });

      expect(result.reason).toContain('File path matches pattern');
      expect(result.reason).toContain('discovery');
    });

    it('classifies dist/ as generated', () => {
      const result = classifier.classify({
        file: 'dist/index.js.d.ts',
        code: 'TS2307',
        message: 'Cannot find module',
      });

      expect(result.category).toBe(ErrorCategory.GENERATED_CODE);
    });

    it('classifies build/ as generated', () => {
      const result = classifier.classify({
        file: 'build/out.d.ts',
        code: 'TS2307',
        message: 'Cannot find module',
      });

      expect(result.category).toBe(ErrorCategory.GENERATED_CODE);
    });

    it('classifies apollo subsystem', () => {
      const result = classifier.classify({
        file: 'src/apollo/client.ts',
        code: 'TS2322',
        message: 'Type mismatch',
      });

      expect(result.category).toBe(ErrorCategory.APOLLO);
    });

    it('is deterministic', () => {
      const error = {
        file: 'src/discovery/parser.ts',
        code: 'TS2322',
        message: 'Type mismatch',
        subsystem: 'discovery',
      };

      const result1 = classifier.classify(error);
      const result2 = classifier.classify(error);

      expect(result1.category).toBe(result2.category);
      expect(result1.severity).toBe(result2.severity);
      expect(result1.reason).toBe(result2.reason);
    });

    it('handles .spec.ts test files', () => {
      const result = classifier.classify({
        file: 'src/utils/helper.spec.ts',
        code: 'TS2322',
        message: 'Type mismatch',
      });

      expect(result.category).toBe(ErrorCategory.TESTS);
    });
  });
});
