import "server-only";
import { randomUUID } from "node:crypto";
import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";

export type CommercialStainlessHeaderRepairReceipt = {
  receiptId: string; contract: "commercial-stainless-header-repair-v1"; organizationId: "rj-metal"; siteId: "site-rj-metal-commercial-stainless-counters";
  beforeVisualCertificationId: string; headerTemplatePartId: string; navigationId: number; beforeHeaderHash: string; afterHeaderHash: string; footerHash: string; navigationHash: string;
  bodyContentHash: string; compositionVersion: "commercial-stainless-header-composition-v1"; actor: string; completedAt: string;
  bodyUpdated: false; footerUpdated: false; navigationUpdated: false; publicationWorkflowPerformed: false;
};
type State = { receipts: CommercialStainlessHeaderRepairReceipt[] }; const NAMESPACE = "commercial-stainless-header-repair-v1"; const seed = (): State => ({ receipts: [] });
export function saveCommercialStainlessHeaderRepairReceipt(input: Omit<CommercialStainlessHeaderRepairReceipt, "receiptId">) { const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }); const existing = loaded.state.receipts.find((item) => item.afterHeaderHash === input.afterHeaderHash); if (existing) return deepClone(existing); const receipt = { ...input, receiptId: `commercial-stainless-header-repair-${randomUUID()}` }; loaded.state.receipts.push(receipt); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(receipt); }