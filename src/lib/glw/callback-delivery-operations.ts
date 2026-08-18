import { createHash, randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { GenesisAuthorizationSubject } from "@/platform/gop/contracts";
import { sanitizeGlwDeliveryDiagnostic } from "./callback-delivery-contract";

export type GlwDeliveryAuthorizationClass = "VIEWER" | "OPERATOR" | "RECOVERY_APPROVER" | "ADMINISTRATOR";
export type GlwDeliveryOperatorAction =
  | "ACKNOWLEDGE_ESCALATION"
  | "ASSIGN_ESCALATION"
  | "COMMENT"
  | "REQUEST_RECOVERY"
  | "APPROVE_RECOVERY"
  | "REJECT_RECOVERY"
  | "CLOSE_ESCALATION";

export type GlwDeliverySafeSummary = {
  deliveryRef: string;
  operationRef: string;
  publicationRef: string | null;
  jobId: string;
  executionId: string;
  terminalStatus: string;
  deliveryStatus: string;
  attemptCount: number;
  firstAttemptAt: string | null;
  lastAttemptAt: string | null;
  nextAttemptAt: string;
  deliveryDeadlineAt: string;
  acknowledgedAt: string | null;
  deadLetteredAt: string | null;
  deadLetterReason: string | null;
  lastHttpStatus: number | null;
  lastErrorClass: string | null;
  lastResponseOutcome: string | null;
  payloadSha256: string;
  payloadSizeBytes: number;
  idempotencyRef: string;
  terminalScopeRef: string;
  lease: { active: boolean; owner: string | null; expiresAt: string | null };
  escalation: Record<string, unknown> | null;
  recovery: Record<string, unknown> | null;
};

export type GlwDeliveryOperationsSnapshot = {
  generatedAt: string;
  operationalStatus: "HEALTHY" | "WARNING" | "ACTION_REQUIRED" | "CRITICAL";
  metrics: Record<string, number>;
  deliveries: GlwDeliverySafeSummary[];
};

let singletonPool: Pool | null = null;

function producerPool(): Pool {
  if (!singletonPool) {
    const connectionString = process.env.GLW_PRODUCER_DATABASE_URL;
    if (!connectionString) throw new Error("GLW_PRODUCER_DATABASE_URL is required for delivery operations.");
    singletonPool = new Pool({ connectionString, max: 10 });
  }
  return singletonPool;
}

export async function disconnectGlwDeliveryOperationsPool(): Promise<void> {
  if (singletonPool) await singletonPool.end();
  singletonPool = null;
}

export function resolveGlwDeliveryAuthorizationClass(subject: GenesisAuthorizationSubject): GlwDeliveryAuthorizationClass {
  if (subject.role === "ADMINISTRATOR") return "ADMINISTRATOR";
  if (subject.role === "MANAGER") return "RECOVERY_APPROVER";
  if (subject.role === "OPERATOR") return "OPERATOR";
  return "VIEWER";
}

export function safeDeliveryReference(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16)}`;
}

export function sanitizeDeliveryOperatorText(value: string, minimum = 3): string {
  const sanitized = sanitizeGlwDeliveryDiagnostic(value).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 1000);
  if (sanitized.length < minimum) throw new Error("A safe operator reason is required.");
  return sanitized;
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function createGlwDeliveryOperationsService(pool: Pool = producerPool()) {
  async function resolveIdempotencyKey(reference: string): Promise<string> {
    if (!reference.startsWith("sha256:")) return reference;
    const row = (await pool.query<{ idempotencyKey: string }>({
      text: `SELECT "idempotencyKey" FROM "GlwProducerDelivery"
        WHERE 'sha256:' || substr(encode(digest(convert_to("idempotencyKey", 'UTF8'), 'sha256'), 'hex'), 1, 16) = $1`,
      values: [reference],
    })).rows[0];
    if (!row) throw new Error("GLW_DELIVERY_NOT_FOUND");
    return row.idempotencyKey;
  }

  async function refreshEscalations() {
    return (await pool.query<{ count: number }>(`SELECT "refreshGlwProducerDeliveryEscalations"() AS count`)).rows[0]?.count ?? 0;
  }

  async function listDeliveries(input: { limit?: number; state?: string; deliveryRef?: string } = {}): Promise<GlwDeliveryOperationsSnapshot> {
    await refreshEscalations();
    const limit = Math.min(200, Math.max(1, input.limit ?? 50));
    const rows = (await pool.query({
      text: `
        SELECT delivery.*, outbox."terminalScopeKey", outbox."jobId", outbox."externalExecutionId", outbox."terminalStatus",
          octet_length(delivery."requestBodyUtf8") AS "payloadSizeBytes",
          to_jsonb(escalation) - 'idempotencyKey' - 'deduplicationKey' AS escalation,
          to_jsonb(recovery) - 'idempotencyKey' - 'requestId' - 'approvalRequestId' - 'requestReason' - 'approvalReason' AS recovery
        FROM "GlwProducerDelivery" AS delivery
        JOIN "GlwProducerOutbox" AS outbox USING ("idempotencyKey")
        LEFT JOIN LATERAL (
          SELECT * FROM "GlwProducerDeliveryEscalation" e WHERE e."idempotencyKey"=delivery."idempotencyKey"
          ORDER BY e."createdAt" DESC LIMIT 1
        ) escalation ON true
        LEFT JOIN LATERAL (
          SELECT * FROM "GlwProducerDeliveryRecoveryAuthorization" r WHERE r."idempotencyKey"=delivery."idempotencyKey"
          ORDER BY r."cycleNumber" DESC LIMIT 1
        ) recovery ON true
        WHERE ($1::text IS NULL OR delivery."deliveryStatus"=$1)
        ORDER BY COALESCE(delivery."deadLetteredAt",delivery."lastAttemptAt",delivery."createdAt") DESC
        LIMIT $2`,
      values: [input.state ?? null, limit],
    })).rows;

    const deliveries: GlwDeliverySafeSummary[] = rows.map((row) => {
      const delivery = row as Record<string, unknown>;
      return {
        deliveryRef: safeDeliveryReference(String(delivery.idempotencyKey)),
        operationRef: safeDeliveryReference(String(delivery.operationKey)),
        publicationRef: delivery.publicationKey ? safeDeliveryReference(String(delivery.publicationKey)) : null,
        jobId: String(delivery.jobId),
        executionId: String(delivery.externalExecutionId),
        terminalStatus: String(delivery.terminalStatus),
        deliveryStatus: String(delivery.deliveryStatus),
        attemptCount: Number(delivery.attemptCount),
        firstAttemptAt: iso(delivery.firstAttemptAt as Date | null),
        lastAttemptAt: iso(delivery.lastAttemptAt as Date | null),
        nextAttemptAt: iso(delivery.nextAttemptAt as Date)!,
        deliveryDeadlineAt: iso(delivery.deliveryDeadlineAt as Date)!,
        acknowledgedAt: iso(delivery.acknowledgedAt as Date | null),
        deadLetteredAt: iso(delivery.deadLetteredAt as Date | null),
        deadLetterReason: delivery.deadLetterReason ? sanitizeGlwDeliveryDiagnostic(String(delivery.deadLetterReason)) : null,
        lastHttpStatus: delivery.lastHttpStatus === null ? null : Number(delivery.lastHttpStatus),
        lastErrorClass: delivery.lastErrorClass ? sanitizeGlwDeliveryDiagnostic(String(delivery.lastErrorClass)) : null,
        lastResponseOutcome: delivery.lastResponseOutcome ? sanitizeGlwDeliveryDiagnostic(String(delivery.lastResponseOutcome)) : null,
        payloadSha256: String(delivery.requestBodySha256),
        payloadSizeBytes: Number(delivery.payloadSizeBytes),
        idempotencyRef: safeDeliveryReference(String(delivery.idempotencyKey)),
        terminalScopeRef: safeDeliveryReference(String(delivery.terminalScopeKey)),
        lease: {
          active: Boolean(delivery.leaseToken),
          owner: delivery.leaseOwner ? safeDeliveryReference(String(delivery.leaseOwner)) : null,
          expiresAt: iso(delivery.leaseExpiresAt as Date | null),
        },
        escalation: delivery.escalation as Record<string, unknown> | null,
        recovery: delivery.recovery as Record<string, unknown> | null,
      };
    });

    const metricRow = (await pool.query(`
      SELECT
        count(*) FILTER (WHERE "deliveryStatus"='PENDING')::int AS pending,
        count(*) FILTER (WHERE "deliveryStatus"='LEASED')::int AS leased,
        count(*) FILTER (WHERE "deliveryStatus"='IN_FLIGHT')::int AS "inFlight",
        count(*) FILTER (WHERE "deliveryStatus"='RETRY_SCHEDULED')::int AS retrying,
        count(*) FILTER (WHERE "deliveryStatus"='ACKNOWLEDGED')::int AS acknowledged,
        count(*) FILTER (WHERE "deliveryStatus"='DEAD_LETTER')::int AS "deadLetter",
        COALESCE(max(EXTRACT(EPOCH FROM (clock_timestamp()-"createdAt"))) FILTER (WHERE "deliveryStatus"='PENDING'),0)::int AS "oldestPendingAgeSeconds",
        COALESCE(max(EXTRACT(EPOCH FROM (clock_timestamp()-"nextAttemptAt"))) FILTER (WHERE "deliveryStatus"='RETRY_SCHEDULED'),0)::int AS "oldestRetryAgeSeconds",
        COALESCE(max(EXTRACT(EPOCH FROM (clock_timestamp()-"deadLetteredAt"))) FILTER (WHERE "deliveryStatus"='DEAD_LETTER'),0)::int AS "oldestDeadLetterAgeSeconds"
      FROM "GlwProducerDelivery"`)).rows[0] as Record<string, number>;
    const extra = (await pool.query(`
      SELECT
        count(*) FILTER (WHERE "lastHttpStatus"=530)::int AS "http530Count",
        count(*) FILTER (WHERE COALESCE("deadLetterReason",'') ILIKE '%CONFLICT%')::int AS "semanticConflictCount",
        count(*) FILTER (WHERE "deadLetterReason"='ATTEMPT_BUDGET_EXHAUSTED')::int AS "attemptExhaustionCount",
        (SELECT count(*)::int FROM "GlwProducerDeliveryRecoveryAuthorization") AS "recoveryRequestCount",
        (SELECT count(*)::int FROM "GlwProducerDeliveryRecoveryAuthorization" WHERE "approvedAt" IS NOT NULL) AS "recoveryApprovalCount",
        (SELECT count(*)::int FROM "GlwProducerDeliveryRecoveryAuthorization" WHERE "recoveryState" NOT IN ('REQUESTED','REJECTED','CANCELLED')) AS "recoveryCycleCount"
      FROM "GlwProducerDelivery"`)).rows[0] as Record<string, number>;
    const metrics = { ...metricRow, ...extra };
    const operationalStatus = metrics.semanticConflictCount > 0 ? "CRITICAL"
      : metrics.deadLetter > 0 || metrics.oldestPendingAgeSeconds > 300 ? "ACTION_REQUIRED"
        : metrics.retrying > 0 || metrics.oldestPendingAgeSeconds > 60 ? "WARNING" : "HEALTHY";
    return { generatedAt: new Date().toISOString(), operationalStatus, metrics, deliveries };
  }

  async function getDeliveryHistory(idempotencyKey: string) {
    idempotencyKey = await resolveIdempotencyKey(idempotencyKey);
    const [attempts, actions, recoveries] = await Promise.all([
      pool.query(`SELECT "attemptNumber","workerId","requestBodySha256","startedAt","finishedAt","resultClass","httpStatus","receiverOutcome","errorClass","durationMs" FROM "GlwProducerDeliveryAttempt" WHERE "idempotencyKey"=$1 ORDER BY "attemptNumber"`, [idempotencyKey]),
      pool.query(`SELECT "actionId","escalationId","recoveryAuthorizationId","actorId","actorRole","actionType","reason","priorState","newState","safeMetadata","correlationId","occurredAt" FROM "GlwProducerDeliveryOperatorAction" WHERE "idempotencyKey"=$1 ORDER BY "occurredAt"`, [idempotencyKey]),
      pool.query(`SELECT "recoveryAuthorizationId","cycleNumber","eligibilityClass","recoveryState","requestedBy","requestedRole","requestedAt","approvedBy","approvedRole","approvedAt","approvalExpiresAt","attemptCount","firstAttemptAt","lastAttemptAt","nextAttemptAt","deliveryDeadlineAt","lastHttpStatus","lastErrorClass","lastResponseOutcome","acknowledgedAt","deadLetteredAt","deadLetterReason","version" FROM "GlwProducerDeliveryRecoveryAuthorization" WHERE "idempotencyKey"=$1 ORDER BY "cycleNumber"`, [idempotencyKey]),
    ]);
    return { attempts: attempts.rows, actions: actions.rows, recoveries: recoveries.rows };
  }

  async function executeAction(input: {
    action: GlwDeliveryOperatorAction;
    actorId: string;
    actorRole: GlwDeliveryAuthorizationClass;
    requestId?: string;
    reason: string;
    idempotencyKey?: string;
    escalationId?: string;
    recoveryAuthorizationId?: string;
    expectedVersion?: number;
    assignee?: string;
  }) {
    const requestId = input.requestId ?? `delivery-action:${randomUUID()}`;
    const reason = sanitizeDeliveryOperatorText(input.reason, input.action === "COMMENT" ? 3 : 8);
    const idempotencyKey = input.idempotencyKey ? await resolveIdempotencyKey(input.idempotencyKey) : undefined;
    switch (input.action) {
      case "ACKNOWLEDGE_ESCALATION":
        return (await pool.query(`SELECT * FROM "acknowledgeGlwProducerDeliveryEscalation"($1,$2,$3,$4,$5,$6)`, [input.escalationId, input.expectedVersion, input.actorId, input.actorRole, requestId, reason])).rows[0];
      case "ASSIGN_ESCALATION":
        return (await pool.query(`SELECT * FROM "assignGlwProducerDeliveryEscalation"($1,$2,$3,$4,$5,$6,$7)`, [input.escalationId, input.expectedVersion, input.actorId, input.actorRole, requestId, input.assignee, reason])).rows[0];
      case "COMMENT":
        return (await pool.query(`SELECT "commentGlwProducerDelivery"($1,$2,$3,$4,$5,$6) AS "actionId"`, [idempotencyKey, input.escalationId, input.actorId, input.actorRole, requestId, reason])).rows[0];
      case "REQUEST_RECOVERY":
        return (await pool.query(`SELECT * FROM "requestGlwProducerDeliveryRecovery"($1,$2,$3,$4,$5)`, [idempotencyKey, input.actorId, input.actorRole, requestId, reason])).rows[0];
      case "APPROVE_RECOVERY":
        return (await pool.query(`SELECT * FROM "approveGlwProducerDeliveryRecovery"($1,$2,$3,$4,$5,$6)`, [input.recoveryAuthorizationId, input.expectedVersion, input.actorId, input.actorRole, requestId, reason])).rows[0];
      case "REJECT_RECOVERY":
        return (await pool.query(`SELECT * FROM "rejectGlwProducerDeliveryRecovery"($1,$2,$3,$4,$5,$6)`, [input.recoveryAuthorizationId, input.expectedVersion, input.actorId, input.actorRole, requestId, reason])).rows[0];
      case "CLOSE_ESCALATION":
        return (await pool.query(`SELECT * FROM "closeGlwProducerDeliveryEscalation"($1,$2,$3,$4,$5,$6)`, [input.escalationId, input.expectedVersion, input.actorId, input.actorRole, requestId, reason])).rows[0];
    }
  }

  return { refreshEscalations, listDeliveries, getDeliveryHistory, executeAction };
}
