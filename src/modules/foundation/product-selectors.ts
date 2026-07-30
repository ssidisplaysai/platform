import type {
  ProductCatalogStatus,
  ProductConfiguration,
  ProductLifecycleState,
  ProductListFilters,
  ProductVisibilityState,
} from "./types";

export function filterProducts(
  products: readonly ProductConfiguration[],
  filters: ProductListFilters,
): readonly ProductConfiguration[] {
  const query = filters.query?.trim().toLowerCase() ?? "";

  return products.filter((product) => {
    if (filters.organizationId && product.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.siteId && !product.assignedSiteIds.includes(filters.siteId)) {
      return false;
    }

    if (filters.lifecycleState && product.lifecycleState !== filters.lifecycleState) {
      return false;
    }

    if (filters.catalogStatus && product.catalogStatus !== filters.catalogStatus) {
      return false;
    }

    if (filters.visibility && product.visibility !== filters.visibility) {
      return false;
    }

    if (filters.categoryId && !product.categoryIds.includes(filters.categoryId)) {
      return false;
    }

    if (filters.manufacturerId && product.manufacturerId !== filters.manufacturerId) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = [
      product.productName,
      product.displayName,
      product.slug,
      product.sku,
      product.shortDescription ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return searchable.includes(query);
  });
}

export const PRODUCT_LIFECYCLE_STATES: readonly ProductLifecycleState[] = [
  "draft",
  "configuring",
  "active",
  "suspended",
  "archived",
];

export const PRODUCT_CATALOG_STATUSES: readonly ProductCatalogStatus[] = [
  "incomplete",
  "review_required",
  "ready",
  "published",
  "blocked",
];

export const PRODUCT_VISIBILITY_STATES: readonly ProductVisibilityState[] = [
  "hidden",
  "internal",
  "site_visible",
  "public_candidate",
];
