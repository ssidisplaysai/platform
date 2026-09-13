import "server-only";

import { randomUUID } from "node:crypto";
import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";

export type CommercialStainlessCompositionRepairReceipt = {
  receiptId: string;
  contract: "commercial-stainless-visual-composition-repair-v1";
  organizationId: "rj-metal";
  siteId: "site-rj-metal-commercial-stainless-counters";
  wordpressObjectId: "10";
  beforeCertificationId: string;
  beforePageRevisionId: string;
  afterPageRevisionId: string;
  beforeContentHash: string;
  beforeAuthorityContentHash: string;
  afterContentHash: string;
  beforePublicHtmlHash: string;
  afterPublicHtmlHash: string;
  featuredMediaId: string;
  mediaUrlHash: string;
  titleHash: string;
  seoMetaHash: string;
  templateIdentity: string | null;
  navigationHash: string;
  footerHash: string;
  wordpressStatusBefore: "publish";
  wordpressStatusAfter: "publish";
  canonicalPath: "/";
  compositionVersion: "commercial-stainless-composition-v2";
  actor: string;
  completedAt: string;
  publicationWorkflowPerformed: false;
};

type State = { receipts: CommercialStainlessCompositionRepairReceipt[] };
const NAMESPACE = "commercial-stainless-composition-repair-v1";
const seed = (): State => ({ receipts: [] });

export function saveCommercialStainlessCompositionRepairReceipt(input: Omit<CommercialStainlessCompositionRepairReceipt, "receiptId">): CommercialStainlessCompositionRepairReceipt {
  if (JSON.stringify(input).match(/(?:password|authorization|cookie|secret|token|api[_-]?key)\s*[:=]/i)) throw new Error("COMPOSITION_REPAIR_RECEIPT_SENSITIVE_MATERIAL_FORBIDDEN");
  const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
  const existing = loaded.state.receipts.find((item) => item.afterPageRevisionId === input.afterPageRevisionId);
  if (existing) return deepClone(existing);
  const receipt = { ...input, receiptId: `commercial-stainless-composition-repair-${randomUUID()}` };
  loaded.state.receipts.push(receipt);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(receipt);
}

export function listCommercialStainlessCompositionRepairReceipts(): CommercialStainlessCompositionRepairReceipt[] {
  return deepClone(loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }).state.receipts);
}