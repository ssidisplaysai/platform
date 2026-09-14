jest.mock("server-only", () => ({}));

import { createSanAntonio608895ReconciliationService, SAN_ANTONIO_608895_IDENTITY, type SanAntonio608895ReconciliationReceipt } from "@/modules/glw/san-antonio-608895-reconciliation";
import type { GlwCampaignTarget } from "@/modules/glw/campaign-target-repository";
import type { GlwN8nExecutionSnapshot, GlwPageExecutionRecord } from "@/modules/glw/page-execution";

const timestamp = "2026-09-14T02:00:00.000Z";
const runtimeSha = "b".repeat(40);

function job(status: GlwPageExecutionRecord["status"] = "DISPATCHED"): GlwPageExecutionRecord {
  return {
    jobId: SAN_ANTONIO_608895_IDENTITY.jobId, correlationId: SAN_ANTONIO_608895_IDENTITY.jobId, executionTransport: "N8N_MCP", organizationId: "ssi", siteId: "site-ssi-projectorenclosure", productId: "prod-ssi-fan-cooled-projector-enclosures", productTopic: "Fan Cooled Projector Enclosures", state: "Texas", city: "San Antonio", slug: SAN_ANTONIO_608895_IDENTITY.canonicalPath, title: "Fan Cooled Projector Enclosures in San Antonio", seoTitle: "SEO", metaDescription: "Description", publicationIntent: "draft", status, externalExecutionId: "608895", wordpressObjectId: null, wordpressUrl: null, wordpressStatus: null, generatedDraft: status === "CONTENT_READY" ? { title: "Title", slug: SAN_ANTONIO_608895_IDENTITY.canonicalPath, contentHtml: "<p>authorized generated content</p>", excerpt: null, seoTitle: "SEO", metaDescription: "Description", focusKeyphrase: "projector enclosures san antonio" } : null, requestedPublicationMode: "draft", disposition: status === "CONTENT_READY" ? "CONTENT_READY" : null, qaStatus: status === "CONTENT_READY" ? "CONTENT_READY" : null, qaChecks: null, qaFailureReasons: null, focusKeyphrase: null, wordCount: null, featuredImagePresent: null, errorCode: null, errorMessage: null, createdAt: "2026-09-14T00:46:39.615Z", dispatchedAt: "2026-09-14T00:46:39.688Z", updatedAt: timestamp, completedAt: null,
  };
}

function target(status: GlwCampaignTarget["status"] = "running"): GlwCampaignTarget {
  return {
    targetId: SAN_ANTONIO_608895_IDENTITY.targetId, campaignId: SAN_ANTONIO_608895_IDENTITY.campaignId, organizationId: "ssi", siteId: "site-ssi-projectorenclosure", productId: "prod-ssi-fan-cooled-projector-enclosures", stateCode: "TX", citySlug: "san-antonio", cityName: "San Antonio", canonicalPath: SAN_ANTONIO_608895_IDENTITY.canonicalPath, publicationPolicy: "draft_only", status, jobId: SAN_ANTONIO_608895_IDENTITY.jobId, wordpressObjectId: null, attemptCount: 2, lastError: null, dispatchDate: "2026-09-13", leaseId: status === "running" ? SAN_ANTONIO_608895_IDENTITY.leaseId : null, leasedAt: status === "running" ? "2026-09-14T00:46:31.145Z" : null, leaseExpiresAt: status === "running" ? "2026-09-14T01:01:31.145Z" : null, createdAt: "2026-09-11T19:03:30.195Z", updatedAt: timestamp,
  };
}

function snapshot(): GlwN8nExecutionSnapshot {
  return {
    executionId: "608895", state: "SUCCESS", errorMessage: null,
    runData: { "GLW Content Ready": [{ data: { main: [[{ json: { job_id: SAN_ANTONIO_608895_IDENTITY.jobId, glw_content_ready: true, requested_publishing_mode: "draft", mutation_authority: "GENESIS", operation: "CREATE_CITY", page_title: "Fan Cooled Projector Enclosures in San Antonio", seo_title: "SEO", focus_keyphrase: "projector enclosures san antonio", desired_hierarchical_slug: SAN_ANTONIO_608895_IDENTITY.canonicalPath, article_html: "<p>authorized generated content</p>" } }]] } }] },
  };
}

function authorizedReceipt(): SanAntonio608895ReconciliationReceipt {
  return {
    receiptId: "san-antonio-608895-owner-reconciliation-v1", contract: "SAN_ANTONIO_608895_OWNER_AUTHORIZED_RECONCILIATION_V1", classification: "UNAUTHORIZED_VALID_DISPATCH", severity: "HIGH", identity: SAN_ANTONIO_608895_IDENTITY, principal: { principalId: "owner@example.com", sessionId: "session-1" }, securityRepairSha: SAN_ANTONIO_608895_IDENTITY.securityRepairSha, reconciliationRuntimeSha: runtimeSha, before: { jobStatus: "DISPATCHED", targetStatus: "running", leaseId: SAN_ANTONIO_608895_IDENTITY.leaseId, leasedAt: "2026-09-14T00:46:31.145Z", leaseExpiresAt: "2026-09-14T01:01:31.145Z", dispatchDate: "2026-09-13" }, authorizationRecordedAt: timestamp, outcome: "AUTHORIZED", reconciledAt: null, after: null, generatedArtifact: null, wordpressMutationPerformed: false, publicationPerformed: false, dispatchPerformed: false, workflowExecuted: false, ownerContentDecision: "NONE",
  };
}

describe("San Antonio execution 608895 reconciliation", () => {
  test("terminalizes content, resolves the lease, preserves dispatch accounting, and appends both audit phases", async () => {
    const receipts: SanAntonio608895ReconciliationReceipt[] = [];
    const calls: string[] = [];
    const reconcile = createSanAntonio608895ReconciliationService({
      reader: { async readExecution() { calls.push("read"); return snapshot(); }, async findExecutionIds() { return []; } }, now: () => new Date(timestamp), getJob: async () => job(), getTarget: () => target(), getReceipt: () => null, hashArtifact: () => SAN_ANTONIO_608895_IDENTITY.artifactSha256,
      saveReceipt(receipt) { calls.push(receipt.outcome); receipts.push(receipt); return receipt; },
      async applyTerminal(_jobId, terminal) { calls.push("job"); return { ...job("CONTENT_READY"), generatedDraft: terminal.kind === "complete" ? terminal.generatedDraft ?? null : null }; },
      transitionTarget(input) { calls.push("target"); const updated = target("content_ready"); expect(input.now?.toISOString()).toBe(timestamp); return { target: updated, leaseHistory: { leaseId: SAN_ANTONIO_608895_IDENTITY.leaseId, leasedAt: "2026-09-14T00:46:31.145Z", expiredAt: "2026-09-14T01:01:31.145Z", jobId: SAN_ANTONIO_608895_IDENTITY.jobId, externalExecutionId: "608895", dispatchDate: "2026-09-13" } }; },
    });
    const result = await reconcile({ principalId: "owner@example.com", sessionId: "session-1" }, runtimeSha);
    expect(calls).toEqual(["read", "AUTHORIZED", "job", "target", "RECONCILED"]);
    expect(result.receipt).toMatchObject({ classification: "UNAUTHORIZED_VALID_DISPATCH", outcome: "RECONCILED", after: { jobStatus: "CONTENT_READY", targetStatus: "content_ready", leaseCleared: true, dispatchDate: "2026-09-13" }, wordpressMutationPerformed: false, publicationPerformed: false, dispatchPerformed: false, workflowExecuted: false, ownerContentDecision: "NONE" });
    expect(receipts).toHaveLength(2);
  });

  test("resumes after job and target transitions without repeating either mutation", async () => {
    const authorization = authorizedReceipt();
    const saveReceipt = jest.fn((receipt: SanAntonio608895ReconciliationReceipt) => receipt);
    const applyTerminal = jest.fn();
    const transitionTarget = jest.fn();
    const reconcile = createSanAntonio608895ReconciliationService({ reader: { async readExecution() { return snapshot(); }, async findExecutionIds() { return []; } }, now: () => new Date(timestamp), getJob: async () => job("CONTENT_READY"), getTarget: () => target("content_ready"), getReceipt: () => authorization, saveReceipt, applyTerminal, transitionTarget, hashArtifact: () => SAN_ANTONIO_608895_IDENTITY.artifactSha256 });
    const result = await reconcile(authorization.principal, runtimeSha);
    expect(result.receipt.outcome).toBe("RECONCILED");
    expect(applyTerminal).not.toHaveBeenCalled();
    expect(transitionTarget).not.toHaveBeenCalled();
    expect(saveReceipt).toHaveBeenCalledTimes(1);
  });
});