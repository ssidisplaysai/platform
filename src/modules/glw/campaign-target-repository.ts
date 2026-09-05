import "server-only";

import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import type { GlwCampaignCityTarget } from "@/modules/glw/campaign-types";

const PERSISTENCE_NAMESPACE = "glw-campaign-target-repository";

export type GlwCampaignTargetStatus =
  | "reference_complete"
  | "queued"
  | "running"
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
  stateCode: string;
  citySlug?: string | null;
  cityName?: string | null;
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

export function initializeGlwCampaignTargets(input: {
  campaignId: string;
  organizationId: string;
  siteId: string;
  productId: string;
  stateCodes: readonly string[];
  referenceStateCode: string;
  referenceJobId: string;
  referenceWordpressObjectId: string;
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

  const timestamp = new Date().toISOString();
  const referenceStateCode = input.referenceStateCode.trim().toUpperCase();

  for (const rawStateCode of input.stateCodes) {
    const stateCode = rawStateCode.trim().toUpperCase();
    const isReference = stateCode === referenceStateCode;

    const target: GlwCampaignTarget = {
      targetId: `target-${input.campaignId}-${stateCode.toLowerCase()}`,
      campaignId: input.campaignId,
      organizationId: input.organizationId,
      siteId: input.siteId,
      productId: input.productId,
      stateCode,
      citySlug: null,
      cityName: null,
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
  referenceJobId: string;
  referenceWordpressObjectId: string;
}): readonly GlwCampaignTarget[] {
  loadState();

  const existing = listGlwCampaignTargets(input.campaignId);

  if (existing.length > 0) {
    if (existing.length !== input.cityTargets.length) {
      throw new Error(
        "Campaign target queue already exists with an unexpected target count.",
      );
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

    const target: GlwCampaignTarget = {
      targetId: `target-${input.campaignId}-${stateCode.toLowerCase()}-${citySlug}`,
      campaignId: input.campaignId,
      organizationId: input.organizationId,
      siteId: input.siteId,
      productId: input.productId,
      stateCode,
      citySlug,
      cityName,
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
  referenceComplete: number;
  queued: number;
  running: number;
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
    referenceComplete: targets.filter(
      (target) => target.status === "reference_complete",
    ).length,
    queued: targets.filter(
      (target) => target.status === "queued",
    ).length,
    running: targets.filter(
      (target) => target.status === "running",
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
    .slice(0, allowance);

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
  leaseDurationMs?: number;
  now?: Date;
}): readonly GlwCampaignTarget[] {
  loadState();

  const now = input.now ?? new Date();
  const preview = previewGlwCampaignTargetLease({
    campaignId: input.campaignId,
    pagesPerDay: input.pagesPerDay,
    dispatchDate: input.dispatchDate,
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

  const updated: GlwCampaignTarget = {
    ...current,
    status: "draft_ready",
    wordpressObjectId: input.wordpressObjectId,
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

export function markGlwFailedCampaignTargetDraftReady(input: {
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
    || current.status !== "failed"
    || current.jobId !== input.jobId
  ) {
    throw new Error(
      "Failed campaign target does not match the recovered generation job.",
    );
  }

  const timestamp = new Date().toISOString();

  const updated: GlwCampaignTarget = {
    ...current,
    status: "draft_ready",
    wordpressObjectId: input.wordpressObjectId,
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
