import "server-only";

import { randomUUID } from "node:crypto";
import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";

const NAMESPACE = "glw-campaign-target-canonical-identity-repair-audit-v1";

type State = {
  receipts: GlwCampaignTargetCanonicalIdentityRepairReceipt[];
};

const seed = (): State => ({ receipts: [] });

export type GlwCampaignTargetCanonicalIdentityRepairReceipt = {
  repairReceiptId: string;
  campaignId: string;
  targetId: string;
  stateCode: string;
  citySlug: string | null;
  jobId: string;
  externalExecutionId: string;
  wordpressObjectId: string;
  canonicalPathBefore: string | null;
  canonicalPathAfter: string | null;
  applicationPathBefore: string | null;
  applicationPathAfter: string | null;
  canonicalParentIdBefore: string | null;
  canonicalParentIdAfter: string | null;
  proof: {
    jobSlug: string;
    wordpressParentId: string;
    wordpressParentSlug: string;
    wordpressChildSlug: string;
  };
  mutationApplied: boolean;
  repairedBy: string;
  repairedAt: string;
};

function saveWithRetry<T>(
  mutator: (state: State) => { state: State; value: T },
): T {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const loaded = loadPersistedState<State>({
      namespace: NAMESPACE,
      seedFactory: seed,
    });
    const result = mutator(deepClone(loaded.state));
    try {
      savePersistedState({
        namespace: NAMESPACE,
        state: result.state,
        expectedRevision: loaded.revision,
      });
      return result.value;
    } catch (error) {
      if (!(error instanceof FoundationPersistenceConflictError) || attempt === 7) {
        throw error;
      }
    }
  }
  throw new Error("TARGET_CANONICAL_IDENTITY_REPAIR_AUDIT_CAS_RETRY_EXHAUSTED");
}

export function recordGlwCampaignTargetCanonicalIdentityRepair(
  input: Omit<GlwCampaignTargetCanonicalIdentityRepairReceipt, "repairReceiptId" | "repairedAt">,
): GlwCampaignTargetCanonicalIdentityRepairReceipt {
  return saveWithRetry((state) => {
    const receipt: GlwCampaignTargetCanonicalIdentityRepairReceipt = {
      ...input,
      repairReceiptId: `target-canonical-identity-repair-${randomUUID()}`,
      repairedAt: new Date().toISOString(),
    };

    return {
      state: {
        receipts: [...state.receipts, receipt],
      },
      value: deepClone(receipt),
    };
  });
}

export function listGlwCampaignTargetCanonicalIdentityRepairs(): readonly GlwCampaignTargetCanonicalIdentityRepairReceipt[] {
  return deepClone(loadPersistedState<State>({
    namespace: NAMESPACE,
    seedFactory: seed,
  }).state.receipts);
}
