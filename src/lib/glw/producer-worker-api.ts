import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";

export type WorkerCommandType = "WORKER_CYCLE" | "BEGIN_ATTEMPT" | "COMPLETE_ATTEMPT";

export type WorkerCycleInput = {
  commandId: string;
  workerId: string;
  instanceId: string;
};

export type BeginAttemptInput = {
  commandId: string;
  workerId: string;
  workKind: "ORIGINAL" | "RECOVERY";
  idempotencyKey: string;
  recoveryAuthorizationId?: string | null;
  leaseToken: string;
};

export type CompleteAttemptInput = BeginAttemptInput & {
  attemptNumber: number;
  resultClass: "ACKNOWLEDGED" | "RETRYABLE" | "DEAD_LETTER";
  httpStatus?: number | null;
  errorClass?: string | null;
  receiverOutcome?: string | null;
  receiverReceiptId?: string | null;
  durationMs?: number | null;
  jitterFraction: number;
};

type ClaimedWork = {
  workKind: "ORIGINAL" | "RECOVERY";
  recoveryAuthorizationId: string | null;
  idempotencyKey: string;
  leaseToken: string;
  attemptCount: number;
  requestBodyUtf8: string;
  requestBodySha256: string;
  leaseExpiresAt: Date;
};

type CommandRow = {
  commandType: WorkerCommandType;
  requestSha256: string;
  commandStatus: "STARTED" | "COMPLETED";
  safeResult: Record<string, unknown> | null;
};

const COMMAND_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{7,199}$/;
const WORKER_ID = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,99}$/;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

function requestHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function validateIdentity(commandId: string, workerId: string) {
  if (!COMMAND_ID.test(commandId)) throw new Error("GLW_WORKER_INVALID_COMMAND_ID");
  if (!WORKER_ID.test(workerId)) throw new Error("GLW_WORKER_INVALID_WORKER_ID");
}

async function beginCommand(client: PoolClient, commandType: WorkerCommandType, input: { commandId: string; workerId: string }) {
  validateIdentity(input.commandId, input.workerId);
  const hash = requestHash(input);
  const inserted = await client.query({
    text: `INSERT INTO "GlwProducerWorkerCommand" ("commandId","commandType","workerId","requestSha256")
      VALUES ($1,$2,$3,$4) ON CONFLICT ("commandId") DO NOTHING RETURNING "commandId"`,
    values: [input.commandId, commandType, input.workerId, hash],
  });
  if (inserted.rowCount) return { replay: false, hash, result: null } as const;
  const existing = (await client.query<CommandRow>({
    text: `SELECT "commandType","requestSha256","commandStatus","safeResult"
      FROM "GlwProducerWorkerCommand" WHERE "commandId"=$1 FOR UPDATE`,
    values: [input.commandId],
  })).rows[0];
  if (!existing || existing.commandType !== commandType || existing.requestSha256 !== hash) {
    throw new Error("GLW_WORKER_COMMAND_CONFLICT");
  }
  if (existing.commandStatus !== "COMPLETED") throw new Error("GLW_WORKER_COMMAND_INCOMPLETE");
  return { replay: true, hash, result: existing.safeResult } as const;
}

async function completeCommand(client: PoolClient, commandId: string, safeResult: Record<string, unknown>) {
  await client.query({
    text: `UPDATE "GlwProducerWorkerCommand" SET "commandStatus"='COMPLETED',"safeResult"=$2::jsonb,"completedAt"=clock_timestamp()
      WHERE "commandId"=$1 AND "commandStatus"='STARTED'`,
    values: [commandId, JSON.stringify(safeResult)],
  });
}

async function replayClaimedWork(client: PoolClient, commandId: string): Promise<ClaimedWork[]> {
  return (await client.query<ClaimedWork>({
    text: `SELECT item."workKind",item."recoveryAuthorizationId",item."idempotencyKey",item."leaseToken",
        item."attemptCount",delivery."requestBodyUtf8",delivery."requestBodySha256",item."leaseExpiresAt"
      FROM "GlwProducerWorkerCommandItem" item
      JOIN "GlwProducerDelivery" delivery USING ("idempotencyKey")
      WHERE item."commandId"=$1 ORDER BY item."itemIndex"`,
    values: [commandId],
  })).rows;
}

export function createGlwProducerWorkerApiService(pool = new Pool({ connectionString: process.env.GLW_PRODUCER_DATABASE_URL })) {
  async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await run(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async function workerCycle(input: WorkerCycleInput) {
    return transaction(async (client) => {
      const command = await beginCommand(client, "WORKER_CYCLE", input);
      if (command.replay) return { replayed: true, items: await replayClaimedWork(client, input.commandId) };
      await client.query(`SELECT "prepareGlwProducerDeliveryWork"($1,$2)`, [input.workerId, input.instanceId]);
      const items = (await client.query<ClaimedWork>(`SELECT * FROM "claimGlwProducerDeliveryWork"($1,10,60)`, [input.workerId])).rows;
      for (const [index, item] of items.entries()) {
        await client.query({
          text: `INSERT INTO "GlwProducerWorkerCommandItem" ("commandId","itemIndex","workKind","recoveryAuthorizationId","idempotencyKey","leaseToken","attemptCount","leaseExpiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          values: [input.commandId, index, item.workKind, item.recoveryAuthorizationId, item.idempotencyKey, item.leaseToken, item.attemptCount, item.leaseExpiresAt],
        });
      }
      await completeCommand(client, input.commandId, { itemCount: items.length });
      return { replayed: false, items };
    });
  }

  async function beginAttempt(input: BeginAttemptInput) {
    return transaction(async (client) => {
      const command = await beginCommand(client, "BEGIN_ATTEMPT", input);
      if (command.replay) return { replayed: true, attemptNumber: Number(command.result?.attemptNumber) };
      const attemptNumber = Number((await client.query<{ attemptNumber: number }>({
        text: `SELECT "beginGlwProducerDeliveryWork"($1,$2,$3::uuid,$4::uuid) AS "attemptNumber"`,
        values: [input.workKind, input.idempotencyKey, input.recoveryAuthorizationId ?? null, input.leaseToken],
      })).rows[0].attemptNumber);
      await completeCommand(client, input.commandId, { attemptNumber });
      return { replayed: false, attemptNumber };
    });
  }

  async function completeAttempt(input: CompleteAttemptInput) {
    return transaction(async (client) => {
      const command = await beginCommand(client, "COMPLETE_ATTEMPT", input);
      if (command.replay) return { replayed: true, deliveryStatus: String(command.result?.deliveryStatus) };
      const deliveryStatus = String((await client.query<{ deliveryStatus: string }>({
        text: `SELECT "completeGlwProducerDeliveryWork"($1,$2,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11,$12) AS "deliveryStatus"`,
        values: [input.workKind, input.idempotencyKey, input.recoveryAuthorizationId ?? null, input.leaseToken,
          input.attemptNumber, input.resultClass, input.httpStatus ?? null, input.errorClass ?? null,
          input.receiverOutcome ?? null, input.receiverReceiptId ?? null, input.durationMs ?? null, input.jitterFraction],
      })).rows[0].deliveryStatus);
      await completeCommand(client, input.commandId, { deliveryStatus });
      return { replayed: false, deliveryStatus };
    });
  }

  return { workerCycle, beginAttempt, completeAttempt };
}