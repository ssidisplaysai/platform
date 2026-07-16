export type RuntimeServiceState = "Registered" | "Resolving" | "Resolved" | "Activating" | "Active" | "Deactivating" | "Stopped" | "Failed" | "Disposed";

export type RuntimeExecutionContextState = "Created" | "Configured" | "Resolved" | "Running" | "Stopped" | "Disposed";

export type RuntimeServiceLogLevel = "Trace" | "Debug" | "Info" | "Warning" | "Error" | "Critical";

export interface RuntimeServiceDescriptor {
  id: string;
  version: string;
  dependencies: readonly string[];
  metadata?: Readonly<Record<string, string | number | boolean>>;
  failOnActivate?: boolean;
}

export interface RuntimeServiceRecord {
  descriptor: RuntimeServiceDescriptor;
  identity: string;
  state: RuntimeServiceState;
  health: "healthy" | "degraded" | "unhealthy";
  failureReason?: string;
}

export interface RuntimeServiceDiagnostic {
  sequence: number;
  level: RuntimeServiceLogLevel;
  code: string;
  message: string;
  runtimeInstanceId: string;
  serviceId?: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface RuntimeServiceEvidenceEntry {
  sequence: number;
  runtimeInstanceId: string;
  serviceId?: string;
  type:
    | "ServiceRegistered"
    | "ServiceResolved"
    | "ServiceActivated"
    | "ServiceActivationFailed"
    | "ServiceBlocked"
    | "ServiceShutdown"
    | "ContextCreated"
    | "ContextConfigured"
    | "ContextResolved"
    | "ContextRunning"
    | "ContextStopped"
    | "SnapshotPersisted";
  details: Readonly<Record<string, unknown>>;
}

export interface RuntimeServiceMetrics {
  registeredServiceCount: number;
  resolvedServiceCount: number;
  activeServiceCount: number;
  failedServiceCount: number;
  stoppedServiceCount: number;
  blockedServiceCount: number;
  diagnosticsCount: number;
  evidenceCount: number;
}

export interface RuntimeServiceTelemetrySnapshot {
  counters: Readonly<Record<string, number>>;
  metrics: RuntimeServiceMetrics;
}

export interface RuntimeServiceDependencySnapshot {
  activationOrder: readonly string[];
  shutdownOrder: readonly string[];
  edges: readonly { from: string; to: string }[];
}

export interface RuntimeExecutionContextSnapshot {
  runtimeInstanceId: string;
  runtimeId: string;
  logicalContextId: string;
  state: RuntimeExecutionContextState;
  services: readonly RuntimeServiceRecord[];
  dependencyGraph: RuntimeServiceDependencySnapshot;
  diagnostics: readonly RuntimeServiceDiagnostic[];
  telemetry: RuntimeServiceTelemetrySnapshot;
  evidence: readonly RuntimeServiceEvidenceEntry[];
}

export interface RuntimeExecutionContextRestoreRecord {
  revision: number;
  snapshot: RuntimeExecutionContextSnapshot;
}
