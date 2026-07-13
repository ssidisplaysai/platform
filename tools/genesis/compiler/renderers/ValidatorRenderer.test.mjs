/**
 * ValidatorRenderer.test.mjs
 *
 * Comprehensive test suite for ValidatorRenderer.
 * Tests the self-contained validator generation with proper typing and determinism.
 *
 * @module tools/genesis/compiler/renderers/ValidatorRenderer.test.mjs
 */

import assert from 'assert';
import { generateValidator } from './ValidatorRenderer.mjs';

// ---------------------------------------------------------------------------
// Mock Blueprint Factory
// ---------------------------------------------------------------------------

function createMockBlueprint(entity = 'TestEntity', fieldsConfig = {}) {
  const fields = [];
  
  // Add fields based on config
  for (const [name, config] of Object.entries(fieldsConfig)) {
    fields.push({
      name,
      type: config.type || 'string',
      required: config.required ?? false,
      maxLength: config.maxLength,
      minLength: config.minLength,
      values: config.values, // For enum
      pattern: config.pattern,
      minimum: config.minimum,
      maximum: config.maximum,
      message: config.message,
    });
  }

  return {
    metadata: { entity },
    fields: { all: fields },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const tests = [];

// Test 1: Required validation
tests.push({
  name: 'Required field validation',
  run: () => {
    const blueprint = createMockBlueprint('User', {
      name: { required: true },
      email: { required: true },
    });

    const output = generateValidator(blueprint);

    // Should contain required checks
    assert(output.includes('// Required: name'), 'Missing name required check');
    assert(output.includes('// Required: email'), 'Missing email required check');
    assert(output.includes('if (!data.name)'), 'Missing name validation logic');
    assert(output.includes('if (!data.email)'), 'Missing email validation logic');
    assert(output.includes("'name is required'"), 'Missing name error message');
    assert(output.includes("'email is required'"), 'Missing email error message');
  },
});

// Test 2: Enum validation
tests.push({
  name: 'Enum field validation',
  run: () => {
    const blueprint = createMockBlueprint('Product', {
      status: { type: 'enum', values: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] },
    });

    const output = generateValidator(blueprint);

    assert(output.includes('// Enum: status'), 'Missing enum check comment');
    assert(output.includes('validValues'), 'Missing validValues array');
    assert(output.includes("'DRAFT'"), 'Missing DRAFT value');
    assert(output.includes("'PUBLISHED'"), 'Missing PUBLISHED value');
    assert(output.includes("'ARCHIVED'"), 'Missing ARCHIVED value');
  },
});

// Test 3: Email validation
tests.push({
  name: 'Email field validation',
  run: () => {
    const blueprint = createMockBlueprint('Contact', {
      email: { type: 'email', required: true },
    });

    const output = generateValidator(blueprint);

    assert(output.includes('// Email format: email'), 'Missing email format check');
    assert(output.includes('isValidEmail'), 'Missing email helper method');
    assert(output.includes('private isValidEmail'), 'Missing email helper definition');
  },
});

// Test 4: String length validation
tests.push({
  name: 'String length validation',
  run: () => {
    const blueprint = createMockBlueprint('Document', {
      title: { type: 'string', maxLength: 100 },
      slug: { type: 'string', minLength: 3, maxLength: 50 },
    });

    const output = generateValidator(blueprint);

    assert(output.includes('// Max length: title'), 'Missing title max length check');
    assert(output.includes('.length > 100'), 'Missing max length logic for title');
    assert(output.includes('// Min length: slug'), 'Missing slug min length check');
    assert(output.includes('.length < 3'), 'Missing min length logic for slug');
  },
});

// Test 5: Regex pattern validation
tests.push({
  name: 'Regex pattern validation',
  run: () => {
    const blueprint = createMockBlueprint('User', {
      username: { type: 'string', pattern: '^[a-z0-9_]{3,20}$', message: 'Invalid username' },
    });

    const output = generateValidator(blueprint);

    assert(output.includes('// Regex pattern: username'), 'Missing regex check comment');
    assert(output.includes('const pattern ='), 'Missing pattern definition');
    assert(output.includes('pattern.test'), 'Missing pattern test');
  },
});

// Test 6: Numeric min/max validation
tests.push({
  name: 'Numeric range validation',
  run: () => {
    const blueprint = createMockBlueprint('Order', {
      quantity: { type: 'number', minimum: 1, maximum: 1000 },
    });

    const output = generateValidator(blueprint);

    assert(output.includes('// Minimum value: quantity'), 'Missing min value check');
    assert(output.includes('// Maximum value: quantity'), 'Missing max value check');
    assert(output.includes('< 1'), 'Missing min value logic');
    assert(output.includes('> 1000'), 'Missing max value logic');
  },
});

// Test 7: Duplicate rule prevention
tests.push({
  name: 'No duplicate validation rules',
  run: () => {
    const blueprint = createMockBlueprint('Item', {
      name: { required: true },
    });

    const output = generateValidator(blueprint);

    // Count occurrences of "Required: name" - should be exactly 1
    const requiredMatches = (output.match(/\/\/ Required: name/g) || []).length;
    assert.strictEqual(requiredMatches, 1, 'Required rule for name appears multiple times');
  },
});

// Test 8: Deterministic validation ordering
tests.push({
  name: 'Deterministic field ordering',
  run: () => {
    const blueprint1 = createMockBlueprint('Test', {
      zebra: { required: true },
      apple: { required: true },
      banana: { required: true },
    });

    const output1 = generateValidator(blueprint1);

    // Generate again to verify determinism
    const output2 = generateValidator(blueprint1);

    assert.strictEqual(output1, output2, 'Same blueprint produces different output');

    // Check that fields are ordered alphabetically
    const applePos = output1.indexOf('// Required: apple');
    const bananaPos = output1.indexOf('// Required: banana');
    const zebraPos = output1.indexOf('// Required: zebra');

    assert(applePos < bananaPos && bananaPos < zebraPos, 'Fields not in alphabetical order');
  },
});

// Test 9: Empty validator with no fields
tests.push({
  name: 'Empty validator generation',
  run: () => {
    const blueprint = createMockBlueprint('Empty', {});

    const output = generateValidator(blueprint);

    assert(output.includes('class EmptyValidator'), 'Missing class definition');
    assert(output.includes('validate(data:'), 'Missing validate method');
    assert(output.includes('ValidationResult'), 'Missing ValidationResult interface');
    assert(output.includes('isValid: errors.length === 0'), 'Missing validation result');
  },
});

// Test 10: TypeScript strict mode compliance
tests.push({
  name: 'TypeScript strict mode compliance',
  run: () => {
    const blueprint = createMockBlueprint('Strict', {
      field1: { required: true },
    });

    const output = generateValidator(blueprint);

    // No implicit any
    assert(!output.includes(': any'), 'Found implicit any type');
    assert(!output.includes('(data)'), 'Data parameter should have explicit type');
    assert(output.includes('(data: Record<string, unknown>)'), 'Missing proper data type');

    // All variables are typed
    assert(output.includes('const errors: ValidationError[]'), 'Errors array should be typed');
  },
});

// Test 11: Immutability markers
tests.push({
  name: 'Immutability with Object.freeze',
  run: () => {
    const blueprint = createMockBlueprint('Immutable', {
      status: { type: 'enum', values: ['A', 'B'] },
    });

    const output = generateValidator(blueprint);

    // Check for immutability markers
    assert(output.includes('Object.freeze'), 'Missing Object.freeze for immutability');
    assert(output.includes('readonly ValidationError[]'), 'Missing readonly marker');
    assert(output.includes('readonly string[]'), 'Missing readonly for validValues');
  },
});

// Test 12: Byte-for-byte identical output
tests.push({
  name: 'Byte-for-byte deterministic output',
  run: () => {
    const blueprint = createMockBlueprint('Deterministic', {
      field1: { required: true },
      field2: { type: 'enum', values: ['X', 'Y', 'Z'] },
      field3: { type: 'email' },
    });

    const output1 = generateValidator(blueprint);
    const output2 = generateValidator(blueprint);
    const output3 = generateValidator(blueprint);

    assert.strictEqual(output1, output2, 'Generation 1 and 2 differ');
    assert.strictEqual(output2, output3, 'Generation 2 and 3 differ');
  },
});

// ---------------------------------------------------------------------------
// Test Runner
// ---------------------------------------------------------------------------

async function runTests() {
  console.log('🧪 ValidatorRenderer Test Suite');
  console.log('═'.repeat(60));
  console.log('');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      test.run();
      console.log(`✓ ${test.name}`);
      passed++;
    } catch (err) {
      console.log(`✗ ${test.name}`);
      console.log(`  Error: ${err.message}`);
      failed++;
    }
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
  console.log('');

  if (failed === 0) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
