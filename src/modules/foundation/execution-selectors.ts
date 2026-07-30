import type { ExecutionListFilters, ExecutionRecord, ExecutionSearchFilters, ExecutionSearchResult } from "./execution-types";

function includesQuery(value: string | null | undefined, query: string): boolean {
  return Boolean(value && value.toLowerCase().includes(query.toLowerCase()));
}

function matchesExecutionFilters(execution: ExecutionRecord, filters: ExecutionListFilters): boolean {
  if (filters.organizationId && execution.organizationId !== filters.organizationId) {
    return false;
  }

  if (filters.siteReference && execution.siteReference !== filters.siteReference) {
    return false;
  }

  if (filters.status && execution.status !== filters.status) {
    return false;
  }

  if (filters.scheduleId && execution.lineage.scheduleId !== filters.scheduleId) {
    return false;
  }

  if (filters.productionJobId && execution.lineage.productionJobId !== filters.productionJobId) {
    return false;
  }

  if (filters.operationId && execution.lineage.operationId !== filters.operationId) {
    return false;
  }

  if (filters.routingVersionId && execution.lineage.routingVersionId !== filters.routingVersionId) {
    return false;
  }

  if (filters.workOrderId && execution.lineage.workOrderId !== filters.workOrderId) {
    return false;
  }

  if (filters.query) {
    const query = filters.query.toLowerCase();
    const haystack = [
      execution.executionNumber,
      execution.executionName,
      execution.status,
      execution.organizationId,
      execution.siteReference,
      execution.lineage.scheduleId,
      execution.lineage.productionJobId,
      execution.lineage.operationId,
      execution.lineage.routingVersionId,
      execution.lineage.workOrderId,
      execution.notes,
      execution.operatorReferences.join(" "),
      execution.machineReferences.join(" "),
      execution.telemetryReferences.join(" "),
    ].join(" ");

    if (!haystack.toLowerCase().includes(query)) {
      return false;
    }
  }

  return true;
}

export function filterExecutions(executions: readonly ExecutionRecord[], filters: ExecutionListFilters): ExecutionRecord[] {
  return executions.filter((execution) => matchesExecutionFilters(execution, filters));
}

export function searchExecutions(executions: readonly ExecutionRecord[], filters: ExecutionSearchFilters): ExecutionSearchResult[] {
  const query = filters.query.trim();
  if (!query) {
    return [];
  }

  return executions
    .filter((execution) => {
      if (filters.organizationId && execution.organizationId !== filters.organizationId) {
        return false;
      }

      if (filters.siteReference && execution.siteReference !== filters.siteReference) {
        return false;
      }

      return true;
    })
    .map((execution) => {
      const matchedFields: string[] = [];
      if (includesQuery(execution.executionNumber, query)) matchedFields.push("executionNumber");
      if (includesQuery(execution.executionName, query)) matchedFields.push("executionName");
      if (includesQuery(execution.status, query)) matchedFields.push("status");
      if (includesQuery(execution.lineage.scheduleId, query)) matchedFields.push("scheduleId");
      if (includesQuery(execution.lineage.productionJobId, query)) matchedFields.push("productionJobId");
      if (includesQuery(execution.lineage.operationId, query)) matchedFields.push("operationId");
      if (includesQuery(execution.lineage.routingVersionId, query)) matchedFields.push("routingVersionId");
      if (includesQuery(execution.lineage.workOrderId, query)) matchedFields.push("workOrderId");
      if (includesQuery(execution.organizationId, query)) matchedFields.push("organizationId");
      if (includesQuery(execution.siteReference, query)) matchedFields.push("siteReference");
      if (includesQuery(execution.notes, query)) matchedFields.push("notes");

      return {
        executionId: execution.documentId,
        executionNumber: execution.executionNumber,
        executionName: execution.executionName,
        status: execution.status,
        scheduleId: execution.lineage.scheduleId,
        productionJobId: execution.lineage.productionJobId,
        operationId: execution.lineage.operationId,
        routingVersionId: execution.lineage.routingVersionId,
        workOrderId: execution.lineage.workOrderId,
        matchedFields,
      } satisfies ExecutionSearchResult;
    })
    .filter((result) => result.matchedFields.length > 0);
}
