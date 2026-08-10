import { compareDeterministicStrings } from "../../shared";
import type {
  MaterialConsumptionCommand,
  MaterialConsumptionExecutionRecord,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
  ManufacturingIdentifierProvider,
} from "../integration";
import type { ManufacturingInventoryIntegrationService } from "./ManufacturingInventoryIntegrationService";
import type { MaterialRequirementService } from "./MaterialRequirementService";
import type { ManufacturingWorkOrderService } from "./ManufacturingWorkOrderService";

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

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: MaterialConsumptionExecutionRecord;
}>;

export class MaterialConsumptionService {
  private readonly byId = new Map<string, MaterialConsumptionExecutionRecord>();
  private readonly byRequirement = new Map<string, string[]>();
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      identifier: ManufacturingIdentifierProvider;
      audit: ManufacturingAuditSinkProvider;
      workOrders: ManufacturingWorkOrderService;
      materials: MaterialRequirementService;
      inventory: ManufacturingInventoryIntegrationService;
    },
  ) {}

  async recordConsumption(command: MaterialConsumptionCommand): Promise<MaterialConsumptionExecutionRecord> {
    const storageKey = `${command.tenantId}:MAT_CONSUME:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(storageKey);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      return structuredClone(replay.result);
    }

    this.dependencies.workOrders.require(command.tenantId, command.workOrderId);
    const requirement = this.dependencies.materials.getMaterialRequirement(command.tenantId, command.materialRequirementId as string);
    if (!requirement) {
      throw new ManufacturingDomainError("INVALID_MATERIAL_REQUIREMENT", "material requirement was not found", false);
    }

    if (command.inventoryMovementId) {
      await this.dependencies.inventory.validateInventoryMovement({
        tenantId: command.tenantId,
        inventoryMovementId: command.inventoryMovementId,
      });
    }
    if (command.lotId) {
      await this.dependencies.inventory.validateLot({
        tenantId: command.tenantId,
        lotId: command.lotId,
      });
    }
    if (command.serialId) {
      await this.dependencies.inventory.validateSerial({
        tenantId: command.tenantId,
        serialId: command.serialId,
      });
    }

    const updatedRequirement = this.dependencies.materials.applyConsumedQuantity({
      tenantId: command.tenantId,
      materialRequirementId: command.materialRequirementId,
      quantity: command.consumedQuantity,
      unitOfMeasure: command.unitOfMeasure,
      allowOverConsumption: command.allowOverConsumption,
    });

    const record: MaterialConsumptionExecutionRecord = {
      materialConsumptionId: this.dependencies.identifier.createIdentifier("material-consumption") as MaterialConsumptionExecutionRecord["materialConsumptionId"],
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      operationExecutionId: command.operationExecutionId,
      materialRequirementId: command.materialRequirementId,
      consumedQuantity: command.consumedQuantity,
      unitOfMeasure: command.unitOfMeasure,
      inventoryMovementId: command.inventoryMovementId,
      lotId: command.lotId,
      serialId: command.serialId,
      status: "RECORDED",
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
      metadata: command.metadata,
      recordedAt: this.dependencies.clock.now(),
      version: updatedRequirement.version,
    };

    this.byId.set(record.materialConsumptionId as string, record);
    const requirementKey = `${record.tenantId}:${record.materialRequirementId}`;
    const ids = this.byRequirement.get(requirementKey) ?? [];
    this.byRequirement.set(requirementKey, [...ids, record.materialConsumptionId as string]);
    this.idempotency.set(storageKey, {
      payloadFingerprint,
      result: structuredClone(record),
    });

    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.material-consumption",
      message: "Material consumption recorded.",
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        materialRequirementId: command.materialRequirementId,
        operationExecutionId: command.operationExecutionId,
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
      },
    });

    return structuredClone(record);
  }

  listConsumptionRecordsByRequirement(tenantId: TenantId, materialRequirementId: string): MaterialConsumptionExecutionRecord[] {
    const key = `${tenantId}:${materialRequirementId}`;
    const ids = this.byRequirement.get(key) ?? [];
    return ids
      .map((id) => this.byId.get(id))
      .filter((entry): entry is MaterialConsumptionExecutionRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }
}
