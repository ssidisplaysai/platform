jest.mock("server-only", () => ({}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/sites/[siteId]/onboarding-auto-profiles/route";
import {
  authenticateOperator,
  createScryptPasswordHash,
  OPERATOR_CSRF_COOKIE,
  OPERATOR_CSRF_HEADER,
  OPERATOR_SESSION_COOKIE,
} from "@/modules/foundation/operator-session";
import { createSite, getSiteById, resetSiteRepositoryForTests, updateSite } from "@/modules/foundation/site-repository";
import { listIntegrationProfiles, resetIntegrationProfileRepositoryForTests } from "@/modules/foundation/integration-profile-repository";
import { addCreativeInput, ensureSiteIntelligenceWorkspace } from "@/modules/foundation/site-intelligence-repository";

const organizationId = "pageengines";
const siteId = "site-pageengines-pageengines-staging";
const otherSiteId = "site-led-display-warehouse-shared";
const baseUrl = `https://genesi-runti-8hl31agbz6rt-743202067.us-west-2.elb.amazonaws.com/api/sites/${encodeURIComponent(siteId)}/onboarding-auto-profiles`;

function request(input: {
  cookie: string;
  csrfToken: string;
  body: Record<string, unknown>;
  origin?: string;
  organization?: string;
  scopedSiteId?: string;
}) {
  return new NextRequest(baseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: input.cookie,
      origin: input.origin ?? "https://staging.glwplatform.com",
      [OPERATOR_CSRF_HEADER]: input.csrfToken,
      "x-gcp-roles": "ops_manager",
      "x-gcp-organization-id": input.organization ?? organizationId,
      "x-gcp-site-id": input.scopedSiteId ?? siteId,
    },
    body: JSON.stringify(input.body),
  });
}

describe("onboarding auto profiles route", () => {
  const originalEnvironment = { ...process.env };
  let persistenceRoot = "";
  let cookie = "";
  let csrfToken = "";
  let approvedLogoAssetId = "";
  let otherOrgAssetId = "";

  beforeEach(async () => {
    persistenceRoot = mkdtempSync(join(tmpdir(), "genesis-auto-profiles-"));
    const passwordHash = await createScryptPasswordHash("correct horse battery staple", Buffer.alloc(16, 31));
    process.env = {
      ...originalEnvironment,
      NODE_ENV: "production",
      GENESIS_ENVIRONMENT: "staging",
      GCP_FOUNDATION_PERSISTENCE_DIR: persistenceRoot,
      GENESIS_OPERATOR_SESSION_PERSISTENCE_DIR: persistenceRoot,
      GENESIS_OPERATOR_DIRECTORY_JSON: JSON.stringify([{
        principalId: "operator-001",
        email: "rk@ssidisplays.com",
        roles: ["platform_admin"],
        passwordHash,
        enabled: true,
      }]),
    };
    resetSiteRepositoryForTests();
    resetIntegrationProfileRepositoryForTests();
    if (!getSiteById(siteId)) {
      createSite({
        organizationId,
        siteName: "PageEngines Staging",
        displayName: "PageEngines",
        slug: "pageengines-staging",
        domain: "staging.pageengines.com",
        canonicalUrl: "https://staging.pageengines.com",
        primaryAddress: null,
        environment: "staging",
        enabled: false,
        publicationPolicy: "draft_only",
        defaultContentType: "article",
        defaultPublicationStatus: "draft",
        defaultAuthorReference: null,
        defaultCategoryReferences: [],
        integrations: {
          wordpressApiBaseUrl: "https://staging.pageengines.com/wp-json/wp/v2",
          wordpressCredentialReference: "credref-wp-pageengines",
          workflowReference: null,
        },
        profiles: {
          promptProfileReference: null,
          imageProfileReference: null,
          seoProfileReference: null,
          brandProfileReference: null,
          analyticsProfileReference: null,
        },
        notes: null,
      });
    }
    if (!getSiteById(otherSiteId)) {
      createSite({
        organizationId: "led-display-warehouse",
        siteName: "LDW Shared",
        displayName: "LDW Shared",
        slug: "ldw-shared",
        domain: "shared.leddisplaywarehouse.com",
        canonicalUrl: "https://shared.leddisplaywarehouse.com",
        primaryAddress: null,
        environment: "staging",
        enabled: false,
        publicationPolicy: "draft_only",
        defaultContentType: "article",
        defaultPublicationStatus: "draft",
        defaultAuthorReference: null,
        defaultCategoryReferences: [],
        integrations: {
          wordpressApiBaseUrl: "https://shared.leddisplaywarehouse.com/wp-json/wp/v2",
          wordpressCredentialReference: null,
          workflowReference: null,
        },
        profiles: {
          promptProfileReference: null,
          imageProfileReference: null,
          seoProfileReference: null,
          brandProfileReference: null,
          analyticsProfileReference: null,
        },
        notes: null,
      });
    }
    updateSite(siteId, {
      profiles: {
        promptProfileReference: null,
        imageProfileReference: null,
        seoProfileReference: null,
        brandProfileReference: null,
        analyticsProfileReference: null,
      },
      integrations: {
        workflowReference: null,
      },
    });
    const workspace = ensureSiteIntelligenceWorkspace({
      organizationId,
      siteId,
      publicBrandIdentity: "PageEngines",
      actor: "site-owner",
    });
    approvedLogoAssetId = "site-asset-pageengines-logo-approved";
    addCreativeInput({
      organizationId,
      siteId,
      expectedRevision: workspace.revision,
      actor: "site-owner",
      reason: "Adding owner-approved logo candidate for auto-prepare tests.",
      creativeInput: {
        inputId: "creative-input-logo-approved",
        kind: "IMAGE",
        reference: "asset:pageengines-logo",
        sentiment: "LIKE",
        classification: "OWNER_SUPPLIED_REFERENCE",
        notes: "Owner approved for brand identity and website use.",
        suppliedBy: "site-owner",
        suppliedAt: "2026-10-16T00:00:00.000Z",
        binaryAsset: {
          assetId: approvedLogoAssetId,
          sha256: "sha256-pageengines-logo-approved",
          originalFileName: "PageEngines_Neon_Growth_Logo.png",
          mediaType: "image/png",
          sizeBytes: 104857,
          uploadedAt: "2026-10-16T00:00:00.000Z",
          uploadedBy: "site-owner",
          organizationId,
          siteId,
          providerReference: "site-intelligence-asset:site-asset-pageengines-logo-approved",
          provenance: {
            sourceType: "OWNER_UPLOAD",
            sourceReference: "upload://pageengines/logo.png",
            recordedAt: "2026-10-16T00:00:00.000Z",
          },
          classification: "OWNER_SUPPLIED_REFERENCE",
          note: "Owner approved for brand identity and website use.",
        },
      },
    });
    const otherWorkspace = ensureSiteIntelligenceWorkspace({
      organizationId: "led-display-warehouse",
      siteId: otherSiteId,
      publicBrandIdentity: "LDW Shared",
      actor: "site-owner",
    });
    otherOrgAssetId = "site-asset-ledw-logo";
    addCreativeInput({
      organizationId: "led-display-warehouse",
      siteId: otherSiteId,
      expectedRevision: otherWorkspace.revision,
      actor: "site-owner",
      reason: "Adding out-of-scope logo for cross-org rejection test.",
      creativeInput: {
        inputId: "creative-input-logo-other-org",
        kind: "IMAGE",
        reference: "asset:ledw-logo",
        sentiment: "LIKE",
        classification: "OWNER_SUPPLIED_REFERENCE",
        notes: "Out-of-scope logo.",
        suppliedBy: "site-owner",
        suppliedAt: "2026-10-16T00:00:00.000Z",
        binaryAsset: {
          assetId: otherOrgAssetId,
          sha256: "sha256-ledw-logo",
          originalFileName: "LDW_Logo.png",
          mediaType: "image/png",
          sizeBytes: 20480,
          uploadedAt: "2026-10-16T00:00:00.000Z",
          uploadedBy: "site-owner",
          organizationId: "led-display-warehouse",
          siteId: otherSiteId,
          providerReference: "site-intelligence-asset:site-asset-ledw-logo",
          provenance: {
            sourceType: "OWNER_UPLOAD",
            sourceReference: "upload://ldw/logo.png",
            recordedAt: "2026-10-16T00:00:00.000Z",
          },
          classification: "OWNER_SUPPLIED_REFERENCE",
          note: "Out-of-scope logo.",
        },
      },
    });
    const session = await authenticateOperator({
      identity: "rk@ssidisplays.com",
      password: "correct horse battery staple",
      environment: process.env,
    });
    cookie = `${OPERATOR_SESSION_COOKIE}=${session.token}; ${OPERATOR_CSRF_COOKIE}=${session.csrfToken}`;
    csrfToken = session.csrfToken;
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
    rmSync(persistenceRoot, { recursive: true, force: true });
  });

  test("returns preview and requires explicit approval before persistence", async () => {
    const previewResponse = await POST(request({
      cookie,
      csrfToken,
      body: { action: "PREVIEW" },
    }), { params: Promise.resolve({ siteId }) });
    expect(previewResponse.status).toBe(200);
    const previewPayload = await previewResponse.json() as {
      preview: { fingerprint: string; proposals: Array<{ mode: string }> };
      confirmationRequired: string;
    };
    expect(previewPayload.preview.proposals).toHaveLength(4);
    expect(previewPayload.confirmationRequired).toBe("APPROVE_AUTO_PREPARE_PROFILES");

    const deniedApply = await POST(request({
      cookie,
      csrfToken,
      body: {
        action: "APPLY",
        fingerprint: previewPayload.preview.fingerprint,
      },
    }), { params: Promise.resolve({ siteId }) });
    expect(deniedApply.status).toBe(400);
    expect((await deniedApply.json()).error).toBe("AUTO_PREPARE_APPROVAL_REQUIRED");
  });

  test("applies profile preparation idempotently within scoped organization and leaves workflow pending", async () => {
    const previewResponse = await POST(request({
      cookie,
      csrfToken,
      body: { action: "PREVIEW" },
    }), { params: Promise.resolve({ siteId }) });
    const previewPayload = await previewResponse.json() as {
      preview: { fingerprint: string; proposals: Array<{ profileType: string }> };
      confirmationRequired: string;
    };

    const applyResponse = await POST(request({
      cookie,
      csrfToken,
      body: {
        action: "APPLY",
        confirm: previewPayload.confirmationRequired,
        fingerprint: previewPayload.preview.fingerprint,
        overrides: [{
          profileType: "brand",
          selectedLogoAssetId: approvedLogoAssetId,
          logoApprovalConfirmed: true,
        }],
      },
    }), { params: Promise.resolve({ siteId }) });
    expect(applyResponse.status).toBe(200);
    const applyPayload = await applyResponse.json() as {
      selectedProfiles: {
        seoProfileReference: string;
        promptProfileReference: string;
        imageProfileReference: string;
        brandProfileReference: string;
        workflowReference: string;
      };
      workflowPending: boolean;
    };
    expect(applyPayload.selectedProfiles.brandProfileReference).toContain("profile-brand-pageengines-pageengines-brand-profile");
    expect(applyPayload.selectedProfiles.workflowReference).toBe("");
    expect(applyPayload.workflowPending).toBe(true);

    const firstProfileCount = listIntegrationProfiles({ organizationId }).length;

    const secondPreview = await POST(request({
      cookie,
      csrfToken,
      body: { action: "PREVIEW" },
    }), { params: Promise.resolve({ siteId }) });
    const secondPayload = await secondPreview.json() as { preview: { fingerprint: string } };

    const secondApply = await POST(request({
      cookie,
      csrfToken,
      body: {
        action: "APPLY",
        confirm: "APPROVE_AUTO_PREPARE_PROFILES",
        fingerprint: secondPayload.preview.fingerprint,
        overrides: [{
          profileType: "brand",
          selectedLogoAssetId: approvedLogoAssetId,
          logoApprovalConfirmed: true,
        }],
      },
    }), { params: Promise.resolve({ siteId }) });
    expect(secondApply.status).toBe(200);
    expect(listIntegrationProfiles({ organizationId }).length).toBe(firstProfileCount);
    const updatedSite = getSiteById(siteId);
    expect(updatedSite?.profiles.brandProfileReference).toContain("profile-brand-pageengines-pageengines-brand-profile");
    expect(updatedSite?.integrations.workflowReference).toBeNull();
  });

  test("blocks apply when required logo authority is unresolved", async () => {
    const previewResponse = await POST(request({
      cookie,
      csrfToken,
      body: { action: "PREVIEW" },
    }), { params: Promise.resolve({ siteId }) });
    const previewPayload = await previewResponse.json() as {
      preview: { fingerprint: string };
      confirmationRequired: string;
    };
    const applyResponse = await POST(request({
      cookie,
      csrfToken,
      body: {
        action: "APPLY",
        confirm: previewPayload.confirmationRequired,
        fingerprint: previewPayload.preview.fingerprint,
      },
    }), { params: Promise.resolve({ siteId }) });
    expect(applyResponse.status).toBe(422);
    expect((await applyResponse.json()).error).toBe("AUTO_PREPARE_PROPOSAL_BLOCKED");
  });

  test("requires explicit owner approval confirmation for selected logo asset", async () => {
    const previewResponse = await POST(request({
      cookie,
      csrfToken,
      body: { action: "PREVIEW" },
    }), { params: Promise.resolve({ siteId }) });
    const previewPayload = await previewResponse.json() as {
      preview: { fingerprint: string };
      confirmationRequired: string;
    };
    const applyResponse = await POST(request({
      cookie,
      csrfToken,
      body: {
        action: "APPLY",
        confirm: previewPayload.confirmationRequired,
        fingerprint: previewPayload.preview.fingerprint,
        overrides: [{
          profileType: "brand",
          selectedLogoAssetId: approvedLogoAssetId,
          logoApprovalConfirmed: false,
        }],
      },
    }), { params: Promise.resolve({ siteId }) });
    expect(applyResponse.status).toBe(400);
    expect((await applyResponse.json()).error).toBe("AUTO_PREPARE_LOGO_APPROVAL_REQUIRED");
  });

  test("rejects missing and out-of-scope logo assets", async () => {
    const previewResponse = await POST(request({
      cookie,
      csrfToken,
      body: { action: "PREVIEW" },
    }), { params: Promise.resolve({ siteId }) });
    const previewPayload = await previewResponse.json() as {
      preview: { fingerprint: string };
      confirmationRequired: string;
    };

    const invalidAssetResponse = await POST(request({
      cookie,
      csrfToken,
      body: {
        action: "APPLY",
        confirm: previewPayload.confirmationRequired,
        fingerprint: previewPayload.preview.fingerprint,
        overrides: [{
          profileType: "brand",
          selectedLogoAssetId: "site-asset-missing-logo",
          logoApprovalConfirmed: true,
        }],
      },
    }), { params: Promise.resolve({ siteId }) });
    expect(invalidAssetResponse.status).toBe(422);
    expect((await invalidAssetResponse.json()).error).toBe("AUTO_PREPARE_LOGO_ASSET_INVALID");

    const outOfScopeResponse = await POST(request({
      cookie,
      csrfToken,
      body: {
        action: "APPLY",
        confirm: previewPayload.confirmationRequired,
        fingerprint: previewPayload.preview.fingerprint,
        overrides: [{
          profileType: "brand",
          selectedLogoAssetId: otherOrgAssetId,
          logoApprovalConfirmed: true,
        }],
      },
    }), { params: Promise.resolve({ siteId }) });
    expect(outOfScopeResponse.status).toBe(422);
    expect((await outOfScopeResponse.json()).error).toBe("AUTO_PREPARE_LOGO_ASSET_INVALID");
  });

  test("rejects cross-organization scope access", async () => {
    const response = await POST(request({
      cookie,
      csrfToken,
      organization: "led-display-warehouse",
      body: { action: "PREVIEW" },
    }), { params: Promise.resolve({ siteId }) });
    expect(response.status).toBe(404);
  });
});
