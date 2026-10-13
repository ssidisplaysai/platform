import "server-only";

import { randomUUID } from "node:crypto";

import { deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";
import type {
  DallasCampaignReconciliationReceipt,
  DallasDraftPublicComparison,
  DallasPublicationApproval,
  DallasPublicationAuditEvent,
  DallasPublicationIdentity,
  DallasPublicationIntent,
  DallasPublicVerification,
  DallasPublicVisualCertification,
  DallasReferencePageCertification,
  DallasReferencePageRevocation,
  DallasWordPressPublicationReceipt,
} from "./dallas-reference-page-publication";
import { DALLAS_REFERENCE_PAGE_REPUBLICATION_CONTRACT } from "./dallas-reference-page-publication";

const NAMESPACE = "dallas-reference-page-publication-v1";
type State = { approvals: DallasPublicationApproval[]; intents: DallasPublicationIntent[]; publicationReceipts: DallasWordPressPublicationReceipt[]; publicVerifications: DallasPublicVerification[]; visualCertifications: DallasPublicVisualCertification[]; comparisons: DallasDraftPublicComparison[]; reconciliations: DallasCampaignReconciliationReceipt[]; referenceCertifications: DallasReferencePageCertification[]; referenceRevocations: DallasReferencePageRevocation[]; audit: DallasPublicationAuditEvent[] };
const seed = (): State => ({ approvals: [], intents: [], publicationReceipts: [], publicVerifications: [], visualCertifications: [], comparisons: [], reconciliations: [], referenceCertifications: [], referenceRevocations: [], audit: [] });
const load = () => { const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed }); return { ...loaded, state: { ...loaded.state, referenceRevocations: loaded.state.referenceRevocations ?? [] } }; };
const save = (loaded: ReturnType<typeof load>) => savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
const audit = (state: State, action: DallasPublicationAuditEvent["action"], detail: DallasPublicationAuditEvent["detail"], at: string) => state.audit.push({ eventId: `audit-${randomUUID()}`, action, detail, at });

export function getDallasPublicationState(): State { return deepClone(load().state); }
export function persistDallasPublicationApprovalAndIntent(input: { identity: DallasPublicationIdentity; expectedPublicUrl: string; rollbackArtifactId: string; now: string }) {
  const loaded = load();
  const existing = loaded.state.approvals.find((item) => item.decision === "APPROVED_FOR_REPUBLICATION_AFTER_THEME_REPAIR" && item.identity.themeIntegration?.certificationHash === input.identity.themeIntegration.certificationHash);
  if (existing) return { approval: deepClone(existing), intent: deepClone(loaded.state.intents.find((item) => item.approvalId === existing.approvalId)!) };
  const approval: DallasPublicationApproval = { approvalId: `dallas-theme-repair-publication-approval-${randomUUID()}`, decision: "APPROVED_FOR_REPUBLICATION_AFTER_THEME_REPAIR", ownerStatement: "approved", source: "OWNER_REPAIRED_THEME_INTEGRATION_REVIEW", identity: deepClone(input.identity), approvedAt: input.now };
  const intent: DallasPublicationIntent = { intentId: `dallas-theme-repair-publication-intent-${randomUUID()}`, contract: DALLAS_REFERENCE_PAGE_REPUBLICATION_CONTRACT, approvalId: approval.approvalId, identity: deepClone(input.identity), expectedPublicUrl: input.expectedPublicUrl, rollbackArtifactId: input.rollbackArtifactId, createdAt: input.now, state: "READY" };
  loaded.state.approvals.push(approval); loaded.state.intents.push(intent); audit(loaded.state, "OWNER_PUBLICATION_APPROVED", { approvalId: approval.approvalId, contentHash: input.identity.contentHash }, input.now); audit(loaded.state, "PUBLICATION_INTENT_CREATED", { intentId: intent.intentId, expectedPublicUrl: input.expectedPublicUrl }, input.now); save(loaded); return { approval: deepClone(approval), intent: deepClone(intent) };
}
export function saveDallasPublicationRecord<K extends "publicationReceipts" | "publicVerifications" | "visualCertifications" | "comparisons" | "reconciliations" | "referenceCertifications">(key: K, record: State[K][number], action: DallasPublicationAuditEvent["action"], at: string) { const loaded = load(); const records = loaded.state[key] as unknown as Record<string, unknown>[]; const id = Object.entries(record as Record<string, unknown>).find(([name]) => name.endsWith("Id"))?.[1]; const existing = records.find((item) => Object.values(item).includes(id)); if (existing) return deepClone(existing) as State[K][number]; records.push(deepClone(record) as Record<string, unknown>); audit(loaded.state, action, { recordId: String(id ?? "unknown") }, at); save(loaded); return deepClone(record); }
export function consumeDallasPublicationIntent(intentId: string) { const loaded = load(); const intent = loaded.state.intents.find((item) => item.intentId === intentId); if (!intent) throw new Error("DALLAS_PUBLICATION_INTENT_NOT_FOUND"); intent.state = "CONSUMED"; save(loaded); return deepClone(intent); }
export function appendDallasPublicationAudit(action: DallasPublicationAuditEvent["action"], detail: DallasPublicationAuditEvent["detail"], at = new Date().toISOString()) { const loaded = load(); audit(loaded.state, action, detail, at); save(loaded); return deepClone(loaded.state.audit.at(-1)!); }
export function revokeDallasReferenceCertification(record: DallasReferencePageRevocation) { const loaded = load(); const existing = loaded.state.referenceRevocations.find((item) => item.certificationId === record.certificationId); if (existing) return deepClone(existing); loaded.state.referenceRevocations.push(deepClone(record)); audit(loaded.state, "REFERENCE_REVOKED", { revocationId: record.revocationId, certificationId: record.certificationId, reason: record.reason }, record.revokedAt); save(loaded); return deepClone(record); }