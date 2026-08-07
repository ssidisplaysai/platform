import type {
  AllocationContract,
  AllocationId,
  InventoryBalanceId,
  InventoryItemId,
  ReservationContract,
  ReservationId,
  TenantId,
} from "../contracts";
import type { AllocationService, ReservationService } from "../services/reservation-allocation";

export class InventoryReservationQueryService {
  constructor(private readonly reservationService: ReservationService) {}

  getReservation(tenantId: TenantId, reservationId: ReservationId): ReservationContract | undefined {
    return this.reservationService.getReservation(tenantId, reservationId);
  }

  listReservations(tenantId: TenantId): ReservationContract[] {
    return this.reservationService.listReservations(tenantId);
  }

  listReservationsByInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): ReservationContract[] {
    return this.listReservations(tenantId).filter((reservation) => reservation.inventoryItemId === inventoryItemId);
  }

  listReservationsByBalance(tenantId: TenantId, inventoryBalanceId: InventoryBalanceId): ReservationContract[] {
    return this.listReservations(tenantId).filter((reservation) => reservation.inventoryBalanceId === inventoryBalanceId);
  }

  listActiveReservations(tenantId: TenantId): ReservationContract[] {
    return this.listReservations(tenantId).filter((reservation) => reservation.status === "ACTIVE" || reservation.status === "PARTIALLY_RELEASED");
  }

  listExpiredReservations(tenantId: TenantId): ReservationContract[] {
    return this.listReservations(tenantId).filter((reservation) => reservation.status === "EXPIRED");
  }
}

export class InventoryAllocationQueryService {
  constructor(private readonly allocationService: AllocationService) {}

  getAllocation(tenantId: TenantId, allocationId: AllocationId): AllocationContract | undefined {
    return this.allocationService.getAllocation(tenantId, allocationId);
  }

  listAllocations(tenantId: TenantId): AllocationContract[] {
    return this.allocationService.listAllocations(tenantId);
  }

  listAllocationsByInventoryItem(tenantId: TenantId, inventoryItemId: InventoryItemId): AllocationContract[] {
    return this.listAllocations(tenantId).filter((allocation) => allocation.inventoryItemId === inventoryItemId);
  }

  listAllocationsByBalance(tenantId: TenantId, inventoryBalanceId: InventoryBalanceId): AllocationContract[] {
    return this.listAllocations(tenantId).filter((allocation) => allocation.inventoryBalanceId === inventoryBalanceId);
  }

  listAllocationsByReservation(tenantId: TenantId, reservationId: ReservationId): AllocationContract[] {
    return this.listAllocations(tenantId).filter((allocation) => allocation.reservationId === reservationId);
  }

  listActiveAllocations(tenantId: TenantId): AllocationContract[] {
    return this.listAllocations(tenantId).filter((allocation) => allocation.status === "ACTIVE" || allocation.status === "PARTIALLY_RELEASED");
  }
}
