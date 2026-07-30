import type {
  WorkOrderListFilters,
  WorkOrderRecord,
  WorkOrderSearchFilters,
  WorkOrderSearchResult,
} from "./work-order-types";

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function filterWorkOrders(
  workOrders: readonly WorkOrderRecord[],
  filters: WorkOrderListFilters = {},
): readonly WorkOrderRecord[] {
  return workOrders.filter((workOrder) => {
    if (filters.organizationId && workOrder.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.siteReference && workOrder.siteReference !== filters.siteReference) {
      return false;
    }

    if (filters.status && workOrder.status !== filters.status) {
      return false;
    }

    if (
      filters.salesOrderId &&
      workOrder.commercialLineage.originSalesOrderId !== filters.salesOrderId
    ) {
      return false;
    }

    if (filters.quoteId && workOrder.commercialLineage.originQuoteId !== filters.quoteId) {
      return false;
    }

    if (filters.customerReference && workOrder.customerReference !== filters.customerReference) {
      return false;
    }

    if (filters.query) {
      const q = normalized(filters.query);
      const lineText = workOrder.lines
        .map((line) => `${line.sku} ${line.productId} ${line.displayName}`)
        .join(" ")
        .toLowerCase();
      const candidate = `${workOrder.workOrderNumber} ${workOrder.customerReference} ${workOrder.commercialLineage.originSalesOrderId} ${workOrder.commercialLineage.originQuoteId} ${workOrder.status} ${workOrder.referenceNumber ?? ""} ${lineText}`.toLowerCase();
      if (!candidate.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

export function searchWorkOrders(
  workOrders: readonly WorkOrderRecord[],
  filters: WorkOrderSearchFilters,
): readonly WorkOrderSearchResult[] {
  const q = normalized(filters.query);

  return workOrders
    .filter((workOrder) => {
      if (filters.organizationId && workOrder.organizationId !== filters.organizationId) {
        return false;
      }
      if (filters.siteReference && workOrder.siteReference !== filters.siteReference) {
        return false;
      }
      return true;
    })
    .map((workOrder) => {
      const matchedFields: string[] = [];

      if (normalized(workOrder.workOrderNumber).includes(q)) {
        matchedFields.push("workOrderNumber");
      }
      if (normalized(workOrder.commercialLineage.originSalesOrderId).includes(q)) {
        matchedFields.push("salesOrder");
      }
      if (normalized(workOrder.commercialLineage.originQuoteId).includes(q)) {
        matchedFields.push("quote");
      }
      if (normalized(workOrder.customerReference).includes(q)) {
        matchedFields.push("customer");
      }
      if (normalized(workOrder.status).includes(q)) {
        matchedFields.push("status");
      }
      if (normalized(workOrder.organizationId).includes(q)) {
        matchedFields.push("organization");
      }
      if (
        normalized(workOrder.createdAt).includes(q) ||
        normalized(workOrder.updatedAt).includes(q)
      ) {
        matchedFields.push("date");
      }
      if (workOrder.referenceNumber && normalized(workOrder.referenceNumber).includes(q)) {
        matchedFields.push("reference");
      }

      return {
        workOrderId: workOrder.documentId,
        workOrderNumber: workOrder.workOrderNumber,
        originSalesOrderId: workOrder.commercialLineage.originSalesOrderId,
        originQuoteId: workOrder.commercialLineage.originQuoteId,
        customerReference: workOrder.customerReference,
        status: workOrder.status,
        referenceNumber: workOrder.referenceNumber,
        matchedFields: Array.from(new Set(matchedFields)),
      };
    })
    .filter((result) => result.matchedFields.length > 0);
}
