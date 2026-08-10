import { deterministicSort } from "../../shared";
import type { ProductionExecutionSummary, TenantId } from "../contracts";
import type { ProductionOutputService } from "../services/ProductionOutputService";
import type { ReworkService } from "../services/ReworkService";
import type { ScrapService } from "../services/ScrapService";
import type { WipService } from "../services/WipService";
import type { YieldService } from "../services/YieldService";

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export class ManufacturingProductionResultQueryService {
  constructor(
    private readonly dependencies: {
      outputs: ProductionOutputService;
      scraps: ScrapService;
      rework: ReworkService;
      yields: YieldService;
      wip: WipService;
    },
  ) {}

  getProductionOutput(tenantId: TenantId, outputId: string) {
    return this.dependencies.outputs.getProductionOutput(tenantId, outputId);
  }

  listProductionOutputs(tenantId: TenantId) {
    return this.dependencies.outputs.listProductionOutputs(tenantId);
  }

  listProductionOutputsByWorkOrder(tenantId: TenantId, workOrderId: string) {
    return this.dependencies.outputs.listProductionOutputsByWorkOrder(tenantId, workOrderId);
  }

  listProductionOutputsByOperation(tenantId: TenantId, operationExecutionId: string) {
    return this.dependencies.outputs.listProductionOutputsByOperation(tenantId, operationExecutionId);
  }

  getScrapRecord(tenantId: TenantId, scrapRecordId: string) {
    return this.dependencies.scraps.getScrapRecord(tenantId, scrapRecordId);
  }

  listScrapByWorkOrder(tenantId: TenantId, workOrderId: string) {
    return this.dependencies.scraps.listScrapByWorkOrder(tenantId, workOrderId);
  }

  listScrapByOperation(tenantId: TenantId, operationExecutionId: string) {
    return this.dependencies.scraps.listScrapByOperation(tenantId, operationExecutionId);
  }

  getReworkRecord(tenantId: TenantId, reworkRecordId: string) {
    return this.dependencies.rework.getReworkRecord(tenantId, reworkRecordId);
  }

  listReworkByWorkOrder(tenantId: TenantId, workOrderId: string) {
    return this.dependencies.rework.listReworkByWorkOrder(tenantId, workOrderId);
  }

  listReworkByOperation(tenantId: TenantId, operationExecutionId: string) {
    return this.dependencies.rework.listReworkByOperation(tenantId, operationExecutionId);
  }

  getYield(tenantId: TenantId, workOrderId: string, operationExecutionId?: string) {
    return operationExecutionId
      ? this.dependencies.yields.getOperationYield(tenantId, workOrderId, operationExecutionId)
      : this.dependencies.yields.getWorkOrderYield(tenantId, workOrderId);
  }

  getWorkOrderYield(tenantId: TenantId, workOrderId: string) {
    return this.dependencies.yields.getWorkOrderYield(tenantId, workOrderId);
  }

  getOperationYield(tenantId: TenantId, workOrderId: string, operationExecutionId: string) {
    return this.dependencies.yields.getOperationYield(tenantId, workOrderId, operationExecutionId);
  }

  getWipState(tenantId: TenantId, workOrderId: string) {
    return this.dependencies.wip.getWipState(tenantId, workOrderId);
  }

  listWipByWorkOrder(tenantId: TenantId) {
    return this.dependencies.wip.listWipByWorkOrder(tenantId);
  }

  getProductionExecutionSummary(
    tenantId: TenantId,
    workOrderId: string,
    operationExecutionId?: string,
  ): ProductionExecutionSummary {
    const outputs = operationExecutionId
      ? this.dependencies.outputs.listProductionOutputsByOperation(tenantId, operationExecutionId)
      : this.dependencies.outputs.listProductionOutputsByWorkOrder(tenantId, workOrderId);
    const scraps = operationExecutionId
      ? this.dependencies.scraps.listScrapByOperation(tenantId, operationExecutionId)
      : this.dependencies.scraps.listScrapByWorkOrder(tenantId, workOrderId);
    const rework = operationExecutionId
      ? this.dependencies.rework.listReworkByOperation(tenantId, operationExecutionId)
      : this.dependencies.rework.listReworkByWorkOrder(tenantId, workOrderId);

    const completed = outputs
      .filter((entry) => entry.disposition === "GOOD" || entry.disposition === "FINISHED" || entry.disposition === "INTERMEDIATE")
      .reduce((sum, entry) => sum + entry.quantity, 0);
    const rejected = outputs.filter((entry) => entry.disposition === "REJECTED").reduce((sum, entry) => sum + entry.quantity, 0);
    const outputScrap = outputs.filter((entry) => entry.disposition === "SCRAP").reduce((sum, entry) => sum + entry.quantity, 0);
    const explicitScrap = scraps.reduce((sum, entry) => sum + entry.quantity, 0);
    const scrap = Math.max(outputScrap, explicitScrap);
    const reworkQuantity = rework.reduce((sum, entry) => sum + entry.quantity, 0);
    const processed = completed + rejected + scrap;

    const yieldProjection = operationExecutionId
      ? this.dependencies.yields.getOperationYield(tenantId, workOrderId, operationExecutionId)
      : this.dependencies.yields.getWorkOrderYield(tenantId, workOrderId);

    return {
      tenantId,
      workOrderId: workOrderId as ProductionExecutionSummary["workOrderId"],
      operationExecutionId: operationExecutionId as ProductionExecutionSummary["operationExecutionId"],
      completedQuantity: round(completed),
      rejectedQuantity: round(rejected),
      scrapQuantity: round(scrap),
      reworkQuantity: round(reworkQuantity),
      goodQuantity: round(completed),
      processedQuantity: round(processed),
      yieldRatio: yieldProjection.yieldRatio,
      outputCount: outputs.length,
      scrapCount: scraps.length,
      reworkCount: rework.length,
      reconciliationRequired:
        outputs.some((entry) => entry.status === "RECONCILIATION_REQUIRED") ||
        scraps.some((entry) => entry.status === "RECONCILIATION_REQUIRED"),
    };
  }

  getOutputReconciliationStatus(tenantId: TenantId, workOrderId: string) {
    const outputs = this.dependencies.outputs.listProductionOutputsByWorkOrder(tenantId, workOrderId);
    const scraps = this.dependencies.scraps.listScrapByWorkOrder(tenantId, workOrderId);
    const unresolvedOutputs = deterministicSort(
      outputs.filter((entry) => entry.status === "RECONCILIATION_REQUIRED"),
      (entry) => entry.productionOutputId,
    );
    const unresolvedScrap = deterministicSort(
      scraps.filter((entry) => entry.status === "RECONCILIATION_REQUIRED"),
      (entry) => entry.scrapRecordId,
    );

    return {
      tenantId,
      workOrderId,
      reconciliationRequired: unresolvedOutputs.length > 0 || unresolvedScrap.length > 0,
      unresolvedOutputs,
      unresolvedScrap,
    };
  }
}
