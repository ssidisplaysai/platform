/**
 * execute.mjs - Genesis CLI Execute Command v5
 *
 * Provides CLI interface to Command Bus, Query Bus, Event Bus, Automation Engine, and API Gateway via Runtime.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs execute command --dry-run
 *   node tools/genesis/genesis.mjs execute query --dry-run
 *   node tools/genesis/genesis.mjs execute event --dry-run
 *   node tools/genesis/genesis.mjs execute automation --dry-run
 *   node tools/genesis/genesis.mjs execute api --dry-run
 *
 * @module tools/genesis/commands/execute.mjs
 */

import { CommandBus } from "../runtime/CommandBus.mjs";
import { QueryBus } from "../runtime/QueryBus.mjs";
import { EventBus } from "../runtime/EventBus.mjs";
import { AutomationEngine } from "../runtime/AutomationEngine.mjs";
import { RuntimeApiGateway } from "../runtime/RuntimeApiGateway.mjs";
import { RuntimeCommand } from "../runtime/RuntimeCommandContract.mjs";
import { RuntimeQuery } from "../runtime/RuntimeQueryContract.mjs";
import { RuntimeEvent, RuntimeEventSubscription } from "../runtime/RuntimeEventContract.mjs";

export async function runExecuteCommand(args = []) {
  try {
    const options = parseArgs(args);
    const busType = options.busType || "command";

    if (busType === "command") {
      await runCommandBusExecution(options);
    } else if (busType === "query") {
      await runQueryBusExecution(options);
    } else if (busType === "event") {
      await runEventBusExecution(options);
    } else if (busType === "automation") {
      await runAutomationExecution(options);
    } else if (busType === "api") {
      await runApiGatewayExecution(options);
    } else {
      showExecutionHelp();
    }
  } catch (error) {
    console.error(`\n❌ Execution failed: ${error.message}`);
    process.exit(1);
  }
}

async function runCommandBusExecution(options) {
  const bus = new CommandBus();
  bus.initialize();

  if (options.dryRun && !options.commandType) {
    await runCommandBusDemoDryRun(bus);
    return;
  }

  if (!options.commandType) {
    showCommandBusHelp();
    return;
  }

  const command = new RuntimeCommand({
    commandType: options.commandType,
    aggregateType: options.aggregateType || "DefaultAggregate",
    aggregateId: options.aggregateId,
    action: options.action || options.commandType,
    payload: options.payload || {},
    actor: options.actor || "cli",
    dryRun: options.dryRun || false
  });

  console.log("\n≡ƒÜÇ Genesis Command Bus\n");
  console.log(`  Command ID:    ${command.commandId}`);
  console.log(`  Command Type:  ${command.commandType}`);
  console.log(`  Aggregate:     ${command.aggregateType}${command.aggregateId ? ` (${command.aggregateId})` : ""}`);
  console.log(`  Dry-run:       ${command.dryRun}`);
  console.log(`  Actor:         ${command.actor}\n`);

  const result = await bus.execute(command);
  printCommandResult(result);

  console.log("\n  Command Bus Statistics:");
  const stats = bus.getStats();
  console.log(`    Total Commands:  ${stats.total}`);
  console.log(`    Successful:      ${stats.successful}`);
  console.log(`    Failed:          ${stats.failed}`);
  console.log(`    Dry-runs:        ${stats.dryRuns}`);
  console.log(`    State Changes:   ${stats.stateChanges}`);
  console.log("");
}

async function runQueryBusExecution(options) {
  const bus = new QueryBus();
  bus.initialize();

  if (options.dryRun && !options.queryType) {
    await runQueryBusDemoDryRun(bus);
    return;
  }

  if (!options.queryType) {
    showQueryBusHelp();
    return;
  }

  const query = new RuntimeQuery({
    queryType: options.queryType,
    aggregateType: options.aggregateType || "DefaultAggregate",
    aggregateId: options.aggregateId,
    criteria: options.criteria || {},
    actor: options.actor || "cli"
  });

  console.log("\n≡ƒÜÇ Genesis Query Bus\n");
  console.log(`  Query ID:      ${query.queryId}`);
  console.log(`  Query Type:    ${query.queryType}`);
  console.log(`  Aggregate:     ${query.aggregateType}${query.aggregateId ? ` (${query.aggregateId})` : ""}`);
  console.log(`  Actor:         ${query.actor}\n`);

  const result = await bus.execute(query);
  printQueryResult(result);

  console.log("\n  Query Bus Statistics:");
  const stats = bus.getStats();
  console.log(`    Total Queries:     ${stats.total}`);
  console.log(`    Successful:        ${stats.successful}`);
  console.log(`    Failed:            ${stats.failed}`);
  console.log(`    Items Returned:    ${stats.totalItemsReturned}`);
  console.log(`    Read-only:         ${stats.readOnly ? "✅" : "❌"}`);
  console.log("");
}

async function runEventBusExecution(options) {
  const bus = new EventBus();
  bus.initialize();

  if (options.dryRun && !options.operationType) {
    await runEventBusDemoDryRun(bus);
    return;
  }

  if (options.operationType === "listEventDefinitions") {
    console.log("\n≡ƒÜÇ Genesis Event Bus - Event Definitions\n");
    const definitions = bus.listEventDefinitions();
    for (const def of definitions) {
      console.log(`  • ${def.eventType}`);
      console.log(`    Description: ${def.description}`);
      console.log(`    Source: ${def.source}\n`);
    }
    return;
  }

  if (options.operationType === "listSubscriptions") {
    console.log("\n≡ƒÜÇ Genesis Event Bus - Subscriptions\n");
    const subscriptions = bus.listSubscriptions();
    if (subscriptions.length === 0) {
      console.log("  No active subscriptions\n");
    } else {
      for (const sub of subscriptions) {
        console.log(`  • ${sub.subscriptionId}`);
        console.log(`    Handler: ${sub.handlerId}`);
        console.log(`    Event Type: ${sub.eventType}`);
        console.log(`    Aggregate Type: ${sub.aggregateType || "any"}`);
        console.log(`    Active: ${sub.isActive ? "✅" : "❌"}\n`);
      }
    }
    return;
  }

  if (options.operationType === "subscribe") {
    if (!options.eventType) {
      showEventBusHelp();
      return;
    }

    const subscription = new RuntimeEventSubscription({
      eventType: options.eventType,
      aggregateType: options.aggregateType || null,
      handlerId: `handler-${options.eventType}-${Math.random().toString(36).substr(2, 9)}`,
      subscriber: options.actor || "cli"
    });

    console.log("");
    console.log("≡ƒÜÇ Genesis Event Bus - Subscribe");
    console.log("");
    const result = await bus.subscribe(subscription);
    printEventResult(result);
    return;
  }

  if (options.operationType === "unsubscribe") {
    if (!options.aggregateId) {
      console.log("  Error: --aggregate-id (subscription ID) is required for unsubscribe");
      return;
    }

    console.log("");
    console.log("≡ƒÜÇ Genesis Event Bus - Unsubscribe");
    console.log("");
    const result = await bus.unsubscribe(options.aggregateId);
    printEventResult(result);
    return;
  }

  if (!options.eventType) {
    if (!options.operationType || options.operationType === "publish") {
      showEventBusHelp();
    }
    return;
  }

  const event = new RuntimeEvent({
    eventType: options.eventType,
    source: options.source || "CLI",
    target: options.target || options.aggregateType || "DefaultAggregate",
    targetId: options.aggregateId,
    payload: options.payload || {},
    actor: options.actor || "cli"
  });

  console.log("");
  console.log("≡ƒÜÇ Genesis Event Bus - Publish");
  console.log("");
  console.log(`  Event ID:      ${event.eventId}`);
  console.log(`  Event Type:    ${event.eventType}`);
  console.log(`  Source:        ${event.source}`);
  console.log(`  Target:        ${event.target}${event.targetId ? ` (${event.targetId})` : ""}`);
  console.log(`  Actor:         ${event.actor}`);
  console.log("");

  const result = await bus.publish(event);
  printEventResult(result);

  console.log("");
  console.log("  Event Bus Statistics:");
  const stats = bus.getStats();
  console.log(`    Total Events:          ${stats.total}`);
  console.log(`    Active Handlers:       ${stats.activeHandlers}`);
  console.log(`    Active Subscriptions:  ${stats.activeSubscriptions}`);
  console.log(`    By Event Type:         ${JSON.stringify(stats.eventsByType)}`);
  console.log("");
}

async function runCommandBusDemoDryRun(bus) {
  console.log("\n≡ƒÜÇ Genesis Command Bus - Demo Dry-run\n");

  const demoCommands = [
    {
      commandType: "create",
      aggregateType: "Company",
      action: "POST",
      payload: { name: "Acme Corp" },
      actor: "cli",
      dryRun: true
    },
    {
      commandType: "update",
      aggregateType: "Company",
      aggregateId: "company-123",
      action: "PUT",
      payload: { status: "active" },
      actor: "cli",
      dryRun: true
    },
    {
      commandType: "delete",
      aggregateType: "Customer",
      aggregateId: "cust-456",
      action: "DELETE",
      payload: {},
      actor: "cli",
      dryRun: true
    },
    {
      commandType: "lifecycleTransition",
      aggregateType: "Order",
      aggregateId: "ord-789",
      action: "TRANSITION",
      payload: { currentState: "created", nextState: "initialized" },
      actor: "cli",
      dryRun: true
    },
    {
      commandType: "workflowStart",
      aggregateType: "Project",
      aggregateId: "proj-123",
      action: "EXECUTE",
      payload: { workflowName: "ProjectApproval" },
      actor: "cli",
      dryRun: true
    }
  ];

  for (const cmdData of demoCommands) {
    const result = await bus.execute(cmdData);
    console.log(`  ├─ ${cmdData.commandType.toUpperCase()}: ${cmdData.aggregateType}`);
    console.log(`  │  Aggregate: ${cmdData.aggregateId || "new"}`);
    console.log(`  │  Status: ${result.status}`);
    console.log(
      `  │  Validation: ${result.validationResults.errors?.length === 0 ? "✅ PASS" : "❌ FAIL"}`
    );
    if (result.result?.simulatedResult) {
      console.log(`  │  Result: ${result.result.simulatedResult.message}`);
    }
  }

  console.log("\n");
  console.log("  Command Bus Statistics:");
  const stats = bus.getStats();
  console.log(`    Total Commands: ${stats.total}`);
  console.log(`    Successful:     ${stats.successful}`);
  console.log(`    State Changes:  ${stats.stateChanges}`);
  console.log(`    By Type:        ${JSON.stringify(stats.byType)}`);
  console.log("");
}

async function runQueryBusDemoDryRun(bus) {
  console.log("\n≡ƒÜÇ Genesis Query Bus - Demo Dry-run\n");

  const demoQueries = [
    {
      queryType: "getById",
      aggregateType: "Company",
      aggregateId: "company-123",
      actor: "cli"
    },
    {
      queryType: "list",
      aggregateType: "Customer",
      actor: "cli"
    },
    {
      queryType: "search",
      aggregateType: "Order",
      criteria: { status: "active" },
      actor: "cli"
    },
    {
      queryType: "relationships",
      aggregateType: "Project",
      aggregateId: "proj-123",
      actor: "cli"
    },
    {
      queryType: "status",
      aggregateType: "Task",
      aggregateId: "task-456",
      actor: "cli"
    }
  ];

  for (const qryData of demoQueries) {
    const result = await bus.execute(qryData);
    console.log(`  ├─ ${qryData.queryType.toUpperCase()}: ${qryData.aggregateType}`);
    console.log(`  │  Status: ${result.status}`);
    console.log(
      `  │  Validation: ${result.validationResults.errors?.length === 0 ? "✅ PASS" : "❌ FAIL"}`
    );
    console.log(`  │  Results: ${result.totalCount} items`);
    console.log(`  │  Read-only: ${result.isReadOnly() ? "✅" : "❌"}`);
  }

  console.log("\n");
  console.log("  Query Bus Statistics:");
  const stats = bus.getStats();
  console.log(`    Total Queries:    ${stats.total}`);
  console.log(`    Successful:       ${stats.successful}`);
  console.log(`    Items Returned:   ${stats.totalItemsReturned}`);
  console.log(`    Read-only:        ${stats.readOnly ? "✅ YES" : "❌ NO"}`);
  console.log(`    By Type:          ${JSON.stringify(stats.byType)}`);
  console.log("");
}

async function runEventBusDemoDryRun(bus) {
  console.log("\n≡ƒÜÇ Genesis Event Bus - Demo Dry-run\n");

  const subscriptions = [
    { eventType: "commandExecuted", aggregateType: "Company" },
    { eventType: "workflowStarted", aggregateType: "Project" },
    { eventType: "lifecycleStateChanged", aggregateType: "Order" }
  ];

  for (const subData of subscriptions) {
    const sub = new RuntimeEventSubscription({
      ...subData,
      handlerId: `handler-${subData.eventType}`,
      subscriber: "demo"
    });
    await bus.subscribe(sub);
  }

  const demoEvents = [
    {
      eventType: "commandExecuted",
      source: "CommandBus",
      target: "Company",
      targetId: "company-123",
      payload: { commandType: "update", status: "completed" },
      actor: "cli"
    },
    {
      eventType: "lifecycleStateChanged",
      source: "LifecycleEngine",
      target: "Order",
      targetId: "ord-789",
      payload: { previousState: "created", newState: "confirmed" },
      actor: "system"
    },
    {
      eventType: "workflowStarted",
      source: "WorkflowEngine",
      target: "Project",
      targetId: "proj-123",
      payload: { workflowName: "ProjectApproval" },
      actor: "cli"
    },
    {
      eventType: "automationTriggered",
      source: "AutomationEngine",
      target: "Customer",
      targetId: "cust-456",
      payload: { automationRule: "EmailNotification" },
      actor: "system"
    },
    {
      eventType: "customEvent",
      source: "Application",
      target: "DefaultAggregate",
      payload: { eventName: "CustomBusinessEvent" },
      actor: "cli"
    }
  ];

  for (const eventData of demoEvents) {
    const result = await bus.publish(eventData);
    console.log(`  ├─ ${eventData.eventType}`);
    console.log(`  │  Source: ${eventData.source}`);
    console.log(`  │  Target: ${eventData.target}`);
    console.log(`  │  Status: ${result.status}`);
    console.log(`  │  Handlers Notified: ${result.handlersNotified.length}`);
  }

  console.log("\n");
  console.log("  Event Bus Statistics:");
  const stats = bus.getStats();
  console.log(`    Total Events:          ${stats.total}`);
  console.log(`    Active Handlers:       ${stats.activeHandlers}`);
  console.log(`    Active Subscriptions:  ${stats.activeSubscriptions}`);
  console.log(`    By Event Type:         ${JSON.stringify(stats.eventsByType)}`);
  console.log("");
}

async function runAutomationExecution(options) {
  const engine = new AutomationEngine();
  engine.initialize();

  if (options.dryRun && !options.operationType) {
    await runAutomationEngineDemoDryRun(engine);
    return;
  }

  if (options.operationType === "listAutomations") {
    console.log("");
    console.log("≡ƒÜÇ Genesis Automation Engine - List Automations");
    console.log("");

    const filter = {
      module: options.module,
      enabled: options.enabled === 'true' || options.enabled === true,
      triggerType: options.triggerType,
      priority: options.priority
    };

    // Remove undefined filters
    Object.keys(filter).forEach(key => filter[key] === undefined && delete filter[key]);

    const automations = engine.listAutomations(filter);

    if (automations.length === 0) {
      console.log("  No automations found\n");
    } else {
      console.log(`  Found ${automations.length} automation(s):\n`);
      for (const auto of automations) {
        console.log(`  • ${auto.automationId}`);
        console.log(`    Name: ${auto.name}`);
        console.log(`    Module: ${auto.module}`);
        console.log(`    Trigger: ${auto.trigger.triggerType}`);
        console.log(`    Actions: ${auto.actions.length}`);
        console.log(`    Enabled: ${auto.enabled ? "✅" : "❌"}`);
        console.log(`    Priority: ${auto.priority}\n`);
      }
    }
    return;
  }

  if (options.operationType === "execute") {
    if (!options.automationId && !options.aggregateId) {
      showAutomationBusHelp();
      return;
    }

    const automationId = options.automationId || options.aggregateId;
    console.log("");
    console.log("≡ƒÜÇ Genesis Automation Engine - Execute");
    console.log("");

    const result = await engine.execute({
      automationId,
      trigger: options.trigger,
      actor: options.actor || "cli",
      dryRun: options.dryRun || false,
      data: options.payload || {}
    });

    printAutomationResult(result);
    return;
  }

  if (!options.operationType) {
    showAutomationBusHelp();
    return;
  }

  showAutomationBusHelp();
}

async function runAutomationEngineDemoDryRun(engine) {
  console.log("\n≡ƒÜÇ Genesis Automation Engine - Demo Dry-run\n");

  // List all automations
  const automations = engine.listAutomations();
  console.log(`  Found ${automations.length} total automations\n`);

  if (automations.length > 0) {
    console.log("  Automations by Trigger Type:");
    const byTrigger = {};
    for (const auto of automations) {
      const triggerType = auto.trigger.triggerType;
      byTrigger[triggerType] = (byTrigger[triggerType] || 0) + 1;
    }
    for (const [triggerType, count] of Object.entries(byTrigger)) {
      console.log(`    • ${triggerType}: ${count}`);
    }
    console.log("");

    // Execute first automation in dry-run
    if (automations.length > 0) {
      const firstAuto = automations[0];
      console.log(`  Executing automation in dry-run: ${firstAuto.name}\n`);

      const result = await engine.execute({
        automationId: firstAuto.automationId,
        dryRun: true,
        actor: "cli-demo"
      });

      console.log(`  ├─ ${firstAuto.name}`);
      console.log(`  │  Automation ID: ${result.automationId}`);
      console.log(`  │  Status: ${result.status}`);
      console.log(`  │  Actions: ${firstAuto.actions.length}`);
      console.log(`  │  Duration: ${result.duration}ms`);
      console.log(`  │  Errors: ${result.errors.length}`);
      console.log(`  │  Warnings: ${result.warnings.length}`);
    }
  }

  console.log("\n");
  console.log("  Automation Engine Statistics:");
  const stats = engine.getStats();
  console.log(`    Total Automations:        ${stats.automations.total}`);
  console.log(`    Total Executions:        ${stats.executions.totalExecutions}`);
  console.log(`    Successful Executions:   ${stats.executions.successfulExecutions}`);
  console.log(`    Failed Executions:       ${stats.executions.failedExecutions}`);
  console.log(`    By Trigger Type:         ${JSON.stringify(stats.executions.executionsByTriggerType)}`);
  console.log("");
}

function printAutomationResult(result) {
  const statusIcon = result.isSuccess() ? "✅" : "❌";
  console.log(`${statusIcon} Status: ${result.status}`);
  console.log(`⏱  Duration: ${result.duration}ms`);

  if (result.result) {
    console.log(`📋 Result: ${result.result.message}`);
  }

  if (result.actionsExecuted > 0) {
    console.log(`✨ Actions Executed: ${result.actionsExecuted}`);
  }

  if (result.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    result.errors.forEach(err => console.log(`   • ${err}`));
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    result.warnings.forEach(warn => console.log(`   • ${warn}`));
  }

  if (result.actionResults.length > 0) {
    console.log(`\n📌 Action Results:`);
    result.actionResults.forEach(ar => {
      console.log(`   • ${ar.name || ar.actionId}`);
      console.log(`     Status: ${ar.status}`);
      if (ar.error) {
        console.log(`     Error: ${ar.error}`);
      }
    });
  }

  console.log("");
}

async function runApiGatewayExecution(options) {
  const gateway = new RuntimeApiGateway();
  gateway.initialize();

  if (options.dryRun && !options.operationType) {
    await runApiGatewayDemoDryRun(gateway);
    return;
  }

  if (options.operationType === "listRoutes") {
    console.log("");
    console.log("≡ƒÜÇ Genesis API Gateway - List Routes");
    console.log("");

    const filter = {
      module: options.module,
      method: options.method,
      routeType: options.routeType
    };

    if (options.enabled !== null && options.enabled !== undefined) {
      filter.enabled = options.enabled === 'true' || options.enabled === true;
    }

    // Remove undefined filters
    Object.keys(filter).forEach(key => filter[key] === undefined && delete filter[key]);

    const routes = gateway.listRoutes(filter);

    if (routes.length === 0) {
      console.log("  No routes found\n");
    } else {
      console.log(`  Found ${routes.length} route(s):\n`);
      for (const route of routes) {
        console.log(`  • ${route.method} ${route.path}`);
        console.log(`    Operation: ${route.operation}`);
        console.log(`    Module: ${route.module}`);
        console.log(`    Route Type: ${route.routeType}`);
        console.log(`    Enabled: ${route.enabled ? "✅" : "❌"}\n`);
      }
    }
    return;
  }

  if (options.operationType === "routeRequest") {
    if (!options.method || !options.path) {
      showApiGatewayHelp();
      return;
    }

    console.log("");
    console.log("≡ƒÜÇ Genesis API Gateway - Route Request");
    console.log("");

    const response = await gateway.routeRequest({
      method: options.method,
      path: options.path,
      body: options.payload || {},
      actor: options.actor || "cli",
      dryRun: options.dryRun || false
    });

    printApiGatewayResponse(response);
    return;
  }

  if (options.operationType === "getStats") {
    console.log("");
    console.log("≡ƒÜÇ Genesis API Gateway - Statistics");
    console.log("");

    const stats = gateway.getStats();

    console.log("  Routes:");
    console.log(`    Total: ${stats.routes.total}`);
    if (stats.routes.byModule.length > 0) {
      console.log(`    By Module:`);
      stats.routes.byModule.forEach(m => {
        console.log(`      • ${m.module}: ${m.count}`);
      });
    }

    console.log("");
    console.log("  Requests:");
    console.log(`    Total: ${stats.requests.total}`);
    console.log(`    Successful: ${stats.requests.successful}`);
    console.log(`    Failed: ${stats.requests.failed}`);
    console.log(`    Average Response Time: ${stats.requests.averageResponseTime}ms`);

    if (Object.keys(stats.requests.byMethod).length > 0) {
      console.log(`    By Method: ${JSON.stringify(stats.requests.byMethod)}`);
    }

    console.log("");
    console.log("  Middleware:");
    console.log(`    Registered: ${stats.middleware.registered}`);
    console.log(`    Stack:`);
    stats.middleware.stack.forEach(m => {
      console.log(`      • ${m.name} (order: ${m.order}, enabled: ${m.enabled ? '✅' : '❌'})`);
    });

    console.log("");
    return;
  }

  if (!options.operationType) {
    showApiGatewayHelp();
    return;
  }

  showApiGatewayHelp();
}

async function runApiGatewayDemoDryRun(gateway) {
  console.log("\n≡ƒÜÇ Genesis API Gateway - Demo Dry-run\n");

  // List all routes
  const routes = gateway.listRoutes();
  console.log(`  Found ${routes.length} total routes\n`);

  if (routes.length > 0) {
    console.log("  Routes by HTTP Method:");
    const byMethod = {};
    for (const route of routes) {
      const method = route.method;
      byMethod[method] = (byMethod[method] || 0) + 1;
    }
    for (const [method, count] of Object.entries(byMethod)) {
      console.log(`    • ${method}: ${count}`);
    }
    console.log("");

    // Route a test request in dry-run
    if (routes.length > 0) {
      const firstRoute = routes[0];
      console.log(`  Routing request in dry-run: ${firstRoute.method} ${firstRoute.path}\n`);

      const response = await gateway.routeRequest({
        method: firstRoute.method,
        path: firstRoute.path,
        dryRun: true,
        actor: "cli-demo"
      });

      console.log(`  ├─ ${firstRoute.method} ${firstRoute.path}`);
      console.log(`  │  Operation: ${response.metadata?.operation || firstRoute.operation}`);
      console.log(`  │  Status: ${response.status}`);
      console.log(`  │  Status Code: ${response.statusCode}`);
      console.log(`  │  Duration: ${response.duration}ms`);
      console.log(`  │  Errors: ${response.errors.length}`);
      console.log(`  │  Warnings: ${response.warnings.length}`);
    }
  }

  console.log("\n");
  console.log("  API Gateway Statistics:");
  const stats = gateway.getStats();
  console.log(`    Total Routes:        ${stats.routes.total}`);
  console.log(`    Total Requests:      ${stats.requests.total}`);
  console.log(`    Successful Requests: ${stats.requests.successful}`);
  console.log(`    Failed Requests:     ${stats.requests.failed}`);
  console.log(`    Registered Middleware: ${stats.middleware.registered}`);
  console.log("");
}

function printApiGatewayResponse(response) {
  const statusIcon = response.isSuccess() ? "✅" : "❌";
  console.log(`${statusIcon} Status: ${response.status}`);
  console.log(`📊 Status Code: ${response.statusCode}`);
  console.log(`⏱  Duration: ${response.duration}ms`);

  if (response.message) {
    console.log(`📋 Message: ${response.message}`);
  }

  if (response.result) {
    console.log(`📌 Result:`);
    if (typeof response.result === 'object') {
      console.log(`   ${JSON.stringify(response.result, null, 2).split('\n').join('\n   ')}`);
    } else {
      console.log(`   ${response.result}`);
    }
  }

  if (response.errors.length > 0) {
    console.log(`\n❌ Errors:`);
    response.errors.forEach(err => console.log(`   • ${err}`));
  }

  if (response.warnings.length > 0) {
    console.log(`\n⚠️  Warnings:`);
    response.warnings.forEach(warn => console.log(`   • ${warn}`));
  }

  console.log("");
}

function showApiGatewayHelp() {
  console.log("");
  console.log("Genesis API Gateway - Usage");
  console.log("");
  console.log("Metadata-driven API routing patterns:");
  console.log("");
  console.log("Commands:");
  console.log("  node tools/genesis/genesis.mjs execute api --dry-run");
  console.log("  node tools/genesis/genesis.mjs execute api --type <operation> [options]");
  console.log("");
  console.log("API Gateway Operations:");
  console.log("  • listRoutes    - List all API routes with optional filters");
  console.log("  • routeRequest  - Route HTTP request through gateway");
  console.log("  • getStats      - Get API gateway statistics");
  console.log("");
  console.log("Route Types:");
  console.log("  • standard              - Direct REST API call");
  console.log("  • command               - Routed through Command Bus");
  console.log("  • query                 - Routed through Query Bus");
  console.log("  • event                 - Published through Event Bus");
  console.log("  • automation            - Triggered through Automation Engine");
  console.log("  • workflow              - Started through Workflow Engine");
  console.log("  • diagnostics           - Runtime diagnostics API");
  console.log("");
  console.log("HTTP Methods:");
  console.log("  • GET     - Retrieve resources or execute queries");
  console.log("  • POST    - Create resources or execute commands");
  console.log("  • PUT     - Update resources");
  console.log("  • DELETE  - Delete resources");
  console.log("  • PATCH   - Partial resource updates");
  console.log("");
  console.log("Examples:");
  console.log("  node tools/genesis/genesis.mjs execute api --dry-run");
  console.log("  node tools/genesis/genesis.mjs execute api --type listRoutes");
  console.log("  node tools/genesis/genesis.mjs execute api --type listRoutes --module crm");
  console.log("  node tools/genesis/genesis.mjs execute api --type listRoutes --method GET");
  console.log("  node tools/genesis/genesis.mjs execute api --type routeRequest --method GET --path /api/v1/");
  console.log("  node tools/genesis/genesis.mjs execute api --type routeRequest --method GET --path /api/v1/ --dry-run");
  console.log("  node tools/genesis/genesis.mjs execute api --type getStats");
  console.log("");
}

function parseArgs(args) {
  const options = {
    busType: null,
    commandType: null,
    queryType: null,
    eventType: null,
    automationId: null,
    operationType: null,
    aggregateType: null,
    aggregateId: null,
    action: null,
    criteria: {},
    payload: {},
    source: null,
    target: null,
    actor: "cli",
    dryRun: false,
    module: null,
    enabled: null,
    triggerType: null,
    priority: null,
    method: null,
    path: null,
    routeType: null
  };

  if (args.length > 0 && (args[0] === "command" || args[0] === "query" || args[0] === "event" || args[0] === "automation" || args[0] === "api")) {
    options.busType = args[0];
    args = args.slice(1);
    // Set default operationType only for event bus
    if (options.busType === "event") {
      options.operationType = "publish";
    }
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--type" && args[i + 1]) {
      if (options.busType === "command") {
        options.commandType = args[++i];
      } else if (options.busType === "query") {
        options.queryType = args[++i];
      } else if (options.busType === "event") {
        options.operationType = args[++i];
      } else if (options.busType === "automation") {
        options.operationType = args[++i];
      } else if (options.busType === "api") {
        options.operationType = args[++i];
      }
    } else if (arg === "--event-type" && args[i + 1]) {
      options.eventType = args[++i];
    } else if (arg === "--automation-id" && args[i + 1]) {
      options.automationId = args[++i];
    } else if (arg === "--aggregate-type" && args[i + 1]) {
      options.aggregateType = args[++i];
    } else if (arg === "--aggregate-id" && args[i + 1]) {
      options.aggregateId = args[++i];
    } else if (arg === "--action" && args[i + 1]) {
      options.action = args[++i];
    } else if (arg === "--source" && args[i + 1]) {
      options.source = args[++i];
    } else if (arg === "--target" && args[i + 1]) {
      options.target = args[++i];
    } else if (arg === "--module" && args[i + 1]) {
      options.module = args[++i];
    } else if (arg === "--trigger-type" && args[i + 1]) {
      options.triggerType = args[++i];
    } else if (arg === "--priority" && args[i + 1]) {
      options.priority = args[++i];
    } else if (arg === "--method" && args[i + 1]) {
      options.method = args[++i];
    } else if (arg === "--path" && args[i + 1]) {
      options.path = args[++i];
    } else if (arg === "--route-type" && args[i + 1]) {
      options.routeType = args[++i];
    } else if (arg === "--payload" && args[i + 1]) {
      try {
        options.payload = JSON.parse(args[++i]);
      } catch {
        console.error("Invalid JSON in --payload");
        process.exit(1);
      }
    } else if (arg === "--criteria" && args[i + 1]) {
      try {
        options.criteria = JSON.parse(args[++i]);
      } catch {
        console.error("Invalid JSON in --criteria");
        process.exit(1);
      }
    } else if (arg === "--actor" && args[i + 1]) {
      options.actor = args[++i];
    }
  }

  return options;
}

function printCommandResult(result) {
  const statusIcon = result.status === "executed" || result.status === "dryRun" ? "✅" : "❌";
  console.log(`  ${statusIcon} Status: ${result.status}`);
  console.log(`     Duration: ${result.duration}ms`);
  console.log(`     State Changed: ${result.stateChanged ? "✅ YES" : "❌ NO"}`);
  console.log("");

  if (result.validationResults) {
    console.log("  Validation Results:");
    console.log(`    ├─ Aggregate Type Exists: ${result.validationResults.aggregateTypeExists ? "✅" : "❌"}`);
    console.log(`    ├─ Aggregate Exists:      ${result.validationResults.aggregateExists ? "✅" : "❌"}`);
    console.log(`    ├─ Action Allowed:        ${result.validationResults.actionAllowed ? "✅" : "❌"}`);
    console.log(`    ├─ Actor Allowed:         ${result.validationResults.actorAllowed ? "✅" : "❌"}`);
    console.log(`    └─ Payload Valid:         ${result.validationResults.payloadValid ? "✅" : "❌"}`);
    console.log("");
  }

  if (result.errors.length > 0) {
    console.log("  Errors:");
    result.errors.forEach((err) => {
      console.log(`    • ${err}`);
    });
    console.log("");
  }

  if (result.result) {
    console.log("  Command Result:");
    console.log(`    ${JSON.stringify(result.result, null, 4)}`);
    console.log("");
  }
}

function printQueryResult(result) {
  const statusIcon = result.status === "executed" ? "✅" : "❌";
  console.log(`  ${statusIcon} Status: ${result.status}`);
  console.log(`     Duration: ${result.duration}ms`);
  console.log(`     Read-only: ${result.isReadOnly() ? "✅ YES" : "❌ NO"}`);
  console.log(`     Results: ${result.totalCount} items`);
  console.log("");

  if (result.validationResults) {
    console.log("  Validation Results:");
    console.log(`    ├─ Aggregate Type Exists: ${result.validationResults.aggregateTypeExists ? "✅" : "❌"}`);
    console.log(`    ├─ Actor Allowed:         ${result.validationResults.actorAllowed ? "✅" : "❌"}`);
    console.log(`    ├─ Criteria Valid:        ${result.validationResults.criteriaValid ? "✅" : "❌"}`);
    console.log(`    └─ Pagination Valid:      ${result.validationResults.paginationValid ? "✅" : "❌"}`);
    console.log("");
  }

  if (result.errors.length > 0) {
    console.log("  Errors:");
    result.errors.forEach((err) => {
      console.log(`    • ${err}`);
    });
    console.log("");
  }

  if (result.data) {
    console.log("  Query Data:");
    console.log(`    ${JSON.stringify(result.data, null, 4)}`);
    console.log("");
  } else if (result.results && result.results.length > 0) {
    console.log("  Query Results (sample):");
    result.results.slice(0, 3).forEach((item) => {
      console.log(`    • ${JSON.stringify(item)}`);
    });
    if (result.results.length > 3) {
      console.log(`    ... and ${result.results.length - 3} more`);
    }
    console.log("");
  }
}

function printEventResult(result) {
  const statusIcon = result.status === "executed" || result.status === "dryRun" ? "✅" : "❌";
  console.log(`  ${statusIcon} Status: ${result.status}`);
  console.log(`     Duration: ${result.duration}ms`);
  console.log(`     Handlers Notified: ${result.handlersNotified.length}`);
  console.log("");

  if (result.errors.length > 0) {
    console.log("  Errors:");
    result.errors.forEach((err) => {
      console.log(`    • ${err}`);
    });
    console.log("");
  }

  if (result.warnings.length > 0) {
    console.log("  Warnings:");
    result.warnings.forEach((warn) => {
      console.log(`    • ${warn}`);
    });
    console.log("");
  }

  if (result.result) {
    console.log("  Event Result:");
    console.log(`    ${JSON.stringify(result.result, null, 4)}`);
    console.log("");
  }
}

function showExecutionHelp() {
  console.log(`
Genesis Command Bus, Query Bus, Event Bus, and Automation Engine - Usage

Commands:
  node tools/genesis/genesis.mjs execute command --dry-run
  node tools/genesis/genesis.mjs execute command --type <type> --aggregate-type <type> [options]
  node tools/genesis/genesis.mjs execute query --dry-run
  node tools/genesis/genesis.mjs execute query --type <type> --aggregate-type <type> [options]
  node tools/genesis/genesis.mjs execute event --dry-run
  node tools/genesis/genesis.mjs execute event --type <operation> --event-type <type> [options]
  node tools/genesis/genesis.mjs execute automation --dry-run
  node tools/genesis/genesis.mjs execute automation --type <operation> [options]

Command Types:
  create, update, delete, softDelete, restore, archive
  lifecycleTransition, workflowStart, automationTrigger, aiAgentInvoke

Query Types:
  getById, list, search, relationships, status, moduleLookup, metadataLookup

Event Types:
  lifecycleStateChanged, commandExecuted, queryExecuted, workflowStarted
  automationTriggered, aiAgentInvoked, domainEventOccurred, customEvent

Event Operations:
  publish, subscribe, unsubscribe, listSubscriptions, listEventDefinitions

Automation Operations:
  listAutomations, execute, getStats

Trigger Types:
  event, lifecycleTransition, workflowState, schedule, manual, exception

Action Types:
  command, query, eventPublish, workflowStart, notification, approvalRequest, aiAgentAssist, externalIntegration

Examples:
  node tools/genesis/genesis.mjs execute command --dry-run
  node tools/genesis/genesis.mjs execute command --type create --aggregate-type Company --payload '{"name":"Test"}'
  node tools/genesis/genesis.mjs execute query --dry-run
  node tools/genesis/genesis.mjs execute query --type list --aggregate-type Customer
  node tools/genesis/genesis.mjs execute event --dry-run
  node tools/genesis/genesis.mjs execute event --type publish --event-type commandExecuted --source CommandBus
  node tools/genesis/genesis.mjs execute automation --dry-run
  node tools/genesis/genesis.mjs execute automation --type listAutomations --module crm
`);
}

function showCommandBusHelp() {
  console.log(`
Genesis Command Bus - Usage

State-changing operations:

Commands:
  node tools/genesis/genesis.mjs execute command --dry-run
  node tools/genesis/genesis.mjs execute command --type <type> --aggregate-type <type> [--aggregate-id <id>] [--payload <json>]

Command Types:
  • create              - Create new aggregate
  • update              - Modify existing aggregate
  • delete              - Hard delete aggregate
  • softDelete          - Mark as deleted (recoverable)
  • restore             - Restore soft-deleted aggregate
  • archive             - Archive aggregate
  • lifecycleTransition - Transition lifecycle state
  • workflowStart       - Start workflow
  • automationTrigger   - Trigger automation
  • aiAgentInvoke       - Invoke AI agent

Examples:
  node tools/genesis/genesis.mjs execute command --dry-run
  node tools/genesis/genesis.mjs execute command --type create --aggregate-type Company --payload '{"name":"Acme"}'
  node tools/genesis/genesis.mjs execute command --type update --aggregate-type Company --aggregate-id comp-123 --payload '{"status":"active"}'
  node tools/genesis/genesis.mjs execute command --type delete --aggregate-type Customer --aggregate-id cust-456
`);
}

function showQueryBusHelp() {
  console.log(`
Genesis Query Bus - Usage

Read-only retrieval operations:

Commands:
  node tools/genesis/genesis.mjs execute query --dry-run
  node tools/genesis/genesis.mjs execute query --type <type> --aggregate-type <type> [--aggregate-id <id>] [--criteria <json>]

Query Types:
  • getById        - Retrieve by ID
  • list           - List all items
  • search         - Search with criteria
  • relationships  - Query relationships
  • status         - Check aggregate status
  • moduleLookup   - Look up modules
  • metadataLookup - Look up metadata

Examples:
  node tools/genesis/genesis.mjs execute query --dry-run
  node tools/genesis/genesis.mjs execute query --type list --aggregate-type Customer
  node tools/genesis/genesis.mjs execute query --type getById --aggregate-type Company --aggregate-id comp-123
  node tools/genesis/genesis.mjs execute query --type search --aggregate-type Order --criteria '{"status":"active"}'
`);
}

function showEventBusHelp() {
  console.log(`
Genesis Event Bus - Usage

Event-driven patterns:

Commands:
  node tools/genesis/genesis.mjs execute event --dry-run
  node tools/genesis/genesis.mjs execute event --type <operation> --event-type <type> [options]

Event Operations:
  • publish               - Publish an event
  • subscribe             - Subscribe handler to event type
  • unsubscribe           - Unsubscribe handler from event type
  • listSubscriptions     - List all active subscriptions
  • listEventDefinitions  - List all supported event types

Event Types:
  • lifecycleStateChanged - Aggregate lifecycle state transition
  • commandExecuted       - Command execution completed
  • queryExecuted         - Query execution completed
  • workflowStarted       - Workflow initiated
  • automationTriggered   - Automation rule triggered
  • aiAgentInvoked        - AI agent invoked
  • domainEventOccurred   - Domain-specific business event
  • customEvent           - Custom application event

Examples:
  node tools/genesis/genesis.mjs execute event --dry-run
  node tools/genesis/genesis.mjs execute event --type publish --event-type commandExecuted --source CommandBus --target Company
  node tools/genesis/genesis.mjs execute event --type subscribe --event-type workflowStarted --aggregate-type Project
  node tools/genesis/genesis.mjs execute event --type listSubscriptions
  node tools/genesis/genesis.mjs execute event --type listEventDefinitions
`);
}

function showAutomationBusHelp() {
  console.log(`
Genesis Automation Engine - Usage

Metadata-driven automation patterns:

Commands:
  node tools/genesis/genesis.mjs execute automation --dry-run
  node tools/genesis/genesis.mjs execute automation --type <operation> [options]

Automation Operations:
  • listAutomations  - List all automations with optional filters
  • execute          - Execute specific automation
  • getStats         - Get automation engine statistics

Trigger Types:
  • event                 - Triggered by event
  • lifecycleTransition   - Triggered by lifecycle state change
  • workflowState         - Triggered by workflow reaching state
  • schedule              - Triggered by cron schedule
  • manual                - Triggered manually
  • exception             - Triggered by error/exception

Action Types:
  • command               - Execute command via CommandBus
  • query                 - Execute query via QueryBus
  • eventPublish          - Publish event via EventBus
  • workflowStart         - Start workflow
  • notification          - Send notification
  • approvalRequest       - Request approval
  • aiAgentAssist         - Invoke AI agent
  • externalIntegration   - Call external webhook/API

Examples:
  node tools/genesis/genesis.mjs execute automation --dry-run
  node tools/genesis/genesis.mjs execute automation --type listAutomations
  node tools/genesis/genesis.mjs execute automation --type listAutomations --module crm
  node tools/genesis/genesis.mjs execute automation --type listAutomations --trigger-type event
  node tools/genesis/genesis.mjs execute automation --type execute --automation-id automation:my-automation
  node tools/genesis/genesis.mjs execute automation --type execute --automation-id automation:my-automation --dry-run
`);
}

