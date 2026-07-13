/**
 * error-parser.test.ts
 *
 * Tests for TypeScript error parsing.
 */

import { parseTypeScriptOutput, extractCompilerVersion } from '../TypeScriptErrorParser';
import { ErrorCategory, ErrorSeverity } from '../models/ErrorCategory';

describe('TypeScriptErrorParser', () => {
  const mockClassify = (error: any) => ({
    category: ErrorCategory.CORE,
    severity: ErrorSeverity.HIGH,
    reason: 'test classification',
  });

  describe('parseTypeScriptOutput', () => {
    it('parses a single error line', () => {
      const output = 'src/app.ts(10,5): error TS2322: Type \'string\' is not assignable to type \'number\'.';
      const result = parseTypeScriptOutput(output, mockClassify);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatchObject({
        code: 'TS2322',
        message: 'Type \'string\' is not assignable to type \'number\'.',
        file: 'src/app.ts',
        line: 10,
        column: 5,
      });
    });

    it('parses multiple error lines', () => {
      const output = `src/app.ts(10,5): error TS2322: Type 'string' is not assignable.
src/main.ts(20,1): error TS2307: Cannot find module 'react'.`;
      const result = parseTypeScriptOutput(output, mockClassify);

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].file).toBe('src/app.ts');
      expect(result.errors[1].file).toBe('src/main.ts');
    });

    it('sorts errors deterministically by file, line, column', () => {
      const output = `src/b.ts(5,1): error TS2322: Error 1
src/a.ts(10,5): error TS2322: Error 2
src/a.ts(5,5): error TS2322: Error 3`;
      const result = parseTypeScriptOutput(output, mockClassify);

      expect(result.errors[0].file).toBe('src/a.ts');
      expect(result.errors[0].line).toBe(5);
      expect(result.errors[1].file).toBe('src/a.ts');
      expect(result.errors[1].line).toBe(10);
      expect(result.errors[2].file).toBe('src/b.ts');
    });

    it('skips empty lines', () => {
      const output = `src/app.ts(10,5): error TS2322: Type 'string' is not assignable.

src/main.ts(20,1): error TS2307: Cannot find module 'react'.`;
      const result = parseTypeScriptOutput(output, mockClassify);

      expect(result.errors).toHaveLength(2);
    });

    it('handles malformed lines gracefully', () => {
      const output = `src/app.ts(10,5): error TS2322: Type 'string' is not assignable.
invalid line that doesn't match pattern
src/main.ts(20,1): error TS2307: Cannot find module 'react'.`;
      const result = parseTypeScriptOutput(output, mockClassify);

      expect(result.errors).toHaveLength(2);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].level).toBe('warning');
    });

    it('handles invalid line/column numbers', () => {
      const output = `src/app.ts(abc,xyz): error TS2322: Type 'string' is not assignable.
src/main.ts(20,1): error TS2307: Cannot find module 'react'.`;
      const result = parseTypeScriptOutput(output, mockClassify);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file).toBe('src/main.ts');
      expect(result.diagnostics).toHaveLength(1);
    });

    it('handles empty input', () => {
      const output = '';
      const result = parseTypeScriptOutput(output, mockClassify);

      expect(result.errors).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(0);
    });

    it('handles warnings', () => {
      const output = 'src/app.ts(10,5): warning TS6133: Variable is declared but never used.';
      const result = parseTypeScriptOutput(output, mockClassify);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe('TS6133');
    });

    it('extracts subsystem from file path', () => {
      const output = 'src/discovery/parser.ts(10,5): error TS2322: Type error.';
      const result = parseTypeScriptOutput(output, mockClassify);

      expect(result.errors[0].subsystem).toBe('discovery');
    });

    it('handles files with multiple dots', () => {
      const output = 'src/utils/helper.service.ts(10,5): error TS2322: Type error.';
      const result = parseTypeScriptOutput(output, mockClassify);

      expect(result.errors[0].file).toBe('src/utils/helper.service.ts');
    });

    it('handles Windows path separators', () => {
      const output = 'src\\app\\main.ts(10,5): error TS2322: Type error.';
      const result = parseTypeScriptOutput(output, mockClassify);

      // Paths from TypeScript are forward-slash normalized by most versions
      expect(result.errors[0].file).toContain('main.ts');
    });
  });

  describe('extractCompilerVersion', () => {
    it('extracts version from output', () => {
      const output = 'Version 5.1.6';
      const version = extractCompilerVersion(output);

      expect(version).toBe('5.1.6');
    });

    it('handles version with prerelease tag', () => {
      const output = 'Version 5.2.0-beta';
      const version = extractCompilerVersion(output);

      expect(version).toBe('5.2.0-beta');
    });

    it('returns undefined if version not found', () => {
      const output = 'No version info';
      const version = extractCompilerVersion(output);

      expect(version).toBeUndefined();
    });

    it('handles lowercase version', () => {
      const output = 'version 4.9.5';
      const version = extractCompilerVersion(output);

      expect(version).toBe('4.9.5');
    });
  });
});
