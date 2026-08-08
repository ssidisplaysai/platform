import { compareDeterministicStrings } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ManufacturingFailureClassification,
  ManufacturingWorkOrder,
  ProductBomReference,
  ProductReference,
  ProductVariantReference,
  ProductVersionReference,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
  ManufacturingProductIntegrationPort,
  ManufacturingRuntimeMetadataProvider,
} from "../integration";
import type { ManufacturingWorkOrderService, WorkOrderProductBaselineSnapshot } from "./ManufacturingWorkOrderService";

export type ValidateProductBaselineCommand = Readonly<{
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
  expectedVersion: number;
  productRef: ProductReference;
  productVariantRef?: ProductVariantReference;
  productVersionRef: ProductVersionReference;
  productBomRef: ProductBomReference;
  designRoutingReference?: string;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
}>;

export type FreezeProductBaselineCommand = Readonly<{
  tenantId: TenantId;
  workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
  expectedVersion: number;
  idempotencyKey: IdempotencyKey;
  correlationId: CorrelationIdentifier;
}>;

export type ProductBaselineResult = Readonly<{
  workOrderId: ManufacturingWorkOrder["manufacturingWorkOrderId"];
  tenantId: TenantId;
  baselineState: "VALIDATED" | "FROZEN";
  snapshot: WorkOrderProductBaselineSnapshot;
  version: number;
}>;

type StoredIdempotency = Readonly<{
  payloadFingerprint: string;
  result: ProductBaselineResult;
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

export class ManufacturingProductReferenceService {
  private readonly idempotency = new Map<string, StoredIdempotency>();

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      metadata: ManufacturingRuntimeMetadataProvider;
      audit: ManufacturingAuditSinkProvider;
      productPort: ManufacturingProductIntegrationPort;
      workOrders: ManufacturingWorkOrderService;
    },
  ) {}

  async validateProductBaseline(command: ValidateProductBaselineCommand): Promise<ProductBaselineResult> {
    const key = `${command.tenantId}:PRODUCT_BASELINE_VALIDATE:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        await this.audit("CONFLICTING_IDEMPOTENCY_PAYLOAD", "Product baseline validation rejected due to conflicting idempotency payload.", command);
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit("DUPLICATE_OPERATION_COMMAND", "Product baseline validation replay accepted.", command);
      return structuredClone(replay.result);
    }

    this.assertTenantConsistency(command);
    await this.assertValidationResult(
      "PRODUCT_REFERENCE_INVALID",
      await this.dependencies.productPort.validateProductReference({
        tenantId: command.tenantId,
        productId: command.productRef.productId,
      }),
    );

    if (command.productVariantRef) {
      await this.assertValidationResult(
        "PRODUCT_VARIANT_INVALID",
        await this.dependencies.productPort.validateVariantReference({
          tenantId: command.tenantId,
          productVariantId: command.productVariantRef.productVariantId,
        }),
      );
    }

    await this.assertValidationResult(
      "PRODUCT_VERSION_INVALID",
      await this.dependencies.productPort.validateProductVersionReference({
        tenantId: command.tenantId,
        productVersionId: command.productVersionRef.productVersionId,
      }),
    );

    await this.assertValidationResult(
      "PRODUCT_BOM_INVALID",
      await this.dependencies.productPort.validateBomReference({
        tenantId: command.tenantId,
        bomId: command.productBomRef.productBomId,
      }),
    );

    if (command.designRoutingReference) {
      await this.assertValidationResult(
        "PRODUCT_REFERENCE_INVALID",
        await this.dependencies.productPort.validateRoutingReference({
          tenantId: command.tenantId,
          routingId: command.designRoutingReference,
        }),
      );
    }

    const now = this.dependencies.clock.now();
    const snapshot: WorkOrderProductBaselineSnapshot = {
      productRef: command.productRef,
      productVariantRef: command.productVariantRef,
      productVersionRef: command.productVersionRef,
      productBomRef: command.productBomRef,
      designRoutingReference: command.designRoutingReference,
      contractVersion: this.dependencies.metadata.getRuntimeMetadata().contractVersion,
      validatedAt: now,
    };

    const updated = this.dependencies.workOrders.setProductBaselineState({
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      expectedVersion: command.expectedVersion,
      baselineState: "VALIDATED",
      snapshot,
    });

    const result: ProductBaselineResult = {
      workOrderId: updated.workOrder.manufacturingWorkOrderId,
      tenantId: updated.workOrder.tenantId,
      baselineState: "VALIDATED",
      snapshot: updated.productBaselineSnapshot!,
      version: updated.workOrder.version,
    };

    this.idempotency.set(key, { payloadFingerprint, result: structuredClone(result) });
    await this.audit("INVALID_COMMAND", "Product baseline validated.", command);
    return result;
  }

  async freezeProductBaseline(command: FreezeProductBaselineCommand): Promise<ProductBaselineResult> {
    const key = `${command.tenantId}:PRODUCT_BASELINE_FREEZE:${command.idempotencyKey}`;
    const payloadFingerprint = createFingerprint(command);
    const replay = this.idempotency.get(key);
    if (replay) {
      if (replay.payloadFingerprint !== payloadFingerprint) {
        await this.audit("CONFLICTING_IDEMPOTENCY_PAYLOAD", "Product baseline freeze rejected due to conflicting idempotency payload.", command);
        throw new ManufacturingDomainError("CONFLICTING_IDEMPOTENCY_PAYLOAD", "conflicting idempotency payload", false);
      }
      await this.audit("DUPLICATE_OPERATION_COMMAND", "Product baseline freeze replay accepted.", command);
      return structuredClone(replay.result);
    }

    const current = this.dependencies.workOrders.require(command.tenantId, command.workOrderId);
    const snapshot: WorkOrderProductBaselineSnapshot = current.productBaselineSnapshot ?? {
      productRef: current.workOrder.productRef,
      productVariantRef: current.workOrder.productVariantRef,
      productVersionRef: current.workOrder.productVersionRef,
      productBomRef: current.workOrder.productBomRef,
      contractVersion: this.dependencies.metadata.getRuntimeMetadata().contractVersion,
      validatedAt: this.dependencies.clock.now(),
    };

    const updated = this.dependencies.workOrders.setProductBaselineState({
      tenantId: command.tenantId,
      workOrderId: command.workOrderId,
      expectedVersion: command.expectedVersion,
      baselineState: "FROZEN",
      snapshot: {
        ...snapshot,
        frozenAt: this.dependencies.clock.now(),
      },
    });

    const result: ProductBaselineResult = {
      workOrderId: updated.workOrder.manufacturingWorkOrderId,
      tenantId: updated.workOrder.tenantId,
      baselineState: "FROZEN",
      snapshot: updated.productBaselineSnapshot!,
      version: updated.workOrder.version,
    };

    this.idempotency.set(key, { payloadFingerprint, result: structuredClone(result) });
    await this.audit("INVALID_COMMAND", "Product baseline frozen.", command);
    return result;
  }

  private assertTenantConsistency(command: ValidateProductBaselineCommand): void {
    if (command.productRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "product reference tenant mismatch", false);
    }
    if (command.productVariantRef && command.productVariantRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "product variant reference tenant mismatch", false);
    }
    if (command.productVersionRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "product version reference tenant mismatch", false);
    }
    if (command.productBomRef.tenantId !== command.tenantId) {
      throw new ManufacturingDomainError("TENANT_MISMATCH", "product bom reference tenant mismatch", false);
    }
  }

  private async assertValidationResult(
    classification: ManufacturingFailureClassification,
    result: Awaited<ReturnType<ManufacturingProductIntegrationPort["validateProductReference"]>>,
  ): Promise<void> {
    if (result.valid) {
      return;
    }
    throw new ManufacturingDomainError(classification, result.reason, false);
  }

  private async audit(
    classification: ManufacturingFailureClassification,
    message: string,
    command: { tenantId: TenantId; correlationId: CorrelationIdentifier; idempotencyKey: IdempotencyKey; workOrderId: string },
  ): Promise<void> {
    await this.dependencies.audit.recordAudit({
      eventType: "manufacturing.product-baseline",
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