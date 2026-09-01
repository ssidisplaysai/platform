import "server-only";

import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

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

function key(campaignId: string, stateCode: string): string {
  return `${campaignId}::${stateCode.trim().toUpperCase()}`;
}

function applyState(state: RepositoryState): void {
  targetStore.clear();

  for (const target of state.targets) {
    targetStore.set(
      key(target.campaignId, target.stateCode),
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

    targetStore.set(
      key(input.campaignId, stateCode),
      target,
    );
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

  // dispatchDate is durable accounting authority. Once a target
  // consumes a daily slot, later recovery/requeue/failure must not
  // make that slot available again for the same dispatch date.
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
    .sort(
      (a, b) =>
        a.stateCode.localeCompare(b.stateCode),
    )
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
    const targetKey = key(
      selected.campaignId,
      selected.stateCode,
    );

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
      // A target with an accepted generation job must be reconciled
      // against that exact job. It must never return to the generic
      // queue and become eligible for duplicate dispatch.
      || Boolean(current.jobId)
    ) {
      continue;
    }

    const expiresAt = new Date(current.leaseExpiresAt).getTime();

    if (!Number.isFinite(expiresAt) || expiresAt > now.getTime()) {
      continue;
    }

    targetStore.set(
      key(current.campaignId, current.stateCode),
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
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode.trim().toUpperCase(),
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
  leaseId: string;
  jobId: string;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode.trim().toUpperCase(),
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
  jobId: string;
  wordpressObjectId: string;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode.trim().toUpperCase(),
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
  jobId: string;
  wordpressObjectId: string;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode.trim().toUpperCase(),
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

export function markGlwCampaignTargetFailed(input: {
  campaignId: string;
  stateCode: string;
  leaseId?: string | null;
  jobId?: string | null;
  error: string;
}): GlwCampaignTarget {
  loadState();

  const targetKey = key(
    input.campaignId,
    input.stateCode.trim().toUpperCase(),
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
    leaseId: null,
    leasedAt: null,
    leaseExpiresAt: null,
    lastError: input.error.trim() || "Campaign generation failed.",
    updatedAt: timestamp,
  };

  targetStore.set(targetKey, updated);
  persistState();

  return deepClone(updated);
}