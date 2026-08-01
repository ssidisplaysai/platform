export type DiagnosticSeverity = "info" | "warning" | "error";

export type CompilerLifecycleState =
  | "DECLARED"
  | "READY"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "REPLAYED"
  | "CERTIFIED"
  | "ARCHIVED";

export type CompilerSessionState = "CREATED" | "RUNNING" | "COMPLETED" | "FAILED" | "TERMINATED";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface StructuredDiagnostic {
  readonly timestamp: string;
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface CompilerEnvironment {
  readonly environmentName: string;
  readonly platform: string;
  readonly arch: string;
  readonly nodeVersion: string;
  readonly timezone: string;
}

export interface CompilerConfiguration {
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly programVersion: string;
  readonly diagnosticsLevel: "normal" | "verbose";
  readonly deterministicMode: true;
  readonly features: readonly string[];
}

export interface CompilerLifecycleEvent {
  readonly state: CompilerLifecycleState;
  readonly at: string;
  readonly reason: string;
}

export interface CompilerLifecycle {
  readonly currentState: CompilerLifecycleState;
  readonly history: readonly CompilerLifecycleEvent[];
}

export interface CompilerSession {
  readonly sessionId: string;
  readonly executionId: string;
  readonly purpose: string;
  readonly state: CompilerSessionState;
  readonly createdAt: string;
  readonly startedAt?: string;
  readonly endedAt?: string;
}

export interface RuntimeManifest {
  readonly manifestId: string;
  readonly runtimeId: string;
  readonly sessionId: string;
  readonly executionId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly lifecycleState: CompilerLifecycleState;
  readonly createdAt: string;
  readonly checksum: string;
}

export interface ReplayContext {
  readonly replayId: string;
  readonly runtimeId: string;
  readonly sessionId: string;
  readonly executionId: string;
  readonly sourceManifestId: string;
  readonly deterministicFingerprint: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly createdAt: string;
}

export interface CertificationContext {
  readonly certificationId: string;
  readonly runtimeId: string;
  readonly sessionId: string;
  readonly executionId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly evidenceReferences: readonly string[];
  readonly readiness: "PENDING" | "READY";
  readonly createdAt: string;
}

export interface CompilerExecutionContext {
  readonly contextId: string;
  readonly runtimeId: string;
  readonly sessionId: string;
  readonly executionId: string;
  readonly compilerVersion: string;
  readonly specificationVersion: string;
  readonly lifecycleState: CompilerLifecycleState;
  readonly environment: CompilerEnvironment;
  readonly configuration: CompilerConfiguration;
  readonly manifest: RuntimeManifest;
  readonly replay: ReplayContext;
  readonly certification: CertificationContext;
  readonly createdAt: string;
}

export interface HealthCheckResult {
  readonly name: string;
  readonly status: "pass" | "warn" | "fail";
  readonly detail: string;
}

export interface RuntimeHealth {
  readonly status: HealthStatus;
  readonly checkedAt: string;
  readonly checks: readonly HealthCheckResult[];
}

export interface CompilerRuntimeState {
  readonly runtimeId: string;
  readonly lifecycle: CompilerLifecycle;
  readonly configuration: CompilerConfiguration;
  readonly environment: CompilerEnvironment;
  readonly activeSessions: readonly CompilerSession[];
  readonly completedSessions: readonly CompilerSession[];
  readonly diagnostics: readonly StructuredDiagnostic[];
  readonly health: RuntimeHealth;
}
