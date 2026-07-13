/**
 * TestRenderer.test.mjs
 *
 * Focused renderer-level validation for TestRenderer.mjs.
 * Run with: node tools/genesis/tests/TestRenderer.test.mjs
 *
 * Verifies:
 *  1. Renderer accepts a valid blueprint and returns a non-empty string
 *  2. No 'blueprint' undeclared variable references in generated output
 *  3. Required imports are present
 *  4. Required-field tests are generated from constraints
 *  5. Enum-rejection tests are generated from constraints
 *  6. Email-format tests are generated from constraints
 *  7. Instantiation test is always generated
 *  8. Output is deterministic (identical blueprint → identical bytes)
 *  9. Renderer throws on null/missing blueprint
 * 10. Entity with no validation constraints still produces a compilable stub
 */

import { generateTests } from '../compiler/renderers/TestRenderer.mjs';

// ---------------------------------------------------------------------------
// Minimal test harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function it(description, fn) {
  try {
    fn();
    console.log(`  ✓ ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${description}`);
    console.error(`      ${err.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? 'Assertion failed');
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    throw new Error(message ?? `Expected output to include: ${JSON.stringify(needle)}`);
  }
}

function assertNotIncludes(haystack, needle, message) {
  if (haystack.includes(needle)) {
    throw new Error(message ?? `Expected output NOT to include: ${JSON.stringify(needle)}`);
  }
}

// ---------------------------------------------------------------------------
// Fixture blueprints
// ---------------------------------------------------------------------------

/**
 * Full fixture: Customer-like entity with required, enum, and email constraints.
 */
const FULL_BLUEPRINT = {
  metadata: {
    entity: 'Customer',
    displayName: 'Customer',
    namespace: 'crm',
  },
  fields: {
    all: [
      { name: 'id', type: 'identifier', required: true, generated: true, unique: true, readonly: false },
      { name: 'email', type: 'email', required: true, generated: false, unique: true, readonly: false, maxLength: 255 },
      { name: 'name', type: 'string', required: true, generated: false, unique: false, readonly: false, maxLength: 255 },
      { name: 'status', type: 'enum', required: false, generated: false, unique: false, readonly: false, values: ['PROSPECT', 'ACTIVE', 'INACTIVE', 'CHURNED'] },
      { name: 'createdAt', type: 'timestamp', required: false, generated: true, unique: false, readonly: true },
    ],
    required: [],
    unique: [],
    generated: [],
  },
  validation: {
    enabled: true,
    constraints: {
      required: [
        { field: 'email', type: 'required', message: 'email is required' },
        { field: 'name', type: 'required', message: 'name is required' },
      ],
      email: [
        { field: 'email', type: 'email', message: 'email must be a valid email address' },
      ],
      enum: [
        { field: 'status', type: 'enum', values: ['PROSPECT', 'ACTIVE', 'INACTIVE', 'CHURNED'], message: 'status must be one of: PROSPECT, ACTIVE, INACTIVE, CHURNED' },
      ],
      length: [],
      unique: [],
      range: [],
      format: [],
      type: [],
      relationships: [],
    },
    custom: [],
    messages: {},
  },
};

/**
 * Minimal fixture: entity with no validation constraints.
 */
const MINIMAL_BLUEPRINT = {
  metadata: {
    entity: 'Vendor',
    displayName: 'Vendor',
    namespace: 'procurement',
  },
  fields: {
    all: [
      { name: 'id', type: 'identifier', required: true, generated: true, unique: true, readonly: false },
    ],
    required: [],
    unique: [],
    generated: [],
  },
  validation: {
    enabled: false,
    constraints: {
      required: [],
      email: [],
      enum: [],
      length: [],
      unique: [],
      range: [],
      format: [],
      type: [],
      relationships: [],
    },
    custom: [],
    messages: {},
  },
};

/**
 * WorkOrder-like fixture: many required enum fields.
 */
const WORKORDER_BLUEPRINT = {
  metadata: {
    entity: 'WorkOrder',
    displayName: 'Work Order',
    namespace: 'service',
  },
  fields: {
    all: [
      { name: 'id', type: 'identifier', required: true, generated: true, unique: true, readonly: false },
      { name: 'title', type: 'string', required: true, generated: false, unique: false, readonly: false, maxLength: 255 },
      { name: 'priority', type: 'enum', required: true, generated: false, unique: false, readonly: false, values: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      { name: 'status', type: 'enum', required: true, generated: false, unique: false, readonly: false, values: ['DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED'] },
    ],
    required: [],
    unique: [],
    generated: [],
  },
  validation: {
    enabled: true,
    constraints: {
      required: [
        { field: 'title', type: 'required', message: 'title is required' },
        { field: 'priority', type: 'required', message: 'priority is required' },
        { field: 'status', type: 'required', message: 'status is required' },
      ],
      email: [],
      enum: [
        { field: 'priority', type: 'enum', values: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], message: 'priority must be one of: ...' },
        { field: 'status', type: 'enum', values: ['DRAFT', 'SUBMITTED', 'IN_PROGRESS', 'COMPLETED'], message: 'status must be one of: ...' },
      ],
      length: [],
      unique: [],
      range: [],
      format: [],
      type: [],
      relationships: [],
    },
    custom: [],
    messages: {},
  },
};

// ---------------------------------------------------------------------------
// Test cases
// ---------------------------------------------------------------------------

console.log('\nTestRenderer Unit Tests');
console.log('═'.repeat(50));

// ── 1. Basic output ──────────────────────────────────────────────────────────
console.log('\n  Generator output');

it('returns a non-empty string for a full blueprint', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assert(typeof out === 'string', 'output must be a string');
  assert(out.trim().length > 0, 'output must be non-empty');
});

it('ends with a newline (consistent line endings)', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assert(out.endsWith('\n'), 'output must end with newline');
});

// ── 2. No undeclared blueprint reference ─────────────────────────────────────
console.log('\n  No undeclared blueprint variable');

it('does not reference `blueprint` anywhere in generated code', () => {
  const out = generateTests(FULL_BLUEPRINT);
  // The word 'blueprint' may appear only in the JSDoc @generated header comment
  // but never as a standalone JS identifier in executable code.
  const codeLines = out.split('\n').filter(line => {
    // Exclude comment lines
    const trimmed = line.trim();
    return !trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
  });
  const executableCode = codeLines.join('\n');
  assertNotIncludes(
    executableCode,
    'blueprint',
    'Generated executable code must not reference the undefined `blueprint` variable',
  );
});

it('does not reference `blueprint` for minimal (no-constraint) blueprint', () => {
  const out = generateTests(MINIMAL_BLUEPRINT);
  const executableLines = out.split('\n')
    .filter(l => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/*'))
    .join('\n');
  assertNotIncludes(executableLines, 'blueprint');
});

// ── 3. Imports ───────────────────────────────────────────────────────────────
console.log('\n  Import declarations');

it('imports describe, it, expect, beforeEach from @jest/globals', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `import { describe, it, expect, beforeEach } from '@jest/globals';`);
});

it('imports the EntityName Validator class', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `import { CustomerValidator } from './CustomerValidator';`);
});

it('imports ValidationResult as a type', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `import type { ValidationResult } from './CustomerValidator';`);
});

it('uses entity name from blueprint.metadata.entity for validator import path', () => {
  const out = generateTests(WORKORDER_BLUEPRINT);
  assertIncludes(out, `import { WorkOrderValidator } from './WorkOrderValidator';`);
});

// ── 4. Instantiation test ─────────────────────────────────────────────────────
console.log('\n  Instantiation tests (always present)');

it('always generates an instantiation describe block', () => {
  const full = generateTests(FULL_BLUEPRINT);
  const minimal = generateTests(MINIMAL_BLUEPRINT);
  assertIncludes(full, `describe('Instantiation',`);
  assertIncludes(minimal, `describe('Instantiation',`);
});

it('generates "should create a [Entity]Validator instance" test', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `should create a CustomerValidator instance`);
});

it('instantiation test uses new expression for validator', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `new CustomerValidator()`);
});

// ── 5. Constraint tests ───────────────────────────────────────────────────────
console.log('\n  Constraint-based tests');

it('generates happy-path test when required constraints exist', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `should validate valid Customer data`);
});

it('happy-path test uses hardcoded email fixture', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `test@example.com`);
});

it('generates required-field rejection test for each required constraint', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `should reject missing required field: email`);
  assertIncludes(out, `should reject missing required field: name`);
});

it('generates enum-rejection test for each enum constraint', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `should reject invalid enum value for status`);
});

it('generates email-format rejection test for each email constraint', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `should reject invalid email format for email`);
});

it('enum rejection test uses INVALID_ENUM_VALUE sentinel', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `INVALID_ENUM_VALUE`);
});

it('email rejection test uses non-email string', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `not-an-email`);
});

it('WorkOrder generates required-field tests for title, priority, status', () => {
  const out = generateTests(WORKORDER_BLUEPRINT);
  assertIncludes(out, `should reject missing required field: title`);
  assertIncludes(out, `should reject missing required field: priority`);
  assertIncludes(out, `should reject missing required field: status`);
});

it('WorkOrder enum valid fixture uses first enum value (LOW for priority)', () => {
  const out = generateTests(WORKORDER_BLUEPRINT);
  assertIncludes(out, `"LOW"`);
});

// ── 6. Minimal blueprint (no validation) ─────────────────────────────────────
console.log('\n  Minimal blueprint (no validation constraints)');

it('generates valid output for entity with no validation enabled', () => {
  const out = generateTests(MINIMAL_BLUEPRINT);
  assert(typeof out === 'string' && out.length > 0);
});

it('does not generate Validation Constraints describe block when none exist', () => {
  const out = generateTests(MINIMAL_BLUEPRINT);
  assertNotIncludes(out, `describe('Validation Constraints',`);
});

it('still generates instantiation test for minimal entity', () => {
  const out = generateTests(MINIMAL_BLUEPRINT);
  assertIncludes(out, `should create a VendorValidator instance`);
});

// ── 7. Determinism ────────────────────────────────────────────────────────────
console.log('\n  Determinism');

it('produces identical output on two consecutive calls with the same blueprint', () => {
  const a = generateTests(FULL_BLUEPRINT);
  const b = generateTests(FULL_BLUEPRINT);
  assert(a === b, 'Output must be byte-for-byte identical on repeated calls');
});

it('produces identical output for WorkOrder blueprint on repeated calls', () => {
  const a = generateTests(WORKORDER_BLUEPRINT);
  const b = generateTests(WORKORDER_BLUEPRINT);
  assert(a === b, 'WorkOrder output must be byte-for-byte identical on repeated calls');
});

it('produces different output for different blueprints', () => {
  const a = generateTests(FULL_BLUEPRINT);
  const b = generateTests(MINIMAL_BLUEPRINT);
  assert(a !== b, 'Different blueprints must produce different output');
});

// ── 8. Error handling ─────────────────────────────────────────────────────────
console.log('\n  Error handling');

it('throws when blueprint is null', () => {
  let threw = false;
  try { generateTests(null); } catch { threw = true; }
  assert(threw, 'Must throw on null blueprint');
});

it('throws when blueprint has no metadata', () => {
  let threw = false;
  try { generateTests({ fields: { all: [] } }); } catch { threw = true; }
  assert(threw, 'Must throw when metadata is missing');
});

// ── 9. TypeScript validity markers ────────────────────────────────────────────
console.log('\n  TypeScript validity markers');

it('types the result variable as ValidationResult', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, `result: ValidationResult`);
});

it('uses beforeEach to initialise validator (not a global)', () => {
  const out = generateTests(FULL_BLUEPRINT);
  assertIncludes(out, 'beforeEach(() => {');
});

it('does not use any implicit any (arrow parameter lacks annotation only when typed from ValidationResult)', () => {
  const out = generateTests(FULL_BLUEPRINT);
  // The only lambda in the output is `e => e.includes(...)` where e is
  // inferred as string from errors: string[]. Verify the pattern exists.
  assertIncludes(out, `e => e.includes(`);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + '═'.repeat(50));
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(50) + '\n');

if (failed > 0) {
  process.exit(1);
}
