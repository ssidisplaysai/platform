import { NextRequest } from "next/server";
import { GET as listProfiles, POST as createProfile } from "@/app/api/profiles/route";
import { GET as getProfile, PATCH as patchProfile } from "@/app/api/profiles/[profileId]/route";
import { POST as validateProfilePayload } from "@/app/api/profiles/validate/route";
import { GET as getReadiness } from "@/app/api/profiles/readiness/route";
import { resetIntegrationProfileRepositoryForTests } from "@/modules/foundation/integration-profile-repository";

function request(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

describe("GCP-0002F integration profiles API", () => {
  beforeEach(() => {
    resetIntegrationProfileRepositoryForTests();
  });

  test("profile listing requires read permission", async () => {
    const denied = await listProfiles(request("http://localhost/api/profiles", {
      headers: { "x-gcp-roles": "viewer" },
    }));

    expect(denied.status).toBe(403);

    const allowed = await listProfiles(request("http://localhost/api/profiles", {
      headers: { "x-gcp-roles": "ops_manager" },
    }));

    expect(allowed.status).toBe(200);
  });

  test("create and update enforce authorization", async () => {
    const payload = {
      profileId: "profile-api-created",
      profileType: "workflow",
      organizationId: "led-display-warehouse",
      profileName: "API Created Workflow Profile",
      description: null,
      status: "active",
      enabled: true,
      version: "1.0.0",
      assignedSiteIds: ["site-led-display-warehouse-production"],
      defaultForOrganization: false,
      references: {
        credentialReference: null,
        workflowReference: "workflowref-api-created",
        promptReference: null,
        providerReference: "provider-n8n",
        brandReference: null,
        workflowProfileReference: null,
        wordpressProfileReference: null,
        promptProfileReference: null,
        imageProfileReference: null,
        seoProfileReference: null,
        analyticsProfileReference: null,
        titleStrategyReference: null,
        metaStrategyReference: null,
        schemaReference: null,
        openGraphReference: null,
        slugStrategyReference: null,
        canonicalPolicyReference: null,
        logoReference: null,
        colorPaletteReference: null,
        typographyReference: null,
        voiceReference: null,
        defaultCtaReference: null,
        assetReference: null,
        baseUrlReference: null,
        authorReference: null,
        categoryReference: null,
        postStatusReference: null,
        featuredImagePolicyReference: null,
        imageInsertionPolicyReference: null,
        yoastPolicyReference: null,
        inputContractReference: "contractref-input",
        outputContractReference: "contractref-output",
        retryPolicyReference: "retrypolicy-standard-3",
        executionTimeoutReference: "timeout-policy-30s",
        environmentReference: "environment-production",
      },
      notes: null,
    };

    const deniedCreate = await createProfile(request("http://localhost/api/profiles", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "viewer" },
      body: JSON.stringify(payload),
    }));

    expect(deniedCreate.status).toBe(403);

    const created = await createProfile(request("http://localhost/api/profiles", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager" },
      body: JSON.stringify(payload),
    }));

    expect(created.status).toBe(201);

    const deniedPatch = await patchProfile(request("http://localhost/api/profiles/profile-api-created", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-gcp-roles": "viewer" },
      body: JSON.stringify({ profileName: "New Name" }),
    }), {
      params: Promise.resolve({ profileId: "profile-api-created" }),
    });

    expect(deniedPatch.status).toBe(403);

    const allowedPatch = await patchProfile(request("http://localhost/api/profiles/profile-api-created", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager" },
      body: JSON.stringify({ profileName: "API Updated Name" }),
    }), {
      params: Promise.resolve({ profileId: "profile-api-created" }),
    });

    expect(allowedPatch.status).toBe(200);
  });

  test("validate endpoint rejects secret-like payloads", async () => {
    const response = await validateProfilePayload(request("http://localhost/api/profiles/validate", {
      method: "POST",
      headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager" },
      body: JSON.stringify({
        profile: {
          profileId: "profile-bad-validate",
          profileType: "wordpress",
          organizationId: "led-display-warehouse",
          profileName: "Bad",
          description: null,
          status: "active",
          enabled: true,
          version: "1.0.0",
          assignedSiteIds: [],
          defaultForOrganization: false,
          references: {
            credentialReference: "password-should-not-pass",
            workflowReference: null,
            promptReference: null,
            providerReference: "provider-wordpress",
            brandReference: null,
            workflowProfileReference: null,
            wordpressProfileReference: null,
            promptProfileReference: null,
            imageProfileReference: null,
            seoProfileReference: null,
            analyticsProfileReference: null,
            titleStrategyReference: null,
            metaStrategyReference: null,
            schemaReference: null,
            openGraphReference: null,
            slugStrategyReference: null,
            canonicalPolicyReference: null,
            logoReference: null,
            colorPaletteReference: null,
            typographyReference: null,
            voiceReference: null,
            defaultCtaReference: null,
            assetReference: null,
            baseUrlReference: "urlref",
            authorReference: null,
            categoryReference: null,
            postStatusReference: null,
            featuredImagePolicyReference: null,
            imageInsertionPolicyReference: null,
            yoastPolicyReference: null,
            inputContractReference: null,
            outputContractReference: null,
            retryPolicyReference: null,
            executionTimeoutReference: null,
            environmentReference: null,
          },
          notes: null,
        },
      }),
    }));

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      profileValidation: { valid: boolean };
      assignmentValidation: { valid: boolean };
    };

    expect(payload.profileValidation.valid).toBe(false);
    expect(payload.assignmentValidation.valid).toBe(true);
  });

  test("readiness endpoint supports single profile and full listing", async () => {
    const one = await getReadiness(request("http://localhost/api/profiles/readiness?profileId=profile-publishing-ledw-default", {
      headers: { "x-gcp-roles": "ops_manager" },
    }));

    expect(one.status).toBe(200);

    const all = await getReadiness(request("http://localhost/api/profiles/readiness", {
      headers: { "x-gcp-roles": "ops_manager" },
    }));

    expect(all.status).toBe(200);
  });

  test("profile detail endpoint returns not found for missing id", async () => {
    const missing = await getProfile(request("http://localhost/api/profiles/profile-missing", {
      headers: { "x-gcp-roles": "ops_manager" },
    }), {
      params: Promise.resolve({ profileId: "profile-missing" }),
    });

    expect(missing.status).toBe(404);
  });
});
