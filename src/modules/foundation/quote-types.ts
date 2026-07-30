import type { CommerceDocumentBase } from "./commerce-document";

export type QuoteCommercialStatus =
  | "draft"
  | "pricing"
  | "pending_approval"
  | "approved"
  | "presented"
  | "negotiating"
  | "accepted"
  | "rejected"
  | "expired"
  | "cancelled"
  | "converted";

export type QuoteApprovalStatus =
  | "none"
  | "pending"
  | "approved"
  | "rejected"
  | "withdrawn";

export type QuoteCommercialTerms = {
  paymentTermsReference: string | null;
  freightTermsReference: string | null;
  exchangeRate: number;
};

export type QuoteLineRecord = {
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

export type QuoteTotals = {
  subtotal: number;
  discountTotal: number;
  taxPlaceholder: number;
  freightPlaceholder: number;
  fees: number;
  grandTotal: number;
};

export type QuoteApprovalHistoryRecord = {
  status: QuoteApprovalStatus;
  actor: string;
  timestamp: string;
  notes: string | null;
};

export type QuoteRevisionRecord = {
  revisionNumber: number;
  parentRevision: number | null;
  author: string;
  timestamp: string;
  reason: string;
  changedFields: readonly string[];
  pricingDelta: number;
  lineDelta: number;
  approvalHistory: readonly QuoteApprovalHistoryRecord[];
  commercialStatus: QuoteCommercialStatus;
  approvalStatus: QuoteApprovalStatus;
  totals: QuoteTotals;
  lines: readonly QuoteLineRecord[];
};

export type QuoteAuditEventType =
  | "quote_created"
  | "line_added"
  | "line_removed"
  | "quantity_changed"
  | "price_changed"
  | "discount_changed"
  | "submitted"
  | "approved"
  | "rejected"
  | "withdrawn"
  | "presented"
  | "viewed"
  | "accepted"
  | "cancelled"
  | "expired"
  | "revision_created"
  | "conversion_requested";

export type QuoteAuditEvent = {
  eventId: string;
  quoteId: string;
  organizationId: string;
  type: QuoteAuditEventType;
  actor: string;
  createdAt: string;
  summary: string;
  correlationId: string | null;
};

export type QuoteConversionContract = {
  requested: boolean;
  requestedAt: string | null;
  requestedBy: string | null;
  targetDocumentType: "sales_order";
  status: "not_requested" | "requested";
};

export type QuoteRecord = CommerceDocumentBase & {
  quoteNumber: string;
  primaryContactReference: string | null;
  siteReference: string | null;
  currency: string;
  effectiveDate: string;
  expirationDate: string;
  commercialTerms: QuoteCommercialTerms;
  internalNotes: string | null;
  customerNotes: string | null;
  commercialStatus: QuoteCommercialStatus;
  approvalStatus: QuoteApprovalStatus;
  lines: readonly QuoteLineRecord[];
  totals: QuoteTotals;
  revisionHistory: readonly QuoteRevisionRecord[];
  approvalHistory: readonly QuoteApprovalHistoryRecord[];
  negotiationHistory: readonly string[];
  conversionContract: QuoteConversionContract;
};

export type QuoteValidationIssue = {
  field: string;
  message: string;
};

export type QuoteValidationResult = {
  valid: boolean;
  issues: readonly QuoteValidationIssue[];
};

export type NewQuoteInput = {
  organizationId: string;
  customerReference: string;
  primaryContactReference: string | null;
  ownerReference: string;
  salesRepresentativeReference: string | null;
  siteReference: string | null;
  currency: string;
  effectiveDate: string;
  expirationDate: string;
  commercialTerms: QuoteCommercialTerms;
  internalNotes: string | null;
  customerNotes: string | null;
  metadata: Readonly<Record<string, string>>;
};

export type UpdateQuoteDraftInput = Partial<
  Pick<
    QuoteRecord,
    | "primaryContactReference"
    | "ownerReference"
    | "salesRepresentativeReference"
    | "siteReference"
    | "currency"
    | "effectiveDate"
    | "expirationDate"
    | "commercialTerms"
    | "internalNotes"
    | "customerNotes"
    | "metadata"
    | "negotiationHistory"
  >
>;

export type NewQuoteLineInput = Omit<QuoteLineRecord, "lineId" | "snapshotTimestamp" | "extendedPrice">;

export type UpdateQuoteLineInput = Partial<Pick<QuoteLineRecord, "quantity" | "unitPrice" | "discount" | "description" | "taxClassification" | "metadata">>;

export type QuoteListFilters = {
  organizationId?: string;
  siteReference?: string;
  customerReference?: string;
  commercialStatus?: QuoteCommercialStatus;
  ownerReference?: string;
  query?: string;
};

export type QuoteSearchFilters = {
  organizationId?: string;
  siteReference?: string;
  query: string;
};

export type QuoteSearchResult = {
  quoteId: string;
  quoteNumber: string;
  customerReference: string;
  ownerReference: string;
  revision: number;
  commercialStatus: QuoteCommercialStatus;
  approvalStatus: QuoteApprovalStatus;
  matchedFields: readonly string[];
};
