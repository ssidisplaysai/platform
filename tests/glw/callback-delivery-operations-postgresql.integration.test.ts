import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Pool } from "pg";

const databaseUrl = process.env.HR004_SLICE_E_PRODUCER_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

async function enqueue(pool: Pool, suffix: string) {
  const idempotencyKey = `glw-callback-v2:op-${suffix}:job-${suffix}:exec-${suffix}:PAGE_GENERATION_TERMINAL:FAILED`;
  const terminalScopeKey = `glw-terminal-v2:op-${suffix}:job-${suffix}:exec-${suffix}:PAGE_GENERATION_TERMINAL`;
  const payload = { callbackVersion: "2", operationKey: `op-${suffix}`, idempotencyKey, terminalScopeKey, callbackType: "PAGE_GENERATION_TERMINAL", jobId: `job-${suffix}`, executionId: `exec-${suffix}`, status: "FAILED", error: { code: "TEST", message: "failed" }, payloadSha256: "a".repeat(64) };
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query(`SELECT * FROM "enqueueGlwProducerCompletion"($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`, [`op-${suffix}`, `pub-${suffix}`, `job-${suffix}`, `exec-${suffix}`, "FAILED", idempotencyKey, terminalScopeKey, JSON.stringify(payload), "a".repeat(64)]);
    await client.query("COMMIT");
    return idempotencyKey;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function deadLetter(pool: Pool, key: string, reason: string, options: { status?: number; error?: string; outcome?: string } = {}) {
  await pool.query(`UPDATE "GlwProducerDelivery" SET "deliveryStatus"='DEAD_LETTER',"deadLetteredAt"=clock_timestamp(),"deadLetterReason"=$2,"lastHttpStatus"=$3,"lastErrorClass"=$4,"lastResponseOutcome"=$5 WHERE "idempotencyKey"=$1`, [key, reason, options.status ?? null, options.error ?? null, options.outcome ?? null]);
}

async function requestRecovery(pool: Pool, key: string, requestId = `request-${Math.random()}`) {
  return (await pool.query(`SELECT * FROM "requestGlwProducerDeliveryRecovery"($1,'operator@example.test','OPERATOR',$2,'documented recovery reason')`, [key, requestId])).rows[0];
}

async function approve(pool: Pool, recovery: Record<string, unknown>, actor = "approver@example.test", requestId = `approval-${Math.random()}`) {
  return (await pool.query(`SELECT * FROM "approveGlwProducerDeliveryRecovery"($1,$2,$3,'RECOVERY_APPROVER',$4,'documented approval reason')`, [recovery.recoveryAuthorizationId, recovery.version, actor, requestId])).rows[0];
}

describeDatabase("HR-004 Slice E producer PostgreSQL", () => {
  let pool: Pool;
  jest.setTimeout(30_000);

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl, max: 20 });
    await pool.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public`);
    for (const file of ["glw-producer-completion-outbox.sql", "glw-producer-delivery-state.sql", "glw-producer-delivery-operations.sql"]) {
      await pool.query(await readFile(join(process.cwd(), "n8n/hr004", file), "utf8"));
    }
  });
  beforeEach(async () => {
    await pool.query(`TRUNCATE "GlwProducerDeliveryOperatorAction","GlwProducerDeliveryRecoveryAttempt","GlwProducerDeliveryRecoveryAuthorization","GlwProducerDeliveryEscalation","GlwProducerDeliveryWorkerHeartbeat","GlwProducerDeliveryAttempt","GlwProducerDelivery","GlwProducerOutbox","GlwProducerCompletion","GlwProducerPublication","GlwProducerOperation"`);
  });
  afterAll(async () => { if (pool) await pool.end(); });

  it("creates exactly five Slice E entities", async () => {
    const rows = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN ('GlwProducerDeliveryEscalation','GlwProducerDeliveryOperatorAction','GlwProducerDeliveryRecoveryAuthorization','GlwProducerDeliveryRecoveryAttempt','GlwProducerDeliveryWorkerHeartbeat')`);
    expect(rows.rows).toHaveLength(5);
  });
  it("creates one deterministic dead-letter escalation and audit", async () => {
    const key = await enqueue(pool, "escalation"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED");
    expect((await pool.query(`SELECT "refreshGlwProducerDeliveryEscalations"() AS count`)).rows[0].count).toBe(1);
    expect((await pool.query(`SELECT * FROM "GlwProducerDeliveryEscalation"`)).rows[0]).toMatchObject({ severity: "ACTION_REQUIRED", escalationType: "ATTEMPT_EXHAUSTION" });
    expect((await pool.query(`SELECT "actionType" FROM "GlwProducerDeliveryOperatorAction"`)).rows[0].actionType).toBe("ALERT_CREATED");
  });
  it("deduplicates repeated escalation refresh", async () => {
    const key = await enqueue(pool, "dedup"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED");
    await pool.query(`SELECT "refreshGlwProducerDeliveryEscalations"()`); await pool.query(`SELECT "refreshGlwProducerDeliveryEscalations"()`);
    expect(Number((await pool.query(`SELECT count(*) FROM "GlwProducerDeliveryEscalation"`)).rows[0].count)).toBe(1);
  });
  it("classifies semantic conflict as critical", async () => {
    const key = await enqueue(pool, "conflict"); await deadLetter(pool, key, "TERMINAL_CONFLICT", { status: 409, outcome: "TERMINAL_CONFLICT" });
    await pool.query(`SELECT "refreshGlwProducerDeliveryEscalations"()`);
    expect((await pool.query(`SELECT severity FROM "GlwProducerDeliveryEscalation"`)).rows[0].severity).toBe("CRITICAL");
  });
  it("allows one escalation acknowledgement in a race", async () => {
    const key = await enqueue(pool, "ack-race"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); await pool.query(`SELECT "refreshGlwProducerDeliveryEscalations"()`);
    const row = (await pool.query(`SELECT * FROM "GlwProducerDeliveryEscalation"`)).rows[0];
    const results = await Promise.allSettled(["a", "b"].map((id) => pool.query(`SELECT * FROM "acknowledgeGlwProducerDeliveryEscalation"($1,$2,$3,'OPERATOR',$4,'investigated alert')`, [row.escalationId, row.version, `operator-${id}`, `ack-${id}`])));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });
  it("rejects stale escalation assignment", async () => {
    const key = await enqueue(pool, "stale-assign"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); await pool.query(`SELECT "refreshGlwProducerDeliveryEscalations"()`);
    const row = (await pool.query(`SELECT * FROM "GlwProducerDeliveryEscalation"`)).rows[0];
    await pool.query(`SELECT * FROM "acknowledgeGlwProducerDeliveryEscalation"($1,$2,'operator','OPERATOR','ack-one','investigated alert')`, [row.escalationId, row.version]);
    await expect(pool.query(`SELECT * FROM "assignGlwProducerDeliveryEscalation"($1,$2,'operator','OPERATOR','assign-one','owner','assign reason')`, [row.escalationId, row.version])).rejects.toThrow(/STALE_OPERATOR_STATE/);
  });
  it("keeps operator audit append-only", async () => {
    const key = await enqueue(pool, "append-only"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); await pool.query(`SELECT "refreshGlwProducerDeliveryEscalations"()`);
    await expect(pool.query(`DELETE FROM "GlwProducerDeliveryOperatorAction"`)).rejects.toThrow(/APPEND_ONLY/);
  });
  it.each([
    ["AUTH_FAILURE", { error: "AUTH_FAILURE" }],
    ["DESTINATION_OR_IDENTITY_FAILURE", { error: "DESTINATION_OR_IDENTITY_FAILURE", status: 404 }],
    ["ATTEMPT_BUDGET_EXHAUSTED", {}],
    ["ELAPSED_BUDGET_EXHAUSTED", {}],
    ["TRANSIENT", { error: "NETWORK" }],
  ] as const)("allows recovery eligibility %s", async (reason, options) => {
    const key = await enqueue(pool, `eligible-${reason}`); await deadLetter(pool, key, reason === "TRANSIENT" ? "OTHER" : reason, options);
    expect((await requestRecovery(pool, key)).recoveryState).toBe("REQUESTED");
  });
  it.each(["ACKNOWLEDGED", "TERMINAL_CONFLICT", "VALIDATION_FAILURE"] as const)("rejects non-replayable %s", async (kind) => {
    const key = await enqueue(pool, `blocked-${kind}`);
    if (kind === "ACKNOWLEDGED") await pool.query(`UPDATE "GlwProducerDelivery" SET "deliveryStatus"='ACKNOWLEDGED',"acknowledgedAt"=clock_timestamp() WHERE "idempotencyKey"=$1`, [key]);
    else await deadLetter(pool, key, kind, { status: kind === "TERMINAL_CONFLICT" ? 409 : 400, outcome: kind });
    await expect(requestRecovery(pool, key)).rejects.toThrow(/NOT_ELIGIBLE/);
  });
  it("returns the same recovery for duplicate request id", async () => {
    const key = await enqueue(pool, "duplicate-request"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED");
    const first = await requestRecovery(pool, key, "same-request"); const second = await requestRecovery(pool, key, "same-request");
    expect(second.recoveryAuthorizationId).toBe(first.recoveryAuthorizationId);
  });
  it("allows exactly one of two concurrent recovery requests", async () => {
    const key = await enqueue(pool, "request-race"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED");
    const results = await Promise.allSettled([requestRecovery(pool, key, "race-a"), requestRecovery(pool, key, "race-b")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });
  it("rejects requester self approval", async () => {
    const key = await enqueue(pool, "self-approve"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); const recovery = await requestRecovery(pool, key);
    await expect(approve(pool, recovery, "operator@example.test")).rejects.toThrow(/SELF_APPROVAL/);
  });
  it("allows exactly one of two concurrent approvals", async () => {
    const key = await enqueue(pool, "approval-race"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); const recovery = await requestRecovery(pool, key);
    const results = await Promise.allSettled([approve(pool, recovery, "approver-a", "approve-a"), approve(pool, recovery, "approver-b", "approve-b")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
  });
  it("rejects approval after original state changes", async () => {
    const key = await enqueue(pool, "late-state"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); const recovery = await requestRecovery(pool, key);
    await pool.query(`ALTER TABLE "GlwProducerDelivery" DISABLE TRIGGER "GlwProducerDelivery_protect"`);
    await pool.query(`UPDATE "GlwProducerDelivery" SET "deliveryStatus"='ACKNOWLEDGED',"acknowledgedAt"=clock_timestamp(),"deadLetteredAt"=NULL WHERE "idempotencyKey"=$1`, [key]);
    await pool.query(`ALTER TABLE "GlwProducerDelivery" ENABLE TRIGGER "GlwProducerDelivery_protect"`);
    expect((await approve(pool, recovery)).recoveryState).toBe("CANCELLED");
    expect((await pool.query(`SELECT "actionType","newState" FROM "GlwProducerDeliveryOperatorAction" WHERE "recoveryAuthorizationId"=$1 ORDER BY "occurredAt" DESC LIMIT 1`, [recovery.recoveryAuthorizationId])).rows[0]).toEqual({ actionType: "RECOVERY_REJECTED", newState: "CANCELLED" });
    expect((await pool.query(`SELECT * FROM "claimGlwProducerDeliveryWork"('late-worker',1,60)`)).rows).toHaveLength(0);
  });
  it("claims approved recovery with exact original bytes and hash", async () => {
    const key = await enqueue(pool, "claim-recovery"); const original = (await pool.query(`SELECT "requestBodyUtf8","requestBodySha256" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [key])).rows[0]; await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); const approved = await approve(pool, await requestRecovery(pool, key));
    const claimed = (await pool.query(`SELECT * FROM "claimGlwProducerDeliveryWork"('worker',1,60)`)).rows[0];
    expect(claimed).toMatchObject({ workKind: "RECOVERY", recoveryAuthorizationId: approved.recoveryAuthorizationId, requestBodyUtf8: original.requestBodyUtf8, requestBodySha256: original.requestBodySha256 });
  });
  it("persists recovery attempt before transport without changing original count", async () => {
    const key = await enqueue(pool, "begin-recovery"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); await approve(pool, await requestRecovery(pool, key));
    const claimed = (await pool.query(`SELECT * FROM "claimGlwProducerDeliveryWork"('worker',1,60)`)).rows[0];
    expect((await pool.query(`SELECT "beginGlwProducerDeliveryWork"('RECOVERY',$1,$2,$3) AS attempt`, [key, claimed.recoveryAuthorizationId, claimed.leaseToken])).rows[0].attempt).toBe(1);
    expect((await pool.query(`SELECT "attemptCount" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [key])).rows[0].attemptCount).toBe(0);
  });
  it("schedules a recovery retry with persisted jitter", async () => {
    const key = await enqueue(pool, "recovery-retry"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); await approve(pool, await requestRecovery(pool, key));
    const claimed = (await pool.query(`SELECT * FROM "claimGlwProducerDeliveryWork"('worker',1,60)`)).rows[0]; const attempt = (await pool.query(`SELECT "beginGlwProducerDeliveryWork"('RECOVERY',$1,$2,$3) AS n`, [key, claimed.recoveryAuthorizationId, claimed.leaseToken])).rows[0].n;
    expect((await pool.query(`SELECT "completeGlwProducerDeliveryWork"('RECOVERY',$1,$2,$3,$4,'RETRYABLE',503,'HTTP_503',NULL,NULL,10,0.2) AS state`, [key, claimed.recoveryAuthorizationId, claimed.leaseToken, attempt])).rows[0].state).toBe("RETRY_SCHEDULED");
  });
  it("acknowledges recovery while original dead letter remains immutable", async () => {
    const key = await enqueue(pool, "recovery-ack"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); await pool.query(`SELECT "refreshGlwProducerDeliveryEscalations"()`); await approve(pool, await requestRecovery(pool, key));
    const claimed = (await pool.query(`SELECT * FROM "claimGlwProducerDeliveryWork"('worker',1,60)`)).rows[0]; const attempt = (await pool.query(`SELECT "beginGlwProducerDeliveryWork"('RECOVERY',$1,$2,$3) AS n`, [key, claimed.recoveryAuthorizationId, claimed.leaseToken])).rows[0].n;
    expect((await pool.query(`SELECT "completeGlwProducerDeliveryWork"('RECOVERY',$1,$2,$3,$4,'ACKNOWLEDGED',200,NULL,'ALREADY_APPLIED','receipt',10,0) AS state`, [key, claimed.recoveryAuthorizationId, claimed.leaseToken, attempt])).rows[0].state).toBe("ACKNOWLEDGED");
    expect((await pool.query(`SELECT "deliveryStatus" FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [key])).rows[0].deliveryStatus).toBe("DEAD_LETTER");
  });
  it("dead-letters recovery at attempt 12 without attempt 13", async () => {
    const key = await enqueue(pool, "recovery-exhaust"); await deadLetter(pool, key, "ATTEMPT_BUDGET_EXHAUSTED"); const approved = await approve(pool, await requestRecovery(pool, key));
    await pool.query(`UPDATE "GlwProducerDeliveryRecoveryAuthorization" SET "attemptCount"=11 WHERE "recoveryAuthorizationId"=$1`, [approved.recoveryAuthorizationId]);
    const claimed = (await pool.query(`SELECT * FROM "claimGlwProducerDeliveryWork"('worker',1,60)`)).rows[0]; const attempt = (await pool.query(`SELECT "beginGlwProducerDeliveryWork"('RECOVERY',$1,$2,$3) AS n`, [key, claimed.recoveryAuthorizationId, claimed.leaseToken])).rows[0].n;
    expect(attempt).toBe(12);
    expect((await pool.query(`SELECT "completeGlwProducerDeliveryWork"('RECOVERY',$1,$2,$3,12,'RETRYABLE',503,'HTTP_503',NULL,NULL,10,0) AS state`, [key, claimed.recoveryAuthorizationId, claimed.leaseToken])).rows[0].state).toBe("DEAD_LETTER");
    expect((await pool.query(`SELECT * FROM "claimGlwProducerDeliveryWork"('later',1,60)`)).rows).toHaveLength(0);
  });
  it("upserts worker heartbeat with database time", async () => {
    await pool.query(`SELECT * FROM "heartbeatGlwProducerDeliveryWorker"('worker','instance',false,false)`); await pool.query(`SELECT * FROM "heartbeatGlwProducerDeliveryWorker"('worker','instance',true,true)`);
    expect((await pool.query(`SELECT "version","lastClaimAt","lastAttemptAt" FROM "GlwProducerDeliveryWorkerHeartbeat"`)).rows[0]).toMatchObject({ version: 2, lastClaimAt: expect.any(Date), lastAttemptAt: expect.any(Date) });
  });
});
