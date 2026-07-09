/**
 * RuntimeEventContract - Event Bus contracts
 *
 * Defines contracts for enterprise event operations:
 * - publish: Emit event to bus
 * - subscribe: Register handler for event type
 * - unsubscribe: Unregister event handler
 * - validate: Validate event format and structure
 *
 * Events are immutable, timestamped, traceable, and support correlation/causation chains.
 *
 * @module tools/genesis/runtime/RuntimeEventContract.mjs
 */

/**
 * RuntimeEvent
 * Generic contract for all enterprise events
 */
export class RuntimeEvent {
  constructor(data = {}) {
    this.eventId = data.eventId || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.eventType = data.eventType; // lifecycleStateChanged|commandExecuted|queryExecuted|workflowStarted|automationTriggered|aiAgentInvoked|domainEventOccurred|customEvent
    this.source = data.source; // what generated the event (e.g., "CommandBus", "LifecycleEngine")
    this.target = data.target; // what the event is about (aggregateType)
    this.targetId = data.targetId; // what instance (aggregateId)
    this.actor = data.actor || "system"; // who caused the event
    this.timestamp = data.timestamp || new Date().toISOString();
    this.payload = data.payload || {}; // event-specific data
    this.metadata = data.metadata || {}; // custom metadata
    this.correlationId = data.correlationId || `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; // links related events
    this.causationId = data.causationId || null; // links to event that caused this one
    this.dryRun = data.dryRun || false; // whether this is a dry-run publication
  }

  validate() {
    const errors = [];

    if (!this.eventType) {
      errors.push("eventType is required");
    }

    if (!this.source) {
      errors.push("source is required");
    }

    if (!this.target) {
      errors.push("target is required");
    }

    const validEventTypes = [
      "lifecycleStateChanged",
      "commandExecuted",
      "queryExecuted",
      "workflowStarted",
      "automationTriggered",
      "aiAgentInvoked",
      "domainEventOccurred",
      "customEvent"
    ];

    if (this.eventType && !validEventTypes.includes(this.eventType)) {
      errors.push(`eventType must be one of: ${validEventTypes.join(", ")}`);
    }

    if (typeof this.payload !== "object" || Array.isArray(this.payload)) {
      errors.push("payload must be a JSON object (not an array or primitive)");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  isImmutable() {
    return true;
  }

  isTraceable() {
    return !!this.correlationId && this.timestamp;
  }
}

/**
 * RuntimeEventEnvelope
 * Wraps event with delivery and routing metadata
 */
export class RuntimeEventEnvelope {
  constructor(data = {}) {
    this.envelopeId = data.envelopeId || `env-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.event = data.event; // RuntimeEvent instance
    this.publishedAt = data.publishedAt || new Date().toISOString();
    this.publishedBy = data.publishedBy || "system";
    this.handlers = data.handlers || []; // handlers that will/did receive this event
    this.status = data.status || "pending"; // pending|published|delivered|failed
    this.dryRun = data.dryRun || false;
  }

  addHandler(handlerId) {
    if (!this.handlers.includes(handlerId)) {
      this.handlers.push(handlerId);
    }
  }

  markPublished() {
    this.status = "published";
    this.publishedAt = new Date().toISOString();
  }

  markDelivered() {
    this.status = "delivered";
  }

  markFailed(error) {
    this.status = "failed";
    this.failureReason = error;
  }
}

/**
 * RuntimeEventHandler
 * Contract for event handler registration
 */
export class RuntimeEventHandler {
  constructor(data = {}) {
    this.handlerId = data.handlerId || `handler-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.eventType = data.eventType; // what event types this handler responds to
    this.aggregateType = data.aggregateType; // optional: filter by aggregate type
    this.handler = data.handler; // async function(event) => void
    this.isActive = data.isActive !== false;
    this.actor = data.actor || "system";
    this.registeredAt = new Date().toISOString();
  }

  matches(event) {
    if (this.eventType && event.eventType !== this.eventType) {
      return false;
    }

    if (this.aggregateType && event.target !== this.aggregateType) {
      return false;
    }

    return this.isActive;
  }

  async handle(event) {
    if (typeof this.handler === "function") {
      return await this.handler(event);
    }
  }
}

/**
 * RuntimeEventSubscription
 * Contract for event subscription
 */
export class RuntimeEventSubscription {
  constructor(data = {}) {
    this.subscriptionId = data.subscriptionId || `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.handlerId = data.handlerId;
    this.eventType = data.eventType; // what event types to subscribe to
    this.aggregateType = data.aggregateType; // optional: filter by aggregate type
    this.isActive = data.isActive !== false;
    this.subscribedAt = new Date().toISOString();
    this.subscriber = data.subscriber || "system";
  }

  validate() {
    const errors = [];

    if (!this.handlerId) {
      errors.push("handlerId is required");
    }

    if (!this.eventType) {
      errors.push("eventType is required");
    }

    const validEventTypes = [
      "lifecycleStateChanged",
      "commandExecuted",
      "queryExecuted",
      "workflowStarted",
      "automationTriggered",
      "aiAgentInvoked",
      "domainEventOccurred",
      "customEvent"
    ];

    if (this.eventType && !validEventTypes.includes(this.eventType)) {
      errors.push(`eventType must be one of: ${validEventTypes.join(", ")}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * RuntimeEventResult
 * Response from event operation (publish/subscribe/etc.)
 */
export class RuntimeEventResult {
  constructor(data = {}) {
    this.eventId = data.eventId;
    this.eventType = data.eventType;
    this.operationType = data.operationType; // publish|subscribe|unsubscribe|validate|listSubscriptions|listEventDefinitions
    this.status = data.status; // pending|executed|failed|dryRun
    this.result = data.result || null;
    this.handlersNotified = data.handlersNotified || [];
    this.errors = data.errors || [];
    this.warnings = data.warnings || [];
    this.startTime = data.startTime || new Date().toISOString();
    this.endTime = data.endTime || null;
    this.duration = data.duration || 0;
    this.dryRun = data.dryRun || false;
    this.validationResults = data.validationResults || {};
  }

  addError(error) {
    this.errors.push(error);
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }

  notifyHandler(handlerId) {
    if (!this.handlersNotified.includes(handlerId)) {
      this.handlersNotified.push(handlerId);
    }
  }

  markExecuted() {
    this.endTime = new Date().toISOString();
    this.duration = new Date(this.endTime) - new Date(this.startTime);
  }

  isSuccess() {
    return (this.status === "executed" || this.status === "dryRun") && this.errors.length === 0;
  }
}

/**
 * EventValidationResult
 * Validation status for event
 */
export class EventValidationResult {
  constructor() {
    this.eventTypeExists = false;
    this.sourceExists = false;
    this.targetExists = false;
    this.payloadValid = false;
    this.correlationIdValid = false;
    this.actorAllowed = false;
    this.errors = [];
    this.warnings = [];
  }

  allValid() {
    return (
      this.eventTypeExists &&
      this.sourceExists &&
      this.targetExists &&
      this.payloadValid &&
      this.correlationIdValid &&
      this.actorAllowed
    );
  }

  addError(error) {
    this.errors.push(error);
  }

  addWarning(warning) {
    this.warnings.push(warning);
  }
}
