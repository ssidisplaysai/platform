import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Pool } from "pg";
import { buildGlwProducerTerminalPayload } from "@/lib/glw/producer-callback-contract";

const databaseUrl = process.env.HR004_SLICE_D_PRODUCER_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

async function enqueue(pool: Pool, suffix: string) {
  const payload = buildGlwProducerTerminalPayload({
    jobId: `test_hr004_d_${suffix}`,
    executionId: `execution-${suffix}`,
    status: "FAILED",
    error: { code: "TEST", message: "failed", step: "qa" },
  }, `glw-op-v1:${suffix}`);
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query({
      text: `SELECT * FROM "enqueueGlwProducerCompletion"($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)` ,
      values: [payload.operationKey, `glw-publication-v1:${suffix}`, payload.jobId, payload.executionId, payload.status,
        payload.idempotencyKey, payload.terminalScopeKey, JSON.stringify(payload), payload.payloadSha256],
    });
    await client.query("COMMIT");
    return payload.idempotencyKey;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function claim(pool: Pool, worker = "worker-1", batch = 10) {
  return (await pool.query(`SELECT * FROM "claimGlwProducerDeliveries"($1,$2,60)`, [worker, batch])).rows;
}

describeDatabase("HR-004 Slice D delivery PostgreSQL", () => {
  let pool: Pool;
  let backfilledKey: string;
  let backfilledStatus: string;

  jest.setTimeout(30_000);

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 20 });
    await pool.query(await readFile(join(process.cwd(), "n8n/hr004/glw-producer-completion-outbox.sql"), "utf8"));
    backfilledKey = await enqueue(pool, "backfill");
    await pool.query(await readFile(join(process.cwd(), "n8n/hr004/glw-producer-delivery-state.sql"), "utf8"));
    backfilledStatus = (await pool.query(`SELECT "deliveryStatus" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [backfilledKey])).rows[0].deliveryStatus;
  });

  beforeEach(async () => {
    await pool.query(`TRUNCATE "GlwProducerDeliveryAttempt", "GlwProducerDelivery", "GlwProducerOutbox", "GlwProducerCompletion", "GlwProducerPublication", "GlwProducerOperation"`);
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it("backfills a preexisting Slice C outbox row", async () => {
    expect(backfilledStatus).toBe("PENDING");
    expect(backfilledKey).toMatch(/^glw-callback-v2:/);
  });

  it("initializes future outbox rows with immutable request bytes", async () => {
    const key = await enqueue(pool, "trigger");
    const row = (await pool.query(`SELECT * FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [key])).rows[0];
    expect(row).toMatchObject({ deliveryStatus: "PENDING", attemptCount: 0 });
    expect(row.requestBodySha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("allows only one of two workers to claim one row", async () => {
    await enqueue(pool, "two-workers");
    const results = await Promise.all([claim(pool, "worker-a"), claim(pool, "worker-b")]);
    expect(results.flat()).toHaveLength(1);
  });

  it("allows only one of three workers to claim one row", async () => {
    await enqueue(pool, "three-workers");
    const results = await Promise.all([claim(pool, "a"), claim(pool, "b"), claim(pool, "c")]);
    expect(results.flat()).toHaveLength(1);
  });

  it("claims different rows across workers without duplication", async () => {
    await enqueue(pool, "row-a");
    await enqueue(pool, "row-b");
    await enqueue(pool, "row-c");
    const results = await Promise.all([claim(pool, "a", 1), claim(pool, "b", 1), claim(pool, "c", 1)]);
    expect(new Set(results.flat().map((row) => row.idempotencyKey)).size).toBe(3);
  });

  it("uses SKIP LOCKED for a row held by another transaction", async () => {
    const key = await enqueue(pool, "locked");
    const blocker = await pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query(`SELECT 1 FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1 FOR UPDATE`, [key]);
      expect(await claim(pool, "skipper", 1)).toHaveLength(0);
      await blocker.query("ROLLBACK");
    } finally {
      blocker.release();
    }
  });

  it("stores lease owner, UUID token, and database expiry atomically", async () => {
    await enqueue(pool, "lease");
    const row = (await claim(pool, "worker-lease"))[0];
    expect(row.leaseToken).toMatch(/^[0-9a-f-]{36}$/);
    const stored = (await pool.query(`SELECT "leaseOwner", extract(epoch FROM ("leaseExpiresAt"-"leaseAcquiredAt"))*1000 AS "ttlMs" FROM "GlwProducerDelivery"`)).rows[0];
    expect(stored.leaseOwner).toBe("worker-lease");
    expect(Number(stored.ttlMs)).toBe(60_000);
  });

  it("rejects begin-attempt with a stale lease token", async () => {
    const key = await enqueue(pool, "stale-token");
    await claim(pool);
    await expect(pool.query(`SELECT "beginGlwProducerDeliveryAttempt"($1,gen_random_uuid())`, [key])).rejects.toThrow("GLW_DELIVERY_STALE_LEASE");
  });

  it("does not reclaim before lease expiry", async () => {
    await enqueue(pool, "before-expiry");
    await claim(pool, "a");
    expect(await claim(pool, "b")).toHaveLength(0);
  });

  it("reclaims after lease expiry without incrementing attempts", async () => {
    const key = await enqueue(pool, "after-expiry");
    await claim(pool, "a");
    await pool.query(`UPDATE "GlwProducerDelivery" SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE "idempotencyKey"=$1`, [key]);
    const reclaimed = (await claim(pool, "b"))[0];
    expect(reclaimed.attemptCount).toBe(0);
  });

  it("increments attempt and inserts ledger atomically before transport", async () => {
    const key = await enqueue(pool, "begin");
    const lease = (await claim(pool))[0];
    expect((await pool.query(`SELECT "beginGlwProducerDeliveryAttempt"($1,$2) AS number`, [key, lease.leaseToken])).rows[0].number).toBe(1);
    expect((await pool.query(`SELECT count(*)::int AS count FROM "GlwProducerDeliveryAttempt"`)).rows[0].count).toBe(1);
  });

  it("rolls back attempt count when ledger insert conflicts", async () => {
    const key = await enqueue(pool, "begin-rollback");
    const lease = (await claim(pool))[0];
    await pool.query(`INSERT INTO "GlwProducerDeliveryAttempt" ("idempotencyKey","attemptNumber","leaseToken","workerId","requestBodySha256","startedAt") SELECT "idempotencyKey",1,$2,'other',"requestBodySha256",clock_timestamp() FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [key, lease.leaseToken]);
    await expect(pool.query(`SELECT "beginGlwProducerDeliveryAttempt"($1,$2)`, [key, lease.leaseToken])).rejects.toThrow();
    expect((await pool.query(`SELECT "attemptCount" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [key])).rows[0].attemptCount).toBe(0);
  });

  it("persists retry schedule and jitter across a new client", async () => {
    const key = await enqueue(pool, "retry");
    const lease = (await claim(pool))[0];
    const attempt = (await pool.query(`SELECT "beginGlwProducerDeliveryAttempt"($1,$2) AS number`, [key, lease.leaseToken])).rows[0].number;
    expect((await pool.query(`SELECT "completeGlwProducerDeliveryAttempt"($1,$2,$3,'RETRYABLE',503,'HTTP_503',NULL,NULL,10,0.2) AS state`, [key, lease.leaseToken, attempt])).rows[0].state).toBe("RETRY_SCHEDULED");
    const next = (await pool.query(`SELECT "nextAttemptAt" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [key])).rows[0].nextAttemptAt;
    const restarted = new Pool({ connectionString: databaseUrl, max: 1 });
    try { expect((await restarted.query(`SELECT "nextAttemptAt" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [key])).rows[0].nextAttemptAt).toEqual(next); }
    finally { await restarted.end(); }
  });

  it("acknowledges any 2xx result and never reclaims", async () => {
    const key = await enqueue(pool, "ack");
    const lease = (await claim(pool))[0];
    const attempt = (await pool.query(`SELECT "beginGlwProducerDeliveryAttempt"($1,$2) AS number`, [key, lease.leaseToken])).rows[0].number;
    expect((await pool.query(`SELECT "completeGlwProducerDeliveryAttempt"($1,$2,$3,'ACKNOWLEDGED',200,NULL,'APPLIED','receipt',10,0) AS state`, [key, lease.leaseToken, attempt])).rows[0].state).toBe("ACKNOWLEDGED");
    expect(await claim(pool, "other")).toHaveLength(0);
  });

  it("dead-letters permanent failure and never reclaims", async () => {
    const key = await enqueue(pool, "dead");
    const lease = (await claim(pool))[0];
    const attempt = (await pool.query(`SELECT "beginGlwProducerDeliveryAttempt"($1,$2) AS number`, [key, lease.leaseToken])).rows[0].number;
    expect((await pool.query(`SELECT "completeGlwProducerDeliveryAttempt"($1,$2,$3,'DEAD_LETTER',409,'SEMANTIC_CONFLICT','TERMINAL_CONFLICT',NULL,10,0) AS state`, [key, lease.leaseToken, attempt])).rows[0].state).toBe("DEAD_LETTER");
    expect(await claim(pool, "other")).toHaveLength(0);
  });

  it("enforces attempt 12 exhaustion without attempt 13", async () => {
    const key = await enqueue(pool, "exhaust");
    await pool.query(`UPDATE "GlwProducerDelivery" SET "attemptCount"=11 WHERE "idempotencyKey"=$1`, [key]);
    const lease = (await claim(pool))[0];
    const attempt = (await pool.query(`SELECT "beginGlwProducerDeliveryAttempt"($1,$2) AS number`, [key, lease.leaseToken])).rows[0].number;
    expect(attempt).toBe(12);
    expect((await pool.query(`SELECT "completeGlwProducerDeliveryAttempt"($1,$2,$3,'RETRYABLE',503,'HTTP_503',NULL,NULL,10,0) AS state`, [key, lease.leaseToken, attempt])).rows[0].state).toBe("DEAD_LETTER");
    expect(await claim(pool)).toHaveLength(0);
  });

  it("dead-letters elapsed delivery deadline", async () => {
    const key = await enqueue(pool, "deadline");
    await pool.query(`UPDATE "GlwProducerDelivery" SET "deliveryDeadlineAt"=clock_timestamp()-interval '1 second' WHERE "idempotencyKey"=$1`, [key]);
    expect(await claim(pool)).toHaveLength(0);
    expect((await pool.query(`SELECT "deliveryStatus" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [key])).rows[0].deliveryStatus).toBe("DEAD_LETTER");
  });

  it("allows only one worker in a concurrent expired-lease race", async () => {
    const key = await enqueue(pool, "expiry-race");
    await claim(pool, "old");
    await pool.query(`UPDATE "GlwProducerDelivery" SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE "idempotencyKey"=$1`, [key]);
    const results = await Promise.all([claim(pool, "a"), claim(pool, "b"), claim(pool, "c")]);
    expect(results.flat()).toHaveLength(1);
  });

  it("finalizes expired in-flight attempt as unknown before reclaim", async () => {
    const key = await enqueue(pool, "inflight-expiry");
    const lease = (await claim(pool))[0];
    await pool.query(`SELECT "beginGlwProducerDeliveryAttempt"($1,$2)`, [key, lease.leaseToken]);
    await pool.query(`UPDATE "GlwProducerDelivery" SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE "idempotencyKey"=$1`, [key]);
    await claim(pool, "recovery");
    expect((await pool.query(`SELECT "resultClass" FROM "GlwProducerDeliveryAttempt" WHERE "idempotencyKey"=$1`, [key])).rows[0].resultClass).toBe("UNKNOWN_LEASE_EXPIRED");
  });

  it("rejects mutation of stored request bytes", async () => {
    const key = await enqueue(pool, "immutable");
    await expect(pool.query(`UPDATE "GlwProducerDelivery" SET "requestBodyUtf8"='changed' WHERE "idempotencyKey"=$1`, [key])).rejects.toThrow("GLW_DELIVERY_IMMUTABLE_FIELD");
  });
});