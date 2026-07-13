/**
 * EventsRenderer.test.mjs
 *
 * Comprehensive test suite for EventsRenderer.
 * Validates event artifact generation: compilability, determinism, contract compliance.
 *
 * @module tools/genesis/tests/EventsRenderer.test.mjs
 */

import { generateEvents } from '../compiler/renderers/EventsRenderer.mjs';
import { strict as assert } from 'assert';

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const baseBlueprint = {
  metadata: { entity: 'TestEntity' },
  capabilities: { audit: { enabled: false } },
  lifecycle: { transitions: [] },
};

const blueprintWithLifecycle = {
  metadata: { entity: 'Item' },
  capabilities: { audit: { enabled: false } },
  lifecycle: {
    transitions: [
      { from: 'draft', to: 'active' },
      { from: 'active', to: 'archived' },
      { from: 'active', to: 'draft' },
    ],
  },
};

const blueprintWithAudit = {
  metadata: { entity: 'Document' },
  capabilities: { audit: { enabled: true } },
  lifecycle: { transitions: [] },
};

const blueprintWithAll = {
  metadata: { entity: 'Order' },
  capabilities: { audit: { enabled: true } },
  lifecycle: {
    transitions: [
      { from: 'pending', to: 'confirmed' },
      { from: 'confirmed', to: 'shipped' },
      { from: 'shipped', to: 'delivered' },
      { from: 'shipped', to: 'returned' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Basic TypeScript syntax validation via grep patterns
 * (real validation happens via tsc in integration tests)
 */
function validateTypeScriptSyntax(code) {
  // Check for common syntax errors
  assert(
    !code.includes('undefined'),
    'Code should not reference undefined variables'
  );

  const braceCount = code.split('{').length - code.split('}').length;
  assert.equal(braceCount, 0, 'Braces should be balanced');

  const parenCount = code.split('(').length - code.split(')').length;
  assert.equal(parenCount, 0, 'Parentheses should be balanced');
}

/**
 * Check that all expected event types are present
 */
function getEventTypeKeys(code) {
  const match = code.match(
    /export const \w+EventTypes = Object\.freeze\(\{([\s\S]*?)\} as const\)/
  );
  if (!match) return [];
  return match[1]
    .split('\n')
    .filter((line) => line.includes(':'))
    .map((line) => line.split(':')[0].trim());
}

/**
 * Extract all interface names from generated code
 */
function getInterfaceNames(code) {
  const matches = code.matchAll(/export interface (\w+)/g);
  return Array.from(matches).map((m) => m[1]);
}

/**
 * Check property order in object literal
 */
function getObjectProperties(code, objectName) {
  const regex = new RegExp(
    `export const ${objectName} = Object\\.freeze\\(\\{([\\s\\S]*?)\\} as const\\)`,
    'm'
  );
  const match = code.match(regex);
  if (!match) return [];
  return match[1]
    .split('\n')
    .filter((line) => line.includes(':'))
    .map((line) => line.split(':')[0].trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n🧪 EventsRenderer Test Suite\n');

let passCount = 0;
let failCount = 0;

/**
 * Test 1: Valid event declarations for minimal blueprint
 */
try {
  const code = generateEvents(baseBlueprint);
  validateTypeScriptSyntax(code);
  const eventTypes = getEventTypeKeys(code);
  assert(eventTypes.includes('CREATED'), 'Should have CREATED event');
  assert(eventTypes.includes('UPDATED'), 'Should have UPDATED event');
  assert(eventTypes.includes('DELETED'), 'Should have DELETED event');
  assert(eventTypes.includes('RESTORED'), 'Should have RESTORED event');
  console.log('✓ Test 1: Valid event declarations (minimal blueprint)');
  passCount++;
} catch (e) {
  console.log(`✗ Test 1 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 2: Valid payload interfaces
 */
try {
  const code = generateEvents(baseBlueprint);
  const interfaces = getInterfaceNames(code);
  assert(interfaces.includes('TestEntityBaseEvent'), 'Should have BaseEvent');
  assert(interfaces.includes('TestEntityCreatedEvent'), 'Should have CreatedEvent');
  assert(interfaces.includes('TestEntityUpdatedEvent'), 'Should have UpdatedEvent');
  assert(interfaces.includes('TestEntityDeletedEvent'), 'Should have DeletedEvent');
  assert(
    interfaces.includes('TestEntityRestoredEvent'),
    'Should have RestoredEvent'
  );
  assert(
    interfaces.includes('TestEntityEventHandler'),
    'Should have EventHandler'
  );
  console.log('✓ Test 2: Valid payload interfaces');
  passCount++;
} catch (e) {
  console.log(`✗ Test 2 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 3: No unresolved imports
 */
try {
  const code = generateEvents(baseBlueprint);
  assert(!code.includes('import {'), 'Should not import external modules');
  // Check for actual import statements, not just the word "from" in comments
  const importLines = code.split('\n').filter(l => l.trim().startsWith('import ') && l.includes(' from '));
  assert.equal(importLines.length, 0, 'Should not have import statements');
  console.log('✓ Test 3: No unresolved imports');
  passCount++;
} catch (e) {
  console.log(`✗ Test 3 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 4: No duplicate property names
 */
try {
  const code = generateEvents(baseBlueprint);
  const eventTypes = getObjectProperties(code, 'TestEntityEventTypes');
  const uniqueKeys = new Set(eventTypes);
  assert.equal(
    eventTypes.length,
    uniqueKeys.size,
    'All event type keys should be unique'
  );
  console.log('✓ Test 4: No duplicate property names');
  passCount++;
} catch (e) {
  console.log(`✗ Test 4 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 5: Deterministic event ordering
 */
try {
  const code1 = generateEvents(baseBlueprint);
  const code2 = generateEvents(baseBlueprint);
  assert.equal(code1, code2, 'Event generation should be deterministic');
  console.log('✓ Test 5: Deterministic event ordering (basic blueprint)');
  passCount++;
} catch (e) {
  console.log(`✗ Test 5 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 6: State transition events included and deduplicated
 */
try {
  const code = generateEvents(blueprintWithLifecycle);
  const eventTypes = getEventTypeKeys(code);
  assert(eventTypes.includes('STATE_CHANGED'), 'Should have STATE_CHANGED');
  assert(
    eventTypes.includes('STATE_TO_ACTIVE'),
    'Should have STATE_TO_ACTIVE'
  );
  assert(
    eventTypes.includes('STATE_TO_ARCHIVED'),
    'Should have STATE_TO_ARCHIVED'
  );
  assert(
    eventTypes.includes('STATE_TO_DRAFT'),
    'Should have STATE_TO_DRAFT'
  );
  // Check no duplicates even though 'draft' and 'active' appear multiple times in transitions
  const uniqueKeys = new Set(eventTypes);
  assert.equal(
    eventTypes.length,
    uniqueKeys.size,
    'No duplicate state transition events'
  );
  console.log('✓ Test 6: State transition events (deduplicated)');
  passCount++;
} catch (e) {
  console.log(`✗ Test 6 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 7: StateChangedEvent included when lifecycle present
 */
try {
  const code = generateEvents(blueprintWithLifecycle);
  const interfaces = getInterfaceNames(code);
  assert(
    interfaces.includes('ItemStateChangedEvent'),
    'Should have StateChangedEvent'
  );
  console.log('✓ Test 7: StateChangedEvent included');
  passCount++;
} catch (e) {
  console.log(`✗ Test 7 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 8: Audit events included when audit enabled
 */
try {
  const code = generateEvents(blueprintWithAudit);
  const eventTypes = getEventTypeKeys(code);
  assert(eventTypes.includes('AUDITED'), 'Should have AUDITED event');
  const interfaces = getInterfaceNames(code);
  assert(
    interfaces.includes('DocumentAuditedEvent'),
    'Should have AuditedEvent interface'
  );
  console.log('✓ Test 8: Audit events included');
  passCount++;
} catch (e) {
  console.log(`✗ Test 8 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 9: Readonly registries
 */
try {
  const code = generateEvents(baseBlueprint);
  assert(
    code.includes('Object.freeze('),
    'EventTypes should use Object.freeze'
  );
  assert(
    code.includes('as const'),
    'EventTypes should be marked as const'
  );
  console.log('✓ Test 9: Readonly registries (Object.freeze + as const)');
  passCount++;
} catch (e) {
  console.log(`✗ Test 9 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 10: Deterministic state transition ordering
 */
try {
  // "active" appears first in blueprint, then "archived", then "draft"
  // After deduplication, should be sorted: "active", "archived", "draft"
  const code = generateEvents(blueprintWithLifecycle);
  const eventProps = getObjectProperties(code, 'ItemEventTypes');
  // After sorting, should be in alphabetical order
  const sorted = [...eventProps].sort();
  assert.deepEqual(
    eventProps,
    sorted,
    'Event type keys should be in sorted order'
  );
  console.log('✓ Test 10: Deterministic state transition ordering');
  passCount++;
} catch (e) {
  console.log(`✗ Test 10 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 11: Repeated generation equivalence with lifecycle + audit
 */
try {
  const code1 = generateEvents(blueprintWithAll);
  const code2 = generateEvents(blueprintWithAll);
  const code3 = generateEvents(blueprintWithAll);
  assert.equal(code1, code2, 'First and second generation should match');
  assert.equal(code2, code3, 'Second and third generation should match');
  console.log('✓ Test 11: Repeated generation equivalence (complex blueprint)');
  passCount++;
} catch (e) {
  console.log(`✗ Test 11 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 12: TypeScript-valid output markers
 */
try {
  const code = generateEvents(baseBlueprint);
  assert(code.includes('@generated true'), 'Should have @generated marker');
  assert(code.includes('export const'), 'Should export EventTypes');
  assert(code.includes('export interface'), 'Should export interfaces');
  assert(code.includes('export type'), 'Should export union type');
  console.log('✓ Test 12: TypeScript-valid output markers');
  passCount++;
} catch (e) {
  console.log(`✗ Test 12 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 13: EventHandler interface with lifecycle
 */
try {
  const code = generateEvents(blueprintWithLifecycle);
  const code2 = generateEvents(baseBlueprint);
  assert(
    code.includes('onItemStateChanged'),
    'Should include StateChanged handler in EventHandler'
  );
  assert(
    !code2.includes('onTestEntityStateChanged'),
    'Should not include StateChanged handler without lifecycle'
  );
  console.log('✓ Test 13: EventHandler interface conditional methods');
  passCount++;
} catch (e) {
  console.log(`✗ Test 13 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 14: Union type exists and is valid
 */
try {
  const code = generateEvents(baseBlueprint);
  assert(
    code.includes('export type TestEntityEvent ='),
    'Should export Event union type'
  );
  assert(
    code.includes('TestEntityCreatedEvent'),
    'Union should include CreatedEvent'
  );
  assert(
    code.includes('|'),
    'Union should use pipe operator'
  );
  console.log('✓ Test 14: Event union type present and valid');
  passCount++;
} catch (e) {
  console.log(`✗ Test 14 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 15: Required blueprint properties
 */
try {
  try {
    generateEvents({});
    throw new Error('Should reject empty blueprint');
  } catch (e) {
    assert(e.message.includes('Blueprint required'));
  }
  console.log('✓ Test 15: Requires valid blueprint');
  passCount++;
} catch (e) {
  console.log(`✗ Test 15 FAILED: ${e.message}`);
  failCount++;
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n═══════════════════════════════════════════════════════════════`);
console.log(`  Total:  ${passCount + failCount}`);
console.log(`  Passed: ${passCount} ✓`);
console.log(`  Failed: ${failCount} ✗`);
console.log(`═══════════════════════════════════════════════════════════════\n`);

if (failCount > 0) {
  process.exit(1);
}

process.exit(0);
