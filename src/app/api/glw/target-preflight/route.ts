import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  buildLocalGlwGenerationPreview,
  createDefaultGlwGenerationInput,
  type GlwPageType,
} from "@/modules/glw/page-generation";
import { readGlwTargetPreflight, resolveGlwTargetMutationAvailability } from "@/modules/glw/target-preflight";

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });

  const siteRecord = getSiteById(request.nextUrl.searchParams.get("siteId") ?? "");
  const productRecord = getProductById(request.nextUrl.searchParams.get("productId") ?? "");
  if (!siteRecord || !productRecord || siteRecord.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Configured site and product are required." }, { status: 400 });
  }
  const site = adaptSiteForGeneration(siteRecord);
  const product = adaptProductForGeneration(productRecord, site.siteId);
  const pageType = (request.nextUrl.searchParams.get("pageType") ?? "city_service") as GlwPageType;
  const stateCode = request.nextUrl.searchParams.get("stateCode") ?? "";
  const citySlug = request.nextUrl.searchParams.get("citySlug") ?? "";
  const form = {
    ...createDefaultGlwGenerationInput(site, product, pageType, stateCode, citySlug),
    slug: request.nextUrl.searchParams.get("slug") ?? "",
  };
  const preview = buildLocalGlwGenerationPreview({ form, sites: [site], products: [product] });
  if (!preview.request) return NextResponse.json({ issues: preview.validation.issues }, { status: 400 });

  const wordpressApiBaseUrl =
    siteRecord.integrations.wordpressApiBaseUrl?.trim() ?? "";

  const wordpressCredentialReference =
    siteRecord.integrations.wordpressCredentialReference?.trim() ?? "";

  const credential = resolveWordPressCredentialReference(
    wordpressCredentialReference,
  );

  const wordpressReadAuthority =
    wordpressApiBaseUrl && credential
      ? createAuthenticatedWordPressReadAuthority({
          configuration: {
            apiBaseUrl: wordpressApiBaseUrl,
            username: credential.username,
            applicationPassword: credential.applicationPassword,
            timeoutMs: 30_000,
          },
        })
      : null;

  const target = await readGlwTargetPreflight({
    request: preview.request,
    wordpressReadAuthority,
    localExecutions: await glwPageExecutionRepository.list(),
  });
  return NextResponse.json({ target, availability: resolveGlwTargetMutationAvailability(target) });
}
