import type { OperationLifecycleState, TenantId } from "../contracts";
import type { ExecutionRoutingService } from "../services/ExecutionRoutingService";
import type { OperationExecutionService } from "../services/OperationExecutionService";

export type RoutingProgressProjection = Readonly<{
  totalSteps: number;
  eligibleSteps: number;
  completedSteps: number;
  skippedSteps: number;
  blockedSteps: number;
  activeOperationId?: string;
  routeComplete: boolean;
  completionPercentage: number;
}>;

export class ManufacturingRoutingQueryService {
  constructor(
    private readonly dependencies: {
      routings: ExecutionRoutingService;
      operations: OperationExecutionService;
    },
  ) {}

  getExecutionRouting(tenantId: TenantId, executionRoutingId: string) {
    return this.dependencies.routings.getExecutionRouting(tenantId, executionRoutingId);
  }

  listExecutionRoutings(tenantId: TenantId) {
    return this.dependencies.routings.listExecutionRoutings(tenantId);
  }

  getRoutingStep(tenantId: TenantId, executionRoutingId: string, routingStepId: string) {
    return this.dependencies.routings
      .getExecutionRouting(tenantId, executionRoutingId)
      ?.routing.steps.find((step) => step.routingStepId === routingStepId);
  }

  listRoutingSteps(tenantId: TenantId, executionRoutingId: string) {
    const routing = this.dependencies.routings.getExecutionRouting(tenantId, executionRoutingId);
    if (!routing) {
      return [];
    }

    const byStepId = new Map(routing.routing.steps.map((step) => [step.routingStepId, step]));
    return routing.orderedStepIds.map((stepId) => structuredClone(byStepId.get(stepId)!));
  }

  getOperationExecution(tenantId: TenantId, operationExecutionId: string) {
    return this.dependencies.operations.getOperationExecution(tenantId, operationExecutionId);
  }

  listOperationsByWorkOrder(tenantId: TenantId, workOrderId: string) {
    return this.dependencies.operations.listOperationsByWorkOrder(tenantId, workOrderId);
  }

  listOperationsByRouting(tenantId: TenantId, executionRoutingId: string) {
    return this.dependencies.operations.listOperationsByRouting(tenantId, executionRoutingId);
  }

  listOperationsByStatus(tenantId: TenantId, executionRoutingId: string, status: OperationLifecycleState) {
    return this.dependencies.operations.listOperationsByStatus(tenantId, executionRoutingId, status);
  }

  getOperationEligibility(tenantId: TenantId, operationExecutionId: string) {
    return this.dependencies.operations.getOperationEligibility(tenantId, operationExecutionId);
  }

  getNextEligibleOperations(tenantId: TenantId, executionRoutingId: string) {
    return this.dependencies.operations.getNextEligibleOperations(tenantId, executionRoutingId);
  }

  getRoutingProgress(tenantId: TenantId, executionRoutingId: string): RoutingProgressProjection {
    const operations = this.dependencies.operations.listOperationsByRouting(tenantId, executionRoutingId);

    const totalSteps = operations.length;
    const completedSteps = operations.filter((item) => item.execution.operationState === "COMPLETED" || item.execution.operationState === "CLOSED").length;
    const skippedSteps = operations.filter((item) => item.execution.operationState === "SKIPPED").length;
    const blockedSteps = operations.filter((item) => item.execution.operationState === "BLOCKED").length;
    const eligibleSteps = operations.filter((item) => item.execution.eligibility === "ELIGIBLE").length;
    const active = operations.find((item) => item.execution.operationState === "IN_PROGRESS");
    const completeCount = completedSteps + skippedSteps;
    const completionPercentage = totalSteps === 0 ? 0 : Math.floor((completeCount / totalSteps) * 10000) / 100;

    return {
      totalSteps,
      eligibleSteps,
      completedSteps,
      skippedSteps,
      blockedSteps,
      activeOperationId: active?.execution.operationExecutionId,
      routeComplete: totalSteps > 0 && completeCount === totalSteps,
      completionPercentage,
    };
  }
}
