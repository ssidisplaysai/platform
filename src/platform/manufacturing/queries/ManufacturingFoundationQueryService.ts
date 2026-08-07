import type { TenantId, WorkOrderLifecycleState } from "../contracts";
import type {
  ManufacturingWorkOrderRecord,
  WorkOrderExecutionStateProjection,
} from "../services/ManufacturingWorkOrderService";
import type { ProductionRunRecord } from "../services/ProductionRunService";
import type { ProductionBatchRecord } from "../services/ProductionBatchService";
import type { ManufacturingWorkOrderService } from "../services/ManufacturingWorkOrderService";
import type { ProductionRunService } from "../services/ProductionRunService";
import type { ProductionBatchService } from "../services/ProductionBatchService";

export class ManufacturingFoundationQueryService {
  constructor(
    private readonly dependencies: {
      workOrders: ManufacturingWorkOrderService;
      runs: ProductionRunService;
      batches: ProductionBatchService;
    },
  ) {}

  getManufacturingWorkOrder(tenantId: TenantId, workOrderId: string): ManufacturingWorkOrderRecord | undefined {
    return this.dependencies.workOrders.getWorkOrder(tenantId, workOrderId);
  }

  listManufacturingWorkOrders(tenantId: TenantId): ManufacturingWorkOrderRecord[] {
    return this.dependencies.workOrders.listWorkOrders(tenantId);
  }

  listWorkOrdersByProduct(tenantId: TenantId, productId: string): ManufacturingWorkOrderRecord[] {
    return this.dependencies.workOrders.listWorkOrdersByProduct(tenantId, productId);
  }

  listWorkOrdersByStatus(tenantId: TenantId, status: WorkOrderLifecycleState): ManufacturingWorkOrderRecord[] {
    return this.dependencies.workOrders.listWorkOrdersByStatus(tenantId, status);
  }

  getProductionRun(tenantId: TenantId, runId: string): ProductionRunRecord | undefined {
    return this.dependencies.runs.getProductionRun(tenantId, runId);
  }

  listProductionRuns(tenantId: TenantId): ProductionRunRecord[] {
    return this.dependencies.runs.listProductionRuns(tenantId);
  }

  listProductionRunsByWorkOrder(tenantId: TenantId, workOrderId: string): ProductionRunRecord[] {
    return this.dependencies.runs.listProductionRunsByWorkOrder(tenantId, workOrderId);
  }

  getProductionBatch(tenantId: TenantId, batchId: string): ProductionBatchRecord | undefined {
    return this.dependencies.batches.getProductionBatch(tenantId, batchId);
  }

  listProductionBatches(tenantId: TenantId): ProductionBatchRecord[] {
    return this.dependencies.batches.listProductionBatches(tenantId);
  }

  listProductionBatchesByWorkOrder(tenantId: TenantId, workOrderId: string): ProductionBatchRecord[] {
    return this.dependencies.batches.listProductionBatchesByWorkOrder(tenantId, workOrderId);
  }

  listProductionBatchesByRun(tenantId: TenantId, runId: string): ProductionBatchRecord[] {
    return this.dependencies.batches.listProductionBatchesByRun(tenantId, runId);
  }

  getWorkOrderExecutionState(tenantId: TenantId, workOrderId: string): WorkOrderExecutionStateProjection {
    return this.dependencies.workOrders.getExecutionState(tenantId, workOrderId);
  }
}
