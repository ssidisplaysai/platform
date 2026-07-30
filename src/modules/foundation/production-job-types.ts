import type { CommerceDocumentBase } from "./commerce-document";

export type ProductionJobStatus =
  | "draft"
  | "queued"
  | "ready"
  | "released"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "closed";

export type ProductionJobLineRecord = {
  lineId: string;
  workOrderLineId: string;
  productId: string;
  sku: string;
  displayName: string;
  quantity: number;
  unitOfMeasure: string;
  metadata: Readonly<Record<string, string>>;
};

export type ProductionJobLineage = {
  workOrderId: string;
  workOrderRevision: number;
  originSalesOrderId: string;
  originSalesOrderRevision: number;
  originQuoteId: string;
  originQuoteRevision: number;
  organizationId: string;
  correlationId: string;
  causationId: string;
  manufacturingVersion: string;
  createdBy: string;
  createdTimestamp: string;
};

export type ProductionJobRevisionRecord = {
  revisionNumber: number;
  parentRevision: number | null;
  author: string;
  timestamp: string;
  reason: string;
  changedFields: readonly string[];
  previousState: ProductionJobStatus;
  resultingState: ProductionJobStatus;
  lineageContinuity: boolean;
};

export type ProductionJobAuditAction =
  | "production_job_created"
  | "production_job_viewed"
  | "production_job_updated"
  | "production_job_queued"
  | "production_job_readied"
  | "production_job_released"
  | "production_job_started"
  | "production_job_paused"
  | "production_job_resumed"
  | "production_job_completed"
  | "production_job_cancelled"
  | "production_job_closed"
  | "production_job_revision_created";

export type ProductionJobAuditEvent = {
  eventId: string;
  productionJobId: string;
  organizationId: string;
  actor: string;
  action: ProductionJobAuditAction;
  previousState: ProductionJobStatus;
  resultingState: ProductionJobStatus;
  correlationId: string;
  causationId: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  createdAt: string;
};

export type ProductionJobEventType =
  | "ProductionJobCreated"
  | "ProductionJobReleased"
  | "ProductionJobStarted"
  | "ProductionJobPaused"
  | "ProductionJobResumed"
  | "ProductionJobCompleted"
  | "ProductionJobCancelled"
  | "ProductionJobClosed"
  | "ProductionJobRevised";

export type ProductionJobPublishedEvent = {
  eventId: string;
  contractVersion: string;
  aggregateType: "production_job";
  aggregateId: string;
  aggregateVersion: number;
  correlationId: string;
  causationId: string;
  timestamp: string;
  actor: string;
  organizationId: string;
  type: ProductionJobEventType;
  payload: Readonly<Record<string, string | number | boolean | null>>;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
};

export type ProductionJobTimelineEntry = {
  timestamp: string;
  category: "audit" | "revision" | "event";
  title: string;
  detail: string;
};

export type ProductionJobRecord = CommerceDocumentBase & {
  productionJobNumber: string;
  status: ProductionJobStatus;
  referenceNumber: string | null;
  executionContext: string | null;
  requestedStartDate: string | null;
  requestedCompletionDate: string | null;
  lineage: ProductionJobLineage;
  lines: readonly ProductionJobLineRecord[];
  revisionHistory: readonly ProductionJobRevisionRecord[];
};

export type ProductionJobValidationIssue = {
  field: string;
  message: string;
};

export type ProductionJobValidationResult = {
  valid: boolean;
  issues: readonly ProductionJobValidationIssue[];
};

export type NewProductionJobInput = {
  organizationId: string;
  customerReference: string;
  ownerReference: string;
  salesRepresentativeReference: string | null;
  siteReference: string | null;
  referenceNumber: string | null;
  executionContext: string | null;
  requestedStartDate: string | null;
  requestedCompletionDate: string | null;
  lineage: ProductionJobLineage;
  lines: readonly ProductionJobLineRecord[];
  metadata: Readonly<Record<string, string>>;
};

export type NewProductionJobFromWorkOrderInput = {
  workOrderId: string;
  referenceNumber: string | null;
  executionContext: string | null;
  correlationId: string | null;
  causationId: string | null;
};

export type UpdateProductionJobDraftInput = Partial<
  Pick<
    ProductionJobRecord,
    | "ownerReference"
    | "salesRepresentativeReference"
    | "siteReference"
    | "referenceNumber"
    | "executionContext"
    | "requestedStartDate"
    | "requestedCompletionDate"
    | "metadata"
  >
>;

export type ProductionJobListFilters = {
  organizationId?: string;
  siteReference?: string;
  status?: ProductionJobStatus;
  workOrderId?: string;
  salesOrderId?: string;
  quoteId?: string;
  customerReference?: string;
  query?: string;
};

export type ProductionJobSearchFilters = {
  organizationId?: string;
  siteReference?: string;
  query: string;
};

export type ProductionJobSearchResult = {
  productionJobId: string;
  productionJobNumber: string;
  workOrderId: string;
  originSalesOrderId: string;
  originQuoteId: string;
  customerReference: string;
  status: ProductionJobStatus;
  referenceNumber: string | null;
  matchedFields: readonly string[];
};
