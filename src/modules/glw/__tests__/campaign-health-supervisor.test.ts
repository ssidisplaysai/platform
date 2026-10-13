import { evaluateThreeCampaignHealth, GLW_STABILITY_CAMPAIGNS } from "../campaign-health-supervisor";

describe("three-campaign health supervisor", () => {
  const products = [{ productId: "prod-indoor-digital-sphere", lifecycleState: "draft", catalogStatus: "incomplete", enabled: false, primarySiteId: "site-led-display-warehouse-production" }, { productId: "prod-ssi-accent-rear-projection-film", lifecycleState: "active", catalogStatus: "ready", enabled: true, primarySiteId: "site-ssi-screen-solutions-international" }, { productId: "prod-ssi-fan-cooled-projector-enclosures", lifecycleState: "active", catalogStatus: "ready", enabled: true, primarySiteId: "site-ssi-projectorenclosure" }];
  const campaigns = [
    { campaignId: GLW_STABILITY_CAMPAIGNS.ldw, siteId: "site-led-display-warehouse-production", productId: products[0].productId, status: "active", publicationPolicy: "publish_after_gates" },
    { campaignId: GLW_STABILITY_CAMPAIGNS.ssi, siteId: "site-ssi-screen-solutions-international", productId: products[1].productId, status: "active", publicationPolicy: "draft_only" },
    { campaignId: GLW_STABILITY_CAMPAIGNS.pe, siteId: "site-ssi-projectorenclosure", productId: products[2].productId, status: "active", publicationPolicy: "draft_only" },
  ];

  test("is read-only healthy for stable campaign state including approved SSI published baseline", () => {
    const targets = campaigns.flatMap((campaign, index) => [{ targetId: `r-${index}`, campaignId: campaign.campaignId, status: "reference_complete", jobId: `j-${index}`, wordpressObjectId: `w-${index}` }, ...(index === 1 ? [{ targetId: "plano", campaignId: campaign.campaignId, status: "published", jobId: "plano-job", wordpressObjectId: "15289" }] : [])]);
    expect(evaluateThreeCampaignHealth({ campaigns, targets, executions: [], products, now: "2026-09-05T00:00:00.000Z" })).toMatchObject({ healthy: true, findings: [] });
  });

  test("reports missing PE, stuck targets, unreconciled jobs, and unauthorized publication without mutation", () => {
    const targets = [{ targetId: "stuck", campaignId: GLW_STABILITY_CAMPAIGNS.ldw, status: "running", jobId: "complete-job", wordpressObjectId: "1", leaseExpiresAt: "2026-09-04T00:00:00.000Z" }, { targetId: "ssi-ref", campaignId: GLW_STABILITY_CAMPAIGNS.ssi, status: "reference_complete", jobId: "ssi-job", wordpressObjectId: "15301" }, { targetId: "bad-published", campaignId: GLW_STABILITY_CAMPAIGNS.ssi, status: "published", jobId: "bad", wordpressObjectId: "999" }];
    const executions = [{ jobId: "complete-job", siteId: campaigns[0].siteId, productId: campaigns[0].productId, status: "COMPLETE", qaStatus: "COMPLETE", wordpressObjectId: "1", wordpressStatus: "draft" }];
    const report = evaluateThreeCampaignHealth({ campaigns: campaigns.slice(0, 2), targets, executions, products, now: "2026-09-05T00:00:00.000Z" });
    expect(report.healthy).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toEqual(expect.arrayContaining(["CAMPAIGN_MISSING", "STUCK_RUNNING_TARGET", "COMPLETE_JOB_NOT_RECONCILED", "UNAUTHORIZED_PUBLICATION", "REFERENCE_STATE_INVALID"]));
    expect(report.safeRecoveryActions).toEqual([{ campaignId: GLW_STABILITY_CAMPAIGNS.ldw, action: "RECONCILE", reason: "1 COMPLETE draft job(s) are not reflected as draft_ready." }]);
  });
});