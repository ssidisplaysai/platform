import { compareDeterministicStrings } from "../../shared/utilities";
import type {
  AllocationStatus,
  InventoryLifecycleState,
  LocationStatus,
  LotStatus,
  ReservationStatus,
  SerialStatus,
  WarehouseStatus,
} from "../contracts";
import { InventoryDomainError } from "./errors";

type TransitionTable<TState extends string> = Readonly<Record<TState, readonly TState[]>>;

export const inventoryLifecycleTransitions: TransitionTable<InventoryLifecycleState> = {
  DRAFT: ["ACTIVE", "ARCHIVED"],
  ACTIVE: ["RESTRICTED", "SUSPENDED", "ARCHIVED"],
  RESTRICTED: ["ACTIVE", "SUSPENDED", "ARCHIVED"],
  SUSPENDED: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export const reservationStatusTransitions: TransitionTable<ReservationStatus> = {
  PENDING: ["ACTIVE", "CANCELLED", "EXPIRED"],
  ACTIVE: ["PARTIALLY_RELEASED", "RELEASED", "FULFILLED", "EXPIRED", "CANCELLED"],
  PARTIALLY_RELEASED: ["ACTIVE", "RELEASED", "FULFILLED", "EXPIRED", "CANCELLED"],
  RELEASED: [],
  FULFILLED: [],
  EXPIRED: [],
  CANCELLED: [],
};

export const allocationStatusTransitions: TransitionTable<AllocationStatus> = {
  PENDING: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["PARTIALLY_RELEASED", "RELEASED", "FULFILLED", "CANCELLED"],
  PARTIALLY_RELEASED: ["ACTIVE", "RELEASED", "FULFILLED", "CANCELLED"],
  RELEASED: [],
  CANCELLED: [],
  FULFILLED: [],
};

export const warehouseStatusTransitions: TransitionTable<WarehouseStatus> = {
  ACTIVE: ["INACTIVE", "ARCHIVED"],
  INACTIVE: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export const locationStatusTransitions: TransitionTable<LocationStatus> = {
  ACTIVE: ["INACTIVE", "RECEIVING", "PICKING", "STAGING", "QUARANTINE", "ARCHIVED"],
  INACTIVE: ["ACTIVE", "ARCHIVED"],
  RECEIVING: ["ACTIVE", "INACTIVE", "ARCHIVED"],
  PICKING: ["ACTIVE", "INACTIVE", "ARCHIVED"],
  STAGING: ["ACTIVE", "INACTIVE", "ARCHIVED"],
  QUARANTINE: ["ACTIVE", "INACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export const lotStatusTransitions: TransitionTable<LotStatus> = {
  CREATED: ["ACTIVE", "QUARANTINED", "EXPIRED", "DISPOSED"],
  ACTIVE: ["QUARANTINED", "EXPIRED", "DISPOSED"],
  QUARANTINED: ["ACTIVE", "EXPIRED", "DISPOSED"],
  EXPIRED: ["DISPOSED"],
  DISPOSED: [],
};

export const serialStatusTransitions: TransitionTable<SerialStatus> = {
  CREATED: ["ACTIVE", "QUARANTINED", "RETIRED"],
  ACTIVE: ["QUARANTINED", "RESERVED", "ALLOCATED", "RETIRED"],
  QUARANTINED: ["ACTIVE", "RETIRED"],
  RESERVED: ["ALLOCATED", "ACTIVE", "QUARANTINED", "RETIRED"],
  ALLOCATED: ["SHIPPED_OR_CONSUMED", "ACTIVE", "QUARANTINED", "RETIRED"],
  SHIPPED_OR_CONSUMED: ["RETIRED"],
  RETIRED: [],
};

export function isValidTransition<TState extends string>(table: TransitionTable<TState>, from: TState, to: TState): boolean {
  if (from === to) {
    return true;
  }
  return table[from].includes(to);
}

export function assertValidTransition<TState extends string>(
  table: TransitionTable<TState>,
  from: TState,
  to: TState,
  classification: "RESERVATION_CONFLICT" | "ALLOCATION_CONFLICT" | "INVALID_LOCATION" | "INVALID_LOT" | "INVALID_SERIAL" | "INVALID_COMMAND",
): void {
  if (!isValidTransition(table, from, to)) {
    throw new InventoryDomainError(classification, `invalid lifecycle transition: ${from} -> ${to}`, false);
  }
}

export function deterministicTransitionStates<TState extends string>(table: TransitionTable<TState>, from: TState): TState[] {
  return [...table[from]].sort((left, right) => compareDeterministicStrings(left, right));
}
