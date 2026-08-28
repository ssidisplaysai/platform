import type {
  CampaignExecutionPlan,
  CampaignExecutionPlanStatus,
  CampaignTargetExecutionRecord,
} from "./campaign-execution";
import type { CampaignApproval } from "./campaign-approval";
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
let stateRevision = 0;
let persistenceReplacementCount = 0;

function recordKey(executionPlanId: string, targetId: string): string {
  return `${executionPlanId}|${targetId}`;
}

function emptyState(): CampaignExecutionRepositoryState {
  return { approvals: [], plans: [], records: [] };
}

function applyState(state: CampaignExecutionRepositoryState): void {
  approvalStore.clear();
  (state.approvals ?? []).forEach((approval) => approvalStore.set(approval.approvalFingerprint, deepClone(approval)));
  planStore.clear();
  state.plans.forEach((plan) => planStore.set(plan.executionPlanId, deepClone(plan)));
  recordStore.clear();
  state.records.forEach((record) => recordStore.set(recordKey(record.executionPlanId, record.targetId), deepClone(record)));
}

function snapshotState(): CampaignExecutionRepositoryState {
  return {
    approvals: [...approvalStore.values()].map((approval) => deepClone(approval)),
    plans: [...planStore.values()].map((plan) => deepClone(plan)),
    records: [...recordStore.values()].map((record) => deepClone(record)),
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
    return { plan: input.plan, records: input.records };
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

export function getCampaignApprovalRecord(approvalFingerprint: string): CampaignApproval | null {
  const approval = approvalStore.get(approvalFingerprint);
  return approval ? deepClone(approval) : null;
}