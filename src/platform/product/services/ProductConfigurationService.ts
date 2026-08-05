import { ProductError, type Configuration, type ProductActorContext } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { ProductAuditService } from "./ProductAuditService";

export class ProductConfigurationService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ProductAuditService,
  ) {}

  async defineConfiguration(input: Configuration & { actor: ProductActorContext }): Promise<Configuration> {
    if (!input.configurationId || !input.productId || !input.versionIdentifier) {
      throw new ProductError("PRODUCT_INVALID", "missing required configuration fields", false, true, "HIGH");
    }

    await this.persistence.mutate((state) => {
      const productExists = state.products.some((item) => item.tenantId === input.tenantId && item.productId === input.productId);
      if (!productExists) {
        throw new ProductError("PRODUCT_NOT_FOUND", `configuration product not found: ${input.productId}`, false, true, "HIGH");
      }

      const duplicate = state.configurations.some(
        (item) => item.tenantId === input.tenantId && item.configurationId === input.configurationId,
      );
      if (duplicate) {
        throw new ProductError("PRODUCT_DUPLICATE", `duplicate configuration id: ${input.configurationId}`, false, true, "HIGH");
      }

      state.configurations.push(structuredClone(input));
    });

    await this.audit.append({
      eventType: "PRODUCT_CONFIGURATION_DEFINED",
      tenantId: input.tenantId,
      productId: input.productId,
      actor: input.actor,
      message: `configuration ${input.configurationId} defined`,
    });

    return structuredClone(input);
  }
}
