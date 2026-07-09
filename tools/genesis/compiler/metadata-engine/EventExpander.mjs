/**
 * EventExpander
 *
 * Expands event metadata from lifecycle transitions and capabilities
 * into structured event definitions for the compiler IR.
 *
 * @module tools/genesis/compiler/metadata-engine/EventExpander
 */

/**
 * Standard entity lifecycle events
 */
const STANDARD_EVENTS = {
  CREATED: { name: 'created', trigger: 'CREATE', category: 'lifecycle' },
  UPDATED: { name: 'updated', trigger: 'UPDATE', category: 'lifecycle' },
  DELETED: { name: 'deleted', trigger: 'DELETE', category: 'lifecycle' },
  RESTORED: { name: 'restored', trigger: 'RESTORE', category: 'lifecycle' },
};

/**
 * Expand event metadata from lifecycle transitions and capabilities
 * @param {Object} lifecycleMetadata - Expanded lifecycle from LifecycleExpander
 * @param {Object} capabilitiesMetadata - Capabilities from YAML (optional)
 * @returns {Object} Expanded events with definitions and triggers
 */
export function expandEvents(lifecycleMetadata, capabilitiesMetadata) {
  const events = {
    all: [],
    lifecycle: [],
    capability: [],
    custom: [],
    byTrigger: {},
  };

  // Add standard lifecycle events
  Object.entries(STANDARD_EVENTS).forEach(([key, event]) => {
    events.all.push(event);
    events.lifecycle.push(event);
    events.byTrigger[event.trigger] = event;
  });

  // Add state transition events from lifecycle
  if (lifecycleMetadata && lifecycleMetadata.transitions) {
    lifecycleMetadata.transitions.forEach(transition => {
      const transitionEvent = {
        name: transition.event || `transitioned_to_${transition.to.toLowerCase()}`,
        trigger: `TRANSITION_${transition.from}_TO_${transition.to}`,
        category: 'state-transition',
        fromState: transition.from,
        toState: transition.to,
        description: `${transition.from} → ${transition.to} state transition`,
      };

      events.all.push(transitionEvent);
      events.lifecycle.push(transitionEvent);
      events.byTrigger[transitionEvent.trigger] = transitionEvent;
    });
  }

  // Add capability-based events
  if (capabilitiesMetadata) {
    if (capabilitiesMetadata.audit === true) {
      const auditEvent = {
        name: 'audited',
        trigger: 'AUDIT',
        category: 'capability',
        capability: 'audit',
      };
      events.all.push(auditEvent);
      events.capability.push(auditEvent);
      events.byTrigger[auditEvent.trigger] = auditEvent;
    }

    if (capabilitiesMetadata.search === true) {
      const indexEvent = {
        name: 'indexed',
        trigger: 'SEARCH_INDEX_UPDATED',
        category: 'capability',
        capability: 'search',
      };
      events.all.push(indexEvent);
      events.capability.push(indexEvent);
      events.byTrigger[indexEvent.trigger] = indexEvent;
    }
  }

  return events;
}

/**
 * Get all events for an entity
 * @param {Object} events - Expanded events
 * @returns {Array<Object>} All event definitions
 */
export function getAllEvents(events) {
  return events.all || [];
}

/**
 * Get lifecycle-related events
 * @param {Object} events - Expanded events
 * @returns {Array<Object>} Lifecycle events
 */
export function getLifecycleEvents(events) {
  return events.lifecycle || [];
}

/**
 * Get state transition events
 * @param {Object} events - Expanded events
 * @returns {Array<Object>} State transition events
 */
export function getStateTransitionEvents(events) {
  return getLifecycleEvents(events).filter(e => e.category === 'state-transition');
}

/**
 * Get capability-based events
 * @param {Object} events - Expanded events
 * @returns {Array<Object>} Capability events
 */
export function getCapabilityEvents(events) {
  return events.capability || [];
}

/**
 * Get event by trigger name
 * @param {Object} events - Expanded events
 * @param {string} trigger - Trigger name
 * @returns {Object|null} Event definition or null
 */
export function getEventByTrigger(events, trigger) {
  return events.byTrigger?.[trigger] || null;
}

/**
 * Check if event is a state transition event
 * @param {Object} event - Event definition
 * @returns {boolean}
 */
export function isStateTransitionEvent(event) {
  return event.category === 'state-transition' && !!event.fromState && !!event.toState;
}

/**
 * Check if event is a standard lifecycle event
 * @param {Object} event - Event definition
 * @returns {boolean}
 */
export function isStandardEvent(event) {
  return ['created', 'updated', 'deleted', 'restored'].includes(event.name);
}

/**
 * Generate event name in camelCase
 * @param {string} eventName - Event name (e.g., 'transitioned_to_in_progress')
 * @returns {string} CamelCase name (e.g., 'transitionedToInProgress')
 */
export function toEventMethodName(eventName) {
  return eventName
    .split('_')
    .map((word, index) => {
      if (index === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

/**
 * Generate event constant name
 * @param {string} eventName - Event name
 * @returns {string} CONSTANT_NAME format
 */
export function toEventConstantName(eventName) {
  return eventName.toUpperCase();
}
