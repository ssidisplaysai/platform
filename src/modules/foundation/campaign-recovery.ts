import type { GlwPageExecutionRecord } from "../glw/page-execution";
import {
  projectGlwTerminalExecution,
  type CampaignExecutionPlan,
  type CampaignTargetExecutionRecord,
} from "./campaign-execution";
import type { CampaignExecutionRuntimeState } from "./campaign-execution-repository";

export type CampaignHealth = "HEALTHY" | "DEGRADED" | "PAUSED" | "REVIEW_REQUIRED" | "FAILED";

export type CampaignRecoverySnapshot = {
  plan: CampaignExecutionPlan;
  runtimeState: CampaignExecutionRuntimeState;
  records: readonly CampaignTargetExecutionRecord[];
  health: CampaignHealth;
};

export type CampaignResumeDisposition =
  | "DISPATCHABLE"
  | "PREFLIGHT_REFRESH_REQUIRED"
  | "EXTERNAL_RECONCILIATION_REQUIRED"
  | "SKIP_SUCCEEDED"
  | "SKIP_REVIEW_REQUIRED"
  | "SKIP_CANCELLED"
  | "PAUSED_REQUIRES_RESUME";

export function classifyCampaignResumeDisposition(input: {
  record: CampaignTargetExecutionRecord;
  preflightStale: boolean;
}): CampaignResumeDisposition {
  if (input.record.status === "SUCCEEDED") return "SKIP_SUCCEEDED";
  if (input.record.status === "RETRY_REVIEW_REQUIRED" || input.record.status === "FAILED") return "SKIP_REVIEW_REQUIRED";
  if (input.record.status === "CANCELLED") return "SKIP_CANCELLED";
  if (input.record.status === "PAUSED") return "PAUSED_REQUIRES_RESUME";
  if (["DISPATCHING", "DISPATCHED", "RUNNING"].includes(input.record.status)) return "EXTERNAL_RECONCILIATION_REQUIRED";
  return input.preflightStale ? "PREFLIGHT_REFRESH_REQUIRED" : "DISPATCHABLE";
}

function reviewRequired(record: CampaignTargetExecutionRecord, failureReason: string, now: string): CampaignTargetExecutionRecord {
  return {
    ...record,
    status: "RETRY_REVIEW_REQUIRED",
    failureClass: "DISPATCH_AMBIGUOUS",
    failureReason,
    requiresReview: true,
    terminalAt: record.terminalAt ?? now,
    version: record.version + 1,
  };
}

export function reconcilePersistedExecutionRecord(input: {
  record: CampaignTargetExecutionRecord;
  glwRecord?: GlwPageExecutionRecord | null;
  now: string;
}): CampaignTargetExecutionRecord {
  const { record } = input;
  if (["SUCCEEDED", "FAILED", "RETRY_REVIEW_REQUIRED", "CANCELLED", "PAUSED", "PENDING"].includes(record.status)) {
    return record;
  }
  if (record.status === "DISPATCHING" && !record.glwJobId) {
    return reviewRequired(record, "Process stopped after dispatch intent was persisted but before GLW acknowledgement was durable.", input.now);
  }
  if (!record.glwJobId || !input.glwRecord) {
    return reviewRequired(record, "Prior dispatch cannot be reconciled to an exact durable GLW job.", input.now);
  }
  if (input.glwRecord.jobId !== record.glwJobId) {
    return reviewRequired(record, "Recovered GLW job identity does not match the campaign correlation record.", input.now);
  }
  return projectGlwTerminalExecution({ record: { ...record, attemptCount: Math.max(0, record.attemptCount - 1) }, glw: input.glwRecord, now: input.now });
}

export function deriveCampaignHealth(input: {
  plan: CampaignExecutionPlan;
  runtimeState: CampaignExecutionRuntimeState;
  records: readonly CampaignTargetExecutionRecord[];
}): CampaignHealth {
  if (input.plan.status === "PAUSED" || input.runtimeState.circuitState === "OPEN") return "PAUSED";
  if (input.records.some((record) => record.status === "RETRY_REVIEW_REQUIRED" || record.failureClass === "QA_FAILURE")) return "REVIEW_REQUIRED";
  if (input.plan.status === "FAILED" && input.records.every((record) => !["PENDING", "RUNNING", "DISPATCHED"].includes(record.status))) return "FAILED";
  if (input.records.some((record) => record.status === "FAILED")) return "DEGRADED";
  return "HEALTHY";
}

export function reconstructCampaignExecution(input: {
  plan: CampaignExecutionPlan;
  runtimeState: CampaignExecutionRuntimeState;
  records: readonly CampaignTargetExecutionRecord[];
  glwRecordsByJobId?: ReadonlyMap<string, GlwPageExecutionRecord>;
  now: string;
}): CampaignRecoverySnapshot {
  const records = input.records.map((record) => reconcilePersistedExecutionRecord({
    record,
    glwRecord: record.glwJobId ? input.glwRecordsByJobId?.get(record.glwJobId) : null,
    now: input.now,
  }));
  return {
    plan: input.plan,
    runtimeState: input.runtimeState,
    records,
    health: deriveCampaignHealth({ plan: input.plan, runtimeState: input.runtimeState, records }),
  };
}

export const CAMPAIGN_SCALE_RAMP_POLICY = {
  levels: [
    { level: "RAMP_0", maximumTargets: 1, concurrency: 1 },
    { level: "RAMP_1", maximumTargets: 3, concurrency: 1 },
    { level: "RAMP_2", maximumTargets: 10, concurrency: 2 },
    { level: "RAMP_3", maximumTargets: 25, concurrency: 2 },
    { level: "RAMP_4", maximumTargets: 100, concurrency: 2 },
  ],
  automaticAdvanceAllowed: false,
  requireCompleteAccounting: true,
  requireZeroDuplicateDispatch: true,
  requireZeroUnexplainedMutation: true,
  requireZeroAmbiguousExecution: true,
  requireAllSuccessfulDraftsQaPass: true,
  requireClosedCircuit: true,
} as const;