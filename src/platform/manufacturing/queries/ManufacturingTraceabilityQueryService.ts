import type { TenantId } from "../contracts";
import type { ManufacturingTraceabilityService } from "../services/ManufacturingTraceabilityService";

export class ManufacturingTraceabilityQueryService {
  constructor(
    private readonly dependencies: {
      traces: ManufacturingTraceabilityService;
    },
  ) {}

  getProductionTrace(tenantId: TenantId, productionTraceId: string) {
    return this.dependencies.traces.getProductionTrace(tenantId, productionTraceId);
  }

  listProductionTrace(tenantId: TenantId) {
    return this.dependencies.traces.listProductionTrace(tenantId);
  }

  listTraceByWorkOrder(tenantId: TenantId, workOrderId: string) {
    return this.dependencies.traces.listTraceByWorkOrder(tenantId, workOrderId);
  }

  listTraceByOperation(tenantId: TenantId, operationExecutionId: string) {
    return this.dependencies.traces.listTraceByOperation(tenantId, operationExecutionId);
  }

  listTraceBySource(tenantId: TenantId, sourceType: string, sourceId: string) {
    return this.dependencies.traces.listTraceBySource(tenantId, sourceType, sourceId);
  }

  listTraceByTarget(tenantId: TenantId, targetType: string, targetId: string) {
    return this.dependencies.traces.listTraceByTarget(tenantId, targetType, targetId);
  }

  traceProductToWorkOrder(tenantId: TenantId, productVersionId: string, workOrderId: string) {
    return this.dependencies.traces.traceProductToWorkOrder(tenantId, productVersionId, workOrderId);
  }

  traceMaterialToConsumption(tenantId: TenantId, materialRequirementId: string) {
    return this.dependencies.traces.traceMaterialToConsumption(tenantId, materialRequirementId);
  }

  traceConsumptionToOutput(tenantId: TenantId, materialConsumptionId: string) {
    return this.dependencies.traces.traceConsumptionToOutput(tenantId, materialConsumptionId);
  }

  traceOutputToInventoryMovement(tenantId: TenantId, productionOutputId: string) {
    return this.dependencies.traces.traceOutputToInventoryMovement(tenantId, productionOutputId);
  }

  traceLotOrSerialToWorkOrder(tenantId: TenantId, lotOrSerialId: string) {
    return this.dependencies.traces.traceLotOrSerialToWorkOrder(tenantId, lotOrSerialId);
  }

  traceMachineToExecution(tenantId: TenantId, machineAssetId: string) {
    return this.dependencies.traces.traceMachineToExecution(tenantId, machineAssetId);
  }

  traceLaborToExecution(tenantId: TenantId, laborReferenceId: string) {
    return this.dependencies.traces.traceLaborToExecution(tenantId, laborReferenceId);
  }
}
