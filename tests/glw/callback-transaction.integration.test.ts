import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { deriveGlwCallbackIdentity, hashCanonicalGlwCallbackPayload } from "@/lib/glw/callback-idempotency";
import {
  applyDurableGlwTerminalCallback,
  GlwCallbackTransactionUnavailableError,
  validateGlwTerminalCallbackPayload,
} from "@/lib/glw/callback-transaction";
import type { GlwPageGenerationCallbackPayload } from "@/lib/glw/jobs";

const databaseUrl = process.env.HR004_SLICE_B_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

function createClient(connectionString = databaseUrl!): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function failedPayload(jobId: string, executionId = `${jobId}-execution`): GlwPageGenerationCallbackPayload {
  return {
    jobId,
    executionId,
    status: "FAILED",
    error: { code: "TEST_FAILURE", step: "callback", message: "Synthetic callback failure." },
  };
}

function completePayload(jobId: string, executionId = `${jobId}-execution`): GlwPageGenerationCallbackPayload {
  return {
    jobId,
    executionId,
    status: "COMPLETE",
    title: "HR-004 integration page",
    wordpressPageId: 12004,
    wordpressPostId: 12004,
    wordpressUrl: "https://example.test/hr004-integration/",
    wordpressStatus: "publish",
    requestedPublishingMode: "publish",
  };
}

function v2Payload(payload: GlwPageGenerationCallbackPayload, operationKey: string): GlwPageGenerationCallbackPayload {
  const withIdentity = {
    ...payload,
    callbackVersion: "2" as const,
    operationKey,
    callbackType: "PAGE_GENERATION_TERMINAL" as const,
    idempotencyKey: `glw-callback-v2:${operationKey}:${payload.jobId}:${payload.executionId}:PAGE_GENERATION_TERMINAL:${payload.status}`,
    terminalScopeKey: `glw-terminal-v2:${operationKey}:${payload.jobId}:${payload.executionId}:PAGE_GENERATION_TERMINAL`,
  };
  return { ...withIdentity, payloadSha256: hashCanonicalGlwCallbackPayload(withIdentity).payloadSha256 };
}

describeDatabase("HR-004 Slice B durable callback transaction", () => {
  let prisma: PrismaClient;

  jest.setTimeout(30_000);

  async function seedJob(jobId: string, options: { status?: "RUNNING" | "COMPLETE" | "FAILED"; operationKey?: string; withExecution?: boolean } = {}) {
    const status = options.status ?? "RUNNING";
    const executionId = `${jobId}-execution`;
    await prisma.glwJob.create({
      data: {
        id: jobId,
        type: "PAGE_GENERATION",
        status,
        siteId: "test-site",
        title: "HR-004 integration page",
        input: {
          site: { id: "test-site" },
          page: { workspaceId: "test-workspace", status: "publish", hierarchicalSlug: "hr004-integration" },
        },
        result: status === "RUNNING" ? { executionId, status } : Prisma.JsonNull,
        error: Prisma.JsonNull,
        externalExecutionId: executionId,
        operationKey: options.operationKey,
        businessStatus: status === "RUNNING" ? "IN_PROGRESS" : status,
        startedAt: new Date("2026-08-17T20:00:00.000Z"),
        completedAt: status === "RUNNING" ? null : new Date("2026-08-17T20:01:00.000Z"),
      },
    });
    if (options.withExecution !== false) {
      await prisma.gopExecution.create({
        data: {
          executionId: `gop-${jobId}`,
          executionType: "PAGE_GENERATION",
          jobId,
          moduleId: "glw",
          workspaceId: "test-workspace",
          childExecutionIds: [],
          status: status === "RUNNING" ? "RUNNING" : status,
          currentState: status === "RUNNING" ? "RUNNING" : status,
          priority: "NORMAL",
          retryHistory: [],
          context: {},
          input: { jobId },
          output: Prisma.JsonNull,
          artifacts: [],
        },
      });
    }
    return { jobId, executionId };
  }

  async function counts(jobId: string) {
    const [receipts, events, snapshots] = await Promise.all([
      prisma.glwCallbackReceipt.count({ where: { jobId } }),
      prisma.gopJobEvent.count({ where: { jobId } }),
      prisma.gopExecutionSnapshot.count({ where: { execution: { jobId } } }),
    ]);
    return { receipts, events, snapshots };
  }

  async function installFailureTrigger(table: "GlwJob" | "GopExecution" | "GopExecutionSnapshot" | "GopJobEvent", operation: "UPDATE" | "INSERT") {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION hr004_test_fail_write() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'HR004_TEST_FORCED_WRITE_FAILURE'; END $$;
      CREATE TRIGGER hr004_test_fail_write BEFORE ${operation} ON "${table}"
      FOR EACH ROW EXECUTE FUNCTION hr004_test_fail_write();
    `);
  }

  beforeAll(async () => {
    prisma = createClient();
    const identity = await prisma.$queryRaw<Array<{ database: string; port: number; systemIdentifier: bigint }>>`
      SELECT current_database() AS database,
             inet_server_port() AS port,
             (SELECT system_identifier FROM pg_control_system()) AS "systemIdentifier"
    `;
    expect(identity[0]?.database).toBe("genesis_hr004_slice_b_test_9a12");
    expect(identity[0]?.port).toBe(55432);
    expect(identity[0]?.systemIdentifier.toString()).toBe("7674981943527448724");
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS hr004_test_fail_write ON "GlwJob"`);
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS hr004_test_fail_write ON "GopExecution"`);
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS hr004_test_fail_write ON "GopExecutionSnapshot"`);
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS hr004_test_fail_write ON "GopJobEvent"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS hr004_test_fail_write()`);
    await prisma.gopExecutionSnapshot.deleteMany({ where: { execution: { jobId: { startsWith: "test_hr004_" } } } });
    await prisma.gopJobEvent.deleteMany({ where: { jobId: { startsWith: "test_hr004_" } } });
    await prisma.gopExecution.deleteMany({ where: { jobId: { startsWith: "test_hr004_" } } });
    await prisma.glwCallbackReceipt.deleteMany({ where: { jobId: { startsWith: "test_hr004_" } } });
    await prisma.glwJob.deleteMany({ where: { id: { startsWith: "test_hr004_" } } });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it("applies a legacy v1 terminal callback", async () => {
    const fixture = await seedJob("test_hr004_apply_v1");
    const result = await applyDurableGlwTerminalCallback(completePayload(fixture.jobId), prisma);
    expect(result.outcome).toBe("APPLIED");
  });

  it("persists the deterministic legacy receipt identity", async () => {
    const fixture = await seedJob("test_hr004_v1_identity");
    const payload = failedPayload(fixture.jobId);
    const identity = deriveGlwCallbackIdentity(payload);
    await applyDurableGlwTerminalCallback(payload, prisma);
    const receipt = await prisma.glwCallbackReceipt.findUnique({ where: { idempotencyKey: identity.idempotencyKey } });
    expect(receipt).toMatchObject({ terminalScopeKey: identity.terminalScopeKey, payloadSha256: identity.payloadSha256, outcome: "APPLIED" });
  });

  it("accepts an exact v2 identity matching the persisted operation", async () => {
    const fixture = await seedJob("test_hr004_apply_v2", { operationKey: "operation-v2" });
    const result = await applyDurableGlwTerminalCallback(v2Payload(completePayload(fixture.jobId), "operation-v2"), prisma);
    expect(result.outcome).toBe("APPLIED");
  });

  it("commits GLW, GOP, snapshot, event, and receipt together", async () => {
    const fixture = await seedJob("test_hr004_atomic_commit");
    const result = await applyDurableGlwTerminalCallback(completePayload(fixture.jobId), prisma);
    const job = await prisma.glwJob.findUniqueOrThrow({ where: { id: fixture.jobId } });
    const execution = await prisma.gopExecution.findUniqueOrThrow({ where: { jobId: fixture.jobId } });
    expect(job).toMatchObject({ status: "COMPLETE", businessStatus: "COMPLETE", callbackDeliveryStatus: "ACKNOWLEDGED", terminalReceiptId: result.outcome === "APPLIED" ? result.receiptId : undefined });
    expect(execution.status).toBe("SUCCEEDED");
    expect(await counts(fixture.jobId)).toEqual({ receipts: 1, events: 1, snapshots: 1 });
  });

  it("stores a complete replayable Genesis execution state in the terminal snapshot", async () => {
    const fixture = await seedJob("test_hr004_snapshot_state");
    await applyDurableGlwTerminalCallback(completePayload(fixture.jobId), prisma);
    const snapshot = await prisma.gopExecutionSnapshot.findFirstOrThrow({ where: { execution: { jobId: fixture.jobId } } });
    expect(snapshot.state).toMatchObject({
      executionId: `gop-${fixture.jobId}`,
      jobId: fixture.jobId,
      workspaceId: "test-workspace",
      moduleId: "glw",
      jobType: "PAGE_GENERATION",
      executionClass: "AUTOMATED",
      status: "SUCCEEDED",
      graph: { graphId: "glw:persisted", nodes: [], edges: [] },
      timing: { completedAt: expect.any(String) },
    });
  });

  it("returns ALREADY_APPLIED for a sequential exact replay", async () => {
    const fixture = await seedJob("test_hr004_replay");
    const payload = completePayload(fixture.jobId);
    await applyDurableGlwTerminalCallback(payload, prisma);
    expect((await applyDurableGlwTerminalCallback(payload, prisma)).outcome).toBe("ALREADY_APPLIED");
  });

  it("keeps one terminal effect across many sequential replays", async () => {
    const fixture = await seedJob("test_hr004_many_replays");
    const payload = failedPayload(fixture.jobId);
    for (let index = 0; index < 8; index += 1) {
      await applyDurableGlwTerminalCallback(payload, prisma);
    }
    expect(await counts(fixture.jobId)).toEqual({ receipts: 1, events: 1, snapshots: 1 });
  });

  it("classifies replay from a new client using durable state", async () => {
    const fixture = await seedJob("test_hr004_restart_replay");
    const payload = failedPayload(fixture.jobId);
    await applyDurableGlwTerminalCallback(payload, prisma);
    const restartedClient = createClient();
    try {
      expect((await applyDurableGlwTerminalCallback(payload, restartedClient)).outcome).toBe("ALREADY_APPLIED");
    } finally {
      await restartedClient.$disconnect();
    }
  });

  it("rejects the same key with a different payload hash", async () => {
    const fixture = await seedJob("test_hr004_payload_conflict");
    const payload = failedPayload(fixture.jobId);
    await applyDurableGlwTerminalCallback(payload, prisma);
    const conflict = { ...payload, error: { ...payload.error!, message: "Changed failure." } };
    expect((await applyDurableGlwTerminalCallback(conflict, prisma)).outcome).toBe("IDEMPOTENCY_CONFLICT");
  });

  it("rejects a different terminal status for the same scope", async () => {
    const fixture = await seedJob("test_hr004_terminal_conflict");
    await applyDurableGlwTerminalCallback(completePayload(fixture.jobId), prisma);
    expect((await applyDurableGlwTerminalCallback(failedPayload(fixture.jobId), prisma)).outcome).toBe("TERMINAL_CONFLICT");
  });

  it("rejects a changed COMPLETE result without overwriting the winner", async () => {
    const fixture = await seedJob("test_hr004_result_conflict");
    const payload = completePayload(fixture.jobId);
    await applyDurableGlwTerminalCallback(payload, prisma);
    expect((await applyDurableGlwTerminalCallback({ ...payload, wordpressPageId: 99999, wordpressPostId: 99999 }, prisma)).outcome).toBe("IDEMPOTENCY_CONFLICT");
    const job = await prisma.glwJob.findUniqueOrThrow({ where: { id: fixture.jobId } });
    expect((job.result as Record<string, unknown>).wordpressPageId).toBe(12004);
  });

  it("returns NOT_FOUND without a receipt", async () => {
    const payload = failedPayload("test_hr004_missing_job");
    expect((await applyDurableGlwTerminalCallback(payload, prisma)).outcome).toBe("NOT_FOUND");
    expect(await prisma.glwCallbackReceipt.count({ where: { jobId: payload.jobId } })).toBe(0);
  });

  it("rejects the wrong execution without a receipt", async () => {
    const fixture = await seedJob("test_hr004_wrong_execution");
    const result = await applyDurableGlwTerminalCallback(failedPayload(fixture.jobId, "wrong-execution"), prisma);
    expect(result.outcome).toBe("EXECUTION_CONFLICT");
    expect((await counts(fixture.jobId)).receipts).toBe(0);
  });

  it("rejects the wrong v2 operation without a receipt", async () => {
    const fixture = await seedJob("test_hr004_wrong_operation", { operationKey: "persisted-operation" });
    const result = await applyDurableGlwTerminalCallback(v2Payload(failedPayload(fixture.jobId), "wrong-operation"), prisma);
    expect(result.outcome).toBe("EXECUTION_CONFLICT");
    expect((await counts(fixture.jobId)).receipts).toBe(0);
  });

  it("rejects COMPLETE to FAILED and rolls back the attempted receipt", async () => {
    const fixture = await seedJob("test_hr004_complete_failed", { status: "COMPLETE" });
    const result = await applyDurableGlwTerminalCallback(failedPayload(fixture.jobId), prisma);
    expect(result.outcome).toBe("STATE_CONFLICT");
    expect((await counts(fixture.jobId)).receipts).toBe(0);
  });

  it("rejects FAILED to COMPLETE and rolls back the attempted receipt", async () => {
    const fixture = await seedJob("test_hr004_failed_complete", { status: "FAILED" });
    const result = await applyDurableGlwTerminalCallback(completePayload(fixture.jobId), prisma);
    expect(result.outcome).toBe("STATE_CONFLICT");
    expect((await counts(fixture.jobId)).receipts).toBe(0);
  });

  it("rolls back a receipt when the GOP execution is absent", async () => {
    const fixture = await seedJob("test_hr004_missing_gop", { withExecution: false });
    await expect(applyDurableGlwTerminalCallback(failedPayload(fixture.jobId), prisma)).rejects.toThrow("GOP execution not found");
    const job = await prisma.glwJob.findUniqueOrThrow({ where: { id: fixture.jobId } });
    expect(job.status).toBe("RUNNING");
    expect((await counts(fixture.jobId)).receipts).toBe(0);
  });

  it.each([
    ["GlwJob", "UPDATE"],
    ["GopExecution", "UPDATE"],
    ["GopExecutionSnapshot", "INSERT"],
    ["GopJobEvent", "INSERT"],
  ] as const)("rolls back every effect when %s %s fails", async (table, operation) => {
    const fixture = await seedJob(`test_hr004_rollback_${table.toLowerCase()}`);
    await installFailureTrigger(table, operation);
    await expect(applyDurableGlwTerminalCallback(failedPayload(fixture.jobId), prisma)).rejects.toThrow();
    const job = await prisma.glwJob.findUniqueOrThrow({ where: { id: fixture.jobId } });
    expect(job.status).toBe("RUNNING");
    expect(await counts(fixture.jobId)).toEqual({ receipts: 0, events: 0, snapshots: 0 });
  });

  it("rejects invalid terminal semantics before creating a receipt", async () => {
    const fixture = await seedJob("test_hr004_invalid_complete");
    const invalid = { ...completePayload(fixture.jobId), wordpressUrl: undefined };
    expect(() => validateGlwTerminalCallbackPayload(invalid)).toThrow("WordPress URL");
    expect((await counts(fixture.jobId)).receipts).toBe(0);
  });

  it("maps an unreachable database to a retryable unavailable error", async () => {
    const unavailable = createClient("postgresql://hr004_test_admin@127.0.0.1:55431/genesis_hr004_slice_b_test_9a12?connect_timeout=1");
    try {
      await expect(applyDurableGlwTerminalCallback(failedPayload("test_hr004_unavailable"), unavailable)).rejects.toMatchObject<Partial<GlwCallbackTransactionUnavailableError>>({ code: "DATABASE_UNAVAILABLE" });
    } finally {
      await unavailable.$disconnect();
    }
  });

  it("returns TRANSACTION_RETRY after bounded serialization retries are exhausted", async () => {
    const serializationError = Object.assign(new Error("could not serialize access due to concurrent update (40001)"), { code: "P2010" });
    const transientPrisma = {
      $transaction: jest.fn(async () => { throw serializationError; }),
    } as unknown as PrismaClient;
    await expect(applyDurableGlwTerminalCallback(failedPayload("test_hr004_serialization"), transientPrisma)).rejects.toMatchObject({ code: "TRANSACTION_RETRY" });
    expect(transientPrisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("serializes two simultaneous identical callbacks", async () => {
    const fixture = await seedJob("test_hr004_concurrent_two");
    const payload = completePayload(fixture.jobId);
    const clients = [createClient(), createClient()];
    try {
      const results = await Promise.all(clients.map((client) => applyDurableGlwTerminalCallback(payload, client)));
      expect(results.map((result) => result.outcome).sort()).toEqual(["ALREADY_APPLIED", "APPLIED"]);
      expect(await counts(fixture.jobId)).toEqual({ receipts: 1, events: 1, snapshots: 1 });
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
    }
  });

  it("serializes ten simultaneous identical callbacks to one effect", async () => {
    const fixture = await seedJob("test_hr004_concurrent_ten");
    const payload = failedPayload(fixture.jobId);
    const clients = Array.from({ length: 10 }, () => createClient());
    try {
      const results = await Promise.all(clients.map((client) => applyDurableGlwTerminalCallback(payload, client)));
      expect(results.filter((result) => result.outcome === "APPLIED")).toHaveLength(1);
      expect(results.filter((result) => result.outcome === "ALREADY_APPLIED")).toHaveLength(9);
      expect(await counts(fixture.jobId)).toEqual({ receipts: 1, events: 1, snapshots: 1 });
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
    }
  });

  it("serializes simultaneous same-key conflicting payloads to one winner", async () => {
    const fixture = await seedJob("test_hr004_concurrent_payload_conflict");
    const left = failedPayload(fixture.jobId);
    const right = { ...left, error: { ...left.error!, message: "Conflicting simultaneous payload." } };
    const clients = [createClient(), createClient()];
    try {
      const results = await Promise.all([
        applyDurableGlwTerminalCallback(left, clients[0]),
        applyDurableGlwTerminalCallback(right, clients[1]),
      ]);
      expect(results.map((result) => result.outcome).sort()).toEqual(["APPLIED", "IDEMPOTENCY_CONFLICT"]);
      expect(await counts(fixture.jobId)).toEqual({ receipts: 1, events: 1, snapshots: 1 });
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
    }
  });

  it("serializes simultaneous terminal keys for one scope to one winner", async () => {
    const fixture = await seedJob("test_hr004_concurrent_terminal_conflict");
    const clients = [createClient(), createClient()];
    try {
      const results = await Promise.all([
        applyDurableGlwTerminalCallback(completePayload(fixture.jobId), clients[0]),
        applyDurableGlwTerminalCallback(failedPayload(fixture.jobId), clients[1]),
      ]);
      expect(results.some((result) => result.outcome === "APPLIED")).toBe(true);
      expect(results.some((result) => result.outcome === "TERMINAL_CONFLICT")).toBe(true);
      expect(await counts(fixture.jobId)).toEqual({ receipts: 1, events: 1, snapshots: 1 });
    } finally {
      await Promise.all(clients.map((client) => client.$disconnect()));
    }
  });
});