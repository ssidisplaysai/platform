import { ProductError, type PricingDefinition, type ProductActorContext } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { ProductAuditService } from "./ProductAuditService";

export class ProductPricingDefinitionService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ProductAuditService,
  ) {}

  async definePricing(input: PricingDefinition & { actor: ProductActorContext }): Promise<PricingDefinition> {
    if (!input.pricingDefinitionId || !input.productId || !input.versionIdentifier || !input.currency) {
      throw new ProductError("PRODUCT_INVALID", "missing required pricing definition fields", false, true, "HIGH");
    }

    await this.persistence.mutate((state) => {
      const productExists = state.products.some((item) => item.tenantId === input.tenantId && item.productId === input.productId);
      if (!productExists) {
        throw new ProductError("PRODUCT_NOT_FOUND", `pricing product not found: ${input.productId}`, false, true, "HIGH");
      }

      const duplicate = state.pricingDefinitions.some(
        (item) => item.tenantId === input.tenantId && item.pricingDefinitionId === input.pricingDefinitionId,
      );
      if (duplicate) {
        throw new ProductError("PRODUCT_DUPLICATE", `duplicate pricing definition id: ${input.pricingDefinitionId}`, false, true, "HIGH");
      }

      state.pricingDefinitions.push(structuredClone(input));
    });

    await this.audit.append({
      eventType: "PRODUCT_PRICING_DEFINITION_DEFINED",
      tenantId: input.tenantId,
      productId: input.productId,
      actor: input.actor,
      message: `pricing definition ${input.pricingDefinitionId} defined`,
    });

    return structuredClone(input);
  }
}
