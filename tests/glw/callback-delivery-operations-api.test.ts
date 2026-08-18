import { afterEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }), { virtual: true });

import { handleGetGlwCallbackDeliveries, handlePostGlwCallbackDeliveries } from "@/lib/glw/callback-delivery-operations-api";

const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; });

function session(email: string) { return async () => ({ email, expiresAt: Date.now() + 60_000 }); }
function service() {
  return {
    refreshEscalations: jest.fn(async () => 0),
    listDeliveries: jest.fn(async () => ({ generatedAt: new Date().toISOString(), operationalStatus: "HEALTHY" as const, metrics: {}, deliveries: [] })),
    getDeliveryHistory: jest.fn(async () => ({ attempts: [], actions: [], recoveries: [] })),
    executeAction: jest.fn(async (input: unknown) => input),
  };
}
function request(method: string, body?: unknown, query = "") {
  return new Request(`http://localhost/api/glw/callback-deliveries${query}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
}

describe("HR-004 Slice E delivery operations API", () => {
  it("rejects unauthenticated list", async () => expect((await handleGetGlwCallbackDeliveries(request("GET"), { sessionLoader: async () => null, service: service() })).status).toBe(401));
  it("allows viewer safe list", async () => expect((await handleGetGlwCallbackDeliveries(request("GET"), { sessionLoader: session("viewer@example.test"), service: service() })).status).toBe(200));
  it("returns viewer permissions", async () => expect(await (await handleGetGlwCallbackDeliveries(request("GET"), { sessionLoader: session("viewer@example.test"), service: service() })).json()).toMatchObject({ permissions: { canOperate: false, canApproveRecovery: false } }));
  it("routes safe history lookup", async () => {
    const mock = service();
    expect((await handleGetGlwCallbackDeliveries(request("GET", undefined, "?idempotencyKey=sha256%3Aabc"), { sessionLoader: session("viewer@example.test"), service: mock })).status).toBe(200);
    expect(mock.getDeliveryHistory).toHaveBeenCalledWith("sha256:abc");
  });
  it("requires action and reason", async () => expect((await handlePostGlwCallbackDeliveries(request("POST", {}), { sessionLoader: session("viewer@example.test"), service: service() })).status).toBe(400));
  it("denies viewer recovery request", async () => expect((await handlePostGlwCallbackDeliveries(request("POST", { action: "REQUEST_RECOVERY", reason: "documented reason" }), { sessionLoader: session("viewer@example.test"), service: service() })).status).toBe(403));
  it("allows configured operator recovery request", async () => {
    process.env.GLW_DELIVERY_OPERATOR_EMAILS = "operator@example.test";
    expect((await handlePostGlwCallbackDeliveries(request("POST", { action: "REQUEST_RECOVERY", reason: "documented reason", idempotencyKey: "sha256:abc" }), { sessionLoader: session("operator@example.test"), service: service() })).status).toBe(200);
  });
  it("denies operator approval", async () => {
    process.env.GLW_DELIVERY_OPERATOR_EMAILS = "operator@example.test";
    expect((await handlePostGlwCallbackDeliveries(request("POST", { action: "APPROVE_RECOVERY", reason: "documented reason" }), { sessionLoader: session("operator@example.test"), service: service() })).status).toBe(403);
  });
  it("allows configured approver approval", async () => {
    process.env.GLW_DELIVERY_RECOVERY_APPROVER_EMAILS = "approver@example.test";
    expect((await handlePostGlwCallbackDeliveries(request("POST", { action: "APPROVE_RECOVERY", reason: "documented reason" }), { sessionLoader: session("approver@example.test"), service: service() })).status).toBe(200);
  });
  it("allows administrator approval", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.test";
    expect((await handlePostGlwCallbackDeliveries(request("POST", { action: "APPROVE_RECOVERY", reason: "documented reason" }), { sessionLoader: session("admin@example.test"), service: service() })).status).toBe(200);
  });
  it.each(["ACKNOWLEDGE_ESCALATION", "ASSIGN_ESCALATION", "COMMENT", "CLOSE_ESCALATION"] as const)("allows operator action %s", async (action) => {
    process.env.GLW_DELIVERY_OPERATOR_EMAILS = "operator@example.test";
    expect((await handlePostGlwCallbackDeliveries(request("POST", { action, reason: "documented reason" }), { sessionLoader: session("operator@example.test"), service: service() })).status).toBe(200);
  });
  it("maps self approval conflict safely", async () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.test";
    const mock = service();
    mock.executeAction.mockRejectedValueOnce(new Error("GLW_DELIVERY_SELF_APPROVAL_FORBIDDEN") as never);
    expect((await handlePostGlwCallbackDeliveries(request("POST", { action: "APPROVE_RECOVERY", reason: "documented reason" }), { sessionLoader: session("admin@example.test"), service: mock })).status).toBe(409);
  });
  it("maps stale state safely", async () => {
    process.env.GLW_DELIVERY_OPERATOR_EMAILS = "operator@example.test";
    const mock = service();
    mock.executeAction.mockRejectedValueOnce(new Error("GLW_DELIVERY_STALE_OPERATOR_STATE") as never);
    expect((await handlePostGlwCallbackDeliveries(request("POST", { action: "COMMENT", reason: "documented reason" }), { sessionLoader: session("operator@example.test"), service: mock })).status).toBe(409);
  });
  it("redacts database URL from errors", async () => {
    const mock = service();
    mock.listDeliveries.mockRejectedValueOnce(new Error("postgres" + "ql://user:pass@host/db") as never);
    const response = await handleGetGlwCallbackDeliveries(request("GET"), { sessionLoader: session("viewer@example.test"), service: mock });
    expect(JSON.stringify(await response.json())).not.toContain("user:pass");
  });
  it("never returns a callback body from the list mock", async () => {
    const response = await handleGetGlwCallbackDeliveries(request("GET"), { sessionLoader: session("viewer@example.test"), service: service() });
    expect(JSON.stringify(await response.json())).not.toMatch(/requestBodyUtf8|canonicalPayload/);
  });
});
