import { ProductError, type ProductActorContext, type ProductVariant } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { ProductAuditService } from "./ProductAuditService";

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeSku(input: string): string {
  return input.trim().toUpperCase();
}

export class ProductVariantService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ProductAuditService,
  ) {}

  async createVariant(input: ProductVariant & { actor: ProductActorContext }): Promise<ProductVariant> {
    if (!input.productVariantId || !input.productId || !input.sku || !input.versionIdentifier) {
      throw new ProductError("PRODUCT_INVALID", "missing required variant fields", false, true, "HIGH");
    }

    const variant: ProductVariant = {
      ...input,
      sku: normalizeSku(input.sku),
      createdAt: input.createdAt || nowIso(),
      createdBy: input.createdBy || input.actor.actorId,
      updatedAt: input.updatedAt || nowIso(),
      updatedBy: input.updatedBy || input.actor.actorId,
    };

    await this.persistence.mutate((state) => {
      const productExists = state.products.some((item) => item.tenantId === variant.tenantId && item.productId === variant.productId);
      if (!productExists) {
        throw new ProductError("PRODUCT_NOT_FOUND", `variant product not found: ${variant.productId}`, false, true, "HIGH");
      }

      const duplicate = state.variants.some(
        (item) => item.tenantId === variant.tenantId && item.productVariantId === variant.productVariantId,
      );
      if (duplicate) {
        throw new ProductError("PRODUCT_DUPLICATE", `duplicate variant id: ${variant.productVariantId}`, false, true, "HIGH");
      }
      state.variants.push(variant);
    });

    await this.audit.append({
      eventType: "PRODUCT_VARIANT_CREATED",
      tenantId: input.tenantId,
      productId: input.productId,
      actor: input.actor,
      message: `variant ${input.productVariantId} created`,
      details: { sku: variant.sku },
    });

    return structuredClone(variant);
  }
}
