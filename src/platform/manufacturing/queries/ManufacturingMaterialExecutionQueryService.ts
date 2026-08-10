import type { TenantId } from "../contracts";
import type { MaterialConsumptionService } from "../services/MaterialConsumptionService";
import type { MaterialIssueService } from "../services/MaterialIssueService";
import type { MaterialRequirementService } from "../services/MaterialRequirementService";

export class ManufacturingMaterialExecutionQueryService {
  constructor(
    private readonly dependencies: {
      materials: MaterialRequirementService;
      issues: MaterialIssueService;
      consumption: MaterialConsumptionService;
    },
  ) {}

  getMaterialExecutionSummary(tenantId: TenantId, materialRequirementId: string) {
    const summary = this.dependencies.materials.getMaterialExecutionSummary(tenantId, materialRequirementId);
    const issueRecords = this.dependencies.issues.listIssueRecordsByRequirement(tenantId, materialRequirementId);
    const returnRecords = this.dependencies.issues.listReturnRecordsByRequirement(tenantId, materialRequirementId);
    const consumptionRecords = this.dependencies.consumption.listConsumptionRecordsByRequirement(tenantId, materialRequirementId);

    return {
      ...summary,
      issueRecords,
      returnRecords,
      consumptionRecords,
      reconciliationRequired:
        issueRecords.some((entry) => entry.status === "RECONCILIATION_REQUIRED") ||
        returnRecords.some((entry) => entry.status === "RECONCILIATION_REQUIRED"),
    };
  }
}
