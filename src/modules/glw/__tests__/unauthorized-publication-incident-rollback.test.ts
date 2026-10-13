jest.mock("server-only", () => ({}));

import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const getJsonMock = jest.fn();
const transitionMock = jest.fn();
const listVisualCertificationsMock = jest.fn();
const listVisualDecisionsMock = jest.fn();
const listProductMediaAuthorityMock = jest.fn();
const evaluateProductMediaReadinessMock = jest.fn();

jest.mock("@/modules/foundation/site-repository", () => ({
  getSiteById: jest.fn(() => ({
    siteId: "site-led-display-warehouse-production",
    organizationId: "led-display-warehouse",
    canonicalUrl: "https://leddisplaywarehouse.com",
    integrations: {
      wordpressApiBaseUrl: "https://example.com/wp-json/wp/v2",
      wordpressCredentialReference: "fixture",
    },
  })),
}));

jest.mock("@/modules/foundation/wordpress-credential-resolver", () => ({
  resolveWordPressCredentialReference: jest.fn(() => ({
    username: "fixture-user",
    applicationPassword: "fixture-pass",
  })),
}));

jest.mock("@/modules/foundation/authenticated-wordpress-read-authority", () => ({
  createAuthenticatedWordPressReadAuthority: jest.fn(() => ({
    getJson: getJsonMock,
  })),
}));

jest.mock("@/modules/foundation/wordpress-publish-writer", () => {
  const actual = jest.requireActual("@/modules/foundation/wordpress-publish-writer");
  return {
    ...actual,
    transitionGenesisWordPressPageStatus: (...args: unknown[]) => transitionMock(...args),
  };
});

jest.mock("@/modules/foundation/rendered-visual-certification-repository", () => ({
  listRenderedVisualCertifications: (...args: unknown[]) => listVisualCertificationsMock(...args),
  listRenderedVisualOwnerDecisions: (...args: unknown[]) => listVisualDecisionsMock(...args),
}));

jest.mock("@/modules/glw/product-media-authority", () => {
  const actual = jest.requireActual("@/modules/glw/product-media-authority");
  return {
    ...actual,
    listProductMediaAuthority: (...args: unknown[]) => listProductMediaAuthorityMock(...args),
    evaluateProductMediaReadiness: (...args: unknown[]) => evaluateProductMediaReadinessMock(...args),
  };
});

import { createGlwCampaign } from "../campaign-repository";
import {
  attachGlwCampaignTargetJob,
  initializeGlwCampaignTargets,
  leaseGlwCampaignTargets,
  listGlwCampaignTargets,
  markGlwCampaignTargetDraftReady,
  markGlwCampaignTargetPublished,
} from "../campaign-target-repository";
import {
  consumeExactPublicationRollbackGrant,
  issueExactPublicationRollbackGrant,
  issueExactPublicationRollbackPreflight,
  recordExactPublicationRollbackReceipt,
  EXACT_WORDPRESS_PUBLICATION,
} from "../exact-publication-rollback-authority";
import { glwPageExecutionRepository } from "../page-execution-repository";
import {
  executeUnauthorizedPublicationIncidentRollback,
  INCIDENT_OWNER_AUTHORIZATION_CONFIRMATION,
  runUnauthorizedPublicationIncidentRollbackPreflight,
} from "../unauthorized-publication-incident-rollback";

function contentSha(value: string): string {
  return createHash("sha256").update(value.trim()).digest("hex");
}

async function seedIncident(input: { wordpressStatus?: "publish" | "draft" }) {
  const created = createGlwCampaign({
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-outdoor-digital-sphere",
    name: "Unauthorized Publication Incident",
    pageType: "state_service",
    stateCodes: ["DE", "CT"],
    pagesPerDay: 1,
    publicationPolicy: "publish_after_gates",
    imageRequired: true,
  });
  if (!created.campaign) throw new Error("Expected campaign fixture");

  const campaignId = created.campaign.campaignId;
  initializeGlwCampaignTargets({
    campaignId,
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-outdoor-digital-sphere",
    stateCodes: ["DE", "CT"],
    referenceStateCode: "DE",
    referenceJobId: "reference-job",
    referenceWordpressObjectId: "20001",
  });

  const lease = leaseGlwCampaignTargets({
    campaignId,
    pagesPerDay: 1,
    dispatchDate: "2026-09-17",
    leaseId: "lease-ct",
    maxTargets: 1,
  });
  expect(lease).toHaveLength(1);
  expect(lease[0].stateCode).toBe("CT");

  const jobId = "86c4198b-7c93-4943-aadf-a8eeb5b3f80c";
  const executionId = "685446";
  const wordpressObjectId = "20158";
  const rawPostContent = "<div class=\"saw-page\"><h1>Outdoor Digital Sphere in Connecticut</h1></div>";

  attachGlwCampaignTargetJob({ campaignId, stateCode: "CT", leaseId: "lease-ct", jobId });
  markGlwCampaignTargetDraftReady({ campaignId, stateCode: "CT", jobId, wordpressObjectId });
  markGlwCampaignTargetPublished({ campaignId, stateCode: "CT", wordpressObjectId });

  await glwPageExecutionRepository.create({
    jobId,
    correlationId: "corr-ct",
    executionTransport: "N8N_MCP",
    organizationId: "led-display-warehouse",
    siteId: "site-led-display-warehouse-production",
    productId: "prod-outdoor-digital-sphere",
    productTopic: "Outdoor Digital Sphere",
    state: "Connecticut",
    city: null,
    slug: "connecticut",
    title: "Outdoor Digital Sphere in Connecticut",
    seoTitle: "Outdoor Digital Sphere in Connecticut",
    metaDescription: "Connecticut planning page",
    publicationIntent: "draft",
    status: "COMPLETE",
    externalExecutionId: executionId,
    wordpressObjectId,
    wordpressUrl: "https://leddisplaywarehouse.com/outdoor-digital-sphere/connecticut/",
    wordpressStatus: input.wordpressStatus ?? "draft",
    generatedDraft: { title: "Outdoor Digital Sphere in Connecticut", contentHtml: rawPostContent, slug: "connecticut", excerpt: null, seoTitle: null, metaDescription: null, focusKeyphrase: null },
    rawGeneratedDraft: null,
    canonicalizedGeneratedDraft: null,
    canonicalizationReceipt: null,
    errorCode: null,
    errorMessage: null,
    requestedPublicationMode: "draft",
    disposition: "COMPLETE",
    qaStatus: "COMPLETE",
    qaChecks: {},
    qaFailureReasons: null,
    focusKeyphrase: null,
    wordCount: 120,
    featuredImagePresent: false,
    createdAt: "2026-09-17T19:00:00.000Z",
    dispatchedAt: "2026-09-17T19:00:01.000Z",
    updatedAt: "2026-09-17T19:00:02.000Z",
    completedAt: "2026-09-17T19:00:03.000Z",
  });

  let wpStatus: "publish" | "draft" = "publish";
  getJsonMock.mockImplementation(async () => ({
    ok: true,
    body: {
      id: Number(wordpressObjectId),
      status: wpStatus,
      slug: "connecticut",
      parent: 20114,
      title: { raw: "Outdoor Digital Sphere in Connecticut" },
      featured_media: 0,
      content: { raw: rawPostContent },
    },
  }));
  transitionMock.mockImplementation(async () => {
    wpStatus = "draft";
    return {
      ok: true,
      wordpressObjectId,
      wordpressUrl: "https://leddisplaywarehouse.com/outdoor-digital-sphere/connecticut/",
      beforeStatus: "publish",
      afterStatus: "draft",
      mutationPerformed: true,
      contentMutationPerformed: false,
    };
  });

  listVisualCertificationsMock.mockReturnValue([]);
  listVisualDecisionsMock.mockReturnValue([]);
  listProductMediaAuthorityMock.mockReturnValue([]);
  evaluateProductMediaReadinessMock.mockReturnValue({ ready: false, blockers: ["PRODUCT_AUTHORITY_HERO_REQUIRED"] });

  return { campaignId, targetId: listGlwCampaignTargets(campaignId).find((target) => target.stateCode === "CT")!.targetId, jobId, executionId, wordpressObjectId, rawPostContent };
}

describe("unauthorized publication incident rollback", () => {
  const priorRoot = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "incident-rollback-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
    getJsonMock.mockReset();
    transitionMock.mockReset();
    listVisualCertificationsMock.mockReset();
    listVisualDecisionsMock.mockReset();
    listProductMediaAuthorityMock.mockReset();
    evaluateProductMediaReadinessMock.mockReset();
  });

  afterEach(() => {
    if (priorRoot === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = priorRoot;
    rmSync(root, { recursive: true, force: true });
  });

  test("unauthorized published target with no exact publication receipt can be owner-authorized back to draft", async () => {
    const seeded = await seedIncident({ wordpressStatus: "draft" });
    const preflight = await runUnauthorizedPublicationIncidentRollbackPreflight({
      campaignId: seeded.campaignId,
      targetId: seeded.targetId,
      jobId: seeded.jobId,
      executionId: seeded.executionId,
      wordpressObjectId: seeded.wordpressObjectId,
      runtimeSha: "a".repeat(40),
    });

    const record = await executeUnauthorizedPublicationIncidentRollback({
      preflight,
      principal: { principalId: "owner", sessionId: "session", authority: "GENESIS_SERVER_SESSION_V1" },
      ownerAuthorization: {
        confirm: INCIDENT_OWNER_AUTHORIZATION_CONFIRMATION,
        ownerPrincipalId: "owner",
        incidentReason: "Unauthorized publication without required gates or exact receipt.",
      },
    });

    expect(record.after.wordpressStatus).toBe("draft");
    expect(record.after.targetStatus).toBe("draft_ready");
    expect(record.after.executionWordPressStatus).toBe("draft");
    const target = listGlwCampaignTargets(seeded.campaignId).find((entry) => entry.targetId === seeded.targetId);
    expect(target?.status).toBe("draft_ready");
    const job = await glwPageExecutionRepository.getById(seeded.jobId);
    expect(job?.wordpressStatus).toBe("draft");
  });

  test("legitimate published target cannot use incident rollback path", async () => {
    const seeded = await seedIncident({ wordpressStatus: "publish" });
    const sha = contentSha(seeded.rawPostContent);
    listVisualCertificationsMock.mockReturnValue([
      {
        certificationId: "cert-1",
        captureSetId: "capture-1",
        overallState: "PASS",
        identity: {
          campaignId: seeded.campaignId,
          targetId: seeded.targetId,
          jobId: seeded.jobId,
          externalExecutionId: seeded.executionId,
          wordpressObjectId: seeded.wordpressObjectId,
          contentHash: sha,
          pageId: seeded.targetId,
          organizationId: "led-display-warehouse",
          siteId: "site-led-display-warehouse-production",
          pageRevisionIdentity: "job:ct",
          canonicalPath: "/outdoor-digital-sphere/connecticut/",
          renderedContentHash: null,
          wordpressStatus: "draft",
        },
      },
    ]);
    listVisualDecisionsMock.mockReturnValue([
      {
        certificationId: "cert-1",
        captureSetId: "capture-1",
        decision: "APPROVED",
        pageRevisionIdentity: "job:ct",
        contentHash: sha,
        renderedContentHash: null,
      },
    ]);
    evaluateProductMediaReadinessMock.mockReturnValue({ ready: true, blockers: [] });

    await expect(runUnauthorizedPublicationIncidentRollbackPreflight({
      campaignId: seeded.campaignId,
      targetId: seeded.targetId,
      jobId: seeded.jobId,
      executionId: seeded.executionId,
      wordpressObjectId: seeded.wordpressObjectId,
      runtimeSha: "a".repeat(40),
    })).rejects.toThrow("INCIDENT_ROLLBACK_MISSING_GATE_EVIDENCE_REQUIRED");
  });

  test("target with a valid exact publication receipt must use normal rollback path", async () => {
    const seeded = await seedIncident({ wordpressStatus: "publish" });
    const sha = contentSha(seeded.rawPostContent);
    const principal = { principalId: "owner", sessionId: "session", authority: "GENESIS_SERVER_SESSION_V1" };
    const context = {
      operation: EXACT_WORDPRESS_PUBLICATION,
      organizationId: "led-display-warehouse",
      siteId: "site-led-display-warehouse-production",
      campaignId: seeded.campaignId,
      productId: "prod-outdoor-digital-sphere",
      targetId: seeded.targetId,
      stateCode: "CT",
      wordpressObjectId: seeded.wordpressObjectId,
      parentObjectId: "20114",
      slug: "connecticut",
      canonicalPath: "/outdoor-digital-sphere/connecticut/",
      expectedH1: "Outdoor Digital Sphere in Connecticut",
      expectedTitle: "Outdoor Digital Sphere in Connecticut",
      featuredMediaId: 0,
      storedPostContentSha: sha,
      visualCertificationId: "cert-1",
      runtimeSha: "a".repeat(40),
      expectedCurrentStatus: "draft" as const,
      intendedStatus: "publish" as const,
      sourcePublicationReceiptId: null,
    };
    const preflight = issueExactPublicationRollbackPreflight({ context, principal, preflightVerified: true, now: new Date("2030-01-01T00:00:00Z") });
    const grant = issueExactPublicationRollbackGrant({ preflightId: preflight.preflightId, context, principal, now: new Date("2030-01-01T00:00:01Z") });
    const claim = consumeExactPublicationRollbackGrant({ preflightId: preflight.preflightId, grantId: grant.grantId, context, principal, now: new Date("2030-01-01T00:00:02Z") });
    recordExactPublicationRollbackReceipt({
      context,
      principal,
      claimId: claim.claimId,
      beforeStatus: "draft",
      afterStatus: "publish",
      beforeContentSha: sha,
      afterContentSha: sha,
      publicCanonicalHttpStatus: 200,
      publicCertificationId: "public-cert",
      lifecycleState: "PUBLIC_CERTIFIED",
      mutationPerformed: true,
      now: new Date("2030-01-01T00:00:03Z"),
    });

    await expect(runUnauthorizedPublicationIncidentRollbackPreflight({
      campaignId: seeded.campaignId,
      targetId: seeded.targetId,
      jobId: seeded.jobId,
      executionId: seeded.executionId,
      wordpressObjectId: seeded.wordpressObjectId,
      runtimeSha: "a".repeat(40),
    })).rejects.toThrow("INCIDENT_ROLLBACK_VALID_PUBLICATION_RECEIPT_EXISTS");
  });

  test("wrong target/job/execution/WordPress identity fails closed", async () => {
    const seeded = await seedIncident({ wordpressStatus: "publish" });
    await expect(runUnauthorizedPublicationIncidentRollbackPreflight({ campaignId: seeded.campaignId, targetId: "wrong-target", jobId: seeded.jobId, executionId: seeded.executionId, wordpressObjectId: seeded.wordpressObjectId, runtimeSha: "a".repeat(40) })).rejects.toThrow();
    await expect(runUnauthorizedPublicationIncidentRollbackPreflight({ campaignId: seeded.campaignId, targetId: seeded.targetId, jobId: "wrong-job", executionId: seeded.executionId, wordpressObjectId: seeded.wordpressObjectId, runtimeSha: "a".repeat(40) })).rejects.toThrow();
    await expect(runUnauthorizedPublicationIncidentRollbackPreflight({ campaignId: seeded.campaignId, targetId: seeded.targetId, jobId: seeded.jobId, executionId: "wrong-execution", wordpressObjectId: seeded.wordpressObjectId, runtimeSha: "a".repeat(40) })).rejects.toThrow();
    await expect(runUnauthorizedPublicationIncidentRollbackPreflight({ campaignId: seeded.campaignId, targetId: seeded.targetId, jobId: seeded.jobId, executionId: seeded.executionId, wordpressObjectId: "99999", runtimeSha: "a".repeat(40) })).rejects.toThrow();
  });

  test("missing explicit owner authorization fails", async () => {
    const seeded = await seedIncident({ wordpressStatus: "publish" });
    const preflight = await runUnauthorizedPublicationIncidentRollbackPreflight({
      campaignId: seeded.campaignId,
      targetId: seeded.targetId,
      jobId: seeded.jobId,
      executionId: seeded.executionId,
      wordpressObjectId: seeded.wordpressObjectId,
      runtimeSha: "a".repeat(40),
    });

    await expect(executeUnauthorizedPublicationIncidentRollback({
      preflight,
      principal: { principalId: "owner", sessionId: "session", authority: "GENESIS_SERVER_SESSION_V1" },
      ownerAuthorization: {
        confirm: "BAD_CONFIRM" as never,
        ownerPrincipalId: "owner",
        incidentReason: "reason",
      },
    })).rejects.toThrow("INCIDENT_ROLLBACK_OWNER_AUTHORIZATION_REQUIRED");
  });

  test("incident path cannot publish, dispatch, or regenerate and runtime3001 remains untouched", () => {
    const route = readFileSync(resolve(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/unauthorized-publication-incident-rollback/route.ts"), "utf8");
    const service = readFileSync(resolve(process.cwd(), "src/modules/glw/unauthorized-publication-incident-rollback.ts"), "utf8");

    expect(route).not.toMatch(/publishGenesisWordPressDraft|PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS/i);
    expect(route).not.toMatch(/dispatchGlw|execute_workflow|publishGenesisWordPressDraft/i);
    expect(route).toContain("n8nExecutionCreated: false");
    expect(route).toContain("generationAttempted: false");
    expect(service).not.toMatch(/publishGenesisWordPressDraft|markGlwCampaignTargetPublished/i);
    expect(service).not.toMatch(/leaseGlwCampaignTargets|attachGlwCampaignTargetJob|execute_workflow|dispatchGlw/i);
    expect(service).not.toMatch(/generateGenesisFeaturedImage|content-repair-service/i);
    expect(route).not.toContain("3001");
    expect(service).not.toContain("3001");
  });
});
