jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createGlwCampaign, listGlwCampaigns } from "../campaign-repository";
import { initializeGlwCityCampaignTargets, listGlwCampaignTargets } from "../campaign-target-repository";
import { glwPageExecutionRepository } from "../page-execution-repository";
import {
  GLW_REFERENCE_EXECUTION_RETIRED_DISPOSITION,
  isGlwExecutionQuarantined,
  isGlwReferenceExecutionRetiredForProjection,
  type GlwPageExecutionRecord,
} from "../page-execution";
import {
  retireGlwReferenceExecutionForProjection,
  GLW_REFERENCE_EXECUTION_RETIRE_OPERATION,
} from "../reference-execution-retirement";
import { findEvidenceBoundLegacyReferenceJob, selectMostRecentActiveReferenceExecution } from "../reference-workflow-state";

const SCOPE = {
  organizationId: "ssi",
  siteId: "site-ssi-projectorenclosure",
  productId: "prod-ssi-fan-cooled-projector-enclosures",
};
const CAMPAIGN_NAME = "Fan Cooled Projector Enclosures Texas Expanded Cities";
const CANONICAL_PATH = "fan-cooled-projector-enclosures/texas/arlington";

function execution(jobId: string, patch: Partial<GlwPageExecutionRecord> = {}): GlwPageExecutionRecord {
  return {
    jobId,
    correlationId: jobId,
    executionTransport: "N8N_MCP",
    organizationId: SCOPE.organizationId,
    siteId: SCOPE.siteId,
    productId: SCOPE.productId,
    productTopic: "Fan Cooled Projector Enclosures",
    state: "Texas",
    city: "Arlington",
    slug: CANONICAL_PATH,
    title: "Fan Cooled Projector Enclosures in Arlington",
    seoTitle: "Fan Cooled Projector Enclosures in Arlington | Screen Solutions International",
    metaDescription: "Explore fan cooled projector enclosures in Arlington.",
    publicationIntent: "draft",
    status: "FAILED",
    externalExecutionId: "764948",
    wordpressObjectId: null,
    wordpressUrl: null,
    wordpressStatus: null,
    generatedDraft: {
      title: "Fan Cooled Projector Enclosures in Arlington",
      contentHtml: "<p>Reference draft</p>",
      slug: CANONICAL_PATH,
      excerpt: "Reference excerpt",
      seoTitle: "Reference SEO",
      metaDescription: "Reference meta",
      focusKeyphrase: "fan cooled projector enclosures arlington",
    },
    errorCode: "GENERATED_CONTENT_QA_FAILED",
    errorMessage: "Detected mojibake marker(s)",
    requestedPublicationMode: "draft",
    disposition: "CONTENT_READY",
    qaStatus: "FAILED",
    qaChecks: { seed: true },
    qaFailureReasons: { encodingIntegrity: "Detected mojibake" },
    focusKeyphrase: null,
    wordCount: null,
    featuredImagePresent: null,
    createdAt: "2026-09-22T20:00:00.000Z",
    dispatchedAt: "2026-09-22T20:00:10.000Z",
    updatedAt: "2026-09-22T20:40:12.129Z",
    completedAt: "2026-09-22T20:40:12.129Z",
    ...patch,
  };
}

function seedCampaignAndTargets() {
  const created = createGlwCampaign({
    organizationId: SCOPE.organizationId,
    siteId: SCOPE.siteId,
    productId: SCOPE.productId,
    name: CAMPAIGN_NAME,
    pageType: "city_service",
    stateCodes: ["TX"],
    cityTargets: [{ stateCode: "TX", citySlug: "arlington", cityName: "Arlington" }],
    pagesPerDay: 10,
    publicationPolicy: "draft_only",
    imageRequired: true,
  });
  if (!created.campaign) throw new Error(`campaign create failed: ${created.errors.join(";")}`);

  initializeGlwCityCampaignTargets({
    campaignId: created.campaign.campaignId,
    organizationId: created.campaign.organizationId,
    siteId: created.campaign.siteId,
    productId: created.campaign.productId,
    cityTargets: created.campaign.cityTargets ?? [],
    referenceTarget: { stateCode: "TX", citySlug: "dallas" },
    referenceJobId: null,
    referenceWordpressObjectId: null,
  });

  return created.campaign;
}

function seedReferenceBoundCampaign() {
  const created = createGlwCampaign({
    organizationId: SCOPE.organizationId,
    siteId: SCOPE.siteId,
    productId: SCOPE.productId,
    name: `${CAMPAIGN_NAME} Bound`,
    pageType: "city_service",
    stateCodes: ["TX"],
    cityTargets: [{ stateCode: "TX", citySlug: "arlington", cityName: "Arlington" }],
    pagesPerDay: 10,
    publicationPolicy: "draft_only",
    imageRequired: true,
  });
  if (!created.campaign) throw new Error(`campaign create failed: ${created.errors.join(";")}`);

  initializeGlwCityCampaignTargets({
    campaignId: created.campaign.campaignId,
    organizationId: created.campaign.organizationId,
    siteId: created.campaign.siteId,
    productId: created.campaign.productId,
    cityTargets: created.campaign.cityTargets ?? [],
    referenceTarget: { stateCode: "TX", citySlug: "arlington" },
    referenceJobId: "bound-job",
    referenceWordpressObjectId: null,
  });

  return created.campaign;
}

describe("reference execution retirement", () => {
  let root: string;
  const original = process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
  const originalSession = process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "glw-reference-retire-"));
    process.env.GCP_FOUNDATION_PERSISTENCE_DIR = root;
    process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR = root;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.GCP_FOUNDATION_PERSISTENCE_DIR;
    else process.env.GCP_FOUNDATION_PERSISTENCE_DIR = original;
    if (originalSession === undefined) delete process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR;
    else process.env.GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR = originalSession;
    rmSync(root, { recursive: true, force: true });
  });

  test("keeps failed reference active before explicit retirement", async () => {
    seedCampaignAndTargets();
    const oldJob = execution("job-old", { updatedAt: "2026-09-22T20:40:12.129Z" });
    const duplicate = execution("job-dup", {
      updatedAt: "2026-09-22T20:41:00.000Z",
      disposition: "QUARANTINED_SUPERSEDED_DUPLICATE",
      errorCode: "DUPLICATE_JOB_QUARANTINED",
      externalExecutionId: "764946",
    });

    await glwPageExecutionRepository.create(oldJob);
    await glwPageExecutionRepository.create(duplicate);

    const selected = selectMostRecentActiveReferenceExecution([oldJob, duplicate]);
    expect(selected?.jobId).toBe("job-old");
    expect(isGlwExecutionQuarantined(duplicate)).toBe(true);
  });

  test("retires failed execution for projection and preserves record", async () => {
    const campaign = seedCampaignAndTargets();
    const oldJob = execution("job-old");
    await glwPageExecutionRepository.create(oldJob);

    const result = await retireGlwReferenceExecutionForProjection({
      operationId: "retire-1",
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "arlington",
      expectedJobId: oldJob.jobId,
      expectedExecutionId: "764948",
      expectedCanonicalPath: CANONICAL_PATH,
      principalId: "operator",
      reason: "Target was requeued for fresh reference generation.",
    });

    expect(result.operationType).toBe(GLW_REFERENCE_EXECUTION_RETIRE_OPERATION);
    expect(result.alreadyRetired).toBe(false);

    const stored = await glwPageExecutionRepository.getById(oldJob.jobId);
    expect(stored).not.toBeNull();
    expect(stored?.status).toBe("FAILED");
    expect(stored?.errorCode).toBe("GENERATED_CONTENT_QA_FAILED");
    expect(stored?.externalExecutionId).toBe("764948");
    expect(stored?.disposition).toBe(GLW_REFERENCE_EXECUTION_RETIRED_DISPOSITION);
    expect(isGlwReferenceExecutionRetiredForProjection(stored!)).toBe(true);

    const selected = selectMostRecentActiveReferenceExecution([stored!]);
    expect(selected).toBeNull();
  });

  test("retired execution is excluded from legacy reference projection", async () => {
    const campaign = seedCampaignAndTargets();
    const oldJob = execution("job-old");
    await glwPageExecutionRepository.create(oldJob);

    await retireGlwReferenceExecutionForProjection({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "arlington",
      expectedJobId: oldJob.jobId,
      expectedExecutionId: "764948",
      expectedCanonicalPath: CANONICAL_PATH,
      principalId: "operator",
      reason: "Retire legacy blocked reference.",
    });

    const records = await glwPageExecutionRepository.list();
    const legacy = findEvidenceBoundLegacyReferenceJob({
      campaign,
      campaigns: listGlwCampaigns(),
      records,
    });
    expect(legacy).toBeNull();
  });

  test("idempotent repeated retirement returns alreadyRetired", async () => {
    const campaign = seedCampaignAndTargets();
    const oldJob = execution("job-old");
    await glwPageExecutionRepository.create(oldJob);

    await retireGlwReferenceExecutionForProjection({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "arlington",
      expectedJobId: oldJob.jobId,
      expectedExecutionId: "764948",
      expectedCanonicalPath: CANONICAL_PATH,
      principalId: "operator",
      reason: "first",
    });

    const second = await retireGlwReferenceExecutionForProjection({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "arlington",
      expectedJobId: oldJob.jobId,
      expectedExecutionId: "764948",
      expectedCanonicalPath: CANONICAL_PATH,
      principalId: "operator",
      reason: "second",
    });
    expect(second.alreadyRetired).toBe(true);
  });

  test("rejects running execution", async () => {
    const campaign = seedCampaignAndTargets();
    await glwPageExecutionRepository.create(execution("job-running", { status: "RUNNING", errorCode: null, errorMessage: null }));

    await expect(retireGlwReferenceExecutionForProjection({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "arlington",
      expectedJobId: "job-running",
      expectedExecutionId: "764948",
      expectedCanonicalPath: CANONICAL_PATH,
      principalId: "operator",
      reason: "block running",
    })).rejects.toThrow("REFERENCE_RETIRE_JOB_STATUS_INVALID");
  });

  test("rejects wordpress-mutated execution and published execution", async () => {
    const campaign = seedCampaignAndTargets();
    await glwPageExecutionRepository.create(execution("job-draft", { wordpressObjectId: "12345", wordpressStatus: "draft" }));
    await glwPageExecutionRepository.create(execution("job-published", { wordpressStatus: "publish", wordpressObjectId: "67890" }));

    await expect(retireGlwReferenceExecutionForProjection({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "arlington",
      expectedJobId: "job-draft",
      expectedExecutionId: "764948",
      expectedCanonicalPath: CANONICAL_PATH,
      principalId: "operator",
      reason: "block mutated",
    })).rejects.toThrow("REFERENCE_RETIRE_WORDPRESS_MUTATION_FORBIDDEN");

    await expect(retireGlwReferenceExecutionForProjection({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "arlington",
      expectedJobId: "job-published",
      expectedExecutionId: "764948",
      expectedCanonicalPath: CANONICAL_PATH,
      principalId: "operator",
      reason: "block published",
    })).rejects.toThrow("REFERENCE_RETIRE_WORDPRESS_MUTATION_FORBIDDEN");
  });

  test("fails closed on identity mismatch", async () => {
    const campaign = seedCampaignAndTargets();
    await glwPageExecutionRepository.create(execution("job-old"));

    await expect(retireGlwReferenceExecutionForProjection({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "arlington",
      expectedJobId: "job-old",
      expectedExecutionId: "wrong-execution",
      expectedCanonicalPath: CANONICAL_PATH,
      principalId: "operator",
      reason: "wrong identity",
    })).rejects.toThrow("REFERENCE_RETIRE_JOB_IDENTITY_MISMATCH");
  });

  test("requires target to be requeued with null job binding", async () => {
    const campaign = seedReferenceBoundCampaign();
    await glwPageExecutionRepository.create(execution("bound-job"));

    const [target] = listGlwCampaignTargets(campaign.campaignId);
    expect(target.status).toBe("reference_complete");
    expect(target.jobId).toBe("bound-job");

    await expect(retireGlwReferenceExecutionForProjection({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      campaignId: campaign.campaignId,
      stateCode: "TX",
      citySlug: "arlington",
      expectedJobId: "bound-job",
      expectedExecutionId: "764948",
      expectedCanonicalPath: CANONICAL_PATH,
      principalId: "operator",
      reason: "target precondition check",
    })).rejects.toThrow("REFERENCE_RETIRE_TARGET_STATUS_INVALID");
  });
});
