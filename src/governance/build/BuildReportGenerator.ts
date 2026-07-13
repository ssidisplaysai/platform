/**
 * BuildReportGenerator.ts
 *
 * Orchestrate the complete Genesis Build Report generation pipeline.
 *
 * Pipeline:
 * 1. Parse raw TypeScript compiler output
 * 2. Classify errors deterministically
 * 3. Compute error statistics
 * 4. Calculate repository health
 * 5. Generate deterministic checksum
 * 6. Create immutable build report
 */

import type { BuildSummary } from './BuildSummary';
import { createBuildSummary } from './BuildSummary';
import { ErrorClassifier } from './ErrorClassifier';
import { parseTypeScriptOutput, type ParseDiagnostic } from './TypeScriptErrorParser';
import { computeErrorStatistics } from './models/ErrorStatistics';
import { computeRepositoryHealth } from './models/RepositoryHealth';
import { deepFreeze } from './utils/deepFreeze';
import { computeChecksum, stripTimestamps } from './utils/checksum';

/**
 * Genesis Build Report Generator.
 *
 * Accepts raw TypeScript compiler output and produces a deterministic,
 * immutable canonical build report.
 */
export class BuildReportGenerator {
  private classifier: ErrorClassifier;

  constructor() {
    this.classifier = new ErrorClassifier();
  }

  /**
   * Generate a complete build report from compiler output.
   *
   * @param output - Raw TypeScript compiler output from `npx tsc --noEmit`
   * @param repositoryRoot - Path to repository root
   * @returns Deeply frozen, immutable BuildSummary
   */
  generate(output: string, repositoryRoot: string = '.'): BuildSummary {
    // Parse errors from output
    const parseResult = parseTypeScriptOutput(output, error =>
      this.classifier.classify(error)
    );

    const errors = parseResult.errors;
    const parseDiagnostics = parseResult.diagnostics;

    // Compute statistics
    const statistics = computeErrorStatistics(errors);

    // Compute health
    const health = computeRepositoryHealth(statistics);

    // Build diagnostic messages
    const diagnostics: string[] = parseDiagnostics.map(
      d => `${d.level.toUpperCase()}: ${d.message}`
    );

    // Create pre-checksum report (without timestamp)
    const preChecksumReport = {
      repositoryRoot: repositoryRoot.replace(/\\/g, '/'),
      health,
      errors,
      statistics,
      totalErrors: errors.length,
      compilerVersion: parseResult.compilerVersion,
      diagnostics: Object.freeze(diagnostics),
      summary: `Build Report: ${health.grade} (${health.score} points) - ${errors.length} error(s)`,
    };

    // Compute checksum on report without timestamps
    const reportToChecksum = stripTimestamps(preChecksumReport);
    const checksum = computeChecksum(reportToChecksum);

    // Create final report
    const report = createBuildSummary(
      repositoryRoot,
      health,
      errors,
      statistics,
      checksum,
      parseResult.compilerVersion,
      diagnostics
    );

    // Deep freeze everything
    return deepFreeze(report);
  }

  /**
   * Generate a build report from a TypeScript error file.
   *
   * Reads the file and generates the report.
   *
   * @param filePath - Path to file containing TypeScript errors
   * @param repositoryRoot - Repository root
   * @returns Build report
   */
  generateFromFile(filePath: string, repositoryRoot: string = '.'): BuildSummary {
    const fs = require('fs');
    const output = fs.readFileSync(filePath, 'utf-8');
    return this.generate(output, repositoryRoot);
  }
}

/**
 * Global report generator instance.
 */
export const globalReportGenerator = new BuildReportGenerator();
