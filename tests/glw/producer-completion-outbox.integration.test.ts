import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Pool, type PoolClient } from "pg";
import { buildGlwProducerTerminalPayload } from "@/lib/glw/producer-callback-contract";

const databaseUrl = process.env.HR004_SLICE_C_PRODUCER_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

type EnqueueInput = {
  operationKey: string;
  publicationKey: string;
  jobId: string;
  executionId: string;
  terminalStatus: "COMPLETE" | "FAILED_QA" | "FAILED";
  idempotencyKey: string;
  terminalScopeKey: string;
  canonicalPayload: Record<string, unknown>;
  payloadSha256: string;
};

function input(overrides: Partial<EnqueueInput> = {}): EnqueueInput {
  const semantic = {
    jobId: overrides.jobId ?? "test_hr004_slice_c_job",
    executionId: overrides.executionId ?? "execution-1",
    status: overrides.terminalStatus ?? "FAILED",
    error: { code: "TEST", message: "Synthetic failure.", step: "qa" },
  } as const;
  const payload = buildGlwProducerTerminalPayload(semantic, overrides.operationKey ?? "glw-op-v1:operation-1");
  return {
    operationKey: payload.operationKey,
    publicationKey: overrides.publicationKey ?? "glw-publication-v1:publication-1",
    jobId: payload.jobId,
    executionId: payload.executionId,
    terminalStatus: payload.status as EnqueueInput["terminalStatus"],
    idempotencyKey: overrides.idempotencyKey ?? payload.idempotencyKey,
    terminalScopeKey: overrides.terminalScopeKey ?? payload.terminalScopeKey,
    canonicalPayload: payload as unknown as Record<string, unknown>,
    payloadSha256: overrides.payloadSha256 ?? payload.payloadSha256,
    ...overrides,
  };
}

async function enqueue(pool: Pool, value: EnqueueInput) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const result = await client.query<{ outcome: string; operationKey: string; idempotencyKey: string }>({
        text: `SELECT * FROM "enqueueGlwProducerCompletion"($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13::jsonb)`,
        values: [
          value.operationKey,
          value.publicationKey,
          value.jobId,
          value.executionId,
          value.terminalStatus,
          value.idempotencyKey,
          value.terminalScopeKey,
          JSON.stringify(value.canonicalPayload),
          value.payloadSha256,
          "12004",
          "https://example.test/page/",
          16,
          JSON.stringify({ disposition: "FAILED" }),
        ],
      });
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "40001" && code !== "40P01") {
        throw error;
      }
      lastError = error;
    } finally {
      client.release();
    }
  }
  throw lastError;
}

async function counts(client: Pool | PoolClient) {
  const result = await client.query(`
    SELECT
      (SELECT count(*)::int FROM "GlwProducerOperation") AS operations,
      (SELECT count(*)::int FROM "GlwProducerPublication") AS publications,
      (SELECT count(*)::int FROM "GlwProducerCompletion") AS completions,
      (SELECT count(*)::int FROM "GlwProducerOutbox") AS outbox
  `);
  return result.rows[0];
}

describeDatabase("HR-004 Slice C producer PostgreSQL", () => {
  let pool: Pool;

  jest.setTimeout(30_000);

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 20 });
    const ddl = await readFile(join(process.cwd(), "n8n/hr004/glw-producer-completion-outbox.sql"), "utf8");
    await pool.query(ddl);
    const identity = await pool.query(`SELECT current_database() AS database, inet_server_port() AS port`);
    expect(identity.rows[0]).toEqual({ database: "genesis_hr004_slice_c_producer_test_9a15a", port: 55433 });
  });

  beforeEach(async () => {
    await pool.query(`TRUNCATE "GlwProducerOutbox", "GlwProducerCompletion", "GlwProducerPublication", "GlwProducerOperation"`);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it("creates the four producer authority tables", async () => {
    const result = await pool.query(`SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'GlwProducer%'`);
    expect(result.rows[0].count).toBe(4);
  });

  it("creates unique operation, publication, idempotency, and terminal-scope authorities", async () => {
    const result = await pool.query(`SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname='public' AND indexdef LIKE '%UNIQUE%' AND tablename LIKE 'GlwProducer%'`);
    expect(result.rows[0].count).toBeGreaterThanOrEqual(8);
  });

  it("requires SERIALIZABLE callers", async () => {
    await expect(pool.query(`SELECT * FROM "enqueueGlwProducerCompletion"('op','pub','job','exec','FAILED','key','scope','{}','${"0".repeat(64)}')`))
      .rejects.toThrow("GLW_PRODUCER_SERIALIZABLE_REQUIRED");
  });

  it("atomically enqueues one completion and outbox row", async () => {
    expect(await enqueue(pool, input())).toMatchObject({ outcome: "ENQUEUED" });
    expect(await counts(pool)).toEqual({ operations: 1, publications: 1, completions: 1, outbox: 1 });
  });

  it("stores an immutable pending outbox payload", async () => {
    await enqueue(pool, input());
    const result = await pool.query(`SELECT "deliveryStatus", "canonicalPayload", "payloadSha256" FROM "GlwProducerOutbox"`);
    expect(result.rows[0]).toMatchObject({ deliveryStatus: "PENDING", payloadSha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });

  it("returns the existing row for an exact duplicate", async () => {
    const value = input();
    await enqueue(pool, value);
    expect(await enqueue(pool, value)).toMatchObject({ outcome: "ALREADY_ENQUEUED" });
    expect(await counts(pool)).toEqual({ operations: 1, publications: 1, completions: 1, outbox: 1 });
  });

  it("rejects a changed payload hash without overwrite", async () => {
    const value = input();
    await enqueue(pool, value);
    await expect(enqueue(pool, { ...value, payloadSha256: "f".repeat(64) })).rejects.toThrow("GLW_PRODUCER_COMPLETION_CONFLICT");
    expect((await pool.query(`SELECT "payloadSha256" FROM "GlwProducerCompletion"`)).rows[0].payloadSha256).toBe(value.payloadSha256);
  });

  it("rejects a conflicting terminal status", async () => {
    const value = input();
    await enqueue(pool, value);
    await expect(enqueue(pool, { ...value, terminalStatus: "COMPLETE" })).rejects.toThrow("GLW_PRODUCER_COMPLETION_CONFLICT");
  });

  it("rejects a publication identity claimed by another operation", async () => {
    await enqueue(pool, input());
    await expect(enqueue(pool, input({ operationKey: "glw-op-v1:operation-2", publicationKey: "glw-publication-v1:publication-1" }))).rejects.toThrow();
  });

  it.each([
    ["GlwProducerOperation", "jobId"],
    ["GlwProducerPublication", "wordpressUrl"],
    ["GlwProducerCompletion", "terminalStatus"],
    ["GlwProducerOutbox", "payloadSha256"],
  ])("rejects mutation of immutable %s.%s", async (table, column) => {
    await enqueue(pool, input());
    await expect(pool.query(`UPDATE "${table}" SET "${column}" = $1`, [column === "terminalStatus" ? "COMPLETE" : "changed"]))
      .rejects.toThrow("GLW_PRODUCER_IMMUTABLE_RECORD");
  });

  it("rejects completion without its outbox at commit", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`INSERT INTO "GlwProducerOperation" ("operationKey","jobId") VALUES ('op','job')`);
      await client.query(`INSERT INTO "GlwProducerCompletion" ("operationKey","idempotencyKey","terminalScopeKey","jobId","externalExecutionId","callbackVersion","callbackType","terminalStatus","canonicalPayload","payloadSha256","businessWorkStatus") VALUES ('op','key','scope','job','exec','2','PAGE_GENERATION_TERMINAL','FAILED','{}',$1,'FAILED')`, ["0".repeat(64)]);
      await expect(client.query("COMMIT")).rejects.toThrow("GLW_PRODUCER_COMPLETION_OUTBOX_REQUIRED");
    } finally {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
  });

  it("rolls back operation and publication when completion insert fails", async () => {
    await expect(enqueue(pool, { ...input(), payloadSha256: "invalid" })).rejects.toThrow();
    expect(await counts(pool)).toEqual({ operations: 0, publications: 0, completions: 0, outbox: 0 });
  });

  it("replays as new after an explicit rollback", async () => {
    const client = await pool.connect();
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query(`INSERT INTO "GlwProducerOperation" ("operationKey","jobId") VALUES ('rolled-back','job')`);
    await client.query("ROLLBACK");
    client.release();
    expect(await enqueue(pool, input({ operationKey: "rolled-back" }))).toMatchObject({ outcome: "ENQUEUED" });
  });

  it("loads a committed pending row from a new pool", async () => {
    await enqueue(pool, input());
    const restarted = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      expect((await restarted.query(`SELECT "deliveryStatus" FROM "GlwProducerOutbox"`)).rows[0].deliveryStatus).toBe("PENDING");
    } finally {
      await restarted.end();
    }
  });

  it("keeps pending rows unchanged without Slice D", async () => {
    await enqueue(pool, input());
    const before = await pool.query(`SELECT * FROM "GlwProducerOutbox"`);
    const after = await pool.query(`SELECT * FROM "GlwProducerOutbox"`);
    expect(after.rows).toEqual(before.rows);
    expect(after.rows[0]).not.toHaveProperty("attemptCount");
  });

  it("serializes two simultaneous identical enqueues", async () => {
    const value = input();
    const results = await Promise.all([enqueue(pool, value), enqueue(pool, value)]);
    expect(results.map((result) => result.outcome).sort()).toEqual(["ALREADY_ENQUEUED", "ENQUEUED"]);
    expect(await counts(pool)).toEqual({ operations: 1, publications: 1, completions: 1, outbox: 1 });
  });

  it("serializes three simultaneous identical enqueues", async () => {
    const value = input();
    const results = await Promise.all([enqueue(pool, value), enqueue(pool, value), enqueue(pool, value)]);
    expect(results.filter((result) => result.outcome === "ENQUEUED")).toHaveLength(1);
    expect(results.filter((result) => result.outcome === "ALREADY_ENQUEUED")).toHaveLength(2);
  });

  it("selects one winner for simultaneous conflicting payloads", async () => {
    const value = input();
    const results = await Promise.allSettled([enqueue(pool, value), enqueue(pool, { ...value, payloadSha256: "f".repeat(64) })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await counts(pool)).toEqual({ operations: 1, publications: 1, completions: 1, outbox: 1 });
  });

  it("selects one winner for simultaneous publication claims", async () => {
    const results = await Promise.allSettled([
      enqueue(pool, input()),
      enqueue(pool, input({ operationKey: "glw-op-v1:operation-2", publicationKey: "glw-publication-v1:publication-1" })),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  it("selects one winner for a reused idempotency key across scopes", async () => {
    const first = input();
    const second = input({ operationKey: "glw-op-v1:operation-2", publicationKey: "glw-publication-v1:publication-2", idempotencyKey: first.idempotencyKey, terminalScopeKey: "different-scope" });
    const results = await Promise.allSettled([enqueue(pool, first), enqueue(pool, second)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});