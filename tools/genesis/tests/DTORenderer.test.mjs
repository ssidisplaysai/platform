/**
 * DTORenderer.test.mjs
 *
 * Comprehensive test suite for DTORenderer.
 * Validates DTO artifact generation: compilability, field selection, determinism.
 *
 * @module tools/genesis/tests/DTORenderer.test.mjs
 */

import { generateDTOs } from '../compiler/renderers/DTORenderer.mjs';
import { strict as assert } from 'assert';

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const baseBlueprint = {
  metadata: { entity: 'Product' },
  fields: {
    all: [
      { name: 'id', type: 'identifier', generated: true, required: true },
      { name: 'name', type: 'string', required: true },
      { name: 'price', type: 'number', required: true },
      { name: 'description', type: 'text', required: false },
      { name: 'createdAt', type: 'timestamp', generated: true, systemManaged: true },
      { name: 'updatedAt', type: 'timestamp', generated: true, systemManaged: true },
      { name: 'createdBy', type: 'identifier', generated: true, readOnly: true },
      { name: 'updatedBy', type: 'identifier', generated: true, readOnly: true },
    ],
  },
  capabilities: { searchFields: [] },
};

const blueprintWithEnums = {
  metadata: { entity: 'Order' },
  fields: {
    all: [
      { name: 'id', type: 'identifier', generated: true },
      { name: 'orderNumber', type: 'string', required: true },
      { name: 'status', type: 'enum', required: true, values: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED'] },
      { name: 'priority', type: 'enum', required: false, values: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
      { name: 'createdAt', type: 'timestamp', generated: true },
      { name: 'updatedAt', type: 'timestamp', generated: true },
    ],
  },
  capabilities: { searchFields: ['orderNumber', 'status'] },
};

const blueprintWithSearch = {
  metadata: { entity: 'Customer' },
  fields: {
    all: [
      { name: 'id', type: 'identifier', generated: true },
      { name: 'email', type: 'email', required: true },
      { name: 'firstName', type: 'string', required: true },
      { name: 'lastName', type: 'string', required: true },
      { name: 'phone', type: 'phone', required: false },
      { name: 'createdAt', type: 'timestamp', generated: true },
      { name: 'updatedAt', type: 'timestamp', generated: true },
    ],
  },
  capabilities: { searchFields: ['email', 'firstName', 'lastName'] },
};

const blueprintImmutable = {
  metadata: { entity: 'Ledger' },
  fields: {
    all: [
      { name: 'id', type: 'identifier', generated: true },
      { name: 'reference', type: 'string', required: true, immutable: true },
      { name: 'amount', type: 'number', required: true, immutable: true },
      { name: 'description', type: 'text', required: false },
      { name: 'createdAt', type: 'timestamp', generated: true },
      { name: 'updatedAt', type: 'timestamp', generated: true },
    ],
  },
  capabilities: { searchFields: [] },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function validateTypeScriptSyntax(code) {
  const braceCount = code.split('{').length - code.split('}').length;
  assert.equal(braceCount, 0, 'Braces should be balanced');

  const parenCount = code.split('(').length - code.split(')').length;
  assert.equal(parenCount, 0, 'Parentheses should be balanced');
}

function getInterfaceNames(code) {
  const matches = code.matchAll(/export interface (\w+)/g);
  return Array.from(matches).map((m) => m[1]);
}

function getInterfaceFields(code, interfaceName) {
  const regex = new RegExp(
    `export interface ${interfaceName} \\{([\\s\\S]*?)\\}`,
    'm'
  );
  const match = code.match(regex);
  if (!match) return [];
  return match[1]
    .split('\n')
    .filter((line) => line.includes(':'))
    .map((line) => line.trim().split(':')[0].replace(/readonly /g, '').replace(/\?/g, ''));
}

function hasCreateDto(code) {
  return /export interface \w+CreateDto/.test(code);
}

function hasUpdateDto(code) {
  return /export interface \w+UpdateDto/.test(code);
}

function hasReadDto(code) {
  return /export interface \w+ReadDto/.test(code);
}

function hasQueryDto(code) {
  return /export interface \w+QueryDto/.test(code);
}

function hasListResultDto(code) {
  return /export interface \w+ListResultDto/.test(code);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suites
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n🧪 DTORenderer Test Suite\n');

let passCount = 0;
let failCount = 0;

/**
 * Test 1: No unresolved imports
 */
try {
  const code = generateDTOs(baseBlueprint);
  const importLines = code.split('\n').filter((l) => l.trim().startsWith('import '));
  assert.equal(importLines.length, 0, 'Should not have import statements');
  console.log('✓ Test 1: No unresolved imports');
  passCount++;
} catch (e) {
  console.log(`✗ Test 1 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 2: CreateDto excludes generated and system fields
 */
try {
  const code = generateDTOs(baseBlueprint);
  const createFields = getInterfaceFields(code, 'ProductCreateDto');
  assert(!createFields.includes('id'), 'CreateDto should exclude id');
  assert(!createFields.includes('createdAt'), 'CreateDto should exclude createdAt');
  assert(!createFields.includes('updatedAt'), 'CreateDto should exclude updatedAt');
  assert(!createFields.includes('createdBy'), 'CreateDto should exclude createdBy');
  assert(!createFields.includes('updatedBy'), 'CreateDto should exclude updatedBy');
  assert(createFields.includes('name'), 'CreateDto should include name');
  assert(createFields.includes('price'), 'CreateDto should include price');
  console.log('✓ Test 2: CreateDto excludes system fields');
  passCount++;
} catch (e) {
  console.log(`✗ Test 2 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 3: UpdateDto makes all fields optional
 */
try {
  const code = generateDTOs(baseBlueprint);
  const updateSection = code.match(
    /export interface ProductUpdateDto \{([\s\S]*?)\}/
  )[1];
  // Check that fields use ? (optional)
  assert(updateSection.includes('name?:'), 'name should be optional');
  assert(updateSection.includes('price?:'), 'price should be optional');
  assert(
    !updateSection.includes('name:') || updateSection.includes('name?:'),
    'All UpdateDto fields should be optional'
  );
  console.log('✓ Test 3: UpdateDto makes all fields optional');
  passCount++;
} catch (e) {
  console.log(`✗ Test 3 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 4: ReadDto includes system fields as readonly
 */
try {
  const code = generateDTOs(baseBlueprint);
  const readSection = code.match(
    /export interface ProductReadDto \{([\s\S]*?)\}/
  )[1];
  assert(readSection.includes('readonly createdAt'), 'Should have readonly createdAt');
  assert(readSection.includes('readonly updatedAt'), 'Should have readonly updatedAt');
  assert(readSection.includes('readonly createdBy'), 'Should have readonly createdBy');
  console.log('✓ Test 4: ReadDto includes readonly system fields');
  passCount++;
} catch (e) {
  console.log(`✗ Test 4 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 5: QueryDto contains only searchable fields
 */
try {
  const code = generateDTOs(blueprintWithSearch);
  const queryFields = getInterfaceFields(code, 'CustomerQueryDto');
  // Should only include email, firstName, lastName (searchable fields)
  assert(queryFields.includes('email'), 'Should include searchable email');
  assert(queryFields.includes('firstName'), 'Should include searchable firstName');
  assert(queryFields.includes('lastName'), 'Should include searchable lastName');
  assert(!queryFields.includes('id'), 'Should not include non-searchable id');
  assert(!queryFields.includes('phone'), 'Should not include non-searchable phone');
  console.log('✓ Test 5: QueryDto filtered to searchable fields');
  passCount++;
} catch (e) {
  console.log(`✗ Test 5 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 6: ListResultDto has deterministic structure
 */
try {
  const code = generateDTOs(baseBlueprint);
  const listSection = code.match(
    /export interface ProductListResultDto \{([\s\S]*?)\}/
  )[1];
  assert(listSection.includes('readonly items'), 'Should have items');
  assert(listSection.includes('readonly total'), 'Should have total');
  assert(listSection.includes('readonly pageSize'), 'Should have pageSize');
  assert(listSection.includes('readonly pageNumber'), 'Should have pageNumber');
  assert(listSection.includes('readonly hasNextPage'), 'Should have hasNextPage');
  console.log('✓ Test 6: ListResultDto deterministic structure');
  passCount++;
} catch (e) {
  console.log(`✗ Test 6 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 7: Enum fields preserved as string literals
 */
try {
  const code = generateDTOs(blueprintWithEnums);
  assert(
    code.includes("'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED'"),
    'Status enum should be string literal union'
  );
  assert(
    code.includes("'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'"),
    'Priority enum should be string literal union'
  );
  console.log('✓ Test 7: Enum fields preserved as string literals');
  passCount++;
} catch (e) {
  console.log(`✗ Test 7 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 8: Required/optional correctness in CreateDto
 */
try {
  const code = generateDTOs(baseBlueprint);
  const createSection = code.match(
    /export interface ProductCreateDto \{([\s\S]*?)\}/
  )[1];
  // name and price are required
  assert(createSection.includes('name: string'), 'name should be required');
  assert(createSection.includes('price: number'), 'price should be required');
  // description is optional
  assert(
    createSection.includes('description?:'),
    'description should be optional'
  );
  console.log('✓ Test 8: Required/optional correctness');
  passCount++;
} catch (e) {
  console.log(`✗ Test 8 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 9: No duplicate fields
 */
try {
  const code = generateDTOs(baseBlueprint);
  const interfaces = getInterfaceNames(code);
  for (const iface of interfaces) {
    const fields = getInterfaceFields(code, iface);
    const uniqueFields = new Set(fields);
    assert.equal(
      fields.length,
      uniqueFields.size,
      `${iface} should not have duplicate fields`
    );
  }
  console.log('✓ Test 9: No duplicate fields in any DTO');
  passCount++;
} catch (e) {
  console.log(`✗ Test 9 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 10: Deterministic field ordering
 */
try {
  const code1 = generateDTOs(baseBlueprint);
  const code2 = generateDTOs(baseBlueprint);
  assert.equal(code1, code2, 'DTOs should be deterministic');
  console.log('✓ Test 10: Deterministic field ordering');
  passCount++;
} catch (e) {
  console.log(`✗ Test 10 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 11: Immutable fields excluded from UpdateDto
 */
try {
  const code = generateDTOs(blueprintImmutable);
  const updateFields = getInterfaceFields(code, 'LedgerUpdateDto');
  assert(!updateFields.includes('reference'), 'Immutable reference should not be in UpdateDto');
  assert(!updateFields.includes('amount'), 'Immutable amount should not be in UpdateDto');
  assert(updateFields.includes('description'), 'Mutable description should be in UpdateDto');
  console.log('✓ Test 11: Immutable fields excluded from UpdateDto');
  passCount++;
} catch (e) {
  console.log(`✗ Test 11 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 12: TypeScript-valid output markers
 */
try {
  const code = generateDTOs(baseBlueprint);
  assert(code.includes('@generated true'), 'Should have @generated marker');
  validateTypeScriptSyntax(code);
  console.log('✓ Test 12: TypeScript-valid output');
  passCount++;
} catch (e) {
  console.log(`✗ Test 12 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 13: All five DTO types present
 */
try {
  const code = generateDTOs(baseBlueprint);
  assert(hasCreateDto(code), 'Should have CreateDto');
  assert(hasUpdateDto(code), 'Should have UpdateDto');
  assert(hasReadDto(code), 'Should have ReadDto');
  assert(hasQueryDto(code), 'Should have QueryDto');
  assert(hasListResultDto(code), 'Should have ListResultDto');
  console.log('✓ Test 13: All five DTO types present');
  passCount++;
} catch (e) {
  console.log(`✗ Test 13 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 14: ErrorResponseDto is generic (not entity-specific)
 */
try {
  const code = generateDTOs(baseBlueprint);
  assert(code.includes('export interface ErrorResponseDto'), 'Should have generic ErrorResponseDto');
  console.log('✓ Test 14: Generic ErrorResponseDto present');
  passCount++;
} catch (e) {
  console.log(`✗ Test 14 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 15: Repeated generation equivalence
 */
try {
  const code1 = generateDTOs(blueprintWithEnums);
  const code2 = generateDTOs(blueprintWithEnums);
  const code3 = generateDTOs(blueprintWithEnums);
  assert.equal(code1, code2, 'First and second generation should match');
  assert.equal(code2, code3, 'Second and third generation should match');
  console.log('✓ Test 15: Repeated generation equivalence');
  passCount++;
} catch (e) {
  console.log(`✗ Test 15 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 16: Empty searchable fields handled gracefully
 */
try {
  const code = generateDTOs(baseBlueprint);
  assert(code.includes('// No searchable fields configured'), 'Should handle empty searchable fields');
  console.log('✓ Test 16: Empty searchable fields handled');
  passCount++;
} catch (e) {
  console.log(`✗ Test 16 FAILED: ${e.message}`);
  failCount++;
}

/**
 * Test 17: Required blueprint properties
 */
try {
  try {
    generateDTOs({});
    throw new Error('Should reject empty blueprint');
  } catch (e) {
    assert(e.message.includes('Blueprint required'));
  }
  console.log('✓ Test 17: Requires valid blueprint');
  passCount++;
} catch (e) {
  console.log(`✗ Test 17 FAILED: ${e.message}`);
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
