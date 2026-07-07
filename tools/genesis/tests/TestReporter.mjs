/**
 * TestReporter
 * 
 * Formats and outputs test results.
 * Provides:
 * - Console formatting
 * - Summary statistics
 * - Detailed reporting
 * - JSON output
 */
export class TestReporter {
  constructor() {
    this.suites = [];
    this.totalDuration = 0;
  }

  /**
   * Add suite results
   */
  addSuite(suite) {
    this.suites.push(suite);
  }

  /**
   * Report all results to console
   */
  reportToConsole() {
    this.printHeader();
    this.printSuites();
    this.printSummary();
  }

  /**
   * Print header
   */
  printHeader() {
    console.log('\n╔════════════════════════════════════════════════════╗');
    console.log('║        GENESIS AUTOMATED TEST FRAMEWORK            ║');
    console.log('║           Verification & Quality Assurance         ║');
    console.log('╚════════════════════════════════════════════════════╝\n');
  }

  /**
   * Print suite results
   */
  printSuites() {
    for (const suite of this.suites) {
      this.printSuite(suite);
    }
  }

  /**
   * Print individual suite
   */
  printSuite(suite) {
    const icon = suite.isPassed() ? '✓' : '✗';
    const color = suite.isPassed() ? '\x1b[32m' : '\x1b[31m';  // Green or Red
    const reset = '\x1b[0m';

    console.log(`${color}${icon} ${suite.name}${reset}`);
    
    if (suite.description) {
      console.log(`  ${suite.description}`);
    }

    // Print test results
    for (const test of suite.testCases) {
      if (test.isPassed()) {
        console.log(`  \x1b[32m✓\x1b[0m ${test.name} (\`${test.duration}ms)`);
      } else {
        console.log(`  \x1b[31m✗\x1b[0m ${test.name}`);
        console.log(`     Error: ${test.error}`);
      }
    }

    console.log(`  ${suite.getPassedCount()}/${suite.getTotalCount()} passed\n`);
  }

  /**
   * Print summary statistics
   */
  printSummary() {
    const totalTests = this.suites.reduce((sum, s) => sum + s.getTotalCount(), 0);
    const totalPassed = this.suites.reduce((sum, s) => sum + s.getPassedCount(), 0);
    const totalFailed = this.suites.reduce((sum, s) => sum + s.getFailedCount(), 0);
    const totalDuration = this.suites.reduce((sum, s) => sum + s.duration, 0);
    const allPassed = totalFailed === 0;

    console.log('═══════════════════════════════════════════════════');
    console.log('\n📊 TEST SUMMARY\n');

    console.log(`  Test Suites: ${this.suites.length}`);
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  ${allPassed ? '\x1b[32m' : '\x1b[31m'}Passed: ${totalPassed}\x1b[0m`);
    console.log(`  ${totalFailed > 0 ? '\x1b[31m' : '\x1b[32m'}Failed: ${totalFailed}\x1b[0m`);
    console.log(`  Duration: ${totalDuration}ms\n`);

    if (allPassed) {
      console.log('\x1b[32m✓ ALL TESTS PASSED\x1b[0m\n');
    } else {
      console.log('\x1b[31m✗ SOME TESTS FAILED\x1b[0m\n');
    }

    console.log('═══════════════════════════════════════════════════\n');

    return allPassed ? 0 : 1;  // Exit code
  }

  /**
   * Get test results as JSON
   */
  toJSON() {
    return {
      timestamp: new Date().toISOString(),
      suites: this.suites.map(s => s.toJSON()),
      summary: {
        totalSuites: this.suites.length,
        totalTests: this.suites.reduce((sum, s) => sum + s.getTotalCount(), 0),
        totalPassed: this.suites.reduce((sum, s) => sum + s.getPassedCount(), 0),
        totalFailed: this.suites.reduce((sum, s) => sum + s.getFailedCount(), 0),
        totalDuration: this.suites.reduce((sum, s) => sum + s.duration, 0),
        allPassed: this.suites.every(s => s.isPassed())
      }
    };
  }

  /**
   * Export results to JSON file
   */
  async exportJSON(filePath) {
    const fs = await import('fs');
    fs.writeFileSync(filePath, JSON.stringify(this.toJSON(), null, 2));
    console.log(`Test results exported to: ${filePath}`);
  }
}
