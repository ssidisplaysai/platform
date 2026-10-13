import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { evaluateGlwGeneratedContentQa } from "@/modules/glw/generated-content-qa";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  buildLocalGlwGenerationPreview,
  type GlwGenerationRequestInput,
  type GlwPageType,
} from "@/modules/glw/page-generation";

const pageTypes = new Set<GlwPageType>(["general_service", "state_service", "city_service"]);

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId")?.trim() ?? "";
  const pageTypeValue = request.nextUrl.searchParams.get("pageType")?.trim() ?? "";
  const stateCode = request.nextUrl.searchParams.get("stateCode")?.trim() ?? "";
  const citySlug = request.nextUrl.searchParams.get("citySlug")?.trim() ?? "";

  if (!jobId) return NextResponse.json({ error: "jobId is required." }, { status: 400 });
  if (!pageTypes.has(pageTypeValue as GlwPageType)) {
    return NextResponse.json({ error: "A valid pageType is required." }, { status: 400 });
  }

  const job = await glwPageExecutionRepository.getById(jobId);
  if (!job) return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
  if (job.organizationId !== scope.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!job.generatedDraft) {
    return NextResponse.json({ error: "The execution has no persisted generated draft to inspect." }, { status: 409 });
  }

  const siteRecord = getSiteById(job.siteId);
  const productRecord = getProductById(job.productId);
  if (!siteRecord || !productRecord) {
    return NextResponse.json({ error: "Configured site and product are required." }, { status: 409 });
  }
  if (siteRecord.organizationId !== scope.organizationId || productRecord.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profileCount = listIntegrationProfiles({ organizationId: siteRecord.organizationId })
    .filter((profile) => profile.assignedSiteIds.includes(siteRecord.siteId)).length;
  const site = adaptSiteForGeneration(siteRecord, profileCount);
  const product = adaptProductForGeneration(productRecord, site.siteId);
  const pageType = pageTypeValue as GlwPageType;

  const form: GlwGenerationRequestInput = {
    siteId: job.siteId,
    productId: job.productId,
    pageType,
    stateCode: pageType === "general_service" ? "" : stateCode,
    citySlug: pageType === "city_service" ? citySlug : "",
    slug: job.slug,
    title: job.title,
    seoTitle: job.seoTitle,
    metaDescription: job.metaDescription,
    publicationIntent: "draft",
    plannedOperation: pageType === "city_service" ? "CREATE_CITY" : pageType === "state_service" ? "CREATE_STATE" : "CREATE_GENERAL",
    wordpressObjectId: null,
  };

  const preview = buildLocalGlwGenerationPreview({ form, sites: [site], products: [product] });
  if (!preview.validation.valid || !preview.request) {
    return NextResponse.json({ error: "The persisted execution target could not be reconstructed for QA.", issues: preview.validation.issues }, { status: 409 });
  }

  const qa = evaluateGlwGeneratedContentQa({
    artifact: job.generatedDraft,
    request: preview.request,
    siteDomain: siteRecord.domain,
    minimumWordCount: 1500,
  });

  return NextResponse.json({
    inspectionMode: "READ_ONLY",
    mutationPerformed: false,
    dispatchPerformed: false,
    job: {
      jobId: job.jobId,
      status: job.status,
      externalExecutionId: job.externalExecutionId,
      wordpressObjectId: job.wordpressObjectId,
      wordpressStatus: job.wordpressStatus,
      slug: job.slug,
    },
    qa,
  });
}
