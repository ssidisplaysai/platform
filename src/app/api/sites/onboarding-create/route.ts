import { NextRequest, NextResponse } from "next/server";
import { CompanyRepository } from "@/core/repositories/CompanyRepository";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { recordSiteActivity } from "@/modules/foundation/site-audit";
import { createSite, listSites } from "@/modules/foundation/site-repository";
import { createSiteId } from "@/modules/foundation/site-identity";
import type { NewSiteInput } from "@/modules/foundation/types";
import { runPublicWordPressPreflight } from "@/modules/foundation/wordpress-public-preflight";

function normalizeHost(value: string | null): string | null {
  if (!value) return null;

  try {
    const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(value)
      ? value
      : `https://${value}`;
    return new URL(withScheme).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:create");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as NewSiteInput & {
    onboardingIntent?: "fresh" | "existing";
    wordpressApiOverride?: string | null;
  };
  if (body.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (CompanyRepository.getById(body.organizationId)?.status !== "active") {
    return NextResponse.json({ error: "Organization is not active." }, { status: 422 });
  }

  const onboardingIntent = body.onboardingIntent === "existing" ? "existing" : "fresh";

  if (!body.domain) {
    return NextResponse.json({ error: "Domain is required." }, { status: 400 });
  }

  try {
    const preflight = await runPublicWordPressPreflight({
      domain: body.domain,
      apiBaseUrl: body.wordpressApiOverride,
      intent: onboardingIntent,
    });
    if (!preflight.ready) {
      return NextResponse.json({ error: "Public WordPress preflight did not pass.", preflight }, { status: 422 });
    }

    const expectedSiteId = createSiteId(body.organizationId, body.slug);
    const preflightHost = normalizeHost(preflight.domain);

    const existing = listSites().find((site) => {
      if (site.organizationId !== body.organizationId) {
        return false;
      }

      const siteDomainHost = normalizeHost(site.domain);
      const siteCanonicalHost = normalizeHost(site.canonicalUrl);

      return site.siteId === expectedSiteId
        || (preflightHost !== null && siteDomainHost === preflightHost)
        || (preflightHost !== null && siteCanonicalHost === preflightHost);
    });

    if (existing) {
      if (onboardingIntent === "fresh") {
        return NextResponse.json({
          error: "SITE_ALREADY_EXISTS",
          code: "SITE_ALREADY_EXISTS",
          existingSite: {
            siteId: existing.siteId,
            displayName: existing.displayName,
            domain: existing.domain,
          },
        }, { status: 409 });
      }

      return NextResponse.json({
        site: existing,
        preflight,
        bindingResult: "existing_authority_bound",
        authorityReused: true,
        existingAuthority: {
          siteId: existing.siteId,
          displayName: existing.displayName,
          domain: existing.domain,
        },
        readinessPreview: {
          credentialReferenceConfigured: Boolean(existing.integrations.wordpressCredentialReference),
          wordpressApiConfigured: Boolean(existing.integrations.wordpressApiBaseUrl),
          lifecycleState: existing.lifecycleState,
          enabled: existing.enabled,
          publishingStatus: existing.publishingStatus,
          defaultPublicationStatus: existing.defaultPublicationStatus,
          integrateRebuildRecommendation: existing.onboarding?.status === "connected" || existing.onboarding?.status === "certified"
            ? "INTEGRATE_EXISTING_AUTHORITY"
            : "REVIEW_INTEGRATE_VS_REBUILD",
        },
      }, { status: 200 });
    }

    const result = createSite({
      ...body,
      domain: preflight.domain,
      canonicalUrl: preflight.canonicalUrl,
      enabled: false,
      publicationPolicy: "draft_only",
      defaultPublicationStatus: "draft",
      integrations: {
        ...body.integrations,
        wordpressApiBaseUrl: preflight.apiBaseUrl,
        wordpressCredentialReference: null,
      },
    });
    if (!result.validation.valid) {
      return NextResponse.json({ issues: result.validation.issues }, { status: 400 });
    }
    if (!result.site) return NextResponse.json({ error: "Unable to create site." }, { status: 400 });

    recordSiteActivity({
      siteId: result.site.siteId,
      organizationId: result.site.organizationId,
      type: "site_created",
      actor: "api",
      summary: onboardingIntent === "existing"
        ? "Existing WordPress authority shell created after bounded public preflight."
        : "Fresh WordPress site shell created after public preflight.",
    });

    return NextResponse.json({
      site: result.site,
      preflight,
      bindingResult: onboardingIntent === "existing"
        ? "existing_authority_created"
        : "fresh_site_created",
      authorityReused: false,
      readinessPreview: {
        credentialReferenceConfigured: false,
        wordpressApiConfigured: Boolean(result.site.integrations.wordpressApiBaseUrl),
        lifecycleState: result.site.lifecycleState,
        enabled: result.site.enabled,
        publishingStatus: result.site.publishingStatus,
        defaultPublicationStatus: result.site.defaultPublicationStatus,
        integrateRebuildRecommendation: onboardingIntent === "existing"
          ? "REVIEW_INTEGRATE_VS_REBUILD"
          : "GREENFIELD_FRESH_SITE",
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "WordPress preflight failed." },
      { status: 400 },
    );
  }
}