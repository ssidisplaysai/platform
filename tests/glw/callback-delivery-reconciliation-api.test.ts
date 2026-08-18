import { afterEach, describe, expect, it, jest } from "@jest/globals";

jest.mock("server-only", () => ({}), { virtual: true });
jest.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }), { virtual: true });

import { handleGetGlwReconciliation, handlePostGlwReconciliation } from "@/lib/glw/callback-delivery-reconciliation-api";

const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; });
function session(email: string) { return async () => ({ email, expiresAt: Date.now() + 60_000 }); }
function service() { return { latest: jest.fn(async () => ({ run: null, discrepancies: [] })), run: jest.fn(async () => ({ outcome: "COMPLETED" as const, reconciliationRunId: "run", status: "CLEAN" as const, snapshotSkewMs: 0, discrepancies: [], autoRepairCount: 0 })) }; }
function request(method: string, body?: unknown, token?: string) { return new Request("http://localhost/api/glw/callback-delivery-reconciliation", { method, headers: { "Content-Type": "application/json", ...(token ? { "x-glw-reconciliation-token": token } : {}) }, body: body ? JSON.stringify(body) : undefined }); }

describe("HR-004 Slice F reconciliation API", () => {
  it("rejects unauthenticated read", async () => expect((await handleGetGlwReconciliation(request("GET"), { sessionLoader: async () => null, service: service() })).status).toBe(401));
  it("allows viewer read", async () => expect((await handleGetGlwReconciliation(request("GET"), { sessionLoader: session("viewer@example.test"), service: service() })).status).toBe(200));
  it("returns not-ready and not-closed before rollout evidence", async () => expect(await (await handleGetGlwReconciliation(request("GET"), { sessionLoader: session("viewer@example.test"), service: service() })).json()).toMatchObject({ rollout: { ready: false }, closure: { closed: false } }));
  it("denies viewer run", async () => expect((await handlePostGlwReconciliation(request("POST"), { sessionLoader: session("viewer@example.test"), service: service(), source: { commit: "c", tree: "t" } })).status).toBe(403));
  it("allows configured operator run", async () => { process.env.GLW_DELIVERY_OPERATOR_EMAILS = "operator@example.test"; expect((await handlePostGlwReconciliation(request("POST"), { sessionLoader: session("operator@example.test"), service: service(), source: { commit: "c", tree: "t" } })).status).toBe(200); });
  it("allows protected system token run", async () => expect((await handlePostGlwReconciliation(request("POST", { runType: "SCHEDULED" }, "token-value"), { sessionLoader: async () => null, systemToken: "token-value", service: service(), source: { commit: "c", tree: "t" } })).status).toBe(200));
  it("rejects invalid system token", async () => expect((await handlePostGlwReconciliation(request("POST", {}, "wrong"), { sessionLoader: async () => null, systemToken: "right", service: service() })).status).toBe(401));
  it("maps overlapping run to conflict", async () => { process.env.GLW_ADMIN_EMAIL = "admin@example.test"; const mock = service(); mock.run.mockResolvedValueOnce({ outcome: "ALREADY_RUNNING" } as never); expect((await handlePostGlwReconciliation(request("POST"), { sessionLoader: session("admin@example.test"), service: mock, source: { commit: "c", tree: "t" } })).status).toBe(409); });
  it("returns safe run summary without source actor", async () => { const mock = service(); mock.latest.mockResolvedValueOnce({ run: { reconciliationRunId: "run", triggeredBy: "secret-actor", status: "CLEAN", snapshotSkewMs: 0, discrepancyCount: 0, criticalCount: 0 }, discrepancies: [] }); const text = JSON.stringify(await (await handleGetGlwReconciliation(request("GET"), { sessionLoader: session("viewer@example.test"), service: mock })).json()); expect(text).not.toContain("secret-actor"); });
  it("returns only discrepancy class metadata", async () => { const mock = service(); mock.latest.mockResolvedValueOnce({ run: null, discrepancies: [{ discrepancyType: "TYPE", severity: "WARNING", repairAuthority: "OPS", autoRepairEligible: false }] }); expect(JSON.stringify(await (await handleGetGlwReconciliation(request("GET"), { sessionLoader: session("viewer@example.test"), service: mock })).json())).not.toMatch(/idempotencyKey|payload/i); });
  it("does not expose run discrepancies in POST response", async () => { const mock = service(); mock.run.mockResolvedValueOnce({ outcome: "COMPLETED", reconciliationRunId: "run", status: "DISCREPANCIES", snapshotSkewMs: 0, discrepancies: [{ severity: "CRITICAL", idempotencyKey: "raw" }], autoRepairCount: 0 } as never); process.env.GLW_DELIVERY_OPERATOR_EMAILS = "operator@example.test"; expect(JSON.stringify(await (await handlePostGlwReconciliation(request("POST"), { sessionLoader: session("operator@example.test"), service: mock, source: { commit: "c", tree: "t" } })).json())).not.toContain("raw"); });
  it("redacts database URLs from errors", async () => { const mock = service(); mock.latest.mockRejectedValueOnce(new Error("postgres" + "ql://user:pass@host/db") as never); expect(JSON.stringify(await (await handleGetGlwReconciliation(request("GET"), { sessionLoader: session("viewer@example.test"), service: mock })).json())).not.toContain("user:pass"); });
});
