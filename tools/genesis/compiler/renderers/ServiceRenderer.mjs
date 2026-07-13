/**
 * ServiceRenderer
 *
 * Generates self-contained, compilable service/business logic code from
 * EnterpriseObjectBlueprint.
 *
 * All types required by the generated file are declared within the file or
 * imported from co-generated files that reside in the same output directory.
 * No imports from non-existent infrastructure or domain modules are emitted.
 *
 * Consumes: EnterpriseObjectBlueprint (compiler IR)
 * Produces: TypeScript Service class
 *
 * CONTRACT GUARANTEES
 * - Imports only from ./[Entity]Repository and ./[Entity]Validator (same dir)
 * - No AuditService, no domain entity class, no infrastructure imports
 * - AuditLogger, AuditEvent, RequestContext declared in-file
 * - All CRUD signatures typed against [Entity]Record from the repository
 * - Lifecycle transition methods use generic Record access for status field
 * - Audit dependency is optional; service operates without it
 * - private readonly for all injected dependencies
 * - Deterministic: identical blueprint -> identical byte-for-byte output
 *
 * @module tools/genesis/compiler/renderers/ServiceRenderer
 */

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function toCamelCase(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : '';
}

function getInitialStatus(lifecycle) {
  if (!lifecycle || !lifecycle.states) return 'ACTIVE';
  const states = Object.keys(lifecycle.states);
  return states.includes('ACTIVE') ? 'ACTIVE' : (states[0] || 'ACTIVE');
}

// ---------------------------------------------------------------------------
// Main renderer export
// ---------------------------------------------------------------------------

/**
 * Generate service class code from blueprint.
 * Supports both old (entityName, fields, capabilities, lifecycle) and
 * new (blueprint) signatures for backward compatibility.
 *
 * @param {Object|string} blueprint - EnterpriseObjectBlueprint or (legacy) entityName
 * @param {Array}  [fields]       - (legacy) field definitions
 * @param {Object} [capabilities] - (legacy) capabilities
 * @param {Object} [lifecycle]    - (legacy) lifecycle
 * @returns {string} Generated TypeScript source code
 */
export function generateService(blueprint, fields, capabilities, lifecycle) {
  let entityName, serviceCapabilities, serviceLifecycle;

  if (typeof blueprint === 'string') {
    entityName = blueprint;
    serviceCapabilities = capabilities || {};
    serviceLifecycle = lifecycle || { states: {}, transitions: [] };
  } else {
    if (!blueprint || !blueprint.metadata) {
      throw new Error('Blueprint required for service generation');
    }
    entityName = blueprint.metadata.entity;
    serviceCapabilities = blueprint.capabilities || {};
    serviceLifecycle = blueprint.lifecycle || { states: {}, transitions: [] };
  }

  return _generateServiceCode(entityName, serviceCapabilities, serviceLifecycle);
}

// ---------------------------------------------------------------------------
// Code generator
// ---------------------------------------------------------------------------

function _generateServiceCode(entityName, capabilities, lifecycle) {
  const camelCase = toCamelCase(entityName);
  const recordName = entityName + 'Record';
  const repoName = entityName + 'Repository';
  const validatorName = entityName + 'Validator';

  const hasAudit = !!(capabilities && capabilities.audit && capabilities.audit.enabled);
  const hasTransitions = !!(
    lifecycle && Array.isArray(lifecycle.transitions) && lifecycle.transitions.length > 0
  );
  const initialStatus = getInitialStatus(lifecycle);

  const L = [];

  // ── File header ────────────────────────────────────────────────────────────
  L.push('/**');
  L.push(' * ' + entityName + 'Service');
  L.push(' *');
  L.push(' * Business logic layer for ' + entityName + ' entities.');
  L.push(' * Handles CRUD operations, validation, and lifecycle management.');
  L.push(' * Auto-generated from entity metadata.');
  L.push(' *');
  L.push(' * @generated true');
  L.push(' */');
  L.push('');

  // ── Imports — only from co-generated files in the same directory ───────────
  L.push("import { " + repoName + " } from './" + repoName + "';");
  L.push("import type { " + recordName + " } from './" + repoName + "';");
  L.push("import { " + validatorName + " } from './" + validatorName + "';");
  L.push('');

  // ── In-file interface: AuditEvent ──────────────────────────────────────────
  L.push('/** Payload passed to the optional audit logger. */');
  L.push('export interface AuditEvent {');
  L.push('  entity: string;');
  L.push('  entityId: string;');
  L.push('  action: string;');
  L.push('  userId?: string;');
  L.push('  changes?: unknown;');
  L.push('  timestamp: Date;');
  L.push('}');
  L.push('');

  // ── In-file interface: AuditLogger ─────────────────────────────────────────
  L.push('/** Optional audit sink injected into the service. */');
  L.push('export interface AuditLogger {');
  L.push('  log(event: AuditEvent): Promise<void> | void;');
  L.push('}');
  L.push('');

  // ── In-file interface: RequestContext ──────────────────────────────────────
  L.push('/** Context forwarded from the HTTP/RPC layer to mutating operations. */');
  L.push('export interface RequestContext {');
  L.push('  user?: { id?: string };');
  L.push('  eventBus?: { emit(type: string, payload: unknown): void };');
  L.push('}');
  L.push('');

  // ── Class declaration ──────────────────────────────────────────────────────
  L.push('export class ' + entityName + 'Service {');
  L.push('  private readonly repository: ' + repoName + ';');
  L.push('  private readonly validator: ' + validatorName + ';');
  L.push('  private readonly audit?: AuditLogger;');
  L.push('');
  L.push('  constructor(');
  L.push('    repository: ' + repoName + ',');
  L.push('    validator: ' + validatorName + ',');
  L.push('    audit?: AuditLogger');
  L.push('  ) {');
  L.push('    this.repository = repository;');
  L.push('    this.validator = validator;');
  L.push('    this.audit = audit;');
  L.push('  }');
  L.push('');

  // ── get ────────────────────────────────────────────────────────────────────
  L.push('  /**');
  L.push('   * Get ' + entityName + ' by ID.');
  L.push('   * @param id - Entity ID');
  L.push('   * @returns ' + recordName + ' (throws if not found)');
  L.push('   */');
  L.push('  async get(id: string): Promise<' + recordName + '> {');
  L.push('    const entity = await this.repository.findById(id);');
  L.push('    if (entity === null) {');
  L.push('      throw new Error(`' + entityName + ' not found: ${id}`);');
  L.push('    }');
  L.push('    return entity;');
  L.push('  }');
  L.push('');

  // ── list ───────────────────────────────────────────────────────────────────
  L.push('  /**');
  L.push('   * List all ' + entityName + ' entities with optional pagination.');
  L.push('   * @param limit - Maximum records to return');
  L.push('   * @param offset - Number of records to skip');
  L.push('   * @returns Array of ' + recordName);
  L.push('   */');
  L.push('  async list(limit: number = 100, offset: number = 0): Promise<' + recordName + '[]> {');
  L.push('    return this.repository.findAll(limit, offset);');
  L.push('  }');
  L.push('');

  // ── create ─────────────────────────────────────────────────────────────────
  L.push('  /**');
  L.push('   * Create a new ' + entityName + '.');
  L.push('   * @param input  - Field values for the new entity');
  L.push('   * @param context - Optional request context (user, eventBus)');
  L.push('   * @returns Persisted ' + recordName);
  L.push('   * @throws Error if validation fails');
  L.push('   */');
  L.push('  async create(input: Partial<' + recordName + '>, context?: RequestContext): Promise<' + recordName + '> {');
  L.push('    const validation = await this.validator.validate(input);');
  L.push('    if (!validation.isValid) {');
  L.push("      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);");
  L.push('    }');
  L.push('    const created = await this.repository.create(input);');
  if (hasAudit) {
    L.push('    await this.audit?.log({');
    L.push("      entity: '" + entityName + "',");
    L.push('      entityId: created.id,');
    L.push("      action: 'CREATE',");
    L.push('      userId: context?.user?.id,');
    L.push('      changes: created,');
    L.push('      timestamp: new Date(),');
    L.push('    });');
  }
  L.push('    return created;');
  L.push('  }');
  L.push('');

  // ── update ─────────────────────────────────────────────────────────────────
  L.push('  /**');
  L.push('   * Update an existing ' + entityName + '.');
  L.push('   * @param id     - Entity ID');
  L.push('   * @param input  - Fields to update');
  L.push('   * @param context - Optional request context');
  L.push('   * @returns Updated ' + recordName);
  L.push('   * @throws Error if validation fails or entity not found');
  L.push('   */');
  L.push('  async update(id: string, input: Partial<' + recordName + '>, context?: RequestContext): Promise<' + recordName + '> {');
  L.push('    await this.get(id);');
  L.push('    const validation = await this.validator.validate(input);');
  L.push('    if (!validation.isValid) {');
  L.push("      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);");
  L.push('    }');
  L.push('    const updated = await this.repository.update(id, input);');
  if (hasAudit) {
    L.push('    await this.audit?.log({');
    L.push("      entity: '" + entityName + "',");
    L.push('      entityId: id,');
    L.push("      action: 'UPDATE',");
    L.push('      userId: context?.user?.id,');
    L.push('      changes: input,');
    L.push('      timestamp: new Date(),');
    L.push('    });');
  }
  L.push('    return updated;');
  L.push('  }');
  L.push('');

  // ── delete ─────────────────────────────────────────────────────────────────
  L.push('  /**');
  L.push('   * Soft-delete a ' + entityName + '.');
  L.push('   * @param id     - Entity ID');
  L.push('   * @param context - Optional request context');
  L.push('   */');
  L.push('  async delete(id: string, context?: RequestContext): Promise<void> {');
  L.push('    await this.get(id);');
  if (hasAudit) {
    L.push('    await this.audit?.log({');
    L.push("      entity: '" + entityName + "',");
    L.push('      entityId: id,');
    L.push("      action: 'DELETE',");
    L.push('      userId: context?.user?.id,');
    L.push('      timestamp: new Date(),');
    L.push('    });');
  }
  L.push('    await this.repository.delete(id);');
  L.push('  }');
  L.push('');

  // ── count ──────────────────────────────────────────────────────────────────
  L.push('  /**');
  L.push('   * Count non-deleted ' + entityName + ' entities.');
  L.push('   * @returns Total count');
  L.push('   */');
  L.push('  async count(): Promise<number> {');
  L.push('    return this.repository.count();');
  L.push('  }');

  // ── Lifecycle transition methods ───────────────────────────────────────────
  if (hasTransitions) {
    const validTransitionsJSON = JSON.stringify(
      lifecycle.transitions.map(t => ({ from: t.from, to: t.to }))
    );

    L.push('');
    L.push('  // === Lifecycle Management ===');
    L.push('');
    L.push('  /**');
    L.push('   * Check whether a state transition is currently allowed.');
    L.push('   * @param id      - Entity ID');
    L.push('   * @param toState - Target state name');
    L.push('   * @returns true if the transition is valid from the current state');
    L.push('   */');
    L.push('  async canTransitionTo(id: string, toState: string): Promise<boolean> {');
    L.push('    const entity = await this.get(id);');
    L.push('    const record = entity as unknown as Record<string, unknown>;');
    L.push("    const currentStatus = typeof record['status'] === 'string' ? record['status'] : '" + initialStatus + "';");
    L.push('    const validTransitions: Array<{ from: string; to: string }> = ' + validTransitionsJSON + ';');
    L.push('    return validTransitions.some(t => t.from === currentStatus && t.to === toState);');
    L.push('  }');
    L.push('');
    L.push('  /**');
    L.push('   * Perform a state transition.');
    L.push('   * @param id      - Entity ID');
    L.push('   * @param toState - Target state name');
    L.push('   * @param context - Optional request context');
    L.push('   * @returns Updated ' + recordName + ' with new state');
    L.push('   * @throws Error if the transition is not allowed from the current state');
    L.push('   */');
    L.push('  async transitionTo(id: string, toState: string, context?: RequestContext): Promise<' + recordName + '> {');
    L.push('    const entity = await this.get(id);');
    L.push('    const record = entity as unknown as Record<string, unknown>;');
    L.push("    const currentStatus = typeof record['status'] === 'string' ? record['status'] : '" + initialStatus + "';");
    L.push('    const canTransition = await this.canTransitionTo(id, toState);');
    L.push('    if (!canTransition) {');
    L.push('      throw new Error(`Cannot transition ${id} from ${currentStatus} to ${toState}`);');
    L.push('    }');
    L.push('    const statusUpdate = { status: toState } as unknown as Partial<' + recordName + '>;');
    L.push('    const updated = await this.repository.update(id, statusUpdate);');
    L.push("    context?.eventBus?.emit('" + camelCase + ".stateChanged', {");
    L.push('      entityId: id,');
    L.push('      fromState: currentStatus,');
    L.push('      toState,');
    L.push('      timestamp: new Date(),');
    L.push('      userId: context?.user?.id,');
    L.push('    });');
    if (hasAudit) {
      L.push('    await this.audit?.log({');
      L.push("      entity: '" + entityName + "',");
      L.push('      entityId: id,');
      L.push("      action: 'TRANSITION',");
      L.push('      userId: context?.user?.id,');
      L.push("      changes: { fromState: currentStatus, toState },");
      L.push('      timestamp: new Date(),');
      L.push('    });');
    }
    L.push('    return updated;');
    L.push('  }');

    // Convenience method for each unique target state
    const uniqueToStates = [...new Set(lifecycle.transitions.map(t => t.to))];
    for (const toState of uniqueToStates) {
      const methodName = toState.toLowerCase().replace(/[^a-z0-9]/g, '_');
      L.push('');
      L.push('  /**');
      L.push('   * Transition ' + entityName + ' to ' + toState + '.');
      L.push('   * @param id      - Entity ID');
      L.push('   * @param context - Optional request context');
      L.push('   * @returns Updated ' + recordName);
      L.push('   */');
      L.push('  async ' + methodName + '(id: string, context?: RequestContext): Promise<' + recordName + '> {');
      L.push("    return this.transitionTo(id, '" + toState + "', context);");
      L.push('  }');
    }
  }

  L.push('}');
  L.push('');

  return L.join('\n');
}
