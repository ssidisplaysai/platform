import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
  FoundationPersistenceConflictError,
} from "./foundation-persistence";
import { FOUNDATION_QUOTES } from "./quote-fixtures";
import { filterQuotes, searchQuotes } from "./quote-selectors";
import {
  validateNewQuoteInput,
  validateNewQuoteLineInput,
  validateUpdateQuoteDraftInput,
  validateUpdateQuoteLineInput,
} from "./quote-validation";
import type {
  NewQuoteInput,
  NewQuoteLineInput,
  QuoteApprovalHistoryRecord,
  QuoteAuditEvent,
  QuoteCommercialStatus,
  QuoteListFilters,
  QuoteRecord,
  QuoteRevisionRecord,
  QuoteSearchFilters,
  QuoteSearchResult,
  QuoteTotals,
  QuoteValidationResult,
  UpdateQuoteDraftInput,
  UpdateQuoteLineInput,
} from "./quote-types";

const PERSISTENCE_NAMESPACE = "quote-repository";

type QuoteRepositoryState = {
  quotes: QuoteRecord[];
  sequenceByOrganization: Record<string, number>;
  auditEvents: QuoteAuditEvent[];
};

const quoteStore = new Map<string, QuoteRecord>();
const auditStore = new Map<string, QuoteAuditEvent>();
let sequenceByOrganization: Record<string, number> = {};

let stateRevision = 0;

function nowIso(): string {
  return new Date().toISOString();
}

function createSeedState(): QuoteRepositoryState {
  return {
    quotes: FOUNDATION_QUOTES.map((quote) => deepClone(quote)),
    sequenceByOrganization: {},
    auditEvents: [],
  };
}

function applyState(state: QuoteRepositoryState): void {
  quoteStore.clear();
  state.quotes.forEach((quote) => {
    quoteStore.set(quote.documentId, deepClone(quote));
  });

  auditStore.clear();
  state.auditEvents.forEach((event) => {
    auditStore.set(event.eventId, deepClone(event));
  });

  sequenceByOrganization = { ...state.sequenceByOrganization };
}

function snapshotState(): QuoteRepositoryState {
  return {
    quotes: Array.from(quoteStore.values()).map((quote) => deepClone(quote)),
    sequenceByOrganization: { ...sequenceByOrganization },
    auditEvents: Array.from(auditStore.values()).map((event) => deepClone(event)),
  };
}

function loadStateFromPersistence(): void {
  const loaded = loadPersistedState<QuoteRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistCurrentState(): void {
  const saved = savePersistedState<QuoteRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });

  stateRevision = saved.revision;
}

function createQuoteId(organizationId: string, sequence: number): string {
  return `quote-${organizationId}-${sequence.toString().padStart(6, "0")}`;
}

function createQuoteNumber(organizationId: string, sequence: number): string {
  return `Q-${new Date().getUTCFullYear()}-${organizationId.slice(0, 4).toUpperCase()}-${sequence.toString().padStart(6, "0")}`;
}

function nextSequenceForOrganization(organizationId: string): number {
  const current = sequenceByOrganization[organizationId] ?? 0;
  const next = current + 1;
  sequenceByOrganization = {
    ...sequenceByOrganization,
    [organizationId]: next,
  };
  return next;
}

function createLineId(quoteId: string, lineCount: number): string {
  return `line-${quoteId}-${(lineCount + 1).toString().padStart(4, "0")}`;
}

function createAuditId(quoteId: string): string {
  return `quote-audit-${quoteId}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function computeLineExtendedPrice(input: {
  quantity: number;
  unitPrice: number;
  discount: number;
}): number {
  const raw = input.quantity * input.unitPrice - input.discount;
  return Math.round(raw * 100) / 100;
}

function calculateTotals(lines: readonly QuoteRecord["lines"]): QuoteTotals {
  const subtotal = Math.round(
    lines.reduce((acc, line) => acc + line.quantity * line.unitPrice, 0) * 100,
  ) / 100;
  const discountTotal = Math.round(lines.reduce((acc, line) => acc + line.discount, 0) * 100) / 100;
  const taxPlaceholder = 0;
  const freightPlaceholder = 0;
  const fees = 0;
  const grandTotal = Math.round((subtotal - discountTotal + taxPlaceholder + freightPlaceholder + fees) * 100) / 100;

  return {
    subtotal,
    discountTotal,
    taxPlaceholder,
    freightPlaceholder,
    fees,
    grandTotal,
  };
}

function isDraftLikeStatus(status: QuoteCommercialStatus): boolean {
  return status === "draft" || status === "pricing" || status === "negotiating" || status === "rejected";
}

function appendAuditEvent(input: {
  quote: QuoteRecord;
  type: QuoteAuditEvent["type"];
  actor: string;
  summary: string;
  correlationId?: string | null;
}): void {
  const event: QuoteAuditEvent = {
    eventId: createAuditId(input.quote.documentId),
    quoteId: input.quote.documentId,
    organizationId: input.quote.organizationId,
    type: input.type,
    actor: input.actor,
    createdAt: nowIso(),
    summary: input.summary,
    correlationId: input.correlationId ?? null,
  };

  auditStore.set(event.eventId, event);
}

function buildInitialRevisionRecord(input: {
  quote: QuoteRecord;
  author: string;
  reason: string;
}): QuoteRevisionRecord {
  return {
    revisionNumber: input.quote.revision,
    parentRevision: null,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: ["initial_creation"],
    pricingDelta: input.quote.totals.grandTotal,
    lineDelta: input.quote.lines.length,
    approvalHistory: [...input.quote.approvalHistory],
    commercialStatus: input.quote.commercialStatus,
    approvalStatus: input.quote.approvalStatus,
    totals: deepClone(input.quote.totals),
    lines: input.quote.lines.map((line) => deepClone(line)),
  };
}

function buildRevisionRecord(input: {
  quote: QuoteRecord;
  author: string;
  reason: string;
  changedFields: readonly string[];
  pricingDelta: number;
  lineDelta: number;
}): QuoteRevisionRecord {
  return {
    revisionNumber: input.quote.revision + 1,
    parentRevision: input.quote.revision,
    author: input.author,
    timestamp: nowIso(),
    reason: input.reason,
    changedFields: [...input.changedFields],
    pricingDelta: Math.round(input.pricingDelta * 100) / 100,
    lineDelta: input.lineDelta,
    approvalHistory: [...input.quote.approvalHistory],
    commercialStatus: input.quote.commercialStatus,
    approvalStatus: input.quote.approvalStatus,
    totals: deepClone(input.quote.totals),
    lines: input.quote.lines.map((line) => deepClone(line)),
  };
}

function mutateWithRollback<T>(mutator: () => T): T {
  const snapshot = snapshotState();

  try {
    const result = mutator();
    persistCurrentState();
    return result;
  } catch (error) {
    applyState(snapshot);
    throw error;
  }
}

function createApprovalEntry(input: {
  status: QuoteApprovalHistoryRecord["status"];
  actor: string;
  notes: string | null;
}): QuoteApprovalHistoryRecord {
  return {
    status: input.status,
    actor: input.actor,
    timestamp: nowIso(),
    notes: input.notes,
  };
}

function getTransitionViolationMessage(input: {
  status: QuoteCommercialStatus;
  action: string;
}): string | null {
  const status = input.status;

  if (input.action === "submit") {
    return status === "draft" || status === "pricing" || status === "negotiating" || status === "rejected"
      ? null
      : "Only draft, pricing, negotiating, or rejected quotes can be submitted.";
  }

  if (input.action === "approve") {
    return status === "pending_approval" ? null : "Only pending approval quotes can be approved.";
  }

  if (input.action === "reject") {
    return status === "pending_approval" ? null : "Only pending approval quotes can be rejected.";
  }

  if (input.action === "withdraw") {
    return status === "pending_approval" ? null : "Only pending approval quotes can be withdrawn.";
  }

  if (input.action === "present") {
    return status === "approved" ? null : "Only approved quotes can be presented.";
  }

  if (input.action === "accept") {
    return status === "presented" || status === "negotiating"
      ? null
      : "Only presented or negotiating quotes can be accepted.";
  }

  if (input.action === "cancel") {
    return status === "converted" || status === "accepted"
      ? "Accepted or converted quotes cannot be cancelled."
      : null;
  }

  if (input.action === "expire") {
    return status === "presented" || status === "negotiating" || status === "approved"
      ? null
      : "Only presented, negotiating, or approved quotes can expire.";
  }

  if (input.action === "convert") {
    return status === "accepted" ? null : "Only accepted quotes can request conversion.";
  }

  return null;
}

loadStateFromPersistence();

export function listQuotes(filters: QuoteListFilters = {}): readonly QuoteRecord[] {
  return filterQuotes(Array.from(quoteStore.values()), filters);
}

export function getQuoteById(quoteId: string): QuoteRecord | null {
  return quoteStore.get(quoteId) ?? null;
}

export function listQuoteAuditEvents(quoteId: string): readonly QuoteAuditEvent[] {
  return Array.from(auditStore.values())
    .filter((event) => event.quoteId === quoteId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function listQuoteRevisions(quoteId: string): readonly QuoteRevisionRecord[] {
  const quote = quoteStore.get(quoteId);
  return quote ? quote.revisionHistory : [];
}

export function searchQuoteRegistry(filters: QuoteSearchFilters): readonly QuoteSearchResult[] {
  return searchQuotes(Array.from(quoteStore.values()), filters);
}

export function createQuote(input: NewQuoteInput & { actor: string }): {
  validation: QuoteValidationResult;
  quote: QuoteRecord | null;
} {
  const validation = validateNewQuoteInput(input);
  if (!validation.valid) {
    return { validation, quote: null };
  }

  try {
    const quote = mutateWithRollback(() => {
      const sequence = nextSequenceForOrganization(input.organizationId);
      const quoteId = createQuoteId(input.organizationId, sequence);
      const quoteNumber = createQuoteNumber(input.organizationId, sequence);
      const timestamp = nowIso();

      const created: QuoteRecord = {
        documentId: quoteId,
        documentNumber: quoteNumber,
        quoteNumber,
        organizationId: input.organizationId,
        owningApplicationId: "gcp",
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
        revision: 1,
        lifecycleState: "draft",
        customerReference: input.customerReference,
        customerContactReferences: input.primaryContactReference ? [input.primaryContactReference] : [],
        ownerReference: input.ownerReference,
        salesRepresentativeReference: input.salesRepresentativeReference,
        billingAddress: null,
        shippingAddress: null,
        installationAddress: null,
        serviceAddress: null,
        attachments: [],
        notes: [],
        metadata: input.metadata,
        auditEnvelope: {
          createdBy: input.actor,
          updatedBy: input.actor,
          correlationId: null,
        },
        primaryContactReference: input.primaryContactReference,
        siteReference: input.siteReference,
        currency: input.currency,
        effectiveDate: input.effectiveDate,
        expirationDate: input.expirationDate,
        commercialTerms: {
          ...input.commercialTerms,
        },
        internalNotes: input.internalNotes,
        customerNotes: input.customerNotes,
        commercialStatus: "draft",
        approvalStatus: "none",
        lines: [],
        totals: {
          subtotal: 0,
          discountTotal: 0,
          taxPlaceholder: 0,
          freightPlaceholder: 0,
          fees: 0,
          grandTotal: 0,
        },
        revisionHistory: [],
        approvalHistory: [],
        negotiationHistory: [],
        conversionContract: {
          requested: false,
          requestedAt: null,
          requestedBy: null,
          targetDocumentType: "sales_order",
          status: "not_requested",
        },
      };

      created.revisionHistory = [
        buildInitialRevisionRecord({
          quote: created,
          author: input.actor,
          reason: "Quote created",
        }),
      ];

      quoteStore.set(created.documentId, created);
      appendAuditEvent({
        quote: created,
        type: "quote_created",
        actor: input.actor,
        summary: `Quote ${created.quoteNumber} created.`,
      });

      return created;
    });

    return {
      validation,
      quote,
    };
  } catch (error) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "quote", message: (error as Error).message }],
      },
      quote: null,
    };
  }
}

export function updateQuoteDraft(input: {
  quoteId: string;
  patch: UpdateQuoteDraftInput;
  actor: string;
  expectedVersion?: number;
}): {
  validation: QuoteValidationResult;
  quote: QuoteRecord | null;
} {
  const existing = quoteStore.get(input.quoteId);
  if (!existing) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "quoteId", message: "Quote not found." }],
      },
      quote: null,
    };
  }

  if (!isDraftLikeStatus(existing.commercialStatus) && existing.commercialStatus !== "approved") {
    return {
      validation: {
        valid: false,
        issues: [{ field: "commercialStatus", message: "Quote is not editable in current status." }],
      },
      quote: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      quote: null,
    };
  }

  const validation = validateUpdateQuoteDraftInput(existing, input.patch);
  if (!validation.valid) {
    return {
      validation,
      quote: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      const next: QuoteRecord = {
        ...existing,
        ...input.patch,
        commercialTerms: {
          ...existing.commercialTerms,
          ...(input.patch.commercialTerms ?? {}),
        },
        metadata: input.patch.metadata ?? existing.metadata,
        negotiationHistory: input.patch.negotiationHistory ?? existing.negotiationHistory,
        updatedAt: nowIso(),
        version: existing.version + 1,
        auditEnvelope: {
          ...existing.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      quoteStore.set(existing.documentId, next);
      appendAuditEvent({
        quote: next,
        type: "viewed",
        actor: input.actor,
        summary: "Quote draft updated.",
      });

      return next;
    });

    return {
      validation,
      quote: updated,
    };
  } catch (error) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "quote", message: (error as Error).message }],
      },
      quote: null,
    };
  }
}

export function addQuoteLine(input: {
  quoteId: string;
  line: NewQuoteLineInput;
  actor: string;
  expectedVersion?: number;
}): {
  validation: QuoteValidationResult;
  quote: QuoteRecord | null;
  line: QuoteRecord["lines"][number] | null;
} {
  const quote = quoteStore.get(input.quoteId);
  if (!quote) {
    return {
      validation: { valid: false, issues: [{ field: "quoteId", message: "Quote not found." }] },
      quote: null,
      line: null,
    };
  }

  if (!isDraftLikeStatus(quote.commercialStatus)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "commercialStatus", message: "Lines can only be added in draft-like states." }],
      },
      quote: null,
      line: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== quote.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      quote: null,
      line: null,
    };
  }

  const validation = validateNewQuoteLineInput(input.line);
  if (!validation.valid) {
    return {
      validation,
      quote: null,
      line: null,
    };
  }

  try {
    const { updated, addedLine } = mutateWithRollback(() => {
      const line = {
        ...input.line,
        lineId: createLineId(quote.documentId, quote.lines.length),
        snapshotTimestamp: nowIso(),
        extendedPrice: computeLineExtendedPrice({
          quantity: input.line.quantity,
          unitPrice: input.line.unitPrice,
          discount: input.line.discount,
        }),
      };

      const nextLines = [...quote.lines, line];
      const nextTotals = calculateTotals(nextLines);

      const next: QuoteRecord = {
        ...quote,
        lines: nextLines,
        totals: nextTotals,
        commercialStatus: nextLines.length > 0 ? "pricing" : quote.commercialStatus,
        updatedAt: nowIso(),
        version: quote.version + 1,
        auditEnvelope: {
          ...quote.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      quoteStore.set(quote.documentId, next);
      appendAuditEvent({
        quote: next,
        type: "line_added",
        actor: input.actor,
        summary: `Line ${line.lineId} added (${line.sku}).`,
      });

      return {
        updated: next,
        addedLine: line,
      };
    });

    return {
      validation,
      quote: updated,
      line: addedLine,
    };
  } catch (error) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "line", message: (error as Error).message }],
      },
      quote: null,
      line: null,
    };
  }
}

export function updateQuoteLine(input: {
  quoteId: string;
  lineId: string;
  patch: UpdateQuoteLineInput;
  actor: string;
  expectedVersion?: number;
}): {
  validation: QuoteValidationResult;
  quote: QuoteRecord | null;
  line: QuoteRecord["lines"][number] | null;
} {
  const quote = quoteStore.get(input.quoteId);
  if (!quote) {
    return {
      validation: { valid: false, issues: [{ field: "quoteId", message: "Quote not found." }] },
      quote: null,
      line: null,
    };
  }

  if (!isDraftLikeStatus(quote.commercialStatus)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "commercialStatus", message: "Lines can only be updated in draft-like states." }],
      },
      quote: null,
      line: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== quote.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      quote: null,
      line: null,
    };
  }

  const line = quote.lines.find((candidate) => candidate.lineId === input.lineId);
  if (!line) {
    return {
      validation: { valid: false, issues: [{ field: "lineId", message: "Line not found." }] },
      quote: null,
      line: null,
    };
  }

  const validation = validateUpdateQuoteLineInput(
    {
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
    },
    input.patch,
  );

  if (!validation.valid) {
    return {
      validation,
      quote: null,
      line: null,
    };
  }

  try {
    const { updated, updatedLine } = mutateWithRollback(() => {
      const nextLines = quote.lines.map((candidate) => {
        if (candidate.lineId !== input.lineId) {
          return candidate;
        }

        const next = {
          ...candidate,
          ...input.patch,
        };

        next.extendedPrice = computeLineExtendedPrice({
          quantity: next.quantity,
          unitPrice: next.unitPrice,
          discount: next.discount,
        });

        return next;
      });

      const nextTotals = calculateTotals(nextLines);
      const next: QuoteRecord = {
        ...quote,
        lines: nextLines,
        totals: nextTotals,
        updatedAt: nowIso(),
        version: quote.version + 1,
        auditEnvelope: {
          ...quote.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      quoteStore.set(quote.documentId, next);

      if (input.patch.quantity !== undefined && input.patch.quantity !== line.quantity) {
        appendAuditEvent({ quote: next, type: "quantity_changed", actor: input.actor, summary: `Line ${line.lineId} quantity updated.` });
      }
      if (input.patch.unitPrice !== undefined && input.patch.unitPrice !== line.unitPrice) {
        appendAuditEvent({ quote: next, type: "price_changed", actor: input.actor, summary: `Line ${line.lineId} unit price updated.` });
      }
      if (input.patch.discount !== undefined && input.patch.discount !== line.discount) {
        appendAuditEvent({ quote: next, type: "discount_changed", actor: input.actor, summary: `Line ${line.lineId} discount updated.` });
      }

      const selected = next.lines.find((candidate) => candidate.lineId === input.lineId) ?? null;
      return {
        updated: next,
        updatedLine: selected,
      };
    });

    return {
      validation,
      quote: updated,
      line: updatedLine,
    };
  } catch (error) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "line", message: (error as Error).message }],
      },
      quote: null,
      line: null,
    };
  }
}

export function removeQuoteLine(input: {
  quoteId: string;
  lineId: string;
  actor: string;
  expectedVersion?: number;
}): {
  validation: QuoteValidationResult;
  quote: QuoteRecord | null;
} {
  const quote = quoteStore.get(input.quoteId);
  if (!quote) {
    return {
      validation: { valid: false, issues: [{ field: "quoteId", message: "Quote not found." }] },
      quote: null,
    };
  }

  if (!isDraftLikeStatus(quote.commercialStatus)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "commercialStatus", message: "Lines can only be removed in draft-like states." }],
      },
      quote: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== quote.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      quote: null,
    };
  }

  const existingLine = quote.lines.find((line) => line.lineId === input.lineId);
  if (!existingLine) {
    return {
      validation: { valid: false, issues: [{ field: "lineId", message: "Line not found." }] },
      quote: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      const nextLines = quote.lines.filter((line) => line.lineId !== input.lineId);
      const nextTotals = calculateTotals(nextLines);
      const next: QuoteRecord = {
        ...quote,
        lines: nextLines,
        totals: nextTotals,
        commercialStatus: nextLines.length === 0 ? "draft" : quote.commercialStatus,
        updatedAt: nowIso(),
        version: quote.version + 1,
        auditEnvelope: {
          ...quote.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      quoteStore.set(quote.documentId, next);
      appendAuditEvent({
        quote: next,
        type: "line_removed",
        actor: input.actor,
        summary: `Line ${existingLine.lineId} removed.`,
      });
      return next;
    });

    return {
      validation: { valid: true, issues: [] },
      quote: updated,
    };
  } catch (error) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "line", message: (error as Error).message }],
      },
      quote: null,
    };
  }
}

export function createQuoteRevision(input: {
  quoteId: string;
  actor: string;
  reason: string;
  changedFields: readonly string[];
  expectedVersion?: number;
}): {
  validation: QuoteValidationResult;
  quote: QuoteRecord | null;
  revision: QuoteRevisionRecord | null;
} {
  const quote = quoteStore.get(input.quoteId);
  if (!quote) {
    return {
      validation: { valid: false, issues: [{ field: "quoteId", message: "Quote not found." }] },
      quote: null,
      revision: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== quote.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      quote: null,
      revision: null,
    };
  }

  if (!input.reason || input.reason.trim().length < 3) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "reason", message: "Revision reason is required." }],
      },
      quote: null,
      revision: null,
    };
  }

  try {
    const { updated, revision } = mutateWithRollback(() => {
      const newRevision = buildRevisionRecord({
        quote,
        author: input.actor,
        reason: input.reason,
        changedFields: input.changedFields.length > 0 ? input.changedFields : ["unspecified_change"],
        pricingDelta: quote.totals.grandTotal,
        lineDelta: quote.lines.length,
      });

      const next: QuoteRecord = {
        ...quote,
        revision: newRevision.revisionNumber,
        revisionHistory: [...quote.revisionHistory, newRevision],
        updatedAt: nowIso(),
        version: quote.version + 1,
        auditEnvelope: {
          ...quote.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      quoteStore.set(quote.documentId, next);
      appendAuditEvent({
        quote: next,
        type: "revision_created",
        actor: input.actor,
        summary: `Revision ${newRevision.revisionNumber} created: ${input.reason}`,
      });

      return {
        updated: next,
        revision: newRevision,
      };
    });

    return {
      validation: { valid: true, issues: [] },
      quote: updated,
      revision,
    };
  } catch (error) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "revision", message: (error as Error).message }],
      },
      quote: null,
      revision: null,
    };
  }
}

function transitionQuoteStatus(input: {
  quoteId: string;
  actor: string;
  action: "submit" | "approve" | "reject" | "withdraw" | "present" | "accept" | "cancel" | "expire" | "convert";
  notes: string | null;
  expectedVersion?: number;
}): {
  validation: QuoteValidationResult;
  quote: QuoteRecord | null;
} {
  const quote = quoteStore.get(input.quoteId);
  if (!quote) {
    return {
      validation: { valid: false, issues: [{ field: "quoteId", message: "Quote not found." }] },
      quote: null,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== quote.version) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "expectedVersion", message: "Version conflict detected." }],
      },
      quote: null,
    };
  }

  const violation = getTransitionViolationMessage({
    status: quote.commercialStatus,
    action: input.action,
  });

  if (violation) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "commercialStatus", message: violation }],
      },
      quote: null,
    };
  }

  try {
    const updated = mutateWithRollback(() => {
      let nextStatus = quote.commercialStatus;
      let nextApproval = quote.approvalStatus;
      let nextLifecycle = quote.lifecycleState;
      let eventType: QuoteAuditEvent["type"] = "viewed";
      const nextApprovalHistory = [...quote.approvalHistory];

      if (input.action === "submit") {
        nextStatus = "pending_approval";
        nextApproval = "pending";
        nextLifecycle = "pending_review";
        eventType = "submitted";
        nextApprovalHistory.push(createApprovalEntry({ status: "pending", actor: input.actor, notes: input.notes }));
      } else if (input.action === "approve") {
        nextStatus = "approved";
        nextApproval = "approved";
        nextLifecycle = "approved";
        eventType = "approved";
        nextApprovalHistory.push(createApprovalEntry({ status: "approved", actor: input.actor, notes: input.notes }));
      } else if (input.action === "reject") {
        nextStatus = "rejected";
        nextApproval = "rejected";
        nextLifecycle = "rejected";
        eventType = "rejected";
        nextApprovalHistory.push(createApprovalEntry({ status: "rejected", actor: input.actor, notes: input.notes }));
      } else if (input.action === "withdraw") {
        nextStatus = "pricing";
        nextApproval = "withdrawn";
        nextLifecycle = "draft";
        eventType = "withdrawn";
        nextApprovalHistory.push(createApprovalEntry({ status: "withdrawn", actor: input.actor, notes: input.notes }));
      } else if (input.action === "present") {
        nextStatus = "presented";
        nextLifecycle = "active";
        eventType = "presented";
      } else if (input.action === "accept") {
        nextStatus = "accepted";
        nextLifecycle = "active";
        eventType = "accepted";
      } else if (input.action === "cancel") {
        nextStatus = "cancelled";
        nextLifecycle = "cancelled";
        eventType = "cancelled";
      } else if (input.action === "expire") {
        nextStatus = "expired";
        nextLifecycle = "closed";
        eventType = "expired";
      } else if (input.action === "convert") {
        nextStatus = "converted";
        nextLifecycle = "closed";
        eventType = "conversion_requested";
      }

      const next: QuoteRecord = {
        ...quote,
        commercialStatus: nextStatus,
        approvalStatus: nextApproval,
        lifecycleState: nextLifecycle,
        approvalHistory: nextApprovalHistory,
        updatedAt: nowIso(),
        version: quote.version + 1,
        conversionContract:
          input.action === "convert"
            ? {
              ...quote.conversionContract,
              requested: true,
              requestedAt: nowIso(),
              requestedBy: input.actor,
              status: "requested",
            }
            : quote.conversionContract,
        auditEnvelope: {
          ...quote.auditEnvelope,
          updatedBy: input.actor,
        },
      };

      quoteStore.set(quote.documentId, next);
      appendAuditEvent({
        quote: next,
        type: eventType,
        actor: input.actor,
        summary: `Quote status transition: ${quote.commercialStatus} -> ${nextStatus}`,
      });

      return next;
    });

    return {
      validation: { valid: true, issues: [] },
      quote: updated,
    };
  } catch (error) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "status", message: (error as Error).message }],
      },
      quote: null,
    };
  }
}

export function submitQuote(input: { quoteId: string; actor: string; notes: string | null; expectedVersion?: number }) {
  return transitionQuoteStatus({ ...input, action: "submit" });
}

export function approveQuote(input: { quoteId: string; actor: string; notes: string | null; expectedVersion?: number }) {
  return transitionQuoteStatus({ ...input, action: "approve" });
}

export function rejectQuote(input: { quoteId: string; actor: string; notes: string | null; expectedVersion?: number }) {
  return transitionQuoteStatus({ ...input, action: "reject" });
}

export function withdrawQuote(input: { quoteId: string; actor: string; notes: string | null; expectedVersion?: number }) {
  return transitionQuoteStatus({ ...input, action: "withdraw" });
}

export function presentQuote(input: { quoteId: string; actor: string; notes: string | null; expectedVersion?: number }) {
  return transitionQuoteStatus({ ...input, action: "present" });
}

export function acceptQuote(input: { quoteId: string; actor: string; notes: string | null; expectedVersion?: number }) {
  return transitionQuoteStatus({ ...input, action: "accept" });
}

export function cancelQuote(input: { quoteId: string; actor: string; notes: string | null; expectedVersion?: number }) {
  return transitionQuoteStatus({ ...input, action: "cancel" });
}

export function expireQuote(input: { quoteId: string; actor: string; notes: string | null; expectedVersion?: number }) {
  return transitionQuoteStatus({ ...input, action: "expire" });
}

export function convertQuoteToOrderContract(input: {
  quoteId: string;
  actor: string;
  notes: string | null;
  expectedVersion?: number;
}): {
  validation: QuoteValidationResult;
  quote: QuoteRecord | null;
  conversion: QuoteRecord["conversionContract"] | null;
} {
  const result = transitionQuoteStatus({ ...input, action: "convert" });
  return {
    validation: result.validation,
    quote: result.quote,
    conversion: result.quote?.conversionContract ?? null,
  };
}

export function markQuoteViewed(input: {
  quoteId: string;
  actor: string;
  correlationId?: string | null;
}): void {
  const quote = quoteStore.get(input.quoteId);
  if (!quote) {
    return;
  }

  try {
    mutateWithRollback(() => {
      appendAuditEvent({
        quote,
        type: "viewed",
        actor: input.actor,
        summary: `Quote ${quote.quoteNumber} viewed.`,
        correlationId: input.correlationId,
      });
      return true;
    });
  } catch {
    // Viewing should not fail route responses.
  }
}

export function resetQuoteRepositoryForTests(): void {
  const reset = resetPersistedState<QuoteRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: createSeedState,
  });

  applyState(reset.state);
  stateRevision = reset.revision;
}

export function isVersionConflict(error: unknown): boolean {
  return error instanceof FoundationPersistenceConflictError;
}
