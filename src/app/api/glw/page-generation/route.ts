import { NextRequest, NextResponse } from "next/server";
import {
  authorizeRequest,
  hasOrganizationScope,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
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
  type GlwGenerationRequestInput,
} from "@/modules/glw/page-generation";

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

export async function GET(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:read");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const jobId = request.nextUrl.searchParams.get("jobId")?.trim() ?? "";
  if (!jobId) return NextResponse.json({ error: "jobId is required." }, { status: 400 });
  const job = await glwPageExecutionRepository.getById(jobId);
  if (job && job.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!job) return NextResponse.json({ error: "GLW execution was not found." }, { status: 404 });
  if (request.nextUrl.searchParams.get("refresh") === "true" && !isTerminal(job.status)) {
    try {
      const refreshedJob = await recoverExecution(job);
      return NextResponse.json({ job: refreshedJob });
    } catch (error) {
      return NextResponse.json({
        job,
        recoveryError: error instanceof Error ? error.message : "Execution recovery failed.",
      }, { status: 202 });
    }
  }
  return NextResponse.json({ job });
}

export async function POST(request: NextRequest) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { form?: GlwGenerationRequestInput } | null;
  if (!body?.form) return NextResponse.json({ error: "Generation request is required." }, { status: 400 });

  const siteRecord = getSiteById(body.form.siteId);
  const productRecord = getProductById(body.form.productId);
  if (!siteRecord || !productRecord) {
    return NextResponse.json({ error: "Configured site and product are required." }, { status: 400 });
  }
  if (siteRecord.organizationId !== scope.organizationId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profileCount = listIntegrationProfiles({ organizationId: siteRecord.organizationId })
    .filter((profile) => profile.assignedSiteIds.includes(siteRecord.siteId)).length;
  const site = adaptSiteForGeneration(siteRecord, profileCount);
  const product = adaptProductForGeneration(productRecord, site.siteId);
  const preview = buildLocalGlwGenerationPreview({ form: body.form, sites: [site], products: [product] });
  if (!preview.validation.valid || !preview.request) {
    return NextResponse.json({ issues: preview.validation.issues }, { status: 400 });
  }
  if (preview.request.publicationIntent !== "draft") {
    return NextResponse.json({ error: "Public publish is blocked. Select draft intent." }, { status: 403 });
  }

  const configuration = getGlwN8nMcpConfigurationStatus();
  if (!configuration.configured) {
    return NextResponse.json({ error: "GLW n8n MCP execution is not configured.", configuration }, { status: 503 });
  }

  try {
    const dispatchedJob = await service.execute(preview.request);
    const job = isTerminal(dispatchedJob.status)
      ? dispatchedJob
      : await recoverExecution(dispatchedJob);
    return NextResponse.json({ job }, { status: job.status === "COMPLETE" || job.status === "FAILED" ? 200 : 202 });
  } catch (error) {
    const status = error instanceof GlwDraftOnlyExecutionError ? 403 : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Draft execution failed." }, { status });
  }
}