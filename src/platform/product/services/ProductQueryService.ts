import {
  ProductError,
  type Product,
  type ProductId,
  type ProductPersistedState,
  type TenantId,
} from "../contracts";
import type { PersistenceCoordinator } from "../persistence";

export class ProductQueryService {
  constructor(private readonly persistence: PersistenceCoordinator) {}

  snapshot(): ProductPersistedState {
    return this.persistence.snapshot();
  }

  getProductById(tenantId: TenantId, productId: ProductId): Product {
    const found = this.persistence
      .snapshot()
      .products.find((item) => item.tenantId === tenantId && item.productId === productId);
    if (!found) {
      throw new ProductError("PRODUCT_NOT_FOUND", `product not found: ${productId}`, false, true, "MEDIUM");
    }
    return structuredClone(found);
  }

  listProducts(tenantId?: TenantId): Product[] {
    return this.persistence
      .snapshot()
      .products.filter((item) => (tenantId ? item.tenantId === tenantId : true))
      .map((item) => structuredClone(item));
  }
}
