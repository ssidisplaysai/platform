export type RuntimeScheduleType = "Immediate" | "Slot" | "Recurrence" | "DependencyCompletion" | "RuntimeEvent" | "RuntimeCommand" | "WorkflowCompletion" | "Recovery" | "Manual";

export type RuntimeTriggerType = RuntimeScheduleType;

export type RuntimeTargetKind = "RuntimeObject" | "RuntimeService" | "Workflow" | "Agent" | "Policy" | "System";

export type RuntimeRetryPolicyType = "Never" | "FixedAttempts" | "LinearBackoff" | "ExponentialBackoff" | "UntilExpiration" | "CompensationRequired";

export type RuntimeSchedulingLogLevel = "Trace" | "Debug" | "Info" | "Warning" | "Error" | "Critical";

export type RuntimeSchedulingPrimitive = string | number | boolean | null;

export interface RuntimeExecutionSlot {
  slotId: string;
  sequence: number;
  window: string;
  recurrenceKey?: string;
  metadata?: Readonly<Record<string, RuntimeSchedulingPrimitive>>;
}

export interface RuntimeScheduleTrigger {
  triggerType: RuntimeTriggerType;
  slot?: RuntimeExecutionSlot;
  recurrence?: {
    interval: number;
    limit?: number;
  };
  dependency?: {
    dependencyId: string;
    requiredState: string;
  };
  event?: {
    channel: string;
    topic: string;
  };
  command?: {
    channel: string;
    topic: string;
  };
  workflow?: {
    workflowId: string;
  };
  recovery?: {
    reason: string;
  };
  manual?: {
    approvalId: string;
  };
}

export interface RuntimeExecutionWindowPolicy {
  windowId: string;
  allowedSequences: readonly number[];
  graceSequences: readonly number[];
  metadata?: Readonly<Record<string, RuntimeSchedulingPrimitive>>;
}

export interface RuntimeExpirationPolicy {
  expiresAfterSequence?: number;
  expiresAtSlot?: string;
}

export interface RuntimeRetryPolicy {
  policyType: RuntimeRetryPolicyType;
  maxAttempts?: number;
  interval?: number;
  multiplier?: number;
}

export interface RuntimeScheduleDescriptor {
  scheduleType: RuntimeScheduleType;
  targetKind: RuntimeTargetKind;
  targetId: string;
  targetCapability: string;
  commandChannel: string;
  commandTopic: string;
  commandPayload: Readonly<Record<string, unknown>>;
  trigger: RuntimeScheduleTrigger;
  executionWindow: RuntimeExecutionWindowPolicy;
  retryPolicy: RuntimeRetryPolicy;
  expirationPolicy: RuntimeExpirationPolicy;
  priority: number;
  metadata: Readonly<Record<string, RuntimeSchedulingPrimitive>>;
  version: string;
}

export interface RuntimeScheduleRecord {
  scheduleId: string;
  scheduleType: RuntimeScheduleType;
  targetKind: RuntimeTargetKind;
  targetId: string;
  targetCapability: string;
  commandChannel: string;
  commandTopic: string;
  commandPayload: Readonly<Record<string, unknown>>;
  trigger: RuntimeScheduleTrigger;
  executionWindow: RuntimeExecutionWindowPolicy;
  retryPolicy: RuntimeRetryPolicy;
  expirationPolicy: RuntimeExpirationPolicy;
  priority: number;
  metadata: Readonly<Record<string, RuntimeSchedulingPrimitive>>;
  version: string;
}

export interface RuntimePlanRecord {
  planId: string;
  scheduleId: string;
  runtimeInstanceId: string;
  runtimeId: string;
  triggerType: RuntimeTriggerType;
  targetKind: RuntimeTargetKind;
  targetId: string;
  commandChannel: string;
  commandTopic: string;
  commandPayload: Readonly<Record<string, unknown>>;
  correlationId: string;
  causationId?: string;
  plannedSequence: number;
  executionSlot: RuntimeExecutionSlot;
  attempt: number;
  executionWindow: RuntimeExecutionWindowPolicy;
  expirationPolicy: RuntimeExpirationPolicy;
  retryPolicy: RuntimeRetryPolicy;
  schemaVersion: string;
  metadata: Readonly<Record<string, RuntimeSchedulingPrimitive>>;
}

export interface RuntimeRetryState {
  scheduleId: string;
  lastAttempt: number;
  nextEligibleSequence: number;
  exhausted: boolean;
}

export interface RuntimeSchedulingDiagnostic {
  sequence: number;
  runtimeInstanceId: string;
  level: RuntimeSchedulingLogLevel;
  code: string;
  message: string;
  scheduleId?: string;
  planId?: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface RuntimeSchedulingEvidenceEntry {
  sequence: number;
  runtimeInstanceId: string;
  scheduleId?: string;
  planId?: string;
  type:
    | "ScheduleRegistered"
    | "PlanGenerated"
    | "PlanPublished"
    | "RetryDerived"
    | "ScheduleExpired"
    | "SnapshotPersisted";
  details: Readonly<Record<string, unknown>>;
}

export interface RuntimeSchedulingMetrics {
  scheduleCount: number;
  planCount: number;
  retryStateCount: number;
  expiredScheduleCount: number;
  diagnosticsCount: number;
  evidenceCount: number;
  snapshotCount: number;
}

export interface RuntimeSchedulingTelemetrySnapshot {
  counters: Readonly<Record<string, number>>;
  metrics: RuntimeSchedulingMetrics;
}

export interface RuntimeSchedulingSnapshot {
  runtimeInstanceId: string;
  runtimeId: string;
  schedules: readonly RuntimeScheduleRecord[];
  plans: readonly RuntimePlanRecord[];
  retryState: readonly RuntimeRetryState[];
  executionWindows: readonly RuntimeExecutionWindowPolicy[];
  diagnostics: readonly RuntimeSchedulingDiagnostic[];
  evidence: readonly RuntimeSchedulingEvidenceEntry[];
  telemetry: RuntimeSchedulingTelemetrySnapshot;
}

export interface RuntimeSchedulingSnapshotRecord {
  revision: number;
  snapshot: RuntimeSchedulingSnapshot;
}