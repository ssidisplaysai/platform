import type { TenantId } from "../contracts";
import type { MaterialRequirementService } from "../services/MaterialRequirementService";
import type { ManufacturingWorkOrderService } from "../services/ManufacturingWorkOrderService";

export type MaterialReadinessProjection = Readonly<{
  workOrderId: string;
  requirementsReady: boolean;
  inventoryMaterialsReady: boolean;
  materialsReady: boolean;
  requirementCount: number;
}>;

export class ManufacturingMaterialQueryService {
  constructor(
    private readonly dependencies: {
      materials: MaterialRequirementService;
      workOrders: ManufacturingWorkOrderService;
    },
  ) {}

  getMaterialRequirement(tenantId: TenantId, materialRequirementId: string) {
    return this.dependencies.materials.getMaterialRequirement(tenantId, materialRequirementId);
  }

  listMaterialRequirements(tenantId: TenantId, workOrderId?: string) {
    return this.dependencies.materials.listMaterialRequirements(tenantId, workOrderId);
  }

  listMaterialRequirementsByRoutingStep(tenantId: TenantId, workOrderId: string, routingStepId: string) {
    return this.dependencies.materials
      .listMaterialRequirements(tenantId, workOrderId)
      .filter((requirement) => requirement.requiredByRoutingStepId === routingStepId);
  }

  listMaterialRequirementsByOperation(tenantId: TenantId, workOrderId: string, operationExecutionId: string) {
    return this.dependencies.materials
      .listMaterialRequirements(tenantId, workOrderId)
      .filter((requirement) => requirement.requiredByOperationId === operationExecutionId);
  }

  getMaterialReadiness(tenantId: TenantId, workOrderId: string): MaterialReadinessProjection {
    const state = this.dependencies.workOrders.getExecutionState(tenantId, workOrderId);
    const requirements = this.dependencies.materials.listMaterialRequirements(tenantId, workOrderId);
    return {
      workOrderId,
      requirementsReady: state.readiness.requirementsReady,
      inventoryMaterialsReady: state.readiness.inventoryMaterialsReady,
      materialsReady: state.readiness.materialsReady,
      requirementCount: requirements.length,
    };
  }
}