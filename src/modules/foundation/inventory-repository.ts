import {
  calculateAvailableQuantity,
  deriveStockStatus,
  evaluateReorder,
} from "./inventory-calculations";
import {
  FOUNDATION_INVENTORY_COUNTS,
  FOUNDATION_INVENTORY_LOCATIONS,
  FOUNDATION_INVENTORY_MOVEMENTS,
  FOUNDATION_INVENTORY_RESERVATIONS,
  FOUNDATION_INVENTORY_STOCK,
} from "./inventory-fixtures";
import {
  validateInventoryLocationHierarchy,
  validateMovementInput,
  validateNonNegativeQuantities,
  validateReservationInput,
} from "./inventory-validation";
import { getProductById } from "./product-repository";
import { getSiteById } from "./site-repository";
import type {
  InventoryAvailabilityResult,
  InventoryCountRecord,
  InventoryLocationConfiguration,
  InventoryMovementRecord,
  InventoryMovementType,
  InventoryReservationRecord,
  InventoryReorderEvaluation,
  InventoryStockRecord,
  InventoryValidationResult,
  NewInventoryMovementInput,
  NewInventoryReservationInput,
  ProductConfiguration,
} from "./types";

const locationStore = new Map<string, InventoryLocationConfiguration>();
const stockStore = new Map<string, InventoryStockRecord>();
const movementStore = new Map<string, InventoryMovementRecord>();
const reservationStore = new Map<string, InventoryReservationRecord>();
const countStore = new Map<string, InventoryCountRecord>();

const movementIdempotencyStore = new Map<string, string>();

function seedStores(): void {
  locationStore.clear();
  FOUNDATION_INVENTORY_LOCATIONS.forEach((location) => {
    locationStore.set(location.locationId, { ...location });
  });

  stockStore.clear();
  FOUNDATION_INVENTORY_STOCK.forEach((stock) => {
    stockStore.set(stock.inventoryRecordId, { ...stock });
  });

  movementStore.clear();
  FOUNDATION_INVENTORY_MOVEMENTS.forEach((movement) => {
    movementStore.set(movement.movementId, { ...movement });
  });

  reservationStore.clear();
  FOUNDATION_INVENTORY_RESERVATIONS.forEach((reservation) => {
    reservationStore.set(reservation.reservationId, { ...reservation });
  });

  countStore.clear();
  FOUNDATION_INVENTORY_COUNTS.forEach((count) => {
    countStore.set(count.countId, { ...count });
  });

  movementIdempotencyStore.clear();
}

seedStores();

function nowIso(): string {
  return new Date().toISOString();
}

function createStockKey(organizationId: string, productId: string, locationId: string): string {
  return `${organizationId}:${productId}:${locationId}`;
}

function createMovementId(): string {
  return `movement-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createReservationId(): string {
  return `reservation-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function createCountId(): string {
  return `count-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function cloneStock(stock: InventoryStockRecord): InventoryStockRecord {
  return { ...stock };
}

function findStockRecord(
  organizationId: string,
  productId: string,
  locationId: string,
): InventoryStockRecord | null {
  return (
    Array.from(stockStore.values()).find(
      (stock) =>
        stock.organizationId === organizationId &&
        stock.productId === productId &&
        stock.locationId === locationId,
    ) ?? null
  );
}

function requireProduct(organizationId: string, productId: string): ProductConfiguration {
  const product = getProductById(productId);
  if (!product) {
    throw new Error("Product Not Found");
  }
  if (product.organizationId !== organizationId) {
    throw new Error("Organization Scope Violation");
  }
  return product;
}

function requireLocation(organizationId: string, locationId: string): InventoryLocationConfiguration {
  const location = locationStore.get(locationId);
  if (!location) {
    throw new Error("Location Not Found");
  }
  if (location.organizationId !== organizationId) {
    throw new Error("Organization Scope Violation");
  }
  return location;
}

function ensureLocationTransactional(location: InventoryLocationConfiguration): void {
  if (!location.enabled) {
    throw new Error("Invalid State Transition: location disabled");
  }
  if (location.lifecycleState === "archived" || location.lifecycleState === "suspended") {
    throw new Error("Invalid State Transition: location lifecycle does not permit transactions");
  }
}

function applyStockState(
  stock: InventoryStockRecord,
  product: ProductConfiguration,
): InventoryStockRecord {
  const updated: InventoryStockRecord = {
    ...stock,
    availableQuantity: calculateAvailableQuantity(stock),
    updatedAt: nowIso(),
    version: stock.version + 1,
  };

  updated.stockStatus = deriveStockStatus({ stock: updated, product });

  const quantityValidation = validateNonNegativeQuantities({
    onHandQuantity: updated.onHandQuantity,
    reservedQuantity: updated.reservedQuantity,
    incomingQuantity: updated.incomingQuantity,
    allocatedQuantity: updated.allocatedQuantity,
    damagedQuantity: updated.damagedQuantity,
    inspectionHoldQuantity: updated.inspectionHoldQuantity,
    backorderedQuantity: updated.backorderedQuantity,
    reorderPoint: updated.reorderPoint,
    reorderQuantity: updated.reorderQuantity,
    safetyStock: updated.safetyStock,
  });

  if (!quantityValidation.valid) {
    throw new Error("Validation Error: Invalid quantity transition");
  }

  return updated;
}

function setStockRecord(stock: InventoryStockRecord): InventoryStockRecord {
  stockStore.set(stock.inventoryRecordId, stock);
  return stock;
}

function getOrCreateStockRecord(input: {
  organizationId: string;
  product: ProductConfiguration;
  location: InventoryLocationConfiguration;
}): InventoryStockRecord {
  const existing = findStockRecord(
    input.organizationId,
    input.product.productId,
    input.location.locationId,
  );

  if (existing) {
    return cloneStock(existing);
  }

  const timestamp = nowIso();
  const created: InventoryStockRecord = {
    inventoryRecordId: `stock-${createStockKey(input.organizationId, input.product.productId, input.location.locationId)}`,
    organizationId: input.organizationId,
    productId: input.product.productId,
    locationId: input.location.locationId,
    siteId: input.location.siteId,
    skuSnapshot: input.product.sku,
    unitOfMeasure: "ea",
    onHandQuantity: 0,
    reservedQuantity: 0,
    availableQuantity: 0,
    incomingQuantity: 0,
    allocatedQuantity: 0,
    damagedQuantity: 0,
    inspectionHoldQuantity: 0,
    backorderedQuantity: 0,
    reorderPoint: 0,
    reorderQuantity: 0,
    safetyStock: 0,
    maximumStock: null,
    stockStatus: "unknown",
    lastCountedAt: null,
    lastMovementAt: null,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return created;
}

function mutateMovementStock(input: {
  movementType: InventoryMovementType;
  quantity: number;
  sourceStock: InventoryStockRecord | null;
  destinationStock: InventoryStockRecord | null;
  isReservationFulfillment: boolean;
}): void {
  const quantity = input.quantity;

  function requireSource(): InventoryStockRecord {
    if (!input.sourceStock) {
      throw new Error("Inventory Record Not Found");
    }
    return input.sourceStock;
  }

  function requireDestination(): InventoryStockRecord {
    if (!input.destinationStock) {
      throw new Error("Inventory Record Not Found");
    }
    return input.destinationStock;
  }

  switch (input.movementType) {
    case "receipt": {
      const destination = requireDestination();
      destination.onHandQuantity += quantity;
      destination.incomingQuantity = Math.max(0, destination.incomingQuantity - quantity);
      break;
    }
    case "issue": {
      const source = requireSource();
      if (source.onHandQuantity < quantity) {
        throw new Error("Insufficient Availability");
      }
      source.onHandQuantity -= quantity;
      if (input.isReservationFulfillment) {
        if (source.reservedQuantity < quantity) {
          throw new Error("Invalid State Transition: reserved quantity is insufficient");
        }
        source.reservedQuantity -= quantity;
      }
      break;
    }
    case "transfer": {
      const source = requireSource();
      const destination = requireDestination();
      if (source.onHandQuantity < quantity) {
        throw new Error("Insufficient Availability");
      }
      source.onHandQuantity -= quantity;
      destination.onHandQuantity += quantity;
      break;
    }
    case "adjustment_increase": {
      const destination = requireDestination();
      destination.onHandQuantity += quantity;
      break;
    }
    case "adjustment_decrease": {
      const source = requireSource();
      if (source.onHandQuantity < quantity) {
        throw new Error("Insufficient Availability");
      }
      source.onHandQuantity -= quantity;
      break;
    }
    case "reservation": {
      const source = requireSource();
      if (source.availableQuantity < quantity) {
        throw new Error("Insufficient Availability");
      }
      source.reservedQuantity += quantity;
      break;
    }
    case "reservation_release": {
      const source = requireSource();
      if (source.reservedQuantity < quantity) {
        throw new Error("Invalid State Transition: reserved quantity is insufficient");
      }
      source.reservedQuantity -= quantity;
      break;
    }
    case "allocation": {
      const source = requireSource();
      if (source.availableQuantity < quantity) {
        throw new Error("Insufficient Availability");
      }
      source.allocatedQuantity += quantity;
      break;
    }
    case "allocation_release": {
      const source = requireSource();
      if (source.allocatedQuantity < quantity) {
        throw new Error("Invalid State Transition: allocated quantity is insufficient");
      }
      source.allocatedQuantity -= quantity;
      break;
    }
    case "damage": {
      const source = requireSource();
      if (source.onHandQuantity < quantity) {
        throw new Error("Insufficient Availability");
      }
      source.onHandQuantity -= quantity;
      source.damagedQuantity += quantity;
      break;
    }
    case "inspection_hold": {
      const source = requireSource();
      if (source.onHandQuantity < quantity) {
        throw new Error("Insufficient Availability");
      }
      source.onHandQuantity -= quantity;
      source.inspectionHoldQuantity += quantity;
      break;
    }
    case "inspection_release": {
      const source = requireSource();
      if (source.inspectionHoldQuantity < quantity) {
        throw new Error("Invalid State Transition: inspection hold quantity is insufficient");
      }
      source.inspectionHoldQuantity -= quantity;
      source.onHandQuantity += quantity;
      break;
    }
    case "return": {
      const destination = requireDestination();
      destination.onHandQuantity += quantity;
      break;
    }
    case "shipment": {
      const source = requireSource();
      if (source.onHandQuantity < quantity) {
        throw new Error("Insufficient Availability");
      }
      source.onHandQuantity -= quantity;
      break;
    }
    case "count_correction": {
      const source = requireSource();
      source.onHandQuantity += quantity;
      break;
    }
    case "reversal": {
      throw new Error("Invalid State Transition: reversal mutation is handled by reverseMovement");
    }
    default:
      throw new Error("Validation Error: unsupported movement type");
  }
}

function buildMovementRecord(input: {
  movementId: string;
  body: NewInventoryMovementInput;
  status: "completed" | "rejected";
  reversedMovementId?: string | null;
}): InventoryMovementRecord {
  const now = nowIso();
  return {
    movementId: input.movementId,
    organizationId: input.body.organizationId,
    productId: input.body.productId,
    sourceLocationId: input.body.sourceLocationId,
    destinationLocationId: input.body.destinationLocationId,
    movementType: input.body.movementType,
    quantity: input.body.quantity,
    unitOfMeasure: input.body.unitOfMeasure,
    reasonCode: input.body.reasonCode,
    referenceType: input.body.referenceType,
    referenceId: input.body.referenceId,
    actorReference: input.body.actorReference,
    correlationId: input.body.correlationId,
    idempotencyKey: input.body.idempotencyKey,
    status: input.status,
    requestedAt: now,
    completedAt: input.status === "completed" ? now : null,
    reversedMovementId: input.reversedMovementId ?? null,
    notes: input.body.notes,
    evidenceReference: input.body.evidenceReference,
  };
}

export function listInventoryLocations(): readonly InventoryLocationConfiguration[] {
  return Array.from(locationStore.values());
}

export function getInventoryLocationById(locationId: string): InventoryLocationConfiguration | null {
  return locationStore.get(locationId) ?? null;
}

export function listInventoryStock(): readonly InventoryStockRecord[] {
  return Array.from(stockStore.values());
}

export function getInventoryStockById(inventoryRecordId: string): InventoryStockRecord | null {
  return stockStore.get(inventoryRecordId) ?? null;
}

export function listInventoryMovements(): readonly InventoryMovementRecord[] {
  return Array.from(movementStore.values());
}

export function getInventoryMovementById(movementId: string): InventoryMovementRecord | null {
  return movementStore.get(movementId) ?? null;
}

export function listInventoryReservations(): readonly InventoryReservationRecord[] {
  return Array.from(reservationStore.values());
}

export function getInventoryReservationById(reservationId: string): InventoryReservationRecord | null {
  return reservationStore.get(reservationId) ?? null;
}

export function listInventoryCounts(): readonly InventoryCountRecord[] {
  return Array.from(countStore.values());
}

export function validateInventoryLocations(): InventoryValidationResult {
  return validateInventoryLocationHierarchy(listInventoryLocations());
}

export function createInventoryMovement(input: NewInventoryMovementInput): {
  validation: InventoryValidationResult;
  movement: InventoryMovementRecord | null;
} {
  const validation = validateMovementInput(input);
  if (!validation.valid) {
    return { validation, movement: null };
  }

  if (input.idempotencyKey && movementIdempotencyStore.has(input.idempotencyKey)) {
    const movementId = movementIdempotencyStore.get(input.idempotencyKey) as string;
    const movement = movementStore.get(movementId) ?? null;
    return {
      validation: { valid: true, issues: [] },
      movement,
    };
  }

  try {
    const product = requireProduct(input.organizationId, input.productId);

    if (product.lifecycleState === "archived") {
      throw new Error("Invalid State Transition: archived products cannot transact");
    }

    const sourceLocation = input.sourceLocationId
      ? requireLocation(input.organizationId, input.sourceLocationId)
      : null;
    const destinationLocation = input.destinationLocationId
      ? requireLocation(input.organizationId, input.destinationLocationId)
      : null;

    if (sourceLocation) {
      ensureLocationTransactional(sourceLocation);
    }
    if (destinationLocation) {
      ensureLocationTransactional(destinationLocation);
    }

    if (input.movementType === "transfer" && sourceLocation && destinationLocation) {
      if (sourceLocation.locationId === destinationLocation.locationId) {
        throw new Error("Validation Error: transfer source and destination must differ");
      }
    }

    if (input.sourceLocationId && input.destinationLocationId && sourceLocation && destinationLocation) {
      if (sourceLocation.organizationId !== destinationLocation.organizationId) {
        throw new Error("Organization Scope Violation");
      }
    }

    const sourceStock = sourceLocation
      ? getOrCreateStockRecord({
        organizationId: input.organizationId,
        product,
        location: sourceLocation,
      })
      : null;

    const destinationStock = destinationLocation
      ? getOrCreateStockRecord({
        organizationId: input.organizationId,
        product,
        location: destinationLocation,
      })
      : null;

    const isReservationFulfillment =
      input.movementType === "issue" && input.referenceType === "reservation";

    mutateMovementStock({
      movementType: input.movementType,
      quantity: input.quantity,
      sourceStock,
      destinationStock,
      isReservationFulfillment,
    });

    const touchedStocks: InventoryStockRecord[] = [];

    if (sourceStock) {
      sourceStock.lastMovementAt = nowIso();
      touchedStocks.push(applyStockState(sourceStock, product));
    }

    if (destinationStock) {
      destinationStock.lastMovementAt = nowIso();
      touchedStocks.push(applyStockState(destinationStock, product));
    }

    touchedStocks.forEach((stock) => {
      setStockRecord(stock);
    });

    const movementId = createMovementId();
    const movement = buildMovementRecord({
      movementId,
      body: input,
      status: "completed",
    });

    movementStore.set(movementId, movement);

    if (input.idempotencyKey) {
      movementIdempotencyStore.set(input.idempotencyKey, movementId);
    }

    return { validation, movement };
  } catch (error) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "movement", message: (error as Error).message }],
      },
      movement: null,
    };
  }
}

export function reverseInventoryMovement(input: {
  movementId: string;
  actorReference: string;
  reasonCode: string;
  correlationId: string | null;
}): {
  validation: InventoryValidationResult;
  movement: InventoryMovementRecord | null;
} {
  const original = movementStore.get(input.movementId);

  if (!original) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "movementId", message: "Movement not found." }],
      },
      movement: null,
    };
  }

  if (original.status !== "completed") {
    return {
      validation: {
        valid: false,
        issues: [{ field: "status", message: "Only completed movements can be reversed." }],
      },
      movement: null,
    };
  }

  if (Array.from(movementStore.values()).some((movement) => movement.reversedMovementId === original.movementId)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "movementId", message: "Movement has already been reversed." }],
      },
      movement: null,
    };
  }

  const reverseMovementType = original.sourceLocationId && original.destinationLocationId
    ? "transfer"
    : original.destinationLocationId
      ? "adjustment_decrease"
      : "adjustment_increase";

  const reverseInput: NewInventoryMovementInput = {
    organizationId: original.organizationId,
    productId: original.productId,
    sourceLocationId: original.destinationLocationId,
    destinationLocationId: original.sourceLocationId,
    movementType: reverseMovementType,
    quantity: original.quantity,
    unitOfMeasure: original.unitOfMeasure,
    reasonCode: input.reasonCode,
    referenceType: "movement_reversal",
    referenceId: original.movementId,
    actorReference: input.actorReference,
    correlationId: input.correlationId,
    idempotencyKey: null,
    notes: "Reversal movement",
    evidenceReference: null,
  };

  const result = createInventoryMovement(reverseInput);
  if (!result.validation.valid || !result.movement) {
    return result;
  }

  const reversed: InventoryMovementRecord = {
    ...result.movement,
    movementType: "reversal",
    reversedMovementId: original.movementId,
    referenceType: "movement_reversal",
  };

  movementStore.set(reversed.movementId, reversed);

  const updatedOriginal: InventoryMovementRecord = {
    ...original,
    status: "reversed",
  };
  movementStore.set(original.movementId, updatedOriginal);

  return {
    validation: { valid: true, issues: [] },
    movement: reversed,
  };
}

export function createInventoryReservation(input: NewInventoryReservationInput): {
  validation: InventoryValidationResult;
  reservation: InventoryReservationRecord | null;
} {
  const validation = validateReservationInput(input);
  if (!validation.valid) {
    return { validation, reservation: null };
  }

  try {
    const product = requireProduct(input.organizationId, input.productId);
    const location = requireLocation(input.organizationId, input.locationId);

    ensureLocationTransactional(location);

    if (!location.reservationCapable) {
      throw new Error("Invalid State Transition: location does not permit reservations");
    }

    const stock = getOrCreateStockRecord({
      organizationId: input.organizationId,
      product,
      location,
    });

    if (stock.unitOfMeasure !== input.unitOfMeasure) {
      throw new Error("Validation Error: unit of measure is incompatible");
    }

    if (stock.availableQuantity < input.quantity) {
      throw new Error("Insufficient Availability");
    }

    stock.reservedQuantity += input.quantity;
    stock.lastMovementAt = nowIso();
    const updatedStock = applyStockState(stock, product);
    setStockRecord(updatedStock);

    const reservationId = createReservationId();
    const timestamp = nowIso();
    const reservation: InventoryReservationRecord = {
      reservationId,
      organizationId: input.organizationId,
      productId: input.productId,
      locationId: input.locationId,
      siteId: input.siteId,
      quantity: input.quantity,
      unitOfMeasure: input.unitOfMeasure,
      status: "active",
      reservationType: input.reservationType,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      requestedBy: input.requestedBy,
      expiresAt: input.expiresAt,
      createdAt: timestamp,
      updatedAt: timestamp,
      releasedAt: null,
      fulfilledAt: null,
      notes: input.notes,
    };

    reservationStore.set(reservationId, reservation);

    const movementId = createMovementId();
    const movement: InventoryMovementRecord = {
      movementId,
      organizationId: input.organizationId,
      productId: input.productId,
      sourceLocationId: input.locationId,
      destinationLocationId: null,
      movementType: "reservation",
      quantity: input.quantity,
      unitOfMeasure: input.unitOfMeasure,
      reasonCode: "reservation_created",
      referenceType: "reservation",
      referenceId: reservationId,
      actorReference: input.requestedBy,
      correlationId: null,
      idempotencyKey: null,
      status: "completed",
      requestedAt: timestamp,
      completedAt: timestamp,
      reversedMovementId: null,
      notes: input.notes,
      evidenceReference: null,
    };
    movementStore.set(movementId, movement);

    return { validation, reservation };
  } catch (error) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "reservation", message: (error as Error).message }],
      },
      reservation: null,
    };
  }
}

export function releaseInventoryReservation(input: {
  reservationId: string;
  actorReference: string;
}): {
  validation: InventoryValidationResult;
  reservation: InventoryReservationRecord | null;
} {
  const reservation = reservationStore.get(input.reservationId);

  if (!reservation) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "reservationId", message: "Reservation not found." }],
      },
      reservation: null,
    };
  }

  if (
    reservation.status === "released" ||
    reservation.status === "expired" ||
    reservation.status === "cancelled"
  ) {
    return {
      validation: { valid: true, issues: [] },
      reservation,
    };
  }

  if (reservation.status === "fulfilled") {
    return {
      validation: {
        valid: false,
        issues: [{ field: "status", message: "Fulfilled reservation cannot be released." }],
      },
      reservation: null,
    };
  }

  try {
    const product = requireProduct(reservation.organizationId, reservation.productId);
    const location = requireLocation(reservation.organizationId, reservation.locationId);
    const stock = getOrCreateStockRecord({
      organizationId: reservation.organizationId,
      product,
      location,
    });

    if (stock.reservedQuantity < reservation.quantity) {
      throw new Error("Invalid State Transition: reserved quantity is insufficient");
    }

    stock.reservedQuantity -= reservation.quantity;
    stock.lastMovementAt = nowIso();
    const updatedStock = applyStockState(stock, product);
    setStockRecord(updatedStock);

    const now = nowIso();
    const updatedReservation: InventoryReservationRecord = {
      ...reservation,
      status: "released",
      releasedAt: now,
      updatedAt: now,
    };

    reservationStore.set(updatedReservation.reservationId, updatedReservation);

    return {
      validation: { valid: true, issues: [] },
      reservation: updatedReservation,
    };
  } catch (error) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "release", message: (error as Error).message }],
      },
      reservation: null,
    };
  }
}

export function fulfillInventoryReservation(input: {
  reservationId: string;
  actorReference: string;
  correlationId: string | null;
}): {
  validation: InventoryValidationResult;
  reservation: InventoryReservationRecord | null;
  movement: InventoryMovementRecord | null;
} {
  const reservation = reservationStore.get(input.reservationId);

  if (!reservation) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "reservationId", message: "Reservation not found." }],
      },
      reservation: null,
      movement: null,
    };
  }

  if (reservation.status === "fulfilled") {
    return {
      validation: {
        valid: false,
        issues: [{ field: "status", message: "Reservation has already been fulfilled." }],
      },
      reservation: null,
      movement: null,
    };
  }

  if (reservation.status !== "active") {
    return {
      validation: {
        valid: false,
        issues: [{ field: "status", message: "Only active reservations can be fulfilled." }],
      },
      reservation: null,
      movement: null,
    };
  }

  const movementResult = createInventoryMovement({
    organizationId: reservation.organizationId,
    productId: reservation.productId,
    sourceLocationId: reservation.locationId,
    destinationLocationId: null,
    movementType: "issue",
    quantity: reservation.quantity,
    unitOfMeasure: reservation.unitOfMeasure,
    reasonCode: "reservation_fulfillment",
    referenceType: "reservation",
    referenceId: reservation.reservationId,
    actorReference: input.actorReference,
    correlationId: input.correlationId,
    idempotencyKey: null,
    notes: reservation.notes,
    evidenceReference: null,
  });

  if (!movementResult.validation.valid || !movementResult.movement) {
    return {
      validation: movementResult.validation,
      reservation: null,
      movement: null,
    };
  }

  const now = nowIso();
  const updatedReservation: InventoryReservationRecord = {
    ...reservation,
    status: "fulfilled",
    fulfilledAt: now,
    updatedAt: now,
  };

  reservationStore.set(updatedReservation.reservationId, updatedReservation);

  return {
    validation: { valid: true, issues: [] },
    reservation: updatedReservation,
    movement: movementResult.movement,
  };
}

export function expireInventoryReservations(asOf: string): number {
  let expired = 0;

  Array.from(reservationStore.values()).forEach((reservation) => {
    if (!reservation.expiresAt || reservation.status !== "active") {
      return;
    }

    if (reservation.expiresAt <= asOf) {
      const releaseResult = releaseInventoryReservation({
        reservationId: reservation.reservationId,
        actorReference: "system",
      });

      if (releaseResult.reservation) {
        reservationStore.set(reservation.reservationId, {
          ...releaseResult.reservation,
          status: "expired",
        });
        expired += 1;
      }
    }
  });

  return expired;
}

export function evaluateInventoryAvailability(input: {
  organizationId: string;
  productId: string;
  siteId: string | null;
}): InventoryAvailabilityResult {
  const product = requireProduct(input.organizationId, input.productId);

  const stocks = listInventoryStock().filter(
    (stock) =>
      stock.organizationId === input.organizationId &&
      stock.productId === input.productId,
  );

  const locationSummaries = stocks
    .map((stock) => {
      const location = getInventoryLocationById(stock.locationId);
      if (!location) {
        return null;
      }

      if (input.siteId && location.siteId !== input.siteId) {
        return null;
      }

      if (!location.enabled || location.lifecycleState === "archived" || location.lifecycleState === "suspended") {
        return null;
      }

      if (location.locationType === "damaged_goods") {
        return null;
      }

      return {
        locationId: stock.locationId,
        locationName: location.displayName,
        onHandQuantity: stock.onHandQuantity,
        reservedQuantity: stock.reservedQuantity,
        availableQuantity: stock.availableQuantity,
        incomingQuantity: stock.incomingQuantity,
        damagedQuantity: stock.damagedQuantity,
        inspectionHoldQuantity: stock.inspectionHoldQuantity,
        backorderedQuantity: stock.backorderedQuantity,
        stockStatus: stock.stockStatus,
        fulfillmentCapable: location.fulfillmentCapable,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const totals = locationSummaries.reduce(
    (acc, location) => {
      acc.onHand += location.onHandQuantity;
      acc.reserved += location.reservedQuantity;
      acc.available += location.availableQuantity;
      acc.incoming += location.incomingQuantity;
      acc.damaged += location.damagedQuantity;
      acc.hold += location.inspectionHoldQuantity;
      acc.backordered += location.backorderedQuantity;
      return acc;
    },
    {
      onHand: 0,
      reserved: 0,
      available: 0,
      incoming: 0,
      damaged: 0,
      hold: 0,
      backordered: 0,
    },
  );

  const aggregateRecord: InventoryStockRecord = {
    inventoryRecordId: "aggregate",
    organizationId: input.organizationId,
    productId: input.productId,
    locationId: "aggregate",
    siteId: input.siteId,
    skuSnapshot: product.sku,
    unitOfMeasure: "ea",
    onHandQuantity: totals.onHand,
    reservedQuantity: totals.reserved,
    availableQuantity: totals.available,
    incomingQuantity: totals.incoming,
    allocatedQuantity: 0,
    damagedQuantity: totals.damaged,
    inspectionHoldQuantity: totals.hold,
    backorderedQuantity: totals.backordered,
    reorderPoint: 0,
    reorderQuantity: 0,
    safetyStock: 0,
    maximumStock: null,
    stockStatus: "unknown",
    lastCountedAt: null,
    lastMovementAt: null,
    version: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const aggregateStatus = deriveStockStatus({
    stock: aggregateRecord,
    product,
  });

  const warnings: string[] = [];
  if (locationSummaries.length === 0) {
    warnings.push("No active inventory locations are eligible for this product/site scope.");
  }

  const blockingConditions: string[] = [];
  if (!product.enabled) {
    blockingConditions.push("Product is not enabled for active inventory workflows.");
  }

  return {
    productId: input.productId,
    siteId: input.siteId,
    locationSummaries,
    onHandTotal: totals.onHand,
    reservedTotal: totals.reserved,
    availableTotal: totals.available,
    incomingTotal: totals.incoming,
    damagedTotal: totals.damaged,
    inspectionHoldTotal: totals.hold,
    backorderedTotal: totals.backordered,
    stockStatus: aggregateStatus,
    fulfillmentLocationIds: locationSummaries
      .filter((location) => location.fulfillmentCapable)
      .map((location) => location.locationId),
    warnings,
    blockingConditions,
    evaluationTimestamp: nowIso(),
  };
}

export function evaluateInventoryReorder(input: {
  organizationId: string;
  productId: string;
  locationId: string;
}): InventoryReorderEvaluation {
  const product = requireProduct(input.organizationId, input.productId);
  const location = requireLocation(input.organizationId, input.locationId);
  const stock = findStockRecord(input.organizationId, input.productId, location.locationId);

  if (!stock) {
    return {
      productId: input.productId,
      locationId: input.locationId,
      reorderRecommended: false,
      suggestedReorderQuantity: 0,
      reason: "Inventory Record Not Found",
      warningLevel: "none",
      evaluationTimestamp: nowIso(),
    };
  }

  return evaluateReorder(stock, product);
}

export function createInventoryCount(input: {
  organizationId: string;
  locationId: string;
  productId: string;
  countedQuantity: number;
  actor: string;
}): {
  validation: InventoryValidationResult;
  count: InventoryCountRecord | null;
} {
  if (!Number.isInteger(input.countedQuantity) || input.countedQuantity < 0) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "countedQuantity", message: "Counted quantity must be a non-negative integer." }],
      },
      count: null,
    };
  }

  const stock = findStockRecord(input.organizationId, input.productId, input.locationId);
  const expected = stock?.onHandQuantity ?? 0;
  const variance = input.countedQuantity - expected;

  const count: InventoryCountRecord = {
    countId: createCountId(),
    organizationId: input.organizationId,
    locationId: input.locationId,
    productId: input.productId,
    expectedQuantity: expected,
    countedQuantity: input.countedQuantity,
    varianceQuantity: variance,
    status: "submitted",
    actor: input.actor,
    timestamp: nowIso(),
    adjustmentReference: null,
  };

  countStore.set(count.countId, count);

  return {
    validation: { valid: true, issues: [] },
    count,
  };
}

export function applyInventoryCount(input: {
  countId: string;
  actor: string;
}): {
  validation: InventoryValidationResult;
  count: InventoryCountRecord | null;
} {
  const count = countStore.get(input.countId);
  if (!count) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "countId", message: "Count not found." }],
      },
      count: null,
    };
  }

  if (count.status === "applied") {
    return {
      validation: {
        valid: false,
        issues: [{ field: "status", message: "Count has already been applied." }],
      },
      count: null,
    };
  }

  if (count.status !== "submitted" && count.status !== "approved") {
    return {
      validation: {
        valid: false,
        issues: [{ field: "status", message: "Only submitted or approved counts can be applied." }],
      },
      count: null,
    };
  }

  const stock = findStockRecord(count.organizationId, count.productId, count.locationId);
  if (!stock) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "stock", message: "Inventory Record Not Found" }],
      },
      count: null,
    };
  }

  const product = requireProduct(count.organizationId, count.productId);
  stock.onHandQuantity = count.countedQuantity;
  stock.lastCountedAt = nowIso();
  stock.lastMovementAt = nowIso();

  const updatedStock = applyStockState(stock, product);
  setStockRecord(updatedStock);

  const updatedCount: InventoryCountRecord = {
    ...count,
    status: "applied",
    adjustmentReference: `count-apply-${count.countId}`,
    timestamp: nowIso(),
  };

  countStore.set(count.countId, updatedCount);

  return {
    validation: { valid: true, issues: [] },
    count: updatedCount,
  };
}

export function getProductInventorySummary(productId: string): {
  productId: string;
  stocks: readonly InventoryStockRecord[];
  reservations: readonly InventoryReservationRecord[];
  movements: readonly InventoryMovementRecord[];
} {
  return {
    productId,
    stocks: listInventoryStock().filter((stock) => stock.productId === productId),
    reservations: listInventoryReservations().filter((reservation) => reservation.productId === productId),
    movements: listInventoryMovements().filter((movement) => movement.productId === productId).slice(0, 20),
  };
}

export function evaluateLocationAvailability(locationId: string): InventoryAvailabilityResult | null {
  const location = getInventoryLocationById(locationId);
  if (!location) {
    return null;
  }

  const productIds = new Set(
    listInventoryStock()
      .filter((stock) => stock.locationId === locationId)
      .map((stock) => stock.productId),
  );

  const summaries = Array.from(productIds).map((productId) =>
    evaluateInventoryAvailability({
      organizationId: location.organizationId,
      productId,
      siteId: location.siteId,
    }),
  );

  const aggregate = summaries.reduce(
    (acc, summary) => {
      acc.onHandTotal += summary.onHandTotal;
      acc.reservedTotal += summary.reservedTotal;
      acc.availableTotal += summary.availableTotal;
      acc.incomingTotal += summary.incomingTotal;
      acc.damagedTotal += summary.damagedTotal;
      acc.inspectionHoldTotal += summary.inspectionHoldTotal;
      acc.backorderedTotal += summary.backorderedTotal;
      return acc;
    },
    {
      onHandTotal: 0,
      reservedTotal: 0,
      availableTotal: 0,
      incomingTotal: 0,
      damagedTotal: 0,
      inspectionHoldTotal: 0,
      backorderedTotal: 0,
    },
  );

  return {
    productId: "location-aggregate",
    siteId: location.siteId,
    locationSummaries: [
      {
        locationId: location.locationId,
        locationName: location.displayName,
        onHandQuantity: aggregate.onHandTotal,
        reservedQuantity: aggregate.reservedTotal,
        availableQuantity: aggregate.availableTotal,
        incomingQuantity: aggregate.incomingTotal,
        damagedQuantity: aggregate.damagedTotal,
        inspectionHoldQuantity: aggregate.inspectionHoldTotal,
        backorderedQuantity: aggregate.backorderedTotal,
        stockStatus: aggregate.availableTotal > 0 ? "in_stock" : "out_of_stock",
        fulfillmentCapable: location.fulfillmentCapable,
      },
    ],
    onHandTotal: aggregate.onHandTotal,
    reservedTotal: aggregate.reservedTotal,
    availableTotal: aggregate.availableTotal,
    incomingTotal: aggregate.incomingTotal,
    damagedTotal: aggregate.damagedTotal,
    inspectionHoldTotal: aggregate.inspectionHoldTotal,
    backorderedTotal: aggregate.backorderedTotal,
    stockStatus: aggregate.availableTotal > 0 ? "in_stock" : "out_of_stock",
    fulfillmentLocationIds: location.fulfillmentCapable ? [location.locationId] : [],
    warnings: [],
    blockingConditions: [],
    evaluationTimestamp: nowIso(),
  };
}

export function resolveSiteForInventoryLocation(locationId: string): string | null {
  const location = getInventoryLocationById(locationId);
  if (!location || !location.siteId) {
    return null;
  }

  return getSiteById(location.siteId) ? location.siteId : null;
}

export function resetInventoryRepositoryForTests(): void {
  seedStores();
}
