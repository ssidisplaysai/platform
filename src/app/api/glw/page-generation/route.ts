import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";

import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { attachGenesisWordPressFeaturedImage } from "@/modules/foundation/wordpress-media-writer";
import { repairGlwStateContentToMinimum } from "@/modules/glw/content-repair-service";
import { evaluateGlwGeneratedContentQa } from "@/modules/glw/generated-content-qa";
import { enrichGlwGeneratedContentForSeo } from "@/modules/glw/seo-enrichment";
import { generateGenesisFeaturedImageWithCampaignReferences } from "@/modules/glw/reference-aware-image-service";
import { resolveGlwWordPressTargetHierarchy } from "@/modules/glw/wordpress-target-hierarchy";
import {
  createGlwN8nMcpDispatcher,
  createGlwN8nMcpExecutionReader,
  getGlwN8nMcpConfigurationStatus,
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

  let enrichment = enrichGlwGeneratedContentForSeo({
    artifact: input.job.generatedDraft,
    request: input.request,
  });

  let qa = evaluateGlwGeneratedContentQa({
    artifact: enrichment.artifact,
    request: input.request,
    siteDomain: input.siteRecord.domain,
    minimumWordCount: GLW_GENERATION_MINIMUM_WORD_COUNT,
    additionalAllowedDomains: enrichment.approvedExternalDomains,
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

    enrichment = enrichGlwGeneratedContentForSeo({
      artifact: repair.artifact,
      request: input.request,
    });

    qa = evaluateGlwGeneratedContentQa({
      artifact: enrichment.artifact,
      request: input.request,
      siteDomain: input.siteRecord.domain,
      minimumWordCount: GLW_GENERATION_MINIMUM_WORD_COUNT,
      additionalAllowedDomains: enrichment.approvedExternalDomains,
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
    seo: enrichment.metadata,
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
    qaChecks: qa.checks,
    qaFailureReasons: {},
    wordCount: qa.wordCount,
    featuredImagePresent: false,
    errorCode: null,
    errorMessage: null,
    updatedAt: timestamp,
    completedAt: null,
  });

  const imageResult = await generateGenesisFeaturedImageWithCampaignReferences({
    prompt: buildGenesisImagePrompt({
      request: input.request,
      siteName: input.siteRecord.displayName,
    }),
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

  const location = [input.request.cityName, input.request.stateName]
    .filter(Boolean)
    .join(", ");
  const mediaResult = await attachGenesisWordPressFeaturedImage({
    site: input.siteRecord,
    wordpressObjectId: result.wordpressObjectId,
    canonicalSlug: input.request.canonicalPath,
    contentHtml: enrichment.artifact.contentHtml,
    image: imageResult.image,
    title: `${input.request.productTopic}${location ? ` in ${location}` : ""}`,
    altText: `${input.request.productTopic}${location ? ` in ${location}` : ""}`,
    description: `Commercial hero image for ${input.request.productTopic}${location ? ` in ${location}` : ""} on ${input.siteRecord.displayName}.`,
  });

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
    qaChecks: qa.checks,
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
    site: siteRecord,
    wordpressReadAuthority,
  });

  if (!targetPreflight.ok) {
    return {
      error: targetPreflight.errorMessage,
      code: targetPreflight.errorCode,
      status: 409,
    } as const;
  }

  const mutationAvailability = resolveGlwTargetMutationAvailability({
    request,
    targetPreflight,
  });

  if (!mutationAvailability.allowed) {
    return {
      error: mutationAvailability.reason,
      code: mutationAvailability.code,
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
  if (!hasOrganizationScope(scope)) {
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

  const preview = await resolveAuthorizedPreview(body.form, scope.organizationId);
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
    const job = await service.dispatch(preview.request);
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
          code: error.code,
          publicationPerformed: false,
        },
        { status: error.status },
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
