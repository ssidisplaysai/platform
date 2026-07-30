import type { CommerceDocumentBase } from "./commerce-document";

export type OperationStatus =
  | "draft"
  | "defined"
  | "ready"
  | "released"
  | "waiting"
  | "completed"
  | "cancelled"
  | "closed";

export type OperationLineage = {
  productionJobId: string;
  productionJobRevision: number;
  workOrderId: string;
  workOrderRevision: number;
  originSalesOrderId: string;
  originSalesOrderRevision: number;
  originQuoteId: string;
  originQuoteRevision: number;
  organizationId: string;
  siteReference: string | null;
  correlationId: string;
  causationId: string;
  manufacturingVersion: string;
  createdBy: string;
  createdTimestamp: string;
};

export type OperationRevisionRecord = {
  revisionNumber: number;
  parentRevision: number | null;
  author: string;
  timestamp: string;
  reason: string;
  changedFields: readonly string[];
  previousState: OperationStatus;
  resultingState: OperationStatus;
  lineageContinuity: boolean;
};

export type OperationAuditAction =
  | "operation_created"
  | "operation_viewed"
  | "operation_updated"
  | "operation_defined"
  | "operation_ready"
  | "operation_released"
  | "operation_waiting"
  | "operation_completed"
  | "operation_cancelled"
  | "operation_closed"
  | "operation_revision_created";

export type OperationAuditEvent = {
  eventId: string;
  operationId: string;
  organizationId: string;
  actor: string;
  action: OperationAuditAction;
  previousState: OperationStatus;
  resultingState: OperationStatus;
  correlationId: string;
  causationId: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  createdAt: string;
};

export type OperationEventType =
  | "OperationCreated"
  | "OperationDefined"
  | "OperationReady"
  | "OperationReleased"
  | "OperationWaiting"
  | "OperationCompleted"
  | "OperationCancelled"
  | "OperationClosed"
  | "OperationRevised";

export type OperationPublishedEvent = {
  eventId: string;
  contractVersion: string;
  aggregateType: "operation";
  aggregateId: string;
  aggregateVersion: number;
  correlationId: string;
  causationId: string;
  timestamp: string;
  actor: string;
  organizationId: string;
  type: OperationEventType;
  payload: Readonly<Record<string, string | number | boolean | null>>;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
};

export type OperationTimelineEntry = {
  timestamp: string;
  category: "audit" | "revision" | "event";
  title: string;
  detail: string;
};

export type OperationRecord = CommerceDocumentBase & {
  operationNumber: string;
  referenceNumber: string | null;
  siteReference: string | null;
  operationType: string;
  sequenceNumber: number;
  operationName: string;
  description: string | null;
  requiredCapability: string | null;
  estimatedDurationMinutes: number | null;
  requiredWorkCenterReference: string | null;
  requiredMachineTypeReference: string | null;
  requiredSkill: string | null;
  predecessorOperationIds: readonly string[];
  successorOperationIds: readonly string[];
  referenceDocuments: readonly string[];
  engineeringNotes: string | null;
  status: OperationStatus;
  lineage: OperationLineage;
  revisionHistory: readonly OperationRevisionRecord[];
};

export type OperationValidationIssue = {
  field: string;
  message: string;
};

export type OperationValidationResult = {
  valid: boolean;
  issues: readonly OperationValidationIssue[];
};

export type NewOperationInput = {
  organizationId: string;
  customerReference: string;
  ownerReference: string;
  salesRepresentativeReference: string | null;
  siteReference: string | null;
  referenceNumber: string | null;
  operationType: string;
  sequenceNumber: number;
  operationName: string;
  description: string | null;
  requiredCapability: string | null;
  estimatedDurationMinutes: number | null;
  requiredWorkCenterReference: string | null;
  requiredMachineTypeReference: string | null;
  requiredSkill: string | null;
  predecessorOperationIds: readonly string[];
  successorOperationIds: readonly string[];
  referenceDocuments: readonly string[];
  engineeringNotes: string | null;
  lineage: OperationLineage;
  metadata: Readonly<Record<string, string>>;
};

export type NewOperationFromProductionJobInput = {
  productionJobId: string;
  referenceNumber: string | null;
  operationType: string;
  sequenceNumber: number;
  operationName: string;
  description: string | null;
  requiredCapability: string | null;
  estimatedDurationMinutes: number | null;
  requiredWorkCenterReference: string | null;
  requiredMachineTypeReference: string | null;
  requiredSkill: string | null;
  predecessorOperationIds: readonly string[];
  successorOperationIds: readonly string[];
  referenceDocuments: readonly string[];
  engineeringNotes: string | null;
  correlationId: string | null;
  causationId: string | null;
};

export type UpdateOperationDraftInput = Partial<
  Pick<
    OperationRecord,
    | "ownerReference"
    | "salesRepresentativeReference"
    | "siteReference"
    | "referenceNumber"
    | "operationType"
    | "operationName"
    | "description"
    | "requiredCapability"
    | "estimatedDurationMinutes"
    | "requiredWorkCenterReference"
    | "requiredMachineTypeReference"
    | "requiredSkill"
    | "predecessorOperationIds"
    | "successorOperationIds"
    | "referenceDocuments"
    | "engineeringNotes"
    | "metadata"
  >
>;

export type OperationListFilters = {
  organizationId?: string;
  siteReference?: string;
  status?: OperationStatus;
  productionJobId?: string;
  workOrderId?: string;
  salesOrderId?: string;
  quoteId?: string;
  operationType?: string;
  query?: string;
};

export type OperationSearchFilters = {
  organizationId?: string;
  siteReference?: string;
  query: string;
};

export type OperationSearchResult = {
  operationId: string;
  operationNumber: string;
  productionJobId: string;
  workOrderId: string;
  originSalesOrderId: string;
  originQuoteId: string;
  operationType: string;
  status: OperationStatus;
  referenceNumber: string | null;
  operationName: string;
  matchedFields: readonly string[];
};
