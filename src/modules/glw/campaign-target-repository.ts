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