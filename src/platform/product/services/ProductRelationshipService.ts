import { ProductError, type ProductActorContext, type ProductRelationship } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { ProductAuditService } from "./ProductAuditService";

export class ProductRelationshipService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ProductAuditService,
  ) {}

  async defineRelationship(input: ProductRelationship & { actor: ProductActorContext }): Promise<ProductRelationship> {
    if (!input.productRelationshipId || !input.sourceProductId || !input.targetProductId) {
      throw new ProductError("PRODUCT_INVALID", "missing required relationship fields", false, true, "HIGH");
    }

    await this.persistence.mutate((state) => {
      const sourceExists = state.products.some(
        (item) => item.tenantId === input.tenantId && item.productId === input.sourceProductId,
      );
      const targetExists = state.products.some(
        (item) => item.tenantId === input.tenantId && item.productId === input.targetProductId,
      );

      if (!sourceExists || !targetExists) {
        throw new ProductError("PRODUCT_NOT_FOUND", "relationship source or target not found", false, true, "HIGH");
      }

      const duplicate = state.productRelationships.some(
        (item) => item.tenantId === input.tenantId && item.productRelationshipId === input.productRelationshipId,
      );
      if (duplicate) {
        throw new ProductError("PRODUCT_DUPLICATE", `duplicate relationship id: ${input.productRelationshipId}`, false, true, "HIGH");
      }

      state.productRelationships.push(structuredClone(input));
    });

    await this.audit.append({
      eventType: "PRODUCT_RELATIONSHIP_DEFINED",
      tenantId: input.tenantId,
      productId: input.sourceProductId,
      actor: input.actor,
      message: `relationship ${input.productRelationshipId} defined`,
      details: { targetProductId: input.targetProductId, kind: input.kind },
    });

    return structuredClone(input);
  }
}
