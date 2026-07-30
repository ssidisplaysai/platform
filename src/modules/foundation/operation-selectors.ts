import type { OperationListFilters, OperationRecord, OperationSearchFilters, OperationSearchResult } from "./operation-types";

function includesQuery(value: string | null | undefined, query: string): boolean {
  return Boolean(value && value.toLowerCase().includes(query));
}

function matchesFilters(operation: OperationRecord, filters: OperationListFilters): boolean {
  if (filters.organizationId && operation.organizationId !== filters.organizationId) {
    return false;
  }

  if (filters.siteReference && operation.siteReference !== filters.siteReference) {
    return false;
  }

  if (filters.status && operation.status !== filters.status) {
    return false;
  }

  if (filters.productionJobId && operation.lineage.productionJobId !== filters.productionJobId) {
    return false;
  }

  if (filters.workOrderId && operation.lineage.workOrderId !== filters.workOrderId) {
    return false;
  }

  if (filters.salesOrderId && operation.lineage.originSalesOrderId !== filters.salesOrderId) {
    return false;
  }

  if (filters.quoteId && operation.lineage.originQuoteId !== filters.quoteId) {
    return false;
  }

  if (filters.operationType && operation.operationType !== filters.operationType) {
    return false;
  }

  if (filters.query) {
    const query = filters.query.toLowerCase();
    const haystacks = [
      operation.operationNumber,
      operation.operationType,
      operation.operationName,
      operation.description,
      operation.referenceNumber,
      operation.requiredCapability,
      operation.requiredWorkCenterReference,
      operation.requiredMachineTypeReference,
      operation.requiredSkill,
      operation.customerReference,
      operation.organizationId,
      operation.siteReference,
      operation.lineage.productionJobId,
      operation.lineage.workOrderId,
      operation.lineage.originSalesOrderId,
      operation.lineage.originQuoteId,
    ];

    if (!haystacks.some((value) => includesQuery(value, query))) {
      return false;
    }
  }

  return true;
}

export function filterOperations(
  operations: readonly OperationRecord[],
  filters: OperationListFilters,
): OperationRecord[] {
  return operations.filter((operation) => matchesFilters(operation, filters));
}

export function searchOperations(
  operations: readonly OperationRecord[],
  filters: OperationSearchFilters,
): OperationSearchResult[] {
  const query = filters.query.trim().toLowerCase();
  if (!query) {
    return [];
  }

  return operations
    .filter((operation) => {
      if (filters.organizationId && operation.organizationId !== filters.organizationId) {
        return false;
      }

      if (filters.siteReference && operation.siteReference !== filters.siteReference) {
        return false;
      }

      const haystacks = [
        operation.operationNumber,
        operation.operationType,
        operation.operationName,
        operation.description,
        operation.referenceNumber,
        operation.requiredCapability,
        operation.requiredWorkCenterReference,
        operation.requiredMachineTypeReference,
        operation.requiredSkill,
        operation.customerReference,
        operation.organizationId,
        operation.siteReference,
        operation.lineage.productionJobId,
        operation.lineage.workOrderId,
        operation.lineage.originSalesOrderId,
        operation.lineage.originQuoteId,
      ];

      return haystacks.some((value) => includesQuery(value, query));
    })
    .map((operation) => {
      const matchedFields: string[] = [];
      const checks: Array<[string, string | null | undefined]> = [
        ["operationNumber", operation.operationNumber],
        ["operationType", operation.operationType],
        ["operationName", operation.operationName],
        ["description", operation.description],
        ["referenceNumber", operation.referenceNumber],
        ["requiredCapability", operation.requiredCapability],
        ["requiredWorkCenterReference", operation.requiredWorkCenterReference],
        ["requiredMachineTypeReference", operation.requiredMachineTypeReference],
        ["requiredSkill", operation.requiredSkill],
        ["customerReference", operation.customerReference],
        ["organizationId", operation.organizationId],
        ["siteReference", operation.siteReference],
        ["productionJobId", operation.lineage.productionJobId],
        ["workOrderId", operation.lineage.workOrderId],
        ["salesOrderId", operation.lineage.originSalesOrderId],
        ["quoteId", operation.lineage.originQuoteId],
      ];

      checks.forEach(([field, value]) => {
        if (includesQuery(value, query)) {
          matchedFields.push(field);
        }
      });

      return {
        operationId: operation.documentId,
        operationNumber: operation.operationNumber,
        productionJobId: operation.lineage.productionJobId,
        workOrderId: operation.lineage.workOrderId,
        originSalesOrderId: operation.lineage.originSalesOrderId,
        originQuoteId: operation.lineage.originQuoteId,
        operationType: operation.operationType,
        status: operation.status,
        referenceNumber: operation.referenceNumber,
        operationName: operation.operationName,
        matchedFields,
      } satisfies OperationSearchResult;
    });
}
