import "server-only";

import {
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

const PERSISTENCE_NAMESPACE = "glw-campaign-reference-approval-repository";

export type GlwCampaignReferenceApproval = {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  wordpressObjectId: string;
  approvedAt: string;
};

type RepositoryState = {
  approvals: GlwCampaignReferenceApproval[];
};

let stateRevision = 0;
const approvalStore = new Map<string, GlwCampaignReferenceApproval>();

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

function applyState(state: RepositoryState): void {
  approvalStore.clear();

  for (const approval of state.approvals) {
    approvalStore.set(
      key(approval.campaignId, approval.stateCode, approval.citySlug),
      deepClone(approval),
    );
  }
}

function snapshotState(): RepositoryState {
  return {
    approvals: Array.from(
      approvalStore.values(),
      (approval) => deepClone(approval),
    ),
  };
}

const loaded = loadPersistedState<RepositoryState>({
  namespace: PERSISTENCE_NAMESPACE,
  seedFactory: () => ({ approvals: [] }),
});

applyState(loaded.state);
stateRevision = loaded.revision;

function persistState(): void {
  const saved = savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });

  stateRevision = saved.revision;
}

export function getGlwCampaignReferenceApproval(
  campaignId: string,
  stateCode: string,
  citySlug?: string | null,
): GlwCampaignReferenceApproval | null {
  const approval = approvalStore.get(key(campaignId, stateCode, citySlug));
  return approval ? deepClone(approval) : null;
}

export function approveGlwCampaignReference(input: {
  campaignId: string;
  stateCode: string;
  citySlug?: string | null;
  jobId: string;
  wordpressObjectId: string;
}): GlwCampaignReferenceApproval {
  const approval: GlwCampaignReferenceApproval = {
    campaignId: input.campaignId,
    stateCode: input.stateCode.trim().toUpperCase(),
    citySlug: normalizeCitySlug(input.citySlug),
    jobId: input.jobId,
    wordpressObjectId: input.wordpressObjectId,
    approvedAt: new Date().toISOString(),
  };

  approvalStore.set(
    key(approval.campaignId, approval.stateCode, approval.citySlug),
    approval,
  );

  persistState();

  return deepClone(approval);
}
