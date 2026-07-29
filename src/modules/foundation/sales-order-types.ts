import type { CommerceDocumentBase } from "./commerce-document";

export type SalesOrderStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "released"
  | "in_fulfillment"
  | "completed"
  | "cancelled"
  | "closed";

export type SalesOrderApprovalStatus = "none" | "pending" | "approved" | "rejected";

export type SalesOrderLineRecord = {
  lineId: string;
  productId: string;
  sku: string;
  productRevision: string;
  catalogRevision: string;
  snapshotTimestamp: string;
  displayName: string;
  description: string | null;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  discount: number;
  extendedPrice: number;
  currency: string;
  taxClassification: string | null;
  siteReference: string | null;
  metadata: Readonly<Record<string, string>>;
};

export type SalesOrderTotals = {
  subtotal: number;
  discountTotal: number;
  taxPlaceholder: number;
  freightPlaceholder: number;
  fees: number;
  grandTotal: number;
};

export type SalesOrderQuoteLineage = {
  quoteId: string;
  quoteRevision: number;
  acceptanceTimestamp: string;
  acceptedBy: string;
  pricingSnapshotReference: string;
  conversionEventId: string;
};

export type SalesOrderApprovalHistoryRecord = {
  status: SalesOrderApprovalStatus;
  actor: string;
  timestamp: string;
  notes: string | null;
};

export type SalesOrderRevisionRecord = {
  revisionNumber: number;
  parentRevision: number | null;
  author: string;
  timestamp: string;
  reason: string;
  changedFields: readonly string[];
  previousStatus: SalesOrderStatus;
  nextStatus: SalesOrderStatus;
  previousTotals: SalesOrderTotals;
  nextTotals: SalesOrderTotals;
};

export type SalesOrderEventType =
  | "OrderCreated"
  | "OrderApproved"
  | "OrderReleased"
  | "OrderCancelled"
  | "OrderClosed"
  | "OrderRevised";

export type SalesOrderPublishedEvent = {
  eventId: string;
  orderId: string;
  organizationId: string;
  type: SalesOrderEventType;
  actor: string;
  createdAt: string;
  payload: Readonly<Record<string, string | number | boolean | null>>;
};

export type SalesOrderAuditEventType =
  | "order_created"
  | "order_viewed"
  | "order_updated"
  | "order_submitted"
  | "order_approved"
  | "order_released"
  | "order_cancelled"
  | "order_closed"
  | "order_revision_created";

export type SalesOrderAuditEvent = {
  eventId: string;
  orderId: string;
  organizationId: string;
  type: SalesOrderAuditEventType;
  actor: string;
  createdAt: string;
  summary: string;
  correlationId: string | null;
};

export type SalesOrderTimelineEntry = {
  timestamp: string;
  category: "audit" | "revision" | "event";
  title: string;
  detail: string;
};

export type SalesOrderRecord = CommerceDocumentBase & {
  orderNumber: string;
  quoteLineage: SalesOrderQuoteLineage;
  currency: string;
  status: SalesOrderStatus;
  approvalStatus: SalesOrderApprovalStatus;
  referenceNumber: string | null;
  orderDate: string;
  requestedDeliveryDate: string | null;
  lines: readonly SalesOrderLineRecord[];
  totals: SalesOrderTotals;
  revisionHistory: readonly SalesOrderRevisionRecord[];
  approvalHistory: readonly SalesOrderApprovalHistoryRecord[];
};

export type SalesOrderValidationIssue = {
  field: string;
  message: string;
};

export type SalesOrderValidationResult = {
  valid: boolean;
  issues: readonly SalesOrderValidationIssue[];
};

export type CreateSalesOrderInput = {
  organizationId: string;
  customerReference: string;
  ownerReference: string;
  salesRepresentativeReference: string | null;
  siteReference: string | null;
  currency: string;
  quoteLineage: SalesOrderQuoteLineage;
  referenceNumber: string | null;
  orderDate: string;
  requestedDeliveryDate: string | null;
  lines: readonly SalesOrderLineRecord[];
  totals: SalesOrderTotals;
  metadata: Readonly<Record<string, string>>;
};

export type CreateSalesOrderFromQuoteInput = {
  quoteId: string;
  referenceNumber: string | null;
};

export type UpdateSalesOrderDraftInput = Partial<
  Pick<
    SalesOrderRecord,
    | "ownerReference"
    | "salesRepresentativeReference"
    | "siteReference"
    | "referenceNumber"
    | "requestedDeliveryDate"
    | "metadata"
  >
>;

export type SalesOrderListFilters = {
  organizationId?: string;
  siteReference?: string;
  customerReference?: string;
  status?: SalesOrderStatus;
  salespersonReference?: string;
  referenceNumber?: string;
  query?: string;
};

export type SalesOrderSearchFilters = {
  organizationId?: string;
  siteReference?: string;
  query: string;
};

export type SalesOrderSearchResult = {
  orderId: string;
  orderNumber: string;
  customerReference: string;
  quoteId: string;
  status: SalesOrderStatus;
  salespersonReference: string | null;
  referenceNumber: string | null;
  matchedFields: readonly string[];
};
