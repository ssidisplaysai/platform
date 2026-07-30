import { NextRequest } from "next/server";
import { GET as getInventory } from "@/app/api/inventory/route";
import { GET as getAvailability } from "@/app/api/inventory/availability/route";
import { GET as getLocations } from "@/app/api/inventory/locations/route";
import { POST as postMovement } from "@/app/api/inventory/movements/route";
import { POST as reverseMovement } from "@/app/api/inventory/movements/[movementId]/reverse/route";
import { POST as postReservation } from "@/app/api/inventory/reservations/route";
import { POST as releaseReservation } from "@/app/api/inventory/reservations/[reservationId]/release/route";
import { POST as postCount } from "@/app/api/inventory/counts/route";
import { resetInventoryRepositoryForTests } from "@/modules/foundation/inventory-repository";

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

describe("GCP-0002E inventory API auth and behavior", () => {
  beforeEach(() => {
    resetInventoryRepositoryForTests();
  });

  test("read endpoints enforce authorization", async () => {
    const inventory = await getInventory();
    expect(inventory.status).toBe(200);

    const locationsForbidden = await getLocations(request("http://localhost/api/inventory/locations", {
      headers: { "x-gcp-roles": "viewer" },
    }));
    expect(locationsForbidden.status).toBe(403);

    const locationsAllowed = await getLocations(request("http://localhost/api/inventory/locations", {
      headers: { "x-gcp-roles": "ops_manager" },
    }));
    expect(locationsAllowed.status).toBe(200);
  });

  test("availability endpoint validates required query params", async () => {
    const bad = await getAvailability(request("http://localhost/api/inventory/availability", {
      headers: { "x-gcp-roles": "ops_manager" },
    }));

    expect(bad.status).toBe(400);

    const good = await getAvailability(request("http://localhost/api/inventory/availability?organizationId=led-display-warehouse&productId=prod-indoor-led-video-wall", {
      headers: { "x-gcp-roles": "ops_manager" },
    }));

    expect(good.status).toBe(200);
  });

  test("viewer cannot create movement; ops_manager can", async () => {
    const payload = {
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
      idempotencyKey: "api-idem-1",
      notes: null,
      evidenceReference: null,
    };

    const denied = await postMovement(request("http://localhost/api/inventory/movements", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "viewer" },
      body: JSON.stringify(payload),
    }));

    expect(denied.status).toBe(403);

    const allowed = await postMovement(request("http://localhost/api/inventory/movements", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager" },
      body: JSON.stringify(payload),
    }));

    expect(allowed.status).toBe(201);
  });

  test("movement reversal enforces role and state", async () => {
    const created = await postMovement(request("http://localhost/api/inventory/movements", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager" },
      body: JSON.stringify({
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
        idempotencyKey: null,
        notes: null,
        evidenceReference: null,
      }),
    }));

    const payload = (await created.json()) as { movement: { movementId: string } };

    const denied = await reverseMovement(request(`http://localhost/api/inventory/movements/${payload.movement.movementId}/reverse`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "viewer" },
      body: JSON.stringify({ actorReference: "tester", reasonCode: "reverse" }),
    }), {
      params: Promise.resolve({ movementId: payload.movement.movementId }),
    });

    expect(denied.status).toBe(403);

    const allowed = await reverseMovement(request(`http://localhost/api/inventory/movements/${payload.movement.movementId}/reverse`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager" },
      body: JSON.stringify({ actorReference: "tester", reasonCode: "reverse" }),
    }), {
      params: Promise.resolve({ movementId: payload.movement.movementId }),
    });

    expect(allowed.status).toBe(200);
  });

  test("reservation create and release enforce permissions", async () => {
    const denied = await postReservation(request("http://localhost/api/inventory/reservations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "viewer" },
      body: JSON.stringify({}),
    }));

    expect(denied.status).toBe(403);

    const created = await postReservation(request("http://localhost/api/inventory/reservations", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager" },
      body: JSON.stringify({
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
      }),
    }));

    expect(created.status).toBe(201);
    const payload = (await created.json()) as { reservation: { reservationId: string } };

    const deniedRelease = await releaseReservation(request(`http://localhost/api/inventory/reservations/${payload.reservation.reservationId}/release`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "viewer" },
      body: JSON.stringify({ actorReference: "tester" }),
    }), {
      params: Promise.resolve({ reservationId: payload.reservation.reservationId }),
    });

    expect(deniedRelease.status).toBe(403);

    const allowedRelease = await releaseReservation(request(`http://localhost/api/inventory/reservations/${payload.reservation.reservationId}/release`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager" },
      body: JSON.stringify({ actorReference: "tester" }),
    }), {
      params: Promise.resolve({ reservationId: payload.reservation.reservationId }),
    });

    expect(allowedRelease.status).toBe(200);
  });

  test("count submit and apply enforce separate permissions", async () => {
    const deniedSubmit = await postCount(request("http://localhost/api/inventory/counts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "viewer" },
      body: JSON.stringify({
        mode: "submit",
        organizationId: "led-display-warehouse",
        locationId: "loc-ssi-main-warehouse",
        productId: "prod-indoor-led-video-wall",
        countedQuantity: 20,
        actor: "tester",
      }),
    }));

    expect(deniedSubmit.status).toBe(403);

    const submitted = await postCount(request("http://localhost/api/inventory/counts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "company_operator" },
      body: JSON.stringify({
        mode: "submit",
        organizationId: "led-display-warehouse",
        locationId: "loc-ssi-main-warehouse",
        productId: "prod-indoor-led-video-wall",
        countedQuantity: 20,
        actor: "tester",
      }),
    }));

    expect(submitted.status).toBe(201);

    const payload = (await submitted.json()) as { count: { countId: string } };

    const deniedApply = await postCount(request("http://localhost/api/inventory/counts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "company_operator" },
      body: JSON.stringify({ mode: "apply", countId: payload.count.countId, actor: "tester" }),
    }));

    expect(deniedApply.status).toBe(403);

    const allowedApply = await postCount(request("http://localhost/api/inventory/counts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager" },
      body: JSON.stringify({ mode: "apply", countId: payload.count.countId, actor: "tester" }),
    }));

    expect(allowedApply.status).toBe(200);
  });
});
