import type {
  WorkflowAudit,
  WorkflowCheckpoint,
  WorkflowDefinition,
  WorkflowExecutionRecord,
  WorkflowInstance,
  WorkflowMetrics,
  WorkflowState,
} from "../contracts";

export type WorkflowRetryRecord = {
  instanceId: string;
  stepId: string;
  attempt: number;
  reason: string;
  recordedAt: string;
};

export type WorkflowTimeoutRecord = {
  instanceId: string;
  stepId: string;
  timeoutMs: number;
  recordedAt: string;
  status: "PENDING" | "RESOLVED";
};

export type WorkflowCompensationRecord = {
  instanceId: string;
  stepId: string;
  status: "SUCCESS" | "FAILED";
  reason?: string;
  recordedAt: string;
};

export type WorkflowCommandRecord = {
  commandKey: string;
  instanceId: string;
  commandType: "execute" | "pause" | "resume" | "cancel";
  idempotencyKey: string;
  resultingState: WorkflowState;
  recordedAt: string;
};

export type WorkflowRecoverySnapshot = {
  definitions: WorkflowDefinition[];
  instances: WorkflowInstance[];
  checkpoints: WorkflowCheckpoint[];
  executionHistory: WorkflowExecutionRecord[];
  retries: WorkflowRetryRecord[];
  timeouts: WorkflowTimeoutRecord[];
  compensations: WorkflowCompensationRecord[];
  audits: WorkflowAudit[];
  metrics: WorkflowMetrics | null;
  commands: WorkflowCommandRecord[];
};
