import { createHash } from "node:crypto";

import { RuntimeServiceDiagnostics } from "./RuntimeServiceDiagnostics";
import { RuntimeServiceEvidence } from "./RuntimeServiceEvidence";
import { RuntimeServiceRegistry } from "./RuntimeServiceRegistry";
import { RuntimeServiceResolver } from "./RuntimeServiceResolver";
import { RuntimeServiceStateMachine } from "./RuntimeServiceStateMachine";
import { RuntimeServiceTelemetry } from "./RuntimeServiceTelemetry";
import type {
  RuntimeExecutionContextSnapshot,
  RuntimeExecutionContextState,
  RuntimeServiceDependencySnapshot,
  RuntimeServiceDescriptor,
  RuntimeServiceMetrics,
  RuntimeServiceRecord,
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

const CONTEXT_TRANSITIONS: Readonly<Record<RuntimeExecutionContextState, readonly RuntimeExecutionContextState[]>> = Object.freeze({
  Created: ["Configured", "Disposed"],
  Configured: ["Resolved", "Disposed"],
  Resolved: ["Running", "Stopped", "Disposed"],
  Running: ["Stopped", "Disposed"],
  Stopped: ["Running", "Disposed"],
  Disposed: [],
});

interface InternalServiceRecord {
  descriptor: RuntimeServiceDescriptor;
  identity: string;
  machine: RuntimeServiceStateMachine;
  health: "healthy" | "degraded" | "unhealthy";
  failureReason?: string;
}

export interface RuntimeActivationOutcome {
  readonly activated: readonly string[];
  readonly failed: readonly string[];
  readonly blocked: readonly string[];
}

export class RuntimeExecutionContext {
  private state: RuntimeExecutionContextState = "Created";
  private readonly registry = new RuntimeServiceRegistry();
  private readonly resolver = new RuntimeServiceResolver();
  private readonly diagnostics = new RuntimeServiceDiagnostics();
  private readonly telemetry = new RuntimeServiceTelemetry();
  private readonly evidence = new RuntimeServiceEvidence();
  private readonly records = new Map<string, InternalServiceRecord>();
  private dependencyGraph: RuntimeServiceDependencySnapshot = Object.freeze({ activationOrder: Object.freeze([]), shutdownOrder: Object.freeze([]), edges: Object.freeze([]) });

  readonly logicalContextId: string;

  constructor(
    readonly runtimeInstanceId: string,
    readonly runtimeId: string,
  ) {
    this.logicalContextId = this.computeLogicalContextId(runtimeId, []);
    this.evidence.append(runtimeInstanceId, "ContextCreated", { runtimeId, logicalContextId: this.logicalContextId });
  }

  stateValue(): RuntimeExecutionContextState {
    return this.state;
  }

  registerServices(descriptors: readonly RuntimeServiceDescriptor[]): void {
    if (this.state !== "Created" && this.state !== "Configured") {
      throw new Error(`GRT-SVC-CTX-001: Cannot register services from context state ${this.state}`);
    }

    for (const descriptor of descriptors) {
      this.registry.register(descriptor);
      const identity = this.registry.identityFor(descriptor.id);
      this.records.set(descriptor.id, {
        descriptor: this.registry.get(descriptor.id),
        identity,
        machine: new RuntimeServiceStateMachine("Registered"),
        health: "healthy",
      });
      this.evidence.append(this.runtimeInstanceId, "ServiceRegistered", { identity, version: descriptor.version }, descriptor.id);
      this.telemetry.increment("service.registered");
    }

    this.transition("Configured");
    this.evidence.append(this.runtimeInstanceId, "ContextConfigured", { serviceCount: this.records.size });
  }

  resolveServices(): RuntimeServiceDependencySnapshot {
    if (this.state !== "Configured" && this.state !== "Resolved" && this.state !== "Stopped") {
      throw new Error(`GRT-SVC-CTX-002: Cannot resolve services from context state ${this.state}`);
    }

    this.dependencyGraph = this.resolver.resolve(this.registry);
    for (const serviceId of this.dependencyGraph.activationOrder) {
      const record = this.getRecord(serviceId);
      if (record.machine.current() === "Registered") {
        record.machine.transition("Resolving", serviceId);
        record.machine.transition("Resolved", serviceId);
      }
      this.evidence.append(this.runtimeInstanceId, "ServiceResolved", { order: this.dependencyGraph.activationOrder.indexOf(serviceId) }, serviceId);
    }

    this.transition("Resolved");
    this.evidence.append(this.runtimeInstanceId, "ContextResolved", { resolvedCount: this.dependencyGraph.activationOrder.length });
    this.telemetry.increment("service.resolved", this.dependencyGraph.activationOrder.length);
    return this.dependencyGraph;
  }

  activateServices(): RuntimeActivationOutcome {
    if (this.state !== "Resolved" && this.state !== "Stopped") {
      throw new Error(`GRT-SVC-CTX-003: Cannot activate services from context state ${this.state}`);
    }

    if (this.dependencyGraph.activationOrder.length === 0) {
      this.resolveServices();
    }

    const activated: string[] = [];
    const failed: string[] = [];
    const blocked: string[] = [];

    for (const serviceId of this.dependencyGraph.activationOrder) {
      const record = this.getRecord(serviceId);
      const unresolvedDependency = record.descriptor.dependencies.find((dependencyId) => {
        const dependency = this.getRecord(dependencyId);
        return dependency.machine.current() !== "Active";
      });

      if (unresolvedDependency) {
        blocked.push(serviceId);
        record.health = "degraded";
        this.telemetry.increment("service.blocked");
        this.diagnostics.log(
          "Warning",
          "GRT-SVC-ACT-003",
          `Service blocked by dependency state: ${serviceId}`,
          this.runtimeInstanceId,
          serviceId,
          { dependency: unresolvedDependency },
        );
        this.evidence.append(this.runtimeInstanceId, "ServiceBlocked", { dependency: unresolvedDependency }, serviceId);
        continue;
      }

      if (record.machine.current() === "Stopped") {
        record.machine.transition("Activating", serviceId);
      } else if (record.machine.current() === "Resolved") {
        record.machine.transition("Activating", serviceId);
      }

      if (record.descriptor.failOnActivate) {
        record.machine.transition("Failed", serviceId);
        record.health = "unhealthy";
        record.failureReason = "failOnActivate";
        failed.push(serviceId);
        this.telemetry.increment("service.failed");
        this.diagnostics.log(
          "Error",
          "GRT-SVC-ACT-002",
          `Service activation failed: ${serviceId}`,
          this.runtimeInstanceId,
          serviceId,
          { reason: "failOnActivate" },
        );
        this.evidence.append(this.runtimeInstanceId, "ServiceActivationFailed", { reason: "failOnActivate" }, serviceId);
        continue;
      }

      record.machine.transition("Active", serviceId);
      record.health = "healthy";
      record.failureReason = undefined;
      activated.push(serviceId);
      this.telemetry.increment("service.activated");
      this.evidence.append(this.runtimeInstanceId, "ServiceActivated", { activationIndex: activated.length - 1 }, serviceId);
    }

    this.transition("Running");
    this.evidence.append(this.runtimeInstanceId, "ContextRunning", {
      activated: activated.length,
      failed: failed.length,
      blocked: blocked.length,
    });

    return deepFreeze({
      activated,
      failed,
      blocked,
    });
  }

  shutdownServices(): readonly string[] {
    if (this.state !== "Running" && this.state !== "Resolved" && this.state !== "Stopped") {
      throw new Error(`GRT-SVC-CTX-004: Cannot shutdown services from context state ${this.state}`);
    }

    if (this.dependencyGraph.shutdownOrder.length === 0) {
      this.resolveServices();
    }

    const shutdown: string[] = [];
    for (const serviceId of this.dependencyGraph.shutdownOrder) {
      const record = this.getRecord(serviceId);
      if (record.machine.current() === "Active") {
        record.machine.transition("Deactivating", serviceId);
        record.machine.transition("Stopped", serviceId);
        shutdown.push(serviceId);
        this.telemetry.increment("service.stopped");
        this.evidence.append(this.runtimeInstanceId, "ServiceShutdown", { shutdownIndex: shutdown.length - 1 }, serviceId);
      }
      if (record.machine.current() === "Failed") {
        record.machine.transition("Stopped", serviceId);
      }
    }

    this.transition("Stopped");
    this.evidence.append(this.runtimeInstanceId, "ContextStopped", { shutdownCount: shutdown.length });
    return Object.freeze(shutdown);
  }

  serviceIdentity(serviceId: string): string {
    return this.getRecord(serviceId).identity;
  }

  snapshot(): RuntimeExecutionContextSnapshot {
    const services = [...this.records.values()]
      .map((record) => this.toServiceRecord(record))
      .sort((a, b) => a.descriptor.id.localeCompare(b.descriptor.id));

    const metrics: RuntimeServiceMetrics = {
      registeredServiceCount: services.length,
      resolvedServiceCount: services.filter((entry) => ["Resolved", "Activating", "Active", "Deactivating", "Stopped", "Failed", "Disposed"].includes(entry.state)).length,
      activeServiceCount: services.filter((entry) => entry.state === "Active").length,
      failedServiceCount: services.filter((entry) => entry.state === "Failed").length,
      stoppedServiceCount: services.filter((entry) => entry.state === "Stopped").length,
      blockedServiceCount: this.telemetry.snapshot({
        registeredServiceCount: 0,
        resolvedServiceCount: 0,
        activeServiceCount: 0,
        failedServiceCount: 0,
        stoppedServiceCount: 0,
        blockedServiceCount: 0,
        diagnosticsCount: 0,
        evidenceCount: 0,
      }).counters["service.blocked"] ?? 0,
      diagnosticsCount: this.diagnostics.all().length,
      evidenceCount: this.evidence.all().length,
    };

    return deepFreeze({
      runtimeInstanceId: this.runtimeInstanceId,
      runtimeId: this.runtimeId,
      logicalContextId: this.computeLogicalContextId(this.runtimeId, this.registry.list()),
      state: this.state,
      services,
      dependencyGraph: this.dependencyGraph,
      diagnostics: this.diagnostics.all(),
      telemetry: this.telemetry.snapshot(metrics),
      evidence: this.evidence.all(),
    });
  }

  private transition(next: RuntimeExecutionContextState): void {
    if (!CONTEXT_TRANSITIONS[this.state].includes(next)) {
      throw new Error(`GRT-SVC-CTX-005: Illegal context transition ${this.state} -> ${next}`);
    }
    this.state = next;
  }

  private getRecord(serviceId: string): InternalServiceRecord {
    const record = this.records.get(serviceId);
    if (!record) {
      throw new Error(`GRT-SVC-CTX-006: Unknown service: ${serviceId}`);
    }
    return record;
  }

  private toServiceRecord(record: InternalServiceRecord): RuntimeServiceRecord {
    return deepFreeze({
      descriptor: record.descriptor,
      identity: record.identity,
      state: record.machine.current(),
      health: record.health,
      failureReason: record.failureReason,
    });
  }

  private computeLogicalContextId(runtimeId: string, descriptors: readonly RuntimeServiceDescriptor[]): string {
    const canonical = descriptors
      .map((descriptor) => ({
        id: descriptor.id,
        version: descriptor.version,
        dependencies: [...descriptor.dependencies].sort((a, b) => a.localeCompare(b)),
        metadata: descriptor.metadata
          ? Object.fromEntries(Object.entries(descriptor.metadata).sort((a, b) => a[0].localeCompare(b[0])))
          : {},
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    const hash = createHash("sha256").update(JSON.stringify({ runtimeId, services: canonical })).digest("hex");
    return `ctx-${hash.slice(0, 16)}`;
  }
}
