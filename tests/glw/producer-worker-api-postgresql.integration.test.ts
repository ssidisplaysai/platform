import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Pool } from "pg";
import { createGlwProducerWorkerApiService } from "@/lib/glw/producer-worker-api";

const databaseUrl = process.env.HR004_WORKER_API_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

async function enqueue(pool: Pool, suffix: string) {
  const key = `glw-callback-v2:op-${suffix}:job-${suffix}:exec-${suffix}:PAGE_GENERATION_TERMINAL:COMPLETE`;
  const scope = `glw-terminal-v2:op-${suffix}:job-${suffix}:exec-${suffix}:PAGE_GENERATION_TERMINAL`;
  const payload = { callbackVersion: "2", operationKey: `op-${suffix}`, idempotencyKey: key, terminalScopeKey: scope, callbackType: "PAGE_GENERATION_TERMINAL", jobId: `job-${suffix}`, executionId: `exec-${suffix}`, status: "COMPLETE", payloadSha256: "a".repeat(64) };
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query(`SELECT * FROM "enqueueGlwProducerCompletion"($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`, [`op-${suffix}`, `pub-${suffix}`, `job-${suffix}`, `exec-${suffix}`, "COMPLETE", key, scope, JSON.stringify(payload), "a".repeat(64)]);
    await client.query("COMMIT");
    return key;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

describeDatabase("HR-004 HTTPS producer worker API PostgreSQL", () => {
  let pool: Pool;
  let service: ReturnType<typeof createGlwProducerWorkerApiService>;
  jest.setTimeout(30_000);

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 20 });
    await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public`);
    for (const file of ["glw-producer-completion-outbox.sql", "glw-producer-delivery-state.sql", "glw-producer-delivery-operations.sql", "glw-producer-worker-command.sql"]) {
      await pool.query(await readFile(join(process.cwd(), "n8n/hr004", file), "utf8"));
    }
    service = createGlwProducerWorkerApiService(pool);
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE "GlwProducerWorkerCommandItem","GlwProducerWorkerCommand","GlwProducerDeliveryOperatorAction","GlwProducerDeliveryRecoveryAttempt","GlwProducerDeliveryRecoveryAuthorization","GlwProducerDeliveryEscalation","GlwProducerDeliveryWorkerHeartbeat","GlwProducerDeliveryAttempt","GlwProducerDelivery","GlwProducerOutbox","GlwProducerCompletion","GlwProducerPublication","GlwProducerOperation"`);
  });
  afterAll(async () => { if (pool) await pool.end(); });

  it("writes heartbeat before an empty claim and replays the command", async () => {
    const input = { commandId: "cycle:empty:0001", workerId: "worker-empty", instanceId: "instance-empty" };
    expect((await service.workerCycle(input)).items).toHaveLength(0);
    expect((await service.workerCycle(input))).toMatchObject({ replayed: true, items: [] });
    expect(Number((await pool.query(`SELECT count(*) FROM "GlwProducerDeliveryWorkerHeartbeat"`)).rows[0].count)).toBe(1);
  });
  it.each(["COMPLETE", "FAILED_QA"] as const)("enqueues and idempotently replays %s completion with its outbox", async (terminalStatus) => {
    const suffix = terminalStatus.toLowerCase();
    const input = {
      commandId: `enqueue:${suffix}:0001`, workerId: "worker-enqueue",
      operationKey: `op-enqueue-${suffix}`, publicationKey: `pub-enqueue-${suffix}`, jobId: `job-enqueue-${suffix}`, externalExecutionId: `exec-enqueue-${suffix}`,
      terminalStatus, idempotencyKey: `glw-callback-v2:enqueue-${suffix}`, terminalScopeKey: `glw-terminal-v2:enqueue-${suffix}`,
      canonicalPayload: { jobId: `job-enqueue-${suffix}`, executionId: `exec-enqueue-${suffix}`, status: terminalStatus }, payloadSha256: "b".repeat(64),
      wordpressPageId: "19603", wordpressUrl: "https://example.test/page/", qaContractVersion: 16, qaSummary: { disposition: terminalStatus },
    };
    expect(await service.enqueueCompletion(input)).toMatchObject({ replayed: false, outcome: "ENQUEUED" });
    expect(await service.enqueueCompletion(input)).toMatchObject({ replayed: true, outcome: "ALREADY_ENQUEUED" });
    const counts = await pool.query(`SELECT
      (SELECT count(*)::int FROM "GlwProducerOperation") AS operations,
      (SELECT count(*)::int FROM "GlwProducerPublication") AS publications,
      (SELECT count(*)::int FROM "GlwProducerCompletion") AS completions,
      (SELECT count(*)::int FROM "GlwProducerOutbox") AS outbox`);
    expect(counts.rows[0]).toEqual({ operations: 1, publications: 1, completions: 1, outbox: 1 });
  });
  it("claims one due delivery once and replays the same lease", async () => {
    await enqueue(pool, "claim");
    const input = { commandId: "cycle:claim:0001", workerId: "worker-claim", instanceId: "instance-claim" };
    const first = await service.workerCycle(input); const replay = await service.workerCycle(input);
    expect(first.items).toHaveLength(1);
    expect(replay.items[0].leaseToken).toEqual(first.items[0].leaseToken);
    expect(Number((await pool.query(`SELECT count(*) FROM "GlwProducerWorkerCommandItem"`)).rows[0].count)).toBe(1);
  });
  it("uses a database-time 60-second UUID lease", async () => {
    await enqueue(pool, "lease");
    const item = (await service.workerCycle({ commandId: "cycle:lease:0001", workerId: "worker-lease", instanceId: "instance-lease" })).items[0];
    expect(item.leaseToken).toMatch(/^[0-9a-f-]{36}$/i);
    const lease = (await pool.query(`SELECT extract(epoch FROM ("leaseExpiresAt"-"leaseAcquiredAt"))::int AS seconds FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [item.idempotencyKey])).rows[0];
    expect(lease.seconds).toBe(60);
  });
  it("allows competing workers to claim different rows once", async () => {
    await enqueue(pool, "worker-a"); await enqueue(pool, "worker-b");
    const [left, right] = await Promise.all([
      service.workerCycle({ commandId: "cycle:workers:0001", workerId: "worker-left", instanceId: "instance-left" }),
      service.workerCycle({ commandId: "cycle:workers:0002", workerId: "worker-right", instanceId: "instance-right" }),
    ]);
    const keys = [...left.items, ...right.items].map((item) => item.idempotencyKey);
    expect(new Set(keys).size).toBe(2);
    expect(keys).toHaveLength(2);
  });
  it("honors SKIP LOCKED for a row held by another transaction", async () => {
    const key = await enqueue(pool, "skip-locked");
    const blocker = await pool.connect();
    try {
      await blocker.query("BEGIN");
      await blocker.query(`SELECT 1 FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1 FOR UPDATE`, [key]);
      expect((await service.workerCycle({ commandId: "cycle:skiplocked:0001", workerId: "worker-skip", instanceId: "instance-skip" })).items).toHaveLength(0);
    } finally { await blocker.query("ROLLBACK"); blocker.release(); }
  });
  it("rejects conflicting command reuse", async () => {
    await service.workerCycle({ commandId: "cycle:conflict:0001", workerId: "worker-a", instanceId: "instance-a" });
    await expect(service.workerCycle({ commandId: "cycle:conflict:0001", workerId: "worker-a", instanceId: "instance-b" })).rejects.toThrow(/COMMAND_CONFLICT/);
  });
  it("allows only one concurrent command effect", async () => {
    await enqueue(pool, "race");
    const input = { commandId: "cycle:race:0001", workerId: "worker-race", instanceId: "instance-race" };
    const results = await Promise.allSettled([service.workerCycle(input), service.workerCycle(input)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(2);
    expect(Number((await pool.query(`SELECT count(*) FROM "GlwProducerWorkerCommand"`)).rows[0].count)).toBe(1);
    expect(Number((await pool.query(`SELECT count(*) FROM "GlwProducerWorkerCommandItem"`)).rows[0].count)).toBe(1);
  });
  it("begins one attempt and replays the attempt number", async () => {
    await enqueue(pool, "begin");
    const claimed = (await service.workerCycle({ commandId: "cycle:begin:0001", workerId: "worker-begin", instanceId: "instance-begin" })).items[0];
    const input = { commandId: "begin:attempt:0001", workerId: "worker-begin", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken };
    expect(await service.beginAttempt(input)).toMatchObject({ attemptNumber: 1 });
    expect(await service.beginAttempt(input)).toMatchObject({ replayed: true, attemptNumber: 1 });
    expect(Number((await pool.query(`SELECT count(*) FROM "GlwProducerDeliveryAttempt"`)).rows[0].count)).toBe(1);
  });
  it("allows exactly one of two different begin commands for one lease", async () => {
    await enqueue(pool, "begin-race");
    const claimed = (await service.workerCycle({ commandId: "cycle:beginrace:0001", workerId: "worker-race", instanceId: "instance-race" })).items[0];
    const base = { workerId: "worker-race", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken };
    const results = await Promise.allSettled([
      service.beginAttempt({ commandId: "begin:race:0001", ...base }),
      service.beginAttempt({ commandId: "begin:race:0002", ...base }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(Number((await pool.query(`SELECT count(*) FROM "GlwProducerDeliveryAttempt"`)).rows[0].count)).toBe(1);
  });
  it("rejects a wrong lease without retaining command identity", async () => {
    await enqueue(pool, "wrong-lease");
    const claimed = (await service.workerCycle({ commandId: "cycle:wronglease:0001", workerId: "worker-wrong", instanceId: "instance-wrong" })).items[0];
    await expect(service.beginAttempt({ commandId: "begin:wronglease:0001", workerId: "worker-wrong", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: "00000000-0000-0000-0000-000000000001" })).rejects.toThrow(/STALE_LEASE/);
    expect(Number((await pool.query(`SELECT count(*) FROM "GlwProducerWorkerCommand" WHERE "commandId"='begin:wronglease:0001'`)).rows[0].count)).toBe(0);
  });
  it("rejects an expired lease", async () => {
    await enqueue(pool, "expired-lease");
    const claimed = (await service.workerCycle({ commandId: "cycle:expired:0001", workerId: "worker-expired", instanceId: "instance-expired" })).items[0];
    await pool.query(`UPDATE "GlwProducerDelivery" SET "leaseExpiresAt"=clock_timestamp()-interval '1 second' WHERE "idempotencyKey"=$1`, [claimed.idempotencyKey]);
    await expect(service.beginAttempt({ commandId: "begin:expired:0001", workerId: "worker-expired", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken })).rejects.toThrow(/STALE_LEASE/);
  });
  it("prevents attempt 13", async () => {
    await enqueue(pool, "attempt-cap");
    await pool.query(`UPDATE "GlwProducerDelivery" SET "attemptCount"=12 WHERE "idempotencyKey" LIKE 'glw-callback-v2:op-attempt-cap:%'`);
    expect((await service.workerCycle({ commandId: "cycle:attemptcap:0001", workerId: "worker-cap", instanceId: "instance-cap" })).items).toHaveLength(0);
  });
  it("completes ACK once and replays the persisted state", async () => {
    await enqueue(pool, "complete");
    const claimed = (await service.workerCycle({ commandId: "cycle:complete:0001", workerId: "worker-complete", instanceId: "instance-complete" })).items[0];
    const begun = await service.beginAttempt({ commandId: "begin:complete:0001", workerId: "worker-complete", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken });
    const input = { commandId: "complete:attempt:0001", workerId: "worker-complete", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken, attemptNumber: begun.attemptNumber, resultClass: "ACKNOWLEDGED" as const, httpStatus: 200, receiverOutcome: "APPLIED", receiverReceiptId: "receipt", durationMs: 10, jitterFraction: 0 };
    expect(await service.completeAttempt(input)).toMatchObject({ deliveryStatus: "ACKNOWLEDGED" });
    expect(await service.completeAttempt(input)).toMatchObject({ replayed: true, deliveryStatus: "ACKNOWLEDGED" });
    expect((await pool.query(`SELECT "deliveryStatus" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [claimed.idempotencyKey])).rows[0].deliveryStatus).toBe("ACKNOWLEDGED");
  });
  it.each([[408,"HTTP_408"],[425,"HTTP_425"],[429,"HTTP_429"],[503,"HTTP_503"],[530,"HTTP_530"]])("persists retry for HTTP %s", async (status, errorClass) => {
    await enqueue(pool, `retry-${status}`);
    const claimed = (await service.workerCycle({ commandId: `cycle:retry:${status}`, workerId: "worker-retry", instanceId: "instance-retry" })).items[0];
    const begun = await service.beginAttempt({ commandId: `begin:retry:${status}`, workerId: "worker-retry", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken });
    expect(await service.completeAttempt({ commandId: `complete:retry:${status}`, workerId: "worker-retry", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken, attemptNumber: begun.attemptNumber, resultClass: "RETRYABLE", httpStatus: status, errorClass, durationMs: 10, jitterFraction: 0.1 })).toMatchObject({ deliveryStatus: "RETRY_SCHEDULED" });
  });
  it.each([[400,"VALIDATION_FAILURE"],[401,"AUTH_FAILURE"],[404,"DESTINATION_OR_IDENTITY_FAILURE"],[409,"TERMINAL_CONFLICT"]])("dead-letters permanent HTTP %s", async (status, errorClass) => {
    await enqueue(pool, `dead-${status}`);
    const claimed = (await service.workerCycle({ commandId: `cycle:dead:${status}`, workerId: "worker-dead", instanceId: "instance-dead" })).items[0];
    const begun = await service.beginAttempt({ commandId: `begin:dead:${status}`, workerId: "worker-dead", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken });
    expect(await service.completeAttempt({ commandId: `complete:dead:${status}`, workerId: "worker-dead", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken, attemptNumber: begun.attemptNumber, resultClass: "DEAD_LETTER", httpStatus: status, errorClass, durationMs: 10, jitterFraction: 0 })).toMatchObject({ deliveryStatus: "DEAD_LETTER" });
  });
  it("persists retry timing once and replays after service reconstruction", async () => {
    await enqueue(pool, "restart-replay");
    const claimed = (await service.workerCycle({ commandId: "cycle:restart:0001", workerId: "worker-restart", instanceId: "instance-restart" })).items[0];
    const begun = await service.beginAttempt({ commandId: "begin:restart:0001", workerId: "worker-restart", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken });
    const input = { commandId: "complete:restart:0001", workerId: "worker-restart", workKind: claimed.workKind, idempotencyKey: claimed.idempotencyKey, recoveryAuthorizationId: claimed.recoveryAuthorizationId, leaseToken: claimed.leaseToken, attemptNumber: begun.attemptNumber, resultClass: "RETRYABLE" as const, httpStatus: 503, errorClass: "HTTP_503", durationMs: 10, jitterFraction: 0.2 };
    await service.completeAttempt(input);
    const nextAttemptAt = (await pool.query(`SELECT "nextAttemptAt" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [claimed.idempotencyKey])).rows[0].nextAttemptAt;
    expect(await createGlwProducerWorkerApiService(pool).completeAttempt(input)).toMatchObject({ replayed: true, deliveryStatus: "RETRY_SCHEDULED" });
    expect((await pool.query(`SELECT "nextAttemptAt" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [claimed.idempotencyKey])).rows[0].nextAttemptAt).toEqual(nextAttemptAt);
  });
  it("keeps completed commands and command items immutable", async () => {
    await service.workerCycle({ commandId: "cycle:immutable:0001", workerId: "worker-immutable", instanceId: "instance-immutable" });
    await expect(pool.query(`DELETE FROM "GlwProducerWorkerCommand" WHERE "commandId"='cycle:immutable:0001'`)).rejects.toThrow(/APPEND_ONLY/);
  });
  it("rolls back command identity when the routine fails", async () => {
    await expect(service.beginAttempt({ commandId: "begin:rollback:0001", workerId: "worker-rollback", workKind: "ORIGINAL", idempotencyKey: "missing", leaseToken: "00000000-0000-0000-0000-000000000001" })).rejects.toThrow();
    expect(Number((await pool.query(`SELECT count(*) FROM "GlwProducerWorkerCommand" WHERE "commandId"='begin:rollback:0001'`)).rows[0].count)).toBe(0);
  });
});