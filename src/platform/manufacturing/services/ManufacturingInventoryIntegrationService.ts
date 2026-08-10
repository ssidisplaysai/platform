import type {
  ManufacturingFailureClassification,
  TenantId,
  UnitOfMeasure,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type { ManufacturingInventoryIntegrationPort } from "../integration";

export type InventoryAvailabilityProjection = Readonly<{
  availableQuantity: number;
  availabilityClassification?: string;
  referenceVersion?: string;
  metadata?: Record<string, unknown>;
}>;

export class ManufacturingInventoryIntegrationService {
  constructor(
    private readonly dependencies: {
      inventoryPort: ManufacturingInventoryIntegrationPort;
    },
  ) {}

  async queryAvailability(input: {
    tenantId: TenantId;
    inventoryItemId: string;
    quantity: number;
    unitOfMeasure: UnitOfMeasure;
  }): Promise<InventoryAvailabilityProjection> {
    const result = await this.dependencies.inventoryPort.queryAvailability({
      tenantId: input.tenantId,
      inventoryItemId: input.inventoryItemId,
      quantity: input.quantity,
      unitOfMeasure: input.unitOfMeasure,
    });

    if (!result.valid) {
      const classification =
        result.reasonCode === "INSUFFICIENT" ? "INSUFFICIENT_INVENTORY" : "INVENTORY_AVAILABILITY_REJECTED";
      throw this.createError(classification, result.reason);
    }

    if (typeof result.availableQuantity === "number" && result.availableQuantity + 0.000001 < input.quantity) {
      throw this.createError("INSUFFICIENT_INVENTORY", "insufficient inventory available for requested quantity");
    }

    return {
      availableQuantity: result.availableQuantity ?? input.quantity,
      availabilityClassification: result.availabilityClassification,
      referenceVersion: result.referenceVersion,
      metadata: result.metadata,
    };
  }

  async requestReservation(input: {
    tenantId: TenantId;
    inventoryItemId: string;
    quantity: number;
    unitOfMeasure: UnitOfMeasure;
  }): Promise<string> {
    const result = await this.dependencies.inventoryPort.requestReservation({
      tenantId: input.tenantId,
      inventoryItemId: input.inventoryItemId,
      quantity: input.quantity,
      unitOfMeasure: input.unitOfMeasure,
    });
    if (!result.accepted) {
      throw this.createError("INVENTORY_RESERVATION_REJECTED", result.reason);
    }
    return result.referenceId;
  }

  async requestAllocation(input: { tenantId: TenantId; reservationId: string }): Promise<string> {
    const result = await this.dependencies.inventoryPort.requestAllocation({
      tenantId: input.tenantId,
      reservationId: input.reservationId,
    });
    if (!result.accepted) {
      throw this.createError("INVENTORY_ALLOCATION_REJECTED", result.reason);
    }
    return result.referenceId;
  }

  async requestMaterialIssue(input: {
    tenantId: TenantId;
    inventoryItemId: string;
    quantity: number;
    unitOfMeasure: UnitOfMeasure;
  }): Promise<Readonly<{ referenceId: string; acceptedQuantity: number }>> {
    const result = await this.dependencies.inventoryPort.requestMaterialIssue({
      tenantId: input.tenantId,
      inventoryItemId: input.inventoryItemId,
      quantity: input.quantity,
      unitOfMeasure: input.unitOfMeasure,
    });
    if (!result.accepted) {
      throw this.createError("INVENTORY_ISSUE_REJECTED", result.reason);
    }
    return {
      referenceId: result.referenceId,
      acceptedQuantity: result.acceptedQuantity ?? input.quantity,
    };
  }

  async requestMaterialReturn(input: {
    tenantId: TenantId;
    inventoryItemId: string;
    quantity: number;
    unitOfMeasure: UnitOfMeasure;
  }): Promise<Readonly<{ referenceId: string; acceptedQuantity: number }>> {
    const result = await this.dependencies.inventoryPort.requestMaterialReturn({
      tenantId: input.tenantId,
      inventoryItemId: input.inventoryItemId,
      quantity: input.quantity,
      unitOfMeasure: input.unitOfMeasure,
    });
    if (!result.accepted) {
      throw this.createError("INVENTORY_RETURN_REJECTED", result.reason);
    }
    return {
      referenceId: result.referenceId,
      acceptedQuantity: result.acceptedQuantity ?? input.quantity,
    };
  }

  async validateInventoryMovement(input: { tenantId: TenantId; inventoryMovementId: string }): Promise<void> {
    const validation = await this.dependencies.inventoryPort.validateInventoryMovement(input);
    if (!validation.valid) {
      throw this.createError("INVENTORY_MOVEMENT_INVALID", validation.reason);
    }
  }

  async validateLot(input: { tenantId: TenantId; lotId: string }): Promise<void> {
    if (this.dependencies.inventoryPort.validateInventoryLot) {
      const validation = await this.dependencies.inventoryPort.validateInventoryLot(input);
      if (!validation.valid) {
        throw this.createError("INVENTORY_LOT_INVALID", validation.reason);
      }
      return;
    }

    const validation = await this.dependencies.inventoryPort.validateLot(input);
    if (!validation.valid) {
      throw this.createError("INVENTORY_LOT_INVALID", validation.reason);
    }
  }

  async validateSerial(input: { tenantId: TenantId; serialId: string }): Promise<void> {
    if (this.dependencies.inventoryPort.validateInventorySerial) {
      const validation = await this.dependencies.inventoryPort.validateInventorySerial(input);
      if (!validation.valid) {
        throw this.createError("INVENTORY_SERIAL_INVALID", validation.reason);
      }
      return;
    }

    const validation = await this.dependencies.inventoryPort.validateSerial(input);
    if (!validation.valid) {
      throw this.createError("INVENTORY_SERIAL_INVALID", validation.reason);
    }
  }

  private createError(classification: ManufacturingFailureClassification, message: string): ManufacturingDomainError {
    return new ManufacturingDomainError(classification, message, false);
  }
}
