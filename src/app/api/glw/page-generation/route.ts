import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { loadProjectorEnclosureSeoAuthority, type ProjectorEnclosureKeywordOwner, type ProjectorEnclosureSeoSelection } from "@/modules/foundation/projectorenclosure-seo-authority";
import { getProductById, listProducts } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";

import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { attachGenesisWordPressExistingFeaturedImage, attachGenesisWordPressFeaturedImage } from "@/modules/foundation/wordpress-media-writer";
import { renderSiteStudioAuthorityLinks, resolveSiteStudioProductAuthority } from "@/modules/foundation/site-studio-product-authority";
import { repairGlwStateContentToMinimum } from "@/modules/glw/content-repair-service";
import { evaluateGlwGeneratedContentQa } from "@/modules/glw/generated-content-qa";
import { enrichGlwGeneratedContentForSeo } from "@/modules/glw/seo-enrichment";
import { generateGenesisFeaturedImageWithCampaignReferences } from "@/modules/glw/reference-aware-image-service";
import { resolveGlwWordPressTargetHierarchy } from "@/modules/glw/wordpress-target-hierarchy";
import {
  createGlwN8nMcpDispatcher,
  createGlwN8nMcpExecutionReader,
} from "@/modules/glw/n8n-mcp-adapter";
import {
  createGlwDraftExecutionService,
  GlwDraftOnlyExecutionError,
  type GlwPageExecutionRecord,
} from "@/modules/glw/page-execution";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  buildLocalGlwGenerationPreview,

  type GlwGenerationRequest,
  type GlwGenerationRequestInput,
} from "@/modules/glw/page-generation";
import { readGlwTargetPreflight, resolveGlwTargetMutationAvailability } from "@/modules/glw/target-preflight";

const service = createGlwDraftExecutionService({
  repository: glwPageExecutionRepository,
  dispatcher: createGlwN8nMcpDispatcher(),
  executionTransport: "N8N_MCP",
});
const executionReader = createGlwN8nMcpExecutionReader();
const GLW_GENERATION_MINIMUM_WORD_COUNT = 1500;

function isTerminal(status: string): boolean {
  return status === "COMPLETE" || status === "FAILED";
}

async function recoverExecution(job: GlwPageExecutionRecord): Promise<GlwPageExecutionRecord> {
  if (!job.externalExecutionId) return job;
  return service.pollToTerminal(job.jobId, executionReader);
}

function buildGenesisImagePrompt(input: {
  request: GlwGenerationRequest;
  siteName: string;
}): string {
  const location = [input.request.cityName, input.request.stateName]
    .filter(Boolean)
    .join(", ");
  return [
    `Photorealistic commercial installation featuring ${input.request.productTopic}.`,
    location ? `The setting should feel appropriate for a commercial project in ${location}.` : "Use a premium commercial architectural environment.",
    `Create the image for ${input.siteName} as a polished website hero visual.`,
    input.request.imageDirection?.trim() || "",
    "Show the product clearly and realistically with professional lighting, believable materials, correct scale, and useful negative space.",
  ].join(" ");
}

function prepareGeneratedContentForSite(input: {
  artifact: NonNullable<GlwPageExecutionRecord["generatedDraft"]>;
  request: GlwGenerationRequest;
  siteRecord: NonNullable<ReturnType<typeof getSiteById>>;
  keywordOwners: readonly ProjectorEnclosureKeywordOwner[];
}) {
  if (input.siteRecord.domain === "leddisplaywarehouse.com") {
    return {
      ...enrichGlwGeneratedContentForSeo({
      artifact: input.artifact,
      request: input.request,
      }),
      seoAuthority: null,
    };
  }

  const seoAuthority: ProjectorEnclosureSeoSelection | null = input.siteRecord.domain === "projectorenclosure.com"
    && input.request.projectorEnclosureSeoAuthority
    ? loadProjectorEnclosureSeoAuthority().select({
        ...input.request.projectorEnclosureSeoAuthority,
        existingOwners: input.keywordOwners,
        geographyValidated: Boolean(
          input.request.wordpressObjectId
          && input.request.plannedOperation.startsWith("UPDATE_")
          && (input.request.pageType === "city_service" || input.request.pageType === "state_service")
        ),
        verifiedSecondaryKeywords: [],
        verifiedCompatibilityKeywords: [],
        verifiedElectricalKeywords: [],
        canonicalUrl: input.siteRecord.canonicalUrl
          ? new URL(input.request.canonicalPath.replace(/^\/+/, ""), `${input.siteRecord.canonicalUrl.replace(/\/$/, "")}/`).toString()
          : input.request.canonicalPath,
        pageType: input.request.pageType,
        city: input.request.cityName,
        state: input.request.stateName,
      })
    : null;

  return {
    artifact: input.artifact,
    metadata: {
      focusKeyphrase: seoAuthority?.primaryKeyword?.keyword || input.artifact.focusKeyphrase?.trim() || input.request.productTopic,
      seoTitle: input.artifact.seoTitle?.trim() || input.request.seoTitle,
      metaDescription: input.artifact.metaDescription?.trim() || input.request.metaDescription,
    },
    inserted: {
      productAuthorityLink: false,
      relatedProductLinks: 0,
      corporateLink: false,
      outboundAuthorityLink: false,
      localAuthorityLink: false,
      weatherAuthorityLink: false,
    },
    approvedExternalDomains: [] as string[],
    seoAuthority,
  };
}

async function finalizeContentReadyExecution(input: {
  job: GlwPageExecutionRecord;
  request: GlwGenerationRequest;
  siteRecord: NonNullable<ReturnType<typeof getSiteById>>;
}): Promise<GlwPageExecutionRecord> {
  const recoverableQaFailure =
    input.job.status === "FAILED"
    && (input.job.errorCode === "GENERATED_CONTENT_QA_FAILED"
      || input.job.errorCode?.startsWith("CONTENT_REPAIR_") === true)
    && Boolean(input.job.generatedDraft);

  if (input.job.status !== "CONTENT_READY" && !recoverableQaFailure) return input.job;
  if (!input.job.generatedDraft) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      errorCode: "GENERATED_DRAFT_MISSING",
      errorMessage: "n8n completed without a generated draft artifact for Genesis WordPress mutation.",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const productRecord = getProductById(input.request.productId);
  if (!productRecord) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      errorCode: "PRODUCT_AUTHORITY_MISSING",
      errorMessage: "Genesis could not resolve the canonical product authority for this job.",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const productAuthority = await resolveSiteStudioProductAuthority({
    site: input.siteRecord,
    product: productRecord,
    products: listProducts(),
  });
  const keywordOwners: ProjectorEnclosureKeywordOwner[] = input.request.projectorEnclosureSeoAuthority
    ? (await glwPageExecutionRepository.list())
        .filter((record) => record.siteId === input.request.siteId && record.wordpressUrl && record.focusKeyphrase)
        .map((record) => {
          const authorityEvidence = record.qaChecks?.seoAuthority;
          const pageTarget = authorityEvidence && typeof authorityEvidence === "object" && !Array.isArray(authorityEvidence)
            && typeof (authorityEvidence as { pageTarget?: unknown }).pageTarget === "string"
            ? String((authorityEvidence as { pageTarget: string }).pageTarget)
            : "General Projector Enclosures";
          return {
            canonicalUrl: record.wordpressUrl!,
            primaryKeyword: record.focusKeyphrase!,
            pageTarget,
          };
        })
    : [];

  let enrichment = prepareGeneratedContentForSite({
    artifact: input.job.generatedDraft,
    request: input.request,
    siteRecord: input.siteRecord,
    keywordOwners,
  });
  if (enrichment.seoAuthority && !enrichment.seoAuthority.eligible) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      errorCode: "SEO_AUTHORITY_INELIGIBLE",
      errorMessage: enrichment.seoAuthority.selectionRationale,
      qaStatus: "FAILED",
      qaChecks: { seoAuthority: enrichment.seoAuthority },
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  const renderedAuthority = renderSiteStudioAuthorityLinks({
    html: enrichment.artifact.contentHtml,
    authority: productAuthority,
  });
  enrichment = {
    ...enrichment,
    artifact: {
      ...enrichment.artifact,
      contentHtml: renderedAuthority.html,
    },
  };

  let qa = evaluateGlwGeneratedContentQa({
    artifact: enrichment.artifact,
    request: input.request,
    siteDomain: input.siteRecord.domain,
    minimumWordCount: GLW_GENERATION_MINIMUM_WORD_COUNT,
    additionalAllowedDomains: enrichment.approvedExternalDomains,
    requiredCanonicalProductLink: productAuthority.canonicalProduct
      ? { url: productAuthority.canonicalProduct.url, anchorText: productAuthority.canonicalProduct.anchorText }
      : null,
  });

  const eligibleForBoundedRepair =
    !qa.ok
    && recoverableQaFailure
    && input.request.pageType === "state_service"
    && qa.wordCount < GLW_GENERATION_MINIMUM_WORD_COUNT;

  if (eligibleForBoundedRepair) {
    const repair = await repairGlwStateContentToMinimum({
      artifact: enrichment.artifact,
      request: input.request,
      minimumWordCount: GLW_GENERATION_MINIMUM_WORD_COUNT,
      currentWordCount: qa.wordCount,
    });

    if (!repair.ok) {
      const timestamp = new Date().toISOString();
      return glwPageExecutionRepository.update(input.job.jobId, {
        status: "FAILED",
        generatedDraft: enrichment.artifact,
        errorCode: `CONTENT_REPAIR_${repair.state.toUpperCase()}`,
        errorMessage: repair.message,
        qaStatus: "FAILED",
        qaChecks: qa.checks,
        qaFailureReasons: qa.failureReasons,
        wordCount: qa.wordCount,
        updatedAt: timestamp,
        completedAt: timestamp,
      });
    }

    enrichment = prepareGeneratedContentForSite({
      artifact: repair.artifact,
      request: input.request,
      siteRecord: input.siteRecord,
      keywordOwners,
    });

    qa = evaluateGlwGeneratedContentQa({
      artifact: enrichment.artifact,
      request: input.request,
      siteDomain: input.siteRecord.domain,
      minimumWordCount: GLW_GENERATION_MINIMUM_WORD_COUNT,
      additionalAllowedDomains: enrichment.approvedExternalDomains,
      requiredCanonicalProductLink: productAuthority.canonicalProduct
        ? { url: productAuthority.canonicalProduct.url, anchorText: productAuthority.canonicalProduct.anchorText }
        : null,
    });
  }

  if (!qa.ok) {
    const timestamp = new Date().toISOString();
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: "GENERATED_CONTENT_QA_FAILED",
      errorMessage: Object.values(qa.failureReasons).join(" ") || "Generated content failed Genesis QA.",
      qaStatus: "FAILED",
      qaChecks: qa.checks,
      qaFailureReasons: qa.failureReasons,
      wordCount: qa.wordCount,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }

  const targetHierarchy = await resolveGlwWordPressTargetHierarchy({
    request: input.request,
    site: input.siteRecord,
  });

  if (!targetHierarchy.ok) {
    const timestamp = new Date().toISOString();

    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: targetHierarchy.errorCode,
      errorMessage: targetHierarchy.errorMessage,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }

  const persistedDraftId = input.job.wordpressStatus === "draft"
    ? input.job.wordpressObjectId
    : null;

  const hierarchyObjectId =
    input.request.pageType === "state_service"
      ? targetHierarchy.wordpressObjectId
      : null;

  const requestedOperation = input.request.plannedOperation.startsWith("CREATE_")
    ? "CREATE"
    : "UPDATE";

  const operation =
    persistedDraftId || hierarchyObjectId
      ? "UPDATE"
      : requestedOperation;

  const updateObjectId =
    persistedDraftId
    ?? hierarchyObjectId
    ?? input.request.wordpressObjectId;

  if (operation === "UPDATE" && !updateObjectId) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: "UPDATE_AUTHORITY_REQUIRED",
      errorMessage: "Genesis requires an exact WordPress object ID before a draft update.",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const parentId = targetHierarchy.parentId;

  const artifact = {
    title: enrichment.artifact.title,
    contentHtml: enrichment.artifact.contentHtml,
    slug: enrichment.artifact.slug,
    excerpt: enrichment.artifact.excerpt,
    parentId,
    seo: input.siteRecord.domain === "leddisplaywarehouse.com"
      ? enrichment.metadata
      : null,
  };
  const result = operation === "CREATE"
    ? await writeGenesisWordPressDraft({ operation: "CREATE", site: input.siteRecord, artifact })
    : await writeGenesisWordPressDraft({ operation: "UPDATE", site: input.siteRecord, wordpressObjectId: updateObjectId!, artifact });

  const timestamp = new Date().toISOString();
  if (!result.ok) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      generatedDraft: enrichment.artifact,
      errorCode: `WORDPRESS_${result.state.toUpperCase()}`,
      errorMessage: result.message,
      qaStatus: "PASSED",
      qaChecks: qa.checks,
      qaFailureReasons: {},
      wordCount: qa.wordCount,
      updatedAt: timestamp,
      completedAt: timestamp,
    });
  }

  const draftJob = await glwPageExecutionRepository.update(input.job.jobId, {
    status: "CONTENT_READY",
    generatedDraft: enrichment.artifact,
    wordpressObjectId: result.wordpressObjectId,
    wordpressUrl: result.wordpressUrl,
    wordpressStatus: result.wordpressStatus,
    disposition: result.operation === "CREATE" ? "CREATED" : "UPDATED",
    qaStatus: "PASSED",
    qaChecks: {
      ...qa.checks,
      productAuthority: {
        lookupResult: productAuthority.lookupResult,
        productId: productAuthority.productId,
        canonicalProductReference: productAuthority.canonicalProduct?.url ?? null,
        exactProductMatch: true,
      },
      internalLinks: {
        candidatesSupplied: productAuthority.internalLinkCandidates.length,
        linksSelected: productAuthority.selectedInternalLinks.length,
        linksRendered: renderedAuthority.rendered.length,
        destinations: renderedAuthority.rendered.map((link) => ({ url: link.url, anchorText: link.anchorText, destinationValid: link.destinationValid })),
      },
      externalReferences: {
        candidatesSupplied: productAuthority.externalReferenceCandidates.length,
        linksSelected: productAuthority.selectedExternalReferences.length,
        linksRendered: 0,
        domainAuthorityPassed: true,
      },
      mediaAuthority: {
        candidatesSupplied: productAuthority.mediaCandidates.length,
        selectedMediaId: productAuthority.selectedMedia?.wordpressMediaId ?? null,
        selectedProvenance: productAuthority.selectedMedia?.provenance ?? "GENERATED_MEDIA",
        generatedMediaReason: productAuthority.generatedMediaReason,
      },
      seoAuthority: enrichment.seoAuthority
        ? {
            eligible: enrichment.seoAuthority.eligible,
            primaryKeyword: enrichment.seoAuthority.primaryKeyword?.keyword ?? null,
            secondaryKeywords: enrichment.seoAuthority.secondaryKeywords.map((keyword) => keyword.keyword),
            cluster: "cluster" in (enrichment.seoAuthority.primaryKeyword ?? {})
              ? (enrichment.seoAuthority.primaryKeyword as { cluster: string }).cluster
              : null,
            intent: enrichment.seoAuthority.intent,
            buyerStage: enrichment.seoAuthority.buyerStage,
            pageTarget: enrichment.seoAuthority.pageTarget,
            recommendedRole: enrichment.seoAuthority.recommendedRole,
            geographicVariant: enrichment.seoAuthority.geographicVariant?.keyword ?? null,
            relatedPageTargets: enrichment.seoAuthority.relatedPageTargets,
            selectionRationale: enrichment.seoAuthority.selectionRationale,
            cannibalization: enrichment.seoAuthority.cannibalization,
            provenance: enrichment.seoAuthority.provenance,
          }
        : null,
    },
    qaFailureReasons: {},
    wordCount: qa.wordCount,
    featuredImagePresent: false,
    errorCode: null,
    errorMessage: null,
    updatedAt: timestamp,
    completedAt: null,
  });

  const location = [input.request.cityName, input.request.stateName]
    .filter(Boolean)
    .join(", ");
  let mediaResult;
  if (productAuthority.selectedMedia) {
    mediaResult = await attachGenesisWordPressExistingFeaturedImage({
      site: input.siteRecord,
      wordpressObjectId: result.wordpressObjectId,
      contentHtml: enrichment.artifact.contentHtml,
      wordpressMediaId: productAuthority.selectedMedia.wordpressMediaId,
      expectedMediaUrl: productAuthority.selectedMedia.url,
      altText: productAuthority.selectedMedia.altText,
    });
  } else {
    const imageResult = await generateGenesisFeaturedImageWithCampaignReferences({
      prompt: buildGenesisImagePrompt({ request: input.request, siteName: input.siteRecord.displayName }),
      siteName: input.siteRecord.displayName,
      productTopic: input.request.productTopic,
      campaignId: input.request.campaignId ?? null,
    });
    if (!imageResult.ok) {
      return glwPageExecutionRepository.update(draftJob.jobId, {
        status: "CONTENT_READY",
        errorCode: `IMAGE_${imageResult.state.toUpperCase()}`,
        errorMessage: imageResult.message,
        featuredImagePresent: false,
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    }
    mediaResult = await attachGenesisWordPressFeaturedImage({
      site: input.siteRecord,
      wordpressObjectId: result.wordpressObjectId,
      canonicalSlug: input.request.canonicalPath,
      contentHtml: enrichment.artifact.contentHtml,
      image: imageResult.image,
      title: `${input.request.productTopic}${location ? ` in ${location}` : ""}`,
      altText: `${input.request.productTopic}${location ? ` in ${location}` : ""}`,
      description: `Commercial hero image for ${input.request.productTopic}${location ? ` in ${location}` : ""} on ${input.siteRecord.displayName}.`,
    });
  }

  if (!mediaResult.ok) {
    return glwPageExecutionRepository.update(draftJob.jobId, {
      status: "CONTENT_READY",
      errorCode: `WORDPRESS_MEDIA_${mediaResult.state.toUpperCase()}`,
      errorMessage: mediaResult.message,
      featuredImagePresent: false,
      updatedAt: new Date().toISOString(),
      completedAt: null,
    });
  }

  const completedAt = new Date().toISOString();
  return glwPageExecutionRepository.update(draftJob.jobId, {
    status: "COMPLETE",
    wordpressObjectId: result.wordpressObjectId,
    wordpressUrl: result.wordpressUrl,
    wordpressStatus: result.wordpressStatus,
    disposition: result.operation === "CREATE" ? "CREATED" : "UPDATED",
    qaStatus: "COMPLETE",
    qaChecks: draftJob.qaChecks,
    qaFailureReasons: {},
    wordCount: qa.wordCount,
    featuredImagePresent: true,
    errorCode: null,
    errorMessage: null,
    updatedAt: completedAt,
    completedAt,
  });
}

async function resolveAuthorizedPreview(form: GlwGenerationRequestInput, organizationId: string) {
  const siteRecord = getSiteById(form.siteId);
  const productRecord = getProductById(form.productId);
  if (!siteRecord || !productRecord) return { error: "Configured site and product are required.", status: 400 } as const;
  if (siteRecord.organizationId !== organizationId) return { error: "Forbidden", status: 403 } as const;

  const profileCount = listIntegrationProfiles({ organizationId: siteRecord.organizationId })
    .filter((profile) => profile.assignedSiteIds.includes(siteRecord.siteId)).length;
  const site = adaptSiteForGeneration(siteRecord, profileCount);
  const product = adaptProductForGeneration(productRecord, site.siteId);
  const preview = buildLocalGlwGenerationPreview({ form, sites: [site], products: [product] });
  if (!preview.validation.valid || !preview.request) return { issues: preview.validation.issues, status: 400 } as const;
  if (preview.request.publicationIntent !== "draft") return { error: "Public publish is blocked. Select draft intent." , status: 403 } as const;
  return { siteRecord, request: preview.request } as const;
}

async function verifyMutationAuthority(request: GlwGenerationRequest, siteRecord: NonNullable<ReturnType<typeof getSiteById>>) {
  const apiBaseUrl = siteRecord.integrations.wordpressApiBaseUrl?.trim() ?? "";
  const credentialReference = siteRecord.integrations.wordpressCredentialReference?.trim() ?? "";
  const credential = resolveWordPressCredentialReference(credentialReference);

  if (!apiBaseUrl || !credential) {
    return {
      error: "Authenticated WordPress read authority is required before generation or continuation.",
      code: "WORDPRESS_READ_AUTHORITY_REQUIRED",
      status: 503,
    } as const;
  }

  let wordpressReadAuthority;
  try {
    wordpressReadAuthority = createAuthenticatedWordPressReadAuthority({
      configuration: {
        apiBaseUrl,
        username: credential.username,
        applicationPassword: credential.applicationPassword,
        timeoutMs: 30_000,
      },
    });
  } catch {
    return {
      error: "Authenticated WordPress read authority could not be initialized.",
      code: "WORDPRESS_READ_AUTHORITY_INVALID",
      status: 503,
    } as const;
  }

  const targetPreflight = await readGlwTargetPreflight({
    request,
    wordpressReadAuthority,
    localExecutions: await glwPageExecutionRepository.list(),
  });

  const mutationAvailability = resolveGlwTargetMutationAvailability(
    targetPreflight,
    request.pageType,
  );
  const createRequested = request.plannedOperation.startsWith("CREATE_");
  const exactUpdateId = request.wordpressObjectId
    && mutationAvailability.wordpressObjectId === request.wordpressObjectId;
  const allowed = createRequested
    ? mutationAvailability.createAvailable
    : mutationAvailability.updateAvailable && exactUpdateId;

  if (!allowed || mutationAvailability.plannedOperation !== request.plannedOperation) {
    return {
      error: mutationAvailability.message,
      code: "WORDPRESS_MUTATION_NOT_AUTHORIZED",
      status: 409,
    } as const;
  }

  return { targetPreflight, mutationAvailability } as const;
}

function matchesExactContinuationTarget(input: {
  job: GlwPageExecutionRecord;
  request: GlwGenerationRequest;
}): boolean {
  return input.job.siteId === input.request.siteId
    && input.job.productId === input.request.productId
    && input.job.slug === input.request.canonicalPath.replace(/^\//, "").replace(/\/$/, "")
    && input.job.publicationIntent === "draft";
}

function isExactRecoverableContentFailure(job: GlwPageExecutionRecord): boolean {
  return job.status === "FAILED"
    && (job.errorCode === "GENERATED_CONTENT_QA_FAILED"
      || job.errorCode?.startsWith("CONTENT_REPAIR_") === true)
    && Boolean(job.generatedDraft);
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  const organizationId = scope.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    form?: GlwGenerationRequestInput;
    action?: string;
    jobId?: string;
  } | null;

  if (!body?.form) {
    return NextResponse.json({ error: "Generation form is required." }, { status: 400 });
  }

  const preview = await resolveAuthorizedPreview(body.form, organizationId);
  if ("error" in preview || "issues" in preview) {
    return NextResponse.json(preview, { status: preview.status });
  }

  const action = body.action?.trim() ?? "generate";

  if (action === "continue") {
    const jobId = body.jobId?.trim() ?? "";
    if (!jobId) return NextResponse.json({ error: "Exact GLW jobId is required for continuation." }, { status: 400 });

    const currentJob = await glwPageExecutionRepository.getById(jobId);
    if (!currentJob) return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
    if (currentJob.organizationId !== scope.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!matchesExactContinuationTarget({ job: currentJob, request: preview.request })) {
      return NextResponse.json({ error: "Continuation request does not match the exact persisted GLW target." }, { status: 409 });
    }

    const exactRecoverableContentFailure = isExactRecoverableContentFailure(currentJob);

    if (!exactRecoverableContentFailure) {
      const authority = await verifyMutationAuthority(preview.request, preview.siteRecord);
      if ("error" in authority) {
        return NextResponse.json(authority, { status: authority.status });
      }
    }

    let refreshed = currentJob;
    if (!isTerminal(currentJob.status) && currentJob.status !== "CONTENT_READY") {
      refreshed = await recoverExecution(currentJob);
    }

    const finalized = await finalizeContentReadyExecution({
      job: refreshed,
      request: preview.request,
      siteRecord: preview.siteRecord,
    });

    return NextResponse.json({
      ok: finalized.status === "COMPLETE",
      job: finalized,
      publicationPerformed: false,
    });
  }

  if (action !== "generate") {
    return NextResponse.json({ error: "Unsupported generation action." }, { status: 400 });
  }

  const authority = await verifyMutationAuthority(preview.request, preview.siteRecord);
  if ("error" in authority) {
    return NextResponse.json(authority, { status: authority.status });
  }

  try {
    const job = await service.execute(preview.request);
    return NextResponse.json({
      ok: true,
      job,
      publicationPerformed: false,
    });
  } catch (error) {
    if (error instanceof GlwDraftOnlyExecutionError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "DRAFT_ONLY_EXECUTION_REJECTED",
          publicationPerformed: false,
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "GLW generation dispatch failed.",
        publicationPerformed: false,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const jobId = request.nextUrl.searchParams.get("jobId")?.trim() ?? "";
  if (!jobId) return NextResponse.json({ error: "Exact GLW jobId is required." }, { status: 400 });

  const currentJob = await glwPageExecutionRepository.getById(jobId);
  if (!currentJob) return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
  if (currentJob.organizationId !== scope.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const job = refresh && !isTerminal(currentJob.status)
    ? await recoverExecution(currentJob)
    : currentJob;

  return NextResponse.json({ job });
}
