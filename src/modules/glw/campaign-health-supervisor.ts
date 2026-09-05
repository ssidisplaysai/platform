export const GLW_STABILITY_CAMPAIGNS = {
  ldw: "campaign-led-display-warehouse-site-led-display-warehouse-production-indoor-led-sphere-50-states",
  ssi: "campaign-ssi-site-ssi-screen-solutions-international-ssi-accent-rear-projection-film-texas-cities",
  pe: "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-california-starter-cities",
} as const;

type CampaignLike = { campaignId: string; siteId: string; productId: string; status: string; publicationPolicy: string; completedTargetCount?: number; failedTargetCount?: number };
type TargetLike = { targetId: string; campaignId: string; status: string; jobId: string | null; wordpressObjectId: string | null; leaseExpiresAt?: string | null; citySlug?: string | null };
type ExecutionLike = { jobId: string; siteId: string; productId: string; status: string; qaStatus: string; wordpressObjectId: string | null; wordpressStatus: string | null };
type ProductLike = { productId: string; lifecycleState: string; catalogStatus: string; enabled: boolean; primarySiteId?: string | null; assignedSiteIds?: readonly string[] };

export type CampaignHealthFinding = { severity: "INFO" | "WARNING" | "ERROR"; code: string; campaignId: string | null; targetId: string | null; action: string };
export type CampaignHealthReport = { generatedAt: string; healthy: boolean; campaigns: { campaignId: string; present: boolean; readable: boolean; counts: Record<string, number>; stuckRunning: number; unreconciledComplete: number; unauthorizedPublished: number; referenceCount: number }[]; products: { productId: string; healthy: boolean }[]; findings: CampaignHealthFinding[]; safeRecoveryActions: { campaignId: string; action: "RECONCILE"; reason: string }[] };

const expectedProducts = [
  { productId: "prod-indoor-digital-sphere", siteId: "site-led-display-warehouse-production", strictLifecycle: false },
  { productId: "prod-ssi-accent-rear-projection-film", siteId: "site-ssi-screen-solutions-international", strictLifecycle: true },
  { productId: "prod-ssi-fan-cooled-projector-enclosures", siteId: "site-ssi-projectorenclosure", strictLifecycle: true },
] as const;
const allowedDraftOnlyPublished = new Set(["15289"]);

export function evaluateThreeCampaignHealth(input: { campaigns: readonly CampaignLike[]; targets: readonly TargetLike[]; executions: readonly ExecutionLike[]; products: readonly ProductLike[]; now?: string }): CampaignHealthReport {
  const now = new Date(input.now ?? new Date().toISOString()); const findings: CampaignHealthFinding[] = []; const safeRecoveryActions: CampaignHealthReport["safeRecoveryActions"] = [];
  const products = expectedProducts.map((expected) => { const product = input.products.find((candidate) => candidate.productId === expected.productId); const assigned = product?.primarySiteId === expected.siteId || product?.assignedSiteIds?.includes(expected.siteId); const healthy = Boolean(product && assigned && (!expected.strictLifecycle || (product.enabled && product.lifecycleState === "active" && product.catalogStatus === "ready"))); if (!healthy) findings.push({ severity: "ERROR", code: "PRODUCT_AUTHORITY_UNHEALTHY", campaignId: null, targetId: null, action: `Restore exact product authority for ${expected.productId}.` }); return { productId: expected.productId, healthy }; });
  const campaignIds = Object.values(GLW_STABILITY_CAMPAIGNS);
  const campaigns = campaignIds.map((campaignId) => {
    const campaign = input.campaigns.find((candidate) => candidate.campaignId === campaignId); const targets = input.targets.filter((target) => target.campaignId === campaignId); const counts = targets.reduce<Record<string, number>>((result, target) => ({ ...result, [target.status]: (result[target.status] ?? 0) + 1 }), {}); const stuck = targets.filter((target) => target.status === "running" && (!target.leaseExpiresAt || new Date(target.leaseExpiresAt) <= now)); const referenceCount = targets.filter((target) => target.status === "reference_complete").length;
    const unreconciled = input.executions.filter((execution) => execution.status === "COMPLETE" && execution.qaStatus === "COMPLETE" && execution.wordpressObjectId && execution.wordpressStatus === "draft" && targets.some((target) => target.jobId === execution.jobId && ["queued", "running", "failed"].includes(target.status))).length;
    const unauthorized = targets.filter((target) => target.status === "published" && campaign?.publicationPolicy === "draft_only" && !allowedDraftOnlyPublished.has(target.wordpressObjectId ?? "")).length;
    if (!campaign) findings.push({ severity: campaignId === GLW_STABILITY_CAMPAIGNS.pe ? "WARNING" : "ERROR", code: "CAMPAIGN_MISSING", campaignId, targetId: null, action: campaignId === GLW_STABILITY_CAMPAIGNS.pe ? "Create only the approved bounded PE starter campaign." : "Restore the certified campaign record." });
    if (campaign && targets.length === 0) findings.push({ severity: "ERROR", code: "TARGETS_MISSING", campaignId, targetId: null, action: "Restore deterministic campaign targets." });
    if (campaign && referenceCount !== 1) findings.push({ severity: "ERROR", code: "REFERENCE_STATE_INVALID", campaignId, targetId: null, action: "Reconcile exact reference identity and approval." });
    for (const target of stuck) findings.push({ severity: "ERROR", code: "STUCK_RUNNING_TARGET", campaignId, targetId: target.targetId, action: "Run bounded reconciliation; do not redispatch blindly." });
    if (unreconciled > 0) { findings.push({ severity: "WARNING", code: "COMPLETE_JOB_NOT_RECONCILED", campaignId, targetId: null, action: "Run idempotent campaign reconciliation." }); safeRecoveryActions.push({ campaignId, action: "RECONCILE", reason: `${unreconciled} COMPLETE draft job(s) are not reflected as draft_ready.` }); }
    if (unauthorized > 0) findings.push({ severity: "ERROR", code: "UNAUTHORIZED_PUBLICATION", campaignId, targetId: null, action: "Stop automation and inspect publication evidence; do not revert public content automatically." });
    return { campaignId, present: Boolean(campaign), readable: Boolean(campaign), counts, stuckRunning: stuck.length, unreconciledComplete: unreconciled, unauthorizedPublished: unauthorized, referenceCount };
  });
  return { generatedAt: now.toISOString(), healthy: findings.every((finding) => finding.severity !== "ERROR"), campaigns, products, findings, safeRecoveryActions };
}