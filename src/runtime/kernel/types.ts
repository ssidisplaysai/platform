import type { EnterpriseRuntimeIR, RuntimeDependencyScope } from "../../compiler/runtime/EnterpriseRuntimeIR";

export type RuntimeKernelState =
  | "Created"
  | "Loading"
  | "Validating"
  | "Initializing"
  | "Starting"
  | "Running"
  | "Stopping"
  | "Stopped"
  | "Recovering"
  | "Recovered"
  | "Failed"
  | "Disposed";

export type RuntimeLogLevel = "Trace" | "Debug" | "Info" | "Warning" | "Error" | "Critical";

export type RuntimeDiagnosticSeverity = "Info" | "Warning" | "Error" | "Critical";

export type RuntimeDiagnosticCategory =
  | "Boot"
  | "Runtime"
  | "Dependency"
  | "Service"
  | "Module"
  | "Plugin"
  | "Workflow"
  | "Scheduler"
  | "Recovery"
  | "Configuration"
  | "Validation";

export interface RuntimeKernelDiagnostic {
  code: string;
  severity: RuntimeDiagnosticSeverity;
  category: RuntimeDiagnosticCategory;
  message: string;
  blocking: boolean;
  sourceId?: string;
}

export interface RuntimeKernelEvent {
  sequence: number;
  eventType:
    | "RuntimeCreated"
    | "RuntimeLoading"
    | "RuntimeValidated"
    | "RuntimeInitializing"
    | "RuntimeStarted"
    | "RuntimeReady"
    | "RuntimeStopping"
    | "RuntimeStopped"
    | "RuntimeRecovering"
    | "RuntimeRecovered"
    | "RuntimeFailed"
    | "RuntimeDisposed";
  state: RuntimeKernelState;
  details: Readonly<Record<string, unknown>>;
}

export interface RuntimeKernelMetrics {
  startupTimeMs: number;
  bootDurationMs: number;
  loadedServices: number;
  loadedModules: number;
  loadedPlugins: number;
  loadedWorkflows: number;
  loadedAgents: number;
  openedApis: number;
  dependencyGraphSize: number;
  runtimeUptimeMs: number;
  healthScore: number;
}

export interface RuntimeTelemetrySnapshot {
  metrics: RuntimeKernelMetrics;
  counters: Readonly<Record<string, number>>;
}

export interface RuntimeConfiguration {
  environment: string;
  profile: string;
  featureFlags: Readonly<Record<string, boolean>>;
  runtimeOptions: Readonly<Record<string, string | number | boolean>>;
}

export interface DependencyRegistration {
  id: string;
  providerId: string;
  contract: string;
  scope: RuntimeDependencyScope;
  lifecycle: RuntimeDependencyScope;
  dependencies: readonly string[];
  external: boolean;
}

export interface RuntimeRegistryEntry {
  id: string;
  kind: "application" | "module" | "service" | "repository" | "plugin" | "workflow" | "agent" | "scheduler" | "provider";
  version: string;
  dependencies: readonly string[];
  lifecycle: RuntimeKernelState;
  activationState: "inactive" | "active";
  health: "healthy" | "degraded" | "unhealthy";
}

export interface RuntimeDependencyGraph {
  nodes: readonly string[];
  edges: readonly { from: string; to: string }[];
  hasCycle: boolean;
}

export interface RuntimeValidationResult {
  diagnostics: readonly RuntimeKernelDiagnostic[];
  valid: boolean;
}

export interface RuntimeContextSnapshot {
  runtimeId: string;
  sessionId: string;
  runtimeVersion: string;
  runtimeState: RuntimeKernelState;
  enterpriseRuntimeIR: EnterpriseRuntimeIR;
  configuration: RuntimeConfiguration;
  environment: string;
  dependencyContainer: Readonly<Record<string, DependencyRegistration>>;
  serviceRegistry: readonly RuntimeRegistryEntry[];
  moduleRegistry: readonly RuntimeRegistryEntry[];
  workflowRegistry: readonly RuntimeRegistryEntry[];
  pluginRegistry: readonly RuntimeRegistryEntry[];
  eventDispatcher: readonly RuntimeKernelEvent[];
  scheduler: readonly string[];
  diagnostics: readonly RuntimeKernelDiagnostic[];
  metrics: RuntimeKernelMetrics;
  logger: readonly { level: RuntimeLogLevel; message: string; details?: Readonly<Record<string, unknown>> }[];
  telemetry: RuntimeTelemetrySnapshot;
  cancellationToken: { cancelled: boolean; reason?: string };
}
