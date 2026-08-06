import type {
  BinContract,
  BinId,
  InventoryBalanceContract,
  InventoryBalanceId,
  InventoryItemContract,
  InventoryItemId,
  StorageLocationContract,
  StorageLocationId,
  TenantId,
  WarehouseContract,
  WarehouseId,
} from "../contracts";
import type { InventoryFoundationServices } from "../services";

export class InventoryFoundationQueryService {
  constructor(private readonly services: InventoryFoundationServices) {}

  getInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): InventoryItemContract | undefined {
    return this.services.inventoryItemService.getInventoryItem(tenantId, inventoryItemId);
  }

  listInventoryItems(tenantId: TenantId): InventoryItemContract[] {
    return this.services.inventoryItemService.listInventoryItems(tenantId);
  }

  getWarehouse(tenantId: TenantId, warehouseId: WarehouseId): WarehouseContract | undefined {
    return this.services.warehouseService.getWarehouse(tenantId, warehouseId);
  }

  listWarehouses(tenantId: TenantId): WarehouseContract[] {
    return this.services.warehouseService.listWarehouses(tenantId);
  }

  getStorageLocation(tenantId: TenantId, storageLocationId: StorageLocationId): StorageLocationContract | undefined {
    return this.services.storageLocationService.getStorageLocation(tenantId, storageLocationId);
  }

  listStorageLocations(tenantId: TenantId): StorageLocationContract[] {
    return this.services.storageLocationService.listStorageLocations(tenantId);
  }

  listLocationsByWarehouse(tenantId: TenantId, warehouseId: WarehouseId): StorageLocationContract[] {
    return this.services.storageLocationService.listLocationsByWarehouse(tenantId, warehouseId);
  }

  getBin(tenantId: TenantId, binId: BinId): BinContract | undefined {
    return this.services.binService.getBin(tenantId, binId);
  }

  listBins(tenantId: TenantId): BinContract[] {
    return this.services.binService.listBins(tenantId);
  }

  listBinsByLocation(tenantId: TenantId, storageLocationId: StorageLocationId): BinContract[] {
    return this.services.binService.listBinsByLocation(tenantId, storageLocationId);
  }

  getInventoryBalance(tenantId: TenantId, inventoryBalanceId: InventoryBalanceId): InventoryBalanceContract | undefined {
    return this.services.inventoryBalanceService.getInventoryBalance(tenantId, inventoryBalanceId);
  }

  listInventoryBalances(tenantId: TenantId): InventoryBalanceContract[] {
    return this.services.inventoryBalanceService.listInventoryBalances(tenantId);
  }

  listBalancesByInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): InventoryBalanceContract[] {
    return this.services.inventoryBalanceService.listBalancesByInventoryItem(tenantId, inventoryItemId);
  }

  listBalancesByWarehouse(tenantId: TenantId, warehouseId: WarehouseId): InventoryBalanceContract[] {
    return this.services.inventoryBalanceService.listBalancesByWarehouse(tenantId, warehouseId);
  }

  listBalancesByLocation(tenantId: TenantId, storageLocationId: StorageLocationId): InventoryBalanceContract[] {
    return this.services.inventoryBalanceService.listBalancesByLocation(tenantId, storageLocationId);
  }

  getAvailability(tenantId: TenantId, inventoryBalanceId: InventoryBalanceId): number | undefined {
    return this.services.inventoryBalanceService.getAvailability(tenantId, inventoryBalanceId);
  }
}
