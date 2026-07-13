/**
 * build-report.test.ts
 *
 * Comprehensive tests for the Genesis Build Report.
 */

import { BuildReportGenerator } from '../BuildReportGenerator';
import { assertFrozen, deepFreeze } from '../utils/deepFreeze';
import { computeChecksum, verifyChecksum } from '../utils/checksum';
import { HealthGrade } from '../models/RepositoryHealth';

describe('BuildReportGenerator', () => {
  const generator = new BuildReportGenerator();

  describe('generation', () => {
    it('generates report from empty output', () => {
      const report = generator.generate('', 'test-repo');

      expect(report).toBeDefined();
      expect(report.errors).toHaveLength(0);
      expect(report.totalErrors).toBe(0);
      expect(report.health.score).toBe(100);
      expect(report.health.grade).toBe(HealthGrade.A);
    });

    it('generates report from compiler output', () => {
      const output = `src/app.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/main.ts(20,1): error TS2307: Cannot find module 'react'.`;
      const report = generator.generate(output, 'test-repo');

      expect(report.errors).toHaveLength(2);
      expect(report.totalErrors).toBe(2);
      expect(report.health.score).toBeLessThan(100);
    });

    it('includes repository root in report', () => {
      const report = generator.generate('', '/path/to/repo');

      expect(report.repositoryRoot).toBe('/path/to/repo');
    });

    it('normalizes Windows paths', () => {
      const report = generator.generate('', 'C:\\Users\\test\\repo');

      expect(report.repositoryRoot).not.toContain('\\');
      expect(report.repositoryRoot).toContain('/');
    });

    it('classifies errors', () => {
      const output = `src/discovery/parser.ts(10,5): error TS2322: Type error.`;
      const report = generator.generate(output, 'test-repo');

      expect(report.errors[0].category).toBe('DISCOVERY');
    });

    it('includes statistics', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.
src/main.ts(20,1): error TS2307: Module error.`;
      const report = generator.generate(output, 'test-repo');

      expect(report.statistics).toBeDefined();
      expect(report.statistics.totalErrors).toBe(2);
      expect(report.statistics.errorsByFile).toBeDefined();
      expect(report.statistics.errorsByCategory).toBeDefined();
    });

    it('includes health assessment', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;
      const report = generator.generate(output, 'test-repo');

      expect(report.health).toBeDefined();
      expect(report.health.score).toBeDefined();
      expect(report.health.grade).toBeDefined();
      expect(report.health.deductions).toBeDefined();
    });

    it('includes deterministic checksum', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;
      const report = generator.generate(output, 'test-repo');

      expect(report.checksum).toBeDefined();
      expect(report.checksum).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    });

    it('includes generation timestamp', () => {
      const report = generator.generate('', 'test-repo');

      expect(report.generatedAt).toBeDefined();
      expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    });

    it('includes summary text', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;
      const report = generator.generate(output, 'test-repo');

      expect(report.summary).toBeDefined();
      expect(report.summary).toContain(report.health.grade);
      expect(report.summary).toContain(report.totalErrors.toString());
    });

    it('includes diagnostic messages', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.
invalid malformed line
src/main.ts(20,1): error TS2307: Module error.`;
      const report = generator.generate(output, 'test-repo');

      expect(report.diagnostics.length).toBeGreaterThan(0);
    });
  });

  describe('determinism', () => {
    it('produces identical reports from identical input', () => {
      const output = `src/app.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/main.ts(20,1): error TS2307: Cannot find module 'react'.`;

      const report1 = generator.generate(output, 'test-repo');
      const report2 = generator.generate(output, 'test-repo');

      // Check critical fields
      expect(report1.totalErrors).toBe(report2.totalErrors);
      expect(report1.health.score).toBe(report2.health.score);
      expect(report1.health.grade).toBe(report2.health.grade);
      expect(report1.checksum).toBe(report2.checksum);
    });

    it('produces identical checksums from identical input', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;

      const report1 = generator.generate(output, 'test-repo');
      const report2 = generator.generate(output, 'test-repo');

      expect(report1.checksum).toBe(report2.checksum);
    });

    it('produces different checksums from different error counts', () => {
      const output1 = `src/app.ts(10,5): error TS2322: Type error.`;
      const output2 = `src/app.ts(10,5): error TS2322: Type error.
src/main.ts(20,1): error TS2307: Different error.`;

      const report1 = generator.generate(output1, 'test-repo');
      const report2 = generator.generate(output2, 'test-repo');

      expect(report1.checksum).not.toBe(report2.checksum);
    });

    it('produces stable ordering for errors', () => {
      const output = `src/z.ts(30,1): error TS2307: Module error.
src/a.ts(10,5): error TS2322: Type error.
src/m.ts(20,1): error TS2322: Type error.`;

      const report = generator.generate(output, 'test-repo');

      expect(report.errors[0].file).toBe('src/a.ts');
      expect(report.errors[1].file).toBe('src/m.ts');
      expect(report.errors[2].file).toBe('src/z.ts');
    });

    it('produces stable statistics', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.
src/app.ts(20,1): error TS2307: Module error.
src/main.ts(5,1): error TS2322: Type error.`;

      const report = generator.generate(output, 'test-repo');

      const appFileStats = report.statistics.topAffectedFiles.find(f => f.file === 'src/app.ts');
      expect(appFileStats?.count).toBe(2);

      const mainFileStats = report.statistics.topAffectedFiles.find(f => f.file === 'src/main.ts');
      expect(mainFileStats?.count).toBe(1);
    });
  });

  describe('immutability', () => {
    it('returns frozen report', () => {
      const report = generator.generate('', 'test-repo');

      expect(Object.isFrozen(report)).toBe(true);
    });

    it('report cannot be mutated', () => {
      const report = generator.generate('', 'test-repo');

      expect(() => {
        (report as any).totalErrors = 999;
      }).toThrow();
    });

    it('nested arrays are frozen', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;
      const report = generator.generate(output, 'test-repo');

      expect(Object.isFrozen(report.errors)).toBe(true);
      expect(Object.isFrozen(report.statistics.errorsByCategory)).toBe(true);
    });

    it('nested objects are frozen', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;
      const report = generator.generate(output, 'test-repo');

      expect(Object.isFrozen(report.health)).toBe(true);
      expect(Object.isFrozen(report.statistics)).toBe(true);
    });

    it('cannot push to errors array', () => {
      const report = generator.generate('', 'test-repo');

      expect(() => {
        (report.errors as any).push({ code: 'TS2322' });
      }).toThrow();
    });

    it('error objects are frozen', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;
      const report = generator.generate(output, 'test-repo');

      expect(Object.isFrozen(report.errors[0])).toBe(true);
      expect(Object.isFrozen(report.errors)).toBe(true);
    });
  });

  describe('checksum validation', () => {
    it('generates valid checksum', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;
      const report = generator.generate(output, 'test-repo');

      const reportCopy = { ...report };
      delete (reportCopy as any).checksum;
      delete (reportCopy as any).generatedAt; // timestamps excluded

      const expectedChecksum = computeChecksum(reportCopy);
      expect(report.checksum).toBe(expectedChecksum);
    });

    it('checksum verifies correctly', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;
      const report = generator.generate(output, 'test-repo');

      const reportCopy = { ...report };
      delete (reportCopy as any).generatedAt;

      expect(verifyChecksum(reportCopy, report.checksum)).toBe(true);
    });

    it('checksum fails for modified report', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;
      const report = generator.generate(output, 'test-repo');

      const reportCopy = { ...report, totalErrors: 999 };
      delete (reportCopy as any).generatedAt;

      expect(verifyChecksum(reportCopy, report.checksum)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles very large error lists', () => {
      const lines = [];
      for (let i = 0; i < 1000; i++) {
        lines.push(`src/file${i}.ts(${i + 1},1): error TS2322: Type error ${i}.`);
      }
      const output = lines.join('\n');

      const report = generator.generate(output, 'test-repo');

      expect(report.errors).toHaveLength(1000);
      expect(report.totalErrors).toBe(1000);
    });

    it('handles mixed error codes', () => {
      const output = `src/a.ts(1,1): error TS2307: Module.
src/b.ts(2,1): error TS2322: Type.
src/c.ts(3,1): error TS6133: Unused.
src/d.ts(4,1): error TS7006: Any.`;

      const report = generator.generate(output, 'test-repo');

      expect(report.errors).toHaveLength(4);
      expect(new Set(report.errors.map(e => e.code)).size).toBe(4);
    });

    it('handles errors at same location', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error 1.
src/app.ts(10,5): error TS2307: Type error 2.`;

      const report = generator.generate(output, 'test-repo');

      expect(report.errors).toHaveLength(2);
      expect(report.errors[0].file).toBe(report.errors[1].file);
      expect(report.errors[0].line).toBe(report.errors[1].line);
    });

    it('handles errors with special characters in message', () => {
      const output = `src/app.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.`;

      const report = generator.generate(output, 'test-repo');

      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].message).toContain("'string'");
    });

    it('handles errors with very long file paths', () => {
      const longPath = 'src/' + 'deeply/'.repeat(20) + 'file.ts';
      const output = `${longPath}(10,5): error TS2322: Type error.`;

      const report = generator.generate(output, 'test-repo');

      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].file).toBe(longPath);
    });
  });

  describe('compiler version', () => {
    it('extracts compiler version if present', () => {
      const output = `Version 5.1.6
src/app.ts(10,5): error TS2322: Type error.`;

      const report = generator.generate(output, 'test-repo');

      expect(report.compilerVersion).toBe('5.1.6');
    });

    it('handles missing compiler version', () => {
      const output = `src/app.ts(10,5): error TS2322: Type error.`;

      const report = generator.generate(output, 'test-repo');

      expect(report.compilerVersion).toBeUndefined();
    });
  });
});
