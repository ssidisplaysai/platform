import type {
  ExpirationRecordContract,
  ExpirationRecordId,
  InventoryBalanceId,
  InventoryItemId,
  LotContract,
  LotId,
  SerialNumberContract,
  SerialNumberId,
  TenantId,
  WarehouseId,
  StorageLocationId,
} from "../contracts";
import type {
  ExpirationService,
  LotService,
  SerialNumberService,
} from "../services/lot-serial-expiration";

export class InventoryLotQueryService {
  constructor(
    private readonly lotService: LotService,
    private readonly expirationService: ExpirationService,
  ) {}

  getLot(tenantId: TenantId, lotId: LotId): LotContract | undefined {
    return this.lotService.getLot(tenantId, lotId);
  }

  listLots(tenantId: TenantId): LotContract[] {
    return this.lotService.listLots(tenantId);
  }

  listLotsByInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): LotContract[] {
    return this.listLots(tenantId).filter((lot) => lot.inventoryItemId === inventoryItemId);
  }

  listLotsByWarehouse(tenantId: TenantId, warehouseId: WarehouseId): LotContract[] {
    return this.listLots(tenantId).filter((lot) => lot.warehouseId === warehouseId);
  }

  listLotsByLocation(tenantId: TenantId, storageLocationId: StorageLocationId): LotContract[] {
    return this.listLots(tenantId).filter((lot) => lot.storageLocationId === storageLocationId);
  }

  listQuarantinedLots(tenantId: TenantId): LotContract[] {
    return this.listLots(tenantId).filter((lot) => lot.status === "QUARANTINED");
  }

  listExpiringLots(tenantId: TenantId): LotContract[] {
    const expiringIds = new Set(
      this.expirationService.listExpiring(tenantId)
        .filter((record) => record.lotId)
        .map((record) => record.lotId),
    );
    return this.listLots(tenantId).filter((lot) => expiringIds.has(lot.lotId));
  }

  listExpiredLots(tenantId: TenantId): LotContract[] {
    const expiredIds = new Set(
      this.expirationService.listExpired(tenantId)
        .filter((record) => record.lotId)
        .map((record) => record.lotId),
    );
    return this.listLots(tenantId).filter((lot) => expiredIds.has(lot.lotId));
  }
}

export class InventorySerialQueryService {
  constructor(
    private readonly serialService: SerialNumberService,
    private readonly expirationService: ExpirationService,
  ) {}

  getSerial(tenantId: TenantId, serialNumberId: SerialNumberId): SerialNumberContract | undefined {
    return this.serialService.getSerial(tenantId, serialNumberId);
  }

  listSerials(tenantId: TenantId): SerialNumberContract[] {
    return this.serialService.listSerials(tenantId);
  }

  listSerialsByInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): SerialNumberContract[] {
    return this.listSerials(tenantId).filter((serial) => serial.inventoryItemId === inventoryItemId);
  }

  listSerialsByBalance(tenantId: TenantId, inventoryBalanceId: InventoryBalanceId): SerialNumberContract[] {
    return this.listSerials(tenantId).filter((serial) => serial.inventoryBalanceId === inventoryBalanceId);
  }

  listSerialsByLot(tenantId: TenantId, lotId: LotId): SerialNumberContract[] {
    return this.listSerials(tenantId).filter((serial) => serial.lotId === lotId);
  }

  listQuarantinedSerials(tenantId: TenantId): SerialNumberContract[] {
    return this.listSerials(tenantId).filter((serial) => serial.status === "QUARANTINED");
  }

  listExpiredSerials(tenantId: TenantId): SerialNumberContract[] {
    const expiredIds = new Set(
      this.expirationService.listExpired(tenantId)
        .filter((record) => record.serialNumberId)
        .map((record) => record.serialNumberId),
    );
    return this.listSerials(tenantId).filter((serial) => expiredIds.has(serial.serialNumberId));
  }
}

export class InventoryExpirationQueryService {
  constructor(private readonly expirationService: ExpirationService) {}

  getExpirationStatus(tenantId: TenantId, expirationRecordId: ExpirationRecordId): ExpirationRecordContract | undefined {
    return this.expirationService.getExpirationStatus(tenantId, expirationRecordId);
  }
}
