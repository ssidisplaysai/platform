import { FOUNDATION_SITE_FIXTURES } from "./site-fixtures";
import type {
  NewSiteInput,
  SiteConfiguration,
  SiteValidationResult,
  UpdateSiteInput,
} from "./types";
import { validateNewSiteInput, validateUpdateSiteInput } from "./site-validation";

const siteStore = new Map<string, SiteConfiguration>(
  FOUNDATION_SITE_FIXTURES.map((site) => [site.siteId, site]),
);

function nowIso(): string {
  return new Date().toISOString();
}

function createSiteId(organizationId: string, slug: string): string {
  return `site-${organizationId}-${slug}`;
}

export function listSites(): readonly SiteConfiguration[] {
  return Array.from(siteStore.values());
}

export function getSiteById(siteId: string): SiteConfiguration | null {
  return siteStore.get(siteId) ?? null;
}

export function createSite(input: NewSiteInput): {
  validation: SiteValidationResult;
  site: SiteConfiguration | null;
} {
  const validation = validateNewSiteInput(input);
  if (!validation.valid) {
    return { validation, site: null };
  }

  const siteId = createSiteId(input.organizationId, input.slug);
  if (siteStore.has(siteId)) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "slug", message: "Site slug already exists for this organization." }],
      },
      site: null,
    };
  }

  const timestamp = nowIso();
  const site: SiteConfiguration = {
    siteId,
    organizationId: input.organizationId,
    siteName: input.siteName,
    displayName: input.displayName,
    slug: input.slug,
    domain: input.domain,
    canonicalUrl: input.canonicalUrl,
    environment: input.environment,
    lifecycleState: "draft",
    enabled: false,
    healthStatus: "unknown",
    publishingStatus: "disabled",
    defaultContentType: input.defaultContentType,
    defaultPublicationStatus: input.defaultPublicationStatus,
    defaultAuthorReference: input.defaultAuthorReference,
    defaultCategoryReferences: input.defaultCategoryReferences,
    integrations: input.integrations,
    profiles: input.profiles,
    lastConnectionTest: null,
    lastSuccessfulPublication: null,
    lastHealthCheck: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    notes: input.notes,
  };

  siteStore.set(siteId, site);
  return { validation, site };
}

export function updateSite(
  siteId: string,
  patch: UpdateSiteInput,
): {
  validation: SiteValidationResult;
  site: SiteConfiguration | null;
} {
  const existing = siteStore.get(siteId);
  if (!existing) {
    return {
      validation: {
        valid: false,
        issues: [{ field: "siteId", message: "Site was not found." }],
      },
      site: null,
    };
  }

  const validation = validateUpdateSiteInput(existing, patch);
  if (!validation.valid) {
    return { validation, site: null };
  }

  const updated: SiteConfiguration = {
    ...existing,
    ...patch,
    integrations: {
      ...existing.integrations,
      ...(patch.integrations ?? {}),
    },
    profiles: {
      ...existing.profiles,
      ...(patch.profiles ?? {}),
    },
    updatedAt: nowIso(),
  };

  siteStore.set(siteId, updated);
  return { validation, site: updated };
}
