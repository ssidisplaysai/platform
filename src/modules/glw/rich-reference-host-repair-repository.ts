import "server-only";

import { randomUUID } from "node:crypto";
import { FoundationPersistenceConflictError, deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";

export type RichReferenceHostRepairLifecycle = "INTENT_RECORDED" | "HOST_REPAIRED_AWAITING_CERTIFICATION" | "PUBLIC_CERTIFICATION_FAILED" | "PUBLIC_CERTIFIED";
export type RichReferenceHostRepairReceipt = {
  repairReceiptId: string;
  sourcePublicationReceiptId: string;
  organizationId: string;
  siteId: string;
  campaignId: string;
  targetId: string;
  wordpressObjectId: string;
  storedPostContentSha: string;
  principalId: string;
  lifecycleState: RichReferenceHostRepairLifecycle;
  hostPresentationMutationPerformed: boolean;
  publicCertificationId: string | null;
  failureCode: string | null;
  startedAt: string;
  completedAt: string | null;
};

type State = { receipts: RichReferenceHostRepairReceipt[] };
const NAMESPACE = "glw-rich-reference-host-repair-v1";
const seed = (): State => ({ receipts: [] });

function saveWithRetry<T>(mutator: (state: State) => { state: State; value: T }): T {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
    const result = mutator(deepClone(loaded.state));
    try {
      savePersistedState({ namespace: NAMESPACE, state: result.state, expectedRevision: loaded.revision });
      return result.value;
    } catch (error) {
      if (!(error instanceof FoundationPersistenceConflictError) || attempt === 7) throw error;
    }
  }
  throw new Error("HOST_REPAIR_CAS_RETRY_EXHAUSTED");
}

export function beginRichReferenceHostRepair(input: Omit<RichReferenceHostRepairReceipt, "repairReceiptId" | "lifecycleState" | "hostPresentationMutationPerformed" | "publicCertificationId" | "failureCode" | "startedAt" | "completedAt">): RichReferenceHostRepairReceipt {
  return saveWithRetry((state) => {
    const existing = state.receipts.find((item) => item.sourcePublicationReceiptId === input.sourcePublicationReceiptId);
    if (existing) return { state, value: deepClone(existing) };
    const receipt: RichReferenceHostRepairReceipt = { ...input, repairReceiptId: `rich-reference-host-repair-${randomUUID()}`, lifecycleState: "INTENT_RECORDED", hostPresentationMutationPerformed: false, publicCertificationId: null, failureCode: null, startedAt: new Date().toISOString(), completedAt: null };
    return { state: { receipts: [...state.receipts, receipt] }, value: deepClone(receipt) };
  });
}

export function updateRichReferenceHostRepair(input: { repairReceiptId: string; lifecycleState: Exclude<RichReferenceHostRepairLifecycle, "INTENT_RECORDED">; hostPresentationMutationPerformed: boolean; publicCertificationId?: string | null; failureCode?: string | null }): RichReferenceHostRepairReceipt {
  return saveWithRetry((state) => {
    const index = state.receipts.findIndex((item) => item.repairReceiptId === input.repairReceiptId);
    if (index < 0) throw new Error("HOST_REPAIR_RECEIPT_NOT_FOUND");
    if (state.receipts[index].lifecycleState === "PUBLIC_CERTIFIED") throw new Error("HOST_REPAIR_ALREADY_PUBLIC_CERTIFIED");
    const receipt: RichReferenceHostRepairReceipt = { ...state.receipts[index], lifecycleState: input.lifecycleState, hostPresentationMutationPerformed: state.receipts[index].hostPresentationMutationPerformed || input.hostPresentationMutationPerformed, publicCertificationId: input.publicCertificationId ?? null, failureCode: input.failureCode ?? null, completedAt: input.lifecycleState === "HOST_REPAIRED_AWAITING_CERTIFICATION" ? null : new Date().toISOString() };
    const receipts = [...state.receipts];
    receipts[index] = receipt;
    return { state: { receipts }, value: deepClone(receipt) };
  });
}

export function listRichReferenceHostRepairReceipts(): readonly RichReferenceHostRepairReceipt[] {
  return deepClone(loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state.receipts);
}
