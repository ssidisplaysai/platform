import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getGlwSession } from "./auth";
import { createGlwDeliveryReconciliationService, evaluateGlwClosure, evaluateGlwRolloutReadiness } from "./callback-delivery-reconciliation";
import { buildGenesisSubjectFromSession, getGenesisAuthorizationResolver } from "@/platform/gop/auth/runtime";
import { createActionReference } from "@/platform/gop/auth/resolver";
import { GENESIS_PRIMARY_WORKSPACE_ID } from "@/platform/gop/workspaces/identity";

const MODULE_ID = "glw.delivery";
const ROUTE = "/api/glw/callback-delivery-reconciliation";

export type GlwReconciliationApiDependencies = {
  sessionLoader?: typeof getGlwSession;
  service?: ReturnType<typeof createGlwDeliveryReconciliationService>;
  systemToken?: string;
  source?: { commit: string; tree: string; build?: string };
};

function json(body: unknown, status = 200) { return NextResponse.json(body, { status }); }

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authorize(request: Request, actionId: string, dependencies?: GlwReconciliationApiDependencies) {
  const expectedToken = dependencies?.systemToken ?? process.env.GLW_RECONCILIATION_SYSTEM_TOKEN ?? "";
  const receivedToken = request.headers.get("x-glw-reconciliation-token") ?? "";
  if (expectedToken && receivedToken && constantTimeEqual(expectedToken, receivedToken)) return { actorId: "system:reconciliation", role: "SYSTEM" } as const;
  const session = await (dependencies?.sessionLoader ?? getGlwSession)();
  if (!session) return { error: json({ error: "GLW session is required." }, 401) } as const;
  const subject = buildGenesisSubjectFromSession(session);
  const decision = getGenesisAuthorizationResolver().authorize({
    subject,
    workspaceId: GENESIS_PRIMARY_WORKSPACE_ID,
    moduleId: MODULE_ID,
    action: createActionReference(actionId, "route_access"),
    resource: { workspaceId: GENESIS_PRIMARY_WORKSPACE_ID, moduleId: MODULE_ID, route: ROUTE },
  });
  if (!decision.allowed) return { error: json({ error: decision.reason }, 403) } as const;
  return { actorId: subject.actorId, role: subject.role } as const;
}

function safeRun(run: Record<string, unknown> | null) {
  if (!run) return null;
  return {
    reconciliationRunId: run.reconciliationRunId,
    runType: run.runType,
    producerSnapshotAt: run.producerSnapshotAt,
    genesisSnapshotAt: run.genesisSnapshotAt,
    snapshotSkewMs: run.snapshotSkewMs,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    status: run.status,
    producerScannedCount: run.producerScannedCount,
    genesisScannedCount: run.genesisScannedCount,
    discrepancyCount: run.discrepancyCount,
    criticalCount: run.criticalCount,
    autoRepairCount: run.autoRepairCount,
    safeMetrics: run.safeMetrics,
    truncated: run.truncated,
    failureClass: run.failureClass,
  };
}

export async function handleGetGlwReconciliation(request: Request, dependencies?: GlwReconciliationApiDependencies) {
  const access = await authorize(request, "glw:delivery:reconciliation:view", dependencies);
  if ("error" in access) return access.error;
  try {
    const latest = await (dependencies?.service ?? createGlwDeliveryReconciliationService()).latest();
    const run = safeRun(latest.run as Record<string, unknown> | null);
    const rollout = evaluateGlwRolloutReadiness({
      artifactChainCertified: false, migrationsCertified: false, workflowsSanitized: false,
      secretAuthoritySynchronized: false, productionBaselineHealthy: false, rollbackAuthorityAvailable: false,
      workflowsInactive: false, noIncompatiblePendingState: false, migrationDryRunPass: false,
      callbackAuthPass: false, publicLocalTransportHealthy: false, cloudflareHealthy: false,
      latestReconciliation: run ? { status: run.status as "CLEAN" | "DISCREPANCIES" | "INDETERMINATE" | "FAILED", snapshotSkewMs: Number(run.snapshotSkewMs), criticalCount: Number(run.criticalCount), discrepancyCount: Number(run.discrepancyCount) } : null,
    });
    const closure = evaluateGlwClosure({ implementationComplete: true, artifactCertified: false, rolloutReady: false, rolloutComplete: false, canaryPass: false, stabilityPass: false, reconciliationClean: run?.status === "CLEAN", noActiveIncident: false, noSecretContamination: false, rollbackAuthorityRetained: false, operatorVisibilityAvailable: true });
    return json({ latest: run, discrepancies: latest.discrepancies, rollout, closure });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_DATABASE_URL]") : "Reconciliation status unavailable." }, 503);
  }
}

export async function handlePostGlwReconciliation(request: Request, dependencies?: GlwReconciliationApiDependencies) {
  const access = await authorize(request, "glw:delivery:reconciliation:run", dependencies);
  if ("error" in access) return access.error;
  const body = await request.json().catch(() => ({})) as { runType?: "SCHEDULED" | "OPERATOR" | "ROLLOUT_READINESS" | "CANARY" | "CLOSURE"; allowAutoRepair?: boolean };
  const source = dependencies?.source ?? {
    commit: process.env.GIT_COMMIT ?? process.env.COMMIT_SHA ?? "unknown",
    tree: process.env.GIT_TREE ?? "unknown",
    build: process.env.BUILD_ID,
  };
  try {
    const result = await (dependencies?.service ?? createGlwDeliveryReconciliationService()).run({
      runType: body.runType ?? (access.role === "SYSTEM" ? "SCHEDULED" : "OPERATOR"),
      triggeredBy: access.actorId,
      sourceCommit: source.commit,
      sourceTree: source.tree,
      sourceBuild: source.build,
      allowAutoRepair: Boolean(body.allowAutoRepair),
    });
    if (result.outcome === "ALREADY_RUNNING") return json(result, 409);
    return json({ outcome: result.outcome, reconciliationRunId: result.reconciliationRunId, status: result.status, snapshotSkewMs: result.snapshotSkewMs, discrepancyCount: result.discrepancies.length, criticalCount: result.discrepancies.filter((row) => row.severity === "CRITICAL").length, autoRepairCount: result.autoRepairCount });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "[REDACTED_DATABASE_URL]") : "Reconciliation failed." }, 400);
  }
}
