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

function authHeaders(input: {
  role?: "platform_admin" | "ops_manager" | "company_operator" | "analyst" | "viewer";
  organizationId?: string;
  siteId?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {};

  if (input.role) {
    headers["x-gcp-roles"] = input.role;
  }
  if (input.organizationId) {
    headers["x-gcp-organization-id"] = input.organizationId;
  }
  if (input.siteId) {
    headers["x-gcp-site-id"] = input.siteId;
  }

  return headers;
}

describe("GCP-0002E inventory API auth and behavior", () => {
  beforeEach(() => {
    resetInventoryRepositoryForTests();
  });

  test("read endpoints enforce authorization", async () => {
    const noAuthInventory = await getInventory(request("http://localhost/api/inventory"));
    expect(noAuthInventory.status).toBe(401);

    const inventory = await getInventory(request("http://localhost/api/inventory", {
      headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
    }));
    expect(inventory.status).toBe(200);

    const locationsForbidden = await getLocations(request("http://localhost/api/inventory/locations", {
      headers: authHeaders({ role: "viewer", organizationId: "led-display-warehouse" }),
    }));
    expect(locationsForbidden.status).toBe(403);

    const locationsAllowed = await getLocations(request("http://localhost/api/inventory/locations", {
      headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
    }));
    expect(locationsAllowed.status).toBe(200);
  });

  test("availability endpoint validates required query params", async () => {
    const bad = await getAvailability(request("http://localhost/api/inventory/availability", {
      headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
    }));

    expect(bad.status).toBe(400);

    const good = await getAvailability(request("http://localhost/api/inventory/availability?organizationId=led-display-warehouse&productId=prod-indoor-led-video-wall", {
      headers: authHeaders({ role: "ops_manager", organizationId: "led-display-warehouse" }),
    }));

    expect(good.status).toBe(200);
  });

  test("availability endpoint rejects cross-organization scope mismatch", async () => {
    const response = await getAvailability(request("http://localhost/api/inventory/availability?organizationId=led-display-warehouse&productId=prod-indoor-led-video-wall", {
      headers: authHeaders({ role: "ops_manager", organizationId: "other-org" }),
    }));

    expect(response.status).toBe(403);
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
