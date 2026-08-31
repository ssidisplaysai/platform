import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import { resolveGlwCampaignGenerationContext } from "@/modules/glw/campaign-generation-context";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { adaptProductForGeneration, adaptSiteForGeneration, createDefaultGlwGenerationInput } from "@/modules/glw/page-generation";

type Context = { params: Promise<{ campaignId: string }> };

function isRecoverableReferenceStatus(status: string): boolean {
  return status === "QUEUED"
    || status === "DISPATCHED"
    || status === "DISCOVERING_EXECUTION"
    || status === "RUNNING";
}

export async function GET(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) {
    return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  }

  const { campaignId } = await context.params;

  const campaign = listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === campaignId
      && candidate.organizationId === scope.organizationId,
  ) ?? null;

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  }

  if (scope.siteId && scope.siteId !== campaign.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stateCode = request.nextUrl.searchParams.get("stateCode")?.trim().toUpperCase() ?? "";

  if (!campaign.stateCodes.includes(stateCode)) {
    return NextResponse.json(
      { error: "Select a state included in this campaign." },
      { status: 400 },
    );
  }

  const state = GLW_CAMPAIGN_US_STATES.find(
    (candidate) => candidate.code === stateCode,
  ) ?? null;

  if (!state) {
    return NextResponse.json(
      { error: "Campaign state is not recognized." },
      { status: 400 },
    );
  }

  const siteRecord = getSiteById(campaign.siteId);
  const productRecord = getProductById(campaign.productId);

  if (!siteRecord || !productRecord) {
    return NextResponse.json(
      { error: "Campaign site and product must still exist." },
      { status: 409 },
    );
  }

  const profileCount = listIntegrationProfiles({
    organizationId: siteRecord.organizationId,
  }).filter(
    (profile) => profile.assignedSiteIds.includes(siteRecord.siteId),
  ).length;

  const site = adaptSiteForGeneration(siteRecord, profileCount);
  const product = adaptProductForGeneration(productRecord, site.siteId);
  const targetForm = createDefaultGlwGenerationInput(
    site,
    product,
    "state_service",
    stateCode,
    "",
  );

  const records = await glwPageExecutionRepository.list();

  const candidates = records
    .filter(
      (record) =>
        record.organizationId === campaign.organizationId
        && record.siteId === campaign.siteId
        && record.productId === campaign.productId
        && record.state === state.name
        && record.slug === targetForm.slug,
    )
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime()
        - new Date(a.updatedAt).getTime(),
    );

  let job = candidates[0] ?? null;

  if (!job) {
    return NextResponse.json({
      state,
      job: null,
      recoveryError: null,
    });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  if (refresh && isRecoverableReferenceStatus(job.status)) {
    const recoveryResponse = await fetch(
      `${request.nextUrl.origin}/api/glw/page-generation?jobId=${encodeURIComponent(job.jobId)}&refresh=true`,
      {
        method: "GET",
        headers: {
          "x-gcp-roles": "platform_admin",
          "x-gcp-organization-id": campaign.organizationId,
          "x-gcp-site-id": campaign.siteId,
        },
        cache: "no-store",
      },
    );

    const recovered = await recoveryResponse.json().catch(() => null) as {
      job?: typeof job;
      recoveryError?: string | null;
    } | null;

    if (recovered?.job) {
      job = recovered.job;
    }

    return NextResponse.json(
      {
        state,
        job,
        recoveryError: recovered?.recoveryError ?? null,
      },
      { status: recoveryResponse.ok ? 200 : recoveryResponse.status },
    );
  }

  return NextResponse.json({
    state,
    job,
    recoveryError: null,
  });
}

export async function POST(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });

  const { campaignId } = await context.params;

  const campaign = listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === campaignId
      && candidate.organizationId === scope.organizationId,
  ) ?? null;

  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (campaign.status !== "draft") return NextResponse.json({ error: "Reference pages can only be generated while the campaign is draft." }, { status: 409 });
  if (scope.siteId && scope.siteId !== campaign.siteId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null) as {
    stateCode?: string;
    action?: "continue";
    jobId?: string;
  } | null;

  const stateCode = body?.stateCode?.trim().toUpperCase() ?? "";

  if (!campaign.stateCodes.includes(stateCode)) {
    return NextResponse.json(
      { error: "Select a state included in this campaign." },
      { status: 400 },
    );
  }

  const state = GLW_CAMPAIGN_US_STATES.find(
    (candidate) => candidate.code === stateCode,
  ) ?? null;

  if (!state) {
    return NextResponse.json(
      { error: "Campaign state is not recognized." },
      { status: 400 },
    );
  }

  const pack = getGlwCampaignKnowledgePack(campaignId);

  if (!pack?.instructions.trim()) {
    return NextResponse.json(
      { error: "Approve campaign instructions before generating a reference page." },
      { status: 409 },
    );
  }

  const siteRecord = getSiteById(campaign.siteId);
  const productRecord = getProductById(campaign.productId);

  if (!siteRecord || !productRecord) {
    return NextResponse.json(
      { error: "Campaign site and product must still exist." },
      { status: 409 },
    );
  }

  const profileCount = listIntegrationProfiles({
    organizationId: siteRecord.organizationId,
  }).filter(
    (profile) => profile.assignedSiteIds.includes(siteRecord.siteId),
  ).length;

  const site = adaptSiteForGeneration(siteRecord, profileCount);
  const product = adaptProductForGeneration(productRecord, site.siteId);

  const form = createDefaultGlwGenerationInput(
    site,
    product,
    "state_service",
    stateCode,
    "",
  );

  const title = `${product.topic} in ${state.name}`;

  form.title = title;
  form.seoTitle = `${title} | ${site.name}`;
  form.metaDescription = `Explore ${product.topic} solutions for commercial projects in ${state.name} from ${site.name}.`;
  form.publicationIntent = "draft";
  form.plannedOperation = "CREATE_STATE";

  const generationContext = resolveGlwCampaignGenerationContext({
    campaignId: campaign.campaignId,
    referencePage: true,
  });

  if (!generationContext) {
    return NextResponse.json(
      { error: "Approved campaign generation guidance could not be resolved." },
      { status: 409 },
    );
  }

  form.additionalInstructions = generationContext.additionalInstructions;
  form.imageDirection = generationContext.imageDirection;
  form.campaignId = campaign.campaignId;

  let generationBody: Record<string, unknown> = { form };

  if (body?.action === "continue") {
    const jobId = body.jobId?.trim() ?? "";

    if (!jobId) {
      return NextResponse.json(
        { error: "Existing reference job ID is required." },
        { status: 400 },
      );
    }

    const existing = await glwPageExecutionRepository.getById(jobId);

    if (
      !existing
      || existing.organizationId !== campaign.organizationId
      || existing.siteId !== campaign.siteId
      || existing.productId !== campaign.productId
      || existing.state !== state.name
      || existing.slug !== form.slug
    ) {
      return NextResponse.json(
        { error: "Existing reference job does not match this campaign target." },
        { status: 409 },
      );
    }

    if (existing.status !== "CONTENT_READY") {
      return NextResponse.json(
        {
          error: "Existing reference job is not ready for WordPress continuation.",
          job: existing,
        },
        { status: 409 },
      );
    }

    generationBody = {
      action: "continue",
      jobId,
      form,
    };
  }

  const generationResponse = await fetch(
    `${request.nextUrl.origin}/api/glw/page-generation`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gcp-roles": "platform_admin",
        "x-gcp-organization-id": campaign.organizationId,
        "x-gcp-site-id": campaign.siteId,
      },
      body: JSON.stringify(generationBody),
      cache: "no-store",
    },
  );

  const payload = await generationResponse.json().catch(
    () => ({ error: "Reference generation returned malformed JSON." }),
  );

  return NextResponse.json(
    { state, ...payload },
    { status: generationResponse.status },
  );
}