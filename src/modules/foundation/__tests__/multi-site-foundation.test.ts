import { createFoundationContext, getSitesForOrganization } from "@/modules/foundation/context";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { evaluatePublishingGuard } from "@/modules/foundation/site-publishing-guard";
import { evaluateSiteReadiness } from "@/modules/foundation/site-readiness";
import { getSiteById, listSites } from "@/modules/foundation/site-repository";
import { filterSites } from "@/modules/foundation/site-selectors";
import { resolveSiteAccess } from "@/modules/foundation/site-access";
import { validateNewSiteInput, validateUpdateSiteInput } from "@/modules/foundation/site-validation";
import type { NewSiteInput, SiteConfiguration } from "@/modules/foundation/types";

function createValidPublishableSite(): SiteConfiguration {
  return {
    siteId: "site-valid-publishable",
    organizationId: "led-display-warehouse",
    siteName: "Valid Publishable Site",
    displayName: "Valid Publishable Site",
    slug: "valid-publishable-site",
    domain: "valid.example.com",
    canonicalUrl: "https://valid.example.com",
    environment: "production",
    lifecycleState: "active",
    enabled: true,
    healthStatus: "healthy",
    publishingStatus: "ready",
    defaultContentType: "article",
    defaultPublicationStatus: "draft",
    defaultAuthorReference: "author-main",
    defaultCategoryReferences: ["cat-main"],
    integrations: {
      wordpressApiBaseUrl: "https://valid.example.com/wp-json/wp/v2",
      wordpressCredentialReference: "CREDENTIAL_REFERENCE",
      workflowReference: "workflow-reference",
    },
    profiles: {
      promptProfileReference: "prompt-profile",
      imageProfileReference: "image-profile",
      seoProfileReference: "seo-profile",
      brandProfileReference: "brand-profile",
      analyticsProfileReference: "analytics-profile",
    },
    lastConnectionTest: null,
    lastSuccessfulPublication: null,
    lastHealthCheck: null,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
    notes: null,
  };
}

function createValidNewSiteInput(): NewSiteInput {
  return {
    organizationId: "led-display-warehouse",
    siteName: "New Site",
    displayName: "New Site",
    slug: "new-site",
    domain: "new.example.com",
    canonicalUrl: "https://new.example.com",
    environment: "test",
    enabled: false,
    defaultContentType: "article",
    defaultPublicationStatus: "draft",
    defaultAuthorReference: null,
    defaultCategoryReferences: [],
    integrations: {
      wordpressApiBaseUrl: null,
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
  };
}

describe("GCP-0002C multi-site foundation", () => {
  test("LED Display Warehouse site appears", () => {
    const sites = listSites();
    expect(
      sites.some((site) => site.siteName === "LED Display Warehouse"),
    ).toBe(true);
  });

  test("Secondary Test Site appears and is disabled", () => {
    const site = getSiteById("site-secondary-test-placeholder");

    expect(site).toBeDefined();
    expect(site?.siteName).toBe("Secondary Test Site");
    expect(site?.enabled).toBe(false);
    expect(site?.publishingStatus).toBe("disabled");
  });

  test("Secondary Test Site is not publishable", () => {
    const site = getSiteById("site-secondary-test-placeholder");
    const permissions = resolvePermissions(["ops_manager"]);

    expect(site).toBeDefined();

    const guard = evaluatePublishingGuard({
      site: site as SiteConfiguration,
      permissions,
      organizationActive: true,
    });

    expect(guard.allowed).toBe(false);
    expect(guard.reasons.length).toBeGreaterThan(0);
  });

  test("missing domain blocks readiness", () => {
    const site = createValidPublishableSite();
    site.domain = null;

    const readiness = evaluateSiteReadiness({
      site,
      organizationActive: true,
      requiredPermission: "sites:manage_integrations",
      permissions: resolvePermissions(["ops_manager"]),
      intent: "publish",
      requireWorkflowReference: true,
    });

    expect(readiness.ready).toBe(false);
    expect(
      readiness.blockingReasons.some((reason) => reason.includes("Domain is not configured")),
    ).toBe(true);
  });

  test("missing credential reference blocks readiness", () => {
    const site = createValidPublishableSite();
    site.integrations.wordpressCredentialReference = null;

    const readiness = evaluateSiteReadiness({
      site,
      organizationActive: true,
      requiredPermission: "sites:manage_integrations",
      permissions: resolvePermissions(["ops_manager"]),
      intent: "publish",
      requireWorkflowReference: true,
    });

    expect(readiness.ready).toBe(false);
    expect(
      readiness.blockingReasons.some((reason) => reason.includes("credential reference is missing")),
    ).toBe(true);
  });

  test("missing workflow reference blocks readiness when required", () => {
    const site = createValidPublishableSite();
    site.integrations.workflowReference = null;

    const readiness = evaluateSiteReadiness({
      site,
      organizationActive: true,
      requiredPermission: "sites:manage_integrations",
      permissions: resolvePermissions(["ops_manager"]),
      intent: "publish",
      requireWorkflowReference: true,
    });

    expect(readiness.ready).toBe(false);
    expect(
      readiness.blockingReasons.some((reason) => reason.includes("Workflow reference is required")),
    ).toBe(true);
  });

  test("unhealthy site blocks readiness", () => {
    const site = createValidPublishableSite();
    site.healthStatus = "unhealthy";

    const readiness = evaluateSiteReadiness({
      site,
      organizationActive: true,
      requiredPermission: "sites:manage_integrations",
      permissions: resolvePermissions(["ops_manager"]),
      intent: "publish",
      requireWorkflowReference: true,
    });

    expect(readiness.ready).toBe(false);
    expect(
      readiness.blockingReasons.some((reason) => reason.includes("Health state is unhealthy")),
    ).toBe(true);
  });

  test("disabled site blocks readiness", () => {
    const site = createValidPublishableSite();
    site.enabled = false;

    const readiness = evaluateSiteReadiness({
      site,
      organizationActive: true,
      requiredPermission: "sites:manage_integrations",
      permissions: resolvePermissions(["ops_manager"]),
      intent: "publish",
      requireWorkflowReference: true,
    });

    expect(readiness.ready).toBe(false);
    expect(
      readiness.blockingReasons.some((reason) => reason.includes("Site is disabled")),
    ).toBe(true);
  });

  test("active configured site can reach ready state", () => {
    const site = createValidPublishableSite();

    const readiness = evaluateSiteReadiness({
      site,
      organizationActive: true,
      requiredPermission: "sites:manage_integrations",
      permissions: resolvePermissions(["ops_manager"]),
      intent: "publish",
      requireWorkflowReference: true,
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.blockingReasons).toHaveLength(0);
  });

  test("site list filtering supports environment and status", () => {
    const filtered = filterSites(listSites(), {
      organizationId: "led-display-warehouse",
      environment: "test",
      lifecycleState: "draft",
      healthStatus: "not_configured",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.siteId).toBe("site-secondary-test-placeholder");
  });

  test("site search supports name and domain", () => {
    const byName = filterSites(listSites(), { query: "secondary" });
    const byDomain = filterSites(listSites(), { query: "leddisplaywarehouse" });

    expect(byName.some((site) => site.siteId === "site-secondary-test-placeholder")).toBe(true);
    expect(byDomain.some((site) => site.siteId === "site-led-display-warehouse-production")).toBe(true);
  });

  test("site selection supports organization scoping", () => {
    const context = createFoundationContext();
    const sites = getSitesForOrganization(context.sites, "led-display-warehouse");

    expect(sites.length).toBeGreaterThan(0);
    expect(sites.every((site) => site.organizationId === "led-display-warehouse")).toBe(true);
  });

  test("invalid site handling returns not_found", () => {
    const access = resolveSiteAccess({
      site: null,
      permissions: resolvePermissions(["ops_manager"]),
    });

    expect(access.status).toBe("not_found");
  });

  test("unauthorized site handling returns unauthorized", () => {
    const site = getSiteById("site-led-display-warehouse-production");

    const access = resolveSiteAccess({
      site,
      permissions: resolvePermissions(["viewer"]),
    });

    expect(access.status).toBe("unauthorized");
  });

  test("site create validation rejects malformed slug", () => {
    const input = createValidNewSiteInput();
    input.slug = "Bad Slug";

    const validation = validateNewSiteInput(input);

    expect(validation.valid).toBe(false);
    expect(validation.issues.some((issue) => issue.field === "slug")).toBe(true);
  });

  test("site update validation prevents organization reassignment", () => {
    const existing = createValidPublishableSite();
    const validation = validateUpdateSiteInput(existing, {
      organizationId: "stoner",
    });

    expect(validation.valid).toBe(false);
    expect(
      validation.issues.some((issue) => issue.field === "organizationId"),
    ).toBe(true);
  });

  test("publishing guard rejects missing workflow reference", () => {
    const site = createValidPublishableSite();
    site.integrations.workflowReference = null;

    const guard = evaluatePublishingGuard({
      site,
      permissions: resolvePermissions(["ops_manager"]),
      organizationActive: true,
    });

    expect(guard.allowed).toBe(false);
    expect(
      guard.reasons.some((reason) => reason.includes("Workflow reference is required")),
    ).toBe(true);
  });

  test("public site contract excludes raw secret fields", () => {
    const site = createValidPublishableSite();
    const json = JSON.stringify(site).toLowerCase();

    expect(json.includes("password")).toBe(false);
    expect(json.includes("apikey")).toBe(false);
    expect(json.includes("secretvalue")).toBe(false);
  });
});
