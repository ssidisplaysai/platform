# Genesis Automation Runtime Engine v1

## Overview

The Genesis Automation Runtime Engine v1 provides metadata-driven automation execution through the runtime. Automations are triggered by events, lifecycle transitions, workflow states, schedules, manual invocation, or exceptions. Automation actions execute through integrated runtime buses and engines, maintaining consistency with the metadata-driven architecture.

## Architecture

### Design Principles

- **Metadata-Driven**: All automation definitions come from generated automation contracts, no hardcoded logic
- **Generic Runtime**: Single engine handles all automation types across all modules
- **Event-Driven Triggers**: Automations integrate with Event Bus for event-triggered automations
- **Lifecycle Integration**: Automations can be triggered by lifecycle state transitions
- **Workflow Integration**: Automations can be triggered by workflow state changes
- **Bus Integration**: Automation actions execute through Command Bus, Query Bus, Event Bus, and other runtime engines
- **Dry-Run Support**: All automations can be executed in dry-run mode for safe testing
- **Traceability**: Complete execution history with correlation IDs and causation chains
- **No Bypass**: All automations flow through Runtime Container, no direct database access

### Core Concepts

#### RuntimeAutomation
Complete automation definition with:
- `automationId`: Unique identifier
- `name`: Human-readable name
- `module`: Module that owns the automation
- `trigger`: AutomationTrigger defining what initiates automation
- `conditions`: Array of AutomationCondition for conditional execution
- `actions`: Array of AutomationAction to execute
- `enabled`: Whether automation is active
- `priority`: Execution priority (low|normal|high|critical)

#### AutomationTrigger
Defines what initiates an automation:
- `triggerType`: Type of trigger (event|lifecycleTransition|workflowState|schedule|manual|exception)
- `eventType`: For event triggers (e.g., "commandExecuted")
- `aggregateType`: Optional filter for aggregate type
- `sourceState`/`targetState`: For lifecycle triggers
- `workflowState`: For workflow triggers
- `schedule`: Cron string for scheduled triggers
- `errorConditions`: List of error types for exception triggers
- `conditions`: Array of AutomationCondition to further filter

#### AutomationCondition
Conditional logic for automation execution:
- `field`: Field to evaluate (dot notation supported)
- `operator`: Comparison operator (eq|neq|gt|lt|gte|lte|contains|in|exists)
- `value`: Value to compare against
- `logicType`: AND/OR logic combination
- `evaluate(context)`: Evaluates condition against context

#### AutomationAction
Individual action to execute as part of automation:
- `actionType`: Type of action (command|query|eventPublish|workflowStart|notification|approvalRequest|aiAgentAssist|externalIntegration)
- `name`: Action name
- `description`: Action description
- `enabled`: Whether action is active
- `async`: Fire-and-forget or wait for completion
- `retryable`: Whether action should retry on failure
- `maxRetries`: Maximum retry attempts
- `timeout`: Milliseconds to wait for completion
- `onFailure`: Strategy when action fails (halt|continue|compensate)
- `*Payload`: Type-specific payload (commandPayload, eventPayload, etc.)

#### AutomationContext
Context passed through automation execution:
- `contextId`: Unique context identifier
- `automationId`: Automation being executed
- `executionId`: Execution instance ID
- `trigger`: Event or transition data that triggered automation
- `actor`: Who/what initiated the automation
- `data`: Custom data passed through automation
- `results`: Map of action ID to result from previous actions
- `correlationId`: Correlation ID for tracing
- `addResult(actionId, result)`: Store action result
- `getResult(actionId)`: Retrieve previous action result

#### AutomationExecution
Execution instance of an automation:
- `executionId`: Unique execution identifier
- `automationId`: Automation being executed
- `status`: Current status (pending|validating|executing|succeeded|failed|halted)
- `trigger`: What triggered the automation
- `actor`: Who triggered the automation
- `dryRun`: Whether this is a dry-run execution
- `context`: AutomationContext for this execution

#### AutomationExecutionResult
Result of automation execution:
- `executionId`: Execution ID
- `automationId`: Automation ID
- `status`: Final status
- `result`: Execution result object
- `errors`: Array of error messages
- `warnings`: Array of warning messages
- `actionsExecuted`: Count of actions executed
- `actionResults`: Array of individual action results
- `dryRun`: Whether this was dry-run
- `duration`: Milliseconds to complete
- `validationResults`: Metadata validation results

### Trigger Types

#### Event Trigger
Activated when Event Bus publishes matching event
```javascript
{
  triggerType: 'event',
  eventType: 'commandExecuted',
  aggregateType: 'Company'  // optional
}
```

#### Lifecycle Transition Trigger
Activated when aggregate transitions between lifecycle states
```javascript
{
  triggerType: 'lifecycleTransition',
  aggregateType: 'Order',
  sourceState: 'created',
  targetState: 'confirmed'
}
```

#### Workflow State Trigger
Activated when workflow reaches specific state
```javascript
{
  triggerType: 'workflowState',
  workflowId: 'approval-workflow',
  workflowState: 'awaiting_approval'
}
```

#### Schedule Trigger
Activated by cron schedule
```javascript
{
  triggerType: 'schedule',
  schedule: '0 9 * * 1-5'  // 9 AM weekdays
}
```

#### Manual Trigger
Activated by explicit manual invocation
```javascript
{
  triggerType: 'manual'
}
```

#### Exception Trigger
Activated when specific exceptions occur
```javascript
{
  triggerType: 'exception',
  errorConditions: ['validation_failed', 'timeout', 'permission_denied']
}
```

### Action Types

#### Command Action
Executes command through Command Bus
```javascript
{
  actionType: 'command',
  name: 'Create Order',
  commandPayload: {
    commandType: 'create',
    aggregateType: 'Order',
    payload: { status: 'pending' }
  }
}
```

#### Query Action
Executes query through Query Bus
```javascript
{
  actionType: 'query',
  name: 'List Active Orders',
  queryPayload: {
    queryType: 'list',
    aggregateType: 'Order',
    criteria: { status: 'active' }
  }
}
```

#### Event Publish Action
Publishes event through Event Bus
```javascript
{
  actionType: 'eventPublish',
  name: 'Notify Order Created',
  eventPayload: {
    eventType: 'domainEventOccurred',
    target: 'Order',
    payload: { event: 'OrderCreated' }
  }
}
```

#### Workflow Start Action
Starts workflow execution
```javascript
{
  actionType: 'workflowStart',
  name: 'Start Approval Workflow',
  workflowPayload: {
    workflowId: 'order-approval',
    aggregateType: 'Order',
    aggregateId: 'ord-123'
  }
}
```

#### Notification Action
Sends notification
```javascript
{
  actionType: 'notification',
  name: 'Notify Manager',
  notificationPayload: {
    recipients: { roles: ['manager'], type: 'role-based' },
    channels: ['email'],
    template: 'order_created'
  }
}
```

#### Approval Request Action
Requests approval
```javascript
{
  actionType: 'approvalRequest',
  name: 'Request Order Approval',
  approvalPayload: {
    requestType: 'order_review',
    recipients: { roles: ['manager'] },
    escalation: { after: 3600000, to: 'admin' }
  }
}
```

#### AI Agent Assist Action
Invokes AI agent
```javascript
{
  actionType: 'aiAgentAssist',
  name: 'Get AI Recommendation',
  aiAgentPayload: {
    agentId: 'recommendation-agent',
    query: 'Recommend next steps for this order'
  }
}
```

#### External Integration Action
Calls external webhook/API
```javascript
{
  actionType: 'externalIntegration',
  name: 'Sync to ERP System',
  integrationPayload: {
    endpoint: 'https://erp.example.com/api/orders',
    method: 'POST',
    authentication: { type: 'oauth2' }
  }
}
```

## API Reference

### AutomationEngine Class

#### Methods

##### `initialize()`
Initialize engine with runtime manifest and load automation contracts
```javascript
const engine = new AutomationEngine();
engine.initialize();
```

##### `execute(executionData)`
Execute an automation
```javascript
const result = await engine.execute({
  automationId: 'automation:123',
  dryRun: false,
  actor: 'user-456',
  data: { customData: 'value' }
});
```

##### `triggerByEvent(event)`
Trigger all automations matching event
```javascript
const event = new RuntimeEvent({
  eventType: 'commandExecuted',
  target: 'Company',
  targetId: 'comp-123'
});
const results = await engine.triggerByEvent(event);
```

##### `triggerByLifecycleTransition(aggregateType, fromState, toState, aggregateId)`
Trigger automations by lifecycle transition
```javascript
const results = await engine.triggerByLifecycleTransition(
  'Order',
  'created',
  'confirmed',
  'ord-123'
);
```

##### `triggerManual(automationId, data)`
Manually trigger automation
```javascript
const result = await engine.triggerManual(
  'automation:manual-task',
  { actor: 'user-123' }
);
```

##### `listAutomations(filter)`
List automations with optional filters
```javascript
// All automations
const all = engine.listAutomations();

// Filter by module
const crmAutos = engine.listAutomations({ module: 'crm' });

// Filter by trigger type
const eventAutos = engine.listAutomations({ triggerType: 'event' });

// Filter by enabled status
const enabled = engine.listAutomations({ enabled: true });

// Combine filters
const high = engine.listAutomations({ priority: 'high', enabled: true });
```

##### `getAutomationById(automationId)`
Get specific automation
```javascript
const automation = engine.getAutomationById('automation:123');
```

##### `getExecutionHistory(filter)`
Get execution history
```javascript
// All executions
const all = engine.getExecutionHistory();

// Specific automation
const auto = engine.getExecutionHistory({ automationId: 'auto-123' });

// Specific status
const failed = engine.getExecutionHistory({ status: 'failed' });

// Limited results
const recent = engine.getExecutionHistory({ limit: 10 });
```

##### `getExecutionById(executionId)`
Get specific execution
```javascript
const execution = engine.getExecutionById('exe-123');
```

##### `getStats()`
Get engine statistics
```javascript
const stats = engine.getStats();
// {
//   automations: { total, byModule, byTriggerType },
//   executions: {
//     totalExecutions, successfulExecutions, failedExecutions,
//     executionsByModule, executionsByTriggerType, executionsByStatus
//   }
// }
```

## CLI Usage

### Demo Dry-Run
```bash
node tools/genesis/genesis.mjs execute automation --dry-run
```

Executes first automation in dry-run mode, shows:
- Total automations loaded
- Automations by trigger type
- Execution result
- Engine statistics

### List Automations
```bash
node tools/genesis/genesis.mjs execute automation --type listAutomations

# Filter by module
node tools/genesis/genesis.mjs execute automation --type listAutomations --module crm

# Filter by trigger type
node tools/genesis/genesis.mjs execute automation --type listAutomations --trigger-type event

# Filter by priority
node tools/genesis/genesis.mjs execute automation --type listAutomations --priority high
```

### Execute Automation
```bash
node tools/genesis/genesis.mjs execute automation --type execute --automation-id automation:my-automation

# Dry-run execution
node tools/genesis/genesis.mjs execute automation --type execute --automation-id automation:my-automation --dry-run

# With custom actor
node tools/genesis/genesis.mjs execute automation --type execute --automation-id automation:my-automation --actor user-123
```

### Get Statistics
```bash
node tools/genesis/genesis.mjs execute automation --type getStats
```

## Integration Points

### With Event Bus
Automations can be triggered by events:
```javascript
eventBus.on('event-published', async (event) => {
  const results = await automationEngine.triggerByEvent(event);
});
```

### With Lifecycle Engine
Automations can be triggered by state transitions:
```javascript
lifecycleEngine.on('state-changed', async (aggregateType, fromState, toState, aggregateId) => {
  const results = await automationEngine.triggerByLifecycleTransition(
    aggregateType, fromState, toState, aggregateId
  );
});
```

### With Workflow Engine
Automations can be triggered by workflow states:
```javascript
workflowEngine.on('state-reached', async (workflowId, state) => {
  const automations = automationEngine.listAutomations({
    triggerType: 'workflowState',
    workflowId: workflowId
  });
  for (const auto of automations) {
    if (auto.trigger.workflowState === state) {
      await automationEngine.execute({ automationId: auto.automationId });
    }
  }
});
```

### With Command Bus
Automation actions execute commands:
```javascript
const result = await engine.execute({ automationId });
// result.actionResults contains command execution results
```

### With Query Bus
Automation actions execute queries:
```javascript
const result = await engine.execute({ automationId });
// result.actionResults contains query results
```

## Validation

Automations validate against:
1. **Format Validation**: Required fields, correct types
2. **Metadata Validation**: Automation exists, trigger types valid, action types valid
3. **Condition Validation**: All conditions have valid operators and fields
4. **Action Validation**: All actions enabled, required payloads present

```javascript
const validation = automation.validate();
if (!validation.isValid) {
  console.log('Errors:', validation.errors);
  console.log('Warnings:', validation.warnings);
}
```

## Dry-Run Mode

Dry-run executes automations without state changes:
```javascript
const result = await engine.execute({
  automationId: 'automation:123',
  dryRun: true
});
// result.status === 'dryRun'
// result.result.wouldExecute === true
// No actual commands/queries executed
```

## Error Handling

### Failure Strategies
Each action can have an `onFailure` strategy:
- **halt**: Stop automation execution on action failure
- **continue**: Skip failed action, continue to next action
- **compensate**: Execute compensating actions (future enhancement)

```javascript
const action = new AutomationAction({
  actionType: 'command',
  name: 'Critical Step',
  onFailure: 'halt'  // Stop if this fails
});
```

### Error Tracking
All errors and warnings tracked in execution result:
```javascript
const result = await engine.execute({ automationId });
result.errors;    // Array of error messages
result.warnings;  // Array of warning messages
```

## Execution Statistics

Engine tracks comprehensive statistics:
```javascript
const stats = engine.getStats();
// {
//   automations: {
//     total: 50,
//     byModule: { crm: 20, inventory: 15, accounting: 15 },
//     byTriggerType: { event: 30, schedule: 10, manual: 10 }
//   },
//   executions: {
//     totalExecutions: 1000,
//     successfulExecutions: 950,
//     failedExecutions: 50,
//     executionsByModule: { crm: 600, inventory: 300, accounting: 100 },
//     executionsByTriggerType: { event: 700, schedule: 200, manual: 100 },
//     executionsByStatus: { succeeded: 950, failed: 50 }
//   }
// }
```

## Performance Characteristics

- **Initialization**: ~50ms (loads from generated manifests)
- **Trigger Matching**: O(n) where n = number of automations with that trigger type
- **Action Execution**: Depends on action type, typically 10-100ms per action
- **Condition Evaluation**: ~1ms per condition
- **History Storage**: In-memory, ~1KB per execution

## Files

- `tools/genesis/runtime/RuntimeAutomationContract.mjs`: Contract definitions
- `tools/genesis/runtime/AutomationEngine.mjs`: Automation engine implementation
- `tools/genesis/commands/execute.mjs`: CLI interface
- `tools/genesis/tests/suites/AutomationEngineTests.mjs`: Test suite (20 tests)
- `docs/architecture/0010-automation-engine.md`: This documentation

## Design Patterns

### Event-Driven Automation
Automations triggered by system events:
```javascript
// When command executes
commandBus.on('command-executed', async (event) => {
  await automationEngine.triggerByEvent(event);
});
```

### Lifecycle Automation
Automations triggered by state transitions:
```javascript
// When order transitions from created to confirmed
lifecycleEngine.on('Order:created->confirmed', async (aggregateId) => {
  await automationEngine.triggerByLifecycleTransition('Order', 'created', 'confirmed', aggregateId);
});
```

### Conditional Automation
Automations with conditions:
```javascript
const automation = new RuntimeAutomation({
  trigger: { triggerType: 'event', eventType: 'commandExecuted' },
  conditions: [
    { field: 'payload.amount', operator: 'gte', value: 1000 }  // Only if amount >= 1000
  ],
  actions: [...]
});
```

### Multi-Action Automation
Sequential action execution:
```javascript
const automation = new RuntimeAutomation({
  actions: [
    { actionType: 'command', name: 'Create Order' },
    { actionType: 'eventPublish', name: 'Notify Created' },
    { actionType: 'notification', name: 'Alert Manager' }
  ]
});
// Executes in order, with results available to later actions via context
```

## Best Practices

1. **Use Specific Triggers**: Be specific about trigger conditions to avoid unnecessary executions
2. **Set Appropriate Timeouts**: Configure action timeouts based on expected execution time
3. **Implement Retry Logic**: For critical integration actions, enable retries
4. **Monitor Failures**: Track failed executions and investigate root causes
5. **Test in Dry-Run**: Always test automations in dry-run mode first
6. **Use Conditions**: Add conditions to prevent unnecessary executions
7. **Document Automations**: Include clear names and descriptions
8. **Prioritize Critical**: Use priority field to ensure critical automations execute
9. **Review Regularly**: Audit automations quarterly for relevance and performance
10. **Version Control**: Store automation definitions in version control

## Future Enhancements

- Schedule-based triggers with cron parsing
- Workflow state trigger integration
- Compensating actions for saga pattern
- Automation templates for common patterns
- Parallel action execution option
- Advanced retry strategies (exponential backoff, circuit breaker)
- Audit logging with full action trace
- Automation performance profiling
- Rule engine for complex conditions
- Automation marketplace/sharing between modules
