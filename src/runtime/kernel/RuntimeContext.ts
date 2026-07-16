import type { EnterpriseRuntimeIR } from "../../compiler/runtime/EnterpriseRuntimeIR";
import type {
  DependencyRegistration,
  RuntimeConfiguration,
  RuntimeContextSnapshot,
  RuntimeKernelDiagnostic,
  RuntimeKernelEvent,
  RuntimeKernelMetrics,
  RuntimeKernelState,
  RuntimeLogLevel,
  RuntimeRegistryEntry,
  RuntimeTelemetrySnapshot,
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

export class RuntimeContext {
  private snapshotData: RuntimeContextSnapshot;

  constructor(params: {
    runtimeId: string;
    sessionId: string;
    runtimeVersion: string;
    state: RuntimeKernelState;
    enterpriseRuntimeIR: EnterpriseRuntimeIR;
    configuration: RuntimeConfiguration;
    environment: string;
  }) {
    this.snapshotData = deepFreeze({
      runtimeId: params.runtimeId,
      sessionId: params.sessionId,
      runtimeVersion: params.runtimeVersion,
      runtimeState: params.state,
      enterpriseRuntimeIR: params.enterpriseRuntimeIR,
      configuration: params.configuration,
      environment: params.environment,
      dependencyContainer: {},
      serviceRegistry: [],
      moduleRegistry: [],
      workflowRegistry: [],
      pluginRegistry: [],
      eventDispatcher: [],
      scheduler: [],
      diagnostics: [],
      metrics: {
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
      },
      logger: [],
      telemetry: {
        metrics: {
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
        },
        counters: {},
      },
      cancellationToken: { cancelled: false },
    });
  }

  transition(nextState: RuntimeKernelState): void {
    this.snapshotData = deepFreeze({ ...this.snapshotData, runtimeState: nextState });
  }

  update(params: {
    dependencyContainer?: Readonly<Record<string, DependencyRegistration>>;
    serviceRegistry?: readonly RuntimeRegistryEntry[];
    moduleRegistry?: readonly RuntimeRegistryEntry[];
    workflowRegistry?: readonly RuntimeRegistryEntry[];
    pluginRegistry?: readonly RuntimeRegistryEntry[];
    eventDispatcher?: readonly RuntimeKernelEvent[];
    scheduler?: readonly string[];
    diagnostics?: readonly RuntimeKernelDiagnostic[];
    metrics?: RuntimeKernelMetrics;
    logger?: readonly { level: RuntimeLogLevel; message: string; details?: Readonly<Record<string, unknown>> }[];
    telemetry?: RuntimeTelemetrySnapshot;
    cancellationToken?: { cancelled: boolean; reason?: string };
  }): void {
    this.snapshotData = deepFreeze({
      ...this.snapshotData,
      ...params,
    });
  }

  snapshot(): RuntimeContextSnapshot {
    return this.snapshotData;
  }
}
