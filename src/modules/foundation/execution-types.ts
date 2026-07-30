import type { CommerceDocumentBase } from "./commerce-document";

export type ExecutionStatus =
  | "created"
  | "ready"
  | "waiting"
  | "running"
  | "paused"
  | "blocked"
  | "resumed"
  | "completed"
  | "cancelled"
  | "failed"
  | "recovered"
  | "archived";

export type ExecutionActivityRecord = {
  activityId: string;
  executionId: string;
  sequence: number;
  status: ExecutionStatus;
  timestamp: string;
  actor: string;
  referenceType: string;
  referenceId: string;
  summary: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
};

export type ExecutionLineage = {
  scheduleId: string | null;
  productionJobId: string | null;
  operationId: string | null;
  routingVersionId: string | null;
  workOrderId: string | null;
  originSalesOrderId: string | null;
  originQuoteId: string | null;
  organizationId: string;
  siteReference: string | null;
  correlationId: string | null;
  causationId: string | null;
  createdBy: string;
  createdTimestamp: string;
};

export type ExecutionRevisionRecord = {
  revisionNumber: number;
  parentRevision: number | null;
  author: string;
  timestamp: string;
  reason: string;
  changedFields: readonly string[];
  previousState: ExecutionStatus;
  resultingState: ExecutionStatus;
  lineageContinuity: boolean;
};

export type ExecutionAuditAction =
  | "execution_created"
  | "execution_viewed"
  | "execution_updated"
  | "execution_ready"
  | "execution_started"
  | "execution_paused"
  | "execution_resumed"
  | "execution_blocked"
  | "execution_completed"
  | "execution_cancelled"
  | "execution_failed"
  | "execution_recovered"
  | "execution_archived"
  | "execution_revision_created";

export type ExecutionAuditEvent = {
  eventId: string;
  executionId: string;
  organizationId: string;
  actor: string;
  action: ExecutionAuditAction;
  previousState: ExecutionStatus;
  resultingState: ExecutionStatus;
  correlationId: string;
  causationId: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  createdAt: string;
};

export type ExecutionEventType =
  | "ExecutionCreated"
  | "ExecutionUpdated"
  | "ExecutionReady"
  | "ExecutionWaiting"
  | "ExecutionStarted"
  | "ExecutionPaused"
  | "ExecutionResumed"
  | "ExecutionBlocked"
  | "ExecutionCompleted"
  | "ExecutionCancelled"
  | "ExecutionFailed"
  | "ExecutionRecovered"
  | "ExecutionArchived"
  | "ExecutionRevised";

export type ExecutionPublishedEvent = {
  eventId: string;
  contractVersion: string;
  eventType: ExecutionEventType;
  aggregateType: "execution";
  aggregateId: string;
  aggregateVersion: number;
  organizationId: string;
  siteId: string | null;
  actorId: string;
  correlationId: string;
  causationId: string;
  timestamp: string;
  actor: string;
  type: ExecutionEventType;
  payload: Readonly<Record<string, string | number | boolean | null>>;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
};

export type ExecutionTimelineEntry = {
  timestamp: string;
  category: "activity" | "audit" | "revision" | "event";
  title: string;
  detail: string;
};

export type ExecutionRecord = Omit<CommerceDocumentBase, "attachments" | "notes"> & {
  executionNumber: string;
  executionName: string;
  status: ExecutionStatus;
  progress: number;
  siteReference: string | null;
  actualStart: string | null;
  actualFinish: string | null;
  elapsedDurationMinutes: number | null;
  estimatedDurationMinutes: number | null;
  notes: string | null;
  attachments: readonly string[];
  operatorReferences: readonly string[];
  machineReferences: readonly string[];
  telemetryReferences: readonly string[];
  lineage: ExecutionLineage;
  activities: readonly ExecutionActivityRecord[];
  revisionHistory: readonly ExecutionRevisionRecord[];
};

export type ExecutionValidationIssue = {
  field: string;
  message: string;
};

export type ExecutionValidationResult = {
  valid: boolean;
  issues: readonly ExecutionValidationIssue[];
};

export type NewExecutionInput = {
  organizationId: string;
  customerReference: string;
  ownerReference: string;
  salesRepresentativeReference: string | null;
  siteReference: string | null;
  executionNumber: string | null;
  executionName: string;
  scheduleId: string | null;
  productionJobId: string | null;
  operationId: string | null;
  routingVersionId: string | null;
  workOrderId: string | null;
  originSalesOrderId: string | null;
  originQuoteId: string | null;
  progress: number;
  actualStart: string | null;
  actualFinish: string | null;
  elapsedDurationMinutes: number | null;
  estimatedDurationMinutes: number | null;
  notes: string | null;
  attachments: readonly string[];
  operatorReferences: readonly string[];
  machineReferences: readonly string[];
  telemetryReferences: readonly string[];
  lineage: ExecutionLineage;
  metadata: Readonly<Record<string, string>>;
};

export type UpdateExecutionDraftInput = Partial<{
  ownerReference: string;
  salesRepresentativeReference: string | null;
  siteReference: string | null;
  executionNumber: string;
  executionName: string;
  progress: number;
  actualStart: string | null;
  actualFinish: string | null;
  elapsedDurationMinutes: number | null;
  estimatedDurationMinutes: number | null;
  notes: string | null;
  attachments: readonly string[];
  operatorReferences: readonly string[];
  machineReferences: readonly string[];
  telemetryReferences: readonly string[];
}> & {
  metadata?: Readonly<Record<string, string>>;
};

export type ExecutionListFilters = {
  organizationId?: string;
  siteReference?: string;
  status?: ExecutionStatus;
  scheduleId?: string;
  productionJobId?: string;
  operationId?: string;
  routingVersionId?: string;
  workOrderId?: string;
  query?: string;
};

export type ExecutionSearchFilters = {
  organizationId?: string;
  siteReference?: string;
  query: string;
};

export type ExecutionSearchResult = {
  executionId: string;
  executionNumber: string;
  executionName: string;
  status: ExecutionStatus;
  scheduleId: string | null;
  productionJobId: string | null;
  operationId: string | null;
  routingVersionId: string | null;
  workOrderId: string | null;
  matchedFields: readonly string[];
};

export type CreateExecutionRevisionInput = {
  executionId: string;
  author: string;
  reason: string;
  changedFields: readonly string[];
};
