import type { EnterpriseRuntimeIR } from "../../compiler/runtime/EnterpriseRuntimeIR";
import { RuntimeKernel } from "../kernel";
import type { RuntimeContextSnapshot } from "../kernel";
import { EnvironmentRegistry } from "./EnvironmentRegistry";
import { HostDiagnostics } from "./HostDiagnostics";
import { HostEventRouter } from "./HostEventRouter";
import { HostStateMachine } from "./HostStateMachine";
import { HostTelemetry } from "./HostTelemetry";
import { ProfileRegistry } from "./ProfileRegistry";
import { RuntimeActivationPipeline } from "./RuntimeActivationPipeline";
import { RuntimeDependencyResolver } from "./RuntimeDependencyResolver";
import { RuntimeStateStore } from "./RuntimeStateStore";
import type {
  HostEnvironment,
  HostProfile,
  RuntimeHostConfig,
  RuntimeHostMetrics,
  RuntimeHostSnapshot,
  RuntimeInstanceRecord,
  RuntimeInstanceSummary,
  RuntimeStateRecord,
} from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function stableId(prefix: string, ordinal: number): string {
  return `${prefix}-${ordinal.toString().padStart(4, "0")}`;
}

export class EnterpriseHost {
  private readonly stateMachine = new HostStateMachine();
  private readonly environmentRegistry = new EnvironmentRegistry();
  private readonly profileRegistry = new ProfileRegistry();
  private readonly diagnostics = new HostDiagnostics();
  private readonly events = new HostEventRouter();
  private readonly telemetry = new HostTelemetry();
  private readonly activationPipeline = new RuntimeActivationPipeline();
  private readonly dependencyResolver = new RuntimeDependencyResolver();
  private readonly persistence = new RuntimeStateStore();
  private readonly records = new Map<string, RuntimeInstanceRecord>();
  private readonly kernels = new Map<string, RuntimeKernel>();
  private readonly contexts = new Map<string, RuntimeContextSnapshot>();
  private instanceOrdinal = 1;

  constructor(private readonly config: RuntimeHostConfig) {}

  bootstrap(defaultEnvironment: HostEnvironment, defaultProfile: HostProfile): void {
    this.stateMachine.transition("Starting");
    this.events.emit("HostStarting", this.stateMachine.current(), { hostId: this.config.hostId });
    this.environmentRegistry.register(defaultEnvironment);
    this.profileRegistry.register(defaultProfile);
    this.stateMachine.transition("Running");
    this.events.emit("HostRunning", this.stateMachine.current(), { hostId: this.config.hostId });
    this.telemetry.increment("host.bootstrap");
  }

  registerEnvironment(environment: HostEnvironment): void {
    this.environmentRegistry.register(environment);
    this.telemetry.increment("environment.registered");
  }

  registerProfile(profile: HostProfile): void {
    this.profileRegistry.register(profile);
    this.telemetry.increment("profile.registered");
  }

  createRuntimeInstance(runtimeIR: EnterpriseRuntimeIR, options?: { environmentId?: string; profileId?: string }): string {
    this.assertHostRunning();
    const environmentId = options?.environmentId ?? this.config.defaultEnvironmentId;
    const profileId = options?.profileId ?? this.config.defaultProfileId;

    this.environmentRegistry.get(environmentId);
    this.profileRegistry.get(profileId);

    const instanceId = stableId("runtime-instance", this.instanceOrdinal++);
    const runtimeId = runtimeIR.enterpriseRuntime.runtimeId;

    const record: RuntimeInstanceRecord = {
      instanceId,
      runtimeId,
      ir: runtimeIR,
      state: "Created",
      environmentId,
      profileId,
      isolation: {
        isolationKey: `${environmentId}:${profileId}:${instanceId}`,
        sandboxId: stableId("sandbox", this.instanceOrdinal),
        namespace: `${environmentId}.${profileId}.${instanceId}`,
      },
      dependencyCount: 0,
      serviceCount: 0,
      pluginCount: 0,
      workflowCount: 0,
      healthScore: 100,
      persistedRevision: 0,
    };

    this.records.set(instanceId, record);
    this.events.emit("RuntimeInstanceCreated", this.stateMachine.current(), { runtimeId }, instanceId);
    this.telemetry.increment("runtime.created");
    return instanceId;
  }

  activateRuntime(instanceId: string): RuntimeInstanceSummary {
    return this.startRuntime(instanceId);
  }

  startRuntime(instanceId: string): RuntimeInstanceSummary {
    this.assertHostRunning();
    const record = this.getRecord(instanceId);

    if (!["Created", "Stopped", "Recovered", "Suspended", "Failed", "Recovering"].includes(record.state)) {
      throw new Error(`Runtime cannot be started from state: ${record.state}`);
    }

    record.state = "Starting";
    const kernel = new RuntimeKernel();
    const context = kernel.boot(record.ir, {
      environment: record.environmentId,
      profile: record.profileId,
    });

    const contextSnapshot = context.snapshot();
    this.kernels.set(instanceId, kernel);
    this.contexts.set(instanceId, contextSnapshot);

    const dependencies = this.dependencyResolver.resolve(contextSnapshot);
    const activation = this.activationPipeline.activate(contextSnapshot);

    record.dependencyCount = dependencies.dependencyBindingIds.length;
    record.serviceCount = activation.activatedServices.length;
    record.pluginCount = activation.loadedPlugins.length;
    record.workflowCount = activation.bootstrappedSchedules.length;
    record.healthScore = contextSnapshot.metrics.healthScore;
    record.state = "Running";

    this.events.emit("RuntimeActivated", this.stateMachine.current(), {
      contracts: dependencies.contracts,
      externalProviders: dependencies.externalProviderCount,
      injectedSecrets: activation.injectedSecrets,
      securityBindings: activation.initializedSecurityBindings,
    }, instanceId);

    this.telemetry.increment("runtime.started");
    this.telemetry.increment("runtime.events", this.events.history().length);
    this.diagnostics.log("Info", "Runtime activated", { instanceId, runtimeId: record.runtimeId });
    return this.toSummary(record);
  }

  deactivateRuntime(instanceId: string): RuntimeInstanceSummary {
    return this.shutdownRuntime(instanceId);
  }

  shutdownRuntime(instanceId: string): RuntimeInstanceSummary {
    const record = this.getRecord(instanceId);
    if (!record || (record.state !== "Running" && record.state !== "Suspended" && record.state !== "Recovered")) {
      throw new Error(`Runtime cannot be shutdown from state: ${record.state}`);
    }

    const kernel = this.getKernel(instanceId);
    record.state = "Stopping";
    const context = kernel.shutdown("host-shutdown").snapshot();
    this.contexts.set(instanceId, context);
    record.state = "Stopped";

    this.events.emit("RuntimeDeactivated", this.stateMachine.current(), { reason: "host-shutdown" }, instanceId);
    this.telemetry.increment("runtime.stopped");
    return this.toSummary(record);
  }

  restartRuntime(instanceId: string): RuntimeInstanceSummary {
    const record = this.getRecord(instanceId);
    if (record.state === "Running" || record.state === "Suspended" || record.state === "Recovered") {
      this.shutdownRuntime(instanceId);
    }
    this.telemetry.increment("runtime.restart");
    this.events.emit("RuntimeRestarted", this.stateMachine.current(), {}, instanceId);
    return this.startRuntime(instanceId);
  }

  suspendRuntime(instanceId: string): RuntimeInstanceSummary {
    const record = this.getRecord(instanceId);
    if (record.state !== "Running") {
      throw new Error(`Runtime cannot be suspended from state: ${record.state}`);
    }
    record.state = "Suspended";
    this.events.emit("RuntimeSuspended", this.stateMachine.current(), {}, instanceId);
    this.telemetry.increment("runtime.suspended");
    return this.toSummary(record);
  }

  resumeRuntime(instanceId: string): RuntimeInstanceSummary {
    const record = this.getRecord(instanceId);
    if (record.state !== "Suspended") {
      throw new Error(`Runtime cannot be resumed from state: ${record.state}`);
    }
    record.state = "Running";
    this.events.emit("RuntimeResumed", this.stateMachine.current(), {}, instanceId);
    this.telemetry.increment("runtime.resumed");
    return this.toSummary(record);
  }

  crashRuntime(instanceId: string, reason: string): RuntimeInstanceSummary {
    const record = this.getRecord(instanceId);
    record.state = "Failed";
    record.lastFailure = reason;
    this.events.emit("RuntimeCrashed", this.stateMachine.current(), { reason }, instanceId);
    this.telemetry.increment("runtime.crashed");
    this.diagnostics.log("Error", "Runtime crashed", { instanceId, reason });
    return this.toSummary(record);
  }

  recoverRuntime(instanceId: string): RuntimeInstanceSummary {
    const record = this.getRecord(instanceId);
    if (record.state !== "Failed") {
      throw new Error(`Runtime cannot be recovered from state: ${record.state}`);
    }

    record.state = "Recovering";
    this.events.emit("HostRecovering", this.stateMachine.current(), { runtime: instanceId }, instanceId);
    this.startRuntime(instanceId);
    const updated = this.getRecord(instanceId);
    updated.state = "Recovered";
    this.events.emit("RuntimeRecovered", this.stateMachine.current(), {}, instanceId);
    this.telemetry.increment("runtime.recovered");
    return this.toSummary(updated);
  }

  superviseRuntimes(): readonly RuntimeInstanceSummary[] {
    const failed = [...this.records.values()]
      .filter((entry) => entry.state === "Failed")
      .sort((a, b) => a.instanceId.localeCompare(b.instanceId));

    const recovered: RuntimeInstanceSummary[] = [];
    for (const record of failed) {
      recovered.push(this.recoverRuntime(record.instanceId));
    }

    this.telemetry.increment("runtime.supervision", failed.length);
    return Object.freeze(recovered);
  }

  persistRuntimeState(instanceId: string): RuntimeStateRecord {
    const record = this.getRecord(instanceId);
    record.persistedRevision += 1;
    const persisted: RuntimeStateRecord = {
      revision: record.persistedRevision,
      runtime: this.toSummary(record),
      context: this.contexts.get(instanceId),
    };
    this.persistence.save(instanceId, persisted);
    this.events.emit("RuntimePersisted", this.stateMachine.current(), { revision: persisted.revision }, instanceId);
    this.telemetry.increment("runtime.persisted");
    return deepFreeze(persisted);
  }

  restoreRuntimeState(instanceId: string): RuntimeInstanceSummary {
    const persisted = this.persistence.load(instanceId);
    const record = this.getRecord(instanceId);
    record.state = persisted.runtime.state;
    record.persistedRevision = persisted.revision;
    record.healthScore = persisted.runtime.healthScore;
    if (persisted.context) {
      this.contexts.set(instanceId, persisted.context);
    }
    this.events.emit("RuntimeRestored", this.stateMachine.current(), { revision: persisted.revision }, instanceId);
    this.telemetry.increment("runtime.restored");
    return this.toSummary(record);
  }

  disposeRuntime(instanceId: string): RuntimeInstanceSummary {
    const record = this.getRecord(instanceId);
    const kernel = this.kernels.get(instanceId);
    if (kernel && record.state !== "Disposed") {
      try {
        kernel.dispose();
      } catch {
        // dispose is best-effort; state is owned by host lifecycle
      }
    }
    record.state = "Disposed";
    this.events.emit("RuntimeDisposed", this.stateMachine.current(), {}, instanceId);
    this.telemetry.increment("runtime.disposed");
    return this.toSummary(record);
  }

  orchestrateStartup(instanceIds?: readonly string[]): readonly RuntimeInstanceSummary[] {
    const targets = instanceIds
      ? [...instanceIds].sort((a, b) => a.localeCompare(b))
      : [...this.records.keys()].sort((a, b) => a.localeCompare(b));

    const started: RuntimeInstanceSummary[] = [];
    for (const id of targets) {
      const record = this.getRecord(id);
      if (["Created", "Stopped", "Recovered", "Suspended", "Failed"].includes(record.state)) {
        started.push(this.startRuntime(id));
      }
    }
    this.telemetry.increment("runtime.orchestrated-startup", started.length);
    return Object.freeze(started);
  }

  orchestrateShutdown(instanceIds?: readonly string[]): readonly RuntimeInstanceSummary[] {
    const targets = instanceIds
      ? [...instanceIds].sort((a, b) => a.localeCompare(b))
      : [...this.records.keys()].sort((a, b) => a.localeCompare(b));

    const stopped: RuntimeInstanceSummary[] = [];
    for (const id of targets) {
      const record = this.getRecord(id);
      if (["Running", "Suspended", "Recovered"].includes(record.state)) {
        stopped.push(this.shutdownRuntime(id));
      }
    }
    this.telemetry.increment("runtime.orchestrated-shutdown", stopped.length);
    return Object.freeze(stopped);
  }

  shutdownHost(): RuntimeHostSnapshot {
    this.stateMachine.transition("Stopping");
    this.events.emit("HostStopping", this.stateMachine.current(), {});
    this.orchestrateShutdown();
    this.stateMachine.transition("Stopped");
    this.events.emit("HostStopped", this.stateMachine.current(), {});
    return this.snapshot();
  }

  disposeHost(): RuntimeHostSnapshot {
    if (this.stateMachine.current() === "Running") {
      this.shutdownHost();
    }
    this.stateMachine.transition("Disposed");
    this.events.emit("HostDisposed", this.stateMachine.current(), {});
    return this.snapshot();
  }

  snapshot(): RuntimeHostSnapshot {
    const runtimes = [...this.records.values()]
      .map((record) => this.toSummary(record))
      .sort((a, b) => a.instanceId.localeCompare(b.instanceId));

    const metrics = this.computeMetrics(runtimes);
    return deepFreeze({
      hostId: this.config.hostId,
      hostVersion: this.config.version,
      hostState: this.stateMachine.current(),
      environments: this.environmentRegistry.list(),
      profiles: this.profileRegistry.list(),
      runtimes,
      events: this.events.history(),
      diagnostics: this.diagnostics.all(),
      telemetry: this.telemetry.snapshot(metrics),
    });
  }

  private computeMetrics(runtimes: readonly RuntimeInstanceSummary[]): RuntimeHostMetrics {
    const hostedRuntimeCount = runtimes.length;
    const activeRuntimeCount = runtimes.filter((runtime) => runtime.state === "Running" || runtime.state === "Recovered").length;
    const suspendedRuntimeCount = runtimes.filter((runtime) => runtime.state === "Suspended").length;
    const failedRuntimeCount = runtimes.filter((runtime) => runtime.state === "Failed").length;
    const disposedRuntimeCount = runtimes.filter((runtime) => runtime.state === "Disposed").length;
    const aggregateHealthScore = hostedRuntimeCount
      ? Math.round(runtimes.reduce((acc, runtime) => acc + runtime.healthScore, 0) / hostedRuntimeCount)
      : 100;

    const counters = this.telemetry.snapshot({
      hostedRuntimeCount,
      activeRuntimeCount,
      suspendedRuntimeCount,
      failedRuntimeCount,
      disposedRuntimeCount,
      restartCount: 0,
      recoveryCount: 0,
      crashCount: 0,
      eventCount: this.events.history().length,
      persistenceCount: 0,
      restorationCount: 0,
      aggregateHealthScore,
    }).counters;

    return {
      hostedRuntimeCount,
      activeRuntimeCount,
      suspendedRuntimeCount,
      failedRuntimeCount,
      disposedRuntimeCount,
      restartCount: counters["runtime.restart"] ?? 0,
      recoveryCount: counters["runtime.recovered"] ?? 0,
      crashCount: counters["runtime.crashed"] ?? 0,
      eventCount: this.events.history().length,
      persistenceCount: counters["runtime.persisted"] ?? 0,
      restorationCount: counters["runtime.restored"] ?? 0,
      aggregateHealthScore,
    };
  }

  private getRecord(instanceId: string): RuntimeInstanceRecord {
    const record = this.records.get(instanceId);
    if (!record) {
      throw new Error(`Unknown runtime instance: ${instanceId}`);
    }
    return record;
  }

  private getKernel(instanceId: string): RuntimeKernel {
    const kernel = this.kernels.get(instanceId);
    if (!kernel) {
      throw new Error(`Runtime kernel not initialized for instance: ${instanceId}`);
    }
    return kernel;
  }

  private toSummary(record: RuntimeInstanceRecord): RuntimeInstanceSummary {
    return deepFreeze({
      instanceId: record.instanceId,
      runtimeId: record.runtimeId,
      state: record.state,
      environmentId: record.environmentId,
      profileId: record.profileId,
      isolation: record.isolation,
      dependencyCount: record.dependencyCount,
      serviceCount: record.serviceCount,
      pluginCount: record.pluginCount,
      workflowCount: record.workflowCount,
      healthScore: record.healthScore,
      lastFailure: record.lastFailure,
      persistedRevision: record.persistedRevision,
    });
  }

  private assertHostRunning(): void {
    if (this.stateMachine.current() !== "Running") {
      throw new Error(`Host must be running. Current state: ${this.stateMachine.current()}`);
    }
  }
}
