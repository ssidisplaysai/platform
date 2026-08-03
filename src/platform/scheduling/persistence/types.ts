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
  logicalRunKey?: string;
  status: "CLAIMED" | "COMPLETED" | "FAILED" | "EXPIRED";
  claimedAt: string;
  expiresAt: string;
  owner: string;
  failureReason?: string;
};

export type SchedulingRecoveryClassification =
  | "CLEAN"
  | "MISSING_FILE"
  | "CORRUPT_FILE"
  | "PARTIAL_STATE"
  | "INVALID_STATE";

export type SchedulingRecoveryDiagnostics = {
  classification: SchedulingRecoveryClassification;
  missingFile: boolean;
  corruptFile: boolean;
  invalidDefinitions: number;
  invalidInstances: number;
  invalidOccurrences: number;
  invalidClaims: number;
  invalidAudits: number;
  invalidMetrics: number;
  totalInvalidRecords: number;
};

export type SchedulingRecoverySnapshot = {
  definitions: ScheduleDefinition[];
  instances: ScheduleInstance[];
  occurrences: ScheduleOccurrence[];
  claims: ScheduleClaimRecord[];
  audits: ScheduleAuditRecord[];
  metrics: ScheduleMetrics | null;
};

export type SchedulingRecoverySnapshotResult = {
  snapshot: SchedulingRecoverySnapshot;
  diagnostics: SchedulingRecoveryDiagnostics;
};

export type AtomicClaimInput = {
  occurrenceId: string;
  idempotencyKey: string;
  owner: string;
  logicalRunKey?: string;
  claimId: string;
  claimedAt: string;
  expiresAt: string;
};

export type AtomicClaimResult = {
  claimed: boolean;
  claim?: ScheduleClaimRecord;
  reason?: "ALREADY_CLAIMED" | "CONFLICT";
};
