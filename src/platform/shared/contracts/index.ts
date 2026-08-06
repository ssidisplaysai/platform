export type SharedIdentifier = string;
export type TenantId = string;

export type LifecycleState = "CREATED" | "STARTING" | "RUNNING" | "STOPPING" | "STOPPED" | "FAILED";

export type RuntimeMetadata = {
  contractVersion: string;
  runtimeVersion: string;
  persistence: string;
  providers: string[];
};

export type RuntimeSnapshot<TState> = {
  lifecycle: LifecycleState;
  startedAt?: string;
  state: TState;
};

export type ActorContext = {
  actorId: string;
  occurredAt: string;
  source?: string;
  correlationId?: string;
  causationId?: string;
};

export type AuditRecord = {
  auditId: string;
  eventType: string;
  actor: ActorContext;
  message: string;
  details?: Record<string, unknown>;
  recordedAt: string;
};

export type MetricValue = number;

export type HealthStatus = "HEALTHY" | "DEGRADED" | "FAILED";

export type HealthCheck = {
  name: string;
  status: "PASS" | "WARN" | "FAIL";
  detail: string;
};

export type HealthReport = {
  status: HealthStatus;
  generatedAt: string;
  checks: HealthCheck[];
};

export class SharedPlatformError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  ) {
    super(message);
    this.name = "SharedPlatformError";
  }
}
