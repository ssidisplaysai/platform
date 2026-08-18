import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { sanitizeGlwDeliveryDiagnostic } from "./callback-delivery-contract";

export const GLW_RECONCILIATION_INTERVAL_SECONDS = 60;
export const GLW_RECONCILIATION_BATCH_SIZE = 500;
export const GLW_RECONCILIATION_MAX_SNAPSHOT_SKEW_MS = 5_000;
export const GLW_DURABLE_EVIDENCE_RETENTION_YEARS = 7;
export const GLW_HIGH_RESOLUTION_TELEMETRY_DAYS = 90;
export const GLW_AGGREGATE_TELEMETRY_MONTHS = 13;

export type GlwReconciliationStatus = "CLEAN" | "DISCREPANCIES" | "INDETERMINATE" | "FAILED";
export type GlwReconciliationRunType = "SCHEDULED" | "OPERATOR" | "ROLLOUT_READINESS" | "CANARY" | "CLOSURE";
export type GlwDiscrepancySeverity = "INFORMATIONAL" | "WARNING" | "ACTION_REQUIRED" | "CRITICAL";

export type GlwReconciliationDiscrepancy = {
  discrepancyKey: string;
  discrepancyType: string;
  severity: GlwDiscrepancySeverity;
  idempotencyKey?: string;
  operationKey?: string;
  publicationKey?: string | null;
  jobId?: string;
  externalExecutionId?: string;
  recoveryAuthorizationId?: string;
  safeExpected: Record<string, unknown>;
  safeActual: Record<string, unknown>;
  repairAuthority: string;
  autoRepairEligible: boolean;
  autoRepairResult?: string;
};

type ProducerCompletion = {
  operationKey: string;
  publicationKey: string | null;
  idempotencyKey: string;
  terminalScopeKey: string;
  jobId: string;
  externalExecutionId: string;
  terminalStatus: string;
  payloadSha256: string;
  outboxPresent: boolean;
};

type ProducerDelivery = {
  idempotencyKey: string;
  operationKey: string;
  publicationKey: string | null;
  deliveryStatus: string;
  attemptCount: number;
  createdAt: Date;
  nextAttemptAt: Date;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  acknowledgedAt: Date | null;
  deadLetteredAt: Date | null;
  deadLetterReason: string | null;
  requestBodySha256: string;
  outboxPresent: boolean;
  attemptLedgerCount: number;
  activeEscalationCount: number;
};

type ProducerRecovery = {
  recoveryAuthorizationId: string;
  idempotencyKey: string;
  recoveryState: string;
  attemptCount: number;
  attemptLedgerCount: number;
  approvalExpiresAt: Date | null;
  nextAttemptAt: Date | null;
  deliveryDeadlineAt: Date | null;
  leaseToken: string | null;
};

type ProducerSnapshot = {
  snapshotAt: Date;
  completions: ProducerCompletion[];
  deliveries: ProducerDelivery[];
  recoveries: ProducerRecovery[];
  heartbeatAt: Date | null;
};

type GenesisReceipt = {
  idempotencyKey: string;
  terminalScopeKey: string;
  operationKey: string;
  jobId: string;
  externalExecutionId: string;
  terminalStatus: string;
  payloadSha256: string;
  outcome: string;
};

type GenesisJob = {
  id: string;
  status: string;
  businessStatus: string | null;
  operationKey: string | null;
  publicationKey: string | null;
  externalExecutionId: string | null;
  terminalReceiptId: string | null;
};

type GenesisExecution = {
  executionId: string;
  jobId: string | null;
  status: string;
  currentState: string | null;
  correlationId: string | null;
  terminalEventCount: number;
  terminalSnapshotCount: number;
  latestSnapshotStatus: string | null;
};

type GenesisSnapshot = {
  snapshotAt: Date;
  receipts: GenesisReceipt[];
  jobs: GenesisJob[];
  executions: GenesisExecution[];
};

export type GlwRolloutReadinessInput = {
  artifactChainCertified: boolean;
  migrationsCertified: boolean;
  workflowsSanitized: boolean;
  secretAuthoritySynchronized: boolean;
  productionBaselineHealthy: boolean;
  rollbackAuthorityAvailable: boolean;
  workflowsInactive: boolean;
  noIncompatiblePendingState: boolean;
  migrationDryRunPass: boolean;
  callbackAuthPass: boolean;
  publicLocalTransportHealthy: boolean;
  cloudflareHealthy: boolean;
  latestReconciliation?: { status: GlwReconciliationStatus; snapshotSkewMs: number; criticalCount: number; discrepancyCount: number } | null;
};

export type GlwRetentionInput = {
  createdAt: Date;
  now?: Date;
  terminal: boolean;
  escalationResolved: boolean;
  pendingRecovery: boolean;
  activeLease: boolean;
  acknowledgedEvidence: boolean;
  openDiscrepancy: boolean;
  activeRolloutIncident: boolean;
  legalHold: boolean;
  archiveChecksumVerified: boolean;
  externalDeletePolicyAuthorized?: boolean;
};

export type GlwClosureInput = {
  implementationComplete: boolean;
  artifactCertified: boolean;
  rolloutReady: boolean;
  rolloutComplete: boolean;
  canaryPass: boolean;
  stabilityPass: boolean;
  reconciliationClean: boolean;
  noActiveIncident: boolean;
  noSecretContamination: boolean;
  rollbackAuthorityRetained: boolean;
  operatorVisibilityAvailable: boolean;
};

export type GlwCanaryEvidence = {
  producerOperationCount: number;
  producerPublicationCount: number;
  producerCompletionCount: number;
  producerOutboxCount: number;
  producerDeliveryCount: number;
  originalAttemptCount: number;
  recoveryCycleCount: number;
  recoveryAttemptCount: number;
  receiverReceiptCount: number;
  receiverOutcome: string | null;
  glwTerminalEffectCount: number;
  gopTerminalExecutionCount: number;
  terminalEventCount: number;
  terminalSnapshotCount: number;
  deliveryStatus: string | null;
  activeLeaseCount: number;
  deadLetterCount: number;
  activeEscalationCount: number;
  reconciliationStatus: GlwReconciliationStatus | null;
  reconciliationDiscrepancyCount: number;
};

const AUTO_REPAIR_ALLOWLIST = new Set(["DEAD_LETTER_WITHOUT_ESCALATION", "ACK_WITH_UNRESOLVED_ESCALATION"]);
const TERMINAL_GLW = new Set(["COMPLETE", "FAILED", "FAILED_QA"]);
const TERMINAL_GOP = new Set(["SUCCEEDED", "FAILED", "CANCELLED", "TIMED_OUT", "ARCHIVED"]);

function producerPool(): Pool {
  const connectionString = process.env.GLW_PRODUCER_DATABASE_URL;
  if (!connectionString) throw new Error("GLW_PRODUCER_DATABASE_URL is required for reconciliation.");
  return new Pool({ connectionString, max: 8 });
}

function genesisPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for reconciliation.");
  return new Pool({ connectionString, max: 8 });
}

function safeValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeGlwDeliveryDiagnostic(value).slice(0, 500);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(safeValue);
  if (typeof value === "object" && value) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !/payload|authorization|password|secret|token|credential|url/i.test(key))
      .slice(0, 20)
      .map(([key, entry]) => [key, safeValue(entry)]));
  }
  return undefined;
}

function discrepancyKey(type: string, ...identity: Array<string | null | undefined>): string {
  return createHash("sha256").update([type, ...identity].join("|"), "utf8").digest("hex");
}

function discrepancy(input: Omit<GlwReconciliationDiscrepancy, "discrepancyKey">): GlwReconciliationDiscrepancy {
  return {
    ...input,
    discrepancyKey: discrepancyKey(input.discrepancyType, input.idempotencyKey, input.operationKey, input.jobId, input.recoveryAuthorizationId),
    safeExpected: safeValue(input.safeExpected) as Record<string, unknown>,
    safeActual: safeValue(input.safeActual) as Record<string, unknown>,
  };
}

export function classifyGlwSnapshotSkew(producerSnapshotAt: Date, genesisSnapshotAt: Date) {
  const snapshotSkewMs = Math.abs(producerSnapshotAt.getTime() - genesisSnapshotAt.getTime());
  return { snapshotSkewMs, determinate: snapshotSkewMs <= GLW_RECONCILIATION_MAX_SNAPSHOT_SKEW_MS };
}

export function isGlwAutoRepairAllowed(discrepancyType: string): boolean {
  return AUTO_REPAIR_ALLOWLIST.has(discrepancyType);
}

export function evaluateGlwRolloutReadiness(input: GlwRolloutReadinessInput) {
  const blockers: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (key !== "latestReconciliation" && value !== true) blockers.push(key);
  }
  const reconciliation = input.latestReconciliation;
  if (!reconciliation) blockers.push("latestReconciliation");
  else {
    if (reconciliation.status !== "CLEAN") blockers.push(`reconciliation:${reconciliation.status}`);
    if (reconciliation.snapshotSkewMs > GLW_RECONCILIATION_MAX_SNAPSHOT_SKEW_MS) blockers.push("snapshotSkew");
    if (reconciliation.criticalCount !== 0 || reconciliation.discrepancyCount !== 0) blockers.push("blockingDiscrepancy");
  }
  return { ready: blockers.length === 0, blockers };
}

export function evaluateGlwRetentionEligibility(input: GlwRetentionInput) {
  const now = input.now ?? new Date();
  const ageYears = (now.getTime() - input.createdAt.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  const blocked = !input.terminal || !input.escalationResolved || input.pendingRecovery || input.activeLease
    || !input.acknowledgedEvidence || input.openDiscrepancy || input.activeRolloutIncident || input.legalHold;
  if (blocked) return "BLOCKED_FROM_CLEANUP" as const;
  if (ageYears < GLW_DURABLE_EVIDENCE_RETENTION_YEARS) return "RETAIN" as const;
  if (!input.archiveChecksumVerified) return "ARCHIVE_ELIGIBLE" as const;
  return input.externalDeletePolicyAuthorized
    ? "DELETE_ELIGIBLE_IF_EXTERNAL_POLICY_AUTHORIZES" as const
    : "ARCHIVE_ELIGIBLE" as const;
}

export function evaluateGlwClosure(input: GlwClosureInput) {
  const stages = {
    IMPLEMENTATION_COMPLETE: input.implementationComplete,
    ARTIFACT_CERTIFIED: input.implementationComplete && input.artifactCertified,
    ROLLOUT_READY: input.artifactCertified && input.rolloutReady,
    ROLLOUT_COMPLETE: input.rolloutReady && input.rolloutComplete,
    CANARY_PASS: input.rolloutComplete && input.canaryPass,
    STABILITY_PASS: input.canaryPass && input.stabilityPass,
    HR004_CLOSED: input.stabilityPass && input.reconciliationClean && input.noActiveIncident
      && input.noSecretContamination && input.rollbackAuthorityRetained && input.operatorVisibilityAvailable,
  };
  const current = Object.entries(stages).filter(([, passed]) => passed).at(-1)?.[0] ?? "NOT_ELIGIBLE_FOR_CLOSURE";
  return { current, closed: stages.HR004_CLOSED, stages };
}

export function evaluateGlwCanary(evidence: GlwCanaryEvidence) {
  const expected: Partial<GlwCanaryEvidence> = {
    producerOperationCount: 1, producerPublicationCount: 1, producerCompletionCount: 1,
    producerOutboxCount: 1, producerDeliveryCount: 1, originalAttemptCount: 1,
    recoveryCycleCount: 0, recoveryAttemptCount: 0, receiverReceiptCount: 1,
    receiverOutcome: "APPLIED", glwTerminalEffectCount: 1, gopTerminalExecutionCount: 1,
    terminalEventCount: 1, terminalSnapshotCount: 1, deliveryStatus: "ACKNOWLEDGED",
    activeLeaseCount: 0, deadLetterCount: 0, activeEscalationCount: 0,
    reconciliationStatus: "CLEAN", reconciliationDiscrepancyCount: 0,
  };
  const failures = Object.entries(expected).filter(([key, value]) => evidence[key as keyof GlwCanaryEvidence] !== value)
    .map(([key]) => key);
  return { passed: failures.length === 0, failures };
}

export function evaluateGlwRollbackStage(stage: string, hasProducerRows: boolean) {
  const matrix: Record<string, string> = {
    MIGRATIONS_ONLY: "RETAIN_FORWARD_ONLY_SCHEMA_ROLLBACK_RUNTIME_WORKFLOW",
    B_DEPLOYED_C_INACTIVE: "ROLLBACK_B_IF_COMPATIBLE_AND_NO_C_ROWS",
    C_IMPORTED_INACTIVE: "REMOVE_OR_KEEP_INACTIVE_EXPORT_NO_STATE_CHANGE",
    D_IMPORTED_INACTIVE: "REMOVE_OR_KEEP_INACTIVE_EXPORT_NO_STATE_CHANGE",
    F_ACTIVE_BEFORE_C_D: "DISABLE_F_PRESERVE_RECONCILIATION_EVIDENCE",
    C_ACTIVE_D_TRANSIENT: hasProducerRows ? "PAUSE_C_FORWARD_ACTIVATE_D_NO_DIRECT_RETURN" : "PAUSE_C_ROLLBACK_IF_ZERO_ROWS",
    C_D_ACTIVE: "PAUSE_C_DEACTIVATE_D_PRESERVE_ROWS_WAIT_LEASE_EXPIRY",
    CANARY_PENDING: "NO_MUTATION_UNTIL_SEPARATE_AUTHORIZATION",
    CANARY_FAILED: "PAUSE_C_THEN_D_PRESERVE_ALL_NO_AUTOMATIC_RETRY",
    STABILITY_PENDING: "HOLD_ACTIVATION_STATE_NO_CLOSURE",
    CLOSURE_ELIGIBLE: "RETAIN_ROLLBACK_ARTIFACTS_AND_FORWARD_SCHEMA",
  };
  return { stage, decision: matrix[stage] ?? "STOP_UNKNOWN_STAGE", dualSendAllowed: false };
}

async function inReadSnapshot<T>(client: PoolClient, fn: () => Promise<T>): Promise<T> {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    const result = await fn();
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function readProducerSnapshot(client: PoolClient): Promise<ProducerSnapshot> {
  return inReadSnapshot(client, async () => {
    const snapshotAt = (await client.query<{ now: Date }>(`SELECT clock_timestamp() AS now`)).rows[0].now;
    const completions = (await client.query<ProducerCompletion>(`
      SELECT completion."operationKey",completion."publicationKey",completion."idempotencyKey",completion."terminalScopeKey",
        completion."jobId",completion."externalExecutionId",completion."terminalStatus",completion."payloadSha256",
        (outbox."idempotencyKey" IS NOT NULL) AS "outboxPresent"
      FROM "GlwProducerCompletion" completion LEFT JOIN "GlwProducerOutbox" outbox USING ("idempotencyKey")`)).rows;
    const deliveries = (await client.query<ProducerDelivery>(`
      SELECT delivery."idempotencyKey",delivery."operationKey",delivery."publicationKey",delivery."deliveryStatus",delivery."attemptCount",
        delivery."createdAt",delivery."nextAttemptAt",delivery."leaseToken",delivery."leaseExpiresAt",delivery."acknowledgedAt",
        delivery."deadLetteredAt",delivery."deadLetterReason",delivery."requestBodySha256",
        (outbox."idempotencyKey" IS NOT NULL) AS "outboxPresent",
        (SELECT count(*)::int FROM "GlwProducerDeliveryAttempt" attempt WHERE attempt."idempotencyKey"=delivery."idempotencyKey") AS "attemptLedgerCount",
        (SELECT count(*)::int FROM "GlwProducerDeliveryEscalation" escalation WHERE escalation."idempotencyKey"=delivery."idempotencyKey" AND escalation."escalationState" IN ('OPEN','ACKNOWLEDGED')) AS "activeEscalationCount"
      FROM "GlwProducerDelivery" delivery LEFT JOIN "GlwProducerOutbox" outbox USING ("idempotencyKey")`)).rows;
    const recoveries = (await client.query<ProducerRecovery>(`
      SELECT recovery."recoveryAuthorizationId",recovery."idempotencyKey",recovery."recoveryState",recovery."attemptCount",
        recovery."approvalExpiresAt",recovery."nextAttemptAt",recovery."deliveryDeadlineAt",recovery."leaseToken",
        (SELECT count(*)::int FROM "GlwProducerDeliveryRecoveryAttempt" attempt WHERE attempt."recoveryAuthorizationId"=recovery."recoveryAuthorizationId") AS "attemptLedgerCount"
      FROM "GlwProducerDeliveryRecoveryAuthorization" recovery`)).rows;
    const heartbeatAt = (await client.query<{ observedAt: Date }>(`SELECT "observedAt" FROM "GlwProducerDeliveryWorkerHeartbeat" ORDER BY "observedAt" DESC LIMIT 1`)).rows[0]?.observedAt ?? null;
    return { snapshotAt, completions, deliveries, recoveries, heartbeatAt };
  });
}

async function readGenesisSnapshot(client: PoolClient): Promise<GenesisSnapshot> {
  return inReadSnapshot(client, async () => {
    const snapshotAt = (await client.query<{ now: Date }>(`SELECT clock_timestamp() AS now`)).rows[0].now;
    const receipts = (await client.query<GenesisReceipt>(`SELECT "idempotencyKey","terminalScopeKey","operationKey","jobId","externalExecutionId","terminalStatus","payloadSha256","outcome" FROM "GlwCallbackReceipt"`)).rows;
    const jobs = (await client.query<GenesisJob>(`SELECT "id","status","businessStatus","operationKey","publicationKey","externalExecutionId","terminalReceiptId" FROM "GlwJob" WHERE "operationKey" IS NOT NULL`)).rows;
    const executions = (await client.query<GenesisExecution>(`
      SELECT execution."executionId",execution."jobId",execution."status",execution."currentState",execution."correlationId",
        (SELECT count(*)::int FROM "GopJobEvent" event WHERE event."jobId"=execution."jobId" AND (event."eventType" IN ('SUCCEEDED','FAILED') OR event."status" IN ('COMPLETE','FAILED'))) AS "terminalEventCount",
        (SELECT count(*)::int FROM "GopExecutionSnapshot" snapshot WHERE snapshot."executionId"=execution."executionId" AND snapshot."status" IN ('SUCCEEDED','FAILED','CANCELLED','TIMED_OUT','ARCHIVED')) AS "terminalSnapshotCount",
        (SELECT snapshot."status" FROM "GopExecutionSnapshot" snapshot WHERE snapshot."executionId"=execution."executionId" ORDER BY snapshot."snapshotSequence" DESC LIMIT 1) AS "latestSnapshotStatus"
      FROM "GopExecution" execution WHERE execution."jobId" IS NOT NULL`)).rows;
    return { snapshotAt, receipts, jobs, executions };
  });
}

export function detectGlwReconciliationDiscrepancies(producer: ProducerSnapshot, genesis: GenesisSnapshot, now = new Date()) {
  const findings: GlwReconciliationDiscrepancy[] = [];
  const deliveries = new Map(producer.deliveries.map((row) => [row.idempotencyKey, row]));
  const completions = new Map(producer.completions.map((row) => [row.idempotencyKey, row]));
  const receipts = new Map(genesis.receipts.map((row) => [row.idempotencyKey, row]));
  const jobs = new Map(genesis.jobs.map((row) => [row.id, row]));
  const executions = new Map(genesis.executions.filter((row) => row.jobId).map((row) => [row.jobId!, row]));

  for (const completion of producer.completions) {
    if (!completion.outboxPresent) findings.push(discrepancy({ discrepancyType: "COMPLETION_WITHOUT_OUTBOX", severity: "CRITICAL", ...completion, safeExpected: { outbox: true }, safeActual: { outbox: false }, repairAuthority: "SLICE_C_FORWARD_REMEDIATION", autoRepairEligible: false }));
  }
  for (const delivery of producer.deliveries) {
    const completion = completions.get(delivery.idempotencyKey);
    const receipt = receipts.get(delivery.idempotencyKey);
    if (!delivery.outboxPresent) findings.push(discrepancy({ discrepancyType: "DELIVERY_WITHOUT_OUTBOX", severity: "CRITICAL", ...delivery, safeExpected: { outbox: true }, safeActual: { outbox: false }, repairAuthority: "SCHEMA_FORENSIC_GATE", autoRepairEligible: false }));
    if (delivery.attemptCount !== delivery.attemptLedgerCount) findings.push(discrepancy({ discrepancyType: "DELIVERY_ATTEMPT_COUNT_MISMATCH", severity: "CRITICAL", ...delivery, safeExpected: { attemptCount: delivery.attemptCount }, safeActual: { ledgerCount: delivery.attemptLedgerCount }, repairAuthority: "SLICE_D_INCIDENT", autoRepairEligible: false }));
    if (["ACKNOWLEDGED", "DEAD_LETTER"].includes(delivery.deliveryStatus) && delivery.leaseToken) findings.push(discrepancy({ discrepancyType: "TERMINAL_WITH_ACTIVE_LEASE", severity: "CRITICAL", ...delivery, safeExpected: { activeLease: false }, safeActual: { activeLease: true }, repairAuthority: "SLICE_D_E_INCIDENT", autoRepairEligible: false }));
    if (delivery.deliveryStatus === "ACKNOWLEDGED" && !receipt) findings.push(discrepancy({ discrepancyType: "ACK_WITHOUT_RECEIPT", severity: "CRITICAL", ...delivery, safeExpected: { receipt: true }, safeActual: { receipt: false }, repairAuthority: "INCIDENT_REMEDIATION", autoRepairEligible: false }));
    if (receipt?.outcome === "APPLIED" && delivery.deliveryStatus !== "ACKNOWLEDGED") findings.push(discrepancy({ discrepancyType: "RECEIPT_APPLIED_DELIVERY_NOT_ACK", severity: delivery.deliveryStatus === "DEAD_LETTER" ? "CRITICAL" : "ACTION_REQUIRED", ...delivery, safeExpected: { deliveryStatus: "ACKNOWLEDGED" }, safeActual: { deliveryStatus: delivery.deliveryStatus }, repairAuthority: "SLICE_D_NATURAL_RESEND_OR_INCIDENT", autoRepairEligible: false }));
    if (receipt && completion && (receipt.terminalScopeKey !== completion.terminalScopeKey || receipt.operationKey !== completion.operationKey || receipt.jobId !== completion.jobId || receipt.externalExecutionId !== completion.externalExecutionId || receipt.terminalStatus !== completion.terminalStatus || receipt.payloadSha256 !== completion.payloadSha256)) findings.push(discrepancy({ discrepancyType: "RECEIPT_IDENTITY_OR_HASH_MISMATCH", severity: "CRITICAL", ...delivery, safeExpected: { identityMatch: true }, safeActual: { identityMatch: false }, repairAuthority: "ARCHITECTURE_INCIDENT", autoRepairEligible: false }));
    if (delivery.deliveryStatus === "DEAD_LETTER" && delivery.activeEscalationCount === 0) findings.push(discrepancy({ discrepancyType: "DEAD_LETTER_WITHOUT_ESCALATION", severity: "ACTION_REQUIRED", ...delivery, safeExpected: { activeEscalation: true }, safeActual: { activeEscalation: false }, repairAuthority: "CERTIFIED_E_REFRESH", autoRepairEligible: true }));
    if (delivery.deliveryStatus === "ACKNOWLEDGED" && delivery.activeEscalationCount > 0) findings.push(discrepancy({ discrepancyType: "ACK_WITH_UNRESOLVED_ESCALATION", severity: "WARNING", ...delivery, safeExpected: { activeEscalation: false }, safeActual: { activeEscalation: true }, repairAuthority: "CERTIFIED_E_REFRESH", autoRepairEligible: true }));
    const ageMs = now.getTime() - delivery.nextAttemptAt.getTime();
    if ((delivery.deliveryStatus === "PENDING" || delivery.deliveryStatus === "RETRY_SCHEDULED") && ageMs > 60_000) findings.push(discrepancy({ discrepancyType: "PENDING_RETRY_OVER_AGE", severity: ageMs > 300_000 ? "ACTION_REQUIRED" : "WARNING", ...delivery, safeExpected: { ageBelowThreshold: true }, safeActual: { ageMs }, repairAuthority: "SLICE_D_RUNTIME_OPERATIONS", autoRepairEligible: false }));
  }

  for (const completion of producer.completions) {
    if (!deliveries.has(completion.idempotencyKey) && completion.outboxPresent) findings.push(discrepancy({ discrepancyType: "OUTBOX_WITHOUT_DELIVERY_GT_60S", severity: "CRITICAL", ...completion, safeExpected: { delivery: true }, safeActual: { delivery: false }, repairAuthority: "SLICE_D_BACKFILL_REMEDIATION_GATE", autoRepairEligible: false }));
    const receipt = receipts.get(completion.idempotencyKey);
    const job = jobs.get(completion.jobId);
    const execution = executions.get(completion.jobId);
    if (job && TERMINAL_GLW.has(job.status) && (!receipt || receipt.outcome !== "APPLIED")) findings.push(discrepancy({ discrepancyType: "GLW_TERMINAL_WITHOUT_APPLIED_RECEIPT", severity: "CRITICAL", ...completion, safeExpected: { receiptOutcome: "APPLIED" }, safeActual: { receiptOutcome: receipt?.outcome ?? null }, repairAuthority: "RECEIVER_INCIDENT", autoRepairEligible: false }));
    if (job && TERMINAL_GLW.has(job.status) && execution && !TERMINAL_GOP.has(execution.status)) findings.push(discrepancy({ discrepancyType: "GLW_TERMINAL_GOP_NONTERMINAL", severity: "CRITICAL", ...completion, safeExpected: { gopTerminal: true }, safeActual: { gopStatus: execution.status }, repairAuthority: "B_GOP_REMEDIATION", autoRepairEligible: false }));
    if (job && !TERMINAL_GLW.has(job.status) && execution && TERMINAL_GOP.has(execution.status)) findings.push(discrepancy({ discrepancyType: "GOP_TERMINAL_GLW_NONTERMINAL", severity: "CRITICAL", ...completion, safeExpected: { glwTerminal: true }, safeActual: { glwStatus: job.status }, repairAuthority: "B_GLW_REMEDIATION", autoRepairEligible: false }));
    if (execution && TERMINAL_GOP.has(execution.status) && execution.terminalEventCount !== 1) findings.push(discrepancy({ discrepancyType: "TERMINAL_EVENT_COUNT_NOT_ONE", severity: "CRITICAL", ...completion, safeExpected: { count: 1 }, safeActual: { count: execution.terminalEventCount }, repairAuthority: "B_GOP_INCIDENT", autoRepairEligible: false }));
    if (execution && TERMINAL_GOP.has(execution.status) && (execution.terminalSnapshotCount !== 1 || execution.latestSnapshotStatus !== execution.status)) findings.push(discrepancy({ discrepancyType: "SNAPSHOT_STATUS_INCONSISTENT", severity: "ACTION_REQUIRED", ...completion, safeExpected: { count: 1, status: execution.status }, safeActual: { count: execution.terminalSnapshotCount, status: execution.latestSnapshotStatus }, repairAuthority: "GOP_PROJECTION_REMEDIATION", autoRepairEligible: false }));
  }

  for (const recovery of producer.recoveries) {
    if (recovery.attemptCount !== recovery.attemptLedgerCount) findings.push(discrepancy({ discrepancyType: "RECOVERY_ATTEMPT_COUNT_MISMATCH", severity: "CRITICAL", idempotencyKey: recovery.idempotencyKey, recoveryAuthorizationId: recovery.recoveryAuthorizationId, safeExpected: { count: recovery.attemptCount }, safeActual: { count: recovery.attemptLedgerCount }, repairAuthority: "SLICE_E_INCIDENT", autoRepairEligible: false }));
    if (recovery.recoveryState === "APPROVED" && (!recovery.nextAttemptAt || !recovery.deliveryDeadlineAt || (recovery.approvalExpiresAt && recovery.approvalExpiresAt < now))) findings.push(discrepancy({ discrepancyType: "APPROVED_RECOVERY_NOT_ELIGIBLE_OR_EXPIRED", severity: "ACTION_REQUIRED", idempotencyKey: recovery.idempotencyKey, recoveryAuthorizationId: recovery.recoveryAuthorizationId, safeExpected: { dueAndUnexpired: true }, safeActual: { dueAndUnexpired: false }, repairAuthority: "SLICE_E_OPERATOR_SYSTEM", autoRepairEligible: false }));
  }
  const dueWork = producer.deliveries.some((row) => ["PENDING", "RETRY_SCHEDULED"].includes(row.deliveryStatus) && row.nextAttemptAt <= now);
  if (dueWork && (!producer.heartbeatAt || now.getTime() - producer.heartbeatAt.getTime() > 300_000)) findings.push(discrepancy({ discrepancyType: "DUE_WORK_STALE_HEARTBEAT", severity: "CRITICAL", safeExpected: { heartbeatFresh: true }, safeActual: { heartbeatFresh: false }, repairAuthority: "RUNTIME_OPERATIONS", autoRepairEligible: false }));
  return findings;
}

async function insertEvidence(pool: Pool, input: {
  runId: string; runType: GlwReconciliationRunType; triggeredBy: string; sourceCommit: string; sourceTree: string; sourceBuild?: string;
  producer: ProducerSnapshot; genesis: GenesisSnapshot; startedAt: Date; completedAt: Date; status: GlwReconciliationStatus;
  discrepancies: GlwReconciliationDiscrepancy[]; autoRepairCount: number; truncated?: boolean; failureClass?: string;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const skew = classifyGlwSnapshotSkew(input.producer.snapshotAt, input.genesis.snapshotAt).snapshotSkewMs;
    await client.query({ text: `INSERT INTO "GlwProducerDeliveryReconciliationRun" (
      "reconciliationRunId","runType","triggeredBy","sourceCommit","sourceTree","sourceBuild","producerSnapshotAt","genesisSnapshotAt","snapshotSkewMs","startedAt","completedAt","status","producerScannedCount","genesisScannedCount","discrepancyCount","criticalCount","autoRepairCount","safeMetrics","truncated","failureClass"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20)`, values: [
      input.runId,input.runType,input.triggeredBy,input.sourceCommit,input.sourceTree,input.sourceBuild ?? null,input.producer.snapshotAt,input.genesis.snapshotAt,skew,input.startedAt,input.completedAt,input.status,
      input.producer.completions.length + input.producer.deliveries.length + input.producer.recoveries.length,
      input.genesis.receipts.length + input.genesis.jobs.length + input.genesis.executions.length,input.discrepancies.length,
      input.discrepancies.filter((row) => row.severity === "CRITICAL").length,input.autoRepairCount,
      JSON.stringify({ discrepancyBySeverity: Object.fromEntries(["WARNING","ACTION_REQUIRED","CRITICAL"].map((severity) => [severity, input.discrepancies.filter((row) => row.severity === severity).length])) }),
      input.truncated ?? false,input.failureClass ?? null,
    ] });
    for (const row of input.discrepancies) {
      await client.query({ text: `INSERT INTO "GlwProducerDeliveryReconciliationDiscrepancy" (
        "reconciliationRunId","discrepancyKey","discrepancyType","severity","idempotencyKey","operationKey","publicationKey","jobId","externalExecutionId","recoveryAuthorizationId","safeExpected","safeActual","repairAuthority","autoRepairEligible","autoRepairResult","detectedAt"
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb,$13,$14,$15,$16)`, values: [
        input.runId,row.discrepancyKey,row.discrepancyType,row.severity,row.idempotencyKey ?? null,row.operationKey ?? null,row.publicationKey ?? null,row.jobId ?? null,row.externalExecutionId ?? null,row.recoveryAuthorizationId ?? null,JSON.stringify(row.safeExpected),JSON.stringify(row.safeActual),row.repairAuthority,row.autoRepairEligible,row.autoRepairResult ?? null,input.completedAt,
      ] });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export function createGlwDeliveryReconciliationService(dependencies: { producer?: Pool; genesis?: Pool } = {}) {
  const producer = dependencies.producer ?? producerPool();
  const genesis = dependencies.genesis ?? genesisPool();

  async function run(input: { runType: GlwReconciliationRunType; triggeredBy: string; sourceCommit: string; sourceTree: string; sourceBuild?: string; allowAutoRepair?: boolean }) {
    const lock = await producer.connect();
    const producerRead = await producer.connect();
    const genesisRead = await genesis.connect();
    const startedAt = new Date();
    const runId = randomUUID();
    let locked = false;
    try {
      locked = (await lock.query<{ locked: boolean }>(`SELECT pg_try_advisory_lock(hashtext('hr004:delivery-reconciliation')) AS locked`)).rows[0].locked;
      if (!locked) return { outcome: "ALREADY_RUNNING" as const };
      const [producerSnapshot, genesisSnapshot] = await Promise.all([readProducerSnapshot(producerRead), readGenesisSnapshot(genesisRead)]);
      const skew = classifyGlwSnapshotSkew(producerSnapshot.snapshotAt, genesisSnapshot.snapshotAt);
      let discrepancies = detectGlwReconciliationDiscrepancies(producerSnapshot, genesisSnapshot);
      let autoRepairCount = 0;
      if (input.allowAutoRepair && discrepancies.some((row) => isGlwAutoRepairAllowed(row.discrepancyType))) {
        const repair = await producer.query<{ count: number }>(`SELECT "refreshGlwProducerDeliveryEscalations"() AS count`);
        autoRepairCount = Number(repair.rows[0]?.count ?? 0);
        discrepancies = discrepancies.map((row) => isGlwAutoRepairAllowed(row.discrepancyType) ? { ...row, autoRepairResult: "CERTIFIED_E_REFRESH_INVOKED" } : row);
      }
      const status: GlwReconciliationStatus = !skew.determinate ? "INDETERMINATE" : discrepancies.length ? "DISCREPANCIES" : "CLEAN";
      const completedAt = new Date();
      await insertEvidence(producer, { runId, ...input, producer: producerSnapshot, genesis: genesisSnapshot, startedAt, completedAt, status, discrepancies, autoRepairCount });
      return { outcome: "COMPLETED" as const, reconciliationRunId: runId, status, snapshotSkewMs: skew.snapshotSkewMs, discrepancies, autoRepairCount };
    } catch (error) {
      const completedAt = new Date();
      const emptyProducer: ProducerSnapshot = { snapshotAt: completedAt, completions: [], deliveries: [], recoveries: [], heartbeatAt: null };
      const emptyGenesis: GenesisSnapshot = { snapshotAt: completedAt, receipts: [], jobs: [], executions: [] };
      const failureClass = sanitizeGlwDeliveryDiagnostic(error instanceof Error ? error.name : "RECONCILIATION_FAILURE").slice(0, 100);
      if (locked) {
        await insertEvidence(producer, { runId, ...input, producer: emptyProducer, genesis: emptyGenesis, startedAt, completedAt, status: "FAILED", discrepancies: [], autoRepairCount: 0, failureClass }).catch(() => undefined);
      }
      throw error;
    } finally {
      await lock.query(`SELECT pg_advisory_unlock(hashtext('hr004:delivery-reconciliation'))`).catch(() => undefined);
      producerRead.release(); genesisRead.release(); lock.release();
    }
  }

  async function latest() {
    const run = (await producer.query(`SELECT * FROM "GlwProducerDeliveryReconciliationRun" ORDER BY "completedAt" DESC LIMIT 1`)).rows[0] ?? null;
    const discrepancies = run ? (await producer.query(`SELECT "discrepancyType","severity","repairAuthority","autoRepairEligible","detectedAt" FROM "GlwProducerDeliveryReconciliationDiscrepancy" WHERE "reconciliationRunId"=$1 ORDER BY "severity","discrepancyType"`, [run.reconciliationRunId])).rows : [];
    return { run, discrepancies };
  }

  return { run, latest };
}
