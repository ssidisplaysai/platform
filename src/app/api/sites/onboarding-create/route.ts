import { NextRequest, NextResponse } from "next/server";
import { CompanyRepository } from "@/core/repositories/CompanyRepository";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { recordSiteActivity } from "@/modules/foundation/site-audit";
import { createSite } from "@/modules/foundation/site-repository";
import type { NewSiteInput } from "@/modules/foundation/types";
import { runPublicWordPressPreflight } from "@/modules/foundation/wordpress-public-preflight";

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
  if (body.onboardingIntent !== "fresh") {
    return NextResponse.json({ error: "Existing-site onboarding is not certified in V1." }, { status: 422 });
  }
  if (!body.domain) {
    return NextResponse.json({ error: "Domain is required." }, { status: 400 });
  }

  try {
    const preflight = await runPublicWordPressPreflight({
      domain: body.domain,
      apiBaseUrl: body.wordpressApiOverride,
      intent: "fresh",
    });
    if (!preflight.ready) {
      return NextResponse.json({ error: "Public WordPress preflight did not pass.", preflight }, { status: 422 });
    }

    const result = createSite({
      ...body,
      domain: preflight.domain,
      canonicalUrl: preflight.canonicalUrl,
      enabled: false,
      publicationPolicy: "draft_only",
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
      summary: "Fresh WordPress site shell created after public preflight.",
    });
    return NextResponse.json({ site: result.site, preflight }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Fresh-site preflight failed." },
      { status: 400 },
    );
  }
}