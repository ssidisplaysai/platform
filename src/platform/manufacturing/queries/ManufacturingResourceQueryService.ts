import type { TenantId } from "../contracts";
import type { DowntimeService } from "../services/DowntimeService";
import type { ExecutionExceptionService } from "../services/ExecutionExceptionService";
import type { LaborAssignmentService } from "../services/LaborAssignmentService";
import type { MachineAssignmentService } from "../services/MachineAssignmentService";
import type { ProductionCellService } from "../services/ProductionCellService";
import type { ResourceReadinessService } from "../services/ResourceReadinessService";
import type { ToolAssignmentService } from "../services/ToolAssignmentService";
import type { WorkCenterService } from "../services/WorkCenterService";

export class ManufacturingResourceQueryService {
  constructor(
    private readonly dependencies: {
      workCenters: WorkCenterService;
      productionCells: ProductionCellService;
      machineAssignments: MachineAssignmentService;
      toolAssignments: ToolAssignmentService;
      laborAssignments: LaborAssignmentService;
      readiness: ResourceReadinessService;
      downtime: DowntimeService;
      exceptions: ExecutionExceptionService;
    },
  ) {}

  getWorkCenter(tenantId: TenantId, workCenterId: string) {
    return this.dependencies.workCenters.getWorkCenter(tenantId, workCenterId);
  }

  listWorkCenters(tenantId: TenantId) {
    return this.dependencies.workCenters.listWorkCenters(tenantId);
  }

  getProductionCell(tenantId: TenantId, productionCellId: string) {
    return this.dependencies.productionCells.getProductionCell(tenantId, productionCellId);
  }

  listProductionCells(tenantId: TenantId) {
    return this.dependencies.productionCells.listProductionCells(tenantId);
  }

  getMachineAssignment(tenantId: TenantId, machineAssignmentId: string) {
    return this.dependencies.machineAssignments.getMachineAssignment(tenantId, machineAssignmentId);
  }

  listMachineAssignments(tenantId: TenantId) {
    return this.dependencies.machineAssignments.listMachineAssignments(tenantId);
  }

  listMachineAssignmentsByOperation(tenantId: TenantId, operationExecutionId: string) {
    return this.dependencies.machineAssignments.listMachineAssignmentsByOperation(tenantId, operationExecutionId);
  }

  getToolAssignment(tenantId: TenantId, toolAssignmentId: string) {
    return this.dependencies.toolAssignments.getToolAssignment(tenantId, toolAssignmentId);
  }

  listToolAssignmentsByOperation(tenantId: TenantId, operationExecutionId: string) {
    return this.dependencies.toolAssignments.listToolAssignmentsByOperation(tenantId, operationExecutionId);
  }

  getLaborAssignment(tenantId: TenantId, laborAssignmentId: string) {
    return this.dependencies.laborAssignments.getLaborAssignment(tenantId, laborAssignmentId);
  }

  listLaborAssignmentsByOperation(tenantId: TenantId, operationExecutionId: string) {
    return this.dependencies.laborAssignments.listLaborAssignmentsByOperation(tenantId, operationExecutionId);
  }

  getResourceReadiness(tenantId: TenantId, workOrderId: string) {
    return this.dependencies.readiness.evaluateReadiness(tenantId, workOrderId);
  }

  getDowntime(tenantId: TenantId, downtimeRecordId: string) {
    return this.dependencies.downtime.getDowntime(tenantId, downtimeRecordId);
  }

  listDowntimeByWorkOrder(tenantId: TenantId, workOrderId: string) {
    return this.dependencies.downtime.listDowntimeByWorkOrder(tenantId, workOrderId);
  }

  listDowntimeByOperation(tenantId: TenantId, operationExecutionId: string) {
    return this.dependencies.downtime.listDowntimeByOperation(tenantId, operationExecutionId);
  }

  getExecutionException(tenantId: TenantId, executionExceptionId: string) {
    return this.dependencies.exceptions.getExecutionException(tenantId, executionExceptionId);
  }

  listExecutionExceptions(tenantId: TenantId) {
    return this.dependencies.exceptions.listExecutionExceptions(tenantId);
  }

  listOpenExecutionExceptions(tenantId: TenantId) {
    return this.dependencies.exceptions.listOpenExecutionExceptions(tenantId);
  }
}
