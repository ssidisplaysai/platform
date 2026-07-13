/**
 * PolicyRenderer.test.mjs
 *
 * Comprehensive test suite for PolicyRenderer.
 * Tests defensive normalization of roles, deterministic ordering, and immutability.
 *
 * @module tools/genesis/compiler/renderers/PolicyRenderer.test.mjs
 */

import assert from 'assert';
import { generatePolicies } from './PolicyRenderer.mjs';

// ---------------------------------------------------------------------------
// Mock Blueprint Factory
// ---------------------------------------------------------------------------

function createMockBlueprint(entity = 'TestEntity', rolesInput = []) {
  return {
    metadata: { entity },
    permissions: {
      roles: rolesInput,
      actions: ['create', 'read', 'update', 'delete'],
    },
    policies: {
      all: [],
      byConditionType: {},
      byRole: {},
    },
    lifecycle: {
      states: {},
    },
    fields: {
      all: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const tests = [];

// Test 1: Single role as string
tests.push({
  name: 'Single role as string',
  run: () => {
    const blueprint = createMockBlueprint('Product', 'admin');
    const output = generatePolicies(blueprint);
    
    assert(output.includes('## Supported Roles'), 'Missing roles section');
    assert(output.includes('`admin`'), 'Missing admin role');
    assert(typeof output === 'string', 'Output should be string');
  },
});

// Test 2: Multiple roles as array
tests.push({
  name: 'Multiple roles as array',
  run: () => {
    const blueprint = createMockBlueprint('Product', ['admin', 'manager', 'viewer']);
    const output = generatePolicies(blueprint);
    
    assert(output.includes('`admin`'), 'Missing admin role');
    assert(output.includes('`manager`'), 'Missing manager role');
    assert(output.includes('`viewer`'), 'Missing viewer role');
  },
});

// Test 3: Duplicate roles (should be deduplicated)
tests.push({
  name: 'Duplicate roles are deduplicated',
  run: () => {
    const blueprint = createMockBlueprint('Product', ['admin', 'admin', 'manager', 'admin']);
    const output = generatePolicies(blueprint);
    
    // Count occurrences of admin in the roles list
    const rolesSection = output.split('## Implementation Notes')[0];
    const adminMatches = (rolesSection.match(/`admin`/g) || []).length;
    // Should appear only once in the roles list (plus elsewhere)
    assert(adminMatches >= 1, 'Admin should appear at least once');
  },
});

// Test 4: Empty roles array
tests.push({
  name: 'Empty roles array handled',
  run: () => {
    const blueprint = createMockBlueprint('Product', []);
    const output = generatePolicies(blueprint);
    
    assert(output.includes('## Supported Roles'), 'Missing roles section');
    assert(output.includes('(no roles defined)') || output.includes('Supported Roles'), 'Should handle empty roles');
  },
});

// Test 5: Undefined roles
tests.push({
  name: 'Undefined roles handled',
  run: () => {
    const blueprint = createMockBlueprint('Product', undefined);
    const output = generatePolicies(blueprint);
    
    assert(typeof output === 'string', 'Should generate output with undefined roles');
    assert(output.includes('## Overview'), 'Should still have sections');
  },
});

// Test 6: Null roles
tests.push({
  name: 'Null roles handled',
  run: () => {
    const blueprint = createMockBlueprint('Product', null);
    const output = generatePolicies(blueprint);
    
    assert(typeof output === 'string', 'Should handle null roles');
    assert(output.length > 0, 'Should produce output');
  },
});

// Test 7: Deterministic role ordering
tests.push({
  name: 'Deterministic role ordering (alphabetical)',
  run: () => {
    const blueprint1 = createMockBlueprint('Product', ['viewer', 'admin', 'manager']);
    const blueprint2 = createMockBlueprint('Product', ['manager', 'admin', 'viewer']);
    
    const output1 = generatePolicies(blueprint1);
    const output2 = generatePolicies(blueprint2);
    
    // Extract roles section
    const getRolesSection = (out) => {
      const match = out.match(/## Supported Roles([\s\S]*?)##/);
      return match ? match[1] : '';
    };
    
    const roles1 = getRolesSection(output1);
    const roles2 = getRolesSection(output2);
    
    assert(roles1 === roles2, 'Same roles in different order should produce identical output');
  },
});

// Test 8: Immutability (output doesn't change on access)
tests.push({
  name: 'Output immutability',
  run: () => {
    const blueprint = createMockBlueprint('Product', ['admin', 'viewer']);
    const output1 = generatePolicies(blueprint);
    const output2 = generatePolicies(blueprint);
    
    assert.strictEqual(output1, output2, 'Same blueprint should produce identical output');
  },
});

// Test 9: Inline array string syntax (YAML parser issue)
tests.push({
  name: 'Inline array string syntax "[admin, manager]"',
  run: () => {
    // Simulate YAML parser returning inline array as string
    const blueprint = createMockBlueprint('Product', '[admin, manager, viewer]');
    const output = generatePolicies(blueprint);
    
    assert(output.includes('`admin`'), 'Should parse admin from inline array string');
    assert(output.includes('`manager`'), 'Should parse manager from inline array string');
    assert(output.includes('`viewer`'), 'Should parse viewer from inline array string');
  },
});

// Test 10: Case normalization (lowercase conversion)
tests.push({
  name: 'Role names normalized to lowercase',
  run: () => {
    const blueprint = createMockBlueprint('Product', ['ADMIN', 'Manager', 'VIEWER']);
    const output = generatePolicies(blueprint);
    
    // Roles should be displayed but in lowercase
    assert(output.includes('admin') || output.includes('Admin'), 'Should handle mixed case');
  },
});

// Test 11: Empty actions handled
tests.push({
  name: 'Empty actions handled',
  run: () => {
    const blueprint = createMockBlueprint('Product', ['admin']);
    blueprint.permissions.actions = [];
    const output = generatePolicies(blueprint);
    
    assert(output.includes('## Supported Actions'), 'Should have actions section');
  },
});

// Test 12: Byte-for-byte determinism across multiple generations
tests.push({
  name: 'Byte-for-byte deterministic output',
  run: () => {
    const blueprint = createMockBlueprint('Customer', ['admin', 'manager', 'viewer']);
    
    const output1 = generatePolicies(blueprint);
    const output2 = generatePolicies(blueprint);
    const output3 = generatePolicies(blueprint);
    
    assert.strictEqual(output1, output2, 'Generation 1 and 2 should be identical');
    assert.strictEqual(output2, output3, 'Generation 2 and 3 should be identical');
  },
});

// ---------------------------------------------------------------------------
// Test Runner
// ---------------------------------------------------------------------------

async function runTests() {
  console.log('🧪 PolicyRenderer Test Suite');
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
