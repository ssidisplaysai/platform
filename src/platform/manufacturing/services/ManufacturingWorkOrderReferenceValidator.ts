import type { TenantId } from "../contracts";
import type { ManufacturingRuntimeMetadataProvider } from "../integration";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";

export type ManufacturingWorkOrderLifecycleUsability =
  | "EXECUTION_USABLE"
  | "READ_ONLY_ONLY"
  | "NOT_FOUND"
  | "TENANT_MISMATCH";

export type ManufacturingWorkOrderReferenceValidationResult = Readonly<{
  valid: boolean;
  workOrderId: string;
  tenantCompatible: boolean;
  lifecycleUsability: ManufacturingWorkOrderLifecycleUsability;
  reasonCode: string;
  reason: string;
  version?: number;
  workOrderState?: string;
  referenceMetadata: Readonly<{
    contractVersion: string;
  }>;
}>;

export class ManufacturingWorkOrderReferenceValidator {
  constructor(
    private readonly dependencies: {
      metadata: ManufacturingRuntimeMetadataProvider;
      workOrders: ManufacturingWorkOrderService;
    },
  ) {}

  validateManufacturingWorkOrderReference(input: {
    tenantId: TenantId;
    workOrderId: string;
  }): ManufacturingWorkOrderReferenceValidationResult {
    const contractVersion = this.dependencies.metadata.getRuntimeMetadata().contractVersion;
    const identity = this.dependencies.workOrders.peekWorkOrderIdentity(input.workOrderId);

    if (identity && identity.tenantId !== input.tenantId) {
      return {
        valid: false,
        workOrderId: input.workOrderId,
        tenantCompatible: false,
        lifecycleUsability: "TENANT_MISMATCH",
        reasonCode: "REFERENCE_TENANT_MISMATCH",
        reason: "work order exists but belongs to a different tenant",
        referenceMetadata: {
          contractVersion,
        },
      };
    }

    const workOrderRecord = this.dependencies.workOrders.getWorkOrder(input.tenantId, input.workOrderId);

    if (!workOrderRecord) {
      return {
        valid: false,
        workOrderId: input.workOrderId,
        tenantCompatible: false,
        lifecycleUsability: "NOT_FOUND",
        reasonCode: "WORK_ORDER_REFERENCE_INVALID",
        reason: "work order reference not found for tenant",
        referenceMetadata: {
          contractVersion,
        },
      };
    }

    const state = workOrderRecord.workOrder.workOrderState;
    const terminal = state === "CANCELLED" || state === "CLOSED";

    return {
      valid: true,
      workOrderId: workOrderRecord.workOrder.manufacturingWorkOrderId,
      tenantCompatible: true,
      lifecycleUsability: terminal ? "READ_ONLY_ONLY" : "EXECUTION_USABLE",
      reasonCode: terminal ? "WORK_ORDER_CLOSED_OR_CANCELLED" : "WORK_ORDER_REFERENCE_VALID",
      reason: terminal
        ? "work order exists but lifecycle is closed for execution"
        : "work order exists and is usable",
      version: workOrderRecord.workOrder.version,
      workOrderState: state,
      referenceMetadata: {
        contractVersion,
      },
    };
  }
}
