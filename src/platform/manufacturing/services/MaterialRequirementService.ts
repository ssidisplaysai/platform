import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ManufacturingFailureClassification,
  ManufacturingWorkOrder,
  MaterialRequirementExecutionRecord,
  ProductReference,
  RequiredMaterialQuantity,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type { ManufacturingAuditSinkProvider, ManufacturingClockProvider, ManufacturingIdentifierProvider } from "../integration";
import type { ExecutionRoutingService } from "./ExecutionRoutingService";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";

export type MaterialRequirementBomLine = Readonly<{
  bomLineId: string;
  componentProductRef?: ProductReference;
  inventoryItemRef: Readonly<{ tenantId: TenantId; inventoryItemId: string }>;
  quantityPerUnit: number;
  unitOfMeasure: string;
  requiredByRoutingStepId?: string;
}>;

export type DeriveMaterialRequirementsCommand = Readonly<{
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
  expectedWorkOrderVersion: number;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
  bomLines: readonly MaterialRequirementBomLine[];
}>;

export type MaterialRequirementDerivationResult = Readonly<{
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
  requirements: readonly MaterialRequirementExecutionRecord[];
  workOrderVersion: number;
}>;

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: MaterialRequirementDerivationResult;
}>;

function stableJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => stableJson(entry));
  }
  if (value && typeof value === "object") {
    const normalized: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort((left, right) => compareDeterministicStrings(left, right))) {
      normalized[key] = stableJson((value as Record<string, unknown>)[key]);
    }
    return normalized;
  }
  return value;
}

function createFingerprint(payload: unknown): string {
  return JSON.stringify(stableJson(payload));
}

function computeRequiredQuantity(plannedQuantity: number, quantityPerUnit: number): number {
  return Math.round(plannedQuantity * quantityPerUnit * 1_000_000) / 1_000_000;
}

function cloneResult(result: MaterialRequirementDerivationResult): MaterialRequirementDerivationResult {
  return structuredClone(result);
}

export class MaterialRequirementService {
  private readonly byId = new Map<string, MaterialRequirementExecutionRecord>();
  private readonly byTenantWorkOrder = new Map<string, string[]>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      identifier: ManufacturingIdentifierProvider;
      audit: ManufacturingAuditSinkProvider;
      workOrders: ManufacturingWorkOrderService;
      routings: ExecutionRoutingService;
    },
  ) {}

  async deriveMaterialRequirements(command: DeriveMaterialRequirementsCommand): Promise<MaterialRequirementDerivationResult> {
    const key = `${command.tenantId}:MATERIAL_DERIVE:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        await this.audit("CONFLICTING_IDEMPOTENCY_PAYLOAD", "Material derivation rejected due to conflicting idempotency payload.", command);
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit("DUPLICATE_OPERATION_COMMAND", "Material derivation replay accepted.", command);
      return cloneResult(replay.result);
    }

    const workOrder = this.dependencies.workOrders.require(command.tenantId, command.workOrderId);
    if (workOrder.productBaselineState !== "FROZEN") {
      throw new ManufacturingDomainError("PRODUCT_BASELINE_NOT_READY", "product baseline must be frozen before deriving material requirements", false);
    }
    if (workOrder.workOrder.version !== command.expectedWorkOrderVersion) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected version: expected ${command.expectedWorkOrderVersion}, current ${workOrder.workOrder.version}`,
        false,
      );
    }
    if (command.bomLines.length === 0) {
      throw new ManufacturingDomainError("MATERIAL_REQUIREMENT_DERIVATION_FAILURE", "at least one BOM line is required", false);
    }

    const routing = workOrder.workOrder.executionRoutingId
      ? this.dependencies.routings.getExecutionRouting(command.tenantId, workOrder.workOrder.executionRoutingId)
      : undefined;
    const routingStepIds = new Set((routing?.routing.steps ?? []).map((step) => step.routingStepId));

    const duplicateKeys = new Set<string>();
    const seenKeys = new Set<string>();
    const derived: MaterialRequirementExecutionRecord[] = [];

    for (const line of deterministicSort(command.bomLines, (entry) => `${entry.bomLineId}:${entry.requiredByRoutingStepId ?? ""}`)) {
      if (line.inventoryItemRef.tenantId !== command.tenantId) {
        throw new ManufacturingDomainError("TENANT_MISMATCH", "inventory item reference tenant mismatch", false);
      }
      if (line.componentProductRef && line.componentProductRef.tenantId !== command.tenantId) {
        throw new ManufacturingDomainError("TENANT_MISMATCH", "component product reference tenant mismatch", false);
      }
      if (!Number.isFinite(line.quantityPerUnit) || line.quantityPerUnit <= 0) {
        throw new ManufacturingDomainError("INVALID_REQUIREMENT_QUANTITY", "BOM line quantityPerUnit must be greater than zero", false);
      }
      if (!line.unitOfMeasure || line.unitOfMeasure.trim().length === 0) {
        throw new ManufacturingDomainError("INVALID_REQUIREMENT_UOM", "BOM line unitOfMeasure is required", false);
      }
      if (line.requiredByRoutingStepId && !routingStepIds.has(line.requiredByRoutingStepId)) {
        throw new ManufacturingDomainError(
          "INVALID_REQUIREMENT_OPERATION_REFERENCE",
          `BOM line references unknown routing step: ${line.requiredByRoutingStepId}`,
          false,
        );
      }

      const uniquenessKey = `${line.bomLineId}:${line.requiredByRoutingStepId ?? ""}`;
      if (seenKeys.has(uniquenessKey)) {
        duplicateKeys.add(uniquenessKey);
        continue;
      }
      seenKeys.add(uniquenessKey);

      const requiredValue = computeRequiredQuantity(workOrder.workOrder.plannedQuantity.value, line.quantityPerUnit);
      const requiredQuantity = {
        value: requiredValue,
        unitOfMeasure: line.unitOfMeasure,
      } as RequiredMaterialQuantity;

      const operation = line.requiredByRoutingStepId
        ? routing?.routing.steps.find((step) => step.routingStepId === line.requiredByRoutingStepId)
        : undefined;

      derived.push({
        materialRequirementId: this.dependencies.identifier.createIdentifier("material-requirement") as MaterialRequirementExecutionRecord["materialRequirementId"],
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        bomId: workOrder.workOrder.productBomRef.productBomId,
        bomVersion: workOrder.workOrder.productBomRef.bomVersion,
        bomLineId: line.bomLineId as MaterialRequirementExecutionRecord["bomLineId"],
        componentProductRef: line.componentProductRef,
        inventoryItemRef: {
          tenantId: command.tenantId,
          inventoryItemId: line.inventoryItemRef.inventoryItemId as MaterialRequirementExecutionRecord["inventoryItemRef"]["inventoryItemId"],
        },
        requiredQuantity,
        issuedQuantity: {
          value: 0,
          unitOfMeasure: requiredQuantity.unitOfMeasure,
        } as MaterialRequirementExecutionRecord["issuedQuantity"],
        consumedQuantity: {
          value: 0,
          unitOfMeasure: requiredQuantity.unitOfMeasure,
        } as MaterialRequirementExecutionRecord["consumedQuantity"],
        returnedQuantity: {
          value: 0,
          unitOfMeasure: requiredQuantity.unitOfMeasure,
        } as MaterialRequirementExecutionRecord["returnedQuantity"],
        unitOfMeasure: requiredQuantity.unitOfMeasure,
        requiredByOperationId: operation?.operationExecutionId,
        requiredByRoutingStepId: line.requiredByRoutingStepId as MaterialRequirementExecutionRecord["requiredByRoutingStepId"],
        status: "PLANNED",
        correlationId: command.correlationId,
        version: 1,
      });
    }

    if (duplicateKeys.size > 0) {
      throw new ManufacturingDomainError(
        "DUPLICATE_MATERIAL_REQUIREMENT",
        `duplicate material requirement keys: ${[...duplicateKeys].sort(compareDeterministicStrings).join(",")}`,
        false,
      );
    }

    const sorted = deterministicSort(derived, (item) => item.materialRequirementId);
    const byWorkOrderKey = `${command.tenantId}:${command.workOrderId}`;
    const existingIds = this.byTenantWorkOrder.get(byWorkOrderKey) ?? [];
    for (const requirement of sorted) {
      this.byId.set(requirement.materialRequirementId as string, requirement);
      existingIds.push(requirement.materialRequirementId as string);
    }
    this.byTenantWorkOrder.set(byWorkOrderKey, [...new Set(existingIds)].sort(compareDeterministicStrings));

    const updatedWorkOrder = this.dependencies.workOrders.setMaterialRequirementModelReadiness({
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      expectedVersion: command.expectedWorkOrderVersion,
      requirementsReady: true,
      inventoryMaterialsReady: workOrder.readiness.inventoryMaterialsReady,
    });

    const result: MaterialRequirementDerivationResult = {
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      requirements: sorted,
      workOrderVersion: updatedWorkOrder.workOrder.version,
    };

    this.idempotency.set(key, {
      payloadFingerprint,
      result: cloneResult(result),
    });

    await this.audit("INVALID_COMMAND", "Material requirements derived.", command);
    return result;
  }

  getMaterialRequirement(tenantId: TenantId, materialRequirementId: string): MaterialRequirementExecutionRecord | undefined {
    const found = this.byId.get(materialRequirementId);
    if (!found || found.tenantId !== tenantId) {
      return undefined;
    }
    return structuredClone(found);
  }

  listMaterialRequirements(tenantId: TenantId, workOrderId?: string): MaterialRequirementExecutionRecord[] {
    if (!workOrderId) {
      return deterministicSort(
        [...this.byId.values()].filter((entry) => entry.tenantId === tenantId),
        (entry) => entry.materialRequirementId,
      ).map((entry) => structuredClone(entry));
    }

    const ids = this.byTenantWorkOrder.get(`${tenantId}:${workOrderId}`) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is MaterialRequirementExecutionRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  private async audit(
    classification: ManufacturingFailureClassification,
    message: string,
    command: { tenantId: TenantId; idempotencyKey: IdempotencyKey; correlationId: CorrelationIdentifier; workOrderId: string },
  ): Promise<void> {
    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.material-requirement",
      message,
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        action: message,
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
        classification,
      },
    });
  }
}