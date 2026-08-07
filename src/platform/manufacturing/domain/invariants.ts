import type {
  AssetReference,
  LaborAssignment,
  ManufacturingWorkOrder,
  MaterialRequirement,
  ProductionOutputRecord,
  TenantId,
  WorkInProgressState,
  WorkCenter,
  ProductionCell,
  MachineAssignment,
  ToolAssignment,
} from "../contracts";
import { ManufacturingDomainError } from "./errors";
import { assertImmutableIdentity, assertTenantScope } from "./identifiers";

function assertNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ManufacturingDomainError("INVALID_QUANTITY", `${field} must be a non-negative finite value`, false);
  }
}

function assertSameUnit(label: string, values: Array<{ unitOfMeasure: string }>): void {
  const unique = new Set(values.map((value) => value.unitOfMeasure));
  if (unique.size > 1) {
    throw new ManufacturingDomainError("INVALID_QUANTITY", `${label} must use a consistent unit of measure`, false);
  }
}

export function assertWorkOrderInvariants(workOrder: ManufacturingWorkOrder): void {
  assertImmutableIdentity(workOrder.manufacturingWorkOrderId, workOrder.manufacturingWorkOrderId, "workOrderId");

  const quantities = [
    workOrder.requestedQuantity,
    workOrder.plannedQuantity,
    workOrder.completedQuantity,
    workOrder.rejectedQuantity,
    workOrder.scrapQuantity,
    workOrder.reworkQuantity,
  ];

  for (const quantity of quantities) {
    assertNonNegative(quantity.value, "workOrder.quantity");
  }

  assertSameUnit("work-order quantities", quantities);

  if (!workOrder.productRef.productId || !workOrder.productVersionRef.productVersionId || !workOrder.productBomRef.productBomId) {
    throw new ManufacturingDomainError("INVALID_EXTERNAL_REFERENCE", "work order requires valid Product and BOM references", false);
  }

  if (workOrder.externalDemandRef) {
    assertTenantScope(workOrder.tenantId, [workOrder.externalDemandRef.tenantId]);
  }

  if (workOrder.productRef.tenantId !== workOrder.tenantId || workOrder.productVersionRef.tenantId !== workOrder.tenantId) {
    throw new ManufacturingDomainError("TENANT_MISMATCH", "product references must match work order tenant", false);
  }

  if (workOrder.productBomRef.tenantId !== workOrder.tenantId) {
    throw new ManufacturingDomainError("TENANT_MISMATCH", "BOM reference must match work order tenant", false);
  }

  if (workOrder.completedQuantity.value + workOrder.rejectedQuantity.value + workOrder.scrapQuantity.value > workOrder.plannedQuantity.value) {
    throw new ManufacturingDomainError("INVALID_QUANTITY", "completed, rejected, and scrap quantities cannot exceed planned quantity", false);
  }
}

export function assertMaterialRequirementInvariants(requirement: MaterialRequirement): void {
  assertImmutableIdentity(requirement.materialRequirementId, requirement.materialRequirementId, "materialRequirementId");

  const quantities = [
    requirement.requiredQuantity,
    requirement.issuedQuantity,
    requirement.consumedQuantity,
    requirement.returnedQuantity,
  ];

  for (const quantity of quantities) {
    assertNonNegative(quantity.value, "material.quantity");
  }

  assertSameUnit("material quantities", quantities);

  if (requirement.productVersionRef.tenantId !== requirement.tenantId || requirement.productBomRef.tenantId !== requirement.tenantId) {
    throw new ManufacturingDomainError("TENANT_MISMATCH", "material requirement Product references must match tenant", false);
  }

  if (requirement.inventoryItemRef.tenantId !== requirement.tenantId) {
    throw new ManufacturingDomainError("TENANT_MISMATCH", "material requirement Inventory item reference must match tenant", false);
  }
}

export function assertOutputInvariants(output: ProductionOutputRecord): void {
  assertImmutableIdentity(output.productionOutputId, output.productionOutputId, "productionOutputId");
  assertNonNegative(output.quantity.value, "output.quantity");

  if (!output.productRef.productId) {
    throw new ManufacturingDomainError("INVALID_OUTPUT", "output requires Product reference", false);
  }

  if (output.productRef.tenantId !== output.tenantId) {
    throw new ManufacturingDomainError("TENANT_MISMATCH", "output Product reference must match tenant", false);
  }

  if (output.inventoryMovementRef && output.inventoryMovementRef.tenantId !== output.tenantId) {
    throw new ManufacturingDomainError("TENANT_MISMATCH", "output Inventory movement reference must match tenant", false);
  }
}

export function assertWipInvariants(wip: WorkInProgressState): void {
  assertImmutableIdentity(wip.wipStateId, wip.wipStateId, "wipStateId");

  assertNonNegative(wip.quantityWaiting.value, "wip.quantityWaiting");
  assertNonNegative(wip.quantityInProcess.value, "wip.quantityInProcess");
  assertNonNegative(wip.quantityCompleted.value, "wip.quantityCompleted");
  assertNonNegative(wip.quantityRejected.value, "wip.quantityRejected");

  assertSameUnit("wip quantities", [wip.quantityWaiting, wip.quantityInProcess, wip.quantityCompleted, wip.quantityRejected]);
}

export function assertResourceInvariants(input: {
  workCenter?: WorkCenter;
  productionCell?: ProductionCell;
  machineAssignment?: MachineAssignment;
  toolAssignment?: ToolAssignment;
  laborAssignment?: LaborAssignment;
}): void {
  const tenants: TenantId[] = [];
  if (input.workCenter) {
    tenants.push(input.workCenter.tenantId);
  }
  if (input.productionCell) {
    tenants.push(input.productionCell.tenantId);
  }
  if (input.machineAssignment) {
    tenants.push(input.machineAssignment.tenantId);
    assertAssetReference(input.machineAssignment.machineRef, input.machineAssignment.tenantId);
  }
  if (input.toolAssignment) {
    tenants.push(input.toolAssignment.tenantId);
    assertAssetReference(input.toolAssignment.toolRef, input.toolAssignment.tenantId);
  }
  if (input.laborAssignment) {
    tenants.push(input.laborAssignment.tenantId);
    if (input.laborAssignment.laborRef.tenantId !== input.laborAssignment.tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "labor reference must match assignment tenant", false);
    }
  }
  if (tenants.length > 1) {
    const baseline = tenants[0];
    assertTenantScope(baseline, tenants);
  }
}

function assertAssetReference(reference: AssetReference, tenantId: TenantId): void {
  if (reference.tenantId !== tenantId) {
    throw new ManufacturingDomainError("TENANT_MISMATCH", "asset reference tenant mismatch", false);
  }
}
