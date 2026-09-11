import { randomUUID } from "node:crypto";

import { deepClone, loadPersistedState, savePersistedState } from "./foundation-persistence";
import type { GenerationAuthoritySnapshot, GenerationReadinessResult } from "./site-generation-readiness";
import type { SiteBuildPageAuthority, SiteBuildPlanChangeRequest, SiteBuildPlanProposal } from "./site-build-plan";
import type { SiteAssemblyProposal, SiteGeneratedPageRevision } from "./site-page-generation";

export type SiteGenerationReadinessCertification = GenerationAuthoritySnapshot & {
  certificationId: string;
  revision: number;
  organizationId: string;
  siteId: string;
  certifiedAt: string;
  certifiedBy: string;
};

export type SiteBuildSession = {
  buildSessionId: string;
  organizationId: string;
  siteId: string;
  certificationId: string;
  state: "STARTED";
  startedAt: string;
  startedBy: string;
};

export type SiteBuildDraft = {
  draftId: string;
  pageId: string;
  title: string;
  slug: string;
  excerpt: string;
  contentHtml: string;
  authority: SiteBuildPageAuthority[];
};

export type SiteBuildDraftSet = {
  draftSetId: string;
  buildSessionId: string;
  organizationId: string;
  siteId: string;
  buildPlanRevision: number;
  authoritySnapshot: GenerationAuthoritySnapshot;
  status: "GENERATED" | "APPROVED";
  drafts: SiteBuildDraft[];
  createdAt: string;
  createdBy: string;
  approvedAt: string | null;
  approvedBy: string | null;
};

export type SiteBuildWordPressDraft = {
  buildSessionId: string;
  draftId: string;
  wordpressObjectId: string;
  wordpressUrl: string;
  wordpressStatus: "draft";
  createdAt: string;
};
export type SiteBuildWordPressContentUpdate = { buildSessionId: string; pageRevisionId: string; wordpressObjectId: string; wordpressUrl: string; wordpressStatus: "draft"; updatedAt: string };

type State = {
  certifications: SiteGenerationReadinessCertification[];
  buildSessions: SiteBuildSession[];
  buildPlans?: SiteBuildPlanProposal[];
  buildPlanChangeRequests?: SiteBuildPlanChangeRequest[];
  draftSets?: SiteBuildDraftSet[];
  wordpressDrafts?: SiteBuildWordPressDraft[];
  siteAssemblies?: SiteAssemblyProposal[];
  wordpressContentUpdates?: SiteBuildWordPressContentUpdate[];
};

const NAMESPACE = "site-generation-readiness-repository";
const seed = (): State => ({ certifications: [], buildSessions: [] });
function load() {
  const loaded = loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: seed });
  return { ...loaded, state: { ...loaded.state, buildPlans: loaded.state.buildPlans ?? [], buildPlanChangeRequests: loaded.state.buildPlanChangeRequests ?? [], draftSets: loaded.state.draftSets ?? [], wordpressDrafts: loaded.state.wordpressDrafts ?? [], siteAssemblies: loaded.state.siteAssemblies ?? [], wordpressContentUpdates: loaded.state.wordpressContentUpdates ?? [] } };
}
function escapeHtml(value: string): string { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }

function sameSnapshot(left: GenerationAuthoritySnapshot, right: GenerationAuthoritySnapshot): boolean {
  return left.strategyRevision === right.strategyRevision
    && left.creativeRevision === right.creativeRevision
    && left.marketFingerprint === right.marketFingerprint
    && left.capabilityFingerprint === right.capabilityFingerprint
    && left.productServiceFingerprint === right.productServiceFingerprint
    && left.sourcesFingerprint === right.sourcesFingerprint
    && left.generationPolicyVersion === right.generationPolicyVersion;
}

export function getGenerationCertification(input: { organizationId: string; siteId: string; snapshot: GenerationAuthoritySnapshot }) {
  const records = load().state.certifications
    .filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId);
  const certification = records.at(-1) ?? null;
  return deepClone({ certification, status: certification ? sameSnapshot(certification, input.snapshot) ? "CURRENT" as const : "STALE" as const : "NOT_CERTIFIED" as const });
}

export function certifyGenerationReadiness(input: { organizationId: string; siteId: string; actor: string; readiness: GenerationReadinessResult }): SiteGenerationReadinessCertification {
  if (!input.readiness.readyToCertify) throw new Error("GENERATION_READINESS_BLOCKED");
  const loaded = load();
  const prior = loaded.state.certifications.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId);
  const timestamp = new Date().toISOString();
  const certification: SiteGenerationReadinessCertification = {
    certificationId: `generation-readiness-${randomUUID()}`,
    revision: (prior.at(-1)?.revision ?? 0) + 1,
    organizationId: input.organizationId,
    siteId: input.siteId,
    certifiedAt: timestamp,
    certifiedBy: input.actor,
    ...input.readiness.snapshot,
  };
  loaded.state.certifications.push(certification);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(certification);
}

export function getSiteBuildSession(input: { organizationId: string; siteId: string }): SiteBuildSession | null {
  const sessions = load().state.buildSessions;
  return deepClone(sessions.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId).at(-1) ?? null);
}

export function startSiteBuild(input: { organizationId: string; siteId: string; actor: string; certification: SiteGenerationReadinessCertification }): SiteBuildSession {
  const loaded = load();
  const existing = loaded.state.buildSessions.find((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.state === "STARTED");
  if (existing) return deepClone(existing);
  const session: SiteBuildSession = { buildSessionId: `site-build-${randomUUID()}`, organizationId: input.organizationId, siteId: input.siteId, certificationId: input.certification.certificationId, state: "STARTED", startedAt: new Date().toISOString(), startedBy: input.actor };
  loaded.state.buildSessions.push(session);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(session);
}

export function listActiveSiteBuildSessions(input: { organizationId: string; siteId: string }): SiteBuildSession[] {
  return deepClone(load().state.buildSessions.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.state === "STARTED"));
}

export function getSiteBuildRecords(input: { organizationId: string; siteId: string; buildSessionId: string }) {
  const state = load().state;
  const plans = state.buildPlans.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId);
  const changeRequests = state.buildPlanChangeRequests.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId);
  const draftSets = state.draftSets.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId);
  const wordpressDrafts = state.wordpressDrafts.filter((item) => item.buildSessionId === input.buildSessionId);
  const assemblies = state.siteAssemblies.filter((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId);
  const wordpressContentUpdates = state.wordpressContentUpdates.filter((item) => item.buildSessionId === input.buildSessionId);
  return deepClone({ plans, changeRequests, currentPlan: plans.at(-1) ?? null, draftSet: draftSets.at(-1) ?? null, wordpressDrafts, assemblies, currentAssembly: assemblies.at(-1) ?? null, wordpressContentUpdates });
}

export function saveBuildPlanProposal(plan: SiteBuildPlanProposal): SiteBuildPlanProposal {
  const loaded = load();
  const existing = loaded.state.buildPlans.find((item) => item.buildSessionId === plan.buildSessionId && item.revision === plan.revision);
  if (existing) return deepClone(existing);
  loaded.state.buildPlans.push(plan);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(plan);
}

export function decideBuildPlan(input: { organizationId: string; siteId: string; buildSessionId: string; revision: number; decision: "APPROVE" | "REJECT"; actor: string; reason: string }): SiteBuildPlanProposal {
  const loaded = load();
  const index = loaded.state.buildPlans.findIndex((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId && item.revision === input.revision);
  if (index < 0 || loaded.state.buildPlans[index].status !== "PROPOSED") throw new Error("BUILD_PLAN_NOT_PROPOSED");
  const timestamp = new Date().toISOString();
  loaded.state.buildPlans[index] = { ...loaded.state.buildPlans[index], status: input.decision === "APPROVE" ? "APPROVED" : "REJECTED", decidedBy: input.actor, decidedAt: timestamp, ownerInstructions: input.reason.trim() || loaded.state.buildPlans[index].ownerInstructions };
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(loaded.state.buildPlans[index]);
}

export function saveRevisedBuildPlan(input: { currentRevision: number; proposal: SiteBuildPlanProposal; changeRequest: SiteBuildPlanChangeRequest; actor: string }): SiteBuildPlanProposal {
  const instructions = input.changeRequest.instructions;
  if (!instructions.trim()) throw new Error("BUILD_PLAN_CHANGE_INSTRUCTIONS_REQUIRED");
  const loaded = load();
  const currentIndex = loaded.state.buildPlans.findIndex((item) => item.buildSessionId === input.proposal.buildSessionId && item.revision === input.currentRevision && item.status === "PROPOSED");
  if (currentIndex < 0) throw new Error("BUILD_PLAN_NOT_PROPOSED");
  loaded.state.buildPlans[currentIndex] = { ...loaded.state.buildPlans[currentIndex], status: "REVISION_REQUESTED", decidedBy: input.actor, decidedAt: new Date().toISOString() };
  loaded.state.buildPlanChangeRequests.push(input.changeRequest);
  loaded.state.buildPlans.push(input.proposal);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(input.proposal);
}

export function generateSiteBuildDrafts(input: { plan: SiteBuildPlanProposal; actor: string }): SiteBuildDraftSet {
  if (input.plan.status !== "APPROVED") throw new Error("APPROVED_BUILD_PLAN_REQUIRED");
  const loaded = load();
  const existing = loaded.state.draftSets.find((item) => item.buildSessionId === input.plan.buildSessionId && item.buildPlanRevision === input.plan.revision);
  if (existing) return deepClone(existing);
  const drafts = input.plan.pages.filter((item) => item.launchPhase === "INITIAL").map((item) => {
    const authorityLabels = item.authority.filter((authority) => authority.kind !== "CREATIVE").map((authority) => authority.label);
    return { draftId: `${item.pageId}-draft`, pageId: item.pageId, title: item.name, slug: item.slug || "home", excerpt: item.purpose, contentHtml: [`<h1>${escapeHtml(item.name)}</h1>`, `<p>${escapeHtml(item.purpose)}</p>`, `<h2>Approved scope</h2>`, `<p>${authorityLabels.map(escapeHtml).join("; ")}</p>`, `<p>Contact ${escapeHtml(item.authority.find((authority) => authority.kind === "SITE")?.label ?? "the site owner")} to discuss project requirements. Specifications, certifications, geography, pricing, and delivery commitments require separate documented confirmation.</p>`].join("\n"), authority: item.authority };
  });
  const draftSet: SiteBuildDraftSet = { draftSetId: `${input.plan.buildSessionId}-plan-${input.plan.revision}-drafts`, buildSessionId: input.plan.buildSessionId, organizationId: input.plan.organizationId, siteId: input.plan.siteId, buildPlanRevision: input.plan.revision, authoritySnapshot: input.plan.authoritySnapshot, status: "GENERATED", drafts, createdAt: new Date().toISOString(), createdBy: input.actor, approvedAt: null, approvedBy: null };
  loaded.state.draftSets.push(draftSet);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(draftSet);
}

export function approveSiteBuildDrafts(input: { organizationId: string; siteId: string; buildSessionId: string; draftSetId: string; actor: string }): SiteBuildDraftSet {
  const loaded = load();
  const index = loaded.state.draftSets.findIndex((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId && item.draftSetId === input.draftSetId);
  if (index < 0) throw new Error("BUILD_DRAFT_SET_NOT_FOUND");
  loaded.state.draftSets[index] = { ...loaded.state.draftSets[index], status: "APPROVED", approvedAt: new Date().toISOString(), approvedBy: input.actor };
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(loaded.state.draftSets[index]);
}

export function recordSiteBuildWordPressDraft(input: SiteBuildWordPressDraft): SiteBuildWordPressDraft {
  const loaded = load();
  const existing = loaded.state.wordpressDrafts.find((item) => item.buildSessionId === input.buildSessionId && item.draftId === input.draftId);
  if (existing) return deepClone(existing);
  loaded.state.wordpressDrafts.push(input);
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision });
  return deepClone(input);
}

export function saveSiteAssemblyProposal(assembly: SiteAssemblyProposal): SiteAssemblyProposal {
  const loaded = load(); const existing = loaded.state.siteAssemblies.find((item) => item.assemblyId === assembly.assemblyId);
  if (existing) return deepClone(existing);
  loaded.state.siteAssemblies.push(assembly); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(assembly);
}

export function decideSiteAssemblyPage(input: { organizationId: string; siteId: string; buildSessionId: string; assemblyId: string; pageId: string; decision: "APPROVE" | "REQUEST_CHANGES"; instructions?: string; actor: string }): SiteAssemblyProposal {
  const loaded = load(); const assemblyIndex = loaded.state.siteAssemblies.findIndex((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId && item.assemblyId === input.assemblyId);
  if (assemblyIndex < 0) throw new Error("SITE_ASSEMBLY_NOT_FOUND"); const assembly = loaded.state.siteAssemblies[assemblyIndex]; const pageIndex = assembly.pages.findIndex((item) => item.pageId === input.pageId);
  if (pageIndex < 0) throw new Error("SITE_ASSEMBLY_PAGE_NOT_FOUND"); if (input.decision === "APPROVE" && !assembly.pages[pageIndex].quality.ready) throw new Error("PAGE_QUALITY_NOT_READY");
  assembly.pages[pageIndex] = { ...assembly.pages[pageIndex], status: input.decision === "APPROVE" ? "APPROVED" : "REVISION_REQUESTED", requestedChanges: input.decision === "REQUEST_CHANGES" ? input.instructions?.trim() || null : assembly.pages[pageIndex].requestedChanges, decidedAt: new Date().toISOString(), decidedBy: input.actor };
  if (assembly.pages.every((item) => item.status === "APPROVED")) assembly.status = "APPROVED";
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(assembly);
}

export function approveAllReadySiteAssemblyPages(input: { organizationId: string; siteId: string; buildSessionId: string; assemblyId: string; actor: string }): SiteAssemblyProposal {
  const loaded = load(); const index = loaded.state.siteAssemblies.findIndex((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId && item.assemblyId === input.assemblyId);
  if (index < 0) throw new Error("SITE_ASSEMBLY_NOT_FOUND"); const timestamp = new Date().toISOString(); const assembly = loaded.state.siteAssemblies[index];
  assembly.pages = assembly.pages.map((item) => item.quality.ready ? { ...item, status: "APPROVED", decidedAt: timestamp, decidedBy: input.actor } : item); assembly.status = assembly.pages.every((item) => item.status === "APPROVED") ? "APPROVED" : assembly.status;
  savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(assembly);
}

export function replaceSiteAssemblyPageRevision(input: { organizationId: string; siteId: string; buildSessionId: string; priorAssemblyId: string; page: SiteGeneratedPageRevision; actor: string }): SiteAssemblyProposal {
  const loaded = load(); const prior = loaded.state.siteAssemblies.find((item) => item.organizationId === input.organizationId && item.siteId === input.siteId && item.buildSessionId === input.buildSessionId && item.assemblyId === input.priorAssemblyId);
  if (!prior) throw new Error("SITE_ASSEMBLY_NOT_FOUND"); const revision = (loaded.state.siteAssemblies.filter((item) => item.buildSessionId === input.buildSessionId).at(-1)?.revision ?? prior.revision) + 1;
  const assembly: SiteAssemblyProposal = { ...deepClone(prior), assemblyId: `${input.buildSessionId}-assembly-${revision}`, revision, status: "READY_FOR_OWNER_REVIEW", pages: prior.pages.map((item) => item.pageId === input.page.pageId ? input.page : item), createdAt: new Date().toISOString(), createdBy: input.actor };
  loaded.state.siteAssemblies.push(assembly); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(assembly);
}

export function recordSiteBuildWordPressContentUpdate(input: SiteBuildWordPressContentUpdate): SiteBuildWordPressContentUpdate {
  const loaded = load(); const existing = loaded.state.wordpressContentUpdates.find((item) => item.buildSessionId === input.buildSessionId && item.pageRevisionId === input.pageRevisionId);
  if (existing) return deepClone(existing); loaded.state.wordpressContentUpdates.push(input); savePersistedState({ namespace: NAMESPACE, state: loaded.state, expectedRevision: loaded.revision }); return deepClone(input);
}