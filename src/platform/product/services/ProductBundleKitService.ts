import { ProductError, type ProductActorContext, type ProductBundle, type ProductKit } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { ProductAuditService } from "./ProductAuditService";

function assertMembersExist(
  tenantId: string,
  members: string[],
  products: Array<{ tenantId: string; productId: string }>,
): void {
  for (const member of members) {
    const exists = products.some((item) => item.tenantId === tenantId && item.productId === member);
    if (!exists) {
      throw new ProductError("PRODUCT_NOT_FOUND", `bundle/kit member product not found: ${member}`, false, true, "HIGH");
    }
  }
}

export class ProductBundleKitService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ProductAuditService,
  ) {}

  async defineBundle(input: ProductBundle & { actor: ProductActorContext }): Promise<ProductBundle> {
    if (!input.productBundleId || !input.versionIdentifier || input.componentProductIds.length === 0) {
      throw new ProductError("PRODUCT_INVALID", "missing required bundle fields", false, true, "HIGH");
    }

    await this.persistence.mutate((state) => {
      const duplicate = state.productBundles.some(
        (item) => item.tenantId === input.tenantId && item.productBundleId === input.productBundleId,
      );
      if (duplicate) {
        throw new ProductError("PRODUCT_DUPLICATE", `duplicate bundle id: ${input.productBundleId}`, false, true, "HIGH");
      }

      assertMembersExist(input.tenantId, input.componentProductIds, state.products);
      state.productBundles.push(structuredClone(input));
    });

    await this.audit.append({
      eventType: "PRODUCT_BUNDLE_DEFINED",
      tenantId: input.tenantId,
      actor: input.actor,
      message: `bundle ${input.productBundleId} defined`,
    });

    return structuredClone(input);
  }

  async defineKit(input: ProductKit & { actor: ProductActorContext }): Promise<ProductKit> {
    if (!input.productKitId || !input.versionIdentifier || input.componentProductIds.length === 0) {
      throw new ProductError("PRODUCT_INVALID", "missing required kit fields", false, true, "HIGH");
    }

    await this.persistence.mutate((state) => {
      const duplicate = state.productKits.some(
        (item) => item.tenantId === input.tenantId && item.productKitId === input.productKitId,
      );
      if (duplicate) {
        throw new ProductError("PRODUCT_DUPLICATE", `duplicate kit id: ${input.productKitId}`, false, true, "HIGH");
      }

      assertMembersExist(input.tenantId, input.componentProductIds, state.products);
      state.productKits.push(structuredClone(input));
    });

    await this.audit.append({
      eventType: "PRODUCT_KIT_DEFINED",
      tenantId: input.tenantId,
      actor: input.actor,
      message: `kit ${input.productKitId} defined`,
    });

    return structuredClone(input);
  }
}
