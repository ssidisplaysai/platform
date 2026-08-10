import { compareDeterministicStrings, deterministicSort } from "../../shared";
import type {
  CorrelationIdentifier,
  IdempotencyKey,
  ManufacturingFailureClassification,
  TenantId,
} from "../contracts";
import { ManufacturingDomainError } from "../domain";
import type {
  ManufacturingAuditSinkProvider,
  ManufacturingClockProvider,
  ManufacturingExternalReferenceValidationPort,
  ManufacturingInventoryIntegrationPort,
  ManufacturingProductIntegrationPort,
} from "../integration";

export type ManufacturingReferenceFamily =
  | "PRODUCT"
  | "PRODUCT_VARIANT"
  | "PRODUCT_VERSION"
  | "PRODUCT_BOM"
  | "INVENTORY_ITEM"
  | "INVENTORY_RESERVATION"
  | "INVENTORY_ALLOCATION"
  | "INVENTORY_MOVEMENT"
  | "INVENTORY_LOT"
  | "INVENTORY_SERIAL"
  | "ORGANIZATION"
  | "PERSON_OR_CONTACT"
  | "ASSET"
  | "DOCUMENT"
  | "KNOWLEDGE"
  | "COMMERCE_ORDER"
  | "FINANCE_CLASSIFICATION"
  | "QUALITY_HOLD_REFERENCE";

export type ManufacturingReferencePolicyMode = "MANDATORY" | "OPTIONAL" | "DEFERRED";

export type ManufacturingReferenceValidationStatus = "VALID" | "INVALID" | "UNAVAILABLE" | "STALE" | "DEFERRED";

export type ManufacturingReferenceValidationPolicy = Readonly<{
  family: ManufacturingReferenceFamily;
  policy: ManufacturingReferencePolicyMode;
  validatorRequired: boolean;
  startupRequired: boolean;
  commandTimeBehavior: "FAIL_CLOSED" | "DEGRADE" | "DEFER";
  startupBehavior: "FAIL_RUNTIME" | "DEGRADE_RUNTIME" | "DEFER";
  staleBehavior: "REJECT" | "DEGRADE";
  unavailableBehavior: "REJECT" | "DEGRADE";
  auditBehavior: "AUDIT_ALWAYS";
  metricsBehavior: "COUNT_ALWAYS";
  healthConsequence: "INFORMATIONAL" | "DEGRADED" | "UNHEALTHY";
}>;

export type ManufacturingReferenceValidationInput = Readonly<{
  tenantId: TenantId;
  family: ManufacturingReferenceFamily;
  referenceId: string;
  referenceTenantId?: TenantId;
  commandId?: string;
  idempotencyKey?: IdempotencyKey;
  correlationId?: CorrelationIdentifier;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type ManufacturingReferenceValidationResult = Readonly<{
  tenantId: TenantId;
  family: ManufacturingReferenceFamily;
  referenceId: string;
  policy: ManufacturingReferencePolicyMode;
  status: ManufacturingReferenceValidationStatus;
  valid: boolean;
  tenantCompatible: boolean;
  reasonCode: string;
  reason?: string;
  validatorId?: string;
  source: "product" | "inventory" | "external" | "none";
  contractVersion: "1.0.0";
  validatedAt: string;
}>;

export type ManufacturingReferenceValidationMetrics = Readonly<{
  referenceValidationCount: number;
  referenceValidationFailureCount: number;
  mandatoryReferenceFailureCount: number;
  optionalReferenceFailureCount: number;
  missingValidatorCount: number;
  tenantMismatchCount: number;
  staleReferenceCount: number;
  productIntegrationFailureCount: number;
  inventoryIntegrationFailureCount: number;
}>;

export type ManufacturingReferenceHealth = Readonly<{
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  validatorAvailableByFamily: Readonly<Record<ManufacturingReferenceFamily, boolean>>;
  policyByFamily: Readonly<Record<ManufacturingReferenceFamily, ManufacturingReferencePolicyMode>>;
  requiredFamiliesMissingValidator: readonly ManufacturingReferenceFamily[];
  missingValidatorCount: number;
  lastStatusByFamily: Readonly<Record<ManufacturingReferenceFamily, ManufacturingReferenceValidationStatus>>;
}>;

export type ManufacturingIntegrationReferenceHealth = Readonly<{
  validatorAvailable: boolean;
  successCount: number;
  failureCount: number;
  lastStatus: ManufacturingReferenceValidationStatus;
}>;

type ValidatorExecutionResult = Readonly<{
  status: ManufacturingReferenceValidationStatus;
  tenantCompatible: boolean;
  reasonCode: string;
  reason?: string;
}>;

type ReferenceValidator = Readonly<{
  validatorId: string;
  source: "product" | "inventory" | "external";
  validate(input: ManufacturingReferenceValidationInput): Promise<ValidatorExecutionResult>;
}>;

function createPolicy(
  family: ManufacturingReferenceFamily,
  policy: ManufacturingReferencePolicyMode,
  overrides?: Partial<Omit<ManufacturingReferenceValidationPolicy, "family" | "policy">>,
): ManufacturingReferenceValidationPolicy {
  const defaultsByPolicy: Record<ManufacturingReferencePolicyMode, Omit<ManufacturingReferenceValidationPolicy, "family" | "policy">> = {
    MANDATORY: {
      validatorRequired: true,
      startupRequired: true,
      commandTimeBehavior: "FAIL_CLOSED",
      startupBehavior: "FAIL_RUNTIME",
      staleBehavior: "REJECT",
      unavailableBehavior: "REJECT",
      auditBehavior: "AUDIT_ALWAYS",
      metricsBehavior: "COUNT_ALWAYS",
      healthConsequence: "UNHEALTHY",
    },
    OPTIONAL: {
      validatorRequired: false,
      startupRequired: false,
      commandTimeBehavior: "DEGRADE",
      startupBehavior: "DEGRADE_RUNTIME",
      staleBehavior: "DEGRADE",
      unavailableBehavior: "DEGRADE",
      auditBehavior: "AUDIT_ALWAYS",
      metricsBehavior: "COUNT_ALWAYS",
      healthConsequence: "DEGRADED",
    },
    DEFERRED: {
      validatorRequired: false,
      startupRequired: false,
      commandTimeBehavior: "DEFER",
      startupBehavior: "DEFER",
      staleBehavior: "DEGRADE",
      unavailableBehavior: "DEGRADE",
      auditBehavior: "AUDIT_ALWAYS",
      metricsBehavior: "COUNT_ALWAYS",
      healthConsequence: "INFORMATIONAL",
    },
  };

  return {
    family,
    policy,
    ...defaultsByPolicy[policy],
    ...(overrides ?? {}),
  };
}

const FAMILIES: readonly ManufacturingReferenceFamily[] = [
  "PRODUCT",
  "PRODUCT_VARIANT",
  "PRODUCT_VERSION",
  "PRODUCT_BOM",
  "INVENTORY_ITEM",
  "INVENTORY_RESERVATION",
  "INVENTORY_ALLOCATION",
  "INVENTORY_MOVEMENT",
  "INVENTORY_LOT",
  "INVENTORY_SERIAL",
  "ORGANIZATION",
  "PERSON_OR_CONTACT",
  "ASSET",
  "DOCUMENT",
  "KNOWLEDGE",
  "COMMERCE_ORDER",
  "FINANCE_CLASSIFICATION",
  "QUALITY_HOLD_REFERENCE",
];

const DEFAULT_POLICIES: readonly ManufacturingReferenceValidationPolicy[] = [
  createPolicy("PRODUCT", "MANDATORY"),
  createPolicy("PRODUCT_VARIANT", "OPTIONAL"),
  createPolicy("PRODUCT_VERSION", "MANDATORY"),
  createPolicy("PRODUCT_BOM", "MANDATORY"),
  createPolicy("INVENTORY_ITEM", "MANDATORY"),
  createPolicy("INVENTORY_RESERVATION", "DEFERRED"),
  createPolicy("INVENTORY_ALLOCATION", "DEFERRED"),
  createPolicy("INVENTORY_MOVEMENT", "MANDATORY"),
  createPolicy("INVENTORY_LOT", "OPTIONAL"),
  createPolicy("INVENTORY_SERIAL", "OPTIONAL"),
  createPolicy("ORGANIZATION", "OPTIONAL"),
  createPolicy("PERSON_OR_CONTACT", "OPTIONAL"),
  createPolicy("ASSET", "OPTIONAL"),
  createPolicy("DOCUMENT", "OPTIONAL"),
  createPolicy("KNOWLEDGE", "OPTIONAL"),
  createPolicy("COMMERCE_ORDER", "OPTIONAL"),
  createPolicy("FINANCE_CLASSIFICATION", "OPTIONAL"),
  createPolicy("QUALITY_HOLD_REFERENCE", "OPTIONAL"),
];

function defaultMetrics(): ManufacturingReferenceValidationMetrics {
  return {
    referenceValidationCount: 0,
    referenceValidationFailureCount: 0,
    mandatoryReferenceFailureCount: 0,
    optionalReferenceFailureCount: 0,
    missingValidatorCount: 0,
    tenantMismatchCount: 0,
    staleReferenceCount: 0,
    productIntegrationFailureCount: 0,
    inventoryIntegrationFailureCount: 0,
  };
}

export class ManufacturingReferenceValidationService {
  private readonly validators = new Map<ManufacturingReferenceFamily, ReferenceValidator>();
  private readonly policies = new Map<ManufacturingReferenceFamily, ManufacturingReferenceValidationPolicy>(
    DEFAULT_POLICIES.map((entry) => [entry.family, entry]),
  );
  private metrics: ManufacturingReferenceValidationMetrics = defaultMetrics();
  private readonly lastStatusByFamily = new Map<ManufacturingReferenceFamily, ManufacturingReferenceValidationStatus>(
    FAMILIES.map((family) => [family, "DEFERRED"]),
  );
  private productIntegrationSuccessCount = 0;
  private productIntegrationFailureCount = 0;
  private inventoryIntegrationSuccessCount = 0;
  private inventoryIntegrationFailureCount = 0;

  constructor(
    private readonly dependencies: {
      clock: ManufacturingClockProvider;
      audit: ManufacturingAuditSinkProvider;
      productPort: ManufacturingProductIntegrationPort;
      inventoryPort: ManufacturingInventoryIntegrationPort;
      externalValidators: readonly Readonly<{
        integrationId: string;
        port: ManufacturingExternalReferenceValidationPort;
      }>[];
    },
  ) {
    this.registerBuiltIns();
  }

  private registerBuiltIns(): void {
    this.registerValidator("PRODUCT", {
      validatorId: "validator.product",
      source: "product",
      validate: async (input) => {
        const result = await this.dependencies.productPort.validateProductReference({
          tenantId: input.tenantId,
          productId: input.referenceId,
        });
        return result.valid
          ? {
              status: "VALID",
              tenantCompatible: true,
              reasonCode: "PRODUCT_REFERENCE_VALID",
            }
          : {
              status: "INVALID",
              tenantCompatible: true,
              reasonCode: result.reasonCode ?? "PRODUCT_REFERENCE_INVALID",
              reason: result.reason,
            };
      },
    });

    this.registerValidator("PRODUCT_VARIANT", {
      validatorId: "validator.product-variant",
      source: "product",
      validate: async (input) => {
        const result = await this.dependencies.productPort.validateVariantReference({
          tenantId: input.tenantId,
          productVariantId: input.referenceId,
        });
        return result.valid
          ? { status: "VALID", tenantCompatible: true, reasonCode: "PRODUCT_VARIANT_VALID" }
          : {
              status: "INVALID",
              tenantCompatible: true,
              reasonCode: result.reasonCode ?? "PRODUCT_VARIANT_INVALID",
              reason: result.reason,
            };
      },
    });

    this.registerValidator("PRODUCT_VERSION", {
      validatorId: "validator.product-version",
      source: "product",
      validate: async (input) => {
        const result = await this.dependencies.productPort.validateProductVersionReference({
          tenantId: input.tenantId,
          productVersionId: input.referenceId,
        });
        return result.valid
          ? { status: "VALID", tenantCompatible: true, reasonCode: "PRODUCT_VERSION_VALID" }
          : {
              status: "INVALID",
              tenantCompatible: true,
              reasonCode: result.reasonCode ?? "PRODUCT_VERSION_INVALID",
              reason: result.reason,
            };
      },
    });

    this.registerValidator("PRODUCT_BOM", {
      validatorId: "validator.product-bom",
      source: "product",
      validate: async (input) => {
        const result = await this.dependencies.productPort.validateBomReference({
          tenantId: input.tenantId,
          bomId: input.referenceId,
        });
        return result.valid
          ? { status: "VALID", tenantCompatible: true, reasonCode: "PRODUCT_BOM_VALID" }
          : {
              status: "INVALID",
              tenantCompatible: true,
              reasonCode: result.reasonCode ?? "PRODUCT_BOM_INVALID",
              reason: result.reason,
            };
      },
    });

    this.registerValidator("INVENTORY_ITEM", {
      validatorId: "validator.inventory-item",
      source: "inventory",
      validate: async (input) => {
        const result = await this.dependencies.inventoryPort.queryAvailability({
          tenantId: input.tenantId,
          inventoryItemId: input.referenceId,
          quantity: 0,
          unitOfMeasure: "EA",
        });
        return result.valid
          ? { status: "VALID", tenantCompatible: true, reasonCode: "INVENTORY_ITEM_VALID" }
          : {
              status: "INVALID",
              tenantCompatible: true,
              reasonCode: result.reasonCode ?? "INVENTORY_ITEM_INVALID",
              reason: result.reason,
            };
      },
    });

    this.registerValidator("INVENTORY_MOVEMENT", {
      validatorId: "validator.inventory-movement",
      source: "inventory",
      validate: async (input) => {
        const result = await this.dependencies.inventoryPort.validateInventoryMovement({
          tenantId: input.tenantId,
          inventoryMovementId: input.referenceId,
        });
        return result.valid
          ? { status: "VALID", tenantCompatible: true, reasonCode: "INVENTORY_MOVEMENT_VALID" }
          : {
              status: "INVALID",
              tenantCompatible: true,
              reasonCode: result.reasonCode ?? "INVENTORY_MOVEMENT_INVALID",
              reason: result.reason,
            };
      },
    });

    this.registerValidator("INVENTORY_LOT", {
      validatorId: "validator.inventory-lot",
      source: "inventory",
      validate: async (input) => {
        const result = await this.dependencies.inventoryPort.validateLot({
          tenantId: input.tenantId,
          lotId: input.referenceId,
        });
        return result.valid
          ? { status: "VALID", tenantCompatible: true, reasonCode: "INVENTORY_LOT_VALID" }
          : {
              status: "INVALID",
              tenantCompatible: true,
              reasonCode: result.reasonCode ?? "INVENTORY_LOT_INVALID",
              reason: result.reason,
            };
      },
    });

    this.registerValidator("INVENTORY_SERIAL", {
      validatorId: "validator.inventory-serial",
      source: "inventory",
      validate: async (input) => {
        const result = await this.dependencies.inventoryPort.validateSerial({
          tenantId: input.tenantId,
          serialId: input.referenceId,
        });
        return result.valid
          ? { status: "VALID", tenantCompatible: true, reasonCode: "INVENTORY_SERIAL_VALID" }
          : {
              status: "INVALID",
              tenantCompatible: true,
              reasonCode: result.reasonCode ?? "INVENTORY_SERIAL_INVALID",
              reason: result.reason,
            };
      },
    });

    const externalFamilies: readonly ManufacturingReferenceFamily[] = [
      "ORGANIZATION",
      "PERSON_OR_CONTACT",
      "ASSET",
      "DOCUMENT",
      "KNOWLEDGE",
      "COMMERCE_ORDER",
      "FINANCE_CLASSIFICATION",
      "QUALITY_HOLD_REFERENCE",
      "INVENTORY_RESERVATION",
      "INVENTORY_ALLOCATION",
    ];

    for (const registration of this.dependencies.externalValidators) {
      for (const family of externalFamilies) {
        if (this.validators.has(family)) {
          continue;
        }
        this.registerValidator(family, {
          validatorId: `validator.external.${registration.integrationId}.${family}`,
          source: "external",
          validate: async (input) => {
            const result = await registration.port.validateExternalReference({
              tenantId: input.tenantId,
              referenceType: input.family,
              referenceId: input.referenceId,
            });
            if (!result.valid) {
              const reasonCode = result.reasonCode ?? "REFERENCE_VALIDATION_FAILED";
              const status = reasonCode.includes("STALE") ? "STALE" : reasonCode.includes("UNAVAILABLE") ? "UNAVAILABLE" : "INVALID";
              return {
                status,
                tenantCompatible: !reasonCode.includes("TENANT"),
                reasonCode,
                reason: result.reason,
              };
            }

            return {
              status: "VALID",
              tenantCompatible: true,
              reasonCode: "REFERENCE_VALID",
            };
          },
        });
      }
    }
  }

  registerValidator(family: ManufacturingReferenceFamily, validator: ReferenceValidator): void {
    if (this.validators.has(family)) {
      throw new ManufacturingDomainError("MISSING_REFERENCE_VALIDATOR", `duplicate validator for ${family}`, false);
    }
    this.validators.set(family, validator);
  }

  listSupportedFamilies(): ManufacturingReferenceFamily[] {
    return deterministicSort([...FAMILIES], (family) => family);
  }

  listRegisteredFamilies(): ManufacturingReferenceFamily[] {
    return deterministicSort([...this.validators.keys()], (family) => family);
  }

  listPolicies(): ManufacturingReferenceValidationPolicy[] {
    return deterministicSort([...this.policies.values()], (entry) => entry.family);
  }

  getPolicy(family: ManufacturingReferenceFamily): ManufacturingReferenceValidationPolicy {
    return this.policies.get(family)!;
  }

  getMetrics(): ManufacturingReferenceValidationMetrics {
    return { ...this.metrics };
  }

  getReferenceHealth(): ManufacturingReferenceHealth {
    const validatorAvailableByFamily = Object.fromEntries(
      FAMILIES.map((family) => [family, this.validators.has(family)]),
    ) as Record<ManufacturingReferenceFamily, boolean>;

    const policyByFamily = Object.fromEntries(
      FAMILIES.map((family) => [family, this.policies.get(family)!.policy]),
    ) as Record<ManufacturingReferenceFamily, ManufacturingReferencePolicyMode>;

    const lastStatusByFamily = Object.fromEntries(
      FAMILIES.map((family) => [family, this.lastStatusByFamily.get(family) ?? "DEFERRED"]),
    ) as Record<ManufacturingReferenceFamily, ManufacturingReferenceValidationStatus>;

    const requiredFamiliesMissingValidator = FAMILIES.filter((family) => {
      const policy = this.policies.get(family)!;
      return policy.validatorRequired && !this.validators.has(family);
    });

    const status =
      requiredFamiliesMissingValidator.length > 0
        ? "UNHEALTHY"
        : this.metrics.optionalReferenceFailureCount > 0 || this.metrics.missingValidatorCount > 0
          ? "DEGRADED"
          : "HEALTHY";

    return {
      status,
      validatorAvailableByFamily,
      policyByFamily,
      requiredFamiliesMissingValidator,
      missingValidatorCount: this.metrics.missingValidatorCount,
      lastStatusByFamily,
    };
  }

  getProductIntegrationHealth(): ManufacturingIntegrationReferenceHealth {
    return {
      validatorAvailable: this.validators.has("PRODUCT") && this.validators.has("PRODUCT_VERSION") && this.validators.has("PRODUCT_BOM"),
      successCount: this.productIntegrationSuccessCount,
      failureCount: this.productIntegrationFailureCount,
      lastStatus: this.lastStatusByFamily.get("PRODUCT") ?? "DEFERRED",
    };
  }

  getInventoryIntegrationHealth(): ManufacturingIntegrationReferenceHealth {
    return {
      validatorAvailable: this.validators.has("INVENTORY_ITEM") && this.validators.has("INVENTORY_MOVEMENT"),
      successCount: this.inventoryIntegrationSuccessCount,
      failureCount: this.inventoryIntegrationFailureCount,
      lastStatus: this.lastStatusByFamily.get("INVENTORY_ITEM") ?? "DEFERRED",
    };
  }

  async validateReference(input: ManufacturingReferenceValidationInput): Promise<ManufacturingReferenceValidationResult> {
    this.metrics = {
      ...this.metrics,
      referenceValidationCount: this.metrics.referenceValidationCount + 1,
    };

    const policy = this.policies.get(input.family);
    if (!policy) {
      throw new ManufacturingDomainError("REFERENCE_VALIDATION_FAILED", `unsupported reference family: ${input.family}`, false);
    }

    if (input.referenceTenantId && input.referenceTenantId !== input.tenantId) {
      this.metrics = {
        ...this.metrics,
        referenceValidationFailureCount: this.metrics.referenceValidationFailureCount + 1,
        tenantMismatchCount: this.metrics.tenantMismatchCount + 1,
        mandatoryReferenceFailureCount:
          this.metrics.mandatoryReferenceFailureCount + (policy.policy === "MANDATORY" ? 1 : 0),
        optionalReferenceFailureCount:
          this.metrics.optionalReferenceFailureCount + (policy.policy === "OPTIONAL" ? 1 : 0),
      };

      const result: ManufacturingReferenceValidationResult = {
        tenantId: input.tenantId,
        family: input.family,
        referenceId: input.referenceId,
        policy: policy.policy,
        status: "INVALID",
        valid: false,
        tenantCompatible: false,
        reasonCode: "REFERENCE_TENANT_MISMATCH",
        reason: "reference tenant mismatch",
        source: "none",
        contractVersion: "1.0.0",
        validatedAt: this.dependencies.clock.now(),
      };
      this.lastStatusByFamily.set(input.family, result.status);
      await this.audit(result, input);
      return result;
    }

    const validator = this.validators.get(input.family);
    if (!validator) {
      this.metrics = {
        ...this.metrics,
        referenceValidationFailureCount: this.metrics.referenceValidationFailureCount + 1,
        missingValidatorCount: this.metrics.missingValidatorCount + 1,
        mandatoryReferenceFailureCount:
          this.metrics.mandatoryReferenceFailureCount + (policy.policy === "MANDATORY" ? 1 : 0),
        optionalReferenceFailureCount:
          this.metrics.optionalReferenceFailureCount + (policy.policy === "OPTIONAL" ? 1 : 0),
      };

      const status: ManufacturingReferenceValidationStatus =
        policy.policy === "DEFERRED" ? "DEFERRED" : "UNAVAILABLE";
      const result: ManufacturingReferenceValidationResult = {
        tenantId: input.tenantId,
        family: input.family,
        referenceId: input.referenceId,
        policy: policy.policy,
        status,
        valid: false,
        tenantCompatible: true,
        reasonCode: "MISSING_REFERENCE_VALIDATOR",
        reason: `missing validator for ${input.family}`,
        source: "none",
        contractVersion: "1.0.0",
        validatedAt: this.dependencies.clock.now(),
      };
      this.lastStatusByFamily.set(input.family, result.status);
      await this.audit(result, input);
      return result;
    }

    let execution: ValidatorExecutionResult;
    try {
      execution = await validator.validate(input);
    } catch (error) {
      this.metrics = {
        ...this.metrics,
        referenceValidationFailureCount: this.metrics.referenceValidationFailureCount + 1,
        mandatoryReferenceFailureCount:
          this.metrics.mandatoryReferenceFailureCount + (policy.policy === "MANDATORY" ? 1 : 0),
        optionalReferenceFailureCount:
          this.metrics.optionalReferenceFailureCount + (policy.policy === "OPTIONAL" ? 1 : 0),
      };

      const unavailableResult: ManufacturingReferenceValidationResult = {
        tenantId: input.tenantId,
        family: input.family,
        referenceId: input.referenceId,
        policy: policy.policy,
        status: "UNAVAILABLE",
        valid: false,
        tenantCompatible: true,
        reasonCode: "REFERENCE_VALIDATION_FAILED",
        reason: error instanceof Error ? error.message : "validator execution failed",
        validatorId: validator.validatorId,
        source: validator.source,
        contractVersion: "1.0.0",
        validatedAt: this.dependencies.clock.now(),
      };
      this.lastStatusByFamily.set(input.family, unavailableResult.status);
      this.trackIntegrationCounts(input.family, unavailableResult.status);
      await this.audit(unavailableResult, input);
      return unavailableResult;
    }

    if (execution.status === "STALE") {
      this.metrics = {
        ...this.metrics,
        staleReferenceCount: this.metrics.staleReferenceCount + 1,
      };
    }

    const failed = execution.status !== "VALID";
    if (failed) {
      this.metrics = {
        ...this.metrics,
        referenceValidationFailureCount: this.metrics.referenceValidationFailureCount + 1,
        mandatoryReferenceFailureCount:
          this.metrics.mandatoryReferenceFailureCount + (policy.policy === "MANDATORY" ? 1 : 0),
        optionalReferenceFailureCount:
          this.metrics.optionalReferenceFailureCount + (policy.policy === "OPTIONAL" ? 1 : 0),
        tenantMismatchCount:
          this.metrics.tenantMismatchCount + (execution.tenantCompatible ? 0 : 1),
      };
    }

    const result: ManufacturingReferenceValidationResult = {
      tenantId: input.tenantId,
      family: input.family,
      referenceId: input.referenceId,
      policy: policy.policy,
      status: execution.status,
      valid: execution.status === "VALID",
      tenantCompatible: execution.tenantCompatible,
      reasonCode: execution.reasonCode,
      reason: execution.reason,
      validatorId: validator.validatorId,
      source: validator.source,
      contractVersion: "1.0.0",
      validatedAt: this.dependencies.clock.now(),
    };

    this.lastStatusByFamily.set(input.family, result.status);
    this.trackIntegrationCounts(input.family, result.status);
    await this.audit(result, input);
    return result;
  }

  async assertReference(input: ManufacturingReferenceValidationInput): Promise<ManufacturingReferenceValidationResult> {
    const result = await this.validateReference(input);
    if (result.policy !== "MANDATORY" || result.status === "VALID") {
      return result;
    }

    if (!result.tenantCompatible) {
      throw new ManufacturingDomainError("REFERENCE_TENANT_MISMATCH", result.reason ?? "reference tenant mismatch", false);
    }

    if (result.status === "STALE") {
      throw new ManufacturingDomainError("STALE_EXTERNAL_REFERENCE", result.reason ?? "stale external reference", false);
    }

    if (result.status === "UNAVAILABLE" || result.status === "DEFERRED") {
      throw new ManufacturingDomainError("MISSING_REFERENCE_VALIDATOR", result.reason ?? "missing reference validator", false);
    }

    throw new ManufacturingDomainError("MANDATORY_REFERENCE_INVALID", result.reason ?? "mandatory reference invalid", false);
  }

  private trackIntegrationCounts(family: ManufacturingReferenceFamily, status: ManufacturingReferenceValidationStatus): void {
    const productFamilies: readonly ManufacturingReferenceFamily[] = [
      "PRODUCT",
      "PRODUCT_VARIANT",
      "PRODUCT_VERSION",
      "PRODUCT_BOM",
    ];
    const inventoryFamilies: readonly ManufacturingReferenceFamily[] = [
      "INVENTORY_ITEM",
      "INVENTORY_RESERVATION",
      "INVENTORY_ALLOCATION",
      "INVENTORY_MOVEMENT",
      "INVENTORY_LOT",
      "INVENTORY_SERIAL",
    ];

    const isFailure = status !== "VALID";

    if (productFamilies.includes(family)) {
      if (isFailure) {
        this.productIntegrationFailureCount += 1;
      } else {
        this.productIntegrationSuccessCount += 1;
      }
      this.metrics = {
        ...this.metrics,
        productIntegrationFailureCount: this.productIntegrationFailureCount,
      };
    }

    if (inventoryFamilies.includes(family)) {
      if (isFailure) {
        this.inventoryIntegrationFailureCount += 1;
      } else {
        this.inventoryIntegrationSuccessCount += 1;
      }
      this.metrics = {
        ...this.metrics,
        inventoryIntegrationFailureCount: this.inventoryIntegrationFailureCount,
      };
    }
  }

  private async audit(
    result: ManufacturingReferenceValidationResult,
    input: ManufacturingReferenceValidationInput,
  ): Promise<void> {
    await this.dependencies.audit.recordAudit({
      eventType: result.valid
        ? "manufacturing.reference.validation.succeeded"
        : result.policy === "MANDATORY"
          ? "manufacturing.reference.validation.failed-mandatory"
          : "manufacturing.reference.validation.failed-optional",
      message: result.valid ? "reference validation succeeded" : "reference validation failed",
      recordedAt: this.dependencies.clock.now(),
      details: {
        action: "VALIDATE_REFERENCE",
        success: result.valid,
        tenantId: input.tenantId,
        referenceFamily: input.family,
        referenceId: input.referenceId,
        policy: result.policy,
        status: result.status,
        reasonCode: result.reasonCode,
        reason: result.reason,
        validatorId: result.validatorId,
        source: result.source,
        commandId: input.commandId,
        idempotencyKey: input.idempotencyKey,
        correlationId: input.correlationId,
        resultClassification: this.mapResultClassification(result),
      },
    });
  }

  private mapResultClassification(result: ManufacturingReferenceValidationResult): ManufacturingFailureClassification {
    if (result.valid) {
      return "INVALID_COMMAND";
    }
    if (!result.tenantCompatible) {
      return "REFERENCE_TENANT_MISMATCH";
    }
    if (result.reasonCode === "MISSING_REFERENCE_VALIDATOR") {
      return result.policy === "MANDATORY" ? "MISSING_REFERENCE_VALIDATOR" : "OPTIONAL_REFERENCE_UNAVAILABLE";
    }
    if (result.status === "STALE") {
      return "STALE_EXTERNAL_REFERENCE";
    }
    if (result.status === "UNAVAILABLE" || result.status === "DEFERRED") {
      return result.policy === "MANDATORY" ? "MISSING_REFERENCE_VALIDATOR" : "OPTIONAL_REFERENCE_UNAVAILABLE";
    }
    return result.policy === "MANDATORY" ? "MANDATORY_REFERENCE_INVALID" : "REFERENCE_VALIDATION_FAILED";
  }
}
