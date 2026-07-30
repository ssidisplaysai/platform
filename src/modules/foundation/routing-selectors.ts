import type { RoutingListFilters, RoutingRecord, RoutingSearchFilters, RoutingSearchResult } from "./routing-types";

function includesQuery(value: string | null | undefined, query: string): boolean {
  if (!value) {
    return false;
  }

  return value.toLowerCase().includes(query.toLowerCase());
}

function matchesRoutingFilters(routing: RoutingRecord, filters: RoutingListFilters): boolean {
  if (filters.organizationId && routing.organizationId !== filters.organizationId) {
    return false;
  }

  if (filters.siteReference && routing.siteReference !== filters.siteReference) {
    return false;
  }

  if (filters.status && routing.status !== filters.status) {
    return false;
  }

  if (filters.productionJobId && routing.lineage.productionJobId !== filters.productionJobId) {
    return false;
  }

  if (filters.workOrderId && routing.lineage.workOrderId !== filters.workOrderId) {
    return false;
  }

  if (filters.salesOrderId && routing.lineage.originSalesOrderId !== filters.salesOrderId) {
    return false;
  }

  if (filters.quoteId && routing.lineage.originQuoteId !== filters.quoteId) {
    return false;
  }

  if (filters.productReference && routing.productReference !== filters.productReference) {
    return false;
  }

  if (filters.assemblyReference && routing.assemblyReference !== filters.assemblyReference) {
    return false;
  }

  if (filters.operationReference && !routing.operationSequence.some((step) => step.operationReference === filters.operationReference)) {
    return false;
  }

  if (filters.query) {
    const query = filters.query.toLowerCase();
    const haystack = [
      routing.routingNumber,
      routing.routingName,
      routing.description,
      routing.productReference,
      routing.assemblyReference,
      routing.estimatedCycleTimeMinutes?.toString(),
      routing.lineage.productionJobId,
      routing.lineage.workOrderId,
      routing.lineage.originSalesOrderId,
      routing.lineage.originQuoteId,
      routing.status,
      routing.organizationId,
      routing.siteReference,
      routing.referenceDocuments.join(" "),
      routing.operationSequence.map((step) => step.operationReference).join(" "),
    ].join(" ");

    if (!haystack.toLowerCase().includes(query)) {
      return false;
    }
  }

  return true;
}

export function filterRoutings(routings: readonly RoutingRecord[], filters: RoutingListFilters): RoutingRecord[] {
  return routings.filter((routing) => matchesRoutingFilters(routing, filters));
}

export function searchRoutings(
  routings: readonly RoutingRecord[],
  filters: RoutingSearchFilters,
): RoutingSearchResult[] {
  const query = filters.query.trim();
  if (!query) {
    return [];
  }

  return routings
    .filter((routing) => {
      if (filters.organizationId && routing.organizationId !== filters.organizationId) {
        return false;
      }
      if (filters.siteReference && routing.siteReference !== filters.siteReference) {
        return false;
      }
      return true;
    })
    .map((routing) => {
      const matchedFields: string[] = [];

      if (includesQuery(routing.routingNumber, query)) matchedFields.push("routingNumber");
      if (includesQuery(routing.routingName, query)) matchedFields.push("routingName");
      if (includesQuery(routing.description, query)) matchedFields.push("description");
      if (includesQuery(routing.productReference, query)) matchedFields.push("productReference");
      if (includesQuery(routing.assemblyReference, query)) matchedFields.push("assemblyReference");
      if (includesQuery(routing.status, query)) matchedFields.push("status");
      if (includesQuery(routing.organizationId, query)) matchedFields.push("organizationId");
      if (includesQuery(routing.siteReference, query)) matchedFields.push("siteReference");
      if (includesQuery(routing.lineage.productionJobId, query)) matchedFields.push("productionJobId");
      if (includesQuery(routing.lineage.workOrderId, query)) matchedFields.push("workOrderId");
      if (includesQuery(routing.lineage.originSalesOrderId, query)) matchedFields.push("originSalesOrderId");
      if (includesQuery(routing.lineage.originQuoteId, query)) matchedFields.push("originQuoteId");
      if (includesQuery(routing.operationSequence.map((step) => step.operationReference).join(" "), query)) {
        matchedFields.push("operationReference");
      }
      if (includesQuery(routing.referenceDocuments.join(" "), query)) matchedFields.push("referenceDocuments");

      return {
        routingId: routing.documentId,
        routingNumber: routing.routingNumber,
        version: routing.version,
        productionJobId: routing.lineage.productionJobId,
        workOrderId: routing.lineage.workOrderId,
        originSalesOrderId: routing.lineage.originSalesOrderId,
        originQuoteId: routing.lineage.originQuoteId,
        productReference: routing.productReference,
        assemblyReference: routing.assemblyReference,
        status: routing.status,
        routingName: routing.routingName,
        matchedFields,
      } satisfies RoutingSearchResult;
    })
    .filter((result) => result.matchedFields.length > 0);
}