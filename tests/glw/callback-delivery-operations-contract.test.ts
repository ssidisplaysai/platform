import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "@jest/globals";
import { createGenesisAuthorizationSubjectFromIdentity } from "@/platform/gop/auth/authorization";
import { resolveGlwDeliveryAuthorizationClass, safeDeliveryReference, sanitizeDeliveryOperatorText } from "@/lib/glw/callback-delivery-operations";

const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; });

describe("HR-004 Slice E delivery operations contract", () => {
  it("creates stable opaque delivery references", () => {
    expect(safeDeliveryReference("identity")).toMatch(/^sha256:[0-9a-f]{16}$/);
    expect(safeDeliveryReference("identity")).toBe(safeDeliveryReference("identity"));
  });
  it("does not expose source identity in a safe reference", () => expect(safeDeliveryReference("sensitive-identity")).not.toContain("sensitive"));
  it("redacts bearer diagnostics", () => expect(sanitizeDeliveryOperatorText(["Bearer", "synthetic-value"].join(" "))).toBe("Bearer [REDACTED]"));
  it("redacts database diagnostics", () => expect(sanitizeDeliveryOperatorText("postgres" + "ql://user:pass@host/db")).toBe("[REDACTED_DATABASE_URL]"));
  it("rejects short operator reasons", () => expect(() => sanitizeDeliveryOperatorText("no", 3)).toThrow("reason"));
  it("bounds operator reasons", () => expect(sanitizeDeliveryOperatorText("x".repeat(1200))).toHaveLength(1000));
  it("maps configured admin to administrator", () => {
    process.env.GLW_ADMIN_EMAIL = "admin@example.test";
    const subject = createGenesisAuthorizationSubjectFromIdentity({ actorId: "admin@example.test", actorName: "admin", email: "admin@example.test", expiresAt: Date.now() + 1000 });
    expect(resolveGlwDeliveryAuthorizationClass(subject)).toBe("ADMINISTRATOR");
  });
  it("maps configured manager to recovery approver", () => {
    process.env.GLW_DELIVERY_RECOVERY_APPROVER_EMAILS = "approver@example.test";
    const subject = createGenesisAuthorizationSubjectFromIdentity({ actorId: "approver@example.test", actorName: "approver", email: "approver@example.test", expiresAt: Date.now() + 1000 });
    expect(resolveGlwDeliveryAuthorizationClass(subject)).toBe("RECOVERY_APPROVER");
  });
  it("maps configured operator to operator", () => {
    process.env.GLW_DELIVERY_OPERATOR_EMAILS = "operator@example.test";
    const subject = createGenesisAuthorizationSubjectFromIdentity({ actorId: "operator@example.test", actorName: "operator", email: "operator@example.test", expiresAt: Date.now() + 1000 });
    expect(resolveGlwDeliveryAuthorizationClass(subject)).toBe("OPERATOR");
  });
  it("defaults unknown identity to viewer", () => {
    const subject = createGenesisAuthorizationSubjectFromIdentity({ actorId: "viewer@example.test", actorName: "viewer", email: "viewer@example.test", expiresAt: Date.now() + 1000 });
    expect(resolveGlwDeliveryAuthorizationClass(subject)).toBe("VIEWER");
  });
  it.each([
    "GlwProducerDeliveryEscalation",
    "GlwProducerDeliveryOperatorAction",
    "GlwProducerDeliveryRecoveryAuthorization",
    "GlwProducerDeliveryRecoveryAttempt",
    "GlwProducerDeliveryWorkerHeartbeat",
  ])("declares frozen entity %s", async (entity) => {
    const sql = await readFile(join(process.cwd(), "n8n/hr004/glw-producer-delivery-operations.sql"), "utf8");
    expect(sql).toContain(`CREATE TABLE "${entity}"`);
  });
  it("contains no destructive DDL", async () => {
    const sql = await readFile(join(process.cwd(), "n8n/hr004/glw-producer-delivery-operations.sql"), "utf8");
    expect(sql).not.toMatch(/DROP\s+TABLE|DROP\s+COLUMN|TRUNCATE|DELETE\s+FROM/i);
  });
  it("keeps callback body out of operator action schema", async () => {
    const sql = await readFile(join(process.cwd(), "n8n/hr004/glw-producer-delivery-operations.sql"), "utf8");
    const audit = sql.slice(sql.indexOf('CREATE TABLE "GlwProducerDeliveryOperatorAction"'));
    expect(audit.split('CREATE FUNCTION')[0]).not.toMatch(/requestBodyUtf8|canonicalPayload/);
  });
  it("freezes separate recovery attempt budget", async () => {
    const sql = await readFile(join(process.cwd(), "n8n/hr004/glw-producer-delivery-operations.sql"), "utf8");
    expect(sql).toContain('"attemptNumber" BETWEEN 1 AND 12');
    expect(sql).toContain('"attemptCount" BETWEEN 0 AND 12');
  });
});
