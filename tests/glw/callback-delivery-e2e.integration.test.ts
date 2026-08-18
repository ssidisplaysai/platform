import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { applyDurableGlwTerminalCallback } from "@/lib/glw/callback-transaction";
import { classifyGlwDeliveryResult, sendGlwDeliveryRequest } from "@/lib/glw/callback-delivery-contract";
import { buildGlwProducerTerminalPayload, type GlwProducerTerminalPayload } from "@/lib/glw/producer-callback-contract";

const producerUrl = process.env.HR004_SLICE_D_PRODUCER_DATABASE_URL;
const genesisUrl = process.env.HR004_SLICE_D_GENESIS_DATABASE_URL;
const describeE2e = producerUrl && genesisUrl ? describe : describe.skip;

describeE2e("HR-004 Slice B+C+D delivery", () => {
  let producer: Pool;
  let genesis: PrismaClient;
  let server: Server;
  let callbackUrl: string;
  let serverMode: "receiver" | "503" | "429" = "receiver";
  let requestCount = 0;

  jest.setTimeout(30_000);

  async function seedReceiver(payload: GlwProducerTerminalPayload) {
    await genesis.glwJob.create({
      data: {
        id: payload.jobId,
        type: "PAGE_GENERATION",
        status: "RUNNING",
        siteId: "test-site",
        title: "Delivery e2e",
        input: { site: { id: "test-site" }, page: { workspaceId: "test-workspace", status: "publish", hierarchicalSlug: "delivery-e2e" } },
        result: { executionId: payload.executionId, status: "RUNNING" },
        error: Prisma.JsonNull,
        externalExecutionId: payload.executionId,
        operationKey: payload.operationKey,
        businessStatus: "IN_PROGRESS",
        startedAt: new Date(),
      },
    });
    await genesis.gopExecution.create({
      data: {
        executionId: `gop-${payload.jobId}`,
        executionType: "PAGE_GENERATION",
        jobId: payload.jobId,
        moduleId: "glw",
        workspaceId: "test-workspace",
        childExecutionIds: [],
        status: "RUNNING",
        currentState: "RUNNING",
        priority: "NORMAL",
        retryHistory: [],
        context: {},
        input: { jobId: payload.jobId },
        output: Prisma.JsonNull,
        artifacts: [],
      },
    });
  }

  function failedPayload(suffix: string) {
    return buildGlwProducerTerminalPayload({
      jobId: `test_hr004_d_e2e_${suffix}`,
      executionId: `execution-${suffix}`,
      status: "FAILED",
      error: { code: "TEST", message: "failed", step: "qa" },
    }, `glw-op-v1:e2e-${suffix}`);
  }

  function completePayload(suffix: string) {
    return buildGlwProducerTerminalPayload({
      jobId: `test_hr004_d_e2e_${suffix}`,
      executionId: `execution-${suffix}`,
      status: "COMPLETE",
      title: "Complete",
      wordpressPageId: 12004,
      wordpressPostId: 12004,
      wordpressUrl: "https://example.test/complete/",
      wordpressStatus: "publish",
      requestedPublishingMode: "publish",
    }, `glw-op-v1:e2e-${suffix}`);
  }

  async function enqueue(payload: GlwProducerTerminalPayload) {
    const client = await producer.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await client.query({
        text: `SELECT * FROM "enqueueGlwProducerCompletion"($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
        values: [payload.operationKey, `glw-publication-v1:${payload.jobId}`, payload.jobId, payload.executionId,
          payload.status, payload.idempotencyKey, payload.terminalScopeKey, JSON.stringify(payload), payload.payloadSha256],
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async function processOne(options: { finalize?: boolean; jitter?: number } = {}) {
    const claimed = (await producer.query(`SELECT * FROM "claimGlwProducerDeliveries"('e2e-worker',1,60)`)).rows[0];
    if (!claimed) return null;
    const attempt = (await producer.query(`SELECT "beginGlwProducerDeliveryAttempt"($1,$2) AS number`, [claimed.idempotencyKey, claimed.leaseToken])).rows[0].number;
    const transport = await sendGlwDeliveryRequest({ callbackUrl, requestBodyUtf8: claimed.requestBodyUtf8, bearerSecret: "test-only", timeoutMs: 500 });
    if (options.finalize === false) return { claimed, attempt, transport };
    const state = (await producer.query(`SELECT "completeGlwProducerDeliveryAttempt"($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) AS state`, [
      claimed.idempotencyKey, claimed.leaseToken, attempt,
      transport.result, transport.httpStatus ?? null,
      transport.result === "ACKNOWLEDGED" ? null : transport.class,
      transport.receiverOutcome ?? null, transport.receiverReceiptId ?? null, transport.durationMs, options.jitter ?? 0,
    ])).rows[0].state;
    return { claimed, attempt, transport, state };
  }

  async function effectCounts(jobId: string) {
    return {
      receipts: await genesis.glwCallbackReceipt.count({ where: { jobId } }),
      events: await genesis.gopJobEvent.count({ where: { jobId } }),
      snapshots: await genesis.gopExecutionSnapshot.count({ where: { execution: { jobId } } }),
    };
  }

  beforeAll(async () => {
    producer = new Pool({ connectionString: producerUrl, max: 20 });
    genesis = new PrismaClient({ adapter: new PrismaPg({ connectionString: genesisUrl! }) });
    await producer.query(`DROP SCHEMA public CASCADE; CREATE SCHEMA public`);
    await producer.query(await readFile(join(process.cwd(), "n8n/hr004/glw-producer-completion-outbox.sql"), "utf8"));
    await producer.query(await readFile(join(process.cwd(), "n8n/hr004/glw-producer-delivery-state.sql"), "utf8"));
    server = createServer(async (request, response) => {
      requestCount += 1;
      let body = "";
      for await (const chunk of request) body += chunk;
      if (serverMode !== "receiver") {
        response.statusCode = Number(serverMode);
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ outcome: "RETRYABLE_FAILURE" }));
        return;
      }
      const result = await applyDurableGlwTerminalCallback(JSON.parse(body), genesis);
      response.statusCode = result.outcome === "APPLIED" || result.outcome === "ALREADY_APPLIED" ? 200 : result.outcome === "NOT_FOUND" ? 404 : 409;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify(result));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    callbackUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/callback`;
  });

  beforeEach(async () => {
    serverMode = "receiver";
    requestCount = 0;
    await producer.query(`TRUNCATE "GlwProducerDeliveryAttempt", "GlwProducerDelivery", "GlwProducerOutbox", "GlwProducerCompletion", "GlwProducerPublication", "GlwProducerOperation"`);
    await genesis.gopExecutionSnapshot.deleteMany({ where: { execution: { jobId: { startsWith: "test_hr004_d_e2e_" } } } });
    await genesis.gopJobEvent.deleteMany({ where: { jobId: { startsWith: "test_hr004_d_e2e_" } } });
    await genesis.gopExecution.deleteMany({ where: { jobId: { startsWith: "test_hr004_d_e2e_" } } });
    await genesis.glwCallbackReceipt.deleteMany({ where: { jobId: { startsWith: "test_hr004_d_e2e_" } } });
    await genesis.glwJob.deleteMany({ where: { id: { startsWith: "test_hr004_d_e2e_" } } });
  });

  afterAll(async () => {
    if (server) await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (producer) await producer.end();
    if (genesis) await genesis.$disconnect();
  });

  it("delivers C pending to Slice B APPLIED and acknowledges", async () => {
    const payload = failedPayload("applied");
    await seedReceiver(payload); await enqueue(payload);
    expect(await processOne()).toMatchObject({ state: "ACKNOWLEDGED", transport: { class: "APPLIED" } });
    expect(await effectCounts(payload.jobId)).toEqual({ receipts: 1, events: 1, snapshots: 1 });
  });

  it("acknowledges receiver ALREADY_APPLIED", async () => {
    const payload = failedPayload("already");
    await seedReceiver(payload); await applyDurableGlwTerminalCallback(payload, genesis); await enqueue(payload);
    expect(await processOne()).toMatchObject({ state: "ACKNOWLEDGED", transport: { class: "ALREADY_APPLIED" } });
    expect(await effectCounts(payload.jobId)).toEqual({ receipts: 1, events: 1, snapshots: 1 });
  });

  it("recovers remote success after local acknowledgement loss", async () => {
    const payload = failedPayload("ack-loss");
    await seedReceiver(payload); await enqueue(payload);
    const first = await processOne({ finalize: false });
    expect(first?.transport.class).toBe("APPLIED");
    await producer.query(`UPDATE "GlwProducerDelivery" SET "leaseExpiresAt"=clock_timestamp()-interval '1 second'`);
    const second = await processOne();
    expect(second).toMatchObject({ attempt: 2, state: "ACKNOWLEDGED", transport: { class: "ALREADY_APPLIED" } });
    expect(requestCount).toBe(2);
    expect(await effectCounts(payload.jobId)).toEqual({ receipts: 1, events: 1, snapshots: 1 });
  });

  it.each(["503", "429"] as const)("persists HTTP %s retry then eventually acknowledges", async (mode) => {
    const payload = failedPayload(`retry-${mode}`);
    await seedReceiver(payload); await enqueue(payload); serverMode = mode;
    expect(await processOne()).toMatchObject({ state: "RETRY_SCHEDULED" });
    await producer.query(`UPDATE "GlwProducerDelivery" SET "nextAttemptAt"=clock_timestamp()-interval '1 second'`);
    serverMode = "receiver";
    expect(await processOne()).toMatchObject({ state: "ACKNOWLEDGED", attempt: 2 });
  });

  it("dead-letters an actual Slice B semantic conflict", async () => {
    const complete = completePayload("conflict");
    await seedReceiver(complete); await applyDurableGlwTerminalCallback(complete, genesis);
    const failed = failedPayload("conflict");
    await enqueue(failed);
    expect(await processOne()).toMatchObject({ state: "DEAD_LETTER", transport: { httpStatus: 409 } });
    expect(await effectCounts(complete.jobId)).toEqual({ receipts: 1, events: 1, snapshots: 1 });
  });

  it("dead-letters after exactly 12 transient attempts", async () => {
    const payload = failedPayload("exhaust");
    await seedReceiver(payload); await enqueue(payload); serverMode = "503";
    let final: Awaited<ReturnType<typeof processOne>> = null;
    for (let attempt = 1; attempt <= 12; attempt += 1) {
      final = await processOne();
      if (attempt < 12) await producer.query(`UPDATE "GlwProducerDelivery" SET "nextAttemptAt"=clock_timestamp()-interval '1 second'`);
    }
    expect(final).toMatchObject({ attempt: 12, state: "DEAD_LETTER" });
    expect(requestCount).toBe(12);
    expect(await claimAfterExhaustion()).toHaveLength(0);
  });

  async function claimAfterExhaustion() {
    return (await producer.query(`SELECT * FROM "claimGlwProducerDeliveries"('after-exhaustion',1,60)`)).rows;
  }

  it("recovers a crashed worker lease without consuming an attempt", async () => {
    const payload = failedPayload("lease-crash");
    await seedReceiver(payload); await enqueue(payload);
    const firstLease = (await producer.query(`SELECT * FROM "claimGlwProducerDeliveries"('crashed',1,60)`)).rows[0];
    expect(firstLease.attemptCount).toBe(0);
    expect((await producer.query(`SELECT * FROM "claimGlwProducerDeliveries"('early',1,60)`)).rows).toHaveLength(0);
    await producer.query(`UPDATE "GlwProducerDelivery" SET "leaseExpiresAt"=clock_timestamp()-interval '1 second'`);
    expect(await processOne()).toMatchObject({ attempt: 1, state: "ACKNOWLEDGED" });
  });

  it("stores and sends stable request bytes across retries", async () => {
    const payload = failedPayload("bytes");
    await seedReceiver(payload); await enqueue(payload);
    const before = (await producer.query(`SELECT "requestBodyUtf8", "requestBodySha256" FROM "GlwProducerDelivery"`)).rows[0];
    serverMode = "503"; await processOne();
    await producer.query(`UPDATE "GlwProducerDelivery" SET "nextAttemptAt"=clock_timestamp()-interval '1 second'`);
    serverMode = "receiver"; await processOne();
    const after = (await producer.query(`SELECT "requestBodyUtf8", "requestBodySha256" FROM "GlwProducerDelivery"`)).rows[0];
    expect(after).toEqual(before);
  });

  it("committed worker export is inactive and excludes Slice E", async () => {
    const workflow = JSON.parse(await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8"));
    expect(workflow.active).toBe(false);
    expect(workflow.nodes.map((node: { name: string }) => node.name)).toEqual([
      "Poll Due GLW Deliveries", "Claim Due GLW Deliveries", "Begin Durable Delivery Attempt",
      "Send Stored GLW Callback", "Classify GLW Delivery Result", "Finalize GLW Delivery Attempt",
    ]);
    expect(JSON.stringify(workflow)).not.toMatch(/escalation|operator notification|email|slack/i);
    const transport = workflow.nodes.find((node: { name: string }) => node.name === "Send Stored GLW Callback");
    const classifier = workflow.nodes.find((node: { name: string }) => node.name === "Classify GLW Delivery Result");
    expect(transport.onError).toBe("continueRegularOutput");
    expect(classifier.parameters.jsCode).toContain("TRANSPORT_ERROR");
  });

  it("worker export references encrypted credential without a resolved secret", async () => {
    const text = await readFile(join(process.cwd(), "backups/n8n/glw-callback-delivery-worker.json"), "utf8");
    expect(text).toContain("Genesis GLW Callback Auth 9A17");
    expect(text).not.toMatch(/Bearer\s+[^\s"']{12,}/i);
    expect(text).not.toMatch(/postgres(?:ql)?:\/\//i);
  });

  it("classifier agrees with actual Slice B semantic outcomes", () => {
    expect(classifyGlwDeliveryResult({ httpStatus: 200, receiverOutcome: "APPLIED" })).toEqual({ result: "ACKNOWLEDGED", class: "APPLIED" });
    expect(classifyGlwDeliveryResult({ httpStatus: 200, receiverOutcome: "ALREADY_APPLIED" })).toEqual({ result: "ACKNOWLEDGED", class: "ALREADY_APPLIED" });
    expect(classifyGlwDeliveryResult({ httpStatus: 409, receiverOutcome: "TERMINAL_CONFLICT" })).toEqual({ result: "DEAD_LETTER", class: "TERMINAL_CONFLICT" });
  });
});