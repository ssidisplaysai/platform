import "server-only";

import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import { GLW_CAMPAIGN_US_STATES } from "@/modules/glw/campaign-geography";
import {
  recordGlwCampaignTargetCanonicalIdentityRepair,
  type GlwCampaignTargetCanonicalIdentityRepairReceipt,
} from "@/modules/glw/campaign-target-canonical-identity-repair-audit";
import type { GlwCampaignCityTarget } from "@/modules/glw/campaign-types";
import type { GlwCampaignPublicationPolicy } from "@/modules/glw/campaign-types";

const PERSISTENCE_NAMESPACE = "glw-campaign-target-repository";

export type GlwCampaignTargetStatus =
  | "prepared"
  | "reference_complete"
  | "queued"
  | "running"
  | "content_ready"
  | "draft_ready"
  | "published"
  | "failed"
  | "skipped";

export type GlwCampaignTarget = {
  targetId: string;
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  pageType?: "state_service" | "city_service";
  stateCode: string;
  citySlug?: string | null;
  cityName?: string | null;
  applicationPath?: string | null;
  canonicalPath?: string | null;
  canonicalParentId?: string | null;
  parentCampaignId?: string | null;
  publicationPolicy?: GlwCampaignPublicationPolicy;
  status: GlwCampaignTargetStatus;
  jobId: string | null;
  wordpressObjectId: string | null;
  attemptCount: number;
  lastError: string | null;
  leaseId?: string | null;
  leasedAt?: string | null;
  leaseExpiresAt?: string | null;
  dispatchDate?: string | null;
  createdAt: string;
  updatedAt: string;
};

type RepositoryState = {
  targets: GlwCampaignTarget[];
};

const targetStore = new Map<string, GlwCampaignTarget>();
let stateRevision = 0;

function normalizeCitySlug(value?: string | null): string | null {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") ?? "";
  return normalized || null;
}

function key(
  campaignId: string,
  stateCode: string,
  citySlug?: string | null,
): string {
  const base = `${campaignId}::${stateCode.trim().toUpperCase()}`;
  const city = normalizeCitySlug(citySlug);
  return city ? `${base}::${city}` : base;
}

function keyForTarget(target: Pick<GlwCampaignTarget, "campaignId" | "stateCode" | "citySlug">): string {
  return key(target.campaignId, target.stateCode, target.citySlug);
}

function normalizeCanonicalPath(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "");
}

type DraftCanonicalIdentity = {
  canonicalPath: string;
  applicationPath: string;
  canonicalParentId: string;
};

function resolveDraftCanonicalIdentity(input: {
  current: GlwCampaignTarget;
  canonicalIdentity?: DraftCanonicalIdentity;
}): Pick<GlwCampaignTarget, "canonicalPath" | "applicationPath" | "canonicalParentId"> {
  if (!input.canonicalIdentity) {
    return {
      canonicalPath: input.current.canonicalPath ?? null,
      applicationPath: input.current.applicationPath ?? null,
      canonicalParentId: input.current.canonicalParentId ?? null,
    };
  }

  const canonicalPath = normalizeCanonicalPath(input.canonicalIdentity.canonicalPath);
  const applicationPath = normalizeCanonicalPath(input.canonicalIdentity.applicationPath);
  const canonicalParentId = input.canonicalIdentity.canonicalParentId.trim();

  if (!canonicalPath || !applicationPath || !/^[1-9]\d*$/.test(canonicalParentId)) {
    throw new Error("DRAFT_READY_CANONICAL_IDENTITY_REQUIRED");
  }

  const existingCanonicalPath = normalizeCanonicalPath(input.current.canonicalPath ?? "");
  if (existingCanonicalPath && existingCanonicalPath !== canonicalPath) {
    throw new Error("DRAFT_READY_CANONICAL_PATH_CONFLICT");
  }

  const existingApplicationPath = normalizeCanonicalPath(input.current.applicationPath ?? "");
  if (existingApplicationPath && existingApplicationPath !== applicationPath) {
    throw new Error("DRAFT_READY_APPLICATION_PATH_CONFLICT");
  }

  const existingCanonicalParentId = (input.current.canonicalParentId ?? "").trim();
  if (existingCanonicalParentId && existingCanonicalParentId !== canonicalParentId) {
    throw new Error("DRAFT_READY_CANONICAL_PARENT_CONFLICT");
  }

  return {
    canonicalPath: input.current.canonicalPath ?? canonicalPath,
    applicationPath: input.current.applicationPath ?? applicationPath,
    canonicalParentId: input.current.canonicalParentId ?? canonicalParentId,
  };
}

function resolveCityTargetCanonicalPath(input: {
  canonicalProductSlug?: string | null;
  stateCode: string;
  citySlug: string;
}): string | null {
  const productSlug = normalizeCanonicalPath(input.canonicalProductSlug ?? "");
  const state = GLW_CAMPAIGN_US_STATES.find(
    (candidate) => candidate.code === input.stateCode,
  );

  if (!productSlug || !state?.slug) {
    return null;
  }

  return normalizeCanonicalPath(`${productSlug}/${state.slug}/${input.citySlug}`);
}

export function createGlwCampaignStateTargetId(campaignId: string, stateCode: string): string {
  return `target-${campaignId}-${stateCode.trim().toLowerCase()}`;
}

function applyState(state: RepositoryState): void {
  targetStore.clear();

  for (const target of state.targets) {
    targetStore.set(
      keyForTarget(target),
      deepClone(target),
    );
  }
}

function snapshotState(): RepositoryState {
  return {
    targets: Array.from(
      targetStore.values(),
      (target) => deepClone(target),
    ),
  };
}

function loadState(): void {
  const loaded = loadPersistedState<RepositoryState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: () => ({ targets: [] }),
  });

  applyState(loaded.state);
  stateRevision = loaded.revision;
}

function persistState(): void {
  const saved = savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });

  stateRevision = saved.revision;
}

loadState();

export function listGlwCampaignTargets(
  campaignId: string,
): readonly GlwCampaignTarget[] {
  loadState();

  return Array.from(targetStore.values())
    .filter((target) => target.campaignId === campaignId)
    .map((target) => deepClone(target));
}

export function listAllGlwCampaignTargets(): readonly GlwCampaignTarget[] {
  loadState();
  return Array.from(targetStore.values(), (target) => deepClone(target));
}

export function previewGlwCampaignTargets(input: {
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  stateCodes: readonly string[];
  referenceStateCode: string;
  referenceJobId?: string | null;
  referenceWordpressObjectId?: string | null;
  certifiedTargets?: readonly { stateCode: string; wordpressObjectId: string; jobId?: string | null }[];
  now?: Date;
}): readonly GlwCampaignTarget[] {
  const timestamp = (input.now ?? new Date()).toISOString();
  const referenceStateCode = input.referenceStateCode.trim().toUpperCase();

  return input.stateCodes.map((rawStateCode) => {
    const stateCode = rawStateCode.trim().toUpperCase();
    const isReference = stateCode === referenceStateCode;
    const certified = input.certifiedTargets?.find((target) => target.stateCode.trim().toUpperCase() === stateCode) ?? null;
    return {
      targetId: createGlwCampaignStateTargetId(input.campaignId, stateCode),
      campaignId: input.campaignId,
      organizationId: input.organizationId,
      siteId: input.siteId,
      productId: input.productId,
      pageType: "state_service" as const,
      stateCode,
      citySlug: null,
      cityName: null,
      status: certified ? "published" as const : isReference ? "reference_complete" as const : "queued" as const,
      jobId: certified?.jobId ?? (isReference ? input.referenceJobId ?? null : null),
      wordpressObjectId: certified?.wordpressObjectId ?? (isReference ? input.referenceWordpressObjectId ?? null : null),
      attemptCount: certified?.jobId || isReference && input.referenceJobId ? 1 : 0,
      lastError: null,
      leaseId: null,
      leasedAt: null,
      leaseExpiresAt: null,
      dispatchDate: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
}

export function initializeGlwCampaignTargets(input: {
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  stateCodes: readonly string[];
  referenceStateCode: string;
  referenceJobId: string;
  referenceWordpressObjectId: string;
  certifiedTargets?: readonly { stateCode: string; wordpressObjectId: string; jobId?: string | null }[];
}): readonly GlwCampaignTarget[] {
  loadState();

  const existing = listGlwCampaignTargets(input.campaignId);

  if (existing.length > 0) {
    if (existing.length !== input.stateCodes.length) {
      throw new Error(
        "Campaign target queue already exists with an unexpected target count.",
      );
    }

    return existing;
  }

  const projected = previewGlwCampaignTargets(input);
  for (const target of projected) {
    targetStore.set(keyForTarget(target), target);
  }

  persistState();

  return listGlwCampaignTargets(input.campaignId);
}

export function initializeGlwCityCampaignTargets(input: {
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  cityTargets: readonly GlwCampaignCityTarget[];
  referenceTarget: {
    stateCode: string;
    citySlug: string;
  };
  referenceJobId: string | null;
  referenceWordpressObjectId: string | null;
  canonicalProductSlug?: string | null;
}): readonly GlwCampaignTarget[] {
  loadState();

  const existing = listGlwCampaignTargets(input.campaignId);

  if (existing.length > 0) {
    if (existing.length !== input.cityTargets.length) {
      throw new Error(
        "Campaign target queue already exists with an unexpected target count.",
      );
    }

    if (existing.every((target) => target.status === "prepared")) {
      const referenceStateCode = input.referenceTarget.stateCode.trim().toUpperCase();
      const referenceCitySlug = normalizeCitySlug(input.referenceTarget.citySlug);
      const timestamp = new Date().toISOString();
      for (const target of existing) {
        const isReference = target.stateCode === referenceStateCode && target.citySlug === referenceCitySlug;
        targetStore.set(keyForTarget(target), {
          ...target,
          status: isReference ? "reference_complete" : "queued",
          jobId: isReference ? input.referenceJobId : null,
          wordpressObjectId: isReference ? input.referenceWordpressObjectId : null,
          attemptCount: isReference ? 1 : 0,
          updatedAt: timestamp,
        });
      }
      persistState();
      return listGlwCampaignTargets(input.campaignId);
    }

    return existing;
  }

  const timestamp = new Date().toISOString();
  const referenceStateCode = input.referenceTarget.stateCode.trim().toUpperCase();
  const referenceCitySlug = normalizeCitySlug(input.referenceTarget.citySlug);

  if (!referenceCitySlug) {
    throw new Error("City campaign reference target requires a city slug.");
  }

  for (const rawTarget of input.cityTargets) {
    const stateCode = rawTarget.stateCode.trim().toUpperCase();
    const citySlug = normalizeCitySlug(rawTarget.citySlug);
    const cityName = rawTarget.cityName.trim();

    if (!citySlug || !cityName) {
      throw new Error("City campaign target requires a city slug and city name.");
    }

    const isReference =
      stateCode === referenceStateCode
      && citySlug === referenceCitySlug;
    const canonicalPath = resolveCityTargetCanonicalPath({
      canonicalProductSlug: input.canonicalProductSlug,
      stateCode,
      citySlug,
    });

    const target: GlwCampaignTarget = {
      targetId: `target-${input.campaignId}-${stateCode.toLowerCase()}-${citySlug}`,
      campaignId: input.campaignId,
      organizationId: input.organizationId,
      siteId: input.siteId,
      productId: input.productId,
      stateCode,
      citySlug,
      cityName,
      canonicalPath,
      applicationPath: canonicalPath,
      canonicalParentId: null,
      status: isReference ? "reference_complete" : "queued",
      jobId: isReference ? input.referenceJobId : null,
      wordpressObjectId: isReference
        ? input.referenceWordpressObjectId
        : null,
      attemptCount: isReference ? 1 : 0,
      lastError: null,
      leaseId: null,
      leasedAt: null,
      leaseExpiresAt: null,
      dispatchDate: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const targetKey = keyForTarget(target);
    if (targetStore.has(targetKey)) {
      throw new Error("City campaign target identity is duplicated.");
    }
    targetStore.set(targetKey, target);
  }

  persistState();

  return listGlwCampaignTargets(input.campaignId);
}

export type GlwCampaignTargetQueueSummary = {
  total: number;
  prepared: number;
  referenceComplete: number;
  queued: number;
  running: number;
  contentReady: number;
  draftReady: number;
  published: number;
  failed: number;
  skipped: number;
};

export function summarizeGlwCampaignTargets(
  campaignId: string,
): GlwCampaignTargetQueueSummary {
  const targets = listGlwCampaignTargets(campaignId);

  return {
    total: targets.length,
    prepared: targets.filter((target) => target.status === "prepared").length,
    referenceComplete: targets.filter(
      (target) => target.status === "reference_complete",
    ).length,
    queued: targets.filter(
      (target) => target.status === "queued",
    ).length,
    running: targets.filter(
      (target) => target.status === "running",
    ).length,
    contentReady: targets.filter(
      (target) => target.status === "content_ready",
    ).length,
    draftReady: targets.filter(
      (target) => target.status === "draft_ready",
    ).length,
    published: targets.filter(
      (target) => target.status === "published",
    ).length,
    failed: targets.filter(
      (target) => target.status === "failed",
    ).length,
    skipped: targets.filter(
      (target) => target.status === "skipped",
    ).length,
  };
}

export function previewGlwCampaignTargetLease(input: {
  campaignId: string;
  pagesPerDay: number;
  dispatchDate: string;
  maxTargets?: number;
  now?: Date;
}): {
  allowance: number;
  alreadyDispatchedToday: number;
  selected: readonly GlwCampaignTarget[];
} {
  const now = input.now ?? new Date();
  const nowMs = now.getTime();

  const targets = listGlwCampaignTargets(input.campaignId);

  const alreadyDispatchedToday = targets.filter(
    (target) =>
      target.dispatchDate === input.dispatchDate,
  ).length;

  const allowance = Math.max(
    0,
    input.pagesPerDay - alreadyDispatchedToday,
  );

  const selected = targets
    .filter((target) => {
      if (target.status !== "queued") {
        return false;
      }

      if (!target.leaseExpiresAt) {
        return true;
      }

      const expiresAt = new Date(target.leaseExpiresAt).getTime();

      return !Number.isFinite(expiresAt) || expiresAt <= nowMs;
    })
    .sort((a, b) => {
      const stateOrder = a.stateCode.localeCompare(b.stateCode);
      if (stateOrder !== 0) return stateOrder;
      return (a.citySlug ?? "").localeCompare(b.citySlug ?? "");
    })
    .slice(0, Math.min(allowance, input.maxTargets ?? allowance));

  return {
    allowance,
    alreadyDispatchedToday,
    selected,
  };
}

export function leaseGlwCampaignTargets(input: {
  campaignId: string;
  pagesPerDay: number;
  dispatchDate: string;
  leaseId: string;
  maxTargets?: number;
  maxConcurrentExecution?: number;
  leaseDurationMs?: number;
  now?: Date;
}): readonly GlwCampaignTarget[] {
  loadState();

  const now = input.now ?? new Date();
  const runningCount = listGlwCampaignTargets(input.campaignId)
    .filter((target) => target.status === "running").length;
  const availableConcurrency = Math.max(0, (input.maxConcurrentExecution ?? Number.MAX_SAFE_INTEGER) - runningCount);
  if (availableConcurrency < 1) {
    throw new Error("GLW_CAMPAIGN_CONCURRENCY_LIMIT_REACHED");
  }
  const preview = previewGlwCampaignTargetLease({
    campaignId: input.campaignId,
    pagesPerDay: input.pagesPerDay,
    dispatchDate: input.dispatchDate,
    maxTargets: Math.min(input.maxTargets ?? availableConcurrency, availableConcurrency),
    now,
  });

  if (preview.selected.length === 0) {
    return [];
  }

  const leasedAt = now.toISOString();
  const leaseExpiresAt = new Date(
    now.getTime() + (input.leaseDurationMs ?? 15 * 60 * 1000),
  ).toISOString();

  const leased: GlwCampaignTarget[] = [];

  for (const selected of preview.selected) {
    const targetKey = keyForTarget(selected);
    const current = targetStore.get(targetKey);

    if (!current || current.status !== "queued") {
      continue;
    }

    const currentLeaseExpiry = current.leaseExpiresAt
      ? new Date(current.leaseExpiresAt).getTime()
      : Number.NaN;

    if (
      current.leaseId
      && Number.isFinite(currentLeaseExpiry)
      && currentLeaseExpiry > now.getTime()
    ) {
      continue;
    }

    const updated: GlwCampaignTarget = {
      ...current,
      status: "running",
      leaseId: input.leaseId,
      leasedAt,
      leaseExpiresAt,
      dispatchDate: input.dispatchDate,
      attemptCount: current.attemptCount + 1,
      lastError: null,
      updatedAt: leasedAt,
    };

    targetStore.set(targetKey, updated);
    leased.push(deepClone(updated));
  }

  if (leased.length > 0) {
    persistState();
  }

  return leased;
}

export function releaseExpiredGlwCampaignTargetLeases(
  campaignId: string,
  now: Date = new Date(),
): number {
  loadState();

  let released = 0;
  const timestamp = now.toISOString();

  for (const current of targetStore.values()) {
    if (
      current.campaignId !== campaignId
      || current.status !== "running"
      || !current.leaseExpiresAt
      || Boolean(current.jobId)
    ) {
      continue;
    }

    const expiresAt = new Date(current.leaseExpiresAt).getTime();

    if (!Number.isFinite(expiresAt) || expiresAt > now.getTime()) {
      continue;
    }

    targetStore.set(
      keyForTarget(current),
      {
        ...current,
        status: "queued",
        leaseId: null,
        leasedAt: null,
        leaseExpiresAt: null,
        updatedAt: timestamp,
      },
    );

    released += 1;
  }

  if (released > 0) {
    persistState();
  }

  return released;
}

export function requeueGlwCampaignTargetAfterPreExecutionFailure(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  error: string;
}): GlwCampaignTarget {
  loadState();
  const targetKey = key(input.campaignId, input.stateCode, input.citySlug);
  const current = targetStore.get(targetKey);
  if (!current || current.status !== "running" || current.jobId !== input.jobId) {
    throw new Error("Campaign target does not match the pre-execution failure.");
  }
  const updated: GlwCampaignTarget = {
    ...current,
    status: "queued",
    jobId: null,
    leaseId: null,
    leasedAt: null,
    leaseExpiresAt: null,
    lastError: input.error,
    updatedAt: new Date().toISOString(),
  };
  targetStore.set(targetKey, updated);
  persistState();
  return deepClone(updated);
}

export function abandonGlwUnfinishedTargetAndRequeue(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  targetId: string;
  expectedStatus: "failed" | "content_ready" | "draft_ready";
  expectedJobId: string;
  expectedWordpressObjectId: string | null;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(input.campaignId, input.stateCode, input.citySlug);
  const current = targetStore.get(targetKey);

  if (
    !current
    || current.targetId !== input.targetId
    || current.status !== input.expectedStatus
    || current.jobId !== input.expectedJobId
    || current.wordpressObjectId !== input.expectedWordpressObjectId
  ) {
    throw new Error("ABANDON_UNFINISHED_TARGET_IDENTITY_MISMATCH");
  }

  if (current.status === "published") {
    throw new Error("ABANDON_UNFINISHED_TARGET_PUBLISHED_FORBIDDEN");
  }

  if (current.leaseId) {
    throw new Error("ABANDON_UNFINISHED_TARGET_ACTIVE_LEASE_FORBIDDEN");
  }

  const updated: GlwCampaignTarget = {
    ...current,
    status: "queued",
    jobId: null,
    wordpressObjectId: null,
    leaseId: null,
    leasedAt: null,
    leaseExpiresAt: null,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };

  targetStore.set(targetKey, updated);
  persistState();
  return deepClone(updated);
}

export function reconcileGlwCampaignTargetContentReady(input: {
  campaignId: string;
  targetId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  leaseId?: string | null;
  externalExecutionId: string;
  now?: Date;
}): { target: GlwCampaignTarget; leaseHistory: { leaseId: string | null; leasedAt: string | null; expiredAt: string | null; jobId: string; externalExecutionId: string; dispatchDate: string | null } } {
  loadState();
  const targetKey = key(input.campaignId, input.stateCode, input.citySlug);
  const current = targetStore.get(targetKey);
  const now = input.now ?? new Date();
  if (!current || current.targetId !== input.targetId || current.status !== "running" || current.jobId !== input.jobId) {
    throw new Error("CONTENT_READY_TARGET_IDENTITY_MISMATCH");
  }
  const expectedLeaseId = input.leaseId?.trim() || null;
  if (expectedLeaseId && current.leaseId !== expectedLeaseId) {
    throw new Error("CONTENT_READY_TARGET_IDENTITY_MISMATCH");
  }
  if (current.wordpressObjectId) throw new Error("CONTENT_READY_TARGET_WORDPRESS_OBJECT_FORBIDDEN");

  if (current.leaseId && current.leaseExpiresAt) {
    const expiresAt = new Date(current.leaseExpiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt > now) throw new Error("CONTENT_READY_TARGET_LEASE_NOT_EXPIRED");
  }

  const timestamp = now.toISOString();
  const leaseHistory = {
    leaseId: current.leaseId,
    leasedAt: current.leasedAt,
    expiredAt: current.leaseExpiresAt,
    jobId: current.jobId,
    externalExecutionId: input.externalExecutionId,
    dispatchDate: current.dispatchDate,
  };
  const updated: GlwCampaignTarget = {
    ...current,
    status: "content_ready",
    leaseId: null,
    leasedAt: null,
    leaseExpiresAt: null,
    lastError: null,
    updatedAt: timestamp,
  };
  targetStore.set(targetKey, updated);
  persistState();
  return { target: deepClone(updated), leaseHistory: deepClone(leaseHistory) };
}

export function requireGlwCampaignTargetResumeAuthority(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode,
    input.citySlug,
  );

  const current = targetStore.get(targetKey);

  if (!current) {
    throw new Error("Campaign target was not found.");
  }

  if (current.status !== "running") {
    throw new Error(
      "Only an existing running campaign target can be resumed.",
    );
  }

  if (current.jobId) {
    throw new Error(
      "Campaign target already has a generation job and must be reconciled instead of redispatched.",
    );
  }

  if (!current.dispatchDate || !current.leaseId) {
    throw new Error(
      "Campaign target has no durable dispatch authority.",
    );
  }

  return deepClone(current);
}

export function attachGlwCampaignTargetJob(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  leaseId: string;
  jobId: string;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode,
    input.citySlug,
  );

  const current = targetStore.get(targetKey);

  if (
    !current
    || current.status !== "running"
    || current.leaseId !== input.leaseId
  ) {
    throw new Error(
      "Campaign target is not owned by the supplied execution lease.",
    );
  }

  if (current.jobId && current.jobId !== input.jobId) {
    throw new Error(
      "Campaign target already has a different generation job.",
    );
  }

  const updated: GlwCampaignTarget = {
    ...current,
    jobId: input.jobId,
    updatedAt: new Date().toISOString(),
  };

  targetStore.set(targetKey, updated);
  persistState();

  return deepClone(updated);
}

export function markGlwCampaignTargetDraftReady(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  wordpressObjectId: string;
  canonicalIdentity?: DraftCanonicalIdentity;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode,
    input.citySlug,
  );

  const current = targetStore.get(targetKey);

  if (
    !current
    || current.status !== "running"
    || current.jobId !== input.jobId
  ) {
    throw new Error(
      "Campaign target does not match the completed generation job.",
    );
  }

  const timestamp = new Date().toISOString();
  const canonicalIdentity = resolveDraftCanonicalIdentity({ current, canonicalIdentity: input.canonicalIdentity });

  const updated: GlwCampaignTarget = {
    ...current,
    status: "draft_ready",
    wordpressObjectId: input.wordpressObjectId,
    canonicalPath: canonicalIdentity.canonicalPath,
    applicationPath: canonicalIdentity.applicationPath,
    canonicalParentId: canonicalIdentity.canonicalParentId,
    leaseId: null,
    leasedAt: null,
    leaseExpiresAt: null,
    lastError: null,
    updatedAt: timestamp,
  };

  targetStore.set(targetKey, updated);
  persistState();

  return deepClone(updated);
}

export function reconcileGlwContentReadyTargetDraft(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  targetId: string;
  jobId: string;
  wordpressObjectId: string;
  canonicalIdentity?: DraftCanonicalIdentity;
}): GlwCampaignTarget {
  loadState();
  const targetKey = key(input.campaignId, input.stateCode, input.citySlug);
  const current = targetStore.get(targetKey);
  if (!current || current.targetId !== input.targetId || current.status !== "content_ready" || current.jobId !== input.jobId || current.wordpressObjectId || current.leaseId) {
    throw new Error("Content-ready staging reconciliation requires the exact unbound target and existing job.");
  }
  const canonicalIdentity = resolveDraftCanonicalIdentity({ current, canonicalIdentity: input.canonicalIdentity });
  const updated: GlwCampaignTarget = {
    ...current,
    status: "draft_ready",
    wordpressObjectId: input.wordpressObjectId,
    canonicalPath: canonicalIdentity.canonicalPath,
    applicationPath: canonicalIdentity.applicationPath,
    canonicalParentId: canonicalIdentity.canonicalParentId,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
  targetStore.set(targetKey, updated);
  persistState();
  return deepClone(updated);
}

export function rollbackInterruptedGlwStagingTarget(input: { campaignId: string; stateCode: string; citySlug: string; targetId: string; jobId: string; wordpressObjectId: string }): GlwCampaignTarget {
  loadState();
  const targetKey = key(input.campaignId, input.stateCode, input.citySlug);
  const current = targetStore.get(targetKey);
  if (!current || current.targetId !== input.targetId || current.status !== "draft_ready" || current.jobId !== input.jobId || current.wordpressObjectId !== input.wordpressObjectId || current.leaseId) throw new Error("Interrupted staging rollback requires the exact draft-ready target without a lease.");
  const updated: GlwCampaignTarget = { ...current, status: "content_ready", wordpressObjectId: null, lastError: null, updatedAt: new Date().toISOString() };
  targetStore.set(targetKey, updated); persistState(); return deepClone(updated);
}

export function markGlwFailedCampaignTargetDraftReady(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  wordpressObjectId: string;
  canonicalIdentity?: DraftCanonicalIdentity;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode,
    input.citySlug,
  );

  const current = targetStore.get(targetKey);

  if (
    !current
    || current.status !== "failed"
    || current.jobId !== input.jobId
  ) {
    throw new Error(
      "Failed campaign target does not match the recovered generation job.",
    );
  }

  const timestamp = new Date().toISOString();
  const canonicalIdentity = resolveDraftCanonicalIdentity({ current, canonicalIdentity: input.canonicalIdentity });

  const updated: GlwCampaignTarget = {
    ...current,
    status: "draft_ready",
    wordpressObjectId: input.wordpressObjectId,
    canonicalPath: canonicalIdentity.canonicalPath,
    applicationPath: canonicalIdentity.applicationPath,
    canonicalParentId: canonicalIdentity.canonicalParentId,
    leaseId: null,
    leasedAt: null,
    leaseExpiresAt: null,
    lastError: null,
    updatedAt: timestamp,
  };

  targetStore.set(targetKey, updated);
  persistState();

  return deepClone(updated);
}

export function markGlwCampaignTargetPublished(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  wordpressObjectId: string;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode,
    input.citySlug,
  );

  const current = targetStore.get(targetKey);

  if (
    !current
    || current.status !== "draft_ready"
    || current.wordpressObjectId !== input.wordpressObjectId
  ) {
    throw new Error(
      "Campaign target is not an exact draft-ready WordPress target.",
    );
  }

  const updated: GlwCampaignTarget = {
    ...current,
    status: "published",
    lastError: null,
    updatedAt: new Date().toISOString(),
  };

  targetStore.set(targetKey, updated);
  persistState();

  return deepClone(updated);
}

export function reconcileGlwCampaignTargetPublishedWithoutDispatch(input: { campaignId: string; stateCode: string; citySlug: string; targetId: string; wordpressObjectId: string }): GlwCampaignTarget {
  loadState();
  const targetKey = key(input.campaignId, input.stateCode, input.citySlug);
  const current = targetStore.get(targetKey);
  if (!current || current.targetId !== input.targetId || current.status !== "queued" || current.jobId || current.wordpressObjectId || current.leaseId) throw new Error("Campaign direct publication reconciliation requires the exact queued target without job, WordPress, or lease history.");
  const updated: GlwCampaignTarget = { ...current, status: "published", wordpressObjectId: input.wordpressObjectId, lastError: null, updatedAt: new Date().toISOString() };
  targetStore.set(targetKey, updated); persistState(); return deepClone(updated);
}

export function reconcileGlwCampaignTargetQueuedAfterDirectPublicationFailure(input: { campaignId: string; stateCode: string; citySlug: string; targetId: string; wordpressObjectId: string }): GlwCampaignTarget {
  loadState(); const targetKey = key(input.campaignId, input.stateCode, input.citySlug); const current = targetStore.get(targetKey);
  if (!current || current.targetId !== input.targetId || current.status !== "published" || current.wordpressObjectId !== input.wordpressObjectId || current.jobId || current.leaseId) throw new Error("Campaign direct publication rollback requires the exact published target without job or lease history.");
  const updated: GlwCampaignTarget = { ...current, status: "queued", wordpressObjectId: null, lastError: "PUBLIC_CERTIFICATION_FAILED", updatedAt: new Date().toISOString() }; targetStore.set(targetKey, updated); persistState(); return deepClone(updated);
}

export function reconcileGlwCampaignTargetPublished(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  wordpressObjectId: string;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode,
    input.citySlug,
  );
  const current = targetStore.get(targetKey);

  if (
    !current
    || current.status !== "draft_ready"
    || current.jobId !== input.jobId
    || current.wordpressObjectId !== input.wordpressObjectId
  ) {
    throw new Error(
      "Campaign publication reconciliation requires the exact persisted draft-ready target.",
    );
  }

  const updated: GlwCampaignTarget = {
    ...current,
    status: "published",
    lastError: null,
    updatedAt: new Date().toISOString(),
  };

  targetStore.set(targetKey, updated);
  persistState();
  return deepClone(updated);
}

export function reconcileGlwCampaignTargetDraftAfterPublicationFailure(input: { campaignId: string; stateCode: string; citySlug: string; jobId: string; wordpressObjectId: string }): GlwCampaignTarget {
  loadState(); const targetKey = key(input.campaignId, input.stateCode, input.citySlug); const current = targetStore.get(targetKey);
  if (!current || current.status !== "published" || current.jobId !== input.jobId || current.wordpressObjectId !== input.wordpressObjectId) throw new Error("Campaign publication rollback requires the exact published target.");
  const updated: GlwCampaignTarget = { ...current, status: "draft_ready", lastError: "PUBLIC_CERTIFICATION_FAILED", updatedAt: new Date().toISOString() }; targetStore.set(targetKey, updated); persistState(); return deepClone(updated);
}

export function markGlwCampaignTargetFailed(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  leaseId?: string | null;
  jobId?: string | null;
  error: string;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode,
    input.citySlug,
  );

  const current = targetStore.get(targetKey);

  if (!current) {
    throw new Error("Campaign target was not found.");
  }

  if (
    input.leaseId
    && current.leaseId
    && current.leaseId !== input.leaseId
  ) {
    throw new Error(
      "Campaign target failure does not match the active lease.",
    );
  }

  if (
    input.jobId
    && current.jobId
    && current.jobId !== input.jobId
  ) {
    throw new Error(
      "Campaign target failure does not match the active job.",
    );
  }

  const timestamp = new Date().toISOString();

  const updated: GlwCampaignTarget = {
    ...current,
    status: "failed",
    jobId: input.jobId ?? current.jobId,
    lastError: input.error,
    leaseId: null,
    leasedAt: null,
    leaseExpiresAt: null,
    updatedAt: timestamp,
  };

  targetStore.set(targetKey, updated);
  persistState();

  return deepClone(updated);
}

export function repairGlwCampaignTargetCanonicalIdentity(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  targetId: string;
  jobId: string;
  externalExecutionId: string;
  wordpressObjectId: string;
  canonicalPath: string;
  applicationPath: string;
  canonicalParentId: string;
  wordpressParentSlug: string;
  wordpressChildSlug: string;
  repairedBy: string;
}): { target: GlwCampaignTarget; receipt: GlwCampaignTargetCanonicalIdentityRepairReceipt } {
  loadState();

  const targetKey = key(input.campaignId, input.stateCode, input.citySlug);
  const current = targetStore.get(targetKey);
  if (!current || current.targetId !== input.targetId) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_TARGET_MISMATCH");
  }
  if (current.jobId !== input.jobId) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_JOB_MISMATCH");
  }
  if (current.wordpressObjectId !== input.wordpressObjectId) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_WORDPRESS_OBJECT_MISMATCH");
  }

  const proposedCanonicalPath = normalizeCanonicalPath(input.canonicalPath);
  const proposedApplicationPath = normalizeCanonicalPath(input.applicationPath);
  const proposedCanonicalParentId = input.canonicalParentId.trim();

  if (!proposedCanonicalPath || !proposedApplicationPath || !proposedCanonicalParentId) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_PROPOSED_IDENTITY_REQUIRED");
  }

  const existingCanonicalPath = normalizeCanonicalPath(current.canonicalPath ?? "");
  if (existingCanonicalPath && existingCanonicalPath !== proposedCanonicalPath) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_CANONICAL_PATH_CONFLICT");
  }

  const existingApplicationPath = normalizeCanonicalPath(current.applicationPath ?? "");
  if (existingApplicationPath && existingApplicationPath !== proposedApplicationPath) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_APPLICATION_PATH_CONFLICT");
  }

  const existingCanonicalParentId = (current.canonicalParentId ?? "").trim();
  if (existingCanonicalParentId && existingCanonicalParentId !== proposedCanonicalParentId) {
    throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_CANONICAL_PARENT_CONFLICT");
  }

  const mutated: GlwCampaignTarget = {
    ...current,
    canonicalPath: current.canonicalPath ?? proposedCanonicalPath,
    applicationPath: current.applicationPath ?? proposedApplicationPath,
    canonicalParentId: current.canonicalParentId ?? proposedCanonicalParentId,
    updatedAt: new Date().toISOString(),
  };

  const mutationApplied =
    (current.canonicalPath ?? null) !== (mutated.canonicalPath ?? null)
    || (current.applicationPath ?? null) !== (mutated.applicationPath ?? null)
    || (current.canonicalParentId ?? null) !== (mutated.canonicalParentId ?? null);

  targetStore.set(targetKey, mutated);
  persistState();

  const receipt = recordGlwCampaignTargetCanonicalIdentityRepair({
    campaignId: current.campaignId,
    targetId: current.targetId,
    stateCode: current.stateCode,
    citySlug: current.citySlug ?? null,
    jobId: input.jobId,
    externalExecutionId: input.externalExecutionId,
    wordpressObjectId: input.wordpressObjectId,
    canonicalPathBefore: current.canonicalPath ?? null,
    canonicalPathAfter: mutated.canonicalPath ?? null,
    applicationPathBefore: current.applicationPath ?? null,
    applicationPathAfter: mutated.applicationPath ?? null,
    canonicalParentIdBefore: current.canonicalParentId ?? null,
    canonicalParentIdAfter: mutated.canonicalParentId ?? null,
    proof: {
      jobSlug: proposedApplicationPath,
      wordpressParentId: proposedCanonicalParentId,
      wordpressParentSlug: input.wordpressParentSlug,
      wordpressChildSlug: input.wordpressChildSlug,
    },
    mutationApplied,
    repairedBy: input.repairedBy.trim(),
  });

  return {
    target: deepClone(mutated),
    receipt: deepClone(receipt),
  };
}
