import { compareDeterministicStrings } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  MaterialIssueCommand,
  MaterialIssueExecutionRecord,
  MaterialReturnCommand,
  MaterialReturnExecutionRecord,
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

type StoredIssueIdempotency = Readonly<{
  payloadFingerprint: string;
  result: MaterialIssueExecutionRecord;
}>;

type StoredReturnIdempotency = Readonly<{
  payloadFingerprint: string;
  result: MaterialReturnExecutionRecord;
}>;

export class MaterialIssueService {
  private readonly issueById = new Map<string, MaterialIssueExecutionRecord>();
  private readonly issueByRequirement = new Map<string, string[]>();
  private readonly issueIdempotency = new Map<string, StoredIssueIdempotency>();

  private readonly returnById = new Map<string, MaterialReturnExecutionRecord>();
  private readonly returnByRequirement = new Map<string, string[]>();
  private readonly returnIdempotency = new Map<string, StoredReturnIdempotency>();

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

  async issueMaterial(command: MaterialIssueCommand): Promise<MaterialIssueExecutionRecord> {
    const idempotencyStorageKey = this.createIdempotencyStorageKey(command.tenantId, "MAT_ISSUE", command.idempotencyKey);
    const payloadFingerprint = createFingerprint(command);
    const replay = this.issueIdempotency.get(idempotencyStorageKey);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      return structuredClone(replay.result);
    }

    const workOrder = this.dependencies.workOrders.require(command.tenantId, command.workOrderId);
    const requirement = this.dependencies.materials.getMaterialRequirement(command.tenantId, command.materialRequirementId as string);
    if (!requirement) {
      throw new ManufacturingDomainError("INVALID_MATERIAL_REQUIREMENT", "material requirement was not found", false);
    }
    if (requirement.workOrderId !== command.workOrderId) {
      throw new ManufacturingDomainError("INVALID_MATERIAL_REQUIREMENT", "material requirement does not belong to work order", false);
    }
    if (
      typeof command.expectedRequirementVersion === "number" &&
      requirement.version !== command.expectedRequirementVersion
    ) {
      throw new ManufacturingDomainError(
        "STALE_EXPECTED_VERSION",
        `stale expected requirement version: expected ${command.expectedRequirementVersion}, current ${requirement.version}`,
        false,
      );
    }

    await this.dependencies.inventory.queryAvailability({
      tenantId: command.tenantId,
      inventoryItemId: command.inventoryItemRef.inventoryItemId as string,
      quantity: command.quantity,
      unitOfMeasure: command.unitOfMeasure,
    });

    const reservationId = await this.dependencies.inventory.requestReservation({
      tenantId: command.tenantId,
      inventoryItemId: command.inventoryItemRef.inventoryItemId as string,
      quantity: command.quantity,
      unitOfMeasure: command.unitOfMeasure,
    });
    this.dependencies.materials.applyReservationReference({
      tenantId: command.tenantId,
      materialRequirementId: command.materialRequirementId,
      reservationId,
    });

    const allocationId = await this.dependencies.inventory.requestAllocation({
      tenantId: command.tenantId,
      reservationId,
    });
    this.dependencies.materials.applyAllocationReference({
      tenantId: command.tenantId,
      materialRequirementId: command.materialRequirementId,
      allocationId,
    });

    const issue = await this.dependencies.inventory.requestMaterialIssue({
      tenantId: command.tenantId,
      inventoryItemId: command.inventoryItemRef.inventoryItemId as string,
      quantity: command.quantity,
      unitOfMeasure: command.unitOfMeasure,
    });

    const issueRecordId = this.dependencies.identifier.createIdentifier("material-issue") as MaterialIssueExecutionRecord["materialIssueRequestId"];

    try {
      const updatedRequirement = this.dependencies.materials.applyIssuedQuantity({
        tenantId: command.tenantId,
        materialRequirementId: command.materialRequirementId,
        quantity: issue.acceptedQuantity,
        unitOfMeasure: command.unitOfMeasure,
      });
      const summary = this.dependencies.materials.getMaterialExecutionSummary(command.tenantId, command.materialRequirementId as string);
      const status = summary.issueStatus === "COMPLETE" ? "ISSUED" : "PARTIALLY_ISSUED";

      const record: MaterialIssueExecutionRecord = {
        materialIssueRequestId: issueRecordId,
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        materialRequirementId: command.materialRequirementId,
        inventoryItemRef: command.inventoryItemRef,
        requestedQuantity: command.quantity,
        acceptedQuantity: issue.acceptedQuantity,
        unitOfMeasure: command.unitOfMeasure,
        status,
        inventoryReferenceId: issue.referenceId,
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
        metadata: command.metadata,
        version: updatedRequirement.version,
      };

      this.storeIssueRecord(record, idempotencyStorageKey, payloadFingerprint);
      await this.audit("Material issue accepted.", command.tenantId, command.workOrderId as string, command.idempotencyKey, command.correlationId, {
        materialRequirementId: command.materialRequirementId,
        inventoryReferenceId: issue.referenceId,
        acceptedQuantity: issue.acceptedQuantity,
      });
      return structuredClone(record);
    } catch (error) {
      const record: MaterialIssueExecutionRecord = {
        materialIssueRequestId: issueRecordId,
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        materialRequirementId: command.materialRequirementId,
        inventoryItemRef: command.inventoryItemRef,
        requestedQuantity: command.quantity,
        acceptedQuantity: issue.acceptedQuantity,
        unitOfMeasure: command.unitOfMeasure,
        status: "RECONCILIATION_REQUIRED",
        inventoryReferenceId: issue.referenceId,
        reason: error instanceof Error ? error.message : "local commit failed",
        reasonCode: "MATERIAL_ISSUE_REQUIRES_RECONCILIATION",
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
        metadata: command.metadata,
        version: requirement.version,
      };
      this.storeIssueRecord(record, idempotencyStorageKey, payloadFingerprint);
      throw new ManufacturingDomainError(
        "MATERIAL_ISSUE_REQUIRES_RECONCILIATION",
        "inventory accepted material issue but local reconciliation failed",
        false,
      );
    }
  }

  async returnMaterial(command: MaterialReturnCommand): Promise<MaterialReturnExecutionRecord> {
    const idempotencyStorageKey = this.createIdempotencyStorageKey(command.tenantId, "MAT_RETURN", command.idempotencyKey);
    const payloadFingerprint = createFingerprint(command);
    const replay = this.returnIdempotency.get(idempotencyStorageKey);
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

    const returnRequest = await this.dependencies.inventory.requestMaterialReturn({
      tenantId: command.tenantId,
      inventoryItemId: command.inventoryItemRef.inventoryItemId as string,
      quantity: command.returnQuantity,
      unitOfMeasure: command.unitOfMeasure,
    });

    const returnRecordId = this.dependencies.identifier.createIdentifier("material-return") as MaterialReturnExecutionRecord["materialIssueRequestId"];

    try {
      const updatedRequirement = this.dependencies.materials.applyReturnedQuantity({
        tenantId: command.tenantId,
        materialRequirementId: command.materialRequirementId,
        quantity: returnRequest.acceptedQuantity,
        unitOfMeasure: command.unitOfMeasure,
      });

      const record: MaterialReturnExecutionRecord = {
        materialIssueRequestId: returnRecordId,
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        materialRequirementId: command.materialRequirementId,
        inventoryItemRef: command.inventoryItemRef,
        returnedQuantity: returnRequest.acceptedQuantity,
        unitOfMeasure: command.unitOfMeasure,
        status: "RETURNED",
        inventoryReferenceId: returnRequest.referenceId,
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
        metadata: command.metadata,
        version: updatedRequirement.version,
      };

      this.storeReturnRecord(record, idempotencyStorageKey, payloadFingerprint);
      return structuredClone(record);
    } catch (error) {
      const record: MaterialReturnExecutionRecord = {
        materialIssueRequestId: returnRecordId,
        tenantId: command.tenantId,
        workOrderId: command.workOrderId,
        materialRequirementId: command.materialRequirementId,
        inventoryItemRef: command.inventoryItemRef,
        returnedQuantity: returnRequest.acceptedQuantity,
        unitOfMeasure: command.unitOfMeasure,
        status: "RECONCILIATION_REQUIRED",
        inventoryReferenceId: returnRequest.referenceId,
        reason: error instanceof Error ? error.message : "local commit failed",
        reasonCode: "MATERIAL_RETURN_REQUIRES_RECONCILIATION",
        idempotencyKey: command.idempotencyKey,
        correlationId: command.correlationId,
        metadata: command.metadata,
        version: requirement.version,
      };
      this.storeReturnRecord(record, idempotencyStorageKey, payloadFingerprint);
      throw new ManufacturingDomainError(
        "MATERIAL_RETURN_REQUIRES_RECONCILIATION",
        "inventory accepted material return but local reconciliation failed",
        false,
      );
    }
  }

  listIssueRecordsByRequirement(tenantId: TenantId, materialRequirementId: string): MaterialIssueExecutionRecord[] {
    const key = `${tenantId}:${materialRequirementId}`;
    const ids = this.issueByRequirement.get(key) ?? [];
    return ids
      .map((id) => this.issueById.get(id))
      .filter((entry): entry is MaterialIssueExecutionRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  listReturnRecordsByRequirement(tenantId: TenantId, materialRequirementId: string): MaterialReturnExecutionRecord[] {
    const key = `${tenantId}:${materialRequirementId}`;
    const ids = this.returnByRequirement.get(key) ?? [];
    return ids
      .map((id) => this.returnById.get(id))
      .filter((entry): entry is MaterialReturnExecutionRecord => Boolean(entry))
      .map((entry) => structuredClone(entry));
  }

  private createIdempotencyStorageKey(tenantId: TenantId, family: string, idempotencyKey: IdempotencyKey): string {
    return `${tenantId}:${family}:${idempotencyKey}`;
  }

  private storeIssueRecord(record: MaterialIssueExecutionRecord, key: string, payloadFingerprint: string): void {
    this.issueById.set(record.materialIssueRequestId as string, record);
    const requirementKey = `${record.tenantId}:${record.materialRequirementId}`;
    const ids = this.issueByRequirement.get(requirementKey) ?? [];
    this.issueByRequirement.set(requirementKey, [...ids, record.materialIssueRequestId as string]);
    this.issueIdempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(record),
    });
  }

  private storeReturnRecord(record: MaterialReturnExecutionRecord, key: string, payloadFingerprint: string): void {
    this.returnById.set(record.materialIssueRequestId as string, record);
    const requirementKey = `${record.tenantId}:${record.materialRequirementId}`;
    const ids = this.returnByRequirement.get(requirementKey) ?? [];
    this.returnByRequirement.set(requirementKey, [...ids, record.materialIssueRequestId as string]);
    this.returnIdempotency.set(key, {
      payloadFingerprint,
      result: structuredClone(record),
    });
  }

  private async audit(
    message: string,
    tenantId: TenantId,
    workOrderId: string,
    idempotencyKey: IdempotencyKey,
    correlationId: CorrelationIdentifier,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.material-issue",
      message,
      recordedAt: this.dependencies.clock.now(),
      details: {
        tenantId,
        workOrderId,
        idempotencyKey,
        correlationId,
        ...details,
      },
    });
  }
}
