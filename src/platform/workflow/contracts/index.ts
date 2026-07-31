export type WorkflowState =
  | "CREATED"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMED_OUT"
  | "COMPENSATING";

export type WorkflowEventType =
  | "WORKFLOW_CREATED"
  | "WORKFLOW_STARTED"
  | "STEP_STARTED"
  | "STEP_COMPLETED"
  | "STEP_FAILED"
  | "WORKFLOW_PAUSED"
  | "WORKFLOW_RESUMED"
  | "WORKFLOW_CANCELLED"
  | "WORKFLOW_TIMED_OUT"
  | "WORKFLOW_COMPLETED"
  | "WORKFLOW_FAILED"
  | "WORKFLOW_COMPENSATED"
  | "WORKFLOW_CHECKPOINTED";

export type WorkflowVariable = {
  name: string;
  value: unknown;
};

export type WorkflowContext = {
  tenant: string;
  workspace: string;
  initiatedBy?: string;
  variables: Record<string, unknown>;
};

export type WorkflowVersion = {
  major: number;
  minor: number;
  patch: number;
};

export type WorkflowResult = {
  status: "SUCCESS" | "FAILURE" | "PAUSE" | "WAIT";
  outputVariables?: Record<string, unknown>;
  error?: string;
  nextStepId?: string;
};

export type WorkflowActionInput = {
  workflow: Workflow;
  definition: WorkflowDefinition;
  instance: WorkflowInstance;
  context: WorkflowContext;
  step: WorkflowStep;
};

export type WorkflowAction = (input: WorkflowActionInput) => Promise<WorkflowResult> | WorkflowResult;

export type WorkflowTransition = {
  id: string;
  toStepId: string;
  condition?: (context: WorkflowContext, result: WorkflowResult) => boolean;
  priority?: number;
};

export type WorkflowTimeout = {
  timeoutMs: number;
};

export type WorkflowRetryPolicy = {
  maxAttempts: number;
};

export type WorkflowStep = {
  id: string;
  name: string;
  action: WorkflowAction;
  timeout?: WorkflowTimeout;
  retryPolicy?: WorkflowRetryPolicy;
  transitions?: WorkflowTransition[];
  compensationAction?: WorkflowAction;
};

export type WorkflowCheckpoint = {
  checkpointId: string;
  instanceId: string;
  stepId: string;
  state: WorkflowState;
  context: WorkflowContext;
  createdAt: string;
};

export type WorkflowCompensation = {
  instanceId: string;
  compensatedStepIds: string[];
  completedAt: string;
};

export type WorkflowAudit = {
  recordId: string;
  instanceId: string;
  workflowId: string;
  eventType: WorkflowEventType;
  message: string;
  details?: Record<string, unknown>;
  recordedAt: string;
};

export type WorkflowExecutionRecord = {
  recordId: string;
  instanceId: string;
  workflowId: string;
  stepId: string;
  attempt: number;
  result: WorkflowResult;
  executedAt: string;
};

export type WorkflowEvent = {
  eventId: string;
  instanceId: string;
  workflowId: string;
  stepId?: string;
  eventType: WorkflowEventType;
  timestamp: string;
  data?: Record<string, unknown>;
};

export type WorkflowMetrics = {
  registeredWorkflows: number;
  createdInstances: number;
  runningInstances: number;
  pausedInstances: number;
  completedInstances: number;
  failedInstances: number;
  cancelledInstances: number;
  timedOutInstances: number;
  retriedSteps: number;
  compensatedInstances: number;
  auditRecords: number;
};

export type WorkflowHealth = {
  status: "HEALTHY" | "DEGRADED";
  checks: Array<{ name: string; status: "PASS" | "WARN" | "FAIL"; detail: string }>;
  generatedAt: string;
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  version: WorkflowVersion;
  description?: string;
  initialStepId: string;
  steps: WorkflowStep[];
};

export type Workflow = {
  workflowId: string;
  definitionId: string;
  definitionVersion: WorkflowVersion;
  createdAt: string;
};

export type WorkflowInstance = {
  instanceId: string;
  workflowId: string;
  definitionId: string;
  state: WorkflowState;
  currentStepId: string | null;
  context: WorkflowContext;
  attemptsByStep: Record<string, number>;
  executedStepIds: string[];
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  failureReason?: string;
};
