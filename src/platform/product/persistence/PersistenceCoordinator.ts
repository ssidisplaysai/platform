import {
  ProductError,
  createDefaultProductMetrics,
  createDefaultProductPersistedState,
  type ProductAuditRecord,
  type ProductMetrics,
  type ProductPersistedState,
} from "../contracts";
import { enforceDeterministicOrdering } from "../domain";
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
  metrics.auditEvents = state.audits.length;
  return metrics;
}

function validateStateOrThrow(state: ProductPersistedState): void {
  if (state.schemaVersion !== "1.0.0") {
    throw new ProductError("STATE_CORRUPT", "unsupported product state schema", false, true, "CRITICAL");
  }

  const productIds = new Set<string>();
  for (const product of state.products) {
    if (!product.productId || !product.tenantId || !product.sku || !product.displayName) {
      throw new ProductError("STATE_CORRUPT", `invalid product record: ${product.productId}`, false, true, "CRITICAL");
    }
    const scopedSku = `${product.tenantId}:${product.sku.toLowerCase()}`;
    if (productIds.has(scopedSku)) {
      throw new ProductError("STATE_CORRUPT", `duplicate sku in tenant scope: ${scopedSku}`, false, true, "CRITICAL");
    }
    productIds.add(scopedSku);
  }
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
}
