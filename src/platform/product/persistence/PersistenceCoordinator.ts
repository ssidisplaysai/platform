import {
  ProductError,
  createDefaultProductMetrics,
  createDefaultProductPersistedState,
  isLifecycleState,
  type ProductAuditRecord,
  type ProductMetrics,
  type ProductPersistedState,
} from "../contracts";
import { enforceDeterministicOrdering, enforceDomainInvariants } from "../domain";
import type { ProductStore } from "./types";

function computeMetrics(state: ProductPersistedState): ProductMetrics {
  const metrics = structuredClone(state.metrics ?? createDefaultProductMetrics());
  metrics.productTotal = state.products.length;
  metrics.variantTotal = state.variants.length;
  metrics.familyTotal = state.productFamilies.length;
  metrics.categoryTotal = state.categories.length;
  metrics.bundleTotal = state.productBundles.length;
  metrics.kitTotal = state.productKits.length;
  metrics.pricingDefinitionTotal = state.pricingDefinitions.length;
  metrics.bomDefinitionTotal = state.billOfMaterialDefinitions.length;
  metrics.productVersionTotal = state.productVersions.length;
  metrics.activeProducts = state.products.filter((item) => item.lifecycleState === "ACTIVE").length;
  metrics.deprecatedProducts = state.products.filter((item) => item.lifecycleState === "DEPRECATED").length;
  metrics.retiredProducts = state.products.filter((item) => item.lifecycleState === "RETIRED").length;
  metrics.archivedProducts = state.products.filter((item) => item.lifecycleState === "ARCHIVED").length;
  metrics.auditEvents = state.audits.length;
  return metrics;
}

function validateStateOrThrow(state: ProductPersistedState): void {
  if (state.schemaVersion !== "1.1.0") {
    throw new ProductError("STATE_CORRUPT", "unsupported product state schema", false, true, "CRITICAL");
  }

  const productIdSet = new Set<string>();
  const productCodeSet = new Set<string>();
  for (const product of state.products) {
    if (
      !product.productId ||
      !product.tenantId ||
      !product.productCode ||
      !product.versionIdentifier ||
      !product.displayName ||
      !product.metadata
    ) {
      throw new ProductError("STATE_CORRUPT", `invalid product record: ${product.productId}`, false, true, "CRITICAL");
    }

    if (!isLifecycleState(product.lifecycleState)) {
      throw new ProductError(
        "LIFECYCLE_STATE_INVALID",
        `invalid product lifecycle state: ${product.productId}`,
        false,
        true,
        "CRITICAL",
      );
    }

    const scopedCode = `${product.tenantId}:${product.productCode.toLowerCase()}`;
    const scopedProductId = `${product.tenantId}:${product.productId}`;
    if (productIdSet.has(scopedProductId)) {
      throw new ProductError("STATE_CORRUPT", `duplicate product id in tenant scope: ${scopedProductId}`, false, true, "CRITICAL");
    }

    if (productCodeSet.has(scopedCode)) {
      throw new ProductError("STATE_CORRUPT", `duplicate product code in tenant scope: ${scopedCode}`, false, true, "CRITICAL");
    }

    productIdSet.add(scopedProductId);
    productCodeSet.add(scopedCode);
  }

  const variantIdSet = new Set<string>();
  for (const variant of state.variants) {
    if (!variant.productVariantId || !variant.productId || !variant.sku || !variant.versionIdentifier) {
      throw new ProductError("STATE_CORRUPT", `invalid product variant record: ${variant.productVariantId}`, false, true, "CRITICAL");
    }
    const scopedVariantId = `${variant.tenantId}:${variant.productVariantId}`;
    if (variantIdSet.has(scopedVariantId)) {
      throw new ProductError("STATE_CORRUPT", `duplicate variant id in tenant scope: ${scopedVariantId}`, false, true, "CRITICAL");
    }
    if (!productIdSet.has(`${variant.tenantId}:${variant.productId}`)) {
      throw new ProductError("STATE_CORRUPT", `variant references missing product: ${variant.productId}`, false, true, "CRITICAL");
    }
    variantIdSet.add(scopedVariantId);
  }

  for (const reference of state.assetReferences) {
    if (!reference.referenceId || !reference.assetId || !reference.productId) {
      throw new ProductError("STATE_CORRUPT", "invalid asset reference record", false, true, "CRITICAL");
    }
    if (!productIdSet.has(`${reference.tenantId}:${reference.productId}`)) {
      throw new ProductError("STATE_CORRUPT", `asset reference missing product: ${reference.productId}`, false, true, "CRITICAL");
    }
  }

  for (const reference of state.documentReferences) {
    if (!reference.referenceId || !reference.documentId || !reference.productId) {
      throw new ProductError("STATE_CORRUPT", "invalid document reference record", false, true, "CRITICAL");
    }
    if (!productIdSet.has(`${reference.tenantId}:${reference.productId}`)) {
      throw new ProductError("STATE_CORRUPT", `document reference missing product: ${reference.productId}`, false, true, "CRITICAL");
    }
  }

  for (const reference of state.knowledgeReferences) {
    if (!reference.referenceId || !reference.knowledgeId || !reference.productId) {
      throw new ProductError("STATE_CORRUPT", "invalid knowledge reference record", false, true, "CRITICAL");
    }
    if (!productIdSet.has(`${reference.tenantId}:${reference.productId}`)) {
      throw new ProductError("STATE_CORRUPT", `knowledge reference missing product: ${reference.productId}`, false, true, "CRITICAL");
    }
  }

  for (const reference of state.organizationReferences) {
    if (!reference.referenceId || !reference.organizationId || !reference.productId) {
      throw new ProductError("STATE_CORRUPT", "invalid organization reference record", false, true, "CRITICAL");
    }
    if (!productIdSet.has(`${reference.tenantId}:${reference.productId}`)) {
      throw new ProductError("STATE_CORRUPT", `organization reference missing product: ${reference.productId}`, false, true, "CRITICAL");
    }
  }

  enforceDomainInvariants(state);
}

export class PersistenceCoordinator {
  private state: ProductPersistedState = createDefaultProductPersistedState();

  constructor(private readonly store: ProductStore) {}

  async load(): Promise<void> {
    try {
      this.state = await this.store.load();
      validateStateOrThrow(this.state);
      enforceDeterministicOrdering(this.state);
      this.state.metrics = computeMetrics(this.state);
      this.state.metrics.recoveryCount += 1;
      await this.store.save(this.state);
    } catch (error) {
      if (error instanceof ProductError) {
        if (this.state?.metrics) {
          this.state.metrics.corruptStateCount += 1;
        }
        throw error;
      }
      throw new ProductError("RECOVERY_FAILURE", "product recovery failed", false, true, "CRITICAL");
    }
  }

  snapshot(): ProductPersistedState {
    return structuredClone(this.state);
  }

  async mutate(mutator: (state: ProductPersistedState) => void): Promise<void> {
    const next = this.snapshot();
    mutator(next);
    validateStateOrThrow(next);
    enforceDeterministicOrdering(next);
    next.metrics = computeMetrics(next);

    try {
      await this.store.save(next);
    } catch {
      throw new ProductError("PERSISTENCE_FAILURE", "product persistence save failed", true, true, "HIGH");
    }

    this.state = next;
  }

  async appendAudit(record: ProductAuditRecord): Promise<void> {
    await this.mutate((state) => {
      state.audits.push(record);
    });
  }

  async recordVersionConflict(): Promise<void> {
    await this.mutate((state) => {
      state.metrics.versionConflictCount += 1;
    });
  }

  async recordReferenceFailure(): Promise<void> {
    await this.mutate((state) => {
      state.metrics.invalidReferenceCount += 1;
    });
  }

  async recordInvariantViolation(): Promise<void> {
    await this.mutate((state) => {
      state.metrics.invariantViolationCount += 1;
    });
  }

  async recordProviderConflict(): Promise<void> {
    await this.mutate((state) => {
      state.metrics.providerConflictCount += 1;
    });
  }
}
