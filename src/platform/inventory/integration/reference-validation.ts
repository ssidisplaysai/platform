import { compareDeterministicStrings } from "../../shared";
import type {
  BinId,
  InventoryItemId,
  ProductReferenceId,
  ProductVariantReferenceId,
  StorageLocationId,
  TenantId,
  WarehouseId,
} from "../contracts";

export type InventoryReferenceValidationResult =
  | Readonly<{ valid: true }>
  | Readonly<{ valid: false; reason: string }>;

export type InventoryProductReferenceValidationInput = Readonly<{
  tenantId: TenantId;
  inventoryItemId: InventoryItemId;
  productReferenceId: ProductReferenceId;
  productVariantReferenceId?: ProductVariantReferenceId;
}>;

export type InventoryProductReferenceValidator = {
  validatorId: string;
  validate(input: InventoryProductReferenceValidationInput): Promise<InventoryReferenceValidationResult>;
};

export type InventoryWarehouseReferenceValidator = {
  requireWarehouse(tenantId: TenantId, warehouseId: WarehouseId): void;
};

export type InventoryStorageLocationReferenceValidator = {
  requireStorageLocation(tenantId: TenantId, storageLocationId: StorageLocationId): void;
};

export type InventoryBinReferenceValidator = {
  requireBin(tenantId: TenantId, binId: BinId): void;
};

export class InventoryReferenceValidatorRegistry {
  private productValidator?: InventoryProductReferenceValidator;

  registerProductValidator(validator: InventoryProductReferenceValidator): void {
    if (this.productValidator || !validator.validatorId) {
      throw new Error(`inventory product validator registration conflict: ${validator.validatorId}`);
    }
    this.productValidator = validator;
  }

  requireProductValidator(): InventoryProductReferenceValidator {
    if (!this.productValidator) {
      throw new Error("inventory product validator is not registered");
    }
    return this.productValidator;
  }

  listValidatorIds(): string[] {
    return this.productValidator ? [this.productValidator.validatorId].sort(compareDeterministicStrings) : [];
  }
}

export function createStaticInventoryProductReferenceValidator(options: {
  validatorId: string;
  validProducts: readonly ProductReferenceId[];
  validProductVariants?: Readonly<Record<string, readonly ProductVariantReferenceId[]>>;
}): InventoryProductReferenceValidator {
  const validProducts = new Set(options.validProducts);
  const validVariants = options.validProductVariants ?? {};

  return {
    validatorId: options.validatorId,
    async validate(input) {
      if (!validProducts.has(input.productReferenceId)) {
        return { valid: false, reason: `unknown product reference: ${input.productReferenceId}` };
      }

      if (input.productVariantReferenceId) {
        const variants = validVariants[input.productReferenceId] ?? [];
        if (!variants.includes(input.productVariantReferenceId)) {
          return {
            valid: false,
            reason: `unknown product variant reference: ${input.productVariantReferenceId}`,
          };
        }
      }

      return { valid: true };
    },
  };
}
