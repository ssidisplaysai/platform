import { describe, expect, it } from "@jest/globals";
import {
  GLW_AGGREGATE_TELEMETRY_MONTHS,
  GLW_DURABLE_EVIDENCE_RETENTION_YEARS,
  GLW_HIGH_RESOLUTION_TELEMETRY_DAYS,
  GLW_RECONCILIATION_BATCH_SIZE,
  GLW_RECONCILIATION_INTERVAL_SECONDS,
  GLW_RECONCILIATION_MAX_SNAPSHOT_SKEW_MS,
  classifyGlwSnapshotSkew,
  evaluateGlwCanary,
  evaluateGlwClosure,
  evaluateGlwRetentionEligibility,
  evaluateGlwRollbackStage,
  evaluateGlwRolloutReadiness,
  detectGlwReconciliationDiscrepancies,
  isGlwAutoRepairAllowed,
  type GlwCanaryEvidence,
} from "@/lib/glw/callback-delivery-reconciliation";

const readiness = { artifactChainCertified: true, migrationsCertified: true, workflowsSanitized: true, secretAuthoritySynchronized: true, productionBaselineHealthy: true, rollbackAuthorityAvailable: true, workflowsInactive: true, noIncompatiblePendingState: true, migrationDryRunPass: true, callbackAuthPass: true, publicLocalTransportHealthy: true, cloudflareHealthy: true, latestReconciliation: { status: "CLEAN" as const, snapshotSkewMs: 0, criticalCount: 0, discrepancyCount: 0 } };
const canary: GlwCanaryEvidence = { producerOperationCount: 1, producerPublicationCount: 1, producerCompletionCount: 1, producerOutboxCount: 1, producerDeliveryCount: 1, originalAttemptCount: 1, recoveryCycleCount: 0, recoveryAttemptCount: 0, receiverReceiptCount: 1, receiverOutcome: "APPLIED", glwTerminalEffectCount: 1, gopTerminalExecutionCount: 1, terminalEventCount: 1, terminalSnapshotCount: 1, deliveryStatus: "ACKNOWLEDGED", activeLeaseCount: 0, deadLetterCount: 0, activeEscalationCount: 0, reconciliationStatus: "CLEAN", reconciliationDiscrepancyCount: 0 };
const retention = { createdAt: new Date("2018-01-01"), now: new Date("2026-01-02"), terminal: true, escalationResolved: true, pendingRecovery: false, activeLease: false, acknowledgedEvidence: true, openDiscrepancy: false, activeRolloutIncident: false, legalHold: false, archiveChecksumVerified: false };

describe("HR-004 Slice F reconciliation contract", () => {
  it("freezes timing and retention constants", () => expect([GLW_RECONCILIATION_INTERVAL_SECONDS, GLW_RECONCILIATION_BATCH_SIZE, GLW_RECONCILIATION_MAX_SNAPSHOT_SKEW_MS, GLW_DURABLE_EVIDENCE_RETENTION_YEARS, GLW_HIGH_RESOLUTION_TELEMETRY_DAYS, GLW_AGGREGATE_TELEMETRY_MONTHS]).toEqual([60, 500, 5000, 7, 90, 13]));
  it("accepts snapshot skew at five seconds", () => expect(classifyGlwSnapshotSkew(new Date(0), new Date(5000))).toEqual({ snapshotSkewMs: 5000, determinate: true }));
  it("marks excess snapshot skew indeterminate", () => expect(classifyGlwSnapshotSkew(new Date(0), new Date(5001)).determinate).toBe(false));
  it("allows certified missing escalation repair", () => expect(isGlwAutoRepairAllowed("DEAD_LETTER_WITHOUT_ESCALATION")).toBe(true));
  it("allows certified acknowledged escalation refresh", () => expect(isGlwAutoRepairAllowed("ACK_WITH_UNRESOLVED_ESCALATION")).toBe(true));
  it("denies unknown auto repair", () => expect(isGlwAutoRepairAllowed("DELIVERY_ATTEMPT_COUNT_MISMATCH")).toBe(false));
  it("marks complete readiness ready", () => expect(evaluateGlwRolloutReadiness(readiness)).toEqual({ ready: true, blockers: [] }));
  it("blocks indeterminate readiness", () => expect(evaluateGlwRolloutReadiness({ ...readiness, latestReconciliation: { ...readiness.latestReconciliation, status: "INDETERMINATE", snapshotSkewMs: 5001 } }).ready).toBe(false));
  it("blocks a missing readiness predicate", () => expect(evaluateGlwRolloutReadiness({ ...readiness, rollbackAuthorityAvailable: false }).blockers).toContain("rollbackAuthorityAvailable"));
  it("retains evidence before seven years", () => expect(evaluateGlwRetentionEligibility({ ...retention, createdAt: new Date("2020-01-01") })).toBe("RETAIN"));
  it("blocks active evidence cleanup", () => expect(evaluateGlwRetentionEligibility({ ...retention, activeLease: true })).toBe("BLOCKED_FROM_CLEANUP"));
  it("reports archive eligibility non-destructively", () => expect(evaluateGlwRetentionEligibility(retention)).toBe("ARCHIVE_ELIGIBLE"));
  it("labels externally authorized deletion without deleting", () => expect(evaluateGlwRetentionEligibility({ ...retention, archiveChecksumVerified: true, externalDeletePolicyAuthorized: true })).toBe("DELETE_ELIGIBLE_IF_EXTERNAL_POLICY_AUTHORIZES"));
  it("keeps predeployment closure ineligible", () => expect(evaluateGlwClosure({ implementationComplete: true, artifactCertified: false, rolloutReady: false, rolloutComplete: false, canaryPass: false, stabilityPass: false, reconciliationClean: true, noActiveIncident: true, noSecretContamination: true, rollbackAuthorityRetained: true, operatorVisibilityAvailable: true }).closed).toBe(false));
  it("closes only with every production predicate", () => expect(evaluateGlwClosure({ implementationComplete: true, artifactCertified: true, rolloutReady: true, rolloutComplete: true, canaryPass: true, stabilityPass: true, reconciliationClean: true, noActiveIncident: true, noSecretContamination: true, rollbackAuthorityRetained: true, operatorVisibilityAvailable: true }).closed).toBe(true));
  it("detects orphan logical correlation from independently scanned authorities", () => {
    const snapshotAt = new Date();
    const findings = detectGlwReconciliationDiscrepancies({
      snapshotAt,
      completions: [],
      deliveries: [],
      recoveries: [],
      heartbeatAt: null,
      escalations: [{ escalationId: "orphan-escalation", idempotencyKey: "missing-delivery", deliveryPresent: false }],
      operatorActions: [],
      recoveryAttempts: [],
    } as never, { snapshotAt, receipts: [], jobs: [], executions: [] });
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ discrepancyType: "ORPHAN_LOGICAL_CORRELATION", severity: "CRITICAL" }),
    ]));
  });
  it("passes exact one-effect canary", () => expect(evaluateGlwCanary(canary)).toEqual({ passed: true, failures: [] }));
  it("fails duplicate canary effect", () => expect(evaluateGlwCanary({ ...canary, terminalEventCount: 2 }).failures).toContain("terminalEventCount"));
  it("forbids dual-send in every rollback decision", () => expect(evaluateGlwRollbackStage("C_D_ACTIVE", true).dualSendAllowed).toBe(false));
});
