import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { createGlwJobRecord, parseGlwJobRecord } from "@/lib/glw/jobs";

const root = process.cwd();
const schema = readFileSync(join(root, "prisma", "schema.prisma"), "utf8");
const migration = readFileSync(
  join(root, "prisma", "migrations", "20260817060000_hr004_slice1_callback_idempotency_foundation", "migration.sql"),
  "utf8",
);

describe("HR-004 Slice A schema foundation", () => {
  it("declares nullable legacy-compatible job fields and durable receipt uniqueness", () => {
    expect(schema).toContain("operationKey           String?                    @unique");
    expect(schema).toContain("businessStatus         GlwBusinessStatus?");
    expect(schema).toContain("callbackDeliveryStatus GlwCallbackDeliveryStatus?");
    expect(schema).toContain("model GlwCallbackReceipt");
    expect(schema).toContain("idempotencyKey     String                    @unique");
    expect(schema).toContain("terminalScopeKey   String                    @unique");
    expect(schema).toContain('previewFeatures = ["partialIndexes"]');
    expect(schema).toContain('@@index([idempotencyKey])');
    expect(schema).toContain('map: "GopJobEvent_jobId_idempotencyKey_unique_when_not_null"');
    expect(schema).toContain('where: raw("\\\"idempotencyKey\\\" IS NOT NULL")');
  });

  it("keeps the migration additive and preserves the existing event index authorities", () => {
    expect(migration).toContain('ALTER TABLE "GlwJob"');
    expect(migration).toContain('CREATE TABLE "GlwCallbackReceipt"');
    expect(migration).toContain('CREATE UNIQUE INDEX "GlwCallbackReceipt_idempotencyKey_key"');
    expect(migration).toContain('CREATE UNIQUE INDEX "GlwCallbackReceipt_terminalScopeKey_key"');
    expect(migration).not.toContain('GopJobEvent_idempotencyKey_idx');
    expect(migration).not.toContain('GopJobEvent_jobId_idempotencyKey_key');
    expect(migration).not.toContain('GopJobEvent_jobId_idempotencyKey_unique_when_not_null');
    expect(migration).not.toMatch(/DROP INDEX/i);
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|ALTER COLUMN|TRUNCATE|\bUPDATE\b|\bDELETE\b|\bINSERT\b/i);
  });

  it("does not encode or rewrite the historical incident", () => {
    expect(schema).not.toMatch(/glw_v0p6pmcv|74484|19483|19484/);
    expect(migration).not.toMatch(/glw_v0p6pmcv|74484|19483|19484/);
  });

  it("parses legacy rows and creates new records with dormant compatibility fields", () => {
    const legacy = parseGlwJobRecord({
      id: "legacy-job",
      type: "PAGE_GENERATION",
      status: "COMPLETE",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "Legacy",
      input: {},
      result: null,
      error: null,
      externalExecutionId: "123",
      startedAt: null,
      completedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    const created = createGlwJobRecord({
      type: "PAGE_GENERATION",
      status: "QUEUED",
      retryOfJobId: null,
      siteId: "led-display-warehouse",
      title: "New",
      input: {} as never,
      result: null,
      error: null,
      externalExecutionId: null,
      startedAt: null,
      completedAt: null,
    });

    for (const job of [legacy, created]) {
      expect(job.operationKey).toBeNull();
      expect(job.businessStatus).toBeNull();
      expect(job.callbackDeliveryStatus).toBeNull();
      expect(job.terminalReceiptId).toBeNull();
      expect(job.publicationKey).toBeNull();
    }
  });
});