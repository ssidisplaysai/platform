import type { EnterpriseRuntimeIR } from "../../compiler/runtime/EnterpriseRuntimeIR";
import { DependencyContainer } from "./DependencyContainer";
import { EventDispatcher } from "./EventDispatcher";
import { HealthManager } from "./HealthManager";
import { ModuleRegistry } from "./ModuleRegistry";
import { PluginRegistry } from "./PluginRegistry";
import { RecoveryManager } from "./RecoveryManager";
import { RuntimeConfigurationManager } from "./RuntimeConfigurationManager";
import { RuntimeContext } from "./RuntimeContext";
import { RuntimeScheduler } from "./Scheduler";
import { ServiceRegistry } from "./ServiceRegistry";
import { RuntimeStateMachine } from "./RuntimeStateMachine";
import { RuntimeKernelValidator } from "./RuntimeValidator";
import type { RuntimeDependencyGraph, RuntimeKernelDiagnostic, RuntimeKernelMetrics, RuntimeLogLevel, RuntimeRegistryEntry } from "./types";

function sortUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function stableGraph(ir: EnterpriseRuntimeIR): RuntimeDependencyGraph {
  const nodes = sortUnique([
    ...ir.enterpriseRuntime.modules.map((entry) => entry.runtimeId),
    ...ir.enterpriseRuntime.applications.map((entry) => entry.runtimeId),
    ...ir.enterpriseRuntime.services.map((entry) => entry.runtimeId),
    ...ir.enterpriseRuntime.workflowBindings.map((entry) => entry.runtimeId),
    ...ir.enterpriseRuntime.pluginBindings.map((entry) => entry.runtimeId),
  ]);

  const edges = ir.enterpriseRuntime.dependencyBindings
    .map((binding) => ({ from: binding.consumerId, to: binding.providerId }))
    .sort((a, b) => `${a.from}:${a.to}`.localeCompare(`${b.from}:${b.to}`));

  return {
    nodes,
    edges,
    hasCycle: ir.enterpriseRuntime.executionGraph.hasCycle,
  };
}

function toRegistryEntry(
  id: string,
  kind: RuntimeRegistryEntry["kind"],
  version: string,
  dependencies: readonly string[],
): RuntimeRegistryEntry {
  return {
    id,
    kind,
    version,
    dependencies: sortUnique(dependencies),
    lifecycle: "Running",
    activationState: "active",
    health: "healthy",
  };
}

export class RuntimeKernel {
  private readonly stateMachine = new RuntimeStateMachine();
  private readonly dependencyContainer = new DependencyContainer();
  private readonly serviceRegistry = new ServiceRegistry();
  private readonly moduleRegistry = new ModuleRegistry();
  private readonly workflowRegistry = new ServiceRegistry();
  private readonly pluginRegistry = new PluginRegistry();
  private readonly events = new EventDispatcher();
  private readonly scheduler = new RuntimeScheduler();
  private readonly health = new HealthManager();
  private readonly recovery = new RecoveryManager();
  private readonly validator = new RuntimeKernelValidator();
  private readonly logger: Array<{ level: RuntimeLogLevel; message: string; details?: Readonly<Record<string, unknown>> }> = [];
  private diagnostics: RuntimeKernelDiagnostic[] = [];
  private context?: RuntimeContext;
  private metrics: RuntimeKernelMetrics = {
    startupTimeMs: 0,
    bootDurationMs: 0,
    loadedServices: 0,
    loadedModules: 0,
    loadedPlugins: 0,
    loadedWorkflows: 0,
    loadedAgents: 0,
    openedApis: 0,
    dependencyGraphSize: 0,
    runtimeUptimeMs: 0,
    healthScore: 100,
  };

  private log(level: RuntimeLogLevel, message: string, details?: Readonly<Record<string, unknown>>): void {
    this.logger.push({ level, message, details });
  }

  private transition(next: Parameters<RuntimeStateMachine["transition"]>[0], eventType: Parameters<EventDispatcher["emit"]>[0]): void {
    const errors = this.stateMachine.transition(next);
    this.diagnostics.push(...errors);
    if (errors.some((entry) => entry.blocking)) {
      this.events.emit("RuntimeFailed", this.stateMachine.current(), { reason: errors[0]?.message ?? "state transition" });
      return;
    }
    this.events.emit(eventType, this.stateMachine.current());
  }

  boot(runtimeIR: EnterpriseRuntimeIR, options?: { environment?: string; profile?: string }): RuntimeContext {
    this.transition("Loading", "RuntimeLoading");

    const config = new RuntimeConfigurationManager({
      environment: options?.environment ?? "production",
      profile: options?.profile ?? "default",
    }).getConfiguration();

    const graph = stableGraph(runtimeIR);
    this.transition("Validating", "RuntimeValidated");

    const validation = this.validator.validate(runtimeIR, graph);
    this.diagnostics.push(...validation.diagnostics);
    if (!validation.valid) {
      this.transition("Failed", "RuntimeFailed");
      throw new Error(`Runtime validation failed: ${validation.diagnostics.filter((d) => d.blocking).map((d) => d.code).join(",")}`);
    }

    this.transition("Initializing", "RuntimeInitializing");

    const runtimeId = runtimeIR.enterpriseRuntime.runtimeId;
    const sessionId = `session-${runtimeIR.deterministicHash.slice(0, 12)}`;
    this.context = new RuntimeContext({
      runtimeId,
      sessionId,
      runtimeVersion: runtimeIR.enterpriseRuntime.version,
      state: this.stateMachine.current(),
      enterpriseRuntimeIR: runtimeIR,
      configuration: config,
      environment: config.environment,
    });

    for (const binding of runtimeIR.enterpriseRuntime.dependencyBindings) {
      this.diagnostics.push(...this.dependencyContainer.register({
        id: binding.bindingId,
        providerId: binding.providerId,
        contract: binding.contract,
        scope: binding.scope,
        lifecycle: binding.lifecycle,
        dependencies: binding.dependencyReferences,
        external: binding.lifecycle === "external",
      }));
    }
    this.diagnostics.push(...this.dependencyContainer.validate());
    if (this.diagnostics.some((entry) => entry.blocking)) {
      this.transition("Failed", "RuntimeFailed");
      throw new Error("Runtime dependency validation failed");
    }

    for (const runtimeModule of runtimeIR.enterpriseRuntime.modules) {
      this.moduleRegistry.register(toRegistryEntry(runtimeModule.runtimeId, "module", runtimeModule.version.semver, []));
    }

    for (const service of runtimeIR.enterpriseRuntime.services) {
      this.serviceRegistry.register(toRegistryEntry(service.runtimeId, "service", service.version.semver, [service.applicationId]));
    }

    for (const app of runtimeIR.enterpriseRuntime.applications) {
      this.serviceRegistry.register(toRegistryEntry(app.runtimeId, "application", app.version.semver, [app.moduleId]));
    }

    for (const workflow of runtimeIR.enterpriseRuntime.workflowBindings) {
      this.workflowRegistry.register(toRegistryEntry(workflow.runtimeId, "workflow", workflow.version.semver, workflow.serviceIds));
    }

    this.pluginRegistry.discover(runtimeIR.enterpriseRuntime.pluginBindings.map((plugin) =>
      toRegistryEntry(plugin.runtimeId, "plugin", plugin.version.semver, [plugin.targetRuntimeId]),
    ));

    this.scheduler.registerStartupJob("kernel-startup");
    this.scheduler.registerBackgroundJob("runtime-supervisor");
    this.scheduler.registerTimer("telemetry-poll");
    for (const workflow of runtimeIR.enterpriseRuntime.workflowBindings) {
      this.scheduler.registerWorkflowExecution(workflow.bindingId);
    }
    this.scheduler.registerMaintenance("maintenance-window");
    this.scheduler.registerHealthPolling("runtime-health");

    this.recovery.registerDefaultSteps();

    this.transition("Starting", "RuntimeStarted");
    this.transition("Running", "RuntimeReady");

    this.health.update({ runtime: 100, dependency: 100, scheduler: 100, module: 100, service: 100, plugin: 100, workflow: 100 });

    this.metrics = {
      startupTimeMs: 0,
      bootDurationMs: 0,
      loadedServices: runtimeIR.enterpriseRuntime.services.length,
      loadedModules: runtimeIR.enterpriseRuntime.modules.length,
      loadedPlugins: runtimeIR.enterpriseRuntime.pluginBindings.length,
      loadedWorkflows: runtimeIR.enterpriseRuntime.workflowBindings.length,
      loadedAgents: runtimeIR.enterpriseRuntime.agentBindings.length,
      openedApis: runtimeIR.enterpriseRuntime.apis.length,
      dependencyGraphSize: graph.nodes.length + graph.edges.length,
      runtimeUptimeMs: 0,
      healthScore: this.health.overallScore(),
    };

    this.log("Info", "Runtime kernel boot completed", { runtimeId, sessionId });

    this.context.transition(this.stateMachine.current());
    this.context.update({
      dependencyContainer: this.dependencyContainer.snapshot(),
      serviceRegistry: this.serviceRegistry.list(),
      moduleRegistry: this.moduleRegistry.list(),
      workflowRegistry: this.workflowRegistry.list(),
      pluginRegistry: this.pluginRegistry.list(),
      eventDispatcher: this.events.history(),
      scheduler: this.scheduler.list(),
      diagnostics: [...this.diagnostics].sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`)),
      metrics: this.metrics,
      logger: Object.freeze([...this.logger]),
      telemetry: {
        metrics: this.metrics,
        counters: Object.freeze({
          events: this.events.history().length,
          recoverySteps: this.recovery.stepsList().length,
        }),
      },
      cancellationToken: { cancelled: false },
    });

    return this.context;
  }

  shutdown(reason = "requested"): RuntimeContext {
    if (!this.context) {
      throw new Error("Runtime context not initialized");
    }

    this.transition("Stopping", "RuntimeStopping");
    this.log("Info", "Runtime shutdown", { reason });
    this.transition("Stopped", "RuntimeStopped");
    this.context.transition(this.stateMachine.current());
    this.context.update({ eventDispatcher: this.events.history(), logger: Object.freeze([...this.logger]) });
    return this.context;
  }

  recover(): RuntimeContext {
    if (!this.context) {
      throw new Error("Runtime context not initialized");
    }

    this.transition("Recovering", "RuntimeRecovering");
    this.log("Warning", "Runtime recovery started", { steps: this.recovery.stepsList() });
    this.transition("Recovered", "RuntimeRecovered");
    this.context.transition(this.stateMachine.current());
    this.context.update({ eventDispatcher: this.events.history(), logger: Object.freeze([...this.logger]) });
    return this.context;
  }

  dispose(): RuntimeContext {
    if (!this.context) {
      throw new Error("Runtime context not initialized");
    }

    this.transition("Disposed", "RuntimeDisposed");
    this.context.transition(this.stateMachine.current());
    this.context.update({ eventDispatcher: this.events.history(), logger: Object.freeze([...this.logger]) });
    return this.context;
  }

  state() {
    return this.stateMachine.current();
  }
}
