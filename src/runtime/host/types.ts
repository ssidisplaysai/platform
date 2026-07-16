import type { EnterpriseRuntimeIR } from "../../compiler/runtime/EnterpriseRuntimeIR";
import type { RuntimeContextSnapshot } from "../kernel";

export type HostState = "Created" | "Starting" | "Running" | "Stopping" | "Stopped" | "Recovering" | "Failed" | "Disposed";

export type RuntimeInstanceState =
  | "Created"
  | "Starting"
  | "Running"
  | "Suspended"
  | "Stopping"
  | "Stopped"
  | "Recovering"
  | "Recovered"
  | "Failed"
  | "Disposed";

export type HostLogLevel = "Trace" | "Debug" | "Info" | "Warning" | "Error" | "Critical";

export interface HostEnvironment {
  id: string;
  displayName: string;
  region: string;
  variables: Readonly<Record<string, string>>;
}

export interface HostProfile {
  id: string;
  displayName: string;
  limits: Readonly<Record<string, number>>;
  featureFlags: Readonly<Record<string, boolean>>;
}

export interface RuntimeHostConfig {
  hostId: string;
  version: string;
  defaultEnvironmentId: string;
  defaultProfileId: string;
}

export interface RuntimeIsolation {
  isolationKey: string;
  sandboxId: string;
  namespace: string;
}

export interface RuntimeHostEvent {
  sequence: number;
  eventType:
    | "HostStarting"
    | "HostRunning"
    | "HostStopping"
    | "HostStopped"
    | "HostRecovering"
    | "HostRecovered"
    | "HostFailed"
    | "HostDisposed"
    | "RuntimeInstanceCreated"
    | "RuntimeActivated"
    | "RuntimeDeactivated"
    | "RuntimeSuspended"
    | "RuntimeResumed"
    | "RuntimeRestarted"
    | "RuntimeRecovered"
    | "RuntimeDisposed"
    | "RuntimeCrashed"
    | "RuntimePersisted"
    | "RuntimeRestored";
  hostState: HostState;
  runtimeInstanceId?: string;
  details: Readonly<Record<string, unknown>>;
}

export interface RuntimeInstanceSummary {
  instanceId: string;
  runtimeId: string;
  state: RuntimeInstanceState;
  environmentId: string;
  profileId: string;
  isolation: RuntimeIsolation;
  dependencyCount: number;
  serviceCount: number;
  pluginCount: number;
  workflowCount: number;
  healthScore: number;
  lastFailure?: string;
  persistedRevision: number;
}

export interface RuntimeHostMetrics {
  hostedRuntimeCount: number;
  activeRuntimeCount: number;
  suspendedRuntimeCount: number;
  failedRuntimeCount: number;
  disposedRuntimeCount: number;
  restartCount: number;
  recoveryCount: number;
  crashCount: number;
  eventCount: number;
  persistenceCount: number;
  restorationCount: number;
  aggregateHealthScore: number;
}

export interface RuntimeHostTelemetry {
  counters: Readonly<Record<string, number>>;
  metrics: RuntimeHostMetrics;
}

export interface RuntimeHostSnapshot {
  hostId: string;
  hostVersion: string;
  hostState: HostState;
  environments: readonly HostEnvironment[];
  profiles: readonly HostProfile[];
  runtimes: readonly RuntimeInstanceSummary[];
  events: readonly RuntimeHostEvent[];
  diagnostics: readonly { level: HostLogLevel; message: string; details?: Readonly<Record<string, unknown>> }[];
  telemetry: RuntimeHostTelemetry;
}

export interface RuntimeStateRecord {
  revision: number;
  runtime: RuntimeInstanceSummary;
  context?: RuntimeContextSnapshot;
}

export interface RuntimeInstanceRecord {
  instanceId: string;
  runtimeId: string;
  ir: EnterpriseRuntimeIR;
  state: RuntimeInstanceState;
  environmentId: string;
  profileId: string;
  isolation: RuntimeIsolation;
  dependencyCount: number;
  serviceCount: number;
  pluginCount: number;
  workflowCount: number;
  healthScore: number;
  persistedRevision: number;
  lastFailure?: string;
}
