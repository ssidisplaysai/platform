import { geaId, nowIso, stableChecksum, stableStringify } from "./agent-models";

export type OrchestrationLifecycleState = "DRAFT" | "ACTIVE" | "PAUSED" | "DEPRECATED" | "ARCHIVED";
export type OrchestrationExecutionState = "QUEUED" | "RUNNING" | "PAUSED" | "WAITING_APPROVAL" | "FAILED" | "CANCELLED" | "COMPLETED" | "RECOVERING";
export type WorkflowStepType = "SEQUENTIAL" | "PARALLEL" | "CONDITIONAL" | "FAN_OUT" | "FAN_IN" | "BARRIER";
export type CoordinationState = "PENDING" | "ASSIGNED" | "EXECUTING" | "APPROVAL_REQUIRED" | "COMPENSATING" | "RETRYING" | "COMPLETED" | "FAILED";
export type ApprovalState = "PENDING" | "APPROVED" | "REJECTED" | "ESCALATED" | "EXPIRED" | "CANCELLED";
export type ReplayDeterminism = "DETERMINISTIC" | "PARTIAL" | "NON_DETERMINISTIC";
export type HealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";

export type RetryPolicy = {
  maxRetries: number;
  backoffMs: number;
  strategy: "FIXED" | "LINEAR" | "EXPONENTIAL";
  retryOnStates: CoordinationState[];
};

export type WorkflowTransition = {
  transitionId: string;
  fromStepId: string;
  toStepId: string;
  condition?: string;
  transitionType: "ON_SUCCESS" | "ON_FAILURE" | "ON_APPROVAL" | "ON_TIMEOUT" | "ALWAYS";
};

export type WorkflowDependency = {
  dependencyId: string;
  stepId: string;
  dependsOnStepId: string;
  dependencyType: "HARD" | "SOFT" | "BARRIER";
};

export type AgentAssignment = {
  assignmentId: string;
  stepId: string;
  agentId: string;
  agentVersion: string;
  requiredCapabilities: string[];
  roleConstraint?: string;
};

export type AgentDelegation = {
  delegationId: string;
  executionId: string;
  stepId: string;
  fromAgentId: string;
  toAgentId: string;
  reason: string;
  delegatedAt: string;
};

export type ApprovalCheckpoint = {
  approvalCheckpointId: string;
  executionId: string;
  stepId: string;
  stage: string;
  state: ApprovalState;
  requiredApprovers: string[];
  approvedBy: string[];
  timeoutAt?: string;
  escalationPolicy?: {
    escalateAfterMs: number;
    escalationRole: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type CompensationAction = {
  compensationActionId: string;
  executionId: string;
  stepId: string;
  reversible: boolean;
  actionType: "NONE" | "ROLLBACK" | "RECONCILE" | "NOTIFY";
  status: "PENDING" | "COMPLETED" | "SKIPPED" | "FAILED";
  reason?: string;
  createdAt: string;
};

export type WorkflowStep = {
  stepId: string;
  stepKey: string;
  title: string;
  description?: string;
  stepType: WorkflowStepType;
  order: number;
  condition?: string;
  requiresApproval: boolean;
  highRisk: boolean;
  assignment: AgentAssignment;
  retryPolicy: RetryPolicy;
  compensation?: {
    reversible: boolean;
    actionType: CompensationAction["actionType"];
  };
  input: Record<string, unknown>;
};

export type WorkflowDefinition = {
  workflowId: string;
  orchestrationId: string;
  workspaceId: string;
  organizationId: string;
  projectId?: string;
  workflowKey: string;
  name: string;
  description: string;
  lifecycleState: OrchestrationLifecycleState;
  steps: WorkflowStep[];
  transitions: WorkflowTransition[];
  dependencies: WorkflowDependency[];
  scheduling: {
    mode: "IMMEDIATE" | "DELAYED" | "RECURRING" | "EVENT_DRIVEN" | "TIME_WINDOW" | "CALENDAR";
    cron?: string;
    delayMs?: number;
    eventKey?: string;
    window?: { start: string; end: string };
    calendarTrigger?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export type WorkflowVersion = {
  workflowVersionId: string;
  workflowId: string;
  versionTag: string;
  immutable: boolean;
  definitionChecksum: string;
  publishedBy: string;
  publishedAt: string;
};

export type OrchestrationVersion = {
  orchestrationVersionId: string;
  orchestrationId: string;
  versionTag: string;
  workflowVersionId: string;
  runtimeVersion: string;
  memoryContextVersion: string;
  toolRuntimeVersion: string;
  publishedAt: string;
};

export type Orchestration = {
  orchestrationId: string;
  workspaceId: string;
  organizationId: string;
  projectId?: string;
  name: string;
  description: string;
  lifecycleState: OrchestrationLifecycleState;
  activeWorkflowId: string;
  activeWorkflowVersionId: string;
  versions: OrchestrationVersion[];
  createdAt: string;
  updatedAt: string;
};

export type CoordinationEvent = {
  coordinationEventId: string;
  executionId: string;
  stepId?: string;
  eventType:
    | "EXECUTION_QUEUED"
    | "EXECUTION_STARTED"
    | "STEP_ASSIGNED"
    | "STEP_STARTED"
    | "STEP_COMPLETED"
    | "STEP_FAILED"
    | "APPROVAL_REQUIRED"
    | "APPROVAL_GRANTED"
    | "APPROVAL_REJECTED"
    | "RETRY_SCHEDULED"
    | "COMPENSATION_TRIGGERED"
    | "RECOVERY_STARTED"
    | "EXECUTION_COMPLETED"
    | "EXECUTION_FAILED"
    | "EXECUTION_CANCELLED"
    | "EXECUTION_PAUSED"
    | "EXECUTION_RESUMED";
  note: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type ExecutionTimeline = {
  sequence: number;
  at: string;
  state: OrchestrationExecutionState;
  note: string;
  metadata?: Record<string, unknown>;
};

export type ExecutionSnapshot = {
  snapshotId: string;
  executionId: string;
  sequence: number;
  state: OrchestrationExecutionState;
  coordinationStateByStep: Record<string, CoordinationState>;
  approvals: ApprovalCheckpoint[];
  retries: Record<string, number>;
  pendingSteps: string[];
  completedSteps: string[];
  failedSteps: string[];
  createdAt: string;
};

export type ReplayRecord = {
  replayRecordId: string;
  executionId: string;
  replayChecksum: string;
  determinism: ReplayDeterminism;
  nonDeterministicDependencies: string[];
  createdAt: string;
};

export type OrchestrationExecution = {
  executionId: string;
  orchestrationId: string;
  workflowId: string;
  workflowVersionId: string;
  workspaceId: string;
  organizationId: string;
  projectId?: string;
  initiatedBy: string;
  state: OrchestrationExecutionState;
  coordinationStateByStep: Record<string, CoordinationState>;
  contextPackageId?: string;
  toolExecutionIds: string[];
  delegations: AgentDelegation[];
  approvals: ApprovalCheckpoint[];
  compensationActions: CompensationAction[];
  retryCounts: Record<string, number>;
  timeline: ExecutionTimeline[];
  immutableLineage: string;
  startedAt: string;
  completedAt?: string;
};

export type OrchestrationMetrics = {
  workflowDurationMs: number;
  agentUtilization: Record<string, number>;
  queueDepth: number;
  failureRate: number;
  retryCount: number;
  approvalLatencyMs: number;
  compensationEvents: number;
  throughputPerHour: number;
};

export type OrchestrationHealth = {
  healthId: string;
  workspaceId: string;
  organizationId: string;
  status: HealthStatus;
  activeExecutions: number;
  pausedExecutions: number;
  approvalBacklog: number;
  failureRate: number;
  replayDriftRate: number;
  queueDepth: number;
  computedAt: string;
  metrics: OrchestrationMetrics;
};

export function createOrchestrationIds() {
  return {
    orchestrationId: geaId("geaorch"),
    orchestrationVersionId: geaId("geaorchver"),
    workflowId: geaId("geawf"),
    workflowVersionId: geaId("geawfver"),
    executionId: geaId("geaorchex"),
    transitionId: geaId("geawftrans"),
    dependencyId: geaId("geawfdep"),
    assignmentId: geaId("geaassign"),
    delegationId: geaId("geadeleg"),
    approvalCheckpointId: geaId("geaapprcp"),
    compensationActionId: geaId("geacomp"),
    coordinationEventId: geaId("geacoord"),
    snapshotId: geaId("geaorcsnap"),
    replayRecordId: geaId("geaorcreplay"),
    healthId: geaId("geaorchealth"),
  };
}

export function currentOrchestrationRuntimeVersion(): string {
  return "gea-orchestration-runtime/v1";
}

export function orchestrationChecksum(value: unknown): string {
  return stableChecksum(value);
}

export function canonicalizeWorkflowDefinition(definition: WorkflowDefinition): string {
  const steps = [...definition.steps].sort((a, b) => a.order - b.order || a.stepId.localeCompare(b.stepId));
  const transitions = [...definition.transitions].sort((a, b) => a.transitionId.localeCompare(b.transitionId));
  const dependencies = [...definition.dependencies].sort((a, b) => a.dependencyId.localeCompare(b.dependencyId));
  return stableStringify({
    ...definition,
    steps,
    transitions,
    dependencies,
  });
}

export function createImmutableExecutionLineage(input: {
  orchestrationId: string;
  workflowVersionId: string;
  contextPackageId?: string;
  initiatedBy: string;
}): string {
  return stableChecksum(input);
}

export function nowIsoSafe(): string {
  return nowIso();
}
