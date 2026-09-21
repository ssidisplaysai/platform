jest.mock("server-only", () => ({}));

import { NextRequest } from "next/server";

const CAMPAIGN_ID = "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-digital-sphere-unpublished-states-v2";
const ORG_ID = "led-display-warehouse";
const SITE_ID = "site-led-display-warehouse-production";
const PRODUCT_ID = "prod-outdoor-digital-sphere";
const JOB_ID = "a1371f29-8952-438d-9ed4-583da68d4fbb";
const WORDPRESS_OBJECT_ID = "20240";

let campaign: any;
let approval: any;
let governedReferenceApproval: any;
let referenceJob: any;
let claimShouldThrow = true;

function createStateCampaign(overrides: Record<string, unknown> = {}) {
  return {
    campaignId: CAMPAIGN_ID,
    organizationId: ORG_ID,
    siteId: SITE_ID,
    productId: PRODUCT_ID,
    pageType: "state_service",
    publicationPolicy: "draft_only",
    status: "draft",
    stateCodes: ["TX"],
    imageRequired: true,
    ...overrides,
  };
}

function createCityCampaign(overrides: Record<string, unknown> = {}) {
  return {
    ...createStateCampaign({
      pageType: "city_service",
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
  initializeGlwCampaignTargets: () => [],
  initializeGlwCityCampaignTargets: () => [],
  listGlwCampaignTargets: () => [],
  previewGlwCampaignTargets: () => [],
}));

jest.mock("@/modules/glw/campaign-certified-state-targets", () => ({
  listGlwCertifiedStateCampaignTargets: () => [],
  resolveGlwCertifiedStateActivationReference: () => null,
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
  applyRecoveredCityCampaignTargetAdoption: () => [],
  planRecoveredCityCampaignTargetAdoption: () => [],
}));

jest.mock("@/modules/glw/campaign-geography", () => ({
  GLW_CAMPAIGN_US_STATES: [{ code: "TX", name: "Texas" }],
}));

jest.mock("@/modules/glw/page-execution-repository", () => ({
  glwPageExecutionRepository: {
    getById: async () => referenceJob,
    list: async () => [],
  },
}));

jest.mock("@/modules/glw/reference-state-selection-repository", () => ({
  getGlwReferenceStateSelection: () => ({ stateCode: "TX" }),
}));

jest.mock("@/modules/glw/campaign-launch-authority", () => ({
  recordGlwCampaignLaunchActivated: () => null,
  requireGlwCampaignLaunchReservationOwnership: () => null,
}));

jest.mock("@/modules/glw/campaign-activation-authorization", () => ({
  claimGlwCampaignActivationGrant: () => {
    if (claimShouldThrow) {
      throw new Error("GRANT_REQUIRED");
    }
    return {
      grant: { grantId: "grant-1" },
      claimId: "claim-1",
    };
  },
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

function postRequest(body: Record<string, unknown> = {}) {
  return new NextRequest(`http://localhost/api/glw/campaigns/${CAMPAIGN_ID}/activate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("GLW activation QA status contract alignment", () => {
  beforeEach(() => {
    campaign = createStateCampaign();
    approval = createApproval();
    governedReferenceApproval = null;
    referenceJob = createReferenceJob();
    claimShouldThrow = true;
  });

  test("passes the activation reference gate when COMPLETE job uses qaStatus PASSED and exact draft identity", async () => {
    referenceJob = createReferenceJob({ qaStatus: "PASSED" });

    const response = await POST(postRequest(), { params: Promise.resolve({ campaignId: CAMPAIGN_ID }) });
    const body = await responseBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe("CAMPAIGN_ACTIVATION_AUTHORIZATION_REQUIRED");
    expect(body.error).not.toBe("Approved reference no longer satisfies campaign activation gates.");
  });

  test("blocks failed QA status", async () => {
    referenceJob = createReferenceJob({ qaStatus: "FAILED_QA" });

    const response = await POST(postRequest(), { params: Promise.resolve({ campaignId: CAMPAIGN_ID }) });
    const body = await responseBody(response);

    expect(response.status).toBe(409);
    expect(body.error).toBe("Approved reference no longer satisfies campaign activation gates.");
  });

  test("blocks incomplete or pending QA status", async () => {
    referenceJob = createReferenceJob({ qaStatus: "PENDING" });

    const response = await POST(postRequest(), { params: Promise.resolve({ campaignId: CAMPAIGN_ID }) });
    const body = await responseBody(response);

    expect(response.status).toBe(409);
    expect(body.error).toBe("Approved reference no longer satisfies campaign activation gates.");
  });

  test("blocks when WordPress object identity mismatches", async () => {
    referenceJob = createReferenceJob({ wordpressObjectId: "99999" });

    const response = await POST(postRequest(), { params: Promise.resolve({ campaignId: CAMPAIGN_ID }) });
    const body = await responseBody(response);

    expect(response.status).toBe(409);
    expect(body.error).toBe("Approved reference no longer satisfies campaign activation gates.");
  });

  test("blocks when featured image is missing for image-required campaign", async () => {
    referenceJob = createReferenceJob({ featuredImagePresent: false });

    const response = await POST(postRequest(), { params: Promise.resolve({ campaignId: CAMPAIGN_ID }) });
    const body = await responseBody(response);

    expect(response.status).toBe(409);
    expect(body.error).toBe("Approved reference no longer satisfies campaign activation gates.");
  });

  test("preserves city-service governed approval behavior", async () => {
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
    referenceJob = createReferenceJob({ qaStatus: "FAILED_QA" });

    const response = await POST(
      postRequest({ referenceStateCode: "TX", referenceCitySlug: "dallas" }),
      { params: Promise.resolve({ campaignId: CAMPAIGN_ID }) },
    );
    const body = await responseBody(response);

    expect(response.status).toBe(403);
    expect(body.code).toBe("CAMPAIGN_ACTIVATION_AUTHORIZATION_REQUIRED");
    expect(body.error).not.toBe("Approved reference no longer satisfies campaign activation gates.");
  });
});
