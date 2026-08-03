export type ScheduleId = string;

export type ScheduleType = "ONE_TIME" | "INTERVAL" | "RECURRING" | "CRON" | "CALENDAR";

export type ScheduleState = "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED" | "FAILED";

export type MissedRunPolicyType = "SKIP" | "RUN_ONCE" | "CATCH_UP_ALL" | "CATCH_UP_LIMITED" | "FAIL";

export type ScheduleSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export type ScheduleVersion = {
  major: number;
  minor: number;
  patch: number;
};

export type TimeZoneReference = {
  ianaName: string;
  fallbackUtcOffsetMinutes?: number;
};

export type OneTimeSchedule = {
  runAt: string;
};

export type IntervalSchedule = {
  intervalMs: number;
  anchorAt?: string;
};

export type RecurringSchedule = {
  frequency: "DAILY" | "WEEKLY" | "MONTHLY";
  interval: number;
  timeOfDay: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
};

export type CronSchedule = {
  expression: string;
};

export type CalendarSchedule = {
  months?: number[];
  daysOfMonth?: number[];
  daysOfWeek?: number[];
  timeOfDay: string;
};

export type ScheduleTrigger = {
  triggerType: "SCHEDULED" | "MISSED_RUN_CATCH_UP" | "MANUAL" | "RECOVERY";
  evaluatedAt: string;
  reason?: string;
};

export type ScheduleCommand = {
  commandType: "WORKFLOW_TIMER" | "WORKFLOW_RESUME" | "DEFERRED_COMMAND";
  topic: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  workflowInstanceId?: string;
};

export type MissedRunPolicy = {
  type: MissedRunPolicyType;
  catchUpLimit?: number;
};

export type ScheduleDefinition = {
  scheduleId: ScheduleId;
  name: string;
  description?: string;
  scheduleType: ScheduleType;
  version: ScheduleVersion;
  state: ScheduleState;
  timezone: TimeZoneReference;
  startAt?: string;
  endAt?: string;
  maxOccurrences?: number;
  oneTime?: OneTimeSchedule;
  interval?: IntervalSchedule;
  recurring?: RecurringSchedule;
  cron?: CronSchedule;
  calendar?: CalendarSchedule;
  command: ScheduleCommand;
  missedRunPolicy: MissedRunPolicy;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleInstance = {
  instanceId: string;
  scheduleId: ScheduleId;
  scheduleVersion: ScheduleVersion;
  state: ScheduleState;
  nextRunAt: string | null;
  lastRunAt: string | null;
  occurrenceCount: number;
  pausedAt?: string;
  cancelledAt?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleOccurrence = {
  occurrenceId: string;
  instanceId: string;
  scheduleId: ScheduleId;
  dueAt: string;
  trigger: ScheduleTrigger;
  status: "PENDING" | "CLAIMED" | "DISPATCHED" | "SKIPPED" | "FAILED";
  claimId?: string;
  dispatchedAt?: string;
  completedAt?: string;
  errorCode?: string;
};

export type NextRun = {
  nextRunAt: string | null;
  reason: "READY" | "COMPLETED" | "OUT_OF_WINDOW" | "INVALID_DEFINITION";
};

export type ScheduleResult = {
  instance: ScheduleInstance;
  occurrence?: ScheduleOccurrence;
  dispatched: boolean;
  reason?: string;
};

export type ScheduleError = {
  code:
    | "SCHEDULE_INVALID_DEFINITION"
    | "SCHEDULE_INVALID_RECURRENCE"
    | "SCHEDULE_INVALID_TIME_ZONE"
    | "SCHEDULE_INVALID_LIFECYCLE_TRANSITION"
    | "SCHEDULE_DUPLICATE"
    | "SCHEDULE_OCCURRENCE_ALREADY_CLAIMED"
    | "SCHEDULE_CLAIM_CONFLICT"
    | "SCHEDULE_DISPATCH_FAILURE"
    | "SCHEDULE_PERSISTENCE_FAILURE"
    | "SCHEDULE_RECOVERY_FAILURE"
    | "SCHEDULE_CLOCK_FAILURE"
    | "SCHEDULE_UNSUPPORTED_TYPE"
    | "SCHEDULE_CATCH_UP_LIMIT_EXCEEDED"
    | "SCHEDULE_CORRUPT_STATE";
  message: string;
  retryable: boolean;
  auditRequired: boolean;
  severity: ScheduleSeverity;
};

export type ScheduleAuditRecord = {
  recordId: string;
  scheduleId: ScheduleId;
  instanceId?: string;
  occurrenceId?: string;
  eventType:
    | "SCHEDULE_CREATED"
    | "SCHEDULE_ACTIVATED"
    | "SCHEDULE_UPDATED"
    | "SCHEDULE_PAUSED"
    | "SCHEDULE_RESUMED"
    | "SCHEDULE_CANCELLED"
    | "OCCURRENCE_CALCULATED"
    | "OCCURRENCE_CLAIMED"
    | "OCCURRENCE_DISPATCHED"
    | "OCCURRENCE_SKIPPED"
    | "MISSED_RUN_DETECTED"
    | "CATCH_UP_EXECUTED"
    | "SCHEDULE_FAILED"
    | "RECOVERY_PERFORMED"
    | "CORRUPT_STATE_DETECTED";
  message: string;
  details?: Record<string, unknown>;
  actorId: string;
  recordedAt: string;
};

export type ScheduleMetrics = {
  registeredSchedules: number;
  activeSchedules: number;
  pausedSchedules: number;
  completedSchedules: number;
  failedSchedules: number;
  dueOccurrences: number;
  claimedOccurrences: number;
  dispatchedOccurrences: number;
  skippedOccurrences: number;
  missedOccurrences: number;
  catchUpOccurrences: number;
  duplicateClaimRejections: number;
  claimConflicts: number;
  dispatchFailures: number;
  recoveryCount: number;
  oldestOverdueOccurrenceAgeMs: number | null;
  averageSchedulingDelayMs: number;
  averageDispatchLatencyMs: number;
};

export type ScheduleHealth = {
  status: "HEALTHY" | "DEGRADED";
  checks: Array<{
    name: "registry" | "persistence" | "clock" | "calculator" | "claiming" | "dispatch" | "recovery" | "configuration";
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
  generatedAt: string;
};
