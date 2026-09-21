import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  authorizeRequest,
  forwardOperatorMutationContext,
  hasOrganizationScope,
  resolveRequestPrincipal,
  resolveRequestScope,
} from "@/modules/foundation/api-auth";
import { createAuthenticatedWordPressReadAuthority } from "@/modules/foundation/authenticated-wordpress-read-authority";
import { getProductById } from "@/modules/foundation/product-repository";
import { getSiteById } from "@/modules/foundation/site-repository";
import { resolveWordPressCredentialReference } from "@/modules/foundation/wordpress-credential-resolver";
import {
  buildGlwCampaignProductionGenerationForm,
} from "@/modules/glw/campaign-production-generation";
import { listGlwCampaigns } from "@/modules/glw/campaign-repository";
import {
  attachGlwCampaignTargetJob,
  leaseGlwCampaignTargets,
  listGlwCampaignTargets,
  previewGlwCampaignTargetLease,
  summarizeGlwCampaignTargets,
} from "@/modules/glw/campaign-target-repository";
import { recordGlwCampaignLaunchDispatch } from "@/modules/glw/campaign-launch-authority";
import { resolveGlwCampaignActivationReleaseCapability } from "@/modules/glw/campaign-release-capability";
import { getGlwN8nMcpConfigurationStatus, preflightGlwN8nMcpExecution } from "@/modules/glw/n8n-mcp-adapter";
import { glwPageExecutionRepository } from "@/modules/glw/page-execution-repository";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  buildLocalGlwGenerationPreview,
} from "@/modules/glw/page-generation";
import {
  appendDispatchRequestOutcome,
  authorizeExactTargetDispatchRequest,
  saveExactTargetDispatchPreflight,
} from "@/modules/glw/exact-target-dispatch-authority";
import { readGlwTargetPreflight, resolveGlwTargetMutationAvailability } from "@/modules/glw/target-preflight";

const MAX_CONCURRENT_EXECUTION = 1;
const EXACT_RELEASE_PATTERN = /^[0-9a-f]{40}$/;

type Context = {
  params: Promise<{ campaignId: string }>;
};

function resolveDispatchDate(
  request: NextRequest,
  allowOverride = true,
): string {
  const requested = request.nextUrl.searchParams
    .get("dispatchDate")
    ?.trim();

  if (requested) {
    if (!allowOverride) {
      throw new Error("Dispatch date cannot be overridden for a mutating scheduler request.");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(requested)) {
      throw new Error(
        "dispatchDate must use YYYY-MM-DD.",
      );
    }

    return requested;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function findScopedCampaign(input: {
  campaignId: string;
  organizationId: string;
  siteId?: string;
}) {
  return listGlwCampaigns().find(
    (candidate) =>
      candidate.campaignId === input.campaignId
      && candidate.organizationId === input.organizationId
      && (
        !input.siteId
        || candidate.siteId === input.siteId
      ),
  ) ?? null;
}

function targetIdentity(target: {
  stateCode: string;
  citySlug?: string | null;
}) {
  return {
    stateCode: target.stateCode,
    citySlug: target.citySlug ?? null,
  };
}

function resolveReleaseCapability(campaign: { organizationId: string; siteId: string }) {
  const candidate = process.env.GIT_COMMIT?.trim().toLowerCase() ?? "";
  const runningReleaseSha = EXACT_RELEASE_PATTERN.test(candidate) ? candidate : null;
  return {
    runningReleaseSha,
    capability: resolveGlwCampaignActivationReleaseCapability({
      organizationId: campaign.organizationId,
      siteId: campaign.siteId,
      runningReleaseSha: runningReleaseSha ?? "",
    }),
  };
}

function resolveWordPressReadiness(campaign: { organizationId: string; siteId: string }) {
  const site = getSiteById(campaign.siteId);
  const scoped = site?.organizationId === campaign.organizationId;
  const ready = Boolean(
    scoped
    && site?.enabled
    && site.lifecycleState === "active"
    && site.publishingStatus === "ready"
    && site.integrations.wordpressApiBaseUrl
    && site.integrations.wordpressCredentialReference,
  );
  return {
    ready,
    siteId: campaign.siteId,
    apiConfigured: Boolean(scoped && site?.integrations.wordpressApiBaseUrl),
    credentialReferenceConfigured: Boolean(scoped && site?.integrations.wordpressCredentialReference),
    reason: ready ? null : "Exact active site WordPress authority is unavailable.",
  };
}

export async function GET(
  request: NextRequest,
  context: Context,
) {
  const auth = authorizeRequest(
    request,
    "schedules:read",
  );

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const scope = resolveRequestScope(request);
  const organizationId = scope.organizationId;
  const principal = resolveRequestPrincipal(request);

  if (!hasOrganizationScope(scope) || !organizationId) {
    return NextResponse.json(
      { error: "Organization scope is required." },
      { status: 403 },
    );
  }
  if (!principal) return NextResponse.json({ error: "Exact authenticated principal and session are required." }, { status: 403 });

  const { campaignId } = await context.params;

  const campaign = findScopedCampaign({
    campaignId,
    organizationId,
    siteId: scope.siteId ?? undefined,
  });

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found." },
      { status: 404 },
    );
  }

  if (campaign.status !== "active") {
    return NextResponse.json(
      {
        error:
          "Only active campaigns have a production schedule.",
      },
      { status: 409 },
    );
  }

  let dispatchDate: string;

  try {
    dispatchDate = resolveDispatchDate(request);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid dispatch date.",
      },
      { status: 400 },
    );
  }

  const queue = summarizeGlwCampaignTargets(
    campaign.campaignId,
  );
  const availableConcurrency = Math.max(0, MAX_CONCURRENT_EXECUTION - queue.running);

  const preview = previewGlwCampaignTargetLease({
    campaignId: campaign.campaignId,
    pagesPerDay: campaign.pagesPerDay,
    dispatchDate,
    maxTargets: availableConcurrency,
  });
  const releaseAuthority = resolveReleaseCapability(campaign);
  const wordpressReadiness = resolveWordPressReadiness(campaign);
  const executionPreflight = await preflightGlwN8nMcpExecution();
  const selectedTarget = preview.selected.length === 1 ? preview.selected[0] : null;
  let dispatchPreflight = null;
  if (
    selectedTarget
    && wordpressReadiness.ready
    && executionPreflight.ready
    && availableConcurrency > 0
    && preview.allowance > 0
  ) {
    dispatchPreflight = saveExactTargetDispatchPreflight({
      campaign,
      target: selectedTarget,
      runtimeSha: releaseAuthority.runningReleaseSha ?? "",
      principal,
      dailyAllowanceBefore: preview.allowance,
      readiness: {
        releaseAuthorityReady: true,
        wordpressAuthorityReady: true,
        mcpReady: true,
        n8nReady: true,
        concurrencyReady: true,
      },
    });
  }

  return NextResponse.json({
    campaign: {
      campaignId: campaign.campaignId,
      pageType: campaign.pageType,
      status: campaign.status,
      pagesPerDay: campaign.pagesPerDay,
      publicationPolicy:
        campaign.publicationPolicy,
    },
    dispatchDate,
    queue,
    schedule: {
      dailyLimit: campaign.pagesPerDay,
      maxConcurrentExecution: MAX_CONCURRENT_EXECUTION,
      availableConcurrency,
      alreadyDispatchedToday:
        preview.alreadyDispatchedToday,
      remainingAllowance: preview.allowance,
      nextTargets: preview.selected.map(
        (target) => ({
          targetId: target.targetId,
          stateCode: target.stateCode,
          citySlug: target.citySlug ?? null,
          cityName: target.cityName ?? null,
          status: target.status,
        }),
      ),
    },
    releaseAuthority,
    wordpressReadiness,
    executionReadiness: getGlwN8nMcpConfigurationStatus(),
    executionPreflight,
    dispatchPreflight,
    ownerAuthorizationRequired: true,
    dryRun: true,
  });
}

export async function POST(
  request: NextRequest,
  context: Context,
) {
  const auth = authorizeRequest(
    request,
    "schedules:create",
  );

  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status },
    );
  }

  const scope = resolveRequestScope(request);
  const organizationId = scope.organizationId;
  const principal = resolveRequestPrincipal(request);

  if (!hasOrganizationScope(scope) || !organizationId) {
    return NextResponse.json(
      { error: "Organization scope is required." },
      { status: 403 },
    );
  }
  if (!principal) return NextResponse.json({ error: "Exact authenticated principal and session are required.", code: "OWNER_DISPATCH_PRINCIPAL_REQUIRED" }, { status: 403 });

  const { campaignId } = await context.params;

  const campaign = findScopedCampaign({
    campaignId,
    organizationId,
    siteId: scope.siteId ?? undefined,
  });

  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign not found." },
      { status: 404 },
    );
  }

  if (campaign.status !== "active") {
    return NextResponse.json(
      {
        error:
          "Only active campaigns can dispatch production targets.",
      },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null) as {
    confirm?: string;
    preflightReceiptId?: string;
    ownerDispatchGrantId?: string;
    targetId?: string;
  } | null;
  if (body?.confirm !== "AUTHORIZE_AND_DISPATCH_EXACT_TARGET" || !body.preflightReceiptId?.trim() || !body.ownerDispatchGrantId?.trim() || !body.targetId?.trim()) {
    return NextResponse.json({ error: "Exact preflight receipt, owner dispatch grant, target, and confirmation are required.", code: "OWNER_EXACT_TARGET_DISPATCH_AUTHORITY_REQUIRED" }, { status: 403 });
  }

  let dispatchDate: string;
  try {
    dispatchDate = resolveDispatchDate(request, false);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid dispatch date." }, { status: 400 });
  }
  const campaignTargets = listGlwCampaignTargets(campaign.campaignId);
  const target = campaignTargets.find((candidate) => candidate.targetId === body.targetId) ?? null;
  if (!target) return NextResponse.json({ error: "Exact campaign target was not found.", code: "OWNER_DISPATCH_TARGET_NOT_FOUND" }, { status: 404 });
  const allowanceBefore = Math.max(0, campaign.pagesPerDay - campaignTargets.filter((candidate) => candidate.dispatchDate === dispatchDate).length);
  const releaseAuthority = resolveReleaseCapability(campaign);
  let authorization;
  try {
    authorization = authorizeExactTargetDispatchRequest({
      preflightReceiptId: body.preflightReceiptId,
      ownerDispatchGrantId: body.ownerDispatchGrantId,
      campaign,
      target,
      runtimeSha: releaseAuthority.runningReleaseSha ?? "",
      principal,
      confirmationMode: body.confirm,
      route: request.nextUrl.pathname,
      allowanceBefore,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Owner dispatch authority invalid.", code: "OWNER_EXACT_TARGET_DISPATCH_AUTHORITY_INVALID" }, { status: 403 });
  }
  const requestReceiptId = authorization.requestReceipt.requestReceiptId;
  const fail = (code: string, error: string, status = 503, patch: Parameters<typeof appendDispatchRequestOutcome>[0]["patch"] = {}) => {
    appendDispatchRequestOutcome({ requestReceiptId, patch: { ...patch, outcome: "FAILED" } });
    return NextResponse.json({ error, code, requestReceiptId }, { status });
  };
  if (!releaseAuthority.capability.ready) {
    return fail("GLW_CAMPAIGN_RELEASE_CAPABILITY_REQUIRED", "Campaign dispatch release capability is required.", 503, { releaseAuthorityResult: "FAIL" });
  }
  const wordpressReadiness = resolveWordPressReadiness(campaign);
  if (!wordpressReadiness.ready) return fail("GLW_WORDPRESS_AUTHORITY_REQUIRED", wordpressReadiness.reason ?? "WordPress authority unavailable.", 503, { releaseAuthorityResult: "PASS", wordpressAuthorityResult: "FAIL" });
  const executionReadiness = getGlwN8nMcpConfigurationStatus();
  if (!executionReadiness.configured) return fail("GLW_N8N_MCP_NOT_CONFIGURED", "GLW n8n MCP execution is not configured.", 503, { releaseAuthorityResult: "PASS", wordpressAuthorityResult: "PASS", mcpPreflightResult: "FAIL" });
  const executionPreflight = await preflightGlwN8nMcpExecution();
  if (!executionPreflight.ready) return fail("GLW_N8N_MCP_PREFLIGHT_FAILED", executionPreflight.reason ?? "MCP preflight failed.", 503, { releaseAuthorityResult: "PASS", wordpressAuthorityResult: "PASS", mcpPreflightResult: "FAIL" });
  appendDispatchRequestOutcome({ requestReceiptId, patch: { releaseAuthorityResult: "PASS", wordpressAuthorityResult: "PASS", mcpPreflightResult: "PASS" } });
  const queueBeforeDispatch = summarizeGlwCampaignTargets(campaign.campaignId);
  if (queueBeforeDispatch.running >= MAX_CONCURRENT_EXECUTION) return fail("GLW_CAMPAIGN_CONCURRENCY_LIMIT_REACHED", "Campaign already has the maximum number of running targets.", 409);
  const preview = previewGlwCampaignTargetLease({ campaignId: campaign.campaignId, pagesPerDay: campaign.pagesPerDay, dispatchDate, maxTargets: 1 });
  if (preview.allowance < 1) return fail("GLW_CAMPAIGN_DAILY_ALLOWANCE_EXHAUSTED", "Campaign daily allowance is exhausted.", 409);
  if (preview.selected.length !== 1 || preview.selected[0].targetId !== target.targetId) return fail("OWNER_DISPATCH_TARGET_NOT_CURRENT", "Exact authorized target is not the current deterministic eligible target.", 409);

  const siteRecord = getSiteById(campaign.siteId);
  const productRecord = getProductById(campaign.productId);
  if (!siteRecord || !productRecord || siteRecord.organizationId !== campaign.organizationId || productRecord.organizationId !== campaign.organizationId) {
    return fail("GLW_TARGET_MUTATION_AUTHORITY_REQUIRED", "Campaign site and product authority are unavailable.", 409);
  }

  const generationSite = adaptSiteForGeneration(siteRecord);
  const generationProduct = adaptProductForGeneration(productRecord, siteRecord.siteId);
  const { form: candidateForm } = buildGlwCampaignProductionGenerationForm({
    campaign,
    stateCode: target.stateCode,
    citySlug: target.citySlug,
  });

  const previewInput = buildLocalGlwGenerationPreview({
    form: candidateForm,
    sites: [generationSite],
    products: [generationProduct],
  });
  if (!previewInput.request) {
    return fail("GLW_TARGET_MUTATION_AUTHORITY_REQUIRED", "Exact canonical target generation input is invalid.", 409);
  }

  let wordpressReadAuthority: ReturnType<typeof createAuthenticatedWordPressReadAuthority> | null = null;
  try {
    const credential = resolveWordPressCredentialReference(siteRecord.integrations.wordpressCredentialReference);
    wordpressReadAuthority = createAuthenticatedWordPressReadAuthority({
      configuration: {
        apiBaseUrl: siteRecord.integrations.wordpressApiBaseUrl,
        username: credential.username,
        applicationPassword: credential.applicationPassword,
        timeoutMs: 30_000,
      },
    });
  } catch {
    return fail("GLW_WORDPRESS_AUTHORITY_REQUIRED", "Exact active site WordPress authority is unavailable.", 503, { releaseAuthorityResult: "PASS", wordpressAuthorityResult: "FAIL" });
  }

  const targetPreflight = await readGlwTargetPreflight({
    request: previewInput.request,
    wordpressReadAuthority,
    localExecutions: await glwPageExecutionRepository.list(),
  });
  const mutationAvailability = resolveGlwTargetMutationAvailability(targetPreflight, previewInput.request.pageType);
  if (!targetPreflight.canonicalParentId || !mutationAvailability.plannedOperation) {
    return fail("GLW_TARGET_MUTATION_AUTHORITY_REQUIRED", mutationAvailability.message, 409);
  }

  const form = {
    ...candidateForm,
    plannedOperation: mutationAvailability.plannedOperation,
    wordpressObjectId: mutationAvailability.wordpressObjectId ?? null,
  };

  const leaseId = randomUUID();
  const leased = leaseGlwCampaignTargets({ campaignId: campaign.campaignId, pagesPerDay: campaign.pagesPerDay, dispatchDate, leaseId, maxTargets: 1, maxConcurrentExecution: MAX_CONCURRENT_EXECUTION });
  if (leased.length !== 1 || leased[0].targetId !== target.targetId) return fail("OWNER_DISPATCH_LEASE_MISMATCH", "Exact authorized target was not leased.", 409);
  appendDispatchRequestOutcome({ requestReceiptId, patch: { leaseId, allowanceAfter: Math.max(0, preview.allowance - 1), outcome: "LEASED" } });

  const results: Array<Record<string, unknown>> = [];

  for (const target of leased) {
    try {
      if (form.publicationIntent !== "draft") {
        throw new Error(
          "Production campaign executor rejected non-draft publication intent.",
        );
      }

      const generationResponse = await fetch(
        `${request.nextUrl.origin}/api/glw/page-generation`,
        {
          method: "POST",
          headers: forwardOperatorMutationContext(request, {
            "Content-Type": "application/json",
            "x-gcp-organization-id":
              campaign.organizationId,
            "x-gcp-site-id": campaign.siteId,
          }),
          body: JSON.stringify({ form }),
          cache: "no-store",
        },
      );

      const payload = await generationResponse
        .json()
        .catch(() => null) as {
          job?: {
            jobId?: string;
            status?: string;
            errorMessage?: string | null;
            externalExecutionId?: string | null;
          };
          error?: string;
        } | null;

      const jobId = payload?.job?.jobId?.trim() ?? "";

      if (!generationResponse.ok || !jobId) {
        throw new Error(
          payload?.error
          ?? `Generation dispatch failed with HTTP ${generationResponse.status}.`,
        );
      }

      appendDispatchRequestOutcome({ requestReceiptId, patch: { jobId, externalExecutionId: payload?.job?.externalExecutionId ?? null, outcome: payload?.job?.status === "FAILED" ? "FAILED" : "DISPATCHED" } });

      attachGlwCampaignTargetJob({
        campaignId: campaign.campaignId,
        stateCode: target.stateCode,
        citySlug: target.citySlug,
        leaseId,
        jobId,
      });

      if (payload?.job?.status === "FAILED") {
        results.push({
          ...targetIdentity(target),
          cityName: target.cityName ?? null,
          targetId: target.targetId,
          status: "dispatch_error",
          jobId,
          error: payload.job.errorMessage ?? "Generation failed before an external execution was created.",
        });
        continue;
      }

      results.push({
        ...targetIdentity(target),
        cityName: target.cityName ?? null,
        targetId: target.targetId,
        status: "dispatched",
        jobId,
        generationStatus:
          payload?.job?.status ?? null,
      });
    } catch (error) {
      appendDispatchRequestOutcome({ requestReceiptId, patch: { outcome: "FAILED" } });
      results.push({
        ...targetIdentity(target),
        cityName: target.cityName ?? null,
        targetId: target.targetId,
        status: "dispatch_error",
        error:
          error instanceof Error
            ? error.message
            : "Unknown campaign dispatch error.",
      });
    }
  }

  recordGlwCampaignLaunchDispatch(
    campaign.campaignId,
    results.filter((entry) => entry.status === "dispatch_error").length,
  );

  return NextResponse.json({
    campaignId: campaign.campaignId,
    dispatchDate,
    leaseId,
    leasedCount: leased.length,
    dispatchedCount: results.filter(
      (entry) => entry.status === "dispatched",
    ).length,
    errorCount: results.filter(
      (entry) => entry.status === "dispatch_error",
    ).length,
    results,
    queue: summarizeGlwCampaignTargets(
      campaign.campaignId,
    ),
    executionMode:
      "owner_exact_target_dispatch",
    requestReceiptId,
    publicationIntent: "draft",
    publicationPerformed: false,
  });
}
