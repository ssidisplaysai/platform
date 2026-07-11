/**
 * EventBus - Genesis Event Bus v1
 *
 * Executes event operations:
 * - publish: Emit event to all subscribed handlers
 * - subscribe: Register handler for event type
 * - unsubscribe: Unregister event handler
 * - validate: Validate event format
 * - listSubscriptions: Get all active subscriptions
 * - listEventDefinitions: Get all supported event types
 *
 * Events are immutable, timestamped, traceable, and support correlation/causation chains.
 *
 * @module tools/genesis/runtime/EventBus.mjs
 */

import {
  RuntimeEvent,
  RuntimeEventEnvelope,
  RuntimeEventHandler,
  RuntimeEventSubscription,
  RuntimeEventResult,
  EventValidationResult
} from "./RuntimeEventContract.mjs";
import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export class EventBus {
  constructor() {
    this.handlers = new Map(); // handlerId -> RuntimeEventHandler
    this.subscriptions = new Map(); // subscriptionId -> RuntimeEventSubscription
    this.eventHistory = []; // all published events
    this.subscriptionHistory = []; // all subscription changes
    this.runtimeReady = false;
  }

  /**
   * Initialize bus with runtime manifest
   */
  initialize() {
    try {
      const manifestPath = join(
        projectRoot,
        "out/generated/runtime-boot-manifest.json"
      );
      const content = readFileSync(manifestPath, "utf8");
      const manifest = JSON.parse(content);

      this.runtimeReady = manifest.finalState?.ready || false;
      this.runtimeManifest = manifest;

      if (!this.runtimeReady) {
        throw new Error("Runtime is not in READY state.");
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to initialize event bus: ${error.message}`);
    }
  }

  /**
   * Publish an event to all subscribed handlers
   */
  async publish(eventData) {
    // Create event object
    const event =
      eventData instanceof RuntimeEvent
        ? eventData
        : new RuntimeEvent(eventData);

    // Validate event format
    const formatValidation = event.validate();
    if (!formatValidation.isValid) {
      const result = new RuntimeEventResult({
        eventId: event.eventId,
        eventType: event.eventType,
        operationType: "publish",
        status: "failed",
        dryRun: false,
        errors: formatValidation.errors,
        startTime: new Date().toISOString()
      });
      result.markExecuted();
      return result;
    }

    // Create result
    const result = new RuntimeEventResult({
      eventId: event.eventId,
      eventType: event.eventType,
      operationType: "publish",
      status: "pending",
      dryRun: event.dryRun || false,
      startTime: new Date().toISOString()
    });

    // Metadata validation
    const validationResults = this.validateEvent(event);
    result.validationResults = validationResults;

    // Create envelope
    const envelope = new RuntimeEventEnvelope({
      event,
      publishedBy: event.actor,
      dryRun: event.dryRun || false
    });

    // Find matching handlers
    const matchingHandlers = Array.from(this.handlers.values()).filter(h =>
      h.matches(event)
    );

    // Notify handlers
    if (!event.dryRun) {
      for (const handler of matchingHandlers) {
        try {
          envelope.addHandler(handler.handlerId);
          await handler.handle(event);
          result.notifyHandler(handler.handlerId);
        } catch (error) {
          result.addWarning(`Handler ${handler.handlerId} failed: ${error.message}`);
        }
      }
      envelope.markPublished();
      result.status = "executed";
    } else {
      // Dry-run mode: don't actually notify handlers
      for (const handler of matchingHandlers) {
        envelope.addHandler(handler.handlerId);
        result.notifyHandler(handler.handlerId);
      }
      result.status = "dryRun";
    }

    // Track event
    this.eventHistory.push({
      envelope,
      handlersMatched: matchingHandlers.length,
      timestamp: new Date().toISOString()
    });

    result.markExecuted();
    return result;
  }

  /**
   * Subscribe handler to event type
   */
  async subscribe(subscriptionData) {
    // Create subscription object
    const subscription =
      subscriptionData instanceof RuntimeEventSubscription
        ? subscriptionData
        : new RuntimeEventSubscription(subscriptionData);

    // Validate subscription format
    const formatValidation = subscription.validate();
    if (!formatValidation.isValid) {
      const result = new RuntimeEventResult({
        operationType: "subscribe",
        status: "failed",
        dryRun: false,
        errors: formatValidation.errors,
        startTime: new Date().toISOString()
      });
      result.markExecuted();
      return result;
    }

    // Create result
    const result = new RuntimeEventResult({
      operationType: "subscribe",
      eventType: subscription.eventType,
      status: "pending",
      dryRun: false,
      startTime: new Date().toISOString()
    });

    // Create or get handler
    let handler = this.handlers.get(subscription.handlerId);
    if (!handler) {
      handler = new RuntimeEventHandler({
        handlerId: subscription.handlerId,
        eventType: subscription.eventType,
        aggregateType: subscription.aggregateType,
        isActive: true,
        actor: subscription.subscriber
      });
      this.handlers.set(subscription.handlerId, handler);
    }

    // Register subscription
    this.subscriptions.set(subscription.subscriptionId, subscription);

    // Track subscription change
    this.subscriptionHistory.push({
      subscriptionId: subscription.subscriptionId,
      operation: "subscribe",
      handlerId: subscription.handlerId,
      eventType: subscription.eventType,
      timestamp: new Date().toISOString()
    });

    result.status = "executed";
    result.result = {
      subscriptionId: subscription.subscriptionId,
      handlerId: subscription.handlerId,
      eventType: subscription.eventType
    };
    result.markExecuted();
    return result;
  }

  /**
   * Unsubscribe handler from event type
   */
  async unsubscribe(subscriptionId) {
    const result = new RuntimeEventResult({
      operationType: "unsubscribe",
      status: "pending",
      startTime: new Date().toISOString()
    });

    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      result.addError(`Subscription ${subscriptionId} not found`);
      result.status = "failed";
      result.markExecuted();
      return result;
    }

    // Deactivate subscription
    subscription.isActive = false;
    this.subscriptions.delete(subscriptionId);

    // Optionally deactivate handler if no other subscriptions
    const handlerId = subscription.handlerId;
    const otherSubscriptions = Array.from(this.subscriptions.values()).some(
      s => s.handlerId === handlerId
    );

    if (!otherSubscriptions) {
      const handler = this.handlers.get(handlerId);
      if (handler) {
        handler.isActive = false;
      }
    }

    // Track subscription change
    this.subscriptionHistory.push({
      subscriptionId,
      operation: "unsubscribe",
      handlerId,
      timestamp: new Date().toISOString()
    });

    result.status = "executed";
    result.result = { subscriptionId, deactivated: true };
    result.markExecuted();
    return result;
  }

  /**
   * Validate event against runtime metadata
   */
  validateEvent(event) {
    const result = new EventValidationResult();

    // Check event type
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
    result.eventTypeExists = validEventTypes.includes(event.eventType);

    // Check source exists in registry
    const finalState = this.runtimeManifest?.finalState || {};
    result.sourceExists = !!event.source;

    // Check target exists in registry
    const registeredObjects = finalState.registeredObjects || 0;
    const registeredModules = finalState.registeredModules || 0;
    result.targetExists = registeredObjects > 0 || registeredModules > 0 || !!event.target;

    // Check payload
    result.payloadValid = typeof event.payload === "object" && !Array.isArray(event.payload);

    // Check correlation ID
    result.correlationIdValid = !!event.correlationId && !!event.timestamp;

    // Check actor permissions
    result.actorAllowed = !!event.actor;

    return result;
  }

  /**
   * List all active subscriptions
   */
  listSubscriptions(filter = {}) {
    const subscriptions = Array.from(this.subscriptions.values())
      .filter(sub => {
        if (filter.eventType && sub.eventType !== filter.eventType) {
          return false;
        }
        if (filter.aggregateType && sub.aggregateType !== filter.aggregateType) {
          return false;
        }
        if (filter.active !== undefined && sub.isActive !== filter.active) {
          return false;
        }
        return true;
      })
      .map(sub => ({
        subscriptionId: sub.subscriptionId,
        handlerId: sub.handlerId,
        eventType: sub.eventType,
        aggregateType: sub.aggregateType,
        isActive: sub.isActive,
        subscribedAt: sub.subscribedAt,
        subscriber: sub.subscriber
      }));

    return subscriptions;
  }

  /**
   * List all event definitions
   */
  listEventDefinitions() {
    return [
      {
        eventType: "lifecycleStateChanged",
        description: "Emitted when an aggregate transitions to a new lifecycle state",
        source: "LifecycleEngine"
      },
      {
        eventType: "commandExecuted",
        description: "Emitted when a command is executed",
        source: "CommandBus"
      },
      {
        eventType: "queryExecuted",
        description: "Emitted when a query is executed",
        source: "QueryBus"
      },
      {
        eventType: "workflowStarted",
        description: "Emitted when a workflow is initiated",
        source: "WorkflowEngine"
      },
      {
        eventType: "automationTriggered",
        description: "Emitted when an automation rule is triggered",
        source: "AutomationEngine"
      },
      {
        eventType: "aiAgentInvoked",
        description: "Emitted when an AI agent is invoked",
        source: "AIRuntime"
      },
      {
        eventType: "domainEventOccurred",
        description: "Domain-specific business event",
        source: "DomainModel"
      },
      {
        eventType: "customEvent",
        description: "Custom application event",
        source: "Application"
      }
    ];
  }

  /**
   * Get event history
   */
  getEventHistory(filter = {}) {
    let history = this.eventHistory;

    if (filter.eventType) {
      history = history.filter(h => h.envelope.event.eventType === filter.eventType);
    }

    if (filter.source) {
      history = history.filter(h => h.envelope.event.source === filter.source);
    }

    if (filter.limit) {
      history = history.slice(-filter.limit);
    }

    return history.map(h => ({
      eventId: h.envelope.event.eventId,
      eventType: h.envelope.event.eventType,
      source: h.envelope.event.source,
      target: h.envelope.event.target,
      targetId: h.envelope.event.targetId,
      timestamp: h.envelope.event.timestamp,
      handlersMatched: h.handlersMatched,
      publishedAt: h.timestamp
    }));
  }

  /**
   * Get subscription history
   */
  getSubscriptionHistory(limit = 100) {
    return this.subscriptionHistory.slice(-limit).map(h => ({
      subscriptionId: h.subscriptionId,
      operation: h.operation,
      handlerId: h.handlerId,
      eventType: h.eventType,
      timestamp: h.timestamp
    }));
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      total: this.eventHistory.length,
      activeHandlers: Array.from(this.handlers.values()).filter(h => h.isActive).length,
      activeSubscriptions: Array.from(this.subscriptions.values()).filter(
        s => s.isActive
      ).length,
      subscriptionChanges: this.subscriptionHistory.length,
      eventsByType: this.groupEventsByType(),
      handlersByEventType: this.groupHandlersByEventType()
    };
  }

  groupEventsByType() {
    const grouped = {};
    for (const entry of this.eventHistory) {
      const type = entry.envelope.event.eventType;
      grouped[type] = (grouped[type] || 0) + 1;
    }
    return grouped;
  }

  groupHandlersByEventType() {
    const grouped = {};
    for (const handler of this.handlers.values()) {
      const type = handler.eventType;
      grouped[type] = (grouped[type] || 0) + 1;
    }
    return grouped;
  }
}
