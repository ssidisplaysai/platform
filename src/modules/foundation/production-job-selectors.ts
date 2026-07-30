import type {
  ProductionJobListFilters,
  ProductionJobRecord,
  ProductionJobSearchFilters,
  ProductionJobSearchResult,
} from "./production-job-types";

function normalized(value: string): string {
  return value.trim().toLowerCase();
}

export function filterProductionJobs(
  jobs: readonly ProductionJobRecord[],
  filters: ProductionJobListFilters = {},
): readonly ProductionJobRecord[] {
  return jobs.filter((job) => {
    if (filters.organizationId && job.organizationId !== filters.organizationId) {
      return false;
    }
    if (filters.siteReference && job.siteReference !== filters.siteReference) {
      return false;
    }
    if (filters.status && job.status !== filters.status) {
      return false;
    }
    if (filters.workOrderId && job.lineage.workOrderId !== filters.workOrderId) {
      return false;
    }
    if (filters.salesOrderId && job.lineage.originSalesOrderId !== filters.salesOrderId) {
      return false;
    }
    if (filters.quoteId && job.lineage.originQuoteId !== filters.quoteId) {
      return false;
    }
    if (filters.customerReference && job.customerReference !== filters.customerReference) {
      return false;
    }

    if (filters.query) {
      const q = normalized(filters.query);
      const lineText = job.lines
        .map((line) => `${line.sku} ${line.productId} ${line.displayName}`)
        .join(" ")
        .toLowerCase();
      const candidate = `${job.productionJobNumber} ${job.customerReference} ${job.lineage.workOrderId} ${job.lineage.originSalesOrderId} ${job.lineage.originQuoteId} ${job.status} ${job.organizationId} ${job.referenceNumber ?? ""} ${job.createdAt} ${job.updatedAt} ${lineText}`.toLowerCase();
      if (!candidate.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

export function searchProductionJobs(
  jobs: readonly ProductionJobRecord[],
  filters: ProductionJobSearchFilters,
): readonly ProductionJobSearchResult[] {
  const q = normalized(filters.query);

  return jobs
    .filter((job) => {
      if (filters.organizationId && job.organizationId !== filters.organizationId) {
        return false;
      }
      if (filters.siteReference && job.siteReference !== filters.siteReference) {
        return false;
      }
      return true;
    })
    .map((job) => {
      const matchedFields: string[] = [];
      if (normalized(job.productionJobNumber).includes(q)) {
        matchedFields.push("productionJobNumber");
      }
      if (normalized(job.lineage.workOrderId).includes(q)) {
        matchedFields.push("workOrder");
      }
      if (normalized(job.lineage.originSalesOrderId).includes(q)) {
        matchedFields.push("salesOrder");
      }
      if (normalized(job.lineage.originQuoteId).includes(q)) {
        matchedFields.push("quote");
      }
      if (normalized(job.customerReference).includes(q)) {
        matchedFields.push("customer");
      }
      if (normalized(job.status).includes(q)) {
        matchedFields.push("status");
      }
      if (normalized(job.organizationId).includes(q)) {
        matchedFields.push("organization");
      }
      if (normalized(job.createdAt).includes(q) || normalized(job.updatedAt).includes(q)) {
        matchedFields.push("date");
      }
      if (job.referenceNumber && normalized(job.referenceNumber).includes(q)) {
        matchedFields.push("reference");
      }

      return {
        productionJobId: job.documentId,
        productionJobNumber: job.productionJobNumber,
        workOrderId: job.lineage.workOrderId,
        originSalesOrderId: job.lineage.originSalesOrderId,
        originQuoteId: job.lineage.originQuoteId,
        customerReference: job.customerReference,
        status: job.status,
        referenceNumber: job.referenceNumber,
        matchedFields: Array.from(new Set(matchedFields)),
      };
    })
    .filter((result) => result.matchedFields.length > 0);
}
