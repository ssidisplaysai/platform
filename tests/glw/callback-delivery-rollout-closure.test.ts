import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { evaluateGlwCanary, evaluateGlwClosure, evaluateGlwRollbackStage, evaluateGlwRolloutReadiness } from "@/lib/glw/callback-delivery-reconciliation";

const stages = ["MIGRATIONS_ONLY","B_DEPLOYED_C_INACTIVE","C_IMPORTED_INACTIVE","D_IMPORTED_INACTIVE","F_ACTIVE_BEFORE_C_D","C_ACTIVE_D_TRANSIENT","C_D_ACTIVE","CANARY_PENDING","CANARY_FAILED","STABILITY_PENDING","CLOSURE_ELIGIBLE"];
const readiness = { artifactChainCertified: true, migrationsCertified: true, workflowsSanitized: true, secretAuthoritySynchronized: true, productionBaselineHealthy: true, rollbackAuthorityAvailable: true, workflowsInactive: true, noIncompatiblePendingState: true, migrationDryRunPass: true, callbackAuthPass: true, publicLocalTransportHealthy: true, cloudflareHealthy: true, latestReconciliation: { status: "CLEAN" as const, snapshotSkewMs: 0, criticalCount: 0, discrepancyCount: 0 } };

describe("HR-004 Slice F rollout and closure contract", () => {
  it("defines every frozen rollback stage", () => expect(stages.every((stage) => evaluateGlwRollbackStage(stage, true).decision !== "STOP_UNKNOWN_STAGE")).toBe(true));
  it("keeps dual send prohibited for all stages", () => expect(stages.every((stage) => !evaluateGlwRollbackStage(stage, true).dualSendAllowed)).toBe(true));
  it("blocks C transient rollback when producer rows exist", () => expect(evaluateGlwRollbackStage("C_ACTIVE_D_TRANSIENT", true).decision).toContain("FORWARD_ACTIVATE_D"));
  it("allows readiness only from complete checklist", () => expect(evaluateGlwRolloutReadiness(readiness).ready).toBe(true));
  it("blocks readiness on dirty reconciliation", () => expect(evaluateGlwRolloutReadiness({ ...readiness, latestReconciliation: { status: "DISCREPANCIES", snapshotSkewMs: 0, criticalCount: 1, discrepancyCount: 1 } }).ready).toBe(false));
  it("keeps closure ineligible before rollout", () => expect(evaluateGlwClosure({ implementationComplete: true, artifactCertified: true, rolloutReady: false, rolloutComplete: false, canaryPass: false, stabilityPass: false, reconciliationClean: true, noActiveIncident: true, noSecretContamination: true, rollbackAuthorityRetained: true, operatorVisibilityAvailable: true }).current).toBe("ARTIFACT_CERTIFIED"));
  it.each([
    ["stability without canary", { canaryPass: false }],
    ["stability without rollout completion", { rolloutComplete: false }],
    ["stability without rollout readiness", { rolloutReady: false }],
    ["stability without artifact certification", { artifactCertified: false }],
    ["stability without implementation", { implementationComplete: false }],
    ["canary without rollout completion", { rolloutComplete: false }],
    ["rollout completion without readiness", { rolloutReady: false }],
    ["rollout readiness without artifact certification", { artifactCertified: false }],
    ["artifact certification without implementation", { implementationComplete: false }],
  ])("rejects skipped closure stage: %s", (_name, overrides) => {
    const result = evaluateGlwClosure({
      implementationComplete: true,
      artifactCertified: true,
      rolloutReady: true,
      rolloutComplete: true,
      canaryPass: true,
      stabilityPass: true,
      reconciliationClean: true,
      noActiveIncident: true,
      noSecretContamination: true,
      rollbackAuthorityRetained: true,
      operatorVisibilityAvailable: true,
      ...overrides,
    });
    expect(result.closed).toBe(false);
  });
  it("fails canary duplicate effect", () => expect(evaluateGlwCanary({ producerOperationCount:1,producerPublicationCount:1,producerCompletionCount:1,producerOutboxCount:1,producerDeliveryCount:1,originalAttemptCount:2,recoveryCycleCount:0,recoveryAttemptCount:0,receiverReceiptCount:1,receiverOutcome:"APPLIED",glwTerminalEffectCount:1,gopTerminalExecutionCount:1,terminalEventCount:1,terminalSnapshotCount:1,deliveryStatus:"ACKNOWLEDGED",activeLeaseCount:0,deadLetterCount:0,activeEscalationCount:0,reconciliationStatus:"CLEAN",reconciliationDiscrepancyCount:0 }).passed).toBe(false));
  it("commits an inactive 60-second workflow", async () => { const w=JSON.parse(await readFile(join(process.cwd(),"backups/n8n/glw-callback-delivery-reconciliation-worker.json"),"utf8")); expect(w.active).toBe(false); expect(w.nodes[0].parameters.rule.interval[0]).toEqual({field:"seconds",secondsInterval:60}); });
  it("workflow has no callback transport or business mutation", async () => { const text=await readFile(join(process.cwd(),"backups/n8n/glw-callback-delivery-reconciliation-worker.json"),"utf8"); expect(text).not.toMatch(/GLW_CALLBACK|requestBodyUtf8|claimGlwProducer|completeGlwProducer|wordpress/i); });
  it("workflow uses a credential reference without literal", async () => { const text=await readFile(join(process.cwd(),"backups/n8n/glw-callback-delivery-reconciliation-worker.json"),"utf8"); expect(text).toContain("Genesis GLW Reconciliation Auth"); expect(text).not.toMatch(/Bearer\s+[^\s"']{12,}/i); });
  it("contains exactly three reconciliation-only nodes", async () => expect(JSON.parse(await readFile(join(process.cwd(),"backups/n8n/glw-callback-delivery-reconciliation-worker.json"),"utf8")).nodes).toHaveLength(3));
  it("API route contains no callback sender", async () => expect(await readFile(join(process.cwd(),"src/app/api/glw/callback-delivery-reconciliation/route.ts"),"utf8")).not.toMatch(/sendGlwDeliveryRequest|callback.*POST/i));
  it("migration contains no destructive cleanup", async () => expect(await readFile(join(process.cwd(),"n8n/hr004/glw-producer-delivery-reconciliation.sql"),"utf8")).not.toMatch(/^\s*(DROP\s+TABLE|TRUNCATE|DELETE\s+FROM)/im));
  it("full application build is not part of bounded workflow", async () => expect(await readFile(join(process.cwd(),"backups/n8n/glw-callback-delivery-reconciliation-worker.json"),"utf8")).not.toContain("npm run build"));
});
