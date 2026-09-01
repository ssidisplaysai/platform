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
  jobId: string;
  wordpressObjectId: string;
  approvedAt: string;
};

type RepositoryState = {
  approvals: GlwCampaignReferenceApproval[];
};

let stateRevision = 0;
const approvalStore = new Map<string, GlwCampaignReferenceApproval>();

function key(campaignId: string, stateCode: string): string {
  return `${campaignId}::${stateCode.toUpperCase()}`;
}

function applyState(state: RepositoryState): void {
  approvalStore.clear();

  for (const approval of state.approvals) {
    approvalStore.set(
      key(approval.campaignId, approval.stateCode),
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
): GlwCampaignReferenceApproval | null {
  const approval = approvalStore.get(key(campaignId, stateCode));
  return approval ? deepClone(approval) : null;
}

export function approveGlwCampaignReference(input: {
  campaignId: string;
  stateCode: string;
  jobId: string;
  wordpressObjectId: string;
}): GlwCampaignReferenceApproval {
  const approval: GlwCampaignReferenceApproval = {
    campaignId: input.campaignId,
    stateCode: input.stateCode.trim().toUpperCase(),
    jobId: input.jobId,
    wordpressObjectId: input.wordpressObjectId,
    approvedAt: new Date().toISOString(),
  };

  approvalStore.set(
    key(approval.campaignId, approval.stateCode),
    approval,
  );

  persistState();

  return deepClone(approval);
}