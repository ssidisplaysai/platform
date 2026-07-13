/**
 * EventsRenderer
 *
 * Generates self-contained, compilable event definitions from
 * EnterpriseObjectBlueprint.
 *
 * Contract:
 * - No external imports (no domain entities, no event buses)
 * - Immutable readonly event type registry
 * - Event payload interfaces derived from blueprint fields only
 * - Deterministic event type ordering (sorted by key name)
 * - Deterministic state transition events (sorted by toState)
 * - Duplicate state transitions eliminated (unique toState only)
 * - No runtime event emitter (just type definitions)
 * - Byte-for-byte identical output across repeated generation
 *
 * @module tools/genesis/compiler/renderers/EventsRenderer
 */

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function toCamelCase(s) {
  return s ? s.charAt(0).toLowerCase() + s.slice(1) : '';
}

/**
 * Extract unique state transition target states from blueprint.
 * Returns sorted array of unique toState strings.
 *
 * @param {Array} transitions - blueprint.lifecycle.transitions
 * @returns {Array<string>} sorted unique toState values
 */
function getUniqueTargetStates(transitions) {
  if (!Array.isArray(transitions)) return [];
  const states = new Set(transitions.map(t => t.to).filter(Boolean));
  return Array.from(states).sort();
}

// ---------------------------------------------------------------------------
// Main renderer export
// ---------------------------------------------------------------------------

/**
 * Generate event definitions from blueprint.
 *
 * @param {Object} blueprint - EnterpriseObjectBlueprint
 * @returns {string} Generated TypeScript source code
 */
export function generateEvents(blueprint) {
  if (!blueprint || !blueprint.metadata) {
    throw new Error('Blueprint required for events generation');
  }

  const entityName = blueprint.metadata.entity;
  const camelCase = toCamelCase(entityName);

  // Extract configuration with safe defaults
  const hasAudit = !!(blueprint.capabilities && blueprint.capabilities.audit && blueprint.capabilities.audit.enabled);
  const transitions = (blueprint.lifecycle && blueprint.lifecycle.transitions) ? blueprint.lifecycle.transitions : [];
  const hasLifecycle = transitions.length > 0;
  const uniqueTargetStates = hasLifecycle ? getUniqueTargetStates(transitions) : [];

  const L = [];

  // ── File header ────────────────────────────────────────────────────────────
  L.push('/**');
  L.push(' * ' + entityName + 'Events');
  L.push(' *');
  L.push(' * Event definitions and types for ' + entityName + ' lifecycle.');
  L.push(' * Entities emit events on creation, update, deletion, and state transitions.');
  L.push(' * Auto-generated from entity metadata via EnterpriseObjectBlueprint IR.');
  L.push(' *');
  L.push(' * @generated true');
  L.push(' */');
  L.push('');

  // ── Event type constants (readonly, deterministic) ────────────────────────
  L.push('/** Event type constants. Immutable registry of all event types. */');
  L.push('export const ' + entityName + 'EventTypes = Object.freeze({');

  // Build sorted event type entries
  const eventEntries = [];
  eventEntries.push(['CREATED', camelCase + '.created']);
  eventEntries.push(['UPDATED', camelCase + '.updated']);
  eventEntries.push(['DELETED', camelCase + '.deleted']);
  eventEntries.push(['RESTORED', camelCase + '.restored']);
  if (hasLifecycle) {
    eventEntries.push(['STATE_CHANGED', camelCase + '.stateChanged']);
    for (const toState of uniqueTargetStates) {
      const constName = 'STATE_TO_' + toState.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      const eventName = camelCase + '.state.' + toState.toLowerCase().replace(/[^a-z0-9_]/g, '_');
      eventEntries.push([constName, eventName]);
    }
  }
  if (hasAudit) {
    eventEntries.push(['AUDITED', camelCase + '.audited']);
  }

  // Sort entries by key name for determinism
  eventEntries.sort((a, b) => a[0].localeCompare(b[0]));

  for (const [key, value] of eventEntries) {
    L.push('  ' + key + ': \'' + value + '\',');
  }

  L.push('} as const);');
  L.push('');

  // ── Event payload interfaces ───────────────────────────────────────────────
  L.push('/** Base event structure common to all events. */');
  L.push('export interface ' + entityName + 'BaseEvent {');
  L.push('  type: string;');
  L.push('  entityId: string;');
  L.push('  timestamp: Date;');
  L.push('  userId?: string;');
  L.push('}');
  L.push('');

  // CreatedEvent
  L.push('/** Emitted when a new ' + entityName + ' is created. */');
  L.push('export interface ' + entityName + 'CreatedEvent extends ' + entityName + 'BaseEvent {');
  L.push('  /** Complete entity data at creation time. */');
  L.push('  entity: Record<string, unknown>;');
  L.push('}');
  L.push('');

  // UpdatedEvent
  L.push('/** Emitted when a ' + entityName + ' is updated. */');
  L.push('export interface ' + entityName + 'UpdatedEvent extends ' + entityName + 'BaseEvent {');
  L.push('  /** Map of field names to their new values. */');
  L.push('  changes: Record<string, unknown>;');
  L.push('}');
  L.push('');

  // DeletedEvent
  L.push('/** Emitted when a ' + entityName + ' is deleted. */');
  L.push('export interface ' + entityName + 'DeletedEvent extends ' + entityName + 'BaseEvent {');
  L.push('  /** true for soft-delete, false for hard-delete. */');
  L.push('  softDelete: boolean;');
  L.push('}');
  L.push('');

  // RestoredEvent
  L.push('/** Emitted when a soft-deleted ' + entityName + ' is restored. */');
  L.push('export interface ' + entityName + 'RestoredEvent extends ' + entityName + 'BaseEvent {');
  L.push('  /** Complete entity data after restoration. */');
  L.push('  entity: Record<string, unknown>;');
  L.push('}');
  L.push('');

  // StateChangedEvent
  if (hasLifecycle) {
    L.push('/** Emitted when ' + entityName + ' transitions between lifecycle states. */');
    L.push('export interface ' + entityName + 'StateChangedEvent extends ' + entityName + 'BaseEvent {');
    L.push('  /** Previous state. */');
    L.push('  fromState: string;');
    L.push('  /** New state. */');
    L.push('  toState: string;');
    L.push('  /** Brief description of what triggered the transition. */');
    L.push('  reason?: string;');
    L.push('}');
    L.push('');
  }

  // AuditedEvent
  if (hasAudit) {
    L.push('/** Emitted after audit log is written for a ' + entityName + ' mutation. */');
    L.push('export interface ' + entityName + 'AuditedEvent extends ' + entityName + 'BaseEvent {');
    L.push('  /** Audit action name: CREATE, UPDATE, DELETE, etc. */');
    L.push('  action: string;');
    L.push('  /** Snapshot of fields before the mutation. */');
    L.push('  before?: Record<string, unknown>;');
    L.push('  /** Snapshot of fields after the mutation. */');
    L.push('  after?: Record<string, unknown>;');
    L.push('}');
    L.push('');
  }

  // ── Union type for all event payloads ──────────────────────────────────────
  const unionMembers = [
    entityName + 'CreatedEvent',
    entityName + 'UpdatedEvent',
    entityName + 'DeletedEvent',
    entityName + 'RestoredEvent',
  ];
  if (hasLifecycle) unionMembers.push(entityName + 'StateChangedEvent');
  if (hasAudit) unionMembers.push(entityName + 'AuditedEvent');

  L.push('/** Union of all ' + entityName + ' event types. */');
  L.push('export type ' + entityName + 'Event = ' + unionMembers.join(' | ') + ';');
  L.push('');

  // ── Event subscription interface (optional, for consumers) ─────────────────
  L.push('/** Consumer can implement this to handle ' + entityName + ' events. */');
  L.push('export interface ' + entityName + 'EventHandler {');
  L.push('  on' + entityName + 'Created?(event: ' + entityName + 'CreatedEvent): void | Promise<void>;');
  L.push('  on' + entityName + 'Updated?(event: ' + entityName + 'UpdatedEvent): void | Promise<void>;');
  L.push('  on' + entityName + 'Deleted?(event: ' + entityName + 'DeletedEvent): void | Promise<void>;');
  L.push('  on' + entityName + 'Restored?(event: ' + entityName + 'RestoredEvent): void | Promise<void>;');
  if (hasLifecycle) {
    L.push('  on' + entityName + 'StateChanged?(event: ' + entityName + 'StateChangedEvent): void | Promise<void>;');
  }
  if (hasAudit) {
    L.push('  on' + entityName + 'Audited?(event: ' + entityName + 'AuditedEvent): void | Promise<void>;');
  }
  L.push('}');
  L.push('');

  return L.join('\n');
}
