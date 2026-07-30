import type { CommerceDocumentBase } from "./commerce-document";

export type WorkOrderStatus =
  | "draft"
  | "planned"
  | "released"
  | "in_production"
  | "paused"
  | "completed"
  | "cancelled"
  | "closed";

export type WorkOrderLineRecord = {
  lineId: string;
  productId: string;
  sku: string;
  displayName: string;
  quantity: number;
  unitOfMeasure: string;
  sourceSalesOrderLineId: string | null;
  metadata: Readonly<Record<string, string>>;
};

export type WorkOrderCommercialLineage = {
  originSalesOrderId: string;
  originSalesOrderRevision: number;
  originQuoteId: string;
  originQuoteRevision: number;
  organizationId: string;
  pricingSnapshotReference: string;
  conversionEventId: string;
  correlationId: string;
  causationId: string;
  createdBy: string;
  createdTimestamp: string;
  manufacturingVersion: string;
};

export type WorkOrderRevisionRecord = {
  revisionNumber: number;
  parentRevision: number | null;
  author: string;
  timestamp: string;
  reason: string;
  changedFields: readonly string[];
  previousState: WorkOrderStatus;
  resultingState: WorkOrderStatus;
  lineageContinuity: boolean;
};

export type WorkOrderAuditAction =
  | "work_order_created"
  | "work_order_viewed"
  | "work_order_updated"
  | "work_order_planned"
  | "work_order_released"
  | "work_order_paused"
  | "work_order_resumed"
  | "work_order_completed"
  | "work_order_cancelled"
  | "work_order_closed"
  | "work_order_revision_created";

export type WorkOrderAuditEvent = {
  eventId: string;
  workOrderId: string;
  organizationId: string;
  actor: string;
  action: WorkOrderAuditAction;
  previousState: WorkOrderStatus;
  resultingState: WorkOrderStatus;
  correlationId: string;
  causationId: string;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
  createdAt: string;
};

export type WorkOrderEventType =
  | "WorkOrderCreated"
  | "WorkOrderReleased"
  | "WorkOrderPaused"
  | "WorkOrderCompleted"
  | "WorkOrderCancelled"
  | "WorkOrderClosed"
  | "WorkOrderRevised"
  | "WorkOrderResumed";

export type WorkOrderPublishedEvent = {
  eventId: string;
  contractVersion: string;
  aggregateType: "work_order";
  aggregateId: string;
  aggregateVersion: number;
  correlationId: string;
  causationId: string;
  timestamp: string;
  actor: string;
  organizationId: string;
  type: WorkOrderEventType;
  payload: Readonly<Record<string, string | number | boolean | null>>;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
};

export type WorkOrderTimelineEntry = {
  timestamp: string;
  category: "audit" | "revision" | "event";
  title: string;
  detail: string;
};

export type WorkOrderRecord = CommerceDocumentBase & {
  workOrderNumber: string;
  status: WorkOrderStatus;
  siteReference: string | null;
  referenceNumber: string | null;
  requestedStartDate: string | null;
  requestedCompletionDate: string | null;
  commercialLineage: WorkOrderCommercialLineage;
  lines: readonly WorkOrderLineRecord[];
  revisionHistory: readonly WorkOrderRevisionRecord[];
};

export type WorkOrderValidationIssue = {
  field: string;
  message: string;
};

export type WorkOrderValidationResult = {
  valid: boolean;
  issues: readonly WorkOrderValidationIssue[];
};

export type NewWorkOrderInput = {
  organizationId: string;
  customerReference: string;
  ownerReference: string;
  salesRepresentativeReference: string | null;
  siteReference: string | null;
  referenceNumber: string | null;
  requestedStartDate: string | null;
  requestedCompletionDate: string | null;
  commercialLineage: WorkOrderCommercialLineage;
  lines: readonly WorkOrderLineRecord[];
  metadata: Readonly<Record<string, string>>;
};

export type NewWorkOrderFromOrderInput = {
  orderId: string;
  referenceNumber: string | null;
  correlationId: string | null;
  causationId: string | null;
};

export type UpdateWorkOrderDraftInput = Partial<
  Pick<
    WorkOrderRecord,
    | "ownerReference"
    | "salesRepresentativeReference"
    | "siteReference"
    | "referenceNumber"
    | "requestedStartDate"
    | "requestedCompletionDate"
    | "metadata"
  >
>;

export type WorkOrderListFilters = {
  organizationId?: string;
  siteReference?: string;
  status?: WorkOrderStatus;
  salesOrderId?: string;
  quoteId?: string;
  customerReference?: string;
  query?: string;
};

export type WorkOrderSearchFilters = {
  organizationId?: string;
  siteReference?: string;
  query: string;
};

export type WorkOrderSearchResult = {
  workOrderId: string;
  workOrderNumber: string;
  originSalesOrderId: string;
  originQuoteId: string;
  customerReference: string;
  status: WorkOrderStatus;
  referenceNumber: string | null;
  matchedFields: readonly string[];
};
