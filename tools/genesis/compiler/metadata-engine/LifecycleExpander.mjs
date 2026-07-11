/**
 * LifecycleExpander
 *
 * Expands lifecycle metadata into state machine definitions
 * with transitions and event triggers.
 *
 * Supports two patterns:
 * 1. Detailed lifecycle with custom states and transitions
 * 2. Simple lifecycle flags (legacy/minimal entities)
 *
 * @module tools/genesis/compiler/metadata-engine/LifecycleExpander
 */

/**
 * Default lifecycle states for simple entities
 */
const DEFAULT_STATES = {
  DRAFT: { order: 1, label: 'Draft', active: false },
  ACTIVE: { order: 2, label: 'Active', active: true },
  INACTIVE: { order: 3, label: 'Inactive', active: false },
  ARCHIVED: { order: 4, label: 'Archived', active: false },
};

/**
 * Expand lifecycle metadata into state machine
 * Reads detailed lifecycle (states + transitions) from entity YAML if present
 * Falls back to simple flags (draft, archived, softDelete, versioning)
 *
 * @param {Object} lifecycleMetadata - Lifecycle config from entity YAML
 * @returns {Object} Expanded lifecycle state machine with states, transitions, flags
 */
export function expandLifecycle(lifecycleMetadata) {
  if (!lifecycleMetadata) {
    return createDefaultLifecycle();
  }

  // If YAML has detailed states (new pattern), use them
  if (lifecycleMetadata.states && typeof lifecycleMetadata.states === 'object') {
    return expandDetailedLifecycle(lifecycleMetadata);
  }

  // Otherwise, use simple flags (legacy pattern)
  return expandSimpleLifecycle(lifecycleMetadata);
}

/**
 * Create default lifecycle for entities with no lifecycle metadata
 * @returns {Object} Default lifecycle
 */
function createDefaultLifecycle() {
  return {
    states: { ...DEFAULT_STATES },
    transitions: [
      { from: 'DRAFT', to: 'ACTIVE', trigger: 'activate' },
      { from: 'ACTIVE', to: 'INACTIVE', trigger: 'deactivate' },
      { from: 'INACTIVE', to: 'ACTIVE', trigger: 'activate' },
      { from: 'ACTIVE', to: 'ARCHIVED', trigger: 'archive' },
      { from: 'INACTIVE', to: 'ARCHIVED', trigger: 'archive' },
    ],
    initial: 'DRAFT',
    softDelete: true,
    versioning: false,
    archived: true,
    timestamps: {
      createdAt: true,
      updatedAt: true,
      deletedAt: true,
      archivedAt: true,
    },
  };
}

/**
 * Expand detailed lifecycle with custom states and transitions
 * @param {Object} lifecycleMetadata - Lifecycle config with states section
 * @returns {Object} Expanded lifecycle
 */
function expandDetailedLifecycle(lifecycleMetadata) {
  const states = {};
  const transitions = [];
  const stateEntries = Object.entries(lifecycleMetadata.states);

  // Build state definitions with order and metadata
  stateEntries.forEach(([stateName, stateConfig], index) => {
    states[stateName] = {
      name: stateName,
      label: stateConfig.label || toLabel(stateName),
      description: stateConfig.description || stateName,
      order: index + 1,
      active: stateConfig.active !== false, // default true
      terminal: !stateConfig.transitions || stateConfig.transitions.length === 0,
    };
  });

  // Build transitions from state.transitions arrays
  stateEntries.forEach(([fromState, stateConfig]) => {
    if (stateConfig.transitions && Array.isArray(stateConfig.transitions)) {
      stateConfig.transitions.forEach(toState => {
        transitions.push({
          from: fromState,
          to: toState,
          trigger: toTrigger(fromState, toState),
          guard: stateConfig.guards?.[toState] || null,
          event: stateConfig.events?.[toState] || toEventName(fromState, toState),
        });
      });
    }
  });

  return {
    initial: lifecycleMetadata.initial || stateEntries[0]?.[0] || 'DRAFT',
    states,
    transitions,
    softDelete: lifecycleMetadata.softDelete === true,
    versioning: lifecycleMetadata.versioning === true,
    archived: lifecycleMetadata.archived === true,
    timestamps: buildTimestamps(lifecycleMetadata),
  };
}

/**
 * Expand simple lifecycle using legacy flags
 * @param {Object} lifecycleMetadata - Lifecycle config with flags
 * @returns {Object} Expanded lifecycle
 */
function expandSimpleLifecycle(lifecycleMetadata) {
  const states = { ...DEFAULT_STATES };
  const lifecycle = {
    initial: 'DRAFT',
    states,
    transitions: [
      { from: 'DRAFT', to: 'ACTIVE', trigger: 'activate' },
      { from: 'ACTIVE', to: 'INACTIVE', trigger: 'deactivate' },
      { from: 'INACTIVE', to: 'ACTIVE', trigger: 'activate' },
      { from: 'ACTIVE', to: 'ARCHIVED', trigger: 'archive' },
      { from: 'INACTIVE', to: 'ARCHIVED', trigger: 'archive' },
    ],
    softDelete: lifecycleMetadata.softDelete === true,
    versioning: lifecycleMetadata.versioning === true,
    archived: lifecycleMetadata.archived === true,
    timestamps: buildTimestamps(lifecycleMetadata),
  };

  // Remove DRAFT state if explicitly disabled
  if (lifecycleMetadata.draft === false) {
    delete lifecycle.states['DRAFT'];
    lifecycle.transitions = lifecycle.transitions.filter(t => t.from !== 'DRAFT' && t.to !== 'DRAFT');
    lifecycle.initial = 'ACTIVE';
  }

  return lifecycle;
}

/**
 * Build timestamps configuration
 * @param {Object} lifecycleMetadata - Lifecycle config
 * @returns {Object} Timestamp configuration
 */
function buildTimestamps(lifecycleMetadata) {
  return {
    createdAt: true,
    updatedAt: true,
    deletedAt: lifecycleMetadata.softDelete === true,
    archivedAt: lifecycleMetadata.archived === true,
  };
}

/**
 * Convert state name to human-readable label
 * @param {string} stateName - State name (e.g., 'IN_PROGRESS')
 * @returns {string} Label (e.g., 'In Progress')
 */
function toLabel(stateName) {
  return stateName
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Generate trigger name from transition
 * @param {string} fromState - From state
 * @param {string} toState - To state
 * @returns {string} Trigger name
 */
function toTrigger(fromState, toState) {
  return toState.toLowerCase();
}

/**
 * Generate event name from transition
 * @param {string} fromState - From state
 * @param {string} toState - To state
 * @returns {string} Event name (e.g., 'transitioned_to_in_progress')
 */
function toEventName(fromState, toState) {
  return `transitioned_to_${toState.toLowerCase()}`;
}

/**
 * Get all valid states from lifecycle
 * @param {Object} lifecycle - Expanded lifecycle
 * @returns {Array<string>} State names
 */
export function getStates(lifecycle) {
  return Object.keys(lifecycle.states);
}

/**
 * Get transitions available from a state
 * @param {Object} lifecycle - Expanded lifecycle
 * @param {string} fromState - Starting state
 * @returns {Array<Object>} Valid transitions
 */
export function getTransitions(lifecycle, fromState) {
  return lifecycle.transitions.filter(t => t.from === fromState);
}

/**
 * Check if transition is valid
 * @param {Object} lifecycle - Expanded lifecycle
 * @param {string} fromState - Starting state
 * @param {string} toState - Ending state
 * @returns {boolean}
 */
export function isValidTransition(lifecycle, fromState, toState) {
  return lifecycle.transitions.some(
    t => t.from === fromState && t.to === toState
  );
}

/**
 * Check if soft delete is enabled
 * @param {Object} lifecycle - Expanded lifecycle
 * @returns {boolean}
 */
export function hasSoftDelete(lifecycle) {
  return lifecycle.softDelete === true;
}

/**
 * Check if versioning is enabled
 * @param {Object} lifecycle - Expanded lifecycle
 * @returns {boolean}
 */
export function hasVersioning(lifecycle) {
  return lifecycle.versioning === true;
}

/**
 * Check if archival is enabled
 * @param {Object} lifecycle - Expanded lifecycle
 * @returns {boolean}
 */
export function hasArchival(lifecycle) {
  return lifecycle.archived === true;
}

/**
 * Get initial state
 * @param {Object} lifecycle - Expanded lifecycle
 * @returns {string} Initial state name
 */
export function getInitialState(lifecycle) {
  return lifecycle.initial || 'DRAFT';
}

/**
 * Get terminal states (no outgoing transitions)
 * @param {Object} lifecycle - Expanded lifecycle
 * @returns {Array<string>} Terminal state names
 */
export function getTerminalStates(lifecycle) {
  return Object.entries(lifecycle.states)
    .filter(([name]) => !lifecycle.transitions.some(t => t.from === name))
    .map(([name]) => name);
}

/**
 * Get timestamp fields
 * @param {Object} lifecycle - Expanded lifecycle
 * @returns {Array<string>} Timestamp field names
 */
export function getTimestampFields(lifecycle) {
  return Object.entries(lifecycle.timestamps)
    .filter(([_, enabled]) => enabled === true)
    .map(([field]) => field);
}
