# Genesis Event Bus v1

## Overview

The Genesis Event Bus is a generic, metadata-driven event infrastructure for publishing, validating, subscribing to, and recording enterprise events within the Genesis runtime system. It enables decoupled communication between components through immutable, traceable events.

## Architecture

### Core Concepts

**Events**: Immutable records of something that happened
- Uniquely identified by `eventId`
- Strongly typed by `eventType`
- Include rich context: source, target, actor, timestamp
- Support correlation and causation chains
- Carry domain data in `payload`

**Event Envelopes**: Delivery wrapper for events
- Contains the event and delivery metadata
- Tracks handler notifications
- Supports dry-run publishing
- Records publish status and failures

**Event Handlers**: Functions that respond to events
- Register interest in specific event types
- Can filter by target aggregate type
- Activated on subscription, deactivated on unsubscribe
- Handle events asynchronously

**Event Subscriptions**: Contracts between handlers and event types
- Link handlers to specific event types
- Support filtering by aggregate type
- Can be activated/deactivated
- Immutably record subscription history

## Event Types

The Event Bus supports 8 built-in event types:

| Event Type | Source | Use Case |
|---|---|---|
| `lifecycleStateChanged` | LifecycleEngine | Aggregate state transitions |
| `commandExecuted` | CommandBus | Command completion |
| `queryExecuted` | QueryBus | Query execution |
| `workflowStarted` | WorkflowEngine | Workflow initiation |
| `automationTriggered` | AutomationEngine | Automation rule firing |
| `aiAgentInvoked` | AIRuntime | AI agent execution |
| `domainEventOccurred` | DomainModel | Domain-specific events |
| `customEvent` | Application | Custom application events |

## API

### EventBus Class

#### Initialization
```javascript
import { EventBus } from "../runtime/EventBus.mjs";

const bus = new EventBus();
bus.initialize(); // Loads runtime manifest, checks READY state
```

#### Publishing Events

```javascript
import { RuntimeEvent } from "../runtime/RuntimeEventContract.mjs";

const event = new RuntimeEvent({
  eventType: "commandExecuted",
  source: "CommandBus",
  target: "Company",
  targetId: "comp-123",
  actor: "cli",
  payload: { commandType: "create", status: "completed" }
});

const result = await bus.publish(event);
// result: RuntimeEventResult with status, handlers notified, etc.
```

#### Subscribe to Events

```javascript
import { RuntimeEventSubscription } from "../runtime/RuntimeEventContract.mjs";

const subscription = new RuntimeEventSubscription({
  eventType: "workflowStarted",
  aggregateType: "Project", // optional filter
  handlerId: "my-handler-id",
  subscriber: "my-service"
});

const result = await bus.subscribe(subscription);
// result: RuntimeEventResult with subscriptionId
```

#### Unsubscribe

```javascript
const result = await bus.unsubscribe(subscriptionId);
// result: RuntimeEventResult with status
```

#### Query Operations

```javascript
// List all subscriptions
const subscriptions = bus.listSubscriptions();
const filtered = bus.listSubscriptions({ eventType: "commandExecuted", active: true });

// List event definitions
const definitions = bus.listEventDefinitions();

// Get event history
const history = bus.getEventHistory();
const recent = bus.getEventHistory({ eventType: "commandExecuted", limit: 10 });

// Get subscription history
const subHistory = bus.getSubscriptionHistory(limit: 100);

// Get statistics
const stats = bus.getStats();
// { total, activeHandlers, activeSubscriptions, eventsByType, handlersByEventType }
```

## Event Structure

### RuntimeEvent

```javascript
{
  eventId: "evt-1234567890-abc123",      // Unique identifier
  eventType: "commandExecuted",           // Type of event
  source: "CommandBus",                   // What generated this
  target: "Company",                      // What it's about (aggregateType)
  targetId: "comp-123",                   // Optional instance ID
  actor: "cli",                           // Who caused this
  timestamp: "2026-07-08T03:51:21.000Z", // When it occurred
  payload: {                              // Event data
    commandType: "create",
    status: "completed"
  },
  metadata: { /* custom data */ },       // Optional metadata
  correlationId: "corr-1234-5678",       // Links related events
  causationId: "evt-1111-2222"           // Event that caused this
}
```

### RuntimeEventResult

```javascript
{
  eventId: "evt-...",                    // Event ID
  eventType: "commandExecuted",          // Event type
  operationType: "publish",              // Operation performed
  status: "executed",                    // Result status
  handlersNotified: ["handler-1"],       // Which handlers got this
  errors: [],                            // Any errors
  warnings: [],                          // Any warnings
  startTime: "2026-07-08T03:51:21.000Z", // Execution start
  endTime: "2026-07-08T03:51:21.010Z",   // Execution end
  duration: 10,                          // Duration in ms
  validationResults: { /* ... */ },      // Validation details
  dryRun: false                          // Was this a dry-run?
}
```

## CLI Usage

### Demo Dry-Run

```bash
node tools/genesis/genesis.mjs execute event --dry-run
```

Publishes 5 demo events and subscribes to 3 event types, showing:
- Event publication with handler notifications
- Event subscription
- Event bus statistics

### Publish an Event

```bash
# Basic publish
node tools/genesis/genesis.mjs execute event --type publish \
  --event-type commandExecuted \
  --source CommandBus \
  --target Company \
  --aggregate-id comp-123 \
  --payload '{"status":"completed"}'

# With correlation
node tools/genesis/genesis.mjs execute event --type publish \
  --event-type lifecycleStateChanged \
  --source LifecycleEngine \
  --target Order \
  --payload '{"newState":"confirmed"}'
```

### Subscribe to Events

```bash
node tools/genesis/genesis.mjs execute event --type subscribe \
  --event-type workflowStarted \
  --aggregate-type Project
```

### Unsubscribe

```bash
node tools/genesis/genesis.mjs execute event --type unsubscribe \
  --aggregate-id <subscriptionId>
```

### List Subscriptions

```bash
node tools/genesis/genesis.mjs execute event --type listSubscriptions
```

### List Event Definitions

```bash
node tools/genesis/genesis.mjs execute event --type listEventDefinitions
```

## Validation

All events are validated for:

- **Format Validation**:
  - `eventType` is required and valid
  - `source` is required
  - `target` is required
  - `payload` must be a JSON object (not array/primitive)

- **Metadata Validation**:
  - Event type exists in registry
  - Source exists in registry
  - Target exists in registry or is valid aggregate type
  - Correlation ID is valid
  - Actor has permissions

**Validation Semantics**:
- Format errors always fail the operation
- Metadata warnings are recorded but don't fail the operation
- Dry-run validates but doesn't execute

## Dry-Run Mode

Events can be published in dry-run mode:

```javascript
const event = new RuntimeEvent({
  eventType: "workflowStarted",
  source: "WorkflowEngine",
  target: "Project",
  payload: {},
  actor: "cli",
  dryRun: true  // <-- dry-run mode
});

const result = await bus.publish(event);
// result.status === "dryRun"
// Handlers are registered but NOT notified
// No state changes
// Perfect for testing/simulation
```

## Statistics

The Event Bus tracks comprehensive statistics:

```javascript
const stats = bus.getStats();

// Returns:
{
  total: 42,                          // Total events published
  activeHandlers: 5,                  // Currently active handlers
  activeSubscriptions: 8,             // Currently active subscriptions
  subscriptionChanges: 12,            // Total subscription operations
  eventsByType: {                     // Events grouped by type
    commandExecuted: 15,
    lifecycleStateChanged: 20,
    workflowStarted: 7
  },
  handlersByEventType: {              // Handlers grouped by event type
    commandExecuted: 2,
    lifecycleStateChanged: 1,
    workflowStarted: 2
  }
}
```

## Integration Points

### Command Bus Integration

When a command is executed, the Command Bus can publish a `commandExecuted` event:

```javascript
const command = new RuntimeCommand({ /* ... */ });
const cmdResult = await commandBus.execute(command);

if (cmdResult.status === "executed") {
  await eventBus.publish(new RuntimeEvent({
    eventType: "commandExecuted",
    source: "CommandBus",
    target: command.aggregateType,
    targetId: command.aggregateId,
    payload: {
      commandId: command.commandId,
      commandType: command.commandType,
      action: command.action
    },
    actor: command.actor
  }));
}
```

### Lifecycle Transitions

When an aggregate transitions lifecycle states:

```javascript
await eventBus.publish(new RuntimeEvent({
  eventType: "lifecycleStateChanged",
  source: "LifecycleEngine",
  target: aggregateType,
  targetId: aggregateId,
  payload: {
    previousState: oldState,
    newState: newState
  },
  actor: actor
}));
```

### Workflow Events

When workflows are started:

```javascript
await eventBus.publish(new RuntimeEvent({
  eventType: "workflowStarted",
  source: "WorkflowEngine",
  target: targetAggregate,
  payload: {
    workflowName: workflowName,
    workflowId: workflowId
  },
  actor: actor
}));
```

### Automation Triggers

When automations are triggered:

```javascript
await eventBus.publish(new RuntimeEvent({
  eventType: "automationTriggered",
  source: "AutomationEngine",
  target: aggregateType,
  payload: {
    automationRule: ruleName,
    automationId: automationId
  },
  actor: "system"
}));
```

## Error Handling

The Event Bus handles errors gracefully:

```javascript
const result = await bus.publish(event);

if (!result.isSuccess()) {
  console.log("Errors:", result.errors);
  console.log("Warnings:", result.warnings);
}

// Check individual handler failures
for (const handlerId of result.handlersNotified) {
  // Handler processed the event successfully
}
```

## Testing

The Event Bus includes comprehensive tests covering:

- Event publishing (all 8 event types)
- Event subscription and unsubscription
- Event validation (format and metadata)
- Event history and filtering
- Subscription history
- Bus statistics
- Dry-run publishing
- Handler notification
- Multiple subscribers
- Correlation and causation chains

Run tests with:

```bash
node tools/genesis/genesis.mjs test
```

## Files

- **RuntimeEventContract.mjs** - Event and contract classes
- **EventBus.mjs** - Event Bus orchestrator (publish, subscribe, validate)
- **EventBusTests.mjs** - Comprehensive test suite (20 tests)
- **execute.mjs** - CLI integration for event operations

## Patterns

### Choreography Pattern

Components subscribe to events and act independently:

```javascript
// Service A publishes event
await eventBus.publish(new RuntimeEvent({
  eventType: "commandExecuted",
  source: "CommandBus",
  target: "Order",
  payload: { orderId: "ord-123", status: "confirmed" }
}));

// Service B listens and responds
await eventBus.subscribe(new RuntimeEventSubscription({
  eventType: "commandExecuted",
  aggregateType: "Order",
  handlerId: "payment-processor",
  handler: async (event) => {
    await processPayment(event.payload.orderId);
  }
}));
```

### Event Sourcing Pattern

Events form the complete audit trail:

```javascript
// All state changes are recorded as events
const history = eventBus.getEventHistory({ aggregateType: "Company" });
// Can replay to reconstruct current state
```

### Correlation Pattern

Related events are linked:

```javascript
const commandEvent = await eventBus.publish(event1);

const relatedEvent = new RuntimeEvent({
  eventType: "lifecycleStateChanged",
  correlationId: commandEvent.correlationId, // Same correlation
  causationId: commandEvent.eventId,         // Caused by this
  // ...
});

await eventBus.publish(relatedEvent);
```

## Best Practices

1. **Always include context**: Populate source, target, actor, and payload fully
2. **Use correlation IDs**: Link related events for tracing
3. **Validate before publishing**: Call event.validate() first
4. **Handle failures gracefully**: Check result.errors and result.warnings
5. **Use dry-run for testing**: Don't notify handlers in test scenarios
6. **Archive old events**: Periodically clean up ancient event history
7. **Monitor statistics**: Track handler count and event volume
8. **Document custom events**: Make domain events discoverable

## Future Enhancements

- Event filtering by pattern matching
- Dead-letter queue for failed handlers
- Event replay/re-publishing
- Event retention policies
- Persistent event store integration
- Event analytics and reporting
- Distributed event tracing
