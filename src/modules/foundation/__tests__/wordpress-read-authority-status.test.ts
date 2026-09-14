import fs from "node:fs";
import path from "node:path";
import type { SiteConfiguration } from "../types";
import {
  inspectSiteWordPressReadAuthority,
  resolveSiteScopedWordPressCredential,
} from "../wordpress-read-authority-status";

const credential = { username: "operator", applicationPassword: "fixture-only" };
function site(overrides: Partial<SiteConfiguration> = {}): SiteConfiguration {
  return {
    siteId: "site-led-display-warehouse-production",
    organizationId: "led-display-warehouse",
    domain: "leddisplaywarehouse.com",
    enabled: true,
    integrations: {
      wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2",
      wordpressCredentialReference: "LED_COMPANY_CREDENTIAL_REFERENCE",
      workflowReference: null,
    },
    ...overrides,
  } as SiteConfiguration;
}
function response(status: number, body: unknown = {}): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

describe("site-scoped WordPress read authority status", () => {
  test("reports READY only after anonymous reachability and authenticated identity read", async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(response(200, [{ id: 1 }]))
      .mockResolvedValueOnce(response(200, { id: 42, username: "operator" }));
    const result = await inspectSiteWordPressReadAuthority(site(), {
      resolver: () => credential,
      fetcher,
    });
    expect(result).toMatchObject({
      siteId: "site-led-display-warehouse-production",
      authorityHealthState: "READY",
      authenticatedIdentityResolved: true,
      authenticatedUserId: 42,
      authenticatedReadHttp: 200,
      anonymousReadHttp: 200,
      credentialConfigured: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("reports CONNECTION_REQUIRED for missing identity or missing credential", async () => {
    const missingIdentity = await inspectSiteWordPressReadAuthority(site({
      integrations: { wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2", wordpressCredentialReference: null, workflowReference: null },
    }), { fetcher: jest.fn() });
    const missingCredential = await inspectSiteWordPressReadAuthority(site(), {
      resolver: () => null,
      fetcher: jest.fn(),
    });
    expect(missingIdentity.authorityHealthState).toBe("CONNECTION_REQUIRED");
    expect(missingCredential.authorityHealthState).toBe("CONNECTION_REQUIRED");
    expect(missingCredential.recoveryAction).toBe("CONNECT_WORDPRESS");
  });

  test("reports REPAIR_REQUIRED for failed authentication", async () => {
    const fetcher = jest.fn()
      .mockResolvedValueOnce(response(200, [{ id: 1 }]))
      .mockResolvedValueOnce(response(401, { code: "rest_cannot_access" }));
    const result = await inspectSiteWordPressReadAuthority(site(), {
      resolver: () => credential,
      fetcher,
    });
    expect(result).toMatchObject({
      authorityHealthState: "REPAIR_REQUIRED",
      authenticatedReadHttp: 401,
      recoveryAction: "REPAIR_WORDPRESS_AUTHORITY",
    });
  });

  test("rejects a durable credential reference owned by another site", () => {
    const resolver = jest.fn(() => credential);
    const result = resolveSiteScopedWordPressCredential(site({
      integrations: { wordpressApiBaseUrl: "https://leddisplaywarehouse.com/wp-json/wp/v2", wordpressCredentialReference: "credref-wp-other-site", workflowReference: null },
    }), resolver, () => "credref-wp-owned-by-this-site");
    expect(result).toBeNull();
    expect(resolver).not.toHaveBeenCalled();
  });
});

const ui = fs.readFileSync(path.join(process.cwd(), "src/modules/glw/GlwCampaignKnowledgePack.tsx"), "utf8").replace(/\s/g, "");
const referenceRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/glw/campaigns/[campaignId]/reference-page/route.ts"), "utf8").replace(/\s/g, "");
const generationRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/glw/page-generation/route.ts"), "utf8").replace(/\s/g, "");
const onboarding = fs.readFileSync(path.join(process.cwd(), "src/modules/foundation/FreshSiteOnboardingFlow.tsx"), "utf8").replace(/\s/g, "");
const onboardingPage = fs.readFileSync(path.join(process.cwd(), "src/app/sites/[siteId]/onboarding/page.tsx"), "utf8").replace(/\s/g, "");

describe("GLW operator authority contract", () => {
  test("distinguishes checking, ready, connection, repair, and blocked states", () => {
    for (const marker of ["CHECKING", "READY", "CONNECTIONREQUIRED", "REPAIRREQUIRED", "BLOCKED", "ConnectWordPress", "RepairWordPressAuthority"])
      expect(ui).toContain(marker);
  });

  test("binds generation to READY plus existing prerequisites", () => {
    expect(ui).toContain("disabled={!instructionsApproved||generationBusy||!wordpressAuthorityReady||!campaign.stateCodes.includes(referenceState)}");
    expect(ui).toContain('wordpressAuthorityState==="READY"');
  });

  test("server rejects missing authority before generation, jobs, leases, or WordPress mutation", () => {
    const postHandler = referenceRoute.slice(referenceRoute.indexOf("exportasyncfunctionPOST"));
    const guard = postHandler.indexOf('wordpressAuthority.authorityHealthState!=="READY"');
    const generation = postHandler.indexOf("/api/glw/page-generation");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(generation);
    for (const marker of ["referencePageGenerated:false", "generationAllowanceConsumed:false", "leaseCreated:false", "generationJobCreated:false", "wordpressMutationPerformed:false"])
      expect(referenceRoute).toContain(marker);
  });

  test("anonymous and role headers cannot bypass exact site authority", () => {
    expect(referenceRoute).toContain('authorizeRequest(request,"sites:update")');
    expect(referenceRoute).toContain("inspectSiteWordPressReadAuthority(siteRecord)");
    expect(generationRoute).toContain("resolveSiteScopedWordPressCredential(siteRecord)");
    expect(generationRoute).toContain("createAuthenticatedWordPressReadAuthority");
  });

  test("read authority does not add publication or dispatch authority", () => {
    expect(referenceRoute).not.toContain("publishGenesisWordPressDraft");
    expect(referenceRoute).not.toContain("leaseGlwCampaignTargets");
    expect(referenceRoute).not.toContain("createGlwN8nMcpDispatcher");
  });

  test("recovery opens the secure site-scoped WordPress credential step", () => {
    expect(onboardingPage).toContain('focusWordPress={focus==="wordpress"}');
    expect(onboarding).toContain("input.focusWordPress?3:4");
    expect(onboarding).toContain("/wordpress-credentials");
    expect(onboarding).toContain('type="password"');
    expect(onboarding).toContain("setApplicationPassword(\"\")");
  });
});
