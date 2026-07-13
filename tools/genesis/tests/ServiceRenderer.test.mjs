/**
 * ServiceRenderer.test.mjs
 *
 * Focused renderer-level validation for ServiceRenderer.mjs.
 * Run with: node tools/genesis/tests/ServiceRenderer.test.mjs
 *
 * Verifies:
 *  1. Renderer produces non-empty string output
 *  2. Imports from ./[Entity]Repository and ./[Entity]Validator (same dir)
 *  3. No imports from infrastructure/audit, domain/entities, or subdirectories
 *  4. AuditEvent, AuditLogger, RequestContext declared in-file
 *  5. Service class is exported
 *  6. private readonly injected dependencies
 *  7. audit is optional in constructor (AuditLogger?)
 *  8. get(), list(), create(), update(), delete(), count() methods generated
 *  9. get() throws when entity not found (=== null check)
 * 10. create() validates input before persisting
 * 11. update() validates input before persisting
 * 12. Audit log calls emitted only when hasAudit = true
 * 13. Lifecycle canTransitionTo(), transitionTo() generated when transitions exist
 * 14. Lifecycle cast uses as unknown as Record<string, unknown>
 * 15. Convenience transition methods generated per unique toState
 * 16. No lifecycle methods when transitions are empty
 * 17. Determinism: identical blueprint => identical bytes
 * 18. Legacy (entityName, fields, capabilities, lifecycle) signature works
 * 19. Renderer throws on null blueprint
 * 20. Generated file ends with newline
 */

import { generateService } from '../compiler/renderers/ServiceRenderer.mjs';

// ---------------------------------------------------------------------------
// Test harness
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg ?? 'Assertion failed');
}

function assertIncludes(haystack, needle, msg) {
  if (!haystack.includes(needle)) throw new Error(msg ?? `Expected: ${JSON.stringify(needle)}`);
}

function assertNotIncludes(haystack, needle, msg) {
  if (haystack.includes(needle)) throw new Error(msg ?? `Must not include: ${JSON.stringify(needle)}`);
}

// ---------------------------------------------------------------------------
// Fixture blueprints
// ---------------------------------------------------------------------------

const FULL_BLUEPRINT = {
  metadata: { entity: 'Customer', displayName: 'Customer', namespace: 'crm' },
  capabilities: { audit: { enabled: true } },
  lifecycle: {
    states: { PROSPECT: {}, ACTIVE: {}, INACTIVE: {} },
    transitions: [
      { from: 'PROSPECT', to: 'ACTIVE' },
      { from: 'ACTIVE', to: 'INACTIVE' },
      { from: 'INACTIVE', to: 'ACTIVE' },
    ],
    initial: 'PROSPECT',
  },
};

const NO_AUDIT_BLUEPRINT = {
  metadata: { entity: 'Vendor', displayName: 'Vendor', namespace: 'procurement' },
  capabilities: { audit: { enabled: false } },
  lifecycle: { states: {}, transitions: [], initial: 'ACTIVE' },
};

const NO_LIFECYCLE_BLUEPRINT = {
  metadata: { entity: 'Asset', displayName: 'Asset', namespace: 'ops' },
  capabilities: { audit: { enabled: true } },
  lifecycle: { states: {}, transitions: [] },
};

const WORKORDER_BLUEPRINT = {
  metadata: { entity: 'WorkOrder', displayName: 'WorkOrder', namespace: 'service' },
  capabilities: { audit: { enabled: true } },
  lifecycle: {
    states: { DRAFT: {}, SUBMITTED: {}, IN_PROGRESS: {}, COMPLETED: {} },
    transitions: [
      { from: 'DRAFT', to: 'SUBMITTED' },
      { from: 'SUBMITTED', to: 'IN_PROGRESS' },
      { from: 'IN_PROGRESS', to: 'COMPLETED' },
    ],
    initial: 'DRAFT',
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\nServiceRenderer Unit Tests');
console.log('═'.repeat(50));

// ── 1. Basic output ──────────────────────────────────────────────────────────
console.log('\n  Generator output');

it('returns a non-empty string', () => {
  assert(typeof generateService(FULL_BLUEPRINT) === 'string');
  assert(generateService(FULL_BLUEPRINT).length > 0);
});

it('ends with a newline', () => {
  assert(generateService(FULL_BLUEPRINT).endsWith('\n'));
});

// ── 2. Import correctness ─────────────────────────────────────────────────────
console.log('\n  Import paths');

it('imports CustomerRepository from ./CustomerRepository (same dir)', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), "import { CustomerRepository } from './CustomerRepository';");
});

it('imports CustomerRecord as a type from ./CustomerRepository', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), "import type { CustomerRecord } from './CustomerRepository';");
});

it('imports CustomerValidator from ./CustomerValidator (same dir)', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), "import { CustomerValidator } from './CustomerValidator';");
});

it('does NOT import from ../infrastructure/audit', () => {
  assertNotIncludes(generateService(FULL_BLUEPRINT), '../infrastructure/audit');
});

it('does NOT import from ../domain/entities', () => {
  assertNotIncludes(generateService(FULL_BLUEPRINT), '../domain/entities');
});

it('does NOT import from ../repositories', () => {
  assertNotIncludes(generateService(FULL_BLUEPRINT), '../repositories/');
});

it('does NOT import from ../validators', () => {
  assertNotIncludes(generateService(FULL_BLUEPRINT), '../validators/');
});

// ── 3. In-file interfaces ─────────────────────────────────────────────────────
console.log('\n  In-file interface declarations');

it('declares AuditEvent interface', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'export interface AuditEvent {');
});

it('AuditEvent has required fields', () => {
  const out = generateService(FULL_BLUEPRINT);
  assertIncludes(out, 'entity: string;');
  assertIncludes(out, 'entityId: string;');
  assertIncludes(out, 'action: string;');
  assertIncludes(out, 'timestamp: Date;');
});

it('declares AuditLogger interface', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'export interface AuditLogger {');
});

it('declares RequestContext interface', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'export interface RequestContext {');
});

// ── 4. Class structure ────────────────────────────────────────────────────────
console.log('\n  Class structure');

it('exports CustomerService class', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'export class CustomerService {');
});

it('repository is private readonly', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'private readonly repository: CustomerRepository;');
});

it('validator is private readonly', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'private readonly validator: CustomerValidator;');
});

it('audit is optional (private readonly audit?)', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'private readonly audit?: AuditLogger;');
});

it('audit constructor param is optional (audit?: AuditLogger)', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'audit?: AuditLogger');
});

// ── 5. CRUD methods ───────────────────────────────────────────────────────────
console.log('\n  CRUD methods');

it('generates get() returning Promise<CustomerRecord>', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'async get(id: string): Promise<CustomerRecord>');
});

it('get() throws when entity === null', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'if (entity === null) {');
});

it('generates list() returning Promise<CustomerRecord[]>', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'async list(limit: number = 100, offset: number = 0): Promise<CustomerRecord[]>');
});

it('generates create() with Partial<CustomerRecord>', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'async create(input: Partial<CustomerRecord>, context?: RequestContext): Promise<CustomerRecord>');
});

it('create() validates before persisting', () => {
  const out = generateService(FULL_BLUEPRINT);
  const createIdx = out.indexOf('async create(');
  const repoIdx = out.indexOf('this.repository.create(', createIdx);
  const validIdx = out.indexOf('this.validator.validate(', createIdx);
  assert(validIdx < repoIdx, 'Validation must occur before repository.create');
});

it('generates update() with Partial<CustomerRecord>', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'async update(id: string, input: Partial<CustomerRecord>, context?: RequestContext): Promise<CustomerRecord>');
});

it('generates delete() with optional context', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'async delete(id: string, context?: RequestContext): Promise<void>');
});

it('generates count() returning Promise<number>', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'async count(): Promise<number>');
});

// ── 6. Audit logging ──────────────────────────────────────────────────────────
console.log('\n  Audit logging');

it('emits audit?.log() in create() when audit enabled', () => {
  const out = generateService(FULL_BLUEPRINT);
  const createIdx = out.indexOf('async create(');
  const auditIdx = out.indexOf('await this.audit?.log(', createIdx);
  const nextMethod = out.indexOf('async update(', createIdx);
  assert(auditIdx > createIdx && auditIdx < nextMethod, 'audit.log must be inside create()');
});

it('does NOT emit audit?.log() in create() when audit disabled', () => {
  const out = generateService(NO_AUDIT_BLUEPRINT);
  const createIdx = out.indexOf('async create(');
  const nextMethod = out.indexOf('async update(', createIdx);
  const auditIdx = out.indexOf('await this.audit?.log(', createIdx);
  assert(auditIdx === -1 || auditIdx > nextMethod, 'audit.log must not appear in create() when disabled');
});

// ── 7. Lifecycle methods ───────────────────────────────────────────────────────
console.log('\n  Lifecycle methods');

it('generates canTransitionTo() when transitions exist', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'async canTransitionTo(id: string, toState: string): Promise<boolean>');
});

it('generates transitionTo() when transitions exist', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'async transitionTo(id: string, toState: string, context?: RequestContext): Promise<CustomerRecord>');
});

it('lifecycle cast uses as unknown as Record<string, unknown>', () => {
  assertIncludes(generateService(FULL_BLUEPRINT), 'entity as unknown as Record<string, unknown>');
  assertNotIncludes(generateService(FULL_BLUEPRINT), 'entity as Record<string, unknown>');
});

it('generates convenience method for each unique toState', () => {
  const out = generateService(FULL_BLUEPRINT);
  assertIncludes(out, 'async active(');
  assertIncludes(out, 'async inactive(');
});

it('does NOT generate lifecycle methods when transitions are empty', () => {
  const out = generateService(NO_LIFECYCLE_BLUEPRINT);
  assertNotIncludes(out, 'canTransitionTo');
  assertNotIncludes(out, 'transitionTo');
});

it('does NOT generate lifecycle methods when no lifecycle', () => {
  const out = generateService(NO_AUDIT_BLUEPRINT);
  assertNotIncludes(out, 'canTransitionTo');
  assertNotIncludes(out, 'transitionTo');
});

it('WorkOrder generates SUBMITTED, IN_PROGRESS, COMPLETED convenience methods', () => {
  const out = generateService(WORKORDER_BLUEPRINT);
  assertIncludes(out, 'async submitted(');
  assertIncludes(out, 'async in_progress(');
  assertIncludes(out, 'async completed(');
});

// ── 8. Determinism ───────────────────────────────────────────────────────────
console.log('\n  Determinism');

it('produces identical output on two calls (Customer)', () => {
  assert(generateService(FULL_BLUEPRINT) === generateService(FULL_BLUEPRINT));
});

it('produces identical output on two calls (WorkOrder)', () => {
  assert(generateService(WORKORDER_BLUEPRINT) === generateService(WORKORDER_BLUEPRINT));
});

it('produces different output for different blueprints', () => {
  assert(generateService(FULL_BLUEPRINT) !== generateService(NO_AUDIT_BLUEPRINT));
});

// ── 9. Legacy signature ───────────────────────────────────────────────────────
console.log('\n  Legacy signature');

it('accepts legacy (entityName, fields, capabilities, lifecycle) signature', () => {
  const out = generateService('LegacyEntity', [], {}, { states: {}, transitions: [] });
  assert(typeof out === 'string' && out.length > 0);
});

it('legacy signature generates correct class name', () => {
  const out = generateService('LegacyEntity', [], {}, { states: {}, transitions: [] });
  assertIncludes(out, 'export class LegacyEntityService {');
});

// ── 10. Error handling ────────────────────────────────────────────────────────
console.log('\n  Error handling');

it('throws on null blueprint', () => {
  let threw = false;
  try { generateService(null); } catch { threw = true; }
  assert(threw);
});

it('throws on blueprint without metadata', () => {
  let threw = false;
  try { generateService({ capabilities: {} }); } catch { threw = true; }
  assert(threw);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log('\n' + '═'.repeat(50));
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('═'.repeat(50) + '\n');

if (failed > 0) process.exit(1);
