import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { authorizeRequest, forwardOperatorMutationContext, hasOrganizationScope, resolveRequestScope } from "@/modules/foundation/api-auth";
import { listIntegrationProfiles } from "@/modules/foundation/integration-profile-repository";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { inspectSiteWordPressReadAuthority } from "@/modules/foundation/wordpress-read-authority-status";
import { getGlwCampaignKnowledgePack } from "@/modules/glw/campaign-reference-repository";
import { buildGlwExactRetryContract, generationAuthorityBindingsMatch, resolveGlwReferenceGenerationAuthority, type GlwReferenceGenerationAuthorityBinding } from "@/modules/glw/reference-generation-authority";
import { evaluateGlwReferenceOwnerReviewReadiness } from "@/modules/glw/reference-owner-review-readiness";
import { resolveGlwRichReferenceReadiness } from "@/modules/glw/rich-reference-composition-resolver";
import { buildGeneratedPageReviewModel } from "@/modules/glw/generated-page-review-read-model";
import { evaluateReferenceApprovalVisualCertificationBridge } from "@/modules/glw/reference-current-visual-certification-bridge";
import { getGlwReferenceStateSelection, saveGlwReferenceStateSelection } from "@/modules/glw/reference-state-selection-repository";
import { resolveGlwReferenceOwnerLiveContext } from "@/modules/glw/reference-owner-live-context";
import { consumeGlwReferenceOwnerGrant, GlwReferenceOwnerAuthorityError, type GlwReferenceOwnerOperationType } from "@/modules/glw/reference-owner-authority";
import { resolveGlwTrustedOperatorPrincipal } from "@/modules/glw/trusted-operator-principal";
import {
  approveGlwCampaignReference,
  getGlwCampaignReferenceApproval,
} from "@/modules/glw/campaign-reference-approval-repository";
import { resolveGlwCampaignGenerationContext } from "@/modules/glw/campaign-generation-context";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import { evaluateCampaignProductMediaReadiness } from "@/modules/glw/campaign-media-policy";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import { createGlwCampaignStateTargetId, listGlwCampaignTargets } from "@/modules/glw/campaign-target-repository";
import { ensureDraftCampaignContinuationTarget } from "@/modules/glw/reference-continuation-targets";
import { reconcileReferenceTargetExecutionProjection } from "@/modules/glw/reference-continuation-targets";
import { recordGlwCampaignLaunchReferenceApproved, recordGlwCampaignLaunchReferenceFailure, recordGlwCampaignLaunchReferenceReviewRequired, recordGlwCampaignLaunchReferenceStarted } from "@/modules/glw/campaign-launch-authority";
import type { GlwCampaign } from "@/modules/glw/campaign-types";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import { glwPageRunRepository } from "@/modules/glw/page-run-repository";
import { createGlwPageRun, isGlwPageRunTerminal } from "@/modules/glw/page-run";
import { synchronizeGlwPageRunWithExecution } from "@/modules/glw/page-run-coordinator";
import { adaptProductForGeneration, adaptSiteForGeneration, createDefaultGlwGenerationInput } from "@/modules/glw/page-generation";
import { listProductMediaAuthority, OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID, type ProductMediaReadiness } from "@/modules/glw/product-media-authority";
import {
  findEvidenceBoundLegacyReferenceJob,
  projectGlwDurableReferenceOperation,
  projectGlwReferenceRetryReadiness,
  projectGlwReferenceWorkflow,
  selectMostRecentActiveReferenceExecution,
} from "@/modules/glw/reference-workflow-state";
import { getGlwN8nMcpConfigurationStatus } from "@/modules/glw/n8n-mcp-adapter";
import { GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION } from "@/modules/glw/state-localization-contamination";
import { resolveTargetParameterizedRichReferenceProduction } from "@/modules/glw/target-parameterized-rich-reference-production";
import {
  resolveDeterministicReferenceCitySlug,
  resolveReferenceCityFromCampaign,
} from "@/modules/glw/reference-city-selection";

type Context = { params: Promise<{ campaignId: string }> };

function referenceMediaReadiness(productMediaReadiness: ProductMediaReadiness | null, primaryImageReference: string | null) {
  const legacyMediaId = /^wordpress-media:(\d+)$/.exec(primaryImageReference ?? "")?.[1] ?? null;
  return productMediaReadiness ? {
    productAuthorityMediaAvailable: productMediaReadiness.approvedProductAuthorityMediaCount > 0,
    productAuthorityMediaCount: productMediaReadiness.approvedProductAuthorityMediaCount,
    contextualMediaCount: productMediaReadiness.approvedContextualMediaCount,
    applicationMediaCount: productMediaReadiness.approvedApplicationMediaCount,
    localContextualMediaCount: productMediaReadiness.approvedLocalAtmosphereMediaCount,
    featuredMediaId: null,
  } : {
    productAuthorityMediaAvailable: Boolean(primaryImageReference),
    productAuthorityMediaCount: primaryImageReference ? 1 : 0,
    contextualMediaCount: 0,
    applicationMediaCount: 0,
    localContextualMediaCount: 0,
    featuredMediaId: legacyMediaId ? Number(legacyMediaId) : null,
  };
}

function campaignProductMediaReadiness(campaign: GlwCampaign, stateCode: string): ProductMediaReadiness | null {
  if (campaign.productId !== OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID) return null;
  const records = listProductMediaAuthority({ organizationId: campaign.organizationId, siteId: campaign.siteId, productId: campaign.productId });
  return evaluateCampaignProductMediaReadiness({ campaign, productMediaRecords: records, stateCode });
}

function ownerReviewReadiness(
  job: Awaited<ReturnType<typeof glwPageExecutionRepository.getById>>,
  media: ReturnType<typeof referenceMediaReadiness>,
  actualHostVisualCertified: boolean,
) {
  if (!job?.generatedDraft) return null;
  return evaluateGlwReferenceOwnerReviewReadiness({
    artifact: job.generatedDraft,
    target: { productName: job.productTopic, productCanonicalPath: `/${job.slug.split("/").filter(Boolean)[0]}/`, stateName: job.state ?? "" },
    media,
    actualHostVisualCertified,
    authority: { references: [], authoritativeFactReferenceIds: [], supportedClaimMappings: [] },
  });
}

function isRecoverableReferenceStatus(status: string): boolean {
  return status === "QUEUED"
    || status === "DISPATCHED"
    || status === "DISCOVERING_EXECUTION"
    || status === "RUNNING";
}

function isContinuableReferenceJob(job: {
  status: string;
  errorCode: string | null;
  generatedDraft: unknown;
}): boolean {
  if (job.status === "CONTENT_READY") return true;
  if (job.status !== "FAILED" || !job.generatedDraft || !job.errorCode) return false;
  return job.errorCode === "GENERATED_CONTENT_QA_FAILED"
    || job.errorCode.startsWith("CONTENT_REPAIR_")
    || new Set([
      "WORDPRESS_HIERARCHY_READ_FAILED",
      "WORDPRESS_HIERARCHY_WRITE_FAILED",
      "WORDPRESS_READ_FAILED",
      "WORDPRESS_WRITE_FAILED",
    ]).has(job.errorCode);
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
    const citySlug = resolveDeterministicReferenceCitySlug({
      campaign: input.campaign,
      stateCode,
      preferredCitySlug: input.citySlug,
    });
    if (!citySlug) {
      throw new Error("Select a city included in this campaign.");
    }

    const city = resolveReferenceCityFromCampaign({
      campaign: input.campaign,
      stateCode,
      citySlug,
    });
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
  let durableSelection = getGlwReferenceStateSelection(campaign.campaignId);
  try {
    target = resolveReferenceTarget({
      campaign,
      stateCode: durableSelection?.stateCode ?? request.nextUrl.searchParams.get("stateCode") ?? "",
      citySlug: request.nextUrl.searchParams.get("citySlug") ?? durableSelection?.citySlug,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid campaign target." },
      { status: 400 },
    );
  }

  if (
    campaign.pageType === "city_service"
    && (
      !durableSelection
      || durableSelection.stateCode !== target.state.code
      || durableSelection.citySlug !== target.citySlug
    )
  ) {
    durableSelection = saveGlwReferenceStateSelection({
      campaignId,
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      stateCode: target.state.code,
      citySlug: target.citySlug,
      selectedBy: durableSelection?.selectedBy ?? "SYSTEM_REFERENCE_TARGET_RECONCILIATION",
      selectedAt: new Date().toISOString(),
    });
  }

  const siteRecord = getSiteById(campaign.siteId);
  const productRecord = getProductById(campaign.productId);
  if (!siteRecord || !productRecord) {
    return NextResponse.json(
      { error: "Campaign site and product must still exist." },
      { status: 409 },
    );
  }
  const productMediaReadiness = campaignProductMediaReadiness(campaign, target.state.code);
  const mediaReadiness = referenceMediaReadiness(productMediaReadiness, productRecord.media.primaryImageReference);
  const approvedProductMediaAvailable = mediaReadiness.productAuthorityMediaAvailable;
  const wordpressAuthority = await inspectSiteWordPressReadAuthority(siteRecord);
  const pack = getGlwCampaignKnowledgePack(campaign.campaignId);
  const generationAuthority = pack
    ? resolveGlwReferenceGenerationAuthority({ campaign, pack, stateCode: target.state.code })
    : null;

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
  const exactCampaignTarget = listGlwCampaignTargets(campaign.campaignId).find(
    (candidate) =>
      candidate.stateCode === target.state.code
      && (candidate.citySlug ?? null) === (target.citySlug ?? null),
  ) ?? null;

  let activePageRun = exactCampaignTarget
    ? await glwPageRunRepository.getActiveByTarget(exactCampaignTarget.targetId)
    : null;

  let job = activePageRun?.generationJobId
    ? await glwPageExecutionRepository.getById(activePageRun.generationJobId)
    : null;

  if (activePageRun && job) {
    activePageRun = await synchronizeGlwPageRunWithExecution({
      runId: activePageRun.runId,
      job,
    });
  }

  const candidates = activePageRun
    ? []
    : records.filter(
        (record) =>
          executionMatchesReference({
            campaign,
            record,
            stateName: target.state.name,
            cityName: target.cityName,
            slug: targetForm.slug,
          }),
      );

  if (!activePageRun) {
    job = selectMostRecentActiveReferenceExecution(candidates);
  }

  const legacyJob = activePageRun || job
    ? null
    : findEvidenceBoundLegacyReferenceJob({
        campaign,
        campaigns: listGlwCampaigns(),
        records,
      });
  const baseWorkflow = projectGlwReferenceWorkflow(job ?? legacyJob);
  const targetParameterizedOrchestration = campaign.productId === OUTDOOR_DIGITAL_SPHERE_PRODUCT_ID
    ? await resolveTargetParameterizedRichReferenceProduction({ campaignId: campaign.campaignId, targetId: createGlwCampaignStateTargetId(campaign.campaignId, target.state.code) })
    : null;
  const durableOperation = activePageRun
    ? null
    : projectGlwDurableReferenceOperation({ campaign, campaigns: listGlwCampaigns(), records, selectedStateCode: target.state.code });
  const mcpConfiguration = getGlwN8nMcpConfigurationStatus();
  const exactRuntime = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  const retryContract = legacyJob && baseWorkflow.artifactSha256 && generationAuthority && /^[0-9a-f]{40}$/.test(exactRuntime)
    ? buildGlwExactRetryContract({
        campaign,
        binding: generationAuthority,
        failedJobId: legacyJob.jobId,
        failedArtifactSha256: baseWorkflow.artifactSha256,
        wordpressReadAuthority: [
          wordpressAuthority.siteId,
          siteRecord.integrations.wordpressCredentialReference,
          wordpressAuthority.configuredUsername,
          wordpressAuthority.authorityHealthState,
        ].join(":"),
        exactRuntime,
      })
    : null;
  const workflow = projectGlwReferenceRetryReadiness(baseWorkflow, durableSelection?.stateCode ?? null, Boolean(retryContract));
  const relatedReference = !job && legacyJob
    ? {
        stateCode: workflow.targetStateCode,
        attribution: "UNIQUE_CAMPAIGN_SITE_PRODUCT_RECOVERY" as const,
        job: legacyJob,
        workflow,
      }
    : null;
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
      wordpressAuthority,
      selectedReferenceState: durableSelection,
      pageRun: activePageRun,
      generationAuthority,
      retryContract,
      workflow,
      relatedReference,
      ownerReviewReadiness: ownerReviewReadiness(legacyJob, mediaReadiness, false),
      richCompositionReadiness: legacyJob ? resolveGlwRichReferenceReadiness({ campaign, job: legacyJob, approvedProductMediaAvailable }) : null,
      productMediaReadiness,
      targetParameterizedOrchestration,
      durableOperation,
      mcpConfiguration,
      failedDispatchRecovery: job?.status === "FAILED" && job.errorCode === "DISPATCH_FAILED" && !job.externalExecutionId,
    });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  if (refresh && isRecoverableReferenceStatus(job.status)) {
    const recoveryResponse = await fetch(
      `${request.nextUrl.origin}/api/glw/page-generation?jobId=${encodeURIComponent(job.jobId)}&refresh=true`,
      {
        method: "GET",
        headers: forwardOperatorMutationContext(request, {
          "x-gcp-roles": "platform_admin",
          "x-gcp-organization-id": campaign.organizationId,
          "x-gcp-site-id": campaign.siteId,
        }),
        cache: "no-store",
      },
    );

    const recovered = await recoveryResponse.json().catch(() => null) as {
      job?: typeof job;
      recoveryError?: string | null;
    } | null;
    if (recovered?.job) job = recovered.job;

    if (activePageRun) {
      activePageRun = await synchronizeGlwPageRunWithExecution({
        runId: activePageRun.runId,
        job,
      });
    } else {
      reconcileReferenceTargetExecutionProjection({
        campaign,
        stateCode: target.state.code,
        citySlug: target.citySlug,
        execution: {
          jobId: job.jobId,
          status: job.status,
          externalExecutionId: job.externalExecutionId,
          wordpressObjectId: job.wordpressObjectId,
          errorCode: job.errorCode,
          errorMessage: job.errorMessage,
        },
      });
    }

    return NextResponse.json(
      {
        state: target.state,
        city: target.cityName ? { name: target.cityName, slug: target.citySlug } : null,
        job,
        recoveryError: recovered?.recoveryError ?? null,
        wordpressAuthority,
        selectedReferenceState: durableSelection,
        pageRun: activePageRun,
        generationAuthority,
        retryContract,
        workflow: projectGlwReferenceWorkflow(job),
        relatedReference: null,
        ownerReviewReadiness: ownerReviewReadiness(job, mediaReadiness, false),
        richCompositionReadiness: resolveGlwRichReferenceReadiness({ campaign, job, approvedProductMediaAvailable }),
        productMediaReadiness,
        targetParameterizedOrchestration,
        durableOperation,
        mcpConfiguration,
        failedDispatchRecovery: false,
      },
      { status: recoveryResponse.ok ? 200 : recoveryResponse.status },
    );
  }

  if (activePageRun) {
    activePageRun = await synchronizeGlwPageRunWithExecution({
      runId: activePageRun.runId,
      job,
    });
  } else {
    reconcileReferenceTargetExecutionProjection({
      campaign,
      stateCode: target.state.code,
      citySlug: target.citySlug,
      execution: {
        jobId: job.jobId,
        status: job.status,
        externalExecutionId: job.externalExecutionId,
        wordpressObjectId: job.wordpressObjectId,
        errorCode: job.errorCode,
        errorMessage: job.errorMessage,
      },
    });
  }

  return NextResponse.json({
    state: target.state,
    city: target.cityName ? { name: target.cityName, slug: target.citySlug } : null,
    job,
    approval,
    approved:
      Boolean(approval)
      && approval?.approvalKind !== "GOVERNED_LOCAL_REFERENCE"
      && approval?.jobId === job.jobId
      && approval?.wordpressObjectId === job.wordpressObjectId,
    recoveryError: null,
    wordpressAuthority,
    selectedReferenceState: durableSelection,
    pageRun: activePageRun,
    generationAuthority,
    retryContract,
    workflow: projectGlwReferenceWorkflow(job),
    relatedReference: null,
    ownerReviewReadiness: ownerReviewReadiness(job, mediaReadiness, false),
    richCompositionReadiness: resolveGlwRichReferenceReadiness({ campaign, job, approvedProductMediaAvailable }),
    productMediaReadiness,
    targetParameterizedOrchestration,
    durableOperation,
    mcpConfiguration,
    failedDispatchRecovery: job.status === "FAILED" && job.errorCode === "DISPATCH_FAILED" && !job.externalExecutionId,
  });
}

export async function PUT(request: NextRequest, context: Context) {
  const auth = authorizeRequest(request, "sites:update");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const scope = resolveRequestScope(request);
  if (!hasOrganizationScope(scope)) return NextResponse.json({ error: "Organization scope is required." }, { status: 403 });
  const { campaignId } = await context.params;
  const campaign = listGlwCampaigns().find((candidate) => candidate.campaignId === campaignId && candidate.organizationId === scope.organizationId) ?? null;
  if (!campaign || (scope.siteId && scope.siteId !== campaign.siteId)) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const body = await request.json().catch(() => null) as { stateCode?: string; citySlug?: string } | null;
  let target;
  try {
    target = resolveReferenceTarget({ campaign, stateCode: body?.stateCode ?? "", citySlug: body?.citySlug });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid campaign target." }, { status: 400 });
  }
  const selection = saveGlwReferenceStateSelection({
    campaignId,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    stateCode: target.state.code,
    citySlug: target.citySlug,
    selectedBy: auth.roles.join(","),
    selectedAt: new Date().toISOString(),
  });
  return NextResponse.json({ selectedReferenceState: selection, generationPerformed: false, jobCreated: false });
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
  const reviewModel = await buildGeneratedPageReviewModel({
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    jobId: job.jobId,
  });
  const featuredImageVerified = job.featuredImagePresent === true
    || reviewModel?.images.contextualInUse.state === "GENERATED_CONTEXTUAL"
    || reviewModel?.images.contextualInUse.state === "ASSIGNED_FEATURED"
    || reviewModel?.images.contextualInUse.state === "LEGACY_FEATURED";
  const productRecord = getProductById(campaign.productId);
  if (!productRecord) return NextResponse.json({ error: "Campaign product must still exist." }, { status: 409 });
  const productMediaReadiness = campaignProductMediaReadiness(campaign, target.state.code);
  const mediaReadiness = referenceMediaReadiness(productMediaReadiness, productRecord.media.primaryImageReference);
  const expectedPageRevisionIdentity = `job:${job.jobId}:${job.updatedAt}`;
  const visualBridge = evaluateReferenceApprovalVisualCertificationBridge({
    campaignId: campaign.campaignId,
    expectedJobId: job.jobId,
    expectedWordPressObjectId: job.wordpressObjectId,
    expectedPageRevisionIdentity,
    reviewModel,
  });
  const reviewReadiness = ownerReviewReadiness(job, mediaReadiness, visualBridge.ready);
  const richCompositionReadiness = resolveGlwRichReferenceReadiness({ campaign, job, approvedProductMediaAvailable: mediaReadiness.productAuthorityMediaAvailable });
  const readinessBlocked = (!reviewReadiness?.ready || !richCompositionReadiness?.ready) && !visualBridge.ready;
  if (readinessBlocked) {
    return NextResponse.json(
      {
        error: "Owner-reviewed reference composition requires remediation before approval.",
        code: "REFERENCE_OWNER_REVIEW_REMEDIATION_REQUIRED",
        ownerReviewReadiness: reviewReadiness,
        richCompositionReadiness,
        visualCertificationBridge: { ready: visualBridge.ready, failedChecks: visualBridge.failedChecks },
      },
      { status: 409 },
    );
  }

  if (
    job.status !== "COMPLETE"
    || (job.qaStatus !== "COMPLETE" && job.qaStatus !== "PASSED")
    || job.wordpressStatus !== "draft"
    || !job.wordpressObjectId
    || !featuredImageVerified
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
  recordGlwCampaignLaunchReferenceApproved(campaign.campaignId, job.jobId);

  const exactCampaignTarget = listGlwCampaignTargets(campaign.campaignId).find(
    (candidate) =>
      candidate.stateCode === target.state.code
      && (candidate.citySlug ?? null) === (target.citySlug ?? null),
  ) ?? null;
  let pageRun = exactCampaignTarget
    ? await glwPageRunRepository.getActiveByTarget(exactCampaignTarget.targetId)
    : null;

  if (
    pageRun
    && pageRun.status === "WORDPRESS_DRAFT"
    && pageRun.generationJobId === job.jobId
    && pageRun.wordpressObjectId === job.wordpressObjectId
  ) {
    pageRun = await glwPageRunRepository.transition(pageRun.runId, "WORDPRESS_DRAFT", {
      to: "APPROVED",
    });
  }

  return NextResponse.json({
    state: target.state,
    city: target.cityName ? { name: target.cityName, slug: target.citySlug } : null,
    job,
    pageRun,
    approval,
    approved: true,
  });
}

export async function POST(request: NextRequest, context: Context) {
  const trustedPrincipal = resolveGlwTrustedOperatorPrincipal(request);
  if (!trustedPrincipal.ok) {
    return NextResponse.json({ error: trustedPrincipal.message, code: trustedPrincipal.code, generationJobCreated: false, downstreamSideEffectsPerformed: false }, { status: 503 });
  }
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
    action?: "continue" | "recover_failed_dispatch" | "finalize_recovered_dispatch" | "retry_failed_execution";
    jobId?: string;
    executionId?: string;
    retryRequestId?: string;
    referenceAuthorityBinding?: GlwReferenceGenerationAuthorityBinding;
    ownerGrantId?: string;
    preflightReceiptId?: string;
    ownerOperationType?: GlwReferenceOwnerOperationType;
    failedJobId?: string | null;
    failedArtifactSha256?: string | null;
    recoveryClaimId?: string;
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
  const wordpressAuthority = await inspectSiteWordPressReadAuthority(siteRecord);
  if (wordpressAuthority.authorityHealthState !== "READY") {
    return NextResponse.json(
      {
        error: "Authenticated WordPress read authority is required before generation or continuation.",
        code: "WORDPRESS_READ_AUTHORITY_REQUIRED",
        wordpressAuthority,
        referencePageGenerated: false,
        generationAllowanceConsumed: false,
        leaseCreated: false,
        generationJobCreated: false,
        publicationPerformed: false,
        wordpressMutationPerformed: false,
      },
      { status: 409 },
    );
  }
  const generationAuthority = resolveGlwReferenceGenerationAuthority({ campaign, pack, stateCode: target.state.code });
  if (!generationAuthorityBindingsMatch(generationAuthority, body?.referenceAuthorityBinding)) {
    return NextResponse.json({ error: "Campaign instructions, references, product authority, or QA policy changed. Review current fingerprints before authorization.", code: "REFERENCE_AUTHORITY_BINDING_STALE", generationJobCreated: false }, { status: 409 });
  }
  const failedDispatchRecovery = body?.action === "recover_failed_dispatch" || body?.action === "finalize_recovered_dispatch";
  const terminalExecutionRetry = body?.action === "retry_failed_execution";
  if (!failedDispatchRecovery && !terminalExecutionRetry && (!body?.ownerGrantId || !body.preflightReceiptId || !body.ownerOperationType)) {
    return NextResponse.json({ error: "An exact single-use owner grant and matching preflight receipt are required.", code: "REFERENCE_OWNER_AUTHORITY_REQUIRED", generationJobCreated: false, downstreamSideEffectsPerformed: false }, { status: 409 });
  }
  let ownerClaim: { claimId: string; operationType: GlwReferenceOwnerOperationType; failedJobId: string | null; failedArtifactSha256: string | null };
  if (failedDispatchRecovery || terminalExecutionRetry) {
    const requiresRetryEvidence = failedDispatchRecovery;
    if (!body?.jobId || !body.recoveryClaimId || !body.ownerOperationType || (requiresRetryEvidence && (!body.failedJobId || !body.failedArtifactSha256))) {
      return NextResponse.json({ error: "Exact failed-dispatch recovery identity is required.", code: "REFERENCE_RECOVERY_IDENTITY_REQUIRED", generationJobCreated: false }, { status: 409 });
    }
    if (terminalExecutionRetry && !body.executionId?.trim()) {
      return NextResponse.json({ error: "Exact failed execution identity is required for retry.", code: "REFERENCE_RETRY_EXECUTION_REQUIRED", generationJobCreated: false }, { status: 409 });
    }
    ownerClaim = {
      claimId: body.recoveryClaimId,
      operationType: body.ownerOperationType,
      failedJobId: body.failedJobId ?? null,
      failedArtifactSha256: body.failedArtifactSha256 ?? null,
    };
  } else {
    try {
      const liveOwnerContext = await resolveGlwReferenceOwnerLiveContext({
        organizationId: campaign.organizationId,
        siteId: campaign.siteId,
        campaignId: campaign.campaignId,
        referenceState: target.state.code,
        referenceCitySlug: target.citySlug,
        operationType: body!.ownerOperationType!,
        failedJobId: body!.failedJobId,
        failedArtifactSha256: body!.failedArtifactSha256,
      });
      ownerClaim = consumeGlwReferenceOwnerGrant({
        principal: trustedPrincipal.principal,
        grantId: body!.ownerGrantId!,
        preflightReceiptId: body!.preflightReceiptId!,
        liveContext: liveOwnerContext,
      });
    } catch (error) {
      return NextResponse.json({ error: "Reference owner authority failed closed.", code: error instanceof GlwReferenceOwnerAuthorityError ? error.code : "REFERENCE_OWNER_AUTHORITY_INVALID", generationJobCreated: false, downstreamSideEffectsPerformed: false }, { status: 409 });
    }
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
  form.referenceGenerationClaimContract = generationContext.claimContract;
  form.referenceGenerationAuthority = {
    ...generationContext.referenceAuthority,
    productAuthority: {
      known: generationAuthority.productAuthorityKnown,
      path: generationAuthority.productAuthorityPath,
      anchorText: generationAuthority.productAuthorityAnchorText ?? product.topic,
      authorityScope: "NAVIGATION_AND_PRODUCT_IDENTITY_ONLY",
    },
    localizationPolicy: {
      version: GLW_STATE_LOCALIZATION_CONTAMINATION_POLICY_VERSION,
      expectedStateCode: target.state.code,
      authorizedComparisonStateCodes: [],
    },
  };
  form.campaignId = campaign.campaignId;
  form.referenceAuthorityBinding = generationAuthority;
  form.referenceOwnerAuthorityClaimId = ownerClaim.claimId;
  form.referenceOwnerOperationType = ownerClaim.operationType;
  form.referenceOwnerFailedJobId = ownerClaim.failedJobId;
  form.referenceOwnerFailedArtifactSha256 = ownerClaim.failedArtifactSha256;

  saveGlwReferenceStateSelection({
    campaignId,
    organizationId: campaign.organizationId,
    siteId: campaign.siteId,
    stateCode: target.state.code,
    citySlug: target.citySlug,
    selectedBy: auth.roles.join(","),
    selectedAt: new Date().toISOString(),
  });

  let pageRunId: string | null = null;

  if (
    !failedDispatchRecovery
    && !terminalExecutionRetry
    && body?.action !== "continue"
  ) {
    const exactTarget = listGlwCampaignTargets(campaign.campaignId).find(
      (candidate) =>
        candidate.stateCode === target.state.code
        && (candidate.citySlug ?? null) === (target.citySlug ?? null),
    ) ?? null;

    if (!exactTarget) {
      return NextResponse.json(
        {
          error: "Exact campaign target was not found for PageRun generation.",
          code: "PAGE_RUN_TARGET_NOT_FOUND",
          generationJobCreated: false,
        },
        { status: 409 },
      );
    }

    const activeRun = await glwPageRunRepository.getActiveByTarget(exactTarget.targetId);
    if (activeRun && !isGlwPageRunTerminal(activeRun.status)) {
      return NextResponse.json(
        {
          error: "This target already has an active PageRun.",
          code: "PAGE_RUN_ALREADY_ACTIVE",
          pageRun: activeRun,
          generationJobCreated: false,
        },
        { status: 409 },
      );
    }

    const createdRun = createGlwPageRun({
      runId: randomUUID(),
      identity: {
        targetId: exactTarget.targetId,
        campaignId: campaign.campaignId,
        organizationId: campaign.organizationId,
        siteId: campaign.siteId,
        productId: campaign.productId,
        stateCode: target.state.code,
        citySlug: target.citySlug,
        cityName: target.cityName,
        canonicalPath: form.slug,
      },
      previousRunId: activeRun?.runId ?? null,
    });

    await glwPageRunRepository.create(createdRun);
    pageRunId = createdRun.runId;
  }

  let generationBody: Record<string, unknown> = { form, pageRunId };
  if (failedDispatchRecovery || terminalExecutionRetry) {
    generationBody = {
      action: body!.action,
      jobId: body!.jobId,
      executionId: body!.executionId,
      retryRequestId: body!.retryRequestId,
      form,
    };
  }
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

    if (!isContinuableReferenceJob(existing)) {
      return NextResponse.json(
        {
          error: "Existing reference job is not ready for WordPress continuation.",
          job: existing,
        },
        { status: 409 },
      );
    }

    const targetReady = ensureDraftCampaignContinuationTarget({
      campaign,
      targetStateCode: target.state.code,
      targetCitySlug: target.citySlug,
      referenceJobId: existing.jobId,
      referenceJobStatus: existing.status,
      referenceWordpressObjectId: existing.wordpressObjectId,
    });
    if (!targetReady) {
      return NextResponse.json(
        { error: "Exact campaign target was not found for continuation." },
        { status: 409 },
      );
    }

    generationBody = { action: "continue", jobId, form };
  }

  const generationResponse = await fetch(
    `${request.nextUrl.origin}/api/glw/page-generation`,
    {
      method: "POST",
      headers: forwardOperatorMutationContext(request, {
        "Content-Type": "application/json",
        "x-gcp-roles": "platform_admin",
        "x-gcp-organization-id": campaign.organizationId,
        "x-gcp-site-id": campaign.siteId,
      }),
      body: JSON.stringify(generationBody),
      cache: "no-store",
    },
  );

  const payload = await generationResponse.json().catch(
    () => ({ error: "Reference generation returned malformed JSON." }),
  );

  const launchJob = (payload as { job?: { jobId?: string; status?: string; errorMessage?: string | null } }).job;

  if (pageRunId && !launchJob?.jobId && !generationResponse.ok) {
    const activeRun = await glwPageRunRepository.getById(pageRunId);
    if (activeRun && !isGlwPageRunTerminal(activeRun.status)) {
      await glwPageRunRepository.transition(pageRunId, activeRun.status, {
        to: "FAILED",
        code: String((payload as { code?: unknown }).code ?? "PAGE_RUN_GENERATION_REJECTED"),
        message: String((payload as { error?: unknown }).error ?? "PageRun generation was rejected before a job was created."),
      });
    }
  }
  if (launchJob?.jobId && launchJob.status) {
    reconcileReferenceTargetExecutionProjection({
      campaign,
      stateCode: target.state.code,
      citySlug: target.citySlug,
      execution: {
        jobId: launchJob.jobId,
        status: launchJob.status,
        externalExecutionId: (launchJob as { externalExecutionId?: string | null }).externalExecutionId ?? null,
        wordpressObjectId: (launchJob as { wordpressObjectId?: string | null }).wordpressObjectId ?? null,
        errorCode: (launchJob as { errorCode?: string | null }).errorCode ?? null,
        errorMessage: launchJob.errorMessage ?? null,
      },
    });
  }
  if (launchJob?.status === "COMPLETE" && launchJob.jobId) {
    recordGlwCampaignLaunchReferenceReviewRequired(campaign.campaignId, launchJob.jobId);
  } else if (launchJob?.status === "FAILED") {
    recordGlwCampaignLaunchReferenceFailure(campaign.campaignId, launchJob.errorMessage ?? "Reference generation failed.");
  } else {
    recordGlwCampaignLaunchReferenceStarted(campaign.campaignId, launchJob?.jobId ?? null);
  }

  return NextResponse.json(
    {
      state: target.state,
      city: target.cityName ? { name: target.cityName, slug: target.citySlug } : null,
      ...payload,
    },
    { status: generationResponse.status },
  );
}
