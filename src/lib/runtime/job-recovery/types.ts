export type JobRecoveryClassification = "RUNNING" | "STUCK" | "ABANDONED" | "UNKNOWN";

export type JobRecoveryDecision = "NO_ACTION" | "SAFE_RECOVERY" | "MANUAL_REVIEW";

export type JobRecoveryRecommendedStatus = "KEEP_STARTING" | "FAILED" | "MANUAL_INVESTIGATION";

export type JobRecoveryExecutionProbe = {
  executionId: string | null;
  executionExists: boolean | null;
  executionTerminal: boolean | null;
  executionState: string | null;
  executionIdentityVerified?: boolean | null;
  reason?: string;
};

export type JobRecoverySignals = {
  leaseExpired: boolean | null;
  heartbeatStopped: boolean | null;
};

export type JobRecoveryClassificationResult = {
  classification: JobRecoveryClassification;
  reason: string;
  decision: JobRecoveryDecision;
  safeToRecover: boolean;
  recommendedJobStatus: JobRecoveryRecommendedStatus;
};

export type JobRecoveryAuditRow = {
  jobId: string;
  createdAt: string;
  updatedAt: string;
  ageHours: number;
  siteId: string;
  workflow: string;
  target: string;
  status: string;
  n8nExecutionId: string | null;
  leaseId: string | null;
  leaseOwner: string | null;
  leaseState: string | null;
  leaseExpiration: string | null;
  leaseExpired: boolean | null;
  heartbeat: string | null;
  heartbeatStopped: boolean | null;
  worker: string | null;
  retryCount: number;
  executionExists: boolean | null;
  executionTerminal: boolean | null;
  executionState: string | null;
  classification: JobRecoveryClassification;
  reason: string;
  decision: JobRecoveryDecision;
  safeToRecover: boolean;
  recommendedJobStatus: JobRecoveryRecommendedStatus;
};

export type JobRecoveryAuditSummary = {
  totalStartingJobs: number;
  running: number;
  stuck: number;
  abandoned: number;
  unknown: number;
  recoverable: number;
  notRecoverable: number;
  verdict: "QUEUE HEALTHY" | "QUEUE BLOCKED";
};

export type JobRecoveryHealthCards = {
  running: number;
  starting: number;
  waitingCallback: number;
  failed: number;
  recovered: number;
  orphaned: number;
  workers: number;
  healthyWorkers: number;
  expiredLeases: number;
  queueCapacity: number;
  concurrencyRemaining: number;
  averageRuntimeMs: number;
  oldestActiveJobHours: number;
};

export type JobRecoveryAuditResult = {
  generatedAt: string;
  workspaceId: string;
  rows: JobRecoveryAuditRow[];
  summary: JobRecoveryAuditSummary;
  cards: JobRecoveryHealthCards;
};

export type JobRecoveryExecuteInput = {
  actorId: string;
  mode: "RECOVER_SELECTED_SAFE" | "RECOVER_ALL_SAFE";
  selectedJobIds?: string[];
  reason?: string;
  approvalToken?: string;
  dryRun?: boolean;
  traceId?: string;
};

export type ManualAdjudicationDecision = "MARK_FAILED";

export type ManualAdjudicationInput = {
  actorId: string;
  jobId: string;
  decision: ManualAdjudicationDecision;
  reason: string;
  idempotencyKey: string;
  workspaceId?: string;
  moduleId?: string;
};

export type ManualAdjudicationResult = {
  jobId: string;
  previousStatus: string;
  newStatus: string;
  decision: ManualAdjudicationDecision;
  adjudicatedBy: string;
  adjudicatedAt: string;
  reason: string;
  reasonCode: string;
  auditId: string | null;
  eventId: string | null;
};

export type JobRecoveryExecuteResult = {
  dryRun: boolean;
  attempted: number;
  recovered: number;
  skippedUnsafe: number;
  skippedMissing: number;
  rows: Array<{
    jobId: string;
    classification: JobRecoveryClassification;
    safeToRecover: boolean;
    previousJobStatus: string;
    nextJobStatus: string | null;
    executionId: string | null;
    previousExecutionStatus: string | null;
    nextExecutionStatus: string | null;
    action: "RECOVERED" | "SKIPPED_UNSAFE" | "SKIPPED_MISSING";
    reason: string;
  }>;
};
