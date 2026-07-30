import type { CommerceDocumentBase } from "./commerce-document";

export type RoutingStatus = "draft" | "defined" | "released" | "superseded" | "archived" | "closed";

export type RoutingOperationStep = {
  stepId: string;
  operationReference: string;
  sequenceNumber: number;
  predecessorOperationIds: readonly string[];
  successorOperationIds: readonly string[];
  parallelGroupReference: string | null;
  conditionalBranchReference: string | null;
  estimatedCycleTimeMinutes: number | null;
  estimatedSetupTimeMinutes: number | null;
  estimatedRunTimeMinutes: number | null;
  estimatedChangeoverTimeMinutes: number | null;
  referencedWorkCenter: string | null;
  referencedMachineType: string | null;
  referencedSkill: string | null;
  engineeringNotes: string | null;
  referenceDocuments: readonly string[];
};

export type RoutingParallelOperationGroup = {
  groupId: string;
  operationReferences: readonly string[];
  branchReference: string | null;
};

export type RoutingLineage = {
  productionJobId: string | null;
  productionJobRevision: number | null;
  workOrderId: string | null;
  workOrderRevision: number | null;
  originSalesOrderId: string | null;
  originSalesOrderRevision: number | null;
  originQuoteId: string | null;
  originQuoteRevision: number | null;
  organizationId: string;
  siteReference: string | null;
  correlationId: string | null;
  causationId: string | null;
  createdBy: string;
  createdTimestamp: string;
  manufacturingVersion: string;
};

export type RoutingRevisionRecord = {
  revisionNumber: number;
  parentRevision: number | null;
  author: string;
  timestamp: string;
  reason: string;
  changedFields: readonly string[];
  previousState: RoutingStatus;
  resultingState: RoutingStatus;
  versionContinuity: boolean;
};

export type RoutingVersionRecord = {
  routingVersionId: string;
  routingId: string;
  routingNumber: string;
  versionNumber: number;
  parentVersion: number | null;
  author: string;
  timestamp: string;
  reason: string;
  changedFields: readonly string[];
  previousState: RoutingStatus;
  resultingState: RoutingStatus;
  versionContinuity: boolean;
  effectiveDate: string | null;
  routingName: string;
  description: string | null;
  productReference: string | null;
  assemblyReference: string | null;
  operationSequence: readonly RoutingOperationStep[];
  parallelOperationGroups: readonly RoutingParallelOperationGroup[];
  conditionalBranchReferences: readonly string[];
  estimatedCycleTimeMinutes: number | null;
  estimatedSetupTimeMinutes: number | null;
  estimatedRunTimeMinutes: number | null;
  estimatedChangeoverTimeMinutes: number | null;
  referencedWorkCenters: readonly string[];
  referencedMachineTypes: readonly string[];
  referencedSkills: readonly string[];
  engineeringNotes: string | null;
  referenceDocuments: readonly string[];
  lineage: RoutingLineage;
};

export type RoutingAuditAction =
  | "routing_created"
  | "routing_viewed"
  | "routing_updated"
  | "routing_released"
  | "routing_archived"
  | "routing_closed"
  | "routing_revised"
  | "routing_version_created";

export type RoutingAuditEvent = {
  eventId: string;
  routingId: string;
  organizationId: string;
  actor: string;
  action: RoutingAuditAction;
  previousState: RoutingStatus;
  resultingState: RoutingStatus;
  correlationId: string;
  causationId: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  createdAt: string;
};

export type RoutingEventType =
  | "RoutingCreated"
  | "RoutingReleased"
  | "RoutingUpdated"
  | "RoutingVersionCreated"
  | "RoutingArchived"
  | "RoutingClosed"
  | "RoutingRevised";

export type RoutingPublishedEvent = {
  eventId: string;
  contractVersion: string;
  aggregateType: "routing";
  aggregateId: string;
  aggregateVersion: number;
  correlationId: string;
  causationId: string;
  timestamp: string;
  actor: string;
  organizationId: string;
  type: RoutingEventType;
  payload: Readonly<Record<string, string | number | boolean | null>>;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
};

export type RoutingTimelineEntry = {
  timestamp: string;
  category: "audit" | "revision" | "event" | "version";
  title: string;
  detail: string;
};

export type RoutingRecord = CommerceDocumentBase & {
  routingNumber: string;
  routingName: string;
  description: string | null;
  effectiveDate: string | null;
  status: RoutingStatus;
  productReference: string | null;
  assemblyReference: string | null;
  operationSequence: readonly RoutingOperationStep[];
  parallelOperationGroups: readonly RoutingParallelOperationGroup[];
  conditionalBranchReferences: readonly string[];
  estimatedCycleTimeMinutes: number | null;
  estimatedSetupTimeMinutes: number | null;
  estimatedRunTimeMinutes: number | null;
  estimatedChangeoverTimeMinutes: number | null;
  referencedWorkCenters: readonly string[];
  referencedMachineTypes: readonly string[];
  referencedSkills: readonly string[];
  engineeringNotes: string | null;
  referenceDocuments: readonly string[];
  lineage: RoutingLineage;
  revisionHistory: readonly RoutingRevisionRecord[];
};

export type RoutingValidationIssue = {
  field: string;
  message: string;
};

export type RoutingValidationResult = {
  valid: boolean;
  issues: readonly RoutingValidationIssue[];
};

export type NewRoutingInput = {
  organizationId: string;
  customerReference: string;
  ownerReference: string;
  salesRepresentativeReference: string | null;
  siteReference: string | null;
  routingNumber: string | null;
  routingName: string;
  description: string | null;
  effectiveDate: string | null;
  productReference: string | null;
  assemblyReference: string | null;
  operationSequence: readonly RoutingOperationStep[];
  parallelOperationGroups: readonly RoutingParallelOperationGroup[];
  conditionalBranchReferences: readonly string[];
  estimatedCycleTimeMinutes: number | null;
  estimatedSetupTimeMinutes: number | null;
  estimatedRunTimeMinutes: number | null;
  estimatedChangeoverTimeMinutes: number | null;
  referencedWorkCenters: readonly string[];
  referencedMachineTypes: readonly string[];
  referencedSkills: readonly string[];
  engineeringNotes: string | null;
  referenceDocuments: readonly string[];
  lineage: RoutingLineage;
  metadata: Readonly<Record<string, string>>;
};

export type UpdateRoutingDraftInput = Partial<
  Pick<
    RoutingRecord,
    | "ownerReference"
    | "salesRepresentativeReference"
    | "siteReference"
    | "routingNumber"
    | "routingName"
    | "description"
    | "effectiveDate"
    | "productReference"
    | "assemblyReference"
    | "operationSequence"
    | "parallelOperationGroups"
    | "conditionalBranchReferences"
    | "estimatedCycleTimeMinutes"
    | "estimatedSetupTimeMinutes"
    | "estimatedRunTimeMinutes"
    | "estimatedChangeoverTimeMinutes"
    | "referencedWorkCenters"
    | "referencedMachineTypes"
    | "referencedSkills"
    | "engineeringNotes"
    | "referenceDocuments"
    | "metadata"
  >
>;

export type RoutingListFilters = {
  organizationId?: string;
  siteReference?: string;
  status?: RoutingStatus;
  productionJobId?: string;
  workOrderId?: string;
  salesOrderId?: string;
  quoteId?: string;
  productReference?: string;
  assemblyReference?: string;
  operationReference?: string;
  query?: string;
};

export type RoutingSearchFilters = {
  organizationId?: string;
  siteReference?: string;
  query: string;
};

export type RoutingSearchResult = {
  routingId: string;
  routingNumber: string;
  version: number;
  productionJobId: string | null;
  workOrderId: string | null;
  originSalesOrderId: string | null;
  originQuoteId: string | null;
  productReference: string | null;
  assemblyReference: string | null;
  status: RoutingStatus;
  routingName: string;
  matchedFields: readonly string[];
};

export type CreateRoutingVersionInput = {
  routingId: string;
  actor: string;
  reason: string;
  changedFields: readonly string[];
};