import type { YieldProjection, TenantId } from "../contracts";
import type { ProductionOutputService } from "./ProductionOutputService";
import type { ScrapService } from "./ScrapService";

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export class YieldService {
  constructor(
    private readonly dependencies: {
      outputs: ProductionOutputService;
      scraps: ScrapService;
      now(): string;
    },
  ) {}

  getWorkOrderYield(tenantId: TenantId, workOrderId: string): YieldProjection {
    const outputs = this.dependencies.outputs.listProductionOutputsByWorkOrder(tenantId, workOrderId);
    const scraps = this.dependencies.scraps.listScrapByWorkOrder(tenantId, workOrderId);

    const completedQuantity = outputs
      .filter((entry) => entry.disposition === "GOOD" || entry.disposition === "FINISHED" || entry.disposition === "INTERMEDIATE")
      .reduce((sum, entry) => sum + entry.quantity, 0);
    const rejectedQuantity = outputs.filter((entry) => entry.disposition === "REJECTED").reduce((sum, entry) => sum + entry.quantity, 0);
    const scrapFromOutputs = outputs.filter((entry) => entry.disposition === "SCRAP").reduce((sum, entry) => sum + entry.quantity, 0);
    const explicitScrap = scraps.reduce((sum, entry) => sum + entry.quantity, 0);
    const scrapQuantity = Math.max(scrapFromOutputs, explicitScrap);

    return this.createYieldProjection({
      tenantId,
      scope: "WORK_ORDER",
      workOrderId,
      numerator: completedQuantity,
      denominator: completedQuantity + rejectedQuantity + scrapQuantity,
    });
  }

  getOperationYield(tenantId: TenantId, workOrderId: string, operationExecutionId: string): YieldProjection {
    const outputs = this.dependencies.outputs.listProductionOutputsByOperation(tenantId, operationExecutionId);
    const scraps = this.dependencies.scraps.listScrapByOperation(tenantId, operationExecutionId);

    const completedQuantity = outputs
      .filter((entry) => entry.disposition === "GOOD" || entry.disposition === "FINISHED" || entry.disposition === "INTERMEDIATE")
      .reduce((sum, entry) => sum + entry.quantity, 0);
    const rejectedQuantity = outputs.filter((entry) => entry.disposition === "REJECTED").reduce((sum, entry) => sum + entry.quantity, 0);
    const scrapFromOutputs = outputs.filter((entry) => entry.disposition === "SCRAP").reduce((sum, entry) => sum + entry.quantity, 0);
    const explicitScrap = scraps.reduce((sum, entry) => sum + entry.quantity, 0);
    const scrapQuantity = Math.max(scrapFromOutputs, explicitScrap);

    return this.createYieldProjection({
      tenantId,
      scope: "OPERATION",
      workOrderId,
      operationExecutionId,
      numerator: completedQuantity,
      denominator: completedQuantity + rejectedQuantity + scrapQuantity,
    });
  }

  private createYieldProjection(input: {
    tenantId: TenantId;
    scope: "WORK_ORDER" | "OPERATION";
    workOrderId: string;
    operationExecutionId?: string;
    numerator: number;
    denominator: number;
  }): YieldProjection {
    const denominator = round(input.denominator);
    const numerator = round(input.numerator);
    if (denominator <= 0) {
      return {
        tenantId: input.tenantId,
        scope: input.scope,
        workOrderId: input.workOrderId as YieldProjection["workOrderId"],
        operationExecutionId: input.operationExecutionId as YieldProjection["operationExecutionId"],
        numerator,
        denominator,
        classification: "UNDEFINED",
        formulaVersion: "v1.good-over-processed",
        computedAt: this.dependencies.now(),
      };
    }

    return {
      tenantId: input.tenantId,
      scope: input.scope,
      workOrderId: input.workOrderId as YieldProjection["workOrderId"],
      operationExecutionId: input.operationExecutionId as YieldProjection["operationExecutionId"],
      numerator,
      denominator,
      yieldRatio: round(numerator / denominator),
      classification: "DEFINED",
      formulaVersion: "v1.good-over-processed",
      computedAt: this.dependencies.now(),
    };
  }
}
