import type {
  OperationResourceReadiness,
  ResourceReadinessProjection,
  TenantId,
} from "../contracts";
import type { ExecutionRoutingService } from "./ExecutionRoutingService";
import type { LaborAssignmentService } from "./LaborAssignmentService";
import type { MachineAssignmentService } from "./MachineAssignmentService";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";
import type { OperationExecutionService } from "./OperationExecutionService";
import type { ToolAssignmentService } from "./ToolAssignmentService";

export class ResourceReadinessService {
  constructor(
    private readonly dependencies: {
      workOrders: ManufacturingWorkOrderService;
      routings: ExecutionRoutingService;
      operations: OperationExecutionService;
      machineAssignments: MachineAssignmentService;
      toolAssignments: ToolAssignmentService;
      laborAssignments: LaborAssignmentService;
    },
  ) {}

  evaluateReadiness(tenantId: TenantId, workOrderId: string): ResourceReadinessProjection {
    const workOrder = this.dependencies.workOrders.require(tenantId, workOrderId as never);
    const operations = this.dependencies.operations.listOperationsByWorkOrder(tenantId, workOrderId);
    const routing = workOrder.workOrder.executionRoutingId
      ? this.dependencies.routings.getExecutionRouting(tenantId, workOrder.workOrder.executionRoutingId as string)
      : undefined;

    const operationReadiness: OperationResourceReadiness[] = operations.map((operation) => {
      const step = routing?.routing.steps.find((candidate) => candidate.operationExecutionId === operation.execution.operationExecutionId);
      const conditionInput = step?.conditionalEligibility?.conditionInput as Record<string, unknown> | undefined;

      const requiresWorkCenter = Boolean(step?.requiredWorkCenterRef || conditionInput?.requiresWorkCenter === true);
      const requiresProductionCell = conditionInput?.requiresProductionCell === true;
      const requiresMachine = conditionInput?.requiresMachine === true;
      const requiresTool = conditionInput?.requiresTool === true;
      const requiresLabor = conditionInput?.requiresLabor === true;

      const machineAssignments = this.dependencies.machineAssignments.listMachineAssignmentsByOperation(
        tenantId,
        operation.execution.operationExecutionId as string,
      );
      const toolAssignments = this.dependencies.toolAssignments.listToolAssignmentsByOperation(
        tenantId,
        operation.execution.operationExecutionId as string,
      );
      const laborAssignments = this.dependencies.laborAssignments.listLaborAssignmentsByOperation(
        tenantId,
        operation.execution.operationExecutionId as string,
      );

      const activeMachine = machineAssignments.filter((entry) => entry.status !== "CANCELLED" && entry.status !== "COMPLETED");
      const activeTool = toolAssignments.filter((entry) => entry.status !== "CANCELLED" && entry.status !== "COMPLETED");
      const activeLabor = laborAssignments.filter((entry) => entry.status !== "CANCELLED" && entry.status !== "COMPLETED");

      const hasWorkCenter =
        activeMachine.some((entry) => Boolean(entry.workCenterId)) ||
        activeTool.some((entry) => Boolean(entry.workCenterId)) ||
        activeLabor.some((entry) => Boolean(entry.workCenterId));
      const hasProductionCell =
        activeMachine.some((entry) => Boolean(entry.productionCellId)) ||
        activeTool.some((entry) => Boolean(entry.productionCellId)) ||
        activeLabor.some((entry) => Boolean(entry.productionCellId));
      const hasMachine = activeMachine.length > 0;
      const hasTool = activeTool.length > 0;
      const hasLabor = activeLabor.length > 0;

      const blockingReasons: string[] = [];
      if (requiresWorkCenter && !hasWorkCenter) {
        blockingReasons.push("missing required work center assignment");
      }
      if (requiresProductionCell && !hasProductionCell) {
        blockingReasons.push("missing required production cell assignment");
      }
      if (requiresMachine && !hasMachine) {
        blockingReasons.push("missing required machine assignment");
      }
      if (requiresTool && !hasTool) {
        blockingReasons.push("missing required tool assignment");
      }
      if (requiresLabor && !hasLabor) {
        blockingReasons.push("missing required labor assignment");
      }

      return {
        operationExecutionId: operation.execution.operationExecutionId,
        requiresWorkCenter,
        requiresProductionCell,
        requiresMachine,
        requiresTool,
        requiresLabor,
        hasWorkCenter,
        hasProductionCell,
        hasMachine,
        hasTool,
        hasLabor,
        ready: blockingReasons.length === 0,
        blockingReasons,
      };
    });

    const resourcesReady = operationReadiness.every((entry) => entry.ready);
    return {
      tenantId,
      workOrderId: workOrder.workOrder.manufacturingWorkOrderId,
      resourcesReady,
      executionReady:
        workOrder.readiness.productBaselineReady &&
        workOrder.readiness.routingReady &&
        workOrder.readiness.materialsReady &&
        resourcesReady,
      operationReadiness,
    };
  }

  synchronizeWorkOrderReadiness(tenantId: TenantId, workOrderId: string): ResourceReadinessProjection {
    const projection = this.evaluateReadiness(tenantId, workOrderId);
    const current = this.dependencies.workOrders.require(tenantId, workOrderId as never);
    this.dependencies.workOrders.setExecutionResourceReadiness({
      tenantId,
      workOrderId: current.workOrder.manufacturingWorkOrderId,
      expectedVersion: current.workOrder.version,
      resourcesReady: projection.resourcesReady,
    });

    const refreshed = this.dependencies.workOrders.require(tenantId, workOrderId as never);
    return {
      ...projection,
      executionReady:
        refreshed.readiness.productBaselineReady &&
        refreshed.readiness.routingReady &&
        refreshed.readiness.materialsReady &&
        refreshed.readiness.resourcesReady,
    };
  }

  getOperationReadiness(tenantId: TenantId, workOrderId: string, operationExecutionId: string): OperationResourceReadiness | undefined {
    return this.evaluateReadiness(tenantId, workOrderId).operationReadiness.find(
      (entry) => entry.operationExecutionId === operationExecutionId,
    );
  }
}
