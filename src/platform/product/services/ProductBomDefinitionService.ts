import { ProductError, type BillOfMaterialDefinition, type ProductActorContext } from "../contracts";
import type { PersistenceCoordinator } from "../persistence";
import type { ProductAuditService } from "./ProductAuditService";

export class ProductBomDefinitionService {
  constructor(
    private readonly persistence: PersistenceCoordinator,
    private readonly audit: ProductAuditService,
  ) {}

  async defineBom(input: BillOfMaterialDefinition & { actor: ProductActorContext }): Promise<BillOfMaterialDefinition> {
    if (!input.billOfMaterialDefinitionId || !input.productId || !input.versionIdentifier) {
      throw new ProductError("PRODUCT_INVALID", "missing required BOM definition fields", false, true, "HIGH");
    }

    await this.persistence.mutate((state) => {
      const productExists = state.products.some((item) => item.tenantId === input.tenantId && item.productId === input.productId);
      if (!productExists) {
        throw new ProductError("PRODUCT_NOT_FOUND", `BOM product not found: ${input.productId}`, false, true, "HIGH");
      }

      const duplicate = state.billOfMaterialDefinitions.some(
        (item) => item.tenantId === input.tenantId && item.billOfMaterialDefinitionId === input.billOfMaterialDefinitionId,
      );
      if (duplicate) {
        throw new ProductError(
          "PRODUCT_DUPLICATE",
          `duplicate BOM definition id: ${input.billOfMaterialDefinitionId}`,
          false,
          true,
          "HIGH",
        );
      }

      state.billOfMaterialDefinitions.push(structuredClone(input));
    });

    await this.audit.append({
      eventType: "PRODUCT_BOM_DEFINITION_DEFINED",
      tenantId: input.tenantId,
      productId: input.productId,
      actor: input.actor,
      message: `BOM definition ${input.billOfMaterialDefinitionId} defined`,
    });

    return structuredClone(input);
  }
}
