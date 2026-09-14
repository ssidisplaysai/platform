import "server-only";

import { createHash } from "node:crypto";
import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "@/modules/foundation/foundation-persistence";
import { listGlwCampaignTargets, reconcileGlwCampaignTargetContentReady, type GlwCampaignTarget } from "./campaign-target-repository";
import { createGlwN8nMcpExecutionReader } from "./n8n-mcp-adapter";
import { createGlwDraftExecutionService, normalizeGlwN8nExecutionResult, type GlwN8nExecutionReader, type GlwPageExecutionRecord } from "./page-execution";
import { glwPageExecutionRepository } from "./page-execution-repository";

const NAMESPACE = "glw-san-antonio-608895-reconciliation-v1";
const ARTIFACT_SHA256 = "0255fda847e2962dc0ae10afcd86a646a5d89aef303331286babf2dae49078d2";
const SECURITY_REPAIR_SHA = "a478108f81ea0a49027d968cb62e979bc453c68b";

export const SAN_ANTONIO_608895_IDENTITY = {
  organizationId: "ssi",
  siteId: "site-ssi-projectorenclosure",
  campaignId: "campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities",
  targetId: "target-campaign-ssi-site-ssi-projectorenclosure-fan-cooled-projector-enclosures-texas-cities-tx-san-antonio",
  stateCode: "TX",
  citySlug: "san-antonio",
  canonicalPath: "fan-cooled-projector-enclosures/texas/san-antonio",
  jobId: "f518ffb7-9216-4866-a93c-7f4793e74038",
  leaseId: "aaba3a04-4f7a-493e-8893-a8a1769a4ec7",
  externalExecutionId: "608895",
  artifactSha256: ARTIFACT_SHA256,
  securityRepairSha: SECURITY_REPAIR_SHA,
} as const;

type Principal = { principalId: string; sessionId: string };
type BeforeState = {
  jobStatus: string;
  targetStatus: string;
  leaseId: string;
  leasedAt: string;
  leaseExpiresAt: string;
  dispatchDate: string;
};

export type SanAntonio608895ReconciliationReceipt = {
  receiptId: "san-antonio-608895-owner-reconciliation-v1";
  contract: "SAN_ANTONIO_608895_OWNER_AUTHORIZED_RECONCILIATION_V1";
  classification: "UNAUTHORIZED_VALID_DISPATCH";
  severity: "HIGH";
  identity: typeof SAN_ANTONIO_608895_IDENTITY;
  principal: Principal;
  securityRepairSha: typeof SECURITY_REPAIR_SHA;
  reconciliationRuntimeSha: string;
  before: BeforeState;
  authorizationRecordedAt: string;
  outcome: "AUTHORIZED" | "RECONCILED";
  reconciledAt: string | null;
  after: null | { jobStatus: "CONTENT_READY"; targetStatus: "content_ready"; leaseCleared: true; dispatchDate: string };
  generatedArtifact: null | { sha256: typeof ARTIFACT_SHA256; htmlLength: number };
  wordpressMutationPerformed: false;
  publicationPerformed: false;
  dispatchPerformed: false;
  workflowExecuted: false;
  ownerContentDecision: "NONE";
};

type State = { authorizations: SanAntonio608895ReconciliationReceipt[]; outcomes: SanAntonio608895ReconciliationReceipt[] };
const seed = (): State => ({ authorizations: [], outcomes: [] });

function latestReceipt(): SanAntonio608895ReconciliationReceipt | null {
  const { state } = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
  return deepClone(state.outcomes.at(-1) ?? state.authorizations.at(-1) ?? null);
}

function appendReceipt(receipt: SanAntonio608895ReconciliationReceipt): SanAntonio608895ReconciliationReceipt {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
    const collection = receipt.outcome === "AUTHORIZED" ? loaded.state.authorizations : loaded.state.outcomes;
    const existing = collection.find((candidate) => candidate.receiptId === receipt.receiptId);
    if (existing) return deepClone(existing);
    const state = deepClone(loaded.state);
    (receipt.outcome === "AUTHORIZED" ? state.authorizations : state.outcomes).push(deepClone(receipt));
    try {
      savePersistedState({ namespace: NAMESPACE, state, expectedRevision: loaded.revision });
      return deepClone(receipt);
    } catch (error) {
      if (!(error instanceof FoundationPersistenceConflictError) || attempt === 7) throw error;
    }
  }
  throw new Error("SAN_ANTONIO_RECONCILIATION_CAS_RETRY_EXHAUSTED");
}

function exactTarget(): GlwCampaignTarget | null {
  return listGlwCampaignTargets(SAN_ANTONIO_608895_IDENTITY.campaignId).find((target) => target.targetId === SAN_ANTONIO_608895_IDENTITY.targetId) ?? null;
}

function validateIdentity(job: GlwPageExecutionRecord | null, target: GlwCampaignTarget | null): { job: GlwPageExecutionRecord; target: GlwCampaignTarget } {
  const identity = SAN_ANTONIO_608895_IDENTITY;
  if (!job || !target || job.jobId !== identity.jobId || target.jobId !== identity.jobId || job.externalExecutionId !== identity.externalExecutionId || target.campaignId !== identity.campaignId || target.organizationId !== identity.organizationId || target.siteId !== identity.siteId || target.stateCode !== identity.stateCode || target.citySlug !== identity.citySlug || target.canonicalPath !== identity.canonicalPath || job.organizationId !== identity.organizationId || job.siteId !== identity.siteId || job.slug !== identity.canonicalPath) throw new Error("SAN_ANTONIO_RECONCILIATION_IDENTITY_MISMATCH");
  if (job.wordpressObjectId || job.wordpressUrl || job.wordpressStatus || target.wordpressObjectId) throw new Error("SAN_ANTONIO_RECONCILIATION_WORDPRESS_STATE_FORBIDDEN");
  if (job.requestedPublicationMode !== "draft" || !target.dispatchDate) throw new Error("SAN_ANTONIO_RECONCILIATION_EVIDENCE_MISSING");
  return { job, target };
}

export function createSanAntonio608895ReconciliationService(input?: {
  reader?: GlwN8nExecutionReader;
  now?: () => Date;
  getJob?: () => Promise<GlwPageExecutionRecord | null>;
  getTarget?: () => GlwCampaignTarget | null;
  applyTerminal?: ReturnType<typeof createGlwDraftExecutionService>["applyTerminalResult"];
  transitionTarget?: typeof reconcileGlwCampaignTargetContentReady;
  getReceipt?: () => SanAntonio608895ReconciliationReceipt | null;
  saveReceipt?: (receipt: SanAntonio608895ReconciliationReceipt) => SanAntonio608895ReconciliationReceipt;
  hashArtifact?: (contentHtml: string) => string;
}) {
  const reader = input?.reader ?? createGlwN8nMcpExecutionReader();
  const now = input?.now ?? (() => new Date());
  const executionService = createGlwDraftExecutionService({ repository: glwPageExecutionRepository, dispatcher: { async dispatch() { throw new Error("DISPATCH_FORBIDDEN_DURING_RECONCILIATION"); } } });
  const getJob = input?.getJob ?? (() => glwPageExecutionRepository.getById(SAN_ANTONIO_608895_IDENTITY.jobId));
  const getTarget = input?.getTarget ?? exactTarget;
  const applyTerminal = input?.applyTerminal ?? executionService.applyTerminalResult;
  const transitionTarget = input?.transitionTarget ?? reconcileGlwCampaignTargetContentReady;
  const getReceipt = input?.getReceipt ?? latestReceipt;
  const saveReceipt = input?.saveReceipt ?? appendReceipt;
  const hashArtifact = input?.hashArtifact ?? ((contentHtml: string) => createHash("sha256").update(contentHtml).digest("hex"));

  return async function reconcile(principal: Principal, reconciliationRuntimeSha: string) {
    const completed = getReceipt();
    if (!principal.principalId.trim() || !principal.sessionId.trim()) throw new Error("SAN_ANTONIO_RECONCILIATION_PRINCIPAL_REQUIRED");
    if (!/^[0-9a-f]{40}$/.test(reconciliationRuntimeSha)) throw new Error("SAN_ANTONIO_RECONCILIATION_RUNTIME_SHA_INVALID");
    if (completed && (completed.principal.principalId !== principal.principalId.trim() || completed.principal.sessionId !== principal.sessionId.trim())) throw new Error("SAN_ANTONIO_RECONCILIATION_PRINCIPAL_MISMATCH");
    if (completed?.outcome === "RECONCILED") return { receipt: completed, reused: true };
    const beforeState = validateIdentity(await getJob(), getTarget());
    const { job, target } = beforeState;
    if (!completed && (job.status !== "DISPATCHED" || target.status !== "running" || target.leaseId !== SAN_ANTONIO_608895_IDENTITY.leaseId || !target.leasedAt || !target.leaseExpiresAt)) throw new Error("SAN_ANTONIO_RECONCILIATION_BEFORE_STATE_MISMATCH");
    if (completed && !(["DISPATCHED", "CONTENT_READY"].includes(job.status) && ["running", "content_ready"].includes(target.status) && target.dispatchDate === completed.before.dispatchDate)) throw new Error("SAN_ANTONIO_RECONCILIATION_RESUME_STATE_MISMATCH");
    if (target.status === "running" && (target.leaseId !== SAN_ANTONIO_608895_IDENTITY.leaseId || target.leasedAt !== (completed?.before.leasedAt ?? target.leasedAt) || target.leaseExpiresAt !== (completed?.before.leaseExpiresAt ?? target.leaseExpiresAt))) throw new Error("SAN_ANTONIO_RECONCILIATION_LEASE_HISTORY_MISMATCH");
    if (target.status === "content_ready" && (target.leaseId || target.leasedAt || target.leaseExpiresAt)) throw new Error("SAN_ANTONIO_RECONCILIATION_RESOLVED_LEASE_MISMATCH");
    const snapshot = await reader.readExecution(SAN_ANTONIO_608895_IDENTITY.externalExecutionId);
    const terminal = normalizeGlwN8nExecutionResult({ snapshot, expectedJobId: SAN_ANTONIO_608895_IDENTITY.jobId });
    if (!terminal || terminal.kind !== "complete" || terminal.executionId !== SAN_ANTONIO_608895_IDENTITY.externalExecutionId || terminal.wordpressObjectId || terminal.wordpressUrl || terminal.wordpressStatus || terminal.requestedPublicationMode !== "draft" || !terminal.generatedDraft) throw new Error("SAN_ANTONIO_RECONCILIATION_NOT_CONTENT_READY");
    const artifactHash = hashArtifact(terminal.generatedDraft.contentHtml);
    if (artifactHash !== ARTIFACT_SHA256) throw new Error("SAN_ANTONIO_RECONCILIATION_ARTIFACT_MISMATCH");
    const timestamp = now().toISOString();
    const before: BeforeState = completed?.before ?? { jobStatus: job.status, targetStatus: target.status, leaseId: target.leaseId!, leasedAt: target.leasedAt!, leaseExpiresAt: target.leaseExpiresAt!, dispatchDate: target.dispatchDate! };
    const authorization = completed ?? saveReceipt({ receiptId: "san-antonio-608895-owner-reconciliation-v1", contract: "SAN_ANTONIO_608895_OWNER_AUTHORIZED_RECONCILIATION_V1", classification: "UNAUTHORIZED_VALID_DISPATCH", severity: "HIGH", identity: SAN_ANTONIO_608895_IDENTITY, principal: { principalId: principal.principalId.trim(), sessionId: principal.sessionId.trim() }, securityRepairSha: SECURITY_REPAIR_SHA, reconciliationRuntimeSha, before, authorizationRecordedAt: timestamp, outcome: "AUTHORIZED", reconciledAt: null, after: null, generatedArtifact: null, wordpressMutationPerformed: false, publicationPerformed: false, dispatchPerformed: false, workflowExecuted: false, ownerContentDecision: "NONE" });
    const updatedJob = job.status === "CONTENT_READY" ? job : await applyTerminal(SAN_ANTONIO_608895_IDENTITY.jobId, terminal);
    if (updatedJob.status !== "CONTENT_READY" || updatedJob.wordpressObjectId || updatedJob.wordpressUrl || updatedJob.wordpressStatus) throw new Error("SAN_ANTONIO_RECONCILIATION_JOB_TRANSITION_FAILED");
    const transitionedTarget = target.status === "content_ready" ? target : transitionTarget({ ...SAN_ANTONIO_608895_IDENTITY, now: now() }).target;
    const receipt = saveReceipt({ ...authorization, outcome: "RECONCILED", reconciledAt: now().toISOString(), after: { jobStatus: "CONTENT_READY", targetStatus: "content_ready", leaseCleared: true, dispatchDate: transitionedTarget.dispatchDate! }, generatedArtifact: { sha256: ARTIFACT_SHA256, htmlLength: terminal.generatedDraft.contentHtml.length } });
    return { receipt, reused: false };
  };
}

export function getSanAntonio608895ReconciliationReceipt() {
  return latestReceipt();
}