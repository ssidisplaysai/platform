import type {
  ScheduleAuditRecord,
  ScheduleDefinition,
  ScheduleInstance,
  ScheduleMetrics,
  ScheduleOccurrence,
} from "../contracts";

export type ScheduleClaimRecord = {
  claimId: string;
  occurrenceId: string;
  idempotencyKey: string;
  status: "CLAIMED" | "COMPLETED" | "FAILED" | "EXPIRED";
  claimedAt: string;
  expiresAt: string;
  owner: string;
  failureReason?: string;
};

export type SchedulingRecoverySnapshot = {
  definitions: ScheduleDefinition[];
  instances: ScheduleInstance[];
  occurrences: ScheduleOccurrence[];
  claims: ScheduleClaimRecord[];
  audits: ScheduleAuditRecord[];
  metrics: ScheduleMetrics | null;
};
