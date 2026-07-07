/**
 * TestCase
 * 
 * Represents a single test case with:
 * - name: Test case name
 * - testFn: Async test function
 * - result: passed/failed status
 * - error: Error details if failed
 * - duration: Execution time in ms
 */
export class TestCase {
  constructor(name, testFn, suiteName) {
    this.name = name;
    this.testFn = testFn;
    this.suiteName = suiteName;
    this.result = null;  // null, 'passed', 'failed'
    this.error = null;
    this.duration = 0;
  }

  /**
   * Run the test case
   */
  async run() {
    const startTime = Date.now();
    
    try {
      // Run test function
      await this.testFn();
      
      this.result = 'passed';
      this.error = null;
    } catch (err) {
      this.result = 'failed';
      this.error = err.message || String(err);
    }
    
    this.duration = Date.now() - startTime;
    return this.result === 'passed';
  }

  /**
   * Get formatted result
   */
  getResult() {
    if (this.result === 'passed') {
      return `✓ ${this.name}`;
    } else {
      return `✗ ${this.name}\n    Error: ${this.error}`;
    }
  }

  /**
   * Check if test passed
   */
  isPassed() {
    return this.result === 'passed';
  }

  /**
   * Check if test failed
   */
  isFailed() {
    return this.result === 'failed';
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      name: this.name,
      suite: this.suiteName,
      result: this.result,
      error: this.error,
      duration: this.duration
    };
  }
}
