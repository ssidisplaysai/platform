import type { RuntimeEnvelopeType, RuntimePublishResult } from "../messaging";
import type { RuntimeScheduleType, RuntimeTargetKind } from "../scheduling";

export type RuntimeProcessType = "RuntimeWorkflow";

export type RuntimeWorkflowState =
  | "Declared"
  | "Registered"
  | "Materialized"
  | "Ready"
  | "Running"
  | "Waiting"
  | "Resuming"
  | "Completed"
  | "Failed"
  | "Compensating"
  | "Compensated"
  | "CompensationFailed"
  | "Archived";

export type RuntimeWorkflowLogLevel = "Trace" | "Debug" | "Info" | "Warning" | "Error" | "Critical";

export type RuntimeWorkflowPrimitive = string | number | boolean | null;

export type RuntimeWorkflowTransitionTriggerType =
  | "ActivityCompleted"
  | "ActivityFailed"
  | "WaitingObserved"
  | "WaitingResumed"
  | "EnvelopeObserved"
  | "SchedulerPublished"
  | "CompensationCompleted";

export type RuntimeObservationType = "Envelope" | "SchedulerPublicationResult";

export type RuntimeWaitingObservationType =
  | "RuntimeEvent"
  | "RuntimeReply"
  | "SchedulerPublicationResult"
  | "RuntimePlanOutcome"
  | "DependencyCompletion"
  | "ManualApproval";

export type RuntimeWaitingResumePolicy = "CompleteActivity" | "ResumeOnly" | "FailActivity";

export type RuntimeWaitingStateStatus = "Active" | "Observed" | "Resumed" | "Completed" | "Failed";

export type RuntimeCompensationStatus = "NotRequired" | "Pending" | "Running" | "Completed" | "Failed";

export interface RuntimeProcessRecord {
  processId: string;
  processType: RuntimeProcessType;
  name: string;
  version: string;
  schemaVersion: string;
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeTransitionGuardDescriptor {
  type: "always" | "payloadEquals" | "metadataEquals" | "correlationEquals" | "causationEquals";
  key?: string;
  value?: RuntimeWorkflowPrimitive;
}

export interface RuntimeWaitingPolicyDescriptor {
  waitingReason: string;
  observationType: RuntimeWaitingObservationType;
  expectedEnvelopeType?: RuntimeEnvelopeType;
  expectedChannel?: string;
  expectedTopic?: string;
  expectedMessageType?: string;
  correlationId?: string;
  causationId?: string;
  resumePolicy: RuntimeWaitingResumePolicy;
  metadata?: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeActivityDescriptor {
  activityId: string;
  activityType: string;
  targetKind: RuntimeTargetKind;
  targetId: string;
  targetCapability: string;
  commandChannel: string;
  commandTopic: string;
  input: Readonly<Record<string, unknown>>;
  expectedOutcomes: readonly string[];
  transitionIds: readonly string[];
  waitingPolicy?: RuntimeWaitingPolicyDescriptor;
  compensationActivityId?: string;
  metadata?: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
  version: string;
}

export interface RuntimeTransitionDescriptor {
  transitionId?: string;
  fromActivityId: string;
  toActivityId: string;
  triggerType: RuntimeWorkflowTransitionTriggerType;
  expectedEnvelopeType?: RuntimeEnvelopeType;
  expectedChannel?: string;
  expectedTopic?: string;
  expectedMessageType?: string;
  guardDescriptor?: RuntimeTransitionGuardDescriptor;
  priority: number;
  metadata?: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeWaitingDefinition {
  waitingDefinitionId?: string;
  activityId: string;
  waitingReason: string;
  expectedEnvelopeType?: RuntimeEnvelopeType;
  expectedChannel?: string;
  expectedTopic?: string;
  expectedMessageType?: string;
  correlationId?: string;
  causationId?: string;
  resumePolicy: RuntimeWaitingResumePolicy;
  metadata?: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeCompensationDefinition {
  compensationDefinitionId?: string;
  activityId: string;
  compensationActivityId: string;
  trigger: "OnFailure";
  metadata?: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeWorkflowDescriptor {
  processType: RuntimeProcessType;
  name: string;
  version: string;
  entryActivityIds: readonly string[];
  exitActivityIds: readonly string[];
  activities: readonly RuntimeActivityDescriptor[];
  transitions: readonly RuntimeTransitionDescriptor[];
  waitingDefinitions: readonly RuntimeWaitingDefinition[];
  compensationDefinitions: readonly RuntimeCompensationDefinition[];
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
  schemaVersion: string;
}

export interface RuntimeActivityRecord {
  activityId: string;
  activityType: string;
  targetKind: RuntimeTargetKind;
  targetId: string;
  targetCapability: string;
  commandChannel: string;
  commandTopic: string;
  input: Readonly<Record<string, unknown>>;
  expectedOutcomes: readonly string[];
  transitionIds: readonly string[];
  waitingPolicy?: RuntimeWaitingPolicyDescriptor;
  compensationActivityId?: string;
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
  version: string;
}

export interface RuntimeTransitionRecord {
  transitionId: string;
  fromActivityId: string;
  toActivityId: string;
  triggerType: RuntimeWorkflowTransitionTriggerType;
  expectedEnvelopeType?: RuntimeEnvelopeType;
  expectedChannel?: string;
  expectedTopic?: string;
  expectedMessageType?: string;
  guardDescriptor?: RuntimeTransitionGuardDescriptor;
  priority: number;
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeWaitingDefinitionRecord {
  waitingDefinitionId: string;
  activityId: string;
  waitingReason: string;
  expectedEnvelopeType?: RuntimeEnvelopeType;
  expectedChannel?: string;
  expectedTopic?: string;
  expectedMessageType?: string;
  correlationId?: string;
  causationId?: string;
  resumePolicy: RuntimeWaitingResumePolicy;
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeCompensationDefinitionRecord {
  compensationDefinitionId: string;
  activityId: string;
  compensationActivityId: string;
  trigger: "OnFailure";
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeWorkflowRecord {
  processId: string;
  workflowId: string;
  processType: RuntimeProcessType;
  name: string;
  version: string;
  entryActivityIds: readonly string[];
  exitActivityIds: readonly string[];
  activities: readonly RuntimeActivityRecord[];
  transitions: readonly RuntimeTransitionRecord[];
  waitingDefinitions: readonly RuntimeWaitingDefinitionRecord[];
  compensationDefinitions: readonly RuntimeCompensationDefinitionRecord[];
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
  schemaVersion: string;
}

export interface RuntimeCompensationStateRecord {
  status: RuntimeCompensationStatus;
  failedActivityId?: string;
  activityIds: readonly string[];
  intentIds: readonly string[];
}

export interface RuntimePlanReference {
  sequence: number;
  intentId: string;
  scheduleId: string;
  planId: string;
  publishedMessageId?: string;
}

export interface RuntimeWorkflowInstanceRecord {
  workflowInstanceId: string;
  workflowId: string;
  runtimeInstanceId: string;
  runtimeId: string;
  state: RuntimeWorkflowState;
  activeActivityIds: readonly string[];
  completedActivityIds: readonly string[];
  failedActivityIds: readonly string[];
  waitingStateIds: readonly string[];
  compensationState: RuntimeCompensationStateRecord;
  executionIntentIds: readonly string[];
  runtimePlanReferences: readonly RuntimePlanReference[];
  correlationId: string;
  causationId?: string;
  revision: number;
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeActivityGraphEdge {
  fromActivityId: string;
  transitionId: string;
  toActivityId: string;
}

export interface RuntimeActivityGraphSnapshot {
  workflowId: string;
  activities: readonly RuntimeActivityRecord[];
  edges: readonly RuntimeActivityGraphEdge[];
  entryActivityIds: readonly string[];
  exitActivityIds: readonly string[];
  waitingActivityIds: readonly string[];
  compensationActivityIds: readonly string[];
}

export interface RuntimeExecutionIntentConstraints {
  scheduleType: RuntimeScheduleType;
  requiredSequence?: number;
  metadata?: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeExecutionIntentRecord {
  intentId: string;
  workflowId: string;
  workflowInstanceId: string;
  activityId: string;
  runtimeInstanceId: string;
  runtimeId: string;
  targetKind: RuntimeTargetKind;
  targetId: string;
  targetCapability: string;
  commandChannel: string;
  commandTopic: string;
  payload: Readonly<Record<string, unknown>>;
  priority: number;
  executionConstraints: RuntimeExecutionIntentConstraints;
  correlationId: string;
  causationId?: string;
  attempt: number;
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
  schemaVersion: string;
}

export interface RuntimeWorkflowObservation {
  observationId: string;
  workflowInstanceId: string;
  observationType: RuntimeObservationType;
  triggerType: RuntimeWorkflowTransitionTriggerType;
  messageId?: string;
  envelopeType?: RuntimeEnvelopeType;
  channel?: string;
  topic?: string;
  messageType?: string;
  correlationId?: string;
  causationId?: string;
  payload?: Readonly<Record<string, unknown>>;
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
  scheduleId?: string;
  planId?: string;
  intentId?: string;
}

export interface RuntimeWaitingStateRecord {
  waitingStateId: string;
  workflowInstanceId: string;
  activityId: string;
  waitingReason: string;
  expectedEnvelopeType?: RuntimeEnvelopeType;
  expectedChannel?: string;
  expectedTopic?: string;
  expectedMessageType?: string;
  correlationId?: string;
  causationId?: string;
  resumePolicy: RuntimeWaitingResumePolicy;
  state: RuntimeWaitingStateStatus;
  revision: number;
  metadata: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export interface RuntimeTransitionApplication {
  activityId: string;
  transitionIds: readonly string[];
  nextActivityIds: readonly string[];
}

export interface RuntimeWorkflowDiagnostic {
  sequence: number;
  runtimeInstanceId: string;
  level: RuntimeWorkflowLogLevel;
  code: string;
  message: string;
  workflowId?: string;
  workflowInstanceId?: string;
  activityId?: string;
  waitingStateId?: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface RuntimeWorkflowEvidenceEntry {
  sequence: number;
  runtimeInstanceId: string;
  workflowId?: string;
  workflowInstanceId?: string;
  activityId?: string;
  waitingStateId?: string;
  intentId?: string;
  planId?: string;
  type:
    | "WorkflowRegistered"
    | "WorkflowMaterialized"
    | "WorkflowStarted"
    | "ActivityEligible"
    | "ActivityStarted"
    | "ExecutionIntentCreated"
    | "RuntimePlanLinked"
    | "ActivityCompleted"
    | "ActivityFailed"
    | "WaitingStateEntered"
    | "WaitingStateObserved"
    | "WaitingStateResumed"
    | "TransitionApplied"
    | "CompensationStarted"
    | "CompensationIntentCreated"
    | "CompensationCompleted"
    | "CompensationFailed"
    | "WorkflowCompleted"
    | "WorkflowFailed"
    | "WorkflowArchived"
    | "SnapshotPersisted";
  details: Readonly<Record<string, unknown>>;
}

export interface RuntimeWorkflowMetrics {
  workflowCount: number;
  instanceCount: number;
  graphCount: number;
  waitingStateCount: number;
  executionIntentCount: number;
  runtimePlanReferenceCount: number;
  observationCount: number;
  diagnosticsCount: number;
  evidenceCount: number;
  snapshotCount: number;
}

export interface RuntimeWorkflowTelemetrySnapshot {
  counters: Readonly<Record<string, number>>;
  metrics: RuntimeWorkflowMetrics;
}

export interface RuntimeWorkflowSnapshot {
  runtimeInstanceId: string;
  runtimeId: string;
  workflowDefinitions: readonly RuntimeWorkflowRecord[];
  workflowInstances: readonly RuntimeWorkflowInstanceRecord[];
  activityGraphs: readonly RuntimeActivityGraphSnapshot[];
  waitingStates: readonly RuntimeWaitingStateRecord[];
  executionIntents: readonly RuntimeExecutionIntentRecord[];
  observations: readonly RuntimeWorkflowObservation[];
  diagnostics: readonly RuntimeWorkflowDiagnostic[];
  evidence: readonly RuntimeWorkflowEvidenceEntry[];
  telemetry: RuntimeWorkflowTelemetrySnapshot;
}

export interface RuntimeWorkflowSnapshotRecord {
  revision: number;
  snapshot: RuntimeWorkflowSnapshot;
}

export interface RuntimeWorkflowReplayProjection {
  workflowInstance: RuntimeWorkflowInstanceRecord;
  waitingStates: readonly RuntimeWaitingStateRecord[];
  executionIntents: readonly RuntimeExecutionIntentRecord[];
  runtimePlanReferences: readonly RuntimePlanReference[];
  observations: readonly RuntimeWorkflowObservation[];
  evidence: readonly RuntimeWorkflowEvidenceEntry[];
  verificationHash: string;
}

export interface RuntimeWorkflowMaterializationRequest {
  correlationId: string;
  causationId?: string;
  metadata?: Readonly<Record<string, RuntimeWorkflowPrimitive>>;
  startCause?: Readonly<Record<string, unknown>>;
}

export interface RuntimeWorkflowRunResult {
  createdIntents: readonly RuntimeExecutionIntentRecord[];
  linkedPlans: readonly RuntimePlanReference[];
  publishedMessages: readonly RuntimePublishResult[];
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function stableSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function stableUnknownRecord(record: Readonly<Record<string, unknown>> = {}): Readonly<Record<string, unknown>> {
  return deepFreeze(canonicalize(record) as Readonly<Record<string, unknown>>);
}

export function stablePrimitiveRecord(
  record: Readonly<Record<string, RuntimeWorkflowPrimitive>> = {},
): Readonly<Record<string, RuntimeWorkflowPrimitive>> {
  return stableUnknownRecord(record) as Readonly<Record<string, RuntimeWorkflowPrimitive>>;
}

export function stableStringArray(values: readonly string[] = []): readonly string[] {
  return Object.freeze([...new Set(values)].sort((a, b) => a.localeCompare(b)));
}

export function observationMessageType(observation: RuntimeWorkflowObservation): string | undefined {
  const payloadType = observation.payload?.messageType;
  return typeof payloadType === "string" ? payloadType : observation.messageType;
}
