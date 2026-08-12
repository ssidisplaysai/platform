import type { GlwJobRecord } from "./jobs";
import { GLW_CITY_REGISTRY, GLW_STATE_REGISTRY, getGlwEnabledCities } from "./geo-registry";
import { GLW_PRODUCT_REGISTRY } from "./product-registry";
import { getGlwSite } from "./site-registry";

export type GlwThrottlePolicy = {
  dailyPageLimit: number;
  hourlyPageLimit: number;
  maxConcurrentJobs: number;
  retryLimit: number;
  productRotation: string[];
  stateRotation: string[];
  minimumDelaySeconds: number;
};

export type GlwDailyPublishPlanStatus = "DRAFT" | "APPROVED" | "PAUSED" | "EXECUTING" | "COMPLETE";

export type GlwPlanAction =
  | "CREATE_STATE"
  | "CREATE_CITY"
  | "UPDATE_CITY"
  | "SKIP_EXISTING"
  | "BLOCKED_PARENT"
  | "BLOCKED_DUPLICATE"
  | "BLOCKED_QA"
  | "BLOCKED_SITE";

export type GlwDailyPublishPlanCandidate = {
  siteId: string;
  productId: string;
  productSlug: string;
  stateName: string;
  stateSlug: string;
  cityName?: string;
  citySlug?: string;
  canonicalPath: string;
  desiredAction: GlwPlanAction;
  priority: number;
  reason: string;
  existingWordPressId?: string | number;
  existingStatus?: string;
  parentProductId?: string;
  parentStateId?: string;
};

export type GlwDailyPublishPlan = {
  planId: string;
  siteId: string;
  generatedAt: string;
  status: GlwDailyPublishPlanStatus;
  limits: GlwThrottlePolicy;
  candidates: GlwDailyPublishPlanCandidate[];
  approved: GlwDailyPublishPlanCandidate[];
  blocked: GlwDailyPublishPlanCandidate[];
  summary: {
    totalCandidates: number;
    approvedCount: number;
    blockedCount: number;
    queuedToday: number;
    running: number;
    qaFailed: number;
    duplicates: number;
    missing: number;
  };
};

export type GlwCoverageSummary = {
  siteId: string;
  enabledProducts: number;
  enabledStates: number;
  enabledCities: number;
  theoreticalTargets: number;
  existingPublished: number;
  existingDraft: number;
  missing: number;
  duplicates: number;
  wrongParent: number;
  qaFailed: number;
  coveragePercent: number;
  theoreticalStateTargets: number;
  theoreticalCityTargets: number;
  approvedQueueCoverage: number;
  publishedCoverage: number;
};

export type GlwPlanTargetIndex = {
  statePage: Map<string, GlwJobRecord>;
  cityPage: Map<string, GlwJobRecord>;
  duplicates: Set<string>;
};

function normalizeToken(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export function resolveGlwProductId(value: string | null | undefined): string | null {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return null;
  }

  const direct = GLW_PRODUCT_REGISTRY.find((product) => normalizeToken(product.id) === normalized);
  if (direct) {
    return direct.id;
  }

  const canonical = GLW_PRODUCT_REGISTRY.find((product) => normalizeToken(product.canonicalTopic) === normalized);
  if (canonical) {
    return canonical.id;
  }

  const byName = GLW_PRODUCT_REGISTRY.find((product) => normalizeToken(product.name) === normalized);
  return byName?.id ?? null;
}

export function resolveGlwStateCode(value: string | null | undefined): string | null {
  const normalized = normalizeToken(value);
  if (!normalized) {
    return null;
  }

  const byCode = GLW_STATE_REGISTRY.find((state) => normalizeToken(state.code) === normalized);
  if (byCode) {
    return byCode.code;
  }

  const byName = GLW_STATE_REGISTRY.find((state) => normalizeToken(state.name) === normalized);
  return byName?.code ?? null;
}

export function resolveGlwCitySlug(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function buildGlwTargetIdentity(input: {
  siteId: string;
  productId: string;
  stateCode: string;
  citySlug?: string;
}): string {
  return [
    input.siteId.trim().toLowerCase(),
    input.productId.trim().toLowerCase(),
    input.stateCode.trim().toLowerCase(),
    input.citySlug ? resolveGlwCitySlug(input.citySlug) : "",
  ].join("|");
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createDefaultGlwThrottlePolicy(siteId: string): GlwThrottlePolicy {
  const site = getGlwSite(siteId);
  const defaults = site?.publishingDefaults;

  return {
    dailyPageLimit: defaults?.dailyPageLimit ?? 25,
    hourlyPageLimit: defaults?.hourlyPageLimit ?? 5,
    maxConcurrentJobs: defaults?.maxConcurrentJobs ?? 2,
    retryLimit: defaults?.retryLimit ?? 2,
    productRotation: defaults?.productRotation ?? GLW_PRODUCT_REGISTRY.map((product) => product.id),
    stateRotation: defaults?.stateRotation ?? GLW_STATE_REGISTRY.map((state) => state.code),
    minimumDelaySeconds: 180,
  };
}

function stableRotation<T extends { id?: string; code?: string; priority?: number }>(items: T[], rotation: string[]): T[] {
  const order = new Map(rotation.map((value, index) => [value, index]));
  return [...items].sort((left, right) => {
    const leftKey = left.id ?? left.code ?? "";
    const rightKey = right.id ?? right.code ?? "";
    const leftIndex = order.has(leftKey) ? order.get(leftKey)! : Number.MAX_SAFE_INTEGER;
    const rightIndex = order.has(rightKey) ? order.get(rightKey)! : Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return (left.priority ?? 0) - (right.priority ?? 0) || leftKey.localeCompare(rightKey);
  });
}

function getJobTargetKey(job: GlwJobRecord): string {
  const page = job.input.page;
  const productId = resolveGlwProductId(page.productTopic);
  const stateCode = resolveGlwStateCode(page.state);
  if (!productId || !stateCode) {
    return "";
  }

  const citySlug = page.citySlug || page.city;
  return buildGlwTargetIdentity({
    siteId: job.siteId,
    productId,
    stateCode,
    citySlug: citySlug || undefined,
  });
}

export function indexGlwExistingJobs(jobs: GlwJobRecord[]): GlwPlanTargetIndex {
  const statePage = new Map<string, GlwJobRecord>();
  const cityPage = new Map<string, GlwJobRecord>();
  const counts = new Map<string, number>();

  for (const job of jobs) {
    if (job.type !== "PAGE_GENERATION" || job.status === "FAILED") {
      continue;
    }

    const key = getJobTargetKey(job);
    if (!key) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);

    if (job.input.page.pageType === "state_service") {
      statePage.set(key, job);
      continue;
    }

    if (job.input.page.pageType === "city_service") {
      cityPage.set(key, job);
    }
  }

  const duplicates = new Set<string>([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));

  return { statePage, cityPage, duplicates };
}

function buildStateCandidate(input: {
  siteId: string;
  productId: string;
  stateCode: string;
  existingJob?: GlwJobRecord;
  priority: number;
  desiredAction: GlwPlanAction;
  reason: string;
}): GlwDailyPublishPlanCandidate {
  const product = GLW_PRODUCT_REGISTRY.find((entry) => entry.id === input.productId);
  const state = GLW_STATE_REGISTRY.find((entry) => entry.code === input.stateCode);

  return {
    siteId: input.siteId,
    productId: input.productId,
    productSlug: product?.canonicalTopic ?? input.productId,
    stateName: state?.name ?? input.stateCode,
    stateSlug: input.stateCode.toLowerCase(),
    canonicalPath: [input.siteId, input.productId, input.stateCode.toLowerCase()].join("/"),
    desiredAction: input.desiredAction,
    priority: input.priority,
    reason: input.reason,
    existingWordPressId: input.existingJob?.result?.wordpressPageId ?? input.existingJob?.result?.wordpressPostId,
    existingStatus: input.existingJob?.status,
    parentProductId: input.productId,
    parentStateId: input.stateCode,
  };
}

function buildCityCandidate(input: {
  siteId: string;
  productId: string;
  stateCode: string;
  city: { city: string; citySlug: string };
  existingJob?: GlwJobRecord;
  priority: number;
  desiredAction: GlwPlanAction;
  reason: string;
}): GlwDailyPublishPlanCandidate {
  const product = GLW_PRODUCT_REGISTRY.find((entry) => entry.id === input.productId);
  const state = GLW_STATE_REGISTRY.find((entry) => entry.code === input.stateCode);

  return {
    siteId: input.siteId,
    productId: input.productId,
    productSlug: product?.canonicalTopic ?? input.productId,
    stateName: state?.name ?? input.stateCode,
    stateSlug: input.stateCode.toLowerCase(),
    cityName: input.city.city,
    citySlug: input.city.citySlug,
    canonicalPath: [input.siteId, input.productId, input.stateCode.toLowerCase(), input.city.citySlug].join("/"),
    desiredAction: input.desiredAction,
    priority: input.priority,
    reason: input.reason,
    existingWordPressId: input.existingJob?.result?.wordpressPageId ?? input.existingJob?.result?.wordpressPostId,
    existingStatus: input.existingJob?.status,
    parentProductId: input.productId,
    parentStateId: input.stateCode,
  };
}

function dedupeCandidates(candidates: GlwDailyPublishPlanCandidate[]): GlwDailyPublishPlanCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (seen.has(candidate.canonicalPath)) {
      return false;
    }
    seen.add(candidate.canonicalPath);
    return true;
  });
}

function prioritizeCandidates(candidates: GlwDailyPublishPlanCandidate[], limits: GlwThrottlePolicy): GlwDailyPublishPlanCandidate[] {
  const actionWeight: Record<GlwPlanAction, number> = {
    CREATE_STATE: 1,
    CREATE_CITY: 2,
    UPDATE_CITY: 3,
    SKIP_EXISTING: 4,
    BLOCKED_PARENT: 5,
    BLOCKED_DUPLICATE: 6,
    BLOCKED_QA: 7,
    BLOCKED_SITE: 8,
  };

  const productOrder = new Map(limits.productRotation.map((productId, index) => [productId, index]));
  const stateOrder = new Map(limits.stateRotation.map((stateCode, index) => [stateCode, index]));

  return [...candidates].sort((left, right) => {
    const actionDelta = actionWeight[left.desiredAction] - actionWeight[right.desiredAction];
    if (actionDelta !== 0) {
      return actionDelta;
    }

    const leftProductOrder = productOrder.get(left.productId) ?? Number.MAX_SAFE_INTEGER;
    const rightProductOrder = productOrder.get(right.productId) ?? Number.MAX_SAFE_INTEGER;
    if (leftProductOrder !== rightProductOrder) {
      return leftProductOrder - rightProductOrder;
    }

    const leftStateOrder = stateOrder.get(left.stateSlug.toUpperCase()) ?? Number.MAX_SAFE_INTEGER;
    const rightStateOrder = stateOrder.get(right.stateSlug.toUpperCase()) ?? Number.MAX_SAFE_INTEGER;
    if (leftStateOrder !== rightStateOrder) {
      return leftStateOrder - rightStateOrder;
    }

    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return left.canonicalPath.localeCompare(right.canonicalPath);
  });
}

export function summarizeGlwCoverage(input: {
  siteId: string;
  existingJobs: GlwJobRecord[];
  approvedCandidates?: GlwDailyPublishPlanCandidate[];
}): GlwCoverageSummary {
  const existingJobsByTarget = indexGlwExistingJobs(input.existingJobs);
  const enabledProducts = GLW_PRODUCT_REGISTRY.length;
  const enabledStates = GLW_STATE_REGISTRY.length;
  const enabledCities = getGlwEnabledCities().length;
  const theoreticalStateTargets = enabledProducts * enabledStates;
  const theoreticalCityTargets = enabledProducts * enabledCities;
  const theoreticalTargets = theoreticalStateTargets + theoreticalCityTargets;
  const existingPublished = input.existingJobs.filter((job) => job.siteId === input.siteId && job.status === "COMPLETE").length;
  const existingDraft = input.existingJobs.filter((job) => job.siteId === input.siteId && job.status !== "COMPLETE" && job.status !== "FAILED").length;
  const duplicates = existingJobsByTarget.duplicates.size;
  const qaFailed = input.existingJobs.filter((job) => job.siteId === input.siteId && job.status === "FAILED_QA").length;
  const wrongParent = 0;
  const missing = Math.max(0, theoreticalTargets - existingPublished - existingDraft - duplicates - wrongParent - qaFailed);
  const approvedQueueCoverage = input.approvedCandidates?.length ?? 0;
  const publishedCoverage = theoreticalTargets > 0 ? Math.round((existingPublished / theoreticalTargets) * 10000) / 100 : 0;
  const coveragePercent = theoreticalTargets > 0 ? Math.round(((existingPublished + existingDraft) / theoreticalTargets) * 10000) / 100 : 0;

  return {
    siteId: input.siteId,
    enabledProducts,
    enabledStates,
    enabledCities,
    theoreticalTargets,
    existingPublished,
    existingDraft,
    missing,
    duplicates,
    wrongParent,
    qaFailed,
    coveragePercent,
    theoreticalStateTargets,
    theoreticalCityTargets,
    approvedQueueCoverage,
    publishedCoverage,
  };
}

export function generateGlwDailyPublishPlan(input: {
  siteId: string;
  existingJobs: GlwJobRecord[];
  limits?: Partial<GlwThrottlePolicy>;
  cityRegistry?: Array<{ stateCode: string; city: string; citySlug: string; enabled: boolean }>;
}): GlwDailyPublishPlan {
  const site = getGlwSite(input.siteId);
  const baseLimits = createDefaultGlwThrottlePolicy(input.siteId);
  const limits: GlwThrottlePolicy = {
    ...baseLimits,
    ...input.limits,
    productRotation: input.limits?.productRotation ?? baseLimits.productRotation,
    stateRotation: input.limits?.stateRotation ?? baseLimits.stateRotation,
  };
  const now = nowIso();
  const existingIndex = indexGlwExistingJobs(input.existingJobs);
  const cityRegistry = (input.cityRegistry ?? GLW_CITY_REGISTRY).filter((city) => city.enabled);
  const allowedProductIds = limits.productRotation.filter((productId) => GLW_PRODUCT_REGISTRY.some((product) => product.id === productId));
  const allowedStateCodes = limits.stateRotation.filter((stateCode) => GLW_STATE_REGISTRY.some((state) => state.code === stateCode));

  if (site && !site.publishingEnabled) {
    return {
      planId: `${input.siteId}-${now}`,
      siteId: input.siteId,
      generatedAt: now,
      status: "DRAFT",
      limits,
      candidates: [],
      approved: [],
      blocked: [],
      summary: {
        totalCandidates: 0,
        approvedCount: 0,
        blockedCount: 0,
        queuedToday: 0,
        running: 0,
        qaFailed: 0,
        duplicates: 0,
        missing: 0,
      },
    };
  }

  const candidates: GlwDailyPublishPlanCandidate[] = [];

  for (const productId of stableRotation(GLW_PRODUCT_REGISTRY.filter((product) => allowedProductIds.includes(product.id)), limits.productRotation).map((product) => product.id)) {
    const product = GLW_PRODUCT_REGISTRY.find((entry) => entry.id === productId);
    if (!product) {
      continue;
    }

    for (const stateCode of stableRotation(GLW_STATE_REGISTRY.filter((state) => allowedStateCodes.includes(state.code)), limits.stateRotation).map((state) => state.code)) {
      const state = GLW_STATE_REGISTRY.find((entry) => entry.code === stateCode);
      if (!state) {
        continue;
      }

      const stateKey = [input.siteId, productId, stateCode.toLowerCase()].join("|");
      const normalizedStateKey = buildGlwTargetIdentity({
        siteId: input.siteId,
        productId,
        stateCode,
      });
      const existingStateJob = existingIndex.statePage.get(normalizedStateKey);
      const stateAction: GlwPlanAction = existingStateJob ? "SKIP_EXISTING" : "CREATE_STATE";
      candidates.push(buildStateCandidate({
        siteId: input.siteId,
        productId,
        stateCode,
        existingJob: existingStateJob,
        priority: product.priority,
        desiredAction: stateAction,
        reason: existingStateJob ? `State page already exists for ${state.name}.` : `Create the missing state parent for ${state.name}.`,
      }));

      const citiesForState = cityRegistry.filter((city) => city.stateCode === stateCode);
      for (const city of citiesForState) {
        const cityKey = buildGlwTargetIdentity({
          siteId: input.siteId,
          productId,
          stateCode,
          citySlug: city.citySlug,
        });
        const existingCityJob = existingIndex.cityPage.get(cityKey);
        const parentMissing = !existingStateJob;

        let desiredAction: GlwPlanAction;
        let reason: string;
        if (parentMissing) {
          desiredAction = "BLOCKED_PARENT";
          reason = `State parent is missing for ${state.name}.`;
        } else if (!existingCityJob) {
          desiredAction = "CREATE_CITY";
          reason = `Create ${city.city} for ${product.name}.`;
        } else if (existingCityJob.status === "FAILED_QA") {
          desiredAction = "BLOCKED_QA";
          reason = `City page failed QA and requires correction.`;
        } else if (existingCityJob.status === "COMPLETE") {
          desiredAction = "UPDATE_CITY";
          reason = `City page exists and can be refreshed.`;
        } else {
          desiredAction = "SKIP_EXISTING";
          reason = `City page already exists in queue or active state.`;
        }

        candidates.push(buildCityCandidate({
          siteId: input.siteId,
          productId,
          stateCode,
          city,
          existingJob: existingCityJob,
          priority: product.priority + (desiredAction === "UPDATE_CITY" ? 50 : desiredAction === "CREATE_CITY" ? 25 : 100),
          desiredAction,
          reason,
        }));
      }
    }
  }

  const prioritized = prioritizeCandidates(dedupeCandidates(candidates), limits);
  const windowedCandidates = prioritized.slice(0, limits.dailyPageLimit);
  const approved = windowedCandidates.filter((candidate) => !candidate.desiredAction.startsWith("BLOCKED") && candidate.desiredAction !== "SKIP_EXISTING");
  const finalBlocked = windowedCandidates.filter((candidate) => !approved.includes(candidate));
  const summaryCoverage = summarizeGlwCoverage({
    siteId: input.siteId,
    existingJobs: input.existingJobs,
    approvedCandidates: approved,
  });

  return {
    planId: `${input.siteId}-${now}`,
    siteId: input.siteId,
    generatedAt: now,
    status: "DRAFT",
    limits,
    candidates: windowedCandidates,
    approved,
    blocked: finalBlocked,
    summary: {
      totalCandidates: windowedCandidates.length,
      approvedCount: approved.length,
      blockedCount: finalBlocked.length,
      queuedToday: input.existingJobs.filter((job) => job.siteId === input.siteId && job.status === "QUEUED").length,
      running: input.existingJobs.filter((job) => job.siteId === input.siteId && job.status === "RUNNING").length,
      qaFailed: input.existingJobs.filter((job) => job.siteId === input.siteId && job.status === "FAILED_QA").length,
      duplicates: summaryCoverage.duplicates,
      missing: summaryCoverage.missing,
    },
  };
}

export function canEnqueueGlwJob(job: GlwJobRecord, existingJobs: GlwJobRecord[]): { allowed: boolean; reason?: string } {
  const targetKey = getJobTargetKey(job);
  const collision = existingJobs.find((entry) => entry.id !== job.id && getJobTargetKey(entry) === targetKey && ["QUEUED", "STARTING", "RUNNING", "COMPLETE"].includes(entry.status));

  if (collision) {
    return { allowed: false, reason: "SKIPPED_ALREADY_QUEUED" };
  }

  return { allowed: true };
}

export function createGlwPublishingPlanSnapshot(plan: GlwDailyPublishPlan): Record<string, unknown> {
  return {
    ...plan,
    generatedAt: plan.generatedAt,
    limits: { ...plan.limits },
    candidates: plan.candidates.map((candidate) => ({ ...candidate })),
    approved: plan.approved.map((candidate) => ({ ...candidate })),
    blocked: plan.blocked.map((candidate) => ({ ...candidate })),
    summary: { ...plan.summary },
  };
}