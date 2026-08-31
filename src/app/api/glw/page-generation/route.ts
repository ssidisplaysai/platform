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
import { resolveOrCreateGenesisWordPressHierarchy } from "@/modules/foundation/wordpress-hierarchy-authority";
import { writeGenesisWordPressDraft } from "@/modules/foundation/wordpress-draft-writer";
import { evaluateGlwGeneratedContentQa } from "@/modules/glw/generated-content-qa";
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
  getGlwState,
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

function isTerminal(status: string): boolean {
  return status === "COMPLETE" || status === "FAILED";
}

async function recoverExecution(job: GlwPageExecutionRecord): Promise<GlwPageExecutionRecord> {
  if (!job.externalExecutionId) return job;
  return service.pollToTerminal(job.jobId, executionReader);
}

async function finalizeContentReadyExecution(input: {
  job: GlwPageExecutionRecord;
  request: GlwGenerationRequest;
  siteRecord: NonNullable<ReturnType<typeof getSiteById>>;
}): Promise<GlwPageExecutionRecord> {
  if (input.job.status !== "CONTENT_READY") return input.job;
  if (!input.job.generatedDraft) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      errorCode: "GENERATED_DRAFT_MISSING",
      errorMessage: "n8n completed without a generated draft artifact for Genesis WordPress mutation.",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const qa = evaluateGlwGeneratedContentQa({
    artifact: input.job.generatedDraft,
    request: input.request,
    siteDomain: input.siteRecord.domain,
    minimumWordCount: 1500,
  });
  if (!qa.ok) {
    const timestamp = new Date().toISOString();
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
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

  const operation = input.request.plannedOperation.startsWith("CREATE_") ? "CREATE" : "UPDATE";
  if (operation === "UPDATE" && !input.request.wordpressObjectId) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
      errorCode: "UPDATE_AUTHORITY_REQUIRED",
      errorMessage: "Genesis requires an exact WordPress object ID before a draft update.",
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  let parentId: number | undefined;
  if (input.request.pageType === "city_service") {
    const state = getGlwState(input.request.stateCode);
    const pathSegments = input.request.canonicalPath.split("/").map((segment) => segment.trim()).filter(Boolean);
    const productSlug = pathSegments[0] ?? "";
    if (!state || !productSlug) {
      return glwPageExecutionRepository.update(input.job.jobId, {
        status: "FAILED",
        errorCode: "WORDPRESS_HIERARCHY_INVALID_TARGET",
        errorMessage: "Genesis could not derive the canonical product/state hierarchy for this city target.",
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const hierarchy = await resolveOrCreateGenesisWordPressHierarchy({
      site: input.siteRecord,
      productSlug,
      productTitle: input.request.productTopic,
      stateSlug: state.slug,
      stateTitle: state.name,
    });
    if (!hierarchy.ok) {
      const timestamp = new Date().toISOString();
      return glwPageExecutionRepository.update(input.job.jobId, {
        status: "FAILED",
        errorCode: `WORDPRESS_HIERARCHY_${hierarchy.state.toUpperCase()}`,
        errorMessage: hierarchy.message,
        updatedAt: timestamp,
        completedAt: timestamp,
      });
    }
    parentId = hierarchy.leafParentId;
  }

  const artifact = {
    title: input.job.generatedDraft.title,
    contentHtml: input.job.generatedDraft.contentHtml,
    slug: input.job.generatedDraft.slug,
    excerpt: input.job.generatedDraft.excerpt,
    parentId,
  };
  const result = operation === "CREATE"
    ? await writeGenesisWordPressDraft({ operation: "CREATE", site: input.siteRecord, artifact })
    : await writeGenesisWordPressDraft({ operation: "UPDATE", site: input.siteRecord, wordpressObjectId: input.request.wordpressObjectId!, artifact });

  const timestamp = new Date().toISOString();
  if (!result.ok) {
    return glwPageExecutionRepository.update(input.job.jobId, {
      status: "FAILED",
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

  return glwPageExecutionRepository.update(input.job.jobId, {
    status: "COMPLETE",
    wordpressObjectId: result.wordpressObjectId,
    wordpressUrl: result.wordpressUrl,
    wordpressStatus: result.wordpressStatus,
    disposition: result.operation === "CREATE" ? "CREATED" : "UPDATED",
    qaStatus: "COMPLETE",
    qaChecks: qa.checks,
    qaFailureReasons: {},
    wordCount: qa.wordCount,
    errorCode: null,
    errorMessage: null,
    updatedAt: timestamp,
    completedAt: timestamp,
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
  if (preview.request.publicationIntent !== "draft") return { error: "Public publish is blocked. Select draft intent.", status: 403 } as const;
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
      error: "The configured WordPress read target is invalid.",
      code: "WORDPRESS_READ_AUTHORITY_INVALID",
      status: 503,
    } as const;
  }

  const target = await readGlwTargetPreflight({
    request,
    wordpressReadAuthority,
    localExecutions: await glwPageExecutionRepository.list(),
  });
  const availability = resolveGlwTargetMutationAvailability(target);
  if (request.plannedOperation.startsWith("CREATE_") && !availability.createAvailable) {
    return { error: `An existing WordPress page was found for this canonical target${target.wordpressObjectId ? ` (ID ${target.wordpressObjectId})` : ""}. Creation was stopped before any WordPress changes.`, code: "CREATE_COLLISION", target, status: 409 } as const;
  }
  if (request.plannedOperation.startsWith("UPDATE_") && (!availability.updateAvailable || request.wordpressObjectId !== target.wordpressObjectId)) {
    return { error: target.state === "EXISTS_PUBLISHED" ? "Published WordPress targets cannot be updated under the draft-only release." : "Exact draft update authority could not be verified.", code: "UPDATE_AUTHORITY_REQUIRED", target, status: 409 } as const;
  }
  return { ok: true } as const;
}

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });

  const jobId = request.nextUrl.searchParams.get("jobId")?.trim() ?? "";
  if (!jobId) {
    const siteId = request.nextUrl.searchParams.get("siteId")?.trim() ?? "";
    const productId = request.nextUrl.searchParams.get("productId")?.trim() ?? "";
    const slug = request.nextUrl.searchParams.get("slug")?.trim() ?? "";
    if (!siteId || !productId || !slug) {
      return NextResponse.json({ error: "jobId or exact siteId, productId, and slug target is required." }, { status: 400 });
    }
    const jobs = await glwPageExecutionRepository.list();
    const recoverable = jobs
      .filter((candidate) =>
        candidate.organizationId === scope.organizationId
        && candidate.siteId === siteId
        && candidate.productId === productId
        && candidate.slug === slug
        && !isTerminal(candidate.status)
        && Boolean(candidate.externalExecutionId))
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))[0] ?? null;
    return NextResponse.json({ job: recoverable });
  }

  const job = await glwPageExecutionRepository.getById(jobId);
  if (job && job.organizationId !== scope.organizationId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!job) return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
  if (request.nextUrl.searchParams.get("refresh") === "true" && !isTerminal(job.status)) {
    try {
      const refreshedJob = await recoverExecution(job);
      if (refreshedJob.status !== "CONTENT_READY") return NextResponse.json({ job: refreshedJob });
      return NextResponse.json({ job: refreshedJob, recoveryError: "Generated content is ready. Use Continue Existing Job to perform the authorized Genesis WordPress draft mutation." }, { status: 202 });
    } catch (error) {
      return NextResponse.json({ job, recoveryError: error instanceof Error ? error.message : "Execution recovery failed." }, { status: 202 });
    }
  }
  return NextResponse.json({ job });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { form?: GlwGenerationRequestInput; action?: "continue"; jobId?: string } | null;
  if (!body?.form) return NextResponse.json({ error: "Generation request is required." }, { status: 400 });

  const resolved = await resolveAuthorizedPreview(body.form, scope.organizationId);
  if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  if ("issues" in resolved) return NextResponse.json({ issues: resolved.issues }, { status: resolved.status });
  const { siteRecord, request: generationRequest } = resolved;

  if (body.action === "continue") {
    const jobId = body.jobId?.trim() ?? "";
    if (!jobId) return NextResponse.json({ error: "jobId is required to continue an existing job." }, { status: 400 });
    const existing = await glwPageExecutionRepository.getById(jobId);
    if (!existing) return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
    if (existing.organizationId !== scope.organizationId || existing.siteId !== generationRequest.siteId || existing.productId !== generationRequest.productId || existing.slug !== generationRequest.slug) {
      return NextResponse.json({ error: "Existing job does not match the current authorized generation target." }, { status: 409 });
    }
    if (existing.status === "COMPLETE" || existing.status === "FAILED") return NextResponse.json({ job: existing });
    if (!existing.externalExecutionId) return NextResponse.json({ error: "Existing job has no external execution to recover." }, { status: 409 });

    try {
      const recovered = existing.status === "CONTENT_READY" ? existing : await recoverExecution(existing);
      if (recovered.status !== "CONTENT_READY") return NextResponse.json({ job: recovered }, { status: 202 });
      const authority = await verifyMutationAuthority(generationRequest, siteRecord);
      if ("error" in authority) return NextResponse.json(authority, { status: authority.status });
      const job = await finalizeContentReadyExecution({ job: recovered, request: generationRequest, siteRecord });
      return NextResponse.json({ job }, { status: job.status === "COMPLETE" || job.status === "FAILED" ? 200 : 202 });
    } catch (error) {
      return NextResponse.json({ job: existing, recoveryError: error instanceof Error ? error.message : "Execution continuation failed." }, { status: 202 });
    }
  }

  const authority = await verifyMutationAuthority(generationRequest, siteRecord);
  if ("error" in authority) return NextResponse.json(authority, { status: authority.status });

  const configuration = getGlwN8nMcpConfigurationStatus();
  if (!configuration.configured) return NextResponse.json({ error: "GLW n8n MCP execution is not configured.", configuration }, { status: 503 });

  try {
    const dispatchedJob = await service.execute(generationRequest);
    const recoveredJob = isTerminal(dispatchedJob.status) ? dispatchedJob : await recoverExecution(dispatchedJob);
    const job = recoveredJob.status === "CONTENT_READY" ? await finalizeContentReadyExecution({ job: recoveredJob, request: generationRequest, siteRecord }) : recoveredJob;
    return NextResponse.json({ job }, { status: job.status === "COMPLETE" || job.status === "FAILED" ? 200 : 202 });
  } catch (error) {
    const status = error instanceof GlwDraftOnlyExecutionError ? 403 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Draft execution failed." }, { status });
  }
}
