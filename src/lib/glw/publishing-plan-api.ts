import type { NextResponse } from "next/server";
import { createPrismaGlwJobRepository } from "./job-repository";
import { getGlwSite } from "./site-registry";
import {
  buildGlwTargetIdentity,
  createDefaultGlwThrottlePolicy,
  generateGlwDailyPublishPlan,
  resolveGlwProductId,
  resolveGlwStateCode,
  resolveGlwCitySlug,
  summarizeGlwCoverage,
  type GlwDailyPublishPlan,
} from "./publishing-plan";
import {
  getGlwDailyPublishPlan,
  getGlwPublishingControl,
  getLatestGlwDailyPublishPlanForSite,
  markGlwPlanCandidates,
  pauseGlwPublishing,
  resumeGlwPublishing,
  storeGlwDailyPublishPlan,
  updateGlwDailyPublishPlanStatus,
  updateGlwPlanCandidateQueueResult,
} from "./publishing-plan-store";
import { createGlwN8nTransport } from "./n8n";
import { submitGlwPageGenerationJob } from "./page-generation";
import { getGlwSession } from "./auth";
import { GLW_JOB_TIMEOUT_MS, type GlwPageGenerationRequest, type GlwJobRecord } from "./jobs";

export type GlwPublishingPlanDependencies = {
  repository?: ReturnType<typeof createPrismaGlwJobRepository>;
  workflow?: ReturnType<typeof createGlwN8nTransport>;
  sessionLoader?: typeof getGlwSession;
  appUrl?: string;
};

type PlanRequestBody = {
  siteId?: string;
  planId?: string;
  approvedCandidateIds?: string[];
  excludedCandidateIds?: string[];
};

function jsonResponse(body: unknown, status = 200): NextResponse {
  return Response.json(body, { status }) as NextResponse;
}

function planIdFromRequestUrl(request: Request): string {
  try {
    const pathname = new URL(request.url).pathname;
    const segments = pathname.split("/").filter(Boolean);
    const approveIndex = segments.lastIndexOf("approve");
    if (approveIndex > 0) {
      return decodeURIComponent(segments[approveIndex - 1] ?? "").trim();
    }
  } catch {
    // Ignore URL parse failures and fall through to empty plan id.
  }

  return "";
}

function getDependencies(dependencies?: GlwPublishingPlanDependencies) {
  return {
    repository: dependencies?.repository ?? createPrismaGlwJobRepository(),
    workflow: dependencies?.workflow ?? createGlwN8nTransport(),
    sessionLoader: dependencies?.sessionLoader ?? getGlwSession,
    appUrl: dependencies?.appUrl ?? process.env.GLW_APP_URL ?? "http://localhost:3000",
  };
}

async function requireSession(loader: typeof getGlwSession): Promise<Awaited<ReturnType<typeof getGlwSession>>> {
  return loader();
}

function startOfTodayIso(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
}

function oneHourAgoIso(): string {
  return new Date(Date.now() - (60 * 60 * 1000)).toISOString();
}

function latestJobsForSite(jobs: GlwJobRecord[], siteId: string): GlwJobRecord[] {
  return jobs.filter((job) => job.siteId === siteId);
}

function isActiveStatus(status: GlwJobRecord["status"]): boolean {
  return status === "QUEUED" || status === "STARTING" || status === "RUNNING" || status === "GENERATING_CONTENT" || status === "GENERATING_IMAGE" || status === "UPLOADING_IMAGE" || status === "PUBLISHING";
}

function isStaleStartingJob(job: GlwJobRecord, now: Date, startingTimeoutMs: number): boolean {
  if (job.status !== "STARTING") {
    return false;
  }

  if (!job.startedAt) {
    return false;
  }

  const startedAtMs = Date.parse(job.startedAt);
  if (!Number.isFinite(startedAtMs)) {
    return false;
  }

  return now.getTime() - startedAtMs > startingTimeoutMs;
}

export function shouldJobConsumeDispatchCapacity(
  job: GlwJobRecord,
  options?: {
    now?: Date;
    startingTimeoutMs?: number;
  },
): boolean {
  if (!isActiveStatus(job.status)) {
    return false;
  }

  if (job.status !== "STARTING") {
    return true;
  }

  const now = options?.now ?? new Date();
  const timeoutMs = options?.startingTimeoutMs ?? GLW_JOB_TIMEOUT_MS;
  return !isStaleStartingJob(job, now, timeoutMs);
}

export function computeDispatchConcurrency(input: {
  siteJobs: GlwJobRecord[];
  maxConcurrentJobs: number;
  now?: Date;
  startingTimeoutMs?: number;
}): {
  activeCount: number;
  concurrencyRemaining: number;
} {
  const activeCount = input.siteJobs.filter((job) =>
    shouldJobConsumeDispatchCapacity(job, {
      now: input.now,
      startingTimeoutMs: input.startingTimeoutMs,
    })
  ).length;

  return {
    activeCount,
    concurrencyRemaining: Math.max(0, input.maxConcurrentJobs - activeCount),
  };
}

function hasStartedAfter(job: GlwJobRecord, iso: string): boolean {
  const createdAt = Date.parse(job.createdAt);
  const threshold = Date.parse(iso);
  return Number.isFinite(createdAt) && createdAt >= threshold;
}

function canDispatchByDelay(siteJobs: GlwJobRecord[], minimumDelaySeconds: number): boolean {
  if (minimumDelaySeconds <= 0) {
    return true;
  }

  const latest = siteJobs
    .map((job) => Date.parse(job.createdAt))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  if (!latest) {
    return true;
  }

  const minNext = latest + (minimumDelaySeconds * 1000);
  return Date.now() >= minNext;
}

function buildPageRequestFromCandidate(candidate: GlwDailyPublishPlan["candidates"][number], siteId: string): GlwPageGenerationRequest {
  const site = getGlwSite(siteId);
  if (!site) {
    throw new Error(`Unknown GLW site: ${siteId}`);
  }

  const pageType = candidate.citySlug ? "city_service" : "state_service";
  const productTopic = candidate.productSlug;
  const state = candidate.stateName;
  const city = candidate.cityName ?? candidate.stateName;
  const citySlug = candidate.citySlug ?? candidate.stateSlug;
  const hierarchicalSlug = candidate.canonicalPath.split("/").slice(1).join("/");

  const title = candidate.cityName
    ? `${productTopic} in ${candidate.cityName}, ${candidate.stateSlug.toUpperCase()} | ${site.name}`
    : `${productTopic} in ${candidate.stateName} | ${site.name}`;

  return {
    siteId: site.id,
    workspaceId: site.workspaceId,
    pageType,
    productTopic,
    state,
    city,
    citySlug,
    hierarchicalSlug,
    additionalInstructions: candidate.reason,
    title,
    targetSlug: citySlug,
    primaryKeyword: candidate.cityName
      ? `${productTopic} ${candidate.cityName.toLowerCase()}`
      : `${productTopic} ${candidate.stateSlug}`,
    secondaryKeywords: [productTopic, candidate.stateName],
    wordCount: candidate.desiredAction === "UPDATE_CITY" ? 1400 : 1200,
    tone: "Professional",
    audience: "Commercial buyers",
    callToAction: "Request a quote",
    category: productTopic,
    status: site.publishingEnabled ? site.publishingDefaults.defaultStatus : "draft",
  };
}

function candidateDispatchEligible(candidate: GlwDailyPublishPlan["candidates"][number]): boolean {
  return candidate.desiredAction === "CREATE_STATE" || candidate.desiredAction === "CREATE_CITY" || candidate.desiredAction === "UPDATE_CITY";
}

function candidateKey(candidate: GlwDailyPublishPlan["candidates"][number]): string {
  return buildGlwTargetIdentity({
    siteId: candidate.siteId,
    productId: candidate.productId,
    stateCode: candidate.stateSlug.toUpperCase(),
    citySlug: candidate.citySlug,
  });
}

function hasActiveTarget(siteJobs: GlwJobRecord[], candidate: GlwDailyPublishPlan["candidates"][number]): boolean {
  const key = candidateKey(candidate);
  return siteJobs.some((job) => {
    const productId = resolveGlwProductId(job.input.page.productTopic);
    const stateCode = resolveGlwStateCode(job.input.page.state);
    if (!productId || !stateCode) {
      return false;
    }

    const jobKey = buildGlwTargetIdentity({
      siteId: job.siteId,
      productId,
      stateCode,
      citySlug: job.input.page.citySlug ? resolveGlwCitySlug(job.input.page.citySlug) : undefined,
    });
    if (jobKey !== key) {
      return false;
    }

    return isActiveStatus(job.status) || job.status === "COMPLETE";
  });
}

export async function handleGenerateGlwDailyPublishPlan(
  request: Request,
  dependencies?: GlwPublishingPlanDependencies,
): Promise<NextResponse> {
  const d = getDependencies(dependencies);
  const session = await requireSession(d.sessionLoader);
  if (!session) {
    return jsonResponse({ error: "GLW session is required." }, 401);
  }

  const body = (await request.json().catch(() => null)) as PlanRequestBody | null;
  const siteId = typeof body?.siteId === "string" && body.siteId.trim() ? body.siteId.trim() : "led-display-warehouse";

  const site = getGlwSite(siteId);
  const control = await getGlwPublishingControl(siteId, site?.publishingEnabled ?? true);
  const jobs = latestJobsForSite(await d.repository.findPageGenerationJobs(2000), siteId);
  const plan = generateGlwDailyPublishPlan({
    siteId,
    existingJobs: jobs,
    limits: createDefaultGlwThrottlePolicy(siteId),
  });

  const persistedPlan = await storeGlwDailyPublishPlan(plan);
  const coverage = summarizeGlwCoverage({
    siteId,
    existingJobs: jobs,
    approvedCandidates: persistedPlan.approved,
  });

  return jsonResponse({
    control,
    coverage,
    plan: persistedPlan,
  });
}

export async function handleGetGlwDailyPublishPlan(
  request: Request,
  dependencies?: GlwPublishingPlanDependencies,
): Promise<NextResponse> {
  const d = getDependencies(dependencies);
  const session = await requireSession(d.sessionLoader);
  if (!session) {
    return jsonResponse({ error: "GLW session is required." }, 401);
  }

  const url = new URL(request.url);
  const siteId = url.searchParams.get("siteId")?.trim() || "led-display-warehouse";
  const planId = url.searchParams.get("planId")?.trim();

  const site = getGlwSite(siteId);
  const control = await getGlwPublishingControl(siteId, site?.publishingEnabled ?? true);
  const jobs = latestJobsForSite(await d.repository.findPageGenerationJobs(2000), siteId);

  let plan = planId ? await getGlwDailyPublishPlan(planId) : null;
  if (!plan) {
    plan = await getLatestGlwDailyPublishPlanForSite(siteId);
  }

  if (!plan) {
    const generated = generateGlwDailyPublishPlan({
      siteId,
      existingJobs: jobs,
      limits: createDefaultGlwThrottlePolicy(siteId),
    });
    plan = await storeGlwDailyPublishPlan(generated);
  }

  const coverage = summarizeGlwCoverage({
    siteId,
    existingJobs: jobs,
    approvedCandidates: plan.approved,
  });

  return jsonResponse({
    control,
    coverage,
    plan,
  });
}

export async function handleApproveGlwDailyPublishPlan(
  request: Request,
  dependencies?: GlwPublishingPlanDependencies,
): Promise<NextResponse> {
  const d = getDependencies(dependencies);
  const session = await requireSession(d.sessionLoader);
  if (!session) {
    return jsonResponse({ error: "GLW session is required." }, 401);
  }

  const body = (await request.json().catch(() => null)) as PlanRequestBody | null;
  const planId = typeof body?.planId === "string" && body.planId.trim()
    ? body.planId.trim()
    : planIdFromRequestUrl(request);
  if (!planId) {
    return jsonResponse({ error: "Plan id is required." }, 400);
  }

  const plan = await getGlwDailyPublishPlan(planId);
  if (!plan) {
    return jsonResponse({ error: "Plan not found." }, 404);
  }

  const site = getGlwSite(plan.siteId);
  if (!site) {
    return jsonResponse({ error: `Unknown site ${plan.siteId}.` }, 404);
  }

  const control = await getGlwPublishingControl(plan.siteId, site.publishingEnabled);
  const approvedIds = body?.approvedCandidateIds
    ?? (plan.approved.length > 0
      ? plan.approved.map((candidate) => candidate.canonicalPath)
      : plan.candidates
        .filter((candidate) => candidateDispatchEligible(candidate))
        .map((candidate) => candidate.canonicalPath));
  const excludedIds = body?.excludedCandidateIds ?? plan.blocked.map((candidate) => candidate.canonicalPath);

  await markGlwPlanCandidates(plan.planId, {
    approvedCandidateIds: approvedIds,
    excludedCandidateIds: excludedIds,
  });
  await updateGlwDailyPublishPlanStatus(plan.planId, "APPROVED");

  const refreshed = await getGlwDailyPublishPlan(plan.planId);
  if (!refreshed) {
    return jsonResponse({ error: "Plan disappeared after approval update." }, 500);
  }

  if (!control.publishingEnabled) {
    return jsonResponse({
      plan: refreshed,
      dispatched: [],
      skipped: refreshed.approved.map((candidate) => ({
        canonicalPath: candidate.canonicalPath,
        reason: "BLOCKED_SITE",
      })),
    });
  }

  if (control.paused) {
    return jsonResponse({
      plan: refreshed,
      dispatched: [],
      skipped: refreshed.approved.map((candidate) => ({
        canonicalPath: candidate.canonicalPath,
        reason: "PAUSED",
      })),
    });
  }

  const siteJobs = latestJobsForSite(await d.repository.findPageGenerationJobs(2000), refreshed.siteId);
  const { activeCount, concurrencyRemaining } = computeDispatchConcurrency({
    siteJobs,
    maxConcurrentJobs: refreshed.limits.maxConcurrentJobs,
  });
  const todayCount = siteJobs.filter((job) => hasStartedAfter(job, startOfTodayIso())).length;
  const lastHourCount = siteJobs.filter((job) => hasStartedAfter(job, oneHourAgoIso())).length;

  const dailyRemaining = Math.max(0, refreshed.limits.dailyPageLimit - todayCount);
  const hourlyRemaining = Math.max(0, refreshed.limits.hourlyPageLimit - lastHourCount);

  let budget = Math.min(dailyRemaining, hourlyRemaining, concurrencyRemaining);
  const dispatched: Array<{ canonicalPath: string; jobId: string; executionId: string | null }> = [];
  const skipped: Array<{ canonicalPath: string; reason: string }> = [];

  for (const candidate of refreshed.approved) {
    if (!candidateDispatchEligible(candidate)) {
      skipped.push({ canonicalPath: candidate.canonicalPath, reason: "NOT_DISPATCHABLE_ACTION" });
      continue;
    }

    if (budget <= 0) {
      skipped.push({ canonicalPath: candidate.canonicalPath, reason: "THROTTLE_LIMIT" });
      continue;
    }

    const currentSiteJobs = latestJobsForSite(await d.repository.findPageGenerationJobs(2000), refreshed.siteId);
    if (!canDispatchByDelay(currentSiteJobs, refreshed.limits.minimumDelaySeconds)) {
      skipped.push({ canonicalPath: candidate.canonicalPath, reason: "MINIMUM_DELAY" });
      continue;
    }

    if (hasActiveTarget(currentSiteJobs, candidate)) {
      skipped.push({ canonicalPath: candidate.canonicalPath, reason: "SKIPPED_ALREADY_QUEUED" });
      await updateGlwPlanCandidateQueueResult(refreshed.planId, candidate.canonicalPath, {
        approvalStatus: "SKIPPED_ALREADY_QUEUED",
      });
      continue;
    }

    const requestBody = buildPageRequestFromCandidate(candidate, refreshed.siteId);
    const result = await submitGlwPageGenerationJob(requestBody, {
      repository: d.repository,
      workflow: d.workflow,
      appUrl: d.appUrl,
    });

    dispatched.push({
      canonicalPath: candidate.canonicalPath,
      jobId: result.job.id,
      executionId: result.job.externalExecutionId,
    });

    await updateGlwPlanCandidateQueueResult(refreshed.planId, candidate.canonicalPath, {
      approvalStatus: "QUEUED",
      queueJobId: result.job.id,
    });

    budget -= 1;
  }

  if (dispatched.length > 0) {
    await updateGlwDailyPublishPlanStatus(refreshed.planId, "EXECUTING");
  }

  const after = await getGlwDailyPublishPlan(refreshed.planId);
  const coverage = summarizeGlwCoverage({
    siteId: refreshed.siteId,
    existingJobs: latestJobsForSite(await d.repository.findPageGenerationJobs(2000), refreshed.siteId),
    approvedCandidates: after?.approved ?? refreshed.approved,
  });

  return jsonResponse({
    control,
    plan: after ?? refreshed,
    dispatched,
    skipped,
    throttle: {
      dailyRemaining,
      hourlyRemaining,
      concurrencyRemaining,
    },
    coverage,
  });
}

export async function handlePauseGlwPublishing(
  request: Request,
  dependencies?: GlwPublishingPlanDependencies,
): Promise<NextResponse> {
  const d = getDependencies(dependencies);
  const session = await requireSession(d.sessionLoader);
  if (!session) {
    return jsonResponse({ error: "GLW session is required." }, 401);
  }

  const body = (await request.json().catch(() => null)) as PlanRequestBody | null;
  const siteId = typeof body?.siteId === "string" && body.siteId.trim() ? body.siteId.trim() : "led-display-warehouse";

  const pausedBy = typeof session.email === "string" ? session.email : null;
  const control = await pauseGlwPublishing(siteId, pausedBy ?? undefined);
  const latestPlan = await getLatestGlwDailyPublishPlanForSite(siteId);
  if (latestPlan && latestPlan.status !== "COMPLETE") {
    await updateGlwDailyPublishPlanStatus(latestPlan.planId, "PAUSED");
  }

  return jsonResponse({ control });
}

export async function handleResumeGlwPublishing(
  request: Request,
  dependencies?: GlwPublishingPlanDependencies,
): Promise<NextResponse> {
  const d = getDependencies(dependencies);
  const session = await requireSession(d.sessionLoader);
  if (!session) {
    return jsonResponse({ error: "GLW session is required." }, 401);
  }

  const body = (await request.json().catch(() => null)) as PlanRequestBody | null;
  const siteId = typeof body?.siteId === "string" && body.siteId.trim() ? body.siteId.trim() : "led-display-warehouse";

  const control = await resumeGlwPublishing(siteId);
  const latestPlan = await getLatestGlwDailyPublishPlanForSite(siteId);
  if (latestPlan && latestPlan.status === "PAUSED") {
    await updateGlwDailyPublishPlanStatus(latestPlan.planId, "APPROVED");
  }

  return jsonResponse({ control });
}
