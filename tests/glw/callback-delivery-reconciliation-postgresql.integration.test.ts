import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Pool } from "pg";
import { createGlwDeliveryReconciliationService } from "@/lib/glw/callback-delivery-reconciliation";

const producerUrl = process.env.HR004_SLICE_F_PRODUCER_DATABASE_URL;
const genesisUrl = process.env.HR004_SLICE_F_GENESIS_DATABASE_URL;
const describeDatabase = producerUrl && genesisUrl ? describe : describe.skip;

async function enqueue(pool: Pool, suffix: string) {
  const operationKey = `op-f-${suffix}`;
  const idempotencyKey = `glw-callback-v2:${operationKey}:test_f_job_${suffix}:exec-${suffix}:PAGE_GENERATION_TERMINAL:FAILED`;
  const terminalScopeKey = `glw-terminal-v2:${operationKey}:test_f_job_${suffix}:exec-${suffix}:PAGE_GENERATION_TERMINAL`;
  const payload = { callbackVersion: "2", operationKey, idempotencyKey, terminalScopeKey, callbackType: "PAGE_GENERATION_TERMINAL", jobId: `test_f_job_${suffix}`, executionId: `exec-${suffix}`, status: "FAILED", error: { code: "TEST", message: "failed" }, payloadSha256: "a".repeat(64) };
  const client = await pool.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    await client.query(`SELECT * FROM "enqueueGlwProducerCompletion"($1,$2,$3,$4,'FAILED',$5,$6,$7::jsonb,$8)`, [operationKey, `pub-f-${suffix}`, `test_f_job_${suffix}`, `exec-${suffix}`, idempotencyKey, terminalScopeKey, JSON.stringify(payload), "a".repeat(64)]);
    await client.query("COMMIT");
    return { operationKey, idempotencyKey, terminalScopeKey, jobId: `test_f_job_${suffix}`, executionId: `exec-${suffix}` };
  } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
}

async function insertRun(pool: Pool, overrides: Record<string, unknown> = {}) {
  const now = new Date();
  const value = { runId: crypto.randomUUID(), producerAt: now, genesisAt: now, skew: 0, status: "CLEAN", discrepancies: 0, truncated: false, ...overrides };
  await pool.query(`INSERT INTO "GlwProducerDeliveryReconciliationRun" ("reconciliationRunId","runType","triggeredBy","sourceCommit","sourceTree","producerSnapshotAt","genesisSnapshotAt","snapshotSkewMs","startedAt","completedAt","status","discrepancyCount","truncated") VALUES ($1,'OPERATOR','test','commit','tree',$2,$3,$4,$2,$3,$5,$6,$7)`, [value.runId, value.producerAt, value.genesisAt, value.skew, value.status, value.discrepancies, value.truncated]);
  return String(value.runId);
}

function service(producer: Pool, genesis: Pool) { return createGlwDeliveryReconciliationService({ producer, genesis }); }
function runInput() { return { runType: "OPERATOR" as const, triggeredBy: "operator", sourceCommit: "commit", sourceTree: "tree" }; }

async function deleteDelivery(pool: Pool, key: string) { await pool.query(`DELETE FROM "GlwProducerDelivery" WHERE "idempotencyKey"=$1`, [key]); }
async function restoreDelivery(pool: Pool, key: string) {
  await pool.query(`INSERT INTO "GlwProducerDelivery" ("idempotencyKey","operationKey","publicationKey","requestBodyUtf8","requestBodySha256","deliveryStatus","nextAttemptAt","deliveryDeadlineAt","createdAt","updatedAt") SELECT outbox."idempotencyKey",outbox."operationKey",outbox."publicationKey","glwDeliveryEnvelope"(outbox),encode(sha256(convert_to("glwDeliveryEnvelope"(outbox),'UTF8')),'hex'),'PENDING',clock_timestamp()+interval '10 minutes',clock_timestamp()+interval '6 hours',clock_timestamp(),clock_timestamp() FROM "GlwProducerOutbox" outbox WHERE outbox."idempotencyKey"=$1`, [key]);
}

describeDatabase("HR-004 Slice F reconciliation PostgreSQL", () => {
  let producer: Pool; let genesis: Pool;
  jest.setTimeout(30_000);
  beforeAll(async () => {
    producer = new Pool({ connectionString: producerUrl, max: 20 }); genesis = new Pool({ connectionString: genesisUrl, max: 10 });
    await producer.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public`);
    for (const file of ["glw-producer-completion-outbox.sql","glw-producer-delivery-state.sql","glw-producer-delivery-operations.sql","glw-producer-delivery-reconciliation.sql"]) await producer.query(await readFile(join(process.cwd(), "n8n/hr004", file), "utf8"));
  });
  beforeEach(async () => {
    await producer.query(`TRUNCATE "GlwProducerDeliveryReconciliationDiscrepancy","GlwProducerDeliveryReconciliationRun","GlwProducerDeliveryOperatorAction","GlwProducerDeliveryRecoveryAttempt","GlwProducerDeliveryRecoveryAuthorization","GlwProducerDeliveryEscalation","GlwProducerDeliveryWorkerHeartbeat","GlwProducerDeliveryAttempt","GlwProducerDelivery","GlwProducerOutbox","GlwProducerCompletion","GlwProducerPublication","GlwProducerOperation"`);
    await genesis.query(`DELETE FROM "GopExecutionSnapshot" WHERE "executionId" IN (SELECT "executionId" FROM "GopExecution" WHERE "jobId" LIKE 'test_f_job_%')`);
    await genesis.query(`DELETE FROM "GopJobEvent" WHERE "jobId" LIKE 'test_f_job_%'`);
    await genesis.query(`DELETE FROM "GopExecution" WHERE "jobId" LIKE 'test_f_job_%'`);
    await genesis.query(`DELETE FROM "GlwCallbackReceipt" WHERE "jobId" LIKE 'test_f_job_%'`);
    await genesis.query(`DELETE FROM "GlwJob" WHERE "id" LIKE 'test_f_job_%'`);
  });
  afterAll(async () => { if (producer) await producer.end(); if (genesis) await genesis.end(); });

  it("creates exactly two Slice F tables", async () => expect((await producer.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'GlwProducerDeliveryReconciliation%'`)).rows).toHaveLength(2));
  it("rejects reconciliation run update", async () => { const id=await insertRun(producer); await expect(producer.query(`UPDATE "GlwProducerDeliveryReconciliationRun" SET "status"='FAILED' WHERE "reconciliationRunId"=$1`,[id])).rejects.toThrow(/IMMUTABLE/); });
  it("rejects reconciliation run delete", async () => { const id=await insertRun(producer); await expect(producer.query(`DELETE FROM "GlwProducerDeliveryReconciliationRun" WHERE "reconciliationRunId"=$1`,[id])).rejects.toThrow(/IMMUTABLE/); });
  it("rejects discrepancy update", async () => { const id=await insertRun(producer,{status:"DISCREPANCIES",discrepancies:1}); await producer.query(`INSERT INTO "GlwProducerDeliveryReconciliationDiscrepancy" ("reconciliationRunId","discrepancyKey","discrepancyType","severity","repairAuthority","detectedAt") VALUES ($1,'key','TYPE','WARNING','OPS',clock_timestamp())`,[id]); await expect(producer.query(`UPDATE "GlwProducerDeliveryReconciliationDiscrepancy" SET "severity"='CRITICAL'`)).rejects.toThrow(/IMMUTABLE/); });
  it("rejects CLEAN with excess skew", async () => await expect(insertRun(producer,{producerAt:new Date(0),genesisAt:new Date(5001),skew:5001})).rejects.toThrow());
  it("accepts INDETERMINATE with excess skew", async () => { await insertRun(producer,{producerAt:new Date(0),genesisAt:new Date(5001),skew:5001,status:"INDETERMINATE"}); expect((await producer.query(`SELECT status FROM "GlwProducerDeliveryReconciliationRun"`)).rows[0].status).toBe("INDETERMINATE"); });
  it("rejects CLEAN with discrepancy count", async () => await expect(insertRun(producer,{discrepancies:1})).rejects.toThrow());
  it("deduplicates discrepancy within one run", async () => { const id=await insertRun(producer,{status:"DISCREPANCIES",discrepancies:1}); const sql=`INSERT INTO "GlwProducerDeliveryReconciliationDiscrepancy" ("reconciliationRunId","discrepancyKey","discrepancyType","severity","repairAuthority","detectedAt") VALUES ($1,'key','TYPE','WARNING','OPS',clock_timestamp())`; await producer.query(sql,[id]); await expect(producer.query(sql,[id])).rejects.toThrow(/duplicate/i); });
  it("restricts deleting a referenced run", async () => { const id=await insertRun(producer,{status:"DISCREPANCIES",discrepancies:1}); await producer.query(`INSERT INTO "GlwProducerDeliveryReconciliationDiscrepancy" ("reconciliationRunId","discrepancyKey","discrepancyType","severity","repairAuthority","detectedAt") VALUES ($1,'key','TYPE','WARNING','OPS',clock_timestamp())`,[id]); await expect(producer.query(`DELETE FROM "GlwProducerDeliveryReconciliationRun" WHERE "reconciliationRunId"=$1`,[id])).rejects.toThrow(); });
  it("records a clean empty reconciliation run", async () => { const result=await service(producer,genesis).run(runInput()); expect(result).toMatchObject({outcome:"COMPLETED",status:"CLEAN"}); });
  it("reads latest immutable run evidence", async () => { await service(producer,genesis).run(runInput()); expect((await service(producer,genesis).latest()).run.status).toBe("CLEAN"); });
  it("prevents overlapping reconciliation runs", async () => { const client=await producer.connect(); await client.query(`SELECT pg_advisory_lock(hashtext('hr004:delivery-reconciliation'))`); try{expect(await service(producer,genesis).run(runInput())).toEqual({outcome:"ALREADY_RUNNING"});}finally{await client.query(`SELECT pg_advisory_unlock(hashtext('hr004:delivery-reconciliation'))`);client.release();} });
  it("detects completion without outbox", async () => { const row=await enqueue(producer,"missing-outbox"); await deleteDelivery(producer,row.idempotencyKey); await producer.query(`ALTER TABLE "GlwProducerOutbox" DISABLE TRIGGER "GlwProducerOutbox_immutable"`); await producer.query(`DELETE FROM "GlwProducerOutbox" WHERE "idempotencyKey"=$1`,[row.idempotencyKey]); await producer.query(`ALTER TABLE "GlwProducerOutbox" ENABLE TRIGGER "GlwProducerOutbox_immutable"`); const result=await service(producer,genesis).run(runInput()); expect(result.outcome==="COMPLETED"&&result.discrepancies.some((d)=>d.discrepancyType==="COMPLETION_WITHOUT_OUTBOX")).toBe(true); });
  it("detects outbox without delivery", async () => { const row=await enqueue(producer,"missing-delivery"); await deleteDelivery(producer,row.idempotencyKey); const result=await service(producer,genesis).run(runInput()); expect(result.outcome==="COMPLETED"&&result.discrepancies.some((d)=>d.discrepancyType==="OUTBOX_WITHOUT_DELIVERY_GT_60S")).toBe(true); });
  it("detects ACK without receiver receipt", async () => { const row=await enqueue(producer,"ack-no-receipt"); await producer.query(`UPDATE "GlwProducerDelivery" SET "deliveryStatus"='ACKNOWLEDGED',"acknowledgedAt"=clock_timestamp(),"nextAttemptAt"=clock_timestamp()+interval '1 hour' WHERE "idempotencyKey"=$1`,[row.idempotencyKey]); const result=await service(producer,genesis).run(runInput()); expect(result.outcome==="COMPLETED"&&result.discrepancies.some((d)=>d.discrepancyType==="ACK_WITHOUT_RECEIPT")).toBe(true); });
  it("detects receiver identity mismatch", async () => { const row=await enqueue(producer,"receipt-mismatch"); await genesis.query(`INSERT INTO "GlwCallbackReceipt" ("receiptId","idempotencyKey","terminalScopeKey","operationKey","jobId","externalExecutionId","callbackType","terminalStatus","payloadSha256","payloadJson","outcome","receivedAt","createdAt","updatedAt") VALUES ('receipt-f',$1,$2,$3,$4,$5,'PAGE_GENERATION_TERMINAL','FAILED',$6,'{}'::jsonb,'APPLIED',clock_timestamp(),clock_timestamp(),clock_timestamp())`,[row.idempotencyKey,row.terminalScopeKey,row.operationKey,row.jobId,row.executionId,"b".repeat(64)]); const result=await service(producer,genesis).run(runInput()); expect(result.outcome==="COMPLETED"&&result.discrepancies.some((d)=>d.discrepancyType==="RECEIPT_IDENTITY_OR_HASH_MISMATCH")).toBe(true); });
  it("detects dead letter without escalation", async () => { const row=await enqueue(producer,"dead-no-escalation"); await producer.query(`UPDATE "GlwProducerDelivery" SET "deliveryStatus"='DEAD_LETTER',"deadLetteredAt"=clock_timestamp(),"deadLetterReason"='ATTEMPT_BUDGET_EXHAUSTED' WHERE "idempotencyKey"=$1`,[row.idempotencyKey]); const result=await service(producer,genesis).run(runInput()); expect(result.outcome==="COMPLETED"&&result.discrepancies.some((d)=>d.discrepancyType==="DEAD_LETTER_WITHOUT_ESCALATION")).toBe(true); });
  it("invokes only certified escalation auto-repair", async () => { const row=await enqueue(producer,"auto-repair"); await producer.query(`UPDATE "GlwProducerDelivery" SET "deliveryStatus"='DEAD_LETTER',"deadLetteredAt"=clock_timestamp(),"deadLetterReason"='ATTEMPT_BUDGET_EXHAUSTED' WHERE "idempotencyKey"=$1`,[row.idempotencyKey]); const result=await service(producer,genesis).run({...runInput(),allowAutoRepair:true}); expect(result.outcome==="COMPLETED"&&result.discrepancies.find((d)=>d.discrepancyType==="DEAD_LETTER_WITHOUT_ESCALATION")?.autoRepairResult).toBe("CERTIFIED_E_REFRESH_INVOKED"); expect(Number((await producer.query(`SELECT count(*) FROM "GlwProducerDeliveryEscalation"`)).rows[0].count)).toBe(1); });
  it("detects delivery attempt ledger mismatch", async () => { const row=await enqueue(producer,"attempt-mismatch"); await producer.query(`UPDATE "GlwProducerDelivery" SET "attemptCount"=1,"nextAttemptAt"=clock_timestamp()+interval '1 hour' WHERE "idempotencyKey"=$1`,[row.idempotencyKey]); const result=await service(producer,genesis).run(runInput()); expect(result.outcome==="COMPLETED"&&result.discrepancies.some((d)=>d.discrepancyType==="DELIVERY_ATTEMPT_COUNT_MISMATCH")).toBe(true); });
  it("detects stale pending and worker heartbeat", async () => { const row=await enqueue(producer,"stale-pending"); await producer.query(`UPDATE "GlwProducerDelivery" SET "nextAttemptAt"=clock_timestamp()-interval '10 minutes' WHERE "idempotencyKey"=$1`,[row.idempotencyKey]); const result=await service(producer,genesis).run(runInput()); expect(result.outcome==="COMPLETED"&&result.discrepancies.map((d)=>d.discrepancyType)).toEqual(expect.arrayContaining(["PENDING_RETRY_OVER_AGE","DUE_WORK_STALE_HEARTBEAT"])); });
  it("detects recovery attempt ledger mismatch", async () => { const row=await enqueue(producer,"recovery-mismatch"); await producer.query(`UPDATE "GlwProducerDelivery" SET "deliveryStatus"='DEAD_LETTER',"deadLetteredAt"=clock_timestamp(),"deadLetterReason"='ATTEMPT_BUDGET_EXHAUSTED' WHERE "idempotencyKey"=$1`,[row.idempotencyKey]); const recovery=(await producer.query(`SELECT * FROM "requestGlwProducerDeliveryRecovery"($1,'operator','OPERATOR','request-f','documented recovery reason')`,[row.idempotencyKey])).rows[0]; await producer.query(`UPDATE "GlwProducerDeliveryRecoveryAuthorization" SET "attemptCount"=1 WHERE "recoveryAuthorizationId"=$1`,[recovery.recoveryAuthorizationId]); const result=await service(producer,genesis).run(runInput()); expect(result.outcome==="COMPLETED"&&result.discrepancies.some((d)=>d.discrepancyType==="RECOVERY_ATTEMPT_COUNT_MISMATCH")).toBe(true); });
  it("preserves repeated discrepancy observations across runs", async () => { const row=await enqueue(producer,"repeat-dirty"); await deleteDelivery(producer,row.idempotencyKey); await service(producer,genesis).run(runInput()); await service(producer,genesis).run(runInput()); expect(Number((await producer.query(`SELECT count(*) FROM "GlwProducerDeliveryReconciliationDiscrepancy" WHERE "discrepancyType"='OUTBOX_WITHOUT_DELIVERY_GT_60S'`)).rows[0].count)).toBe(2); });
  it("records clean run after source truth naturally converges", async () => { const row=await enqueue(producer,"dirty-clean"); await deleteDelivery(producer,row.idempotencyKey); expect((await service(producer,genesis).run(runInput())).outcome).toBe("COMPLETED"); await restoreDelivery(producer,row.idempotencyKey); await producer.query(`SELECT * FROM "heartbeatGlwProducerDeliveryWorker"('worker','instance',false,false)`); const clean=await service(producer,genesis).run(runInput()); expect(clean).toMatchObject({outcome:"COMPLETED",status:"CLEAN"}); expect(Number((await producer.query(`SELECT count(*) FROM "GlwProducerDeliveryReconciliationRun"`)).rows[0].count)).toBe(2); });
  it("persists FAILED run when Genesis snapshot read fails", async () => { await genesis.query(`ALTER TABLE "GlwCallbackReceipt" RENAME TO "GlwCallbackReceiptUnavailable"`); try{await expect(service(producer,genesis).run(runInput())).rejects.toThrow();}finally{await genesis.query(`ALTER TABLE "GlwCallbackReceiptUnavailable" RENAME TO "GlwCallbackReceipt"`);} expect((await producer.query(`SELECT status,"failureClass" FROM "GlwProducerDeliveryReconciliationRun"`)).rows[0]).toMatchObject({status:"FAILED",failureClass:"error"}); });
});
