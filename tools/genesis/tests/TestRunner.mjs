import { TestReporter } from './TestReporter.mjs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * TestRunner
 * 
 * Main orchestrator for running all test suites.
 * 
 * Features:
 * - Load test suites dynamically from suites/ directory
 * - Execute suites sequentially
 * - Collect results and report
 * - Support CLI options for filtering/reporting
 */
export class TestRunner {
  constructor(options = {}) {
    this.options = options;
    this.suites = [];
    this.reporter = new TestReporter();
    this.startTime = null;
    this.endTime = null;
  }

  /**
   * Load all test suites from suites/ directory
   */
  async loadSuites() {
    const suitesDir = join(__dirname, 'suites');
    const files = readdirSync(suitesDir).filter(f => f.endsWith('.mjs'));

    for (const file of files) {
      try {
        const modulePath = join(suitesDir, file);
        const moduleURL = pathToFileURL(modulePath).href;
        const module = await import(moduleURL);
        
        // Expect each module to export a function that returns a TestSuite
        if (module.default && typeof module.default === 'function') {
          const suite = await module.default();
          this.suites.push(suite);
        }
      } catch (err) {
        console.error(`Failed to load test suite ${file}: ${err.message}`);
      }
    }

    // Sort by name for consistent ordering
    this.suites.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Run all test suites
   */
  async run() {
    this.startTime = Date.now();

    // Load suites
    await this.loadSuites();

    if (this.suites.length === 0) {
      console.error('No test suites found!');
      return 1;
    }

    // Run each suite
    for (const suite of this.suites) {
      await suite.run();
      this.reporter.addSuite(suite);
    }

    this.endTime = Date.now();

    // Report results
    this.reporter.totalDuration = this.endTime - this.startTime;
    this.reporter.reportToConsole();

    // Return exit code
    const allPassed = this.suites.every(s => s.isPassed());
    return allPassed ? 0 : 1;
  }

  /**
   * Get suite by name
   */
  getSuite(name) {
    return this.suites.find(s => s.name === name);
  }

  /**
   * Get test results as JSON
   */
  toJSON() {
    return this.reporter.toJSON();
  }

  /**
   * Get total test count
   */
  getTotalTests() {
    return this.suites.reduce((sum, s) => sum + s.getTotalCount(), 0);
  }

  /**
   * Get passed test count
   */
  getPassedTests() {
    return this.suites.reduce((sum, s) => sum + s.getPassedCount(), 0);
  }

  /**
   * Get failed test count
   */
  getFailedTests() {
    return this.suites.reduce((sum, s) => sum + s.getFailedCount(), 0);
  }
}

/**
 * Run tests from CLI
 */
export async function runTests() {
  const runner = new TestRunner();
  const exitCode = await runner.run();
  process.exit(exitCode);
}
