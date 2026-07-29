import {
  createInventoryCount,
  createInventoryMovement,
  createInventoryReservation,
  evaluateInventoryAvailability,
  evaluateInventoryReorder,
  getInventoryStockById,
  listInventoryLocations,
  listInventoryStock,
  releaseInventoryReservation,
  resetInventoryRepositoryForTests,
  reverseInventoryMovement,
  validateInventoryLocations,
  fulfillInventoryReservation,
} from "@/modules/foundation/inventory-repository";
import { filterInventoryLocations } from "@/modules/foundation/inventory-selectors";
import { validateInventoryLocationHierarchy } from "@/modules/foundation/inventory-validation";
import type { InventoryLocationConfiguration } from "@/modules/foundation/types";

function findStock(productId: string, locationId: string) {
  return listInventoryStock().find(
    (stock) => stock.productId === productId && stock.locationId === locationId,
  );
}

describe("GCP-0002E inventory and availability foundation", () => {
  beforeEach(() => {
    resetInventoryRepositoryForTests();
  });

  test("initial location fixtures appear", () => {
    const locations = listInventoryLocations();
    expect(locations.some((location) => location.locationName === "SSI Main Warehouse")).toBe(true);
    expect(locations.some((location) => location.locationName === "In Transit")).toBe(true);
  });

  test("location search/filter works", () => {
    const filtered = filterInventoryLocations(listInventoryLocations(), {
      query: "virtual",
      enabled: true,
    });

    expect(filtered.length).toBe(1);
    expect(filtered[0]?.locationCode).toBe("LEDW-VIRTUAL-01");
  });

  test("invalid parent relationship is rejected", () => {
    const invalid: InventoryLocationConfiguration[] = [
      ...listInventoryLocations(),
      {
        ...listInventoryLocations()[0]!,
        locationId: "loc-invalid-parent",
        parentLocationId: "missing-parent",
      },
    ];

    const validation = validateInventoryLocationHierarchy(invalid);
    expect(validation.valid).toBe(false);
  });

  test("availability formula excludes reserved, allocated, damaged and hold quantities", () => {
    const stock = getInventoryStockById("stock-prod-indoor-led-video-wall-ssi");
    expect(stock).toBeDefined();
    expect(stock?.availableQuantity).toBe(20);
  });

  test("incoming quantity does not increase available quantity", () => {
    const stock = getInventoryStockById("stock-prod-transparent-oled-display-virtual");
    expect(stock).toBeDefined();
    expect(stock?.incomingQuantity).toBe(2);
    expect(stock?.availableQuantity).toBe(0);
  });

  test("negative quantity movement is rejected", () => {
    const result = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      sourceLocationId: "loc-ssi-main-warehouse",
      destinationLocationId: null,
      movementType: "issue",
      quantity: -1,
      unitOfMeasure: "ea",
      reasonCode: "invalid",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: null,
      idempotencyKey: null,
      notes: null,
      evidenceReference: null,
    });

    expect(result.validation.valid).toBe(false);
  });

  test("invalid product and location are rejected", () => {
    const invalidProduct = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-missing",
      sourceLocationId: "loc-ssi-main-warehouse",
      destinationLocationId: null,
      movementType: "issue",
      quantity: 1,
      unitOfMeasure: "ea",
      reasonCode: "invalid",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: null,
      idempotencyKey: null,
      notes: null,
      evidenceReference: null,
    });

    expect(invalidProduct.validation.valid).toBe(false);

    const invalidLocation = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      sourceLocationId: "loc-missing",
      destinationLocationId: null,
      movementType: "issue",
      quantity: 1,
      unitOfMeasure: "ea",
      reasonCode: "invalid",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: null,
      idempotencyKey: null,
      notes: null,
      evidenceReference: null,
    });

    expect(invalidLocation.validation.valid).toBe(false);
  });

  test("receipt increases on-hand quantity", () => {
    const before = findStock("prod-indoor-led-video-wall", "loc-ssi-main-warehouse")!;

    const result = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      sourceLocationId: null,
      destinationLocationId: "loc-ssi-main-warehouse",
      movementType: "receipt",
      quantity: 3,
      unitOfMeasure: "ea",
      reasonCode: "receipt",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: null,
      idempotencyKey: null,
      notes: null,
      evidenceReference: null,
    });

    expect(result.validation.valid).toBe(true);

    const after = findStock("prod-indoor-led-video-wall", "loc-ssi-main-warehouse")!;
    expect(after.onHandQuantity).toBe(before.onHandQuantity + 3);
  });

  test("issue decreases on-hand quantity and rejects insufficient inventory", () => {
    const before = findStock("prod-outdoor-led-video-wall", "loc-ssi-main-warehouse")!;

    const ok = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-outdoor-led-video-wall",
      sourceLocationId: "loc-ssi-main-warehouse",
      destinationLocationId: null,
      movementType: "issue",
      quantity: 2,
      unitOfMeasure: "ea",
      reasonCode: "issue",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: null,
      idempotencyKey: null,
      notes: null,
      evidenceReference: null,
    });

    expect(ok.validation.valid).toBe(true);

    const after = findStock("prod-outdoor-led-video-wall", "loc-ssi-main-warehouse")!;
    expect(after.onHandQuantity).toBe(before.onHandQuantity - 2);

    const insufficient = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-outdoor-led-video-wall",
      sourceLocationId: "loc-ssi-main-warehouse",
      destinationLocationId: null,
      movementType: "issue",
      quantity: 1000,
      unitOfMeasure: "ea",
      reasonCode: "issue",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: null,
      idempotencyKey: null,
      notes: null,
      evidenceReference: null,
    });

    expect(insufficient.validation.valid).toBe(false);
  });

  test("transfer updates source and destination and blocks same-location transfer", () => {
    const sourceBefore = findStock("prod-indoor-led-video-wall", "loc-ssi-main-warehouse")!;

    const transfer = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      sourceLocationId: "loc-ssi-main-warehouse",
      destinationLocationId: "loc-ledw-virtual-inventory",
      movementType: "transfer",
      quantity: 2,
      unitOfMeasure: "ea",
      reasonCode: "transfer",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: null,
      idempotencyKey: null,
      notes: null,
      evidenceReference: null,
    });

    expect(transfer.validation.valid).toBe(true);

    const sourceAfter = findStock("prod-indoor-led-video-wall", "loc-ssi-main-warehouse")!;
    const destinationAfter = findStock("prod-indoor-led-video-wall", "loc-ledw-virtual-inventory")!;

    expect(sourceAfter.onHandQuantity).toBe(sourceBefore.onHandQuantity - 2);
    expect(destinationAfter.onHandQuantity).toBe(2);

    const invalid = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      sourceLocationId: "loc-ssi-main-warehouse",
      destinationLocationId: "loc-ssi-main-warehouse",
      movementType: "transfer",
      quantity: 1,
      unitOfMeasure: "ea",
      reasonCode: "invalid",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: null,
      idempotencyKey: null,
      notes: null,
      evidenceReference: null,
    });

    expect(invalid.validation.valid).toBe(false);
  });

  test("movement reversal is controlled and cannot run twice", () => {
    const movement = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      sourceLocationId: null,
      destinationLocationId: "loc-ssi-main-warehouse",
      movementType: "receipt",
      quantity: 1,
      unitOfMeasure: "ea",
      reasonCode: "receipt",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: null,
      idempotencyKey: "idemp-reverse",
      notes: null,
      evidenceReference: null,
    });

    expect(movement.movement).toBeDefined();

    const reverse = reverseInventoryMovement({
      movementId: movement.movement!.movementId,
      actorReference: "tester",
      reasonCode: "reverse",
      correlationId: null,
    });

    expect(reverse.validation.valid).toBe(true);

    const reverseAgain = reverseInventoryMovement({
      movementId: movement.movement!.movementId,
      actorReference: "tester",
      reasonCode: "reverse-again",
      correlationId: null,
    });

    expect(reverseAgain.validation.valid).toBe(false);
  });

  test("movement idempotency key safely replays same movement", () => {
    const first = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      sourceLocationId: null,
      destinationLocationId: "loc-ssi-main-warehouse",
      movementType: "receipt",
      quantity: 1,
      unitOfMeasure: "ea",
      reasonCode: "receipt",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: "corr-1",
      idempotencyKey: "idempotency-1",
      notes: null,
      evidenceReference: null,
    });

    const replay = createInventoryMovement({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      sourceLocationId: null,
      destinationLocationId: "loc-ssi-main-warehouse",
      movementType: "receipt",
      quantity: 1,
      unitOfMeasure: "ea",
      reasonCode: "receipt",
      referenceType: null,
      referenceId: null,
      actorReference: "tester",
      correlationId: "corr-1",
      idempotencyKey: "idempotency-1",
      notes: null,
      evidenceReference: null,
    });

    expect(first.movement?.movementId).toBeDefined();
    expect(replay.movement?.movementId).toBe(first.movement?.movementId);
  });

  test("reservation reduces availability and release is idempotent", () => {
    const before = findStock("prod-indoor-led-video-wall", "loc-ssi-main-warehouse")!;

    const created = createInventoryReservation({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      locationId: "loc-ssi-main-warehouse",
      siteId: "site-led-display-warehouse-production",
      quantity: 2,
      unitOfMeasure: "ea",
      reservationType: "manual_hold",
      referenceType: "manual",
      referenceId: "hold-1",
      requestedBy: "tester",
      expiresAt: null,
      notes: null,
    });

    expect(created.validation.valid).toBe(true);
    const during = findStock("prod-indoor-led-video-wall", "loc-ssi-main-warehouse")!;
    expect(during.availableQuantity).toBe(before.availableQuantity - 2);

    const released = releaseInventoryReservation({
      reservationId: created.reservation!.reservationId,
      actorReference: "tester",
    });

    expect(released.validation.valid).toBe(true);

    const releasedAgain = releaseInventoryReservation({
      reservationId: created.reservation!.reservationId,
      actorReference: "tester",
    });

    expect(releasedAgain.validation.valid).toBe(true);
    const after = findStock("prod-indoor-led-video-wall", "loc-ssi-main-warehouse")!;
    expect(after.availableQuantity).toBe(before.availableQuantity);
  });

  test("reservation cannot exceed available quantity", () => {
    const fail = createInventoryReservation({
      organizationId: "led-display-warehouse",
      productId: "prod-outdoor-led-video-wall",
      locationId: "loc-ssi-main-warehouse",
      siteId: "site-led-display-warehouse-production",
      quantity: 999,
      unitOfMeasure: "ea",
      reservationType: "manual_hold",
      referenceType: null,
      referenceId: null,
      requestedBy: "tester",
      expiresAt: null,
      notes: null,
    });

    expect(fail.validation.valid).toBe(false);
  });

  test("fulfillment cannot be executed twice", () => {
    const reservation = createInventoryReservation({
      organizationId: "led-display-warehouse",
      productId: "prod-indoor-led-video-wall",
      locationId: "loc-ssi-main-warehouse",
      siteId: "site-led-display-warehouse-production",
      quantity: 1,
      unitOfMeasure: "ea",
      reservationType: "manual_hold",
      referenceType: null,
      referenceId: null,
      requestedBy: "tester",
      expiresAt: null,
      notes: null,
    });

    expect(reservation.reservation).toBeDefined();

    const fulfilled = fulfillInventoryReservation({
      reservationId: reservation.reservation!.reservationId,
      actorReference: "tester",
      correlationId: null,
    });

    expect(fulfilled.validation.valid).toBe(true);

    const second = fulfillInventoryReservation({
      reservationId: reservation.reservation!.reservationId,
      actorReference: "tester",
      correlationId: null,
    });

    expect(second.validation.valid).toBe(false);
  });

  test("availability and reorder indicators are deterministic", () => {
    const availability = evaluateInventoryAvailability({
      organizationId: "led-display-warehouse",
      productId: "prod-outdoor-led-video-wall",
      siteId: "site-led-display-warehouse-production",
    });

    expect(availability.locationSummaries.length).toBeGreaterThan(0);
    expect(availability.stockStatus === "low_stock" || availability.stockStatus === "in_stock" || availability.stockStatus === "out_of_stock").toBe(true);

    const reorder = evaluateInventoryReorder({
      organizationId: "led-display-warehouse",
      productId: "prod-outdoor-led-video-wall",
      locationId: "loc-ssi-main-warehouse",
    });

    expect(reorder.reorderRecommended).toBe(true);
    expect(reorder.suggestedReorderQuantity).toBeGreaterThan(0);
  });

  test("count foundation supports submission", () => {
    const result = createInventoryCount({
      organizationId: "led-display-warehouse",
      locationId: "loc-ssi-main-warehouse",
      productId: "prod-indoor-led-video-wall",
      countedQuantity: 22,
      actor: "tester",
    });

    expect(result.validation.valid).toBe(true);
    expect(result.count?.status).toBe("submitted");
  });

  test("location hierarchy baseline passes", () => {
    const validation = validateInventoryLocations();
    expect(validation.valid).toBe(true);
  });
});
