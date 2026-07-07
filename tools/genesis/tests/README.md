# Genesis Test Framework

## Overview

The Genesis Test Framework is a lightweight, built-in testing system for verifying the entire Genesis Business Compiler.

**Goal**: Every compiler capability should be automatically verifiable with a single command.

```bash
node tools/genesis/genesis.mjs test
```

---

## Architecture

The test framework consists of:

### Core Components

1. **TestCase** - Individual test case
   - Name and test function
   - Result tracking (passed/failed)
   - Error handling
   - Duration measurement

2. **TestSuite** - Collection of test cases
   - Suite name and description
   - Lifecycle hooks (beforeAll, afterAll, beforeEach, afterEach)
   - Result aggregation
   - Test management

3. **TestRunner** - Orchestrator
   - Loads all test suites
   - Executes suites sequentially
   - Collects results
   - Supports CLI filtering

4. **TestReporter** - Output formatting
   - Console formatting with colors
   - Summary statistics
   - JSON export
   - Exit codes

### Test Suites

9 built-in test suites verify all compiler components:

1. **Doctor** - System health and dependencies
2. **Registry** - Definition registry and loading
3. **Planner** - Compilation planning
4. **Compiler** - Code generation
5. **Templates** - Template rendering
6. **Validation** - Artifact validation
7. **Promotion** - Promotion and runtime registration
8. **Pass Pipeline** - Compiler pass architecture
9. **Meta Model** - Meta model definitions

---

## Running Tests

### All Tests

```bash
node tools/genesis/genesis.mjs test
```

Output:
```
╔════════════════════════════════════════════════════╗
║        GENESIS AUTOMATED TEST FRAMEWORK            ║
║           Verification & Quality Assurance         ║
╚════════════════════════════════════════════════════╝

✓ Doctor
  5/5 passed

✓ Registry
  7/7 passed

✓ Planner
  4/4 passed

✓ Compiler
  5/5 passed

✓ Templates
  5/5 passed

✓ Validation
  4/4 passed

✓ Promotion
  4/4 passed

✓ Pass Pipeline
  7/7 passed

✓ Meta Model
  17/17 passed

═══════════════════════════════════════════════════

📊 TEST SUMMARY

  Test Suites: 9
  Total Tests: 58
  Passed: 58
  Failed: 0
  Duration: 342ms

✓ ALL TESTS PASSED

═══════════════════════════════════════════════════
```

### Exit Codes

- **0** - All tests passed
- **1** - Some tests failed

---

## Adding Test Suites

### Create a New Test Suite

1. Create file in `tools/genesis/tests/suites/MyTests.mjs`:

```javascript
import { TestSuite } from '../TestSuite.mjs';

export default async function createMyTests() {
  const suite = new TestSuite('My Suite', 'Description');

  suite.addTest('My test name', async () => {
    // Your test code
    const result = doSomething();
    if (!result) throw new Error('Test failed');
  });

  return suite;
}
```

2. Test will be automatically loaded and run.

### Test Structure

```javascript
import { TestSuite } from '../TestSuite.mjs';

export default async function createMyTests() {
  const suite = new TestSuite('My Suite', 'Optional description');

  // Setup
  suite.beforeAll(async () => {
    // Runs before all tests
  });

  suite.beforeEach(async () => {
    // Runs before each test
  });

  // Tests
  suite.addTest('Test 1', async () => {
    // Test code
    if (someCondition) throw new Error('Test failed');
  });

  suite.addTest('Test 2', async () => {
    // Another test
  });

  // Teardown
  suite.afterEach(async () => {
    // Runs after each test
  });

  suite.afterAll(async () => {
    // Runs after all tests
  });

  return suite;
}
```

### Test Assertions

The framework expects tests to throw errors on failure:

```javascript
// Test passes if no error thrown
suite.addTest('Should work', async () => {
  const result = await doSomething();
  if (!result) throw new Error('Result is invalid');
  if (result.value !== expected) throw new Error(`Expected ${expected}, got ${result.value}`);
});
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Genesis Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '20'
      - run: cd platform && node tools/genesis/genesis.mjs test
```

### Local Pre-Commit Hook

```bash
#!/bin/bash
cd platform
node tools/genesis/genesis.mjs test
if [ $? -ne 0 ]; then
  echo "Tests failed!"
  exit 1
fi
```

---

## Test Coverage

### Doctor Suite (5 tests)
- ✓ Doctor initializes
- ✓ Doctor checks Node.js version
- ✓ Doctor checks file structure
- ✓ Doctor checks Genesis registry
- ✓ Doctor detects all core modules

### Registry Suite (7 tests)
- ✓ Registry initializes
- ✓ Registry loads Customer definition
- ✓ Customer definition has required properties
- ✓ Customer has expected fields
- ✓ Customer has expected relationships
- ✓ Blueprint loads successfully
- ✓ Blueprint has correct field count

### Planner Suite (4 tests)
- ✓ Planner initializes
- ✓ Planner creates compilation plan
- ✓ Plan has required sections
- ✓ Plan has artifact list
- ✓ Plan has expected artifact types

### Compiler Suite (5 tests)
- ✓ Compiler initializes
- ✓ Compiler renders artifacts
- ✓ Compiler produces database artifact
- ✓ Compiler produces API artifact
- ✓ Artifacts have content

### Templates Suite (5 tests)
- ✓ TemplateEngine initializes
- ✓ Template directory exists
- ✓ Entity template exists
- ✓ Database template exists
- ✓ API template exists

### Validation Suite (4 tests)
- ✓ Validator initializes
- ✓ Validator validates generated slice
- ✓ Validator checks for required artifacts
- ✓ Validator checks artifact content

### Promotion Suite (4 tests)
- ✓ PromotionEngine initializes
- ✓ PromotionEngine promotes entity
- ✓ Promotion returns environment info
- ✓ Promotion registers runtime

### Pass Pipeline Suite (7 tests)
- ✓ CompilerContext initializes
- ✓ PassRegistry initializes
- ✓ All 8 passes register
- ✓ Passes register in order
- ✓ Pipeline executes passes
- ✓ Pass lookup is O(1)
- ✓ Duplicate pass detection works

### Meta Model Suite (17 tests)
- ✓ Meta model directory exists
- ✓ All 12 meta files exist
- ✓ ADR-0019 exists
- ✓ All meta files have content
- ✓ Entity.meta.yaml has expected sections
- ✓ Field.meta.yaml has expected sections

---

## Test Results Output

### Console Output
```
✓ Doctor
  ✓ Doctor initializes (12ms)
  ✓ Doctor checks Node.js version (8ms)
  5/5 passed
```

### JSON Export
```json
{
  "timestamp": "2026-07-07T10:30:00Z",
  "suites": [
    {
      "name": "Doctor",
      "total": 5,
      "passed": 5,
      "failed": 0,
      "result": "passed",
      "duration": 50
    }
  ],
  "summary": {
    "totalSuites": 9,
    "totalTests": 58,
    "totalPassed": 58,
    "totalFailed": 0,
    "allPassed": true
  }
}
```

---

## Performance

Test framework is optimized for:
- **Speed** - No external dependencies
- **Memory** - Minimal memory usage
- **Parallelization** - Suites could run in parallel (currently sequential)
- **Reporting** - Fast console output

Average runtime: < 500ms for full test suite

---

## Troubleshooting

### Tests Won't Run

Check that Node.js v20+ is available:
```bash
node --version
```

### Import Errors

Ensure project structure matches expected layout:
```
platform/
├── tools/genesis/
│   ├── genesis.mjs
│   ├── tests/
│   └── compiler/
├── definitions/entity/
├── meta/
└── docs/architecture/
```

### Test Failures

Run Doctor to diagnose:
```bash
node tools/genesis/genesis.mjs doctor
```

---

## Future Enhancements

- Parallel test execution (use Promise.all)
- Test filtering by suite name
- Code coverage reporting
- Benchmark tracking
- Performance regression detection
- Integration with CI/CD systems
- HTML test report generation
- Test history tracking

---

## Philosophy

The Genesis Test Framework embodies:

1. **Comprehensive** - Tests every compiler component
2. **Automated** - Run with single command
3. **Lightweight** - No external dependencies
4. **Fast** - Complete in < 500ms
5. **Clear** - Easy to read test output
6. **Extensible** - Easy to add tests
7. **Trustworthy** - Deterministic results

The test framework makes Genesis **verifiable and reliable**.
