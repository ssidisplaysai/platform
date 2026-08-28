import type {
  CampaignExecutionPlan,
  CampaignExecutionPlanStatus,
  CampaignTargetExecutionRecord,
} from "./campaign-execution";
import { projectGlwTerminalExecution } from "./campaign-execution";
import type { GlwPageExecutionRecord } from "../glw/page-execution";
import type { CampaignApproval } from "./campaign-approval";
import {
  prepareReviewedRetry,
  type CampaignTargetRetryAuthorization,
} from "./campaign-retry-authorization";
import {
  deepClone,
  loadPersistedState,
  resetPersistedState,
  savePersistedState,
} from "./foundation-persistence";

const PERSISTENCE_NAMESPACE = "campaign-execution-repository";

type CampaignExecutionRepositoryState = {
  approvals: CampaignApproval[];
  plans: CampaignExecutionPlan[];
  records: CampaignTargetExecutionRecord[];
  runtimeStates: CampaignExecutionRuntimeState[];
  retryAuthorizations: CampaignTargetRetryAuthorization[];
};

export type CampaignExecutionRuntimeState = {
  executionPlanId: string;
  circuitState: "CLOSED" | "OPEN";
  consecutiveInfrastructureFailures: number;
  failureWindow: readonly boolean[];
  pauseReason: string | null;
  updatedAt: string;
};

export class CampaignExecutionRepositoryError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CampaignExecutionRepositoryError";
    this.code = code;
  }
}

const planStore = new Map<string, CampaignExecutionPlan>();
const approvalStore = new Map<string, CampaignApproval>();
const recordStore = new Map<string, CampaignTargetExecutionRecord>();
const runtimeStateStore = new Map<string, CampaignExecutionRuntimeState>();
const retryAuthorizationStore = new Map<string, CampaignTargetRetryAuthorization>();
let stateRevision = 0;
let persistenceReplacementCount = 0;

function recordKey(executionPlanId: string, targetId: string): string {
  return `${executionPlanId}|${targetId}`;
}

function emptyState(): CampaignExecutionRepositoryState {
  return { approvals: [], plans: [], records: [], runtimeStates: [], retryAuthorizations: [] };
}

function applyState(state: CampaignExecutionRepositoryState): void {
  approvalStore.clear();
  (state.approvals ?? []).forEach((approval) => approvalStore.set(approval.approvalFingerprint, deepClone(approval)));
  planStore.clear();
  state.plans.forEach((plan) => planStore.set(plan.executionPlanId, deepClone(plan)));
  recordStore.clear();
  state.records.forEach((record) => recordStore.set(recordKey(record.executionPlanId, record.targetId), deepClone({
    ...record,
    reviewedRetryCount: record.reviewedRetryCount ?? 0,
  })));
  runtimeStateStore.clear();
  (state.runtimeStates ?? []).forEach((runtimeState) => runtimeStateStore.set(runtimeState.executionPlanId, deepClone(runtimeState)));
  retryAuthorizationStore.clear();
  (state.retryAuthorizations ?? []).forEach((authorization) => retryAuthorizationStore.set(authorization.fingerprint, deepClone(authorization)));
}

function snapshotState(): CampaignExecutionRepositoryState {
  return {
    approvals: [...approvalStore.values()].map((approval) => deepClone(approval)),
    plans: [...planStore.values()].map((plan) => deepClone(plan)),
    records: [...recordStore.values()].map((record) => deepClone(record)),
    runtimeStates: [...runtimeStateStore.values()].map((runtimeState) => deepClone(runtimeState)),
    retryAuthorizations: [...retryAuthorizationStore.values()].map((authorization) => deepClone(authorization)),
  };
}

const loaded = loadPersistedState<CampaignExecutionRepositoryState>({
  namespace: PERSISTENCE_NAMESPACE,
  seedFactory: emptyState,
});
applyState(loaded.state);
stateRevision = loaded.revision;

function persistCurrentState(): void {
  const saved = savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });
  stateRevision = saved.revision;
  persistenceReplacementCount += 1;
}

function mutate<T>(mutator: () => T): T {
  const before = snapshotState();
  try {
    const result = mutator();
    persistCurrentState();
    return deepClone(result);
  } catch (error) {
    applyState(before);
    throw error;
  }
}

function requirePlan(executionPlanId: string): CampaignExecutionPlan {
  const plan = planStore.get(executionPlanId);
  if (!plan) throw new CampaignExecutionRepositoryError("EXECUTION_PLAN_NOT_FOUND", `Execution plan not found: ${executionPlanId}`);
  return plan;
}

export function getCampaignExecutionPersistenceReplacementCount(): number {
  return persistenceReplacementCount;
}

export function createCampaignExecutionRecordSet(input: {
  approval: CampaignApproval;
  plan: CampaignExecutionPlan;
  records: readonly CampaignTargetExecutionRecord[];
}): { plan: CampaignExecutionPlan; records: readonly CampaignTargetExecutionRecord[] } {
  if (planStore.has(input.plan.executionPlanId)) {
    return {
      plan: deepClone(requirePlan(input.plan.executionPlanId)),
      records: listCampaignTargetExecutionRecords(input.plan.executionPlanId),
    };
  }
  if (input.plan.approvalFingerprint !== input.approval.approvalFingerprint
    || input.plan.campaignId !== input.approval.campaignId) {
    throw new CampaignExecutionRepositoryError("APPROVAL_SCOPE_MISMATCH", "Persisted approval does not match the execution plan.");
  }
  if (input.records.length !== input.plan.targetIds.length
    || new Set(input.records.map((record) => record.targetId)).size !== input.records.length
    || input.records.some((record) => record.executionPlanId !== input.plan.executionPlanId
      || !input.plan.targetIds.includes(record.targetId))) {
    throw new CampaignExecutionRepositoryError("EXECUTION_SCOPE_MISMATCH", "Execution records must exactly match the approved plan.");
  }
  return mutate(() => {
    approvalStore.set(input.approval.approvalFingerprint, deepClone(input.approval));
    planStore.set(input.plan.executionPlanId, deepClone(input.plan));
    input.records.forEach((record) => recordStore.set(recordKey(record.executionPlanId, record.targetId), deepClone(record)));
    runtimeStateStore.set(input.plan.executionPlanId, {
      executionPlanId: input.plan.executionPlanId,
      circuitState: "CLOSED",
      consecutiveInfrastructureFailures: 0,
      failureWindow: [],
      pauseReason: null,
      updatedAt: input.plan.createdAt,
    });
    return { plan: input.plan, records: input.records };
  });
}

export function getCampaignExecutionRuntimeState(
  executionPlanId: string,
): CampaignExecutionRuntimeState | null {
  const runtimeState = runtimeStateStore.get(executionPlanId);
  return runtimeState ? deepClone(runtimeState) : null;
}

export function prepareCampaignExecutionBatch(input: {
  executionPlanId: string;
  targetIds: readonly string[];
  now: string;
}): readonly CampaignTargetExecutionRecord[] {
  requirePlan(input.executionPlanId);
  const targetIds = [...new Set(input.targetIds)];
  const records = targetIds.map((targetId) => {
    const existing = recordStore.get(recordKey(input.executionPlanId, targetId));
    if (!existing) throw new CampaignExecutionRepositoryError("EXECUTION_RECORD_NOT_FOUND", `Execution record not found: ${targetId}`);
    if (existing.status !== "PENDING") {
      throw new CampaignExecutionRepositoryError("EXECUTION_NOT_PENDING", `Only pending execution may cross the dispatch boundary: ${targetId}`);
    }
    return existing;
  });
  return mutate(() => records.map((record) => {
    const prepared: CampaignTargetExecutionRecord = {
      ...record,
      status: "DISPATCHING",
      dispatchedAt: input.now,
      version: record.version + 1,
    };
    recordStore.set(recordKey(prepared.executionPlanId, prepared.targetId), prepared);
    return prepared;
  }));
}

export function checkpointCampaignExecutionRuntimeState(input: {
  executionPlanId: string;
  circuitState: CampaignExecutionRuntimeState["circuitState"];
  consecutiveInfrastructureFailures: number;
  failureWindow: readonly boolean[];
  pauseReason: string | null;
  updatedAt: string;
}): CampaignExecutionRuntimeState {
  requirePlan(input.executionPlanId);
  return mutate(() => {
    const runtimeState: CampaignExecutionRuntimeState = { ...input };
    runtimeStateStore.set(input.executionPlanId, runtimeState);
    return runtimeState;
  });
}

export function recoverCampaignCircuit(input: {
  executionPlanId: string;
  authorizedBy: string;
  recoveredAt: string;
}): CampaignExecutionRuntimeState {
  const existing = runtimeStateStore.get(input.executionPlanId);
  if (!existing) throw new CampaignExecutionRepositoryError("EXECUTION_RUNTIME_NOT_FOUND", "Execution runtime state was not found.");
  if (existing.circuitState !== "OPEN") {
    throw new CampaignExecutionRepositoryError("CIRCUIT_NOT_OPEN", "Only an open circuit may be explicitly recovered.");
  }
  if (!input.authorizedBy.trim()) throw new CampaignExecutionRepositoryError("CIRCUIT_RECOVERY_AUTHORITY_REQUIRED", "Circuit recovery requires explicit operator authority.");
  return mutate(() => {
    const recovered: CampaignExecutionRuntimeState = {
      executionPlanId: input.executionPlanId,
      circuitState: "CLOSED",
      consecutiveInfrastructureFailures: 0,
      failureWindow: [],
      pauseReason: null,
      updatedAt: input.recoveredAt,
    };
    runtimeStateStore.set(input.executionPlanId, recovered);
    return recovered;
  });
}

export function getCampaignExecutionPlanRecord(executionPlanId: string): CampaignExecutionPlan | null {
  const plan = planStore.get(executionPlanId);
  return plan ? deepClone(plan) : null;
}

export function listCampaignTargetExecutionRecords(
  executionPlanId: string,
): readonly CampaignTargetExecutionRecord[] {
  return [...recordStore.values()]
    .filter((record) => record.executionPlanId === executionPlanId)
    .sort((left, right) => left.targetId.localeCompare(right.targetId))
    .map((record) => deepClone(record));
}

export function checkpointCampaignExecution(input: {
  executionPlanId: string;
  planStatus: CampaignExecutionPlanStatus;
  records: readonly CampaignTargetExecutionRecord[];
  runtimeState?: Omit<CampaignExecutionRuntimeState, "executionPlanId">;
}): { plan: CampaignExecutionPlan; records: readonly CampaignTargetExecutionRecord[] } {
  const existingPlan = requirePlan(input.executionPlanId);
  input.records.forEach((record) => {
    const existing = recordStore.get(recordKey(input.executionPlanId, record.targetId));
    if (!existing) throw new CampaignExecutionRepositoryError("EXECUTION_RECORD_NOT_FOUND", `Execution record not found: ${record.targetId}`);
    if (record.idempotencyKey !== existing.idempotencyKey || record.operation !== existing.operation) {
      throw new CampaignExecutionRepositoryError("EXECUTION_IDENTITY_IMMUTABLE", `Execution identity changed: ${record.targetId}`);
    }
  });
  return mutate(() => {
    const plan = { ...existingPlan, status: input.planStatus, version: existingPlan.version + 1 };
    planStore.set(plan.executionPlanId, plan);
    input.records.forEach((record) => recordStore.set(recordKey(record.executionPlanId, record.targetId), deepClone(record)));
    if (input.runtimeState) {
      runtimeStateStore.set(input.executionPlanId, {
        executionPlanId: input.executionPlanId,
        ...input.runtimeState,
      });
    }
    return { plan, records: listCampaignTargetExecutionRecords(input.executionPlanId) };
  });
}

export function pauseCampaignExecution(executionPlanId: string): CampaignExecutionPlan {
  const plan = requirePlan(executionPlanId);
  if (plan.status === "COMPLETE" || plan.status === "CANCELLED") return deepClone(plan);
  return mutate(() => {
    const updated = { ...plan, status: "PAUSED" as const, version: plan.version + 1 };
    planStore.set(executionPlanId, updated);
    return updated;
  });
}

export function resumeCampaignExecution(executionPlanId: string): CampaignExecutionPlan {
  const plan = requirePlan(executionPlanId);
  if (plan.status !== "PAUSED") throw new CampaignExecutionRepositoryError("EXECUTION_NOT_PAUSED", "Only a paused execution plan may resume.");
  return mutate(() => {
    const updated = { ...plan, status: "APPROVED" as const, version: plan.version + 1 };
    planStore.set(executionPlanId, updated);
    return updated;
  });
}

export function cancelPendingCampaignExecution(input: {
  executionPlanId: string;
  now: string;
}): { plan: CampaignExecutionPlan; records: readonly CampaignTargetExecutionRecord[] } {
  const plan = requirePlan(input.executionPlanId);
  return mutate(() => {
    listCampaignTargetExecutionRecords(input.executionPlanId).forEach((record) => {
      if (record.status === "PENDING" || record.status === "PAUSED") {
        recordStore.set(recordKey(record.executionPlanId, record.targetId), {
          ...record,
          status: "CANCELLED",
          terminalAt: input.now,
          failureReason: "Cancelled before dispatch; no rollback was attempted.",
          version: record.version + 1,
        });
      }
    });
    const updated = { ...plan, status: "CANCELLED" as const, version: plan.version + 1 };
    planStore.set(input.executionPlanId, updated);
    return { plan: updated, records: listCampaignTargetExecutionRecords(input.executionPlanId) };
  });
}

export function resetCampaignExecutionRepositoryForTests(): void {
  const reset = resetPersistedState<CampaignExecutionRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: emptyState,
  });
  applyState(reset.state);
  stateRevision = reset.revision;
  persistenceReplacementCount = 0;
}

export function reloadCampaignExecutionRepositoryForTests(): void {
  const reloaded = loadPersistedState<CampaignExecutionRepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: emptyState,
  });
  applyState(reloaded.state);
  stateRevision = reloaded.revision;
  persistenceReplacementCount = 0;
}

export function getCampaignApprovalRecord(approvalFingerprint: string): CampaignApproval | null {
  const approval = approvalStore.get(approvalFingerprint);
  return approval ? deepClone(approval) : null;
}

export function getCampaignTargetRetryAuthorization(
  fingerprint: string,
): CampaignTargetRetryAuthorization | null {
  const authorization = retryAuthorizationStore.get(fingerprint);
  return authorization ? deepClone(authorization) : null;
}

export function saveReviewedRetryAuthorization(input: {
  executionPlanId: string;
  targetId: string;
  authorization: CampaignTargetRetryAuthorization;
}): CampaignTargetExecutionRecord {
  requirePlan(input.executionPlanId);
  const existing = recordStore.get(recordKey(input.executionPlanId, input.targetId));
  if (!existing) throw new CampaignExecutionRepositoryError("EXECUTION_RECORD_NOT_FOUND", `Execution record not found: ${input.targetId}`);
  const prepared = prepareReviewedRetry({ record: existing, authorization: input.authorization });
  return mutate(() => {
    retryAuthorizationStore.set(input.authorization.fingerprint, deepClone(input.authorization));
    recordStore.set(recordKey(prepared.executionPlanId, prepared.targetId), deepClone(prepared));
    return prepared;
  });
}

export function reconcileCampaignTargetFromTerminalGlw(input: {
  executionPlanId: string;
  targetId: string;
  expectedGlwJobId: string;
  expectedGlwSlug: string;
  expectedExternalExecutionId: string;
  expectedWordpressObjectId: string;
  glwRecord: GlwPageExecutionRecord;
  reconciledAt: string;
}): { plan: CampaignExecutionPlan; record: CampaignTargetExecutionRecord } {
  const existingPlan = requirePlan(input.executionPlanId);
  const existing = recordStore.get(recordKey(input.executionPlanId, input.targetId));
  if (!existing) throw new CampaignExecutionRepositoryError("EXECUTION_RECORD_NOT_FOUND", `Execution record not found: ${input.targetId}`);
  if (existing.status === "SUCCEEDED") return { plan: deepClone(existingPlan), record: deepClone(existing) };
  if (existing.status !== "RETRY_REVIEW_REQUIRED") {
    throw new CampaignExecutionRepositoryError("RECONCILIATION_STATE_INVALID", "Only a review-required target may consume reviewed terminal evidence.");
  }
  if ((existing.glwJobId !== null && existing.glwJobId !== input.expectedGlwJobId)
    || input.glwRecord.jobId !== input.expectedGlwJobId
    || input.glwRecord.slug !== input.expectedGlwSlug
    || input.glwRecord.externalExecutionId !== input.expectedExternalExecutionId
    || input.glwRecord.wordpressObjectId !== input.expectedWordpressObjectId) {
    throw new CampaignExecutionRepositoryError("RECONCILIATION_IDENTITY_MISMATCH", "Terminal GLW evidence does not match the exact campaign target identity.");
  }
  const projected = projectGlwTerminalExecution({
    record: { ...existing, attemptCount: Math.max(0, existing.attemptCount - 1) },
    glw: input.glwRecord,
    now: input.reconciledAt,
  });
  if (projected.status !== "SUCCEEDED") {
    throw new CampaignExecutionRepositoryError("RECONCILIATION_NOT_SUCCESSFUL", "GLW evidence is not terminal draft success with complete QA.");
  }
  return mutate(() => {
    recordStore.set(recordKey(projected.executionPlanId, projected.targetId), deepClone(projected));
    const records = listCampaignTargetExecutionRecords(input.executionPlanId);
    const planStatus: CampaignExecutionPlanStatus = records.every((record) => record.status === "SUCCEEDED")
      ? "COMPLETE"
      : records.some((record) => record.status === "FAILED" || record.status === "RETRY_REVIEW_REQUIRED")
        ? "FAILED"
        : records.some((record) => ["DISPATCHING", "DISPATCHED", "RUNNING"].includes(record.status))
          ? "EXECUTING"
          : "PAUSED";
    const plan = { ...existingPlan, status: planStatus, version: existingPlan.version + 1 };
    planStore.set(plan.executionPlanId, plan);
    return { plan, record: projected };
  });
}