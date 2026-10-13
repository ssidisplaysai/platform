jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

const CAMPAIGN_ID = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2";
const ORG_ID = "led-display-warehouse";
const SITE_ID = "site-led-display-warehouse-production";
const PRODUCT_ID = "prod-outdoor-digital-sphere";
const JOB_ID = "a1371f29-8952-438d-9ed4-583da68d4fbb";
const WORDPRESS_OBJECT_ID = "20240";

let campaign: any;
let durableReferenceStateCode = "TX";
let approval: any;
let governedReferenceApproval: any;
let certifiedReference: any;
let certifiedTargets: any[];
let referenceJob: any;
let initializedTargets: any[];

function createStateCampaign(overrides: Record<string, unknown> = {}) {
  return {
    campaignId: CAMPAIGN_ID,
    organizationId: ORG_ID,
    siteId: SITE_ID,
    productId: PRODUCT_ID,
    pageType: "state_service",
    publicationPolicy: "draft_only",
    status: "draft",
    stateCodes: ["TX", "CA"],
    pagesPerDay: 3,
    imageRequired: true,
    ...overrides,
  };
}

function createCityCampaign(overrides: Record<string, unknown> = {}) {
  return {
    ...createStateCampaign({
      pageType: "city_service",
      stateCodes: ["TX"],
      cityTargets: [{ stateCode: "TX", citySlug: "dallas", cityName: "Dallas" }],
    }),
    ...overrides,
  };
}

function createApproval(overrides: Record<string, unknown> = {}) {
  return {
    campaignId: CAMPAIGN_ID,
    stateCode: "TX",
    citySlug: null,
    jobId: JOB_ID,
    wordpressObjectId: WORDPRESS_OBJECT_ID,
    approvalKind: "WORDPRESS_DRAFT_REFERENCE",
    ...overrides,
  };
}

function createReferenceJob(overrides: Record<string, unknown> = {}) {
  return {
    jobId: JOB_ID,
    organizationId: ORG_ID,
    siteId: SITE_ID,
    productId: PRODUCT_ID,
    state: "Texas",
    city: null,
    status: "COMPLETE",
    qaStatus: "PASSED",
    wordpressStatus: "draft",
    wordpressObjectId: WORDPRESS_OBJECT_ID,
    featuredImagePresent: true,
    ...overrides,
  };
}

function createTarget(
  status: string,
  stateCode: string,
  citySlug: string | null = null,
  overrides: Record<string, unknown> = {},
) {
  return {
    campaignId: CAMPAIGN_ID,
    stateCode,
    citySlug,
    status,
    jobId: status === "queued" ? null : JOB_ID,
    wordpressObjectId: status === "queued" ? null : WORDPRESS_OBJECT_ID,
    ...overrides,
  };
}

jest.mock("@/modules/foundation/api-auth", () => ({
  authorizeRequest: () => ({ ok: true, status: 200, roles: ["platform_admin"], error: null }),
  hasOrganizationScope: () => true,
  resolveRequestScope: () => ({ organizationId: ORG_ID, siteId: SITE_ID }),
}));

jest.mock("@/modules/foundation/product-repository", () => ({
  getProductById: () => ({ slug: "outdoor-digital-sphere" }),
}));

jest.mock("@/modules/glw/campaign-repository", () => ({
  activateGlwCampaign: () => ({ campaign: campaign ? { ...campaign, status: "active" } : null, errors: [] }),
  listGlwCampaigns: () => (campaign ? [campaign] : []),
}));

jest.mock("@/modules/glw/campaign-reference-approval-repository", () => ({
  getGlwCampaignReferenceApproval: () => approval,
  getGovernedLocalCampaignReferenceApproval: () => governedReferenceApproval,
}));

jest.mock("@/modules/glw/campaign-target-repository", () => ({
  initializeGlwCampaignTargets: () => initializedTargets,
  initializeGlwCityCampaignTargets: () => initializedTargets,
  listGlwCampaignTargets: () => [],
  previewGlwCampaignTargets: () => [],
}));

jest.mock("@/modules/glw/campaign-certified-state-targets", () => ({
  listGlwCertifiedStateCampaignTargets: () => certifiedTargets,
  resolveGlwCertifiedStateActivationReference: () => certifiedReference,
}));

jest.mock("@/modules/glw/campaign-activation-reference-authority", () => ({
  buildWordpressDraftReferenceApprovalAuthority: ({
    campaignId,
    stateCode,
    citySlug,
    jobId,
    wordpressObjectId,
  }: {
    campaignId: string;
    stateCode: string;
    citySlug: string | null;
    jobId: string;
    wordpressObjectId: string;
  }) => ({
    campaignId,
    stateCode,
    citySlug,
    jobId,
    wordpressObjectId,
    receiptSha256: "receipt",
    referenceRevision: 1,
    imageCandidateId: "draft",
    imageCandidateRevision: 1,
  }),
  referenceApprovalMatchesTargetIdentity: () => true,
}));

jest.mock("@/modules/glw/campaign-recovered-target-adoption", () => ({
  applyRecoveredCityCampaignTargetAdoption: () => initializedTargets,
  planRecoveredCityCampaignTargetAdoption: () => [],
}));

jest.mock("@/modules/glw/campaign-geography", () => ({
  GLW_CAMPAIGN_US_STATES: [{ code: "TX", name: "Texas" }, { code: "CA", name: "California" }],
}));

jest.mock("@/modules/glw/page-execution-repository", () => ({
  glwPageExecutionRepository: {
    getById: async () => referenceJob,
    list: async () => [],
  },
}));

jest.mock("@/modules/glw/reference-state-selection-repository", () => ({
  getGlwReferenceStateSelection: () => ({ stateCode: durableReferenceStateCode }),
}));

jest.mock("@/modules/glw/campaign-launch-authority", () => ({
  recordGlwCampaignLaunchActivated: () => null,
  requireGlwCampaignLaunchReservationOwnership: () => null,
}));

jest.mock("@/modules/glw/campaign-activation-authorization", () => ({
  claimGlwCampaignActivationGrant: () => ({
    grant: { grantId: "grant-1" },
    claimId: "claim-1",
  }),
  consumeGlwCampaignActivationGrant: () => null,
}));

jest.mock("@/modules/glw/campaign-release-capability", () => ({
  requireGlwCampaignActivationReleaseCapability: () => null,
}));

jest.mock("@/modules/glw/trusted-operator-principal", () => ({
  resolveGlwTrustedOperatorPrincipal: () => ({
    ok: true,
    principal: {
      principalId: "operator",
      sessionId: "session",
      authority: "GENESIS_OPERATOR_SESSION",
    },
  }),
}));

import { POST } from "../route";

function makeRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost/api/glw/campaigns/${CAMPAIGN_ID}/activate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function execute(body: Record<string, unknown> = {}) {
  return POST(makeRequest(body), { params: Promise.resolve({ campaignId: CAMPAIGN_ID }) });
}

describe("GLW activation reference integrity alignment", () => {
  beforeEach(() => {
    campaign = createStateCampaign();
    durableReferenceStateCode = "TX";
    approval = createApproval();
    governedReferenceApproval = null;
    certifiedReference = null;
    certifiedTargets = [];
    referenceJob = createReferenceJob();
    initializedTargets = [
      createTarget("draft_ready", "TX"),
      createTarget("queued", "CA"),
    ];
  });

  test("approved WordPress draft authority passes with exact draft_ready target", async () => {
    const response = await execute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activation.referenceStateCode).toBe("TX");
    expect((body.targets as any[]).find((target) => target.stateCode === "TX")?.status).toBe("draft_ready");
  });

  test("approved WordPress draft authority passes with exact reference_complete target", async () => {
    initializedTargets = [
      createTarget("reference_complete", "TX"),
      createTarget("queued", "CA"),
    ];

    const response = await execute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect((body.targets as any[]).find((target) => target.stateCode === "TX")?.status).toBe("reference_complete");
  });

  test("wrong draft reference jobId is rejected", async () => {
    initializedTargets = [
      createTarget("draft_ready", "TX", null, { jobId: "wrong-job" }),
      createTarget("queued", "CA"),
    ];

    const response = await execute();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Campaign target queue failed activation integrity checks.");
  });

  test("wrong draft reference wordpressObjectId is rejected", async () => {
    initializedTargets = [
      createTarget("draft_ready", "TX", null, { wordpressObjectId: "99999" }),
      createTarget("queued", "CA"),
    ];

    const response = await execute();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Campaign target queue failed activation integrity checks.");
  });

  test("queued reference target is rejected", async () => {
    initializedTargets = [
      createTarget("queued", "TX"),
      createTarget("queued", "CA"),
    ];

    const response = await execute();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Campaign target queue failed activation integrity checks.");
  });

  test("published target does not satisfy WordPress-draft reference authority path", async () => {
    initializedTargets = [
      createTarget("published", "TX"),
      createTarget("queued", "CA"),
    ];

    const response = await execute();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Campaign target queue failed activation integrity checks.");
  });

  test("public-certified state reference still passes existing published semantics", async () => {
    approval = null;
    certifiedReference = {
      certificationId: "cert-1",
      wordpressObjectId: WORDPRESS_OBJECT_ID,
      evidenceFingerprint: "fingerprint",
    };
    certifiedTargets = [{ stateCode: "TX" }];
    initializedTargets = [
      createTarget("published", "TX"),
      createTarget("queued", "CA"),
    ];

    const response = await execute();

    expect(response.status).toBe(200);
  });

  test("30-target campaign with 29 queued and one exact draft reference passes integrity", async () => {
    const additionalStateCodes = Array.from({ length: 29 }, (_, index) => `S${String(index + 1).padStart(2, "0")}`);
    campaign = createStateCampaign({ stateCodes: ["TX", ...additionalStateCodes] });
    initializedTargets = [
      createTarget("draft_ready", "TX", null, { jobId: JOB_ID, wordpressObjectId: WORDPRESS_OBJECT_ID }),
      ...additionalStateCodes.map((code) => createTarget("queued", code)),
    ];

    const response = await execute();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.activation.totalTargets).toBe(30);
    expect(body.activation.queued).toBe(29);
  });

  test("target count mismatch is rejected", async () => {
    initializedTargets = [
      createTarget("draft_ready", "TX"),
    ];

    const response = await execute();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Campaign target queue failed activation integrity checks.");
  });

  test("city_service behavior remains unchanged", async () => {
    campaign = createCityCampaign();
    governedReferenceApproval = {
      campaignId: CAMPAIGN_ID,
      stateCode: "TX",
      citySlug: "dallas",
      receiptSha256: "governed-receipt",
      referenceRevision: 1,
      imageCandidateId: "city-ref",
      imageCandidateRevision: 1,
    };
    approval = null;
    certifiedReference = null;
    initializedTargets = [
      createTarget("reference_complete", "TX", "dallas"),
    ];

    const response = await execute({ referenceStateCode: "TX", referenceCitySlug: "dallas" });

    expect(response.status).toBe(200);
  });

  test("draft reference never becomes published as an activation side effect", async () => {
    initializedTargets = [
      createTarget("draft_ready", "TX"),
      createTarget("queued", "CA"),
    ];

    const response = await execute();
    const body = await response.json();
    const txTarget = (body.targets as any[]).find((target) => target.stateCode === "TX");

    expect(response.status).toBe(200);
    expect(txTarget.status).toBe("draft_ready");
  });
});
