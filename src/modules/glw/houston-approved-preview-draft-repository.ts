import "server-only";

import { randomUUID } from "node:crypto";
import { deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";
import type { HoustonApprovedPreviewIdentity, HoustonDraftAuditEvent, HoustonDraftReceipt, HoustonDraftVisualCertification, HoustonOwnerDraftApproval, HoustonPreviewDraftComparison } from "./houston-approved-preview-draft";

const NAMESPACE = "houston-approved-preview-to-wordpress-draft-v1";
type State = { approvals: HoustonOwnerDraftApproval[]; receipts: HoustonDraftReceipt[]; certifications: HoustonDraftVisualCertification[]; comparisons: HoustonPreviewDraftComparison[]; audit: HoustonDraftAuditEvent[] };
const load = () => loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ approvals: [], receipts: [], certifications: [], comparisons: [], audit: [] }) });
const audit = (state: State, action: string, detail: HoustonDraftAuditEvent["detail"], at: string) => state.audit.push({ eventId: `audit-${randomUUID()}`, action, detail, at });

export function getHoustonDraftState(): State { return deepClone(load().state); }
export function persistHoustonOwnerDraftApproval(identity: HoustonApprovedPreviewIdentity, now: string) {
  const loaded = load(); const existing = loaded.state.approvals.find((item) => item.exactIdentity.previewVisualCertificationHash === identity.previewVisualCertificationHash);
  if (existing) return { approval: deepClone(existing), reused: true };
  const approval: HoustonOwnerDraftApproval = { decisionId: `houston-preview-draft-approval-${randomUUID()}`, decision: "APPROVED_PREVIEW_TO_DRAFT", ownerStatement: "approved", exactIdentity: deepClone(identity), approvedAt: now, publicationAuthorized: false, dispatchAuthorized: false };
  loaded.state.approvals.push(approval); audit(loaded.state, "OWNER_APPROVED_PREVIEW_TO_DRAFT", { decisionId: approval.decisionId, previewCommit: identity.previewCommit }, now); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return { approval: deepClone(approval), reused: false };
}
export function saveHoustonDraftReceipt(receipt: HoustonDraftReceipt) { const loaded = load(); const existing = loaded.state.receipts.find((item) => item.receiptId === receipt.receiptId); if (existing) return deepClone(existing); loaded.state.receipts.push(deepClone(receipt)); audit(loaded.state, "WORDPRESS_DRAFT_CREATED", { receiptId: receipt.receiptId, wordpressObjectId: receipt.wordpressObjectId }, receipt.createdAt); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(receipt); }
export function saveHoustonDraftCertification(certification: HoustonDraftVisualCertification) { const loaded = load(); const existing = loaded.state.certifications.find((item) => item.certificationId === certification.certificationId); if (existing) return deepClone(existing); loaded.state.certifications.push(deepClone(certification)); audit(loaded.state, "THEME_INTEGRATED_DRAFT_CERTIFIED", { certificationId: certification.certificationId, state: certification.overallState }, certification.createdAt); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(certification); }
export function saveHoustonPreviewDraftComparison(comparison: HoustonPreviewDraftComparison) { const loaded = load(); const existing = loaded.state.comparisons.find((item) => item.comparisonId === comparison.comparisonId); if (existing) return deepClone(existing); loaded.state.comparisons.push(deepClone(comparison)); audit(loaded.state, "PREVIEW_DRAFT_DRIFT_EVALUATED", { comparisonId: comparison.comparisonId, drift: comparison.drift }, comparison.createdAt); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(comparison); }
export function appendHoustonDraftAudit(action: string, detail: HoustonDraftAuditEvent["detail"], at = new Date().toISOString()) { const loaded = load(); audit(loaded.state, action, detail, at); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(loaded.state.audit.at(-1)!); }
