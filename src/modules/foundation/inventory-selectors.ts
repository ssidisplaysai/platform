import type {
  InventoryLocationConfiguration,
  InventoryLocationFilters,
  InventoryStockFilters,
  InventoryStockRecord,
} from "./types";

export function filterInventoryLocations(
  locations: readonly InventoryLocationConfiguration[],
  filters: InventoryLocationFilters,
): readonly InventoryLocationConfiguration[] {
  const query = filters.query?.trim().toLowerCase() ?? "";

  return locations.filter((location) => {
    if (filters.organizationId && location.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.siteId && location.siteId !== filters.siteId) {
      return false;
    }

    if (filters.locationType && location.locationType !== filters.locationType) {
      return false;
    }

    if (filters.lifecycleState && location.lifecycleState !== filters.lifecycleState) {
      return false;
    }

    if (filters.enabled !== undefined && location.enabled !== filters.enabled) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = `${location.locationName} ${location.displayName} ${location.locationCode}`.toLowerCase();
    return searchable.includes(query);
  });
}

export function filterInventoryStock(
  stock: readonly InventoryStockRecord[],
  filters: InventoryStockFilters,
): readonly InventoryStockRecord[] {
  const query = filters.query?.trim().toLowerCase() ?? "";

  return stock.filter((record) => {
    if (filters.organizationId && record.organizationId !== filters.organizationId) {
      return false;
    }

    if (filters.siteId && record.siteId !== filters.siteId) {
      return false;
    }

    if (filters.locationId && record.locationId !== filters.locationId) {
      return false;
    }

    if (filters.productId && record.productId !== filters.productId) {
      return false;
    }

    if (filters.stockStatus && record.stockStatus !== filters.stockStatus) {
      return false;
    }

    if (filters.lowStockOnly && record.availableQuantity > record.reorderPoint) {
      return false;
    }

    if (!query) {
      return true;
    }

    const searchable = `${record.productId} ${record.skuSnapshot} ${record.locationId}`.toLowerCase();
    return searchable.includes(query);
  });
}
