import type { EnterpriseHost } from "../host";
import { RuntimeExecutionContext } from "./RuntimeExecutionContext";
import { RuntimeServiceSnapshotStore } from "./RuntimeServiceSnapshotStore";
import type {
  RuntimeExecutionContextRestoreRecord,
  RuntimeExecutionContextSnapshot,
  RuntimeServiceDescriptor,
} from "./types";

export class RuntimeServiceManager {
  private readonly contexts = new Map<string, RuntimeExecutionContext>();
  private readonly snapshots = new RuntimeServiceSnapshotStore();

  createExecutionContext(runtimeInstanceId: string, runtimeId: string): RuntimeExecutionContext {
    if (this.contexts.has(runtimeInstanceId)) {
      throw new Error(`GRT-SVC-MANAGER-001: Execution context already exists for runtime instance: ${runtimeInstanceId}`);
    }

    const context = new RuntimeExecutionContext(runtimeInstanceId, runtimeId);
    this.contexts.set(runtimeInstanceId, context);
    return context;
  }

  attachToHostRuntime(host: EnterpriseHost, runtimeInstanceId: string): RuntimeExecutionContext {
    const runtime = host.snapshot().runtimes.find((entry) => entry.instanceId === runtimeInstanceId);
    if (!runtime) {
      throw new Error(`GRT-SVC-MANAGER-002: Runtime instance not found in host snapshot: ${runtimeInstanceId}`);
    }

    return this.createExecutionContext(runtime.instanceId, runtime.runtimeId);
  }

  registerServices(runtimeInstanceId: string, descriptors: readonly RuntimeServiceDescriptor[]): void {
    this.context(runtimeInstanceId).registerServices(descriptors);
  }

  resolveServices(runtimeInstanceId: string): void {
    this.context(runtimeInstanceId).resolveServices();
  }

  activateServices(runtimeInstanceId: string): void {
    this.context(runtimeInstanceId).activateServices();
  }

  shutdownServices(runtimeInstanceId: string): void {
    this.context(runtimeInstanceId).shutdownServices();
  }

  snapshot(runtimeInstanceId: string): RuntimeExecutionContextSnapshot {
    return this.context(runtimeInstanceId).snapshot();
  }

  snapshotAll(): readonly RuntimeExecutionContextSnapshot[] {
    return Object.freeze(
      [...this.contexts.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map((entry) => entry[1].snapshot()),
    );
  }

  persistSnapshot(runtimeInstanceId: string): RuntimeExecutionContextRestoreRecord {
    const snapshot = this.snapshot(runtimeInstanceId);
    return this.snapshots.save(snapshot);
  }

  restoreLatest(runtimeInstanceId: string): RuntimeExecutionContextRestoreRecord {
    return this.snapshots.loadLatest(runtimeInstanceId);
  }

  history(runtimeInstanceId: string): readonly RuntimeExecutionContextRestoreRecord[] {
    return this.snapshots.history(runtimeInstanceId);
  }

  private context(runtimeInstanceId: string): RuntimeExecutionContext {
    const context = this.contexts.get(runtimeInstanceId);
    if (!context) {
      throw new Error(`GRT-SVC-MANAGER-003: Unknown runtime execution context: ${runtimeInstanceId}`);
    }
    return context;
  }
}
