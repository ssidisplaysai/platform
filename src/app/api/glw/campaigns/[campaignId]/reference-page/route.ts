import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import {
  approveGlwCampaignReference,
  getGlwCampaignReferenceApproval,
} from "@/modules/glw/campaign-reference-approval-repository";
import { resolveGlwCampaignGenerationContext } from "@/modules/glw/campaign-generation-context";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import type { GlwCampaign } from "@/modules/glw/campaign-types";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { adaptProductForGeneration, adaptSiteForGeneration, createDefaultGlwGenerationInput } from "@/modules/glw/page-generation";

type Context = { params: Promise<{ campaignId: string }> };

function isRecoverableReferenceStatus(status: string): boolean {
  return status === "QUEUED"
    || status === "DISPATCHED"
    || status === "DISCOVERING_EXECUTION"
    || status === "RUNNING";
}

function normalizeCitySlug(value?: string | null): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveReferenceTarget(input: {
  campaign: GlwCampaign;
  stateCode: string;
  citySlug?: string | null;
}) {
  const stateCode = input.stateCode.trim().toUpperCase();
  if (!input.campaign.stateCodes.includes(stateCode)) {
    throw new Error("Select a state included in this campaign.");
  }

  const state = GLW_CAMPAIGN_US_STATES.find(
    (candidate) => candidate.code === stateCode,
  );
  if (!state) {
    throw new Error("Campaign state is not recognized.");
  }

  if (input.campaign.pageType === "city_service") {
    const citySlug = normalizeCitySlug(input.citySlug);
    if (!citySlug) {
      throw new Error("City campaign reference requires citySlug.");
    }

    const city = input.campaign.cityTargets?.find(
      (candidate) =>
        candidate.stateCode === stateCode
        && normalizeCitySlug(candidate.citySlug) === citySlug,
    );
    if (!city) {
      throw new Error("Select a city included in this campaign.");
    }

    return {
      state,
      citySlug,
      cityName: city.cityName,
    };
  }

  return {
    state,
    citySlug: null,
    cityName: null,
  };
}

function executionMatchesReference(input: {
  campaign: GlwCampaign;
  record: Awaited<ReturnType<typeof glwPageExecutionRepository.getById>> extends infer T ? NonNullable<T> : never;
  stateName: string;
  cityName: string | null;
  slug?: string;
}): boolean {
  return input.record.organizationId === input.campaign.organizationId
    && input.record.siteId === input.campaign.siteId
    && input.record.productId === input.campaign.productId
    && input.record.state === input.stateName
    && (input.campaign.pageType !== "city_service" || input.record.city === input.cityName)
    && (!input.slug || input.record.slug === input.slug);
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

  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (scope.siteId && scope.siteId !== campaign.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let target;
  try {
    target = resolveReferenceTarget({
      campaign,
      stateCode: request.nextUrl.searchParams.get("stateCode") ?? "",
      citySlug: request.nextUrl.searchParams.get("citySlug"),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid campaign target." },
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
  }).filter((profile) => profile.assignedSiteIds.includes(siteRecord.siteId)).length;

  const site = adaptSiteForGeneration(siteRecord, profileCount);
  const product = adaptProductForGeneration(productRecord, site.siteId);
  const targetForm = createDefaultGlwGenerationInput(
    site,
    product,
    campaign.pageType,
    target.state.code,
    target.citySlug ?? "",
  );

  const records = await glwPageExecutionRepository.list();
  const candidates = records
    .filter(
      (record) =>
        executionMatchesReference({
          campaign,
          record,
          stateName: target.state.name,
          cityName: target.cityName,
          slug: targetForm.slug,
        }),
    )
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  let job = candidates[0] ?? null;
  const approval = getGlwCampaignReferenceApproval(
    campaign.campaignId,
    target.state.code,
    target.citySlug,
  );

  if (!job) {
    return NextResponse.json({
      state: target.state,
      city: target.cityName ? { name: target.cityName, slug: target.citySlug } : null,
      job: null,
      approval,
      approved: false,
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
    if (recovered?.job) job = recovered.job;

    return NextResponse.json(
      {
        state: target.state,
        city: target.cityName ? { name: target.cityName, slug: target.citySlug } : null,
        job,
        recoveryError: recovered?.recoveryError ?? null,
      },
      { status: recoveryResponse.ok ? 200 : recoveryResponse.status },
    );
  }

  return NextResponse.json({
    state: target.state,
    city: target.cityName ? { name: target.cityName, slug: target.citySlug } : null,
    job,
    approval,
    approved:
      Boolean(approval)
      && approval?.jobId === job.jobId
      && approval?.wordpressObjectId === job.wordpressObjectId,
    recoveryError: null,
  });
}

export async function PATCH(request: NextRequest, context: Context) {
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

  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "Reference approval is only available while the campaign is draft." },
      { status: 409 },
    );
  }
  if (scope.siteId && scope.siteId !== campaign.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    stateCode?: string;
    citySlug?: string;
    jobId?: string;
  } | null;

  let target;
  try {
    target = resolveReferenceTarget({
      campaign,
      stateCode: body?.stateCode ?? "",
      citySlug: body?.citySlug,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid campaign target." },
      { status: 400 },
    );
  }

  const jobId = body?.jobId?.trim() ?? "";
  if (!jobId) {
    return NextResponse.json({ error: "Reference job ID is required." }, { status: 400 });
  }

  const job = await glwPageExecutionRepository.getById(jobId);
  if (
    !job
    || !executionMatchesReference({
      campaign,
      record: job,
      stateName: target.state.name,
      cityName: target.cityName,
    })
  ) {
    return NextResponse.json(
      { error: "Reference job does not match this campaign target." },
      { status: 409 },
    );
  }

  if (
    job.status !== "COMPLETE"
    || job.qaStatus !== "COMPLETE"
    || job.wordpressStatus !== "draft"
    || !job.wordpressObjectId
    || job.featuredImagePresent !== true
  ) {
    return NextResponse.json(
      {
        error: "Only a complete QA-passed WordPress draft with a featured image can be approved as the campaign reference.",
        job,
      },
      { status: 409 },
    );
  }

  const approval = approveGlwCampaignReference({
    campaignId: campaign.campaignId,
    stateCode: target.state.code,
    citySlug: target.citySlug,
    jobId: job.jobId,
    wordpressObjectId: job.wordpressObjectId,
  });

  return NextResponse.json({
    state: target.state,
    city: target.cityName ? { name: target.cityName, slug: target.citySlug } : null,
    job,
    approval,
    approved: true,
  });
}

export async function POST(request: NextRequest, context: Context) {
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

  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (campaign.status !== "draft") {
    return NextResponse.json(
      { error: "Reference pages can only be generated while the campaign is draft." },
      { status: 409 },
    );
  }
  if (scope.siteId && scope.siteId !== campaign.siteId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    stateCode?: string;
    citySlug?: string;
    action?: "continue";
    jobId?: string;
  } | null;

  let target;
  try {
    target = resolveReferenceTarget({
      campaign,
      stateCode: body?.stateCode ?? "",
      citySlug: body?.citySlug,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid campaign target." },
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
  }).filter((profile) => profile.assignedSiteIds.includes(siteRecord.siteId)).length;

  const site = adaptSiteForGeneration(siteRecord, profileCount);
  const product = adaptProductForGeneration(productRecord, site.siteId);
  const form = createDefaultGlwGenerationInput(
    site,
    product,
    campaign.pageType,
    target.state.code,
    target.citySlug ?? "",
  );

  const locationName = target.cityName ?? target.state.name;
  const title = `${product.topic} in ${locationName}`;
  form.title = title;
  form.seoTitle = `${title} | ${site.name}`;
  form.metaDescription = `Explore ${product.topic} solutions for commercial projects in ${locationName} from ${site.name}.`;
  form.publicationIntent = "draft";
  form.plannedOperation = campaign.pageType === "city_service" ? "CREATE_CITY" : "CREATE_STATE";

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
      return NextResponse.json({ error: "Existing reference job ID is required." }, { status: 400 });
    }

    const existing = await glwPageExecutionRepository.getById(jobId);
    if (
      !existing
      || !executionMatchesReference({
        campaign,
        record: existing,
        stateName: target.state.name,
        cityName: target.cityName,
        slug: form.slug,
      })
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

    generationBody = { action: "continue", jobId, form };
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
    {
      state: target.state,
      city: target.cityName ? { name: target.cityName, slug: target.citySlug } : null,
      ...payload,
    },
    { status: generationResponse.status },
  );
}
