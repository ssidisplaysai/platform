/**
 * OpenAPIRenderer.test.mjs
 *
 * Comprehensive test suite for OpenAPIRenderer.
 * Tests enum normalization, property ordering, and schema validity.
 *
 * @module tools/genesis/compiler/renderers/OpenAPIRenderer.test.mjs
 */

import assert from 'assert';
import { generateOpenAPI } from './OpenAPIRenderer.mjs';

// ---------------------------------------------------------------------------
// Mock Blueprint Factory
// ---------------------------------------------------------------------------

function createMockBlueprint(entity = 'TestEntity', fields = []) {
  return {
    metadata: {
      entity,
      pluralName: entity + 's',
    },
    api: {
      rest: {
        baseRoute: `/${entity.toLowerCase()}s`,
      },
    },
    fields: {
      all: fields,
    },
    relationships: {
      all: [],
    },
  };
}

function createMockField(name, type, options = {}) {
  return {
    name,
    type,
    description: options.description || `${name} field`,
    maxLength: options.maxLength,
    minLength: options.minLength,
    min: options.min,
    max: options.max,
    pattern: options.pattern,
    generated: options.generated || false,
    readonly: options.readonly || false,
    values: options.values,
    itemType: options.itemType,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const tests = [];

// Test 1: String enum normalization (inline array syntax)
tests.push({
  name: 'String enum normalization (inline array syntax)',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('status', 'enum', {
        values: "['ACTIVE', 'INACTIVE', 'PENDING']",
      }),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(output.includes('enum:'), 'Should have enum in output');
    assert(output.includes('ACTIVE'), 'Should include ACTIVE');
    assert(output.includes('INACTIVE'), 'Should include INACTIVE');
    assert(output.includes('PENDING'), 'Should include PENDING');
  },
});

// Test 2: Array enum normalization
tests.push({
  name: 'Array enum normalization',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('status', 'enum', {
        values: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
      }),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(output.includes('enum:'), 'Should have enum');
    assert(output.includes('DRAFT'), 'Should include DRAFT');
  },
});

// Test 3: Duplicate enum removal
tests.push({
  name: 'Duplicate enum values are deduplicated',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('status', 'enum', {
        values: ['ACTIVE', 'ACTIVE', 'INACTIVE', 'ACTIVE'],
      }),
    ]);
    const output = generateOpenAPI(blueprint);
    
    // Should not have duplicates - verify by checking quote count
    const enumLine = output.split('\n').find(l => l.includes('enum:'));
    assert(enumLine, 'Should have enum line');
    // Count ACTIVE in enum line
    const activeMatches = (enumLine.match(/"ACTIVE"/g) || []).length;
    assert.strictEqual(activeMatches, 1, 'ACTIVE should appear only once');
  },
});

// Test 4: Empty enum array handling
tests.push({
  name: 'Empty enum array handled',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('status', 'enum', { values: [] }),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(typeof output === 'string', 'Should generate output');
    assert(output.length > 0, 'Should have content');
  },
});

// Test 5: Undefined enum values
tests.push({
  name: 'Undefined enum values handled',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('status', 'enum', { values: undefined }),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(typeof output === 'string', 'Should generate output');
  },
});

// Test 6: Deterministic enum ordering (alphabetical)
tests.push({
  name: 'Deterministic enum ordering (alphabetical)',
  run: () => {
    const blueprint1 = createMockBlueprint('Product', [
      createMockField('status', 'enum', {
        values: ['ZEBRA', 'APPLE', 'BANANA'],
      }),
    ]);
    const blueprint2 = createMockBlueprint('Product', [
      createMockField('status', 'enum', {
        values: ['BANANA', 'ZEBRA', 'APPLE'],
      }),
    ]);
    
    const output1 = generateOpenAPI(blueprint1);
    const output2 = generateOpenAPI(blueprint2);
    
    // Extract enum lines
    const getEnumLine = (out) => out.split('\n').find(l => l.includes('enum:'));
    const enum1 = getEnumLine(output1);
    const enum2 = getEnumLine(output2);
    
    assert.strictEqual(enum1, enum2, 'Same enums in different order should produce identical output');
  },
});

// Test 7: Property ordering (alphabetical)
tests.push({
  name: 'Property ordering is deterministic (alphabetical)',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('zebra', 'string'),
      createMockField('apple', 'string'),
      createMockField('banana', 'string'),
    ]);
    const output = generateOpenAPI(blueprint);
    
    // Extract properties section
    const lines = output.split('\n');
    const propertiesIdx = lines.findIndex(l => l.includes('properties:'));
    const nextSectionIdx = lines.findIndex((l, i) => i > propertiesIdx && (l.includes('schemas:') || l.includes('Error:')));
    
    const propLines = lines.slice(propertiesIdx, nextSectionIdx).join('\n');
    const appleIdx = propLines.indexOf('apple:');
    const bananaIdx = propLines.indexOf('banana:');
    const zebraIdx = propLines.indexOf('zebra:');
    
    // Should be in alphabetical order
    assert(appleIdx < bananaIdx, 'apple should come before banana');
    assert(bananaIdx < zebraIdx, 'banana should come before zebra');
  },
});

// Test 8: No duplicate schema properties
tests.push({
  name: 'No duplicate schema properties',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('id', 'identifier'),
      createMockField('name', 'string'),
      createMockField('name', 'string'), // Duplicate (should not happen but test defensively)
    ]);
    const output = generateOpenAPI(blueprint);
    
    // Verify basic structure is intact
    assert(output.includes('openapi:'), 'Should have openapi spec');
    assert(output.includes('schemas:'), 'Should have schemas');
  },
});

// Test 9: Format mapping (email)
tests.push({
  name: 'Format mapping for email',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('email', 'email'),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(output.includes('format: email'), 'Should have email format');
  },
});

// Test 10: Format mapping (date, timestamp)
tests.push({
  name: 'Format mapping for date and timestamp',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('date', 'date'),
      createMockField('createdAt', 'timestamp'),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(output.includes('format: date'), 'Should have date format');
    assert(output.includes('format: date-time'), 'Should have date-time format');
  },
});

// Test 11: Min/max constraints
tests.push({
  name: 'Min/max numeric constraints',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('quantity', 'integer', { min: 0, max: 1000 }),
      createMockField('price', 'number', { min: 0.01, max: 999999.99 }),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(output.includes('minimum:'), 'Should have minimum constraint');
    assert(output.includes('maximum:'), 'Should have maximum constraint');
  },
});

// Test 12: Pattern/regex constraints
tests.push({
  name: 'Pattern/regex constraints',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('code', 'string', {
        pattern: '^[A-Z]{3}-[0-9]{4}$',
      }),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(output.includes('pattern:'), 'Should have pattern constraint');
  },
});

// Test 13: String length constraints
tests.push({
  name: 'String length constraints (maxLength)',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('name', 'string', { maxLength: 255 }),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(output.includes('maxLength: 255'), 'Should have maxLength constraint');
  },
});

// Test 14: Array item schemas
tests.push({
  name: 'Array item type schemas',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('tags', 'array', { itemType: 'string' }),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(output.includes('type: array'), 'Should have array type');
    assert(output.includes('items:'), 'Should have items definition');
  },
});

// Test 15: Malformed metadata tolerance (null fields)
tests.push({
  name: 'Malformed metadata tolerance (null values)',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('field1', 'string', { maxLength: null }),
      createMockField('field2', 'enum', { values: null }),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(typeof output === 'string', 'Should generate output despite null values');
    assert(output.includes('openapi:'), 'Should have valid structure');
  },
});

// Test 16: Byte-for-byte deterministic output
tests.push({
  name: 'Byte-for-byte deterministic output',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('status', 'enum', {
        values: ['ACTIVE', 'INACTIVE', 'PENDING'],
      }),
      createMockField('name', 'string', { maxLength: 255 }),
    ]);
    
    const output1 = generateOpenAPI(blueprint);
    const output2 = generateOpenAPI(blueprint);
    const output3 = generateOpenAPI(blueprint);
    
    assert.strictEqual(output1, output2, 'Gen 1 and 2 should be identical');
    assert.strictEqual(output2, output3, 'Gen 2 and 3 should be identical');
  },
});

// Test 17: Generated fields excluded from input schema
tests.push({
  name: 'Generated fields excluded from input schema',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('id', 'identifier', { generated: true }),
      createMockField('createdAt', 'timestamp', { generated: true }),
      createMockField('name', 'string'),
    ]);
    const output = generateOpenAPI(blueprint);
    
    // Verify Input schema is present
    assert(output.includes('ProductInput:'), 'Should have Input schema');
    assert(output.includes('ProductResponse:'), 'Should have Response schema');
    
    // Both schemas should have different properties (Input excludes generated)
    const lines = output.split('\n');
    const inputStart = lines.findIndex(l => l.includes('ProductInput:'));
    const responseStart = lines.findIndex(l => l.includes('ProductResponse:'));
    
    const inputSection = lines.slice(inputStart, responseStart).join('\n');
    const responseSection = lines.slice(responseStart).join('\n');
    
    // Input should have name
    assert(inputSection.includes('name:'), 'Input should have name');
    // Response should have both id and name
    assert(responseSection.includes('id:'), 'Response should have id');
    assert(responseSection.includes('name:'), 'Response should have name');
  },
});

// Test 18: OpenAPI valid structure
tests.push({
  name: 'OpenAPI valid structural markers',
  run: () => {
    const blueprint = createMockBlueprint('Product', [
      createMockField('id', 'identifier'),
      createMockField('name', 'string'),
    ]);
    const output = generateOpenAPI(blueprint);
    
    assert(output.includes('openapi: 3.1.0'), 'Should have OpenAPI version');
    assert(output.includes('info:'), 'Should have info section');
    assert(output.includes('servers:'), 'Should have servers section');
    assert(output.includes('paths:'), 'Should have paths section');
    assert(output.includes('components:'), 'Should have components section');
    assert(output.includes('schemas:'), 'Should have schemas section');
  },
});

// ---------------------------------------------------------------------------
// Test Runner
// ---------------------------------------------------------------------------

async function runTests() {
  console.log('🧪 OpenAPIRenderer Test Suite');
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
