import { TestCase } from './TestCase.mjs';

/**
 * TestSuite
 * 
 * Base class for all test suites.
 * Manages a collection of related test cases.
 */
export class TestSuite {
  constructor(name, description = '') {
    this.name = name;
    this.description = description;
    this.testCases = [];
    this.result = null;  // null, 'passed', 'failed'
    this.duration = 0;
  }

  /**
   * Add a test case
   */
  addTest(testName, testFn) {
    const testCase = new TestCase(testName, testFn, this.name);
    this.testCases.push(testCase);
    return testCase;
  }

  /**
   * Add setup hook (runs before all tests)
   */
  beforeAll(fn) {
    this.beforeAllFn = fn;
  }

  /**
   * Add teardown hook (runs after all tests)
   */
  afterAll(fn) {
    this.afterAllFn = fn;
  }

  /**
   * Add before-each hook
   */
  beforeEach(fn) {
    this.beforeEachFn = fn;
  }

  /**
   * Add after-each hook
   */
  afterEach(fn) {
    this.afterEachFn = fn;
  }

  /**
   * Run all test cases in this suite
   */
  async run() {
    const startTime = Date.now();
    
    try {
      // Run setup hook
      if (this.beforeAllFn) {
        await this.beforeAllFn();
      }

      // Run each test case
      for (const testCase of this.testCases) {
        // Run before-each hook
        if (this.beforeEachFn) {
          await this.beforeEachFn();
        }

        // Run test
        await testCase.run();

        // Run after-each hook
        if (this.afterEachFn) {
          await this.afterEachFn();
        }
      }

      // Run teardown hook
      if (this.afterAllFn) {
        await this.afterAllFn();
      }

      // Determine suite result
      const hasFailures = this.testCases.some(t => t.isFailed());
      this.result = hasFailures ? 'failed' : 'passed';
    } catch (err) {
      this.result = 'failed';
      console.error(`Suite error in ${this.name}: ${err.message}`);
    }

    this.duration = Date.now() - startTime;
    return this.result === 'passed';
  }

  /**
   * Get passed test count
   */
  getPassedCount() {
    return this.testCases.filter(t => t.isPassed()).length;
  }

  /**
   * Get failed test count
   */
  getFailedCount() {
    return this.testCases.filter(t => t.isFailed()).length;
  }

  /**
   * Get total test count
   */
  getTotalCount() {
    return this.testCases.length;
  }

  /**
   * Check if all tests passed
   */
  isPassed() {
    return this.result === 'passed';
  }

  /**
   * Convert to JSON
   */
  toJSON() {
    return {
      name: this.name,
      description: this.description,
      total: this.getTotalCount(),
      passed: this.getPassedCount(),
      failed: this.getFailedCount(),
      result: this.result,
      duration: this.duration,
      tests: this.testCases.map(t => t.toJSON())
    };
  }
}
