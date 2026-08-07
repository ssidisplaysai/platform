import { compareDeterministicStrings } from "../../shared";
import type {
  CommandMetadata,
  BinId,
  InventoryItemId,
  ProductReferenceId,
  ProductVariantReferenceId,
  TenantId,
  IdempotencyKey,
  StorageLocationId,
  WarehouseId,
} from "../contracts";
import type { InventoryRuntimeDependencies } from "./contracts";
import { InventoryDomainError } from "../domain";

export type InventoryReferenceValidationResult =
  | Readonly<{ valid: true }>
  | Readonly<{ valid: false; reason: string }>;

export type InventoryReferenceType =
  | "PRODUCT"
  | "PRODUCT_VARIANT"
  | "ORGANIZATION"
  | "DOCUMENT"
  | "KNOWLEDGE"
  | "ASSET"
  | "COMMERCE_ORDER"
  | "MANUFACTURING_WORK_ORDER"
  | "FINANCE_CLASSIFICATION";

export type InventoryReferencePolicy = "MANDATORY" | "OPTIONAL" | "DEFERRED";

export type InventoryReferenceValidationReasonClassification =
  | "INVALID_REFERENCE"
  | "UNSUPPORTED_REFERENCE_TYPE"
  | "MISSING_REFERENCE_VALIDATOR"
  | "DUPLICATE_REFERENCE_VALIDATOR"
  | "REFERENCE_NOT_FOUND"
  | "REFERENCE_INACTIVE"
  | "REFERENCE_TENANT_MISMATCH"
  | "REFERENCE_CONTRACT_VERSION_MISMATCH"
  | "MANDATORY_REFERENCE_UNAVAILABLE"
  | "STALE_REFERENCE"
  | "REFERENCE_VALIDATION_FAILURE";

export type InventoryExternalReference = Readonly<{
  referenceType: InventoryReferenceType;
  referenceId: string;
  tenantId: TenantId;
  policy: InventoryReferencePolicy;
  idempotencyKey?: IdempotencyKey;
  metadata?: Readonly<Record<string, string>>;
  validatedAt?: string;
  sourceContractVersion?: string;
}>;

export type InventoryReferenceValidationFact = Readonly<{
  valid: boolean;
  canonicalIdentifier: string;
  referenceType: InventoryReferenceType;
  tenantMatch: boolean;
  usable: boolean;
  contractVersion: string;
  validatedAt: string;
  reasonClassification?: InventoryReferenceValidationReasonClassification;
  reason?: string;
}>;

export type InventoryReferenceValidator = {
  validatorId: string;
  supports(referenceType: InventoryReferenceType): boolean;
  getContractVersion(): string;
  validate(reference: InventoryExternalReference): Promise<InventoryReferenceValidationFact>;
  validateMany(references: readonly InventoryExternalReference[]): Promise<readonly InventoryReferenceValidationFact[]>;
};

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

export type InventoryReferenceHealthStatus = Readonly<{
  requiredProductValidatorRegistered: boolean;
  requiredValidatorsAvailable: boolean;
  optionalValidatorTypes: readonly InventoryReferenceType[];
  supportedTypes: readonly InventoryReferenceType[];
  lastValidationFailureSummary?: string;
  degraded: boolean;
}>;

export type InventoryReferenceMetrics = Readonly<{
  referenceValidationCount: number;
  referenceValidationFailureCount: number;
  mandatoryReferenceFailureCount: number;
  optionalReferenceFailureCount: number;
  missingValidatorCount: number;
  tenantMismatchCount: number;
  staleReferenceCount: number;
}>;

type ProductValidatorAdapter = InventoryReferenceValidator & {
  readonly productValidator: InventoryProductReferenceValidator;
};

function createProductValidatorAdapter(validator: InventoryProductReferenceValidator): ProductValidatorAdapter {
  return {
    validatorId: validator.validatorId,
    productValidator: validator,
    supports(referenceType) {
      return referenceType === "PRODUCT" || referenceType === "PRODUCT_VARIANT";
    },
    getContractVersion() {
      return "1.0.0";
    },
    async validate(reference) {
      if (reference.referenceType !== "PRODUCT" && reference.referenceType !== "PRODUCT_VARIANT") {
        return {
          valid: false,
          canonicalIdentifier: reference.referenceId,
          referenceType: reference.referenceType,
          tenantMatch: true,
          usable: false,
          contractVersion: "1.0.0",
          validatedAt: new Date().toISOString(),
          reasonClassification: "UNSUPPORTED_REFERENCE_TYPE",
          reason: `unsupported reference type: ${reference.referenceType}`,
        };
      }

      const productReferenceId = (reference.referenceType === "PRODUCT"
        ? reference.referenceId
        : reference.metadata?.productReferenceId) as ProductReferenceId | undefined;
      if (!productReferenceId) {
        return {
          valid: false,
          canonicalIdentifier: reference.referenceId,
          referenceType: reference.referenceType,
          tenantMatch: true,
          usable: false,
          contractVersion: "1.0.0",
          validatedAt: new Date().toISOString(),
          reasonClassification: "INVALID_REFERENCE",
          reason: "product reference id is required",
        };
      }

      const result = await validator.validate({
        tenantId: reference.tenantId,
        inventoryItemId: (reference.metadata?.inventoryItemId ?? "inventory-item") as InventoryItemId,
        productReferenceId,
        productVariantReferenceId:
          reference.referenceType === "PRODUCT_VARIANT"
            ? (reference.referenceId as ProductVariantReferenceId)
            : undefined,
      });

      return result.valid
        ? {
            valid: true,
            canonicalIdentifier: reference.referenceId,
            referenceType: reference.referenceType,
            tenantMatch: true,
            usable: true,
            contractVersion: "1.0.0",
            validatedAt: new Date().toISOString(),
          }
        : {
            valid: false,
            canonicalIdentifier: reference.referenceId,
            referenceType: reference.referenceType,
            tenantMatch: true,
            usable: false,
            contractVersion: "1.0.0",
            validatedAt: new Date().toISOString(),
            reasonClassification: "REFERENCE_NOT_FOUND",
            reason: result.reason,
          };
    },
    async validateMany(references) {
      const results: InventoryReferenceValidationFact[] = [];
      for (const reference of references) {
        results.push(await this.validate(reference));
      }
      return results;
    },
  };
}

export class InventoryReferenceValidatorRegistry {
  private productValidator?: InventoryProductReferenceValidator;
  private readonly validators = new Map<InventoryReferenceType, InventoryReferenceValidator>();
  private lastValidationFailureSummary?: string;

  registerValidator(referenceType: InventoryReferenceType, validator: InventoryReferenceValidator): void {
    if (!validator.validatorId || !validator.supports(referenceType) || this.validators.has(referenceType)) {
      throw new InventoryDomainError("INVALID_COMMAND", `reference validator registration conflict: ${referenceType}`, false);
    }
    this.validators.set(referenceType, validator);
  }

  registerProductValidator(validator: InventoryProductReferenceValidator): void {
    if (this.productValidator || !validator.validatorId) {
      throw new InventoryDomainError("INVALID_COMMAND", `inventory product validator registration conflict: ${validator.validatorId}`, false);
    }
    this.productValidator = validator;

    const adapter = createProductValidatorAdapter(validator);
    this.registerValidator("PRODUCT", adapter);
    this.registerValidator("PRODUCT_VARIANT", adapter);
  }

  requireProductValidator(): InventoryProductReferenceValidator {
    if (!this.productValidator) {
      throw new InventoryDomainError("MISSING_REQUIRED_VALIDATOR", "inventory product validator is not registered", false);
    }
    return this.productValidator;
  }

  requireValidator(referenceType: InventoryReferenceType): InventoryReferenceValidator {
    const validator = this.validators.get(referenceType);
    if (!validator) {
      throw new InventoryDomainError("MISSING_REQUIRED_VALIDATOR", `reference validator missing for ${referenceType}`, false);
    }
    return validator;
  }

  supports(referenceType: InventoryReferenceType): boolean {
    return this.validators.has(referenceType);
  }

  supportedReferenceTypes(): InventoryReferenceType[] {
    return [...this.validators.keys()].sort(compareDeterministicStrings);
  }

  listValidatorIds(): string[] {
    return [...new Set([...this.validators.values()].map((validator) => validator.validatorId))].sort(compareDeterministicStrings);
  }

  setLastValidationFailureSummary(summary: string): void {
    this.lastValidationFailureSummary = summary;
  }

  getHealth(requiredReferenceTypes: readonly InventoryReferenceType[] = ["PRODUCT"]): InventoryReferenceHealthStatus {
    const supportedTypes = this.supportedReferenceTypes();
    const requiredValidatorsAvailable = requiredReferenceTypes.every((type) => this.supports(type));
    return {
      requiredProductValidatorRegistered: this.supports("PRODUCT"),
      requiredValidatorsAvailable,
      optionalValidatorTypes: supportedTypes.filter((type) => !requiredReferenceTypes.includes(type)),
      supportedTypes,
      lastValidationFailureSummary: this.lastValidationFailureSummary,
      degraded: !requiredValidatorsAvailable,
    };
  }
}

export class InventoryReferenceService {
  private metrics: InventoryReferenceMetrics = {
    referenceValidationCount: 0,
    referenceValidationFailureCount: 0,
    mandatoryReferenceFailureCount: 0,
    optionalReferenceFailureCount: 0,
    missingValidatorCount: 0,
    tenantMismatchCount: 0,
    staleReferenceCount: 0,
  };

  constructor(
    private readonly registry: InventoryReferenceValidatorRegistry,
    private readonly dependencies: InventoryRuntimeDependencies,
  ) {}

  getMetrics(): InventoryReferenceMetrics {
    return { ...this.metrics };
  }

  getHealth(): InventoryReferenceHealthStatus {
    return this.registry.getHealth();
  }

  async validate(reference: InventoryExternalReference, commandMetadata: CommandMetadata): Promise<InventoryReferenceValidationFact> {
    this.metrics = { ...this.metrics, referenceValidationCount: this.metrics.referenceValidationCount + 1 };

    let validator: InventoryReferenceValidator;
    try {
      validator = this.registry.requireValidator(reference.referenceType);
    } catch (error) {
      const missingValidatorResult: InventoryReferenceValidationFact = {
        valid: false,
        canonicalIdentifier: reference.referenceId,
        referenceType: reference.referenceType,
        tenantMatch: true,
        usable: false,
        contractVersion: "unknown",
        validatedAt: this.dependencies.clockProvider.now(),
        reasonClassification: "MISSING_REFERENCE_VALIDATOR",
        reason: `missing validator for ${reference.referenceType}`,
      };
      this.metrics = {
        ...this.metrics,
        referenceValidationFailureCount: this.metrics.referenceValidationFailureCount + 1,
        missingValidatorCount: this.metrics.missingValidatorCount + 1,
        mandatoryReferenceFailureCount:
          this.metrics.mandatoryReferenceFailureCount + (reference.policy === "MANDATORY" ? 1 : 0),
        optionalReferenceFailureCount:
          this.metrics.optionalReferenceFailureCount + (reference.policy === "OPTIONAL" ? 1 : 0),
      };
      this.registry.setLastValidationFailureSummary(`missing validator for ${reference.referenceType}`);
      await this.dependencies.auditSinkProvider.recordAudit({
        eventType: "inventory.reference.validation.missing-validator",
        message: "reference validation missing validator",
        recordedAt: this.dependencies.clockProvider.now(),
        details: {
          action: "VALIDATE_REFERENCE",
          referenceType: reference.referenceType,
          referenceId: reference.referenceId,
          tenantId: reference.tenantId,
          policy: reference.policy,
          commandId: commandMetadata.commandId,
          idempotencyKey: commandMetadata.idempotencyKey,
          resultClassification: "MISSING_REFERENCE_VALIDATOR",
        },
      });
      if (reference.policy === "MANDATORY") {
        throw error;
      }
      return missingValidatorResult;
    }

    const result = await validator.validate(reference);
    if (!result.valid) {
      this.metrics = {
        ...this.metrics,
        referenceValidationFailureCount: this.metrics.referenceValidationFailureCount + 1,
        mandatoryReferenceFailureCount:
          this.metrics.mandatoryReferenceFailureCount + (reference.policy === "MANDATORY" ? 1 : 0),
        optionalReferenceFailureCount:
          this.metrics.optionalReferenceFailureCount + (reference.policy === "OPTIONAL" ? 1 : 0),
        tenantMismatchCount:
          this.metrics.tenantMismatchCount + (result.reasonClassification === "REFERENCE_TENANT_MISMATCH" ? 1 : 0),
        staleReferenceCount:
          this.metrics.staleReferenceCount + (result.reasonClassification === "STALE_REFERENCE" ? 1 : 0),
      };
      this.registry.setLastValidationFailureSummary(`${result.reasonClassification ?? "REFERENCE_VALIDATION_FAILURE"}: ${result.reason ?? "unknown"}`);

      await this.dependencies.auditSinkProvider.recordAudit({
        eventType: reference.policy === "MANDATORY" ? "inventory.reference.validation.failed-mandatory" : "inventory.reference.validation.failed-optional",
        message: "reference validation failed",
        recordedAt: this.dependencies.clockProvider.now(),
        details: {
          action: "VALIDATE_REFERENCE",
          referenceType: reference.referenceType,
          referenceId: reference.referenceId,
          tenantId: reference.tenantId,
          policy: reference.policy,
          reasonClassification: result.reasonClassification ?? "REFERENCE_VALIDATION_FAILURE",
          reason: result.reason,
          commandId: commandMetadata.commandId,
          idempotencyKey: commandMetadata.idempotencyKey,
        },
      });

      if (reference.policy === "MANDATORY") {
        throw new InventoryDomainError("INVALID_REFERENCE", result.reason ?? "mandatory reference validation failed", false);
      }
    } else {
      await this.dependencies.auditSinkProvider.recordAudit({
        eventType: "inventory.reference.validation.succeeded",
        message: "reference validation succeeded",
        recordedAt: this.dependencies.clockProvider.now(),
        details: {
          action: "VALIDATE_REFERENCE",
          referenceType: reference.referenceType,
          referenceId: result.canonicalIdentifier,
          tenantId: reference.tenantId,
          policy: reference.policy,
          contractVersion: result.contractVersion,
          commandId: commandMetadata.commandId,
          idempotencyKey: commandMetadata.idempotencyKey,
        },
      });
    }

    return result;
  }

  async validateMany(references: readonly InventoryExternalReference[], commandMetadata: CommandMetadata): Promise<readonly InventoryReferenceValidationFact[]> {
    const ordered = [...references].sort((left, right) =>
      compareDeterministicStrings(`${left.referenceType}:${left.referenceId}`, `${right.referenceType}:${right.referenceId}`),
    );

    const results: InventoryReferenceValidationFact[] = [];
    for (const reference of ordered) {
      results.push(await this.validate(reference, commandMetadata));
    }
    return results;
  }

  async validateInventoryItemProductReference(input: InventoryProductReferenceValidationInput, commandMetadata: CommandMetadata): Promise<InventoryReferenceValidationFact> {
    let productResult: InventoryReferenceValidationFact;
    try {
      productResult = await this.validate(
        {
          referenceType: "PRODUCT",
          referenceId: input.productReferenceId,
          tenantId: input.tenantId,
          policy: "MANDATORY",
          metadata: {
            inventoryItemId: input.inventoryItemId,
          },
        },
        commandMetadata,
      );
    } catch (error) {
      if (error instanceof InventoryDomainError && error.classification === "INVALID_REFERENCE") {
        throw new InventoryDomainError("INVALID_PRODUCT_REFERENCE", error.message, false);
      }
      throw error;
    }

    if (!productResult.valid) {
      throw new InventoryDomainError("INVALID_PRODUCT_REFERENCE", productResult.reason ?? "product reference invalid", false);
    }

    if (input.productVariantReferenceId) {
      let variantResult: InventoryReferenceValidationFact;
      try {
        variantResult = await this.validate(
          {
            referenceType: "PRODUCT_VARIANT",
            referenceId: input.productVariantReferenceId,
            tenantId: input.tenantId,
            policy: "MANDATORY",
            metadata: {
              inventoryItemId: input.inventoryItemId,
              productReferenceId: input.productReferenceId,
            },
          },
          commandMetadata,
        );
      } catch (error) {
        if (error instanceof InventoryDomainError && error.classification === "INVALID_REFERENCE") {
          throw new InventoryDomainError("INVALID_PRODUCT_REFERENCE", error.message, false);
        }
        throw error;
      }
      if (!variantResult.valid) {
        throw new InventoryDomainError("INVALID_PRODUCT_REFERENCE", variantResult.reason ?? "product variant reference invalid", false);
      }
    }

    return productResult;
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

export function createStaticInventoryReferenceValidator(options: {
  validatorId: string;
  referenceType: InventoryReferenceType;
  contractVersion: string;
  activeReferences: readonly string[];
  tenantId?: TenantId;
  staleReferences?: readonly string[];
}): InventoryReferenceValidator {
  const active = new Set(options.activeReferences);
  const stale = new Set(options.staleReferences ?? []);

  return {
    validatorId: options.validatorId,
    supports(referenceType) {
      return referenceType === options.referenceType;
    },
    getContractVersion() {
      return options.contractVersion;
    },
    async validate(reference) {
      if (!this.supports(reference.referenceType)) {
        return {
          valid: false,
          canonicalIdentifier: reference.referenceId,
          referenceType: reference.referenceType,
          tenantMatch: true,
          usable: false,
          contractVersion: options.contractVersion,
          validatedAt: new Date().toISOString(),
          reasonClassification: "UNSUPPORTED_REFERENCE_TYPE",
          reason: `unsupported reference type: ${reference.referenceType}`,
        };
      }

      if (options.tenantId && options.tenantId !== reference.tenantId) {
        return {
          valid: false,
          canonicalIdentifier: reference.referenceId,
          referenceType: reference.referenceType,
          tenantMatch: false,
          usable: false,
          contractVersion: options.contractVersion,
          validatedAt: new Date().toISOString(),
          reasonClassification: "REFERENCE_TENANT_MISMATCH",
          reason: "reference tenant mismatch",
        };
      }

      if (stale.has(reference.referenceId)) {
        return {
          valid: false,
          canonicalIdentifier: reference.referenceId,
          referenceType: reference.referenceType,
          tenantMatch: true,
          usable: false,
          contractVersion: options.contractVersion,
          validatedAt: new Date().toISOString(),
          reasonClassification: "STALE_REFERENCE",
          reason: "reference is stale",
        };
      }

      if (!active.has(reference.referenceId)) {
        return {
          valid: false,
          canonicalIdentifier: reference.referenceId,
          referenceType: reference.referenceType,
          tenantMatch: true,
          usable: false,
          contractVersion: options.contractVersion,
          validatedAt: new Date().toISOString(),
          reasonClassification: "REFERENCE_NOT_FOUND",
          reason: "reference not found",
        };
      }

      return {
        valid: true,
        canonicalIdentifier: reference.referenceId,
        referenceType: reference.referenceType,
        tenantMatch: true,
        usable: true,
        contractVersion: options.contractVersion,
        validatedAt: new Date().toISOString(),
      };
    },
    async validateMany(references) {
      const results: InventoryReferenceValidationFact[] = [];
      for (const reference of references) {
        results.push(await this.validate(reference));
      }
      return results;
    },
  };
}
