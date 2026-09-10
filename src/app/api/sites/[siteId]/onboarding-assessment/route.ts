import { NextRequest, NextResponse } from "next/server";
import { CompanyRepository } from "@/core/repositories/CompanyRepository";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { authorizeRequest, hasOrganizationScope, isRecordInScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { inspectFreshWordPressSite, readWordPressOperatorCapabilities } from "@/modules/foundation/fresh-site-onboarding";
import { resolvePermissions } from "@/modules/foundation/permissions";
import { getSiteById, updateSite } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { createWordPressEstateReader } from "@/modules/foundation/wordpress-estate-reader";
import type { SiteConfiguration } from "@/modules/foundation/types";

type RouteContext = { params: Promise<{ siteId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = authorizeRequest(request, "sites:test_connection");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { siteId } = await context.params;
  const existing = getSiteById(siteId);
  if (!existing || !isRecordInScope({ recordOrganizationId: existing.organizationId, recordSiteId: existing.siteId, scope })) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }
  const reference = existing.integrations.wordpressCredentialReference;
  const credential = reference ? resolveWordPressCredentialReference(reference) : null;
  if (!credential || !existing.integrations.wordpressApiBaseUrl) {
    return NextResponse.json({ error: "WordPress credentials are not configured." }, { status: 409 });
  }

  const authority = createAuthenticatedWordPressReadAuthority({
    configuration: {
      apiBaseUrl: existing.integrations.wordpressApiBaseUrl,
      username: credential.username,
      applicationPassword: credential.applicationPassword,
    },
  });
  const identity = await authority.getJson({ path: "/users/me", query: new URLSearchParams({ context: "edit" }) });
  if (!identity.ok) {
    return NextResponse.json({ error: identity.reason === "AUTH_FAILURE" ? "WordPress credentials were rejected." : "Authenticated WordPress identity could not be read." }, { status: 422 });
  }
  const capabilities = readWordPressOperatorCapabilities(identity.body);
  if (!capabilities.editPosts || !capabilities.uploadFiles) {
    return NextResponse.json({
      error: "The WordPress identity needs edit_posts and upload_files capabilities.",
      capabilities,
    }, { status: 422 });
  }

  const checkedAt = new Date().toISOString();
  const connectedSite = {
    ...existing,
    lifecycleState: "configuring",
    healthStatus: "healthy",
    lastConnectionTest: checkedAt,
    onboarding: {
      status: "connected",
      wordpressConnectionVerifiedAt: checkedAt,
      certificationStatus: "not_started",
      certificationPageId: null,
      certificationUrl: null,
      certifiedAt: null,
    },
  } satisfies SiteConfiguration;
  const assessment = await inspectFreshWordPressSite({
    site: connectedSite,
    reader: createWordPressEstateReader({ authority }),
    organizationActive: CompanyRepository.getById(existing.organizationId)?.status === "active",
    permissions: resolvePermissions(auth.roles),
    capabilities,
  });
  if (assessment.requirements.some((requirement) =>
    ["wordpress_rest", "authenticated_reads", "media"].includes(requirement.key)
    && requirement.status === "MISSING")) {
    return NextResponse.json({ error: "Authenticated WordPress inventory did not pass.", assessment }, { status: 422 });
  }
  const updated = updateSite(existing.siteId, {
    lifecycleState: connectedSite.lifecycleState,
    healthStatus: connectedSite.healthStatus,
    lastConnectionTest: connectedSite.lastConnectionTest,
    onboarding: connectedSite.onboarding,
  }).site;
  if (!updated) return NextResponse.json({ error: "Site connection state could not be saved." }, { status: 500 });

  return NextResponse.json({
    authenticated: true,
    identity: { verified: true },
    writeCapability: { ...capabilities, testedByMutation: false },
    yoast: "optional_not_detected",
    site: updated,
    assessment,
  });
}