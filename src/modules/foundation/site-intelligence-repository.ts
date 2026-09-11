import "server-only";

import { randomUUID } from "node:crypto";
import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import type {
  CapabilityEvidenceRelevance,
  CapabilityEvidenceState,
  CapabilityEvidenceOption,
  CreativeDirectionProposal,
  CreativeInput,
  OpportunityDecision,
  SiteIntelligenceEvidence,
  SiteIntelligenceWorkspace,
  SiteOpportunity,
  SiteResearchExecution,
  SiteStrategyProposal,
} from "./site-intelligence";
import { getCapabilityEvidencePolicy, hasVerifiedCapability, isEvidenceSufficientForCapabilityPolicy, SITE_INTELLIGENCE_REFERENCE_LIMITS } from "./site-intelligence";
import { selectDistinctCapabilityOpportunities } from "./site-capability-transition";

const NAMESPACE = "site-intelligence-repository";
type State = { workspaces: SiteIntelligenceWorkspace[] };
const CREATIVE_CLASSIFICATIONS: CreativeInput["classification"][] = ["OWNER_APPROVED_PUBLISHABLE", "OWNER_SUPPLIED_REFERENCE", "GENESIS_GENERATED_CANDIDATE", "EXTERNAL_INSPIRATION_ONLY", "COMPETITOR_REFERENCE_ONLY", "UNVERIFIED", "REJECTED"];
const CREATIVE_SENTIMENTS: CreativeInput["sentiment"][] = ["LIKE", "DISLIKE", "REFERENCE_ONLY", "NEUTRAL"];

function load(): { state: State; revision: number } {
  return loadPersistedState<State>({ namespace: NAMESPACE, seedFactory: () => ({ workspaces: [] }) });
}

function save(state: State, revision: number): void {
  savePersistedState({ namespace: NAMESPACE, state, expectedRevision: revision });
}

function now(): string { return new Date().toISOString(); }

function event(action: string, actor: string, reason: string) {
  return { eventId: `site-intelligence-event-${randomUUID()}`, action, actor, reason, at: now() };
}

export function getSiteIntelligenceWorkspace(siteId: string): SiteIntelligenceWorkspace | null {
  const { state } = load();
  const workspace = state.workspaces.find((candidate) => candidate.siteId === siteId);
  return workspace ? deepClone(workspace) : null;
}

export function ensureSiteIntelligenceWorkspace(input: {
  organizationId: string;
  siteId: string;
  publicBrandIdentity: string;
  actor: string;
}): SiteIntelligenceWorkspace {
  const loaded = load();
  const existing = loaded.state.workspaces.find((candidate) => candidate.siteId === input.siteId);
  if (existing) {
    if (existing.organizationId !== input.organizationId) throw new Error("SITE_INTELLIGENCE_ORGANIZATION_MISMATCH");
    return deepClone(existing);
  }
  const timestamp = now();
  const workspace: SiteIntelligenceWorkspace = {
    workspaceId: `site-intelligence-${input.siteId}`,
    organizationId: input.organizationId,
    siteId: input.siteId,
    internalOrganizationIdentity: input.organizationId,
    publicBrandIdentity: input.publicBrandIdentity.trim(),
    revision: 0,
    intelligenceState: "INTELLIGENCE_NOT_STARTED",
    strategyState: "STRATEGY_NOT_STARTED",
    creativeState: "CREATIVE_NOT_STARTED",
    providerReference: null,
    researchStartedAt: null,
    researchExecutions: [],
    evidence: [], opportunities: [], strategyRevisions: [], creativeInputs: [], creativeRevisions: [],
    audit: [event("WORKSPACE_CREATED", input.actor, "Site intelligence workspace initialized without starting research.")],
    createdAt: timestamp, updatedAt: timestamp,
  };
  loaded.state.workspaces.push(workspace);
  save(loaded.state, loaded.revision);
  return deepClone(workspace);
}

function update(input: {
  siteId: string;
  organizationId: string;
  expectedRevision: number;
  actor: string;
  action: string;
  reason: string;
  mutate(workspace: SiteIntelligenceWorkspace): void;
}): SiteIntelligenceWorkspace {
  const loaded = load();
  const workspace = loaded.state.workspaces.find((candidate) => candidate.siteId === input.siteId);
  if (!workspace) throw new Error("SITE_INTELLIGENCE_NOT_FOUND");
  if (workspace.organizationId !== input.organizationId) throw new Error("SITE_INTELLIGENCE_ORGANIZATION_MISMATCH");
  if (workspace.revision !== input.expectedRevision) throw new FoundationPersistenceConflictError("Site intelligence revision conflict.");
  input.mutate(workspace);
  workspace.revision += 1;
  workspace.updatedAt = now();
  workspace.audit.push(event(input.action, input.actor, input.reason));
  save(loaded.state, loaded.revision);
  return deepClone(workspace);
}

export function startSiteIntelligence(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; providerReference: string; reason: string }) {
  return update({ ...input, action: "INTELLIGENCE_STARTED", mutate(workspace) {
    if (workspace.intelligenceState !== "INTELLIGENCE_NOT_STARTED") throw new Error("INTELLIGENCE_ALREADY_STARTED");
    workspace.intelligenceState = "INTELLIGENCE_RESEARCHING";
    workspace.providerReference = input.providerReference;
    workspace.researchStartedAt = now();
  }});
}

export function recordSiteOpportunity(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; opportunity: SiteOpportunity; evidence: SiteIntelligenceEvidence[] }) {
  return update({ ...input, action: "OPPORTUNITY_RECORDED", mutate(workspace) {
    if (input.opportunity.capabilityState === "VERIFIED" && input.opportunity.capabilityEvidenceIds.length === 0) throw new Error("CAPABILITY_EVIDENCE_REQUIRED");
    workspace.evidence.push(...input.evidence);
    workspace.opportunities.push(input.opportunity);
    workspace.intelligenceState = "INTELLIGENCE_READY_FOR_REVIEW";
  }});
}

export function decideSiteOpportunity(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; opportunityId: string; decision: OpportunityDecision }) {
  return update({ ...input, action: `OPPORTUNITY_${input.decision}`, mutate(workspace) {
    if (!["PENDING", "APPROVED", "RESEARCH_MORE", "HOLD", "REJECTED"].includes(input.decision)) throw new Error("OPPORTUNITY_DECISION_INVALID");
    const opportunity = selectDistinctCapabilityOpportunities(workspace.opportunities).find((candidate) => candidate.opportunityId === input.opportunityId);
    if (!opportunity) throw new Error("OPPORTUNITY_NOT_FOUND");
    opportunity.ownerDecision = input.decision;
    opportunity.decidedBy = input.actor;
    opportunity.decidedAt = now();
  }});
}

export function validateOpportunityCapability(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; opportunityId: string; state: CapabilityEvidenceState; evidenceIds: string[]; evidenceRelevance?: Array<Pick<CapabilityEvidenceRelevance, "evidenceId" | "relevanceType" | "ownerConfirmedRelevant">>; attestation?: string; notes: string }) {
  const currentDecision = input.state === "VERIFIED" || input.state === "QUALIFIED";
  const resolvedEvidence = currentDecision && input.evidenceIds.length ? resolveCapabilityEvidenceReferences({ organizationId: input.organizationId, siteId: input.siteId, referenceIds: input.evidenceIds }) : [];
  return update({ ...input, action: `CAPABILITY_${input.state}`, mutate(workspace) {
    if (!["INSUFFICIENT", "OWNER_VALIDATION_REQUIRED", "VERIFIED", "QUALIFIED", "REJECTED", "FUTURE_CAPABILITY"].includes(input.state)) throw new Error("CAPABILITY_STATE_INVALID");
    const opportunity = selectDistinctCapabilityOpportunities(workspace.opportunities).find((candidate) => candidate.opportunityId === input.opportunityId);
    if (!opportunity) throw new Error("OPPORTUNITY_NOT_FOUND");
    const evidencePolicy = getCapabilityEvidencePolicy(opportunity);
    if ((input.state === "VERIFIED" || input.state === "QUALIFIED" || input.state === "FUTURE_CAPABILITY") && !input.attestation?.trim()) throw new Error("CAPABILITY_ATTESTATION_REQUIRED");
    if (input.state === "QUALIFIED" && !input.notes.trim()) throw new Error("CAPABILITY_QUALIFICATION_NOTES_REQUIRED");
    const timestamp = now();
    const resolvedIds = new Set(resolvedEvidence.map((item) => item.referenceId));
    const suppliedRelevance = (input.evidenceRelevance ?? []).map((link): CapabilityEvidenceRelevance => {
      if (!resolvedIds.has(link.evidenceId)) throw new Error("CAPABILITY_RELEVANCE_EVIDENCE_MISMATCH");
      return { ...link, opportunityId: input.opportunityId, linkedBy: input.actor, linkedAt: timestamp };
    });
    const previousEvidenceIds = opportunity.capabilityEvidenceIds;
    const previousAuthority = opportunity.capabilityAuthorityRevisions?.at(-1);
    const evidenceIds = currentDecision && input.evidenceIds.length === 0 ? previousEvidenceIds : resolvedEvidence.map((item) => item.referenceId);
    const relevance = currentDecision && input.evidenceIds.length === 0
      ? (previousAuthority?.evidenceRelevance ?? []).map((link) => ({ ...link }))
      : suppliedRelevance;
    const hasSufficientRelevance = relevance.some((link) => evidenceIds.includes(link.evidenceId) && link.opportunityId === input.opportunityId && link.ownerConfirmedRelevant && isEvidenceSufficientForCapabilityPolicy(evidencePolicy, link.relevanceType));
    opportunity.capabilityState = input.state;
    opportunity.capabilityEvidenceIds = currentDecision ? evidenceIds : [];
    opportunity.capabilityNotes = input.notes.trim() || null;
    opportunity.capabilityAuthorityRevisions ??= [];
    opportunity.capabilityAuthorityRevisions.push({ organizationId: input.organizationId, siteId: input.siteId, opportunityId: input.opportunityId, decision: input.state, evidenceIds: input.state === "OWNER_VALIDATION_REQUIRED" ? previousEvidenceIds : currentDecision ? evidenceIds : [], evidenceRelevance: relevance, attestation: input.attestation?.trim() ?? "", authorityBasis: currentDecision ? hasSufficientRelevance ? "OWNER_ATTESTATION_AND_EVIDENCE" : "OWNER_ATTESTATION" : undefined, qualificationNotes: input.state === "QUALIFIED" ? input.notes.trim() : null, decidedBy: input.actor, decidedAt: timestamp, revision: opportunity.capabilityAuthorityRevisions.length + 1 });
  }});
}

export function listCapabilityEvidenceOptions(input: { siteId: string; organizationId: string }): CapabilityEvidenceOption[] {
  const loaded = load();
  const workspace = loaded.state.workspaces.find((candidate) => candidate.siteId === input.siteId);
  if (!workspace) throw new Error("SITE_INTELLIGENCE_NOT_FOUND");
  if (workspace.organizationId !== input.organizationId) throw new Error("SITE_INTELLIGENCE_ORGANIZATION_MISMATCH");
  const creativeOptions = workspace.creativeInputs.flatMap((creative): CapabilityEvidenceOption[] => {
    if (!creative.suppliedBy.trim() || !creative.suppliedAt.trim()) return [];
    if (creative.classification === "REJECTED") return [];
    if (creative.classification !== "OWNER_SUPPLIED_REFERENCE" && creative.classification !== "OWNER_APPROVED_PUBLISHABLE") return [];
    if (creative.kind === "URL") return [{ referenceId: `creative:${creative.inputId}`, sourceType: "OWNER_URL", label: creative.reference, notes: creative.notes, provenance: `Supplied by ${creative.suppliedBy}`, classification: creative.classification, createdAt: creative.suppliedAt }];
    if (creative.binaryAsset && creative.binaryAsset.provenance.sourceReference.trim() && creative.binaryAsset.provenance.recordedAt.trim()) return [{ referenceId: `creative:${creative.inputId}`, sourceType: "OWNER_UPLOAD", label: creative.binaryAsset.originalFileName, notes: creative.notes, provenance: `${creative.binaryAsset.provenance.sourceType}: ${creative.binaryAsset.provenance.sourceReference}`, classification: creative.classification, createdAt: creative.suppliedAt }];
    return [];
  });
  const authorityOptions = workspace.evidence.filter((item) => item.authority === "OWNER_SUPPLIED_AUTHORITY" && ["OWNER_URL", "OWNER_DOCUMENT", "OWNER_IMAGE", "CONNECTED_SOURCE"].includes(item.sourceType)).map((item): CapabilityEvidenceOption => ({ referenceId: `evidence:${item.evidenceId}`, sourceType: "OWNER_SUPPLIED_AUTHORITY", label: item.entity ?? item.observedClaim, notes: item.observedClaim, provenance: `${item.sourceType}: ${item.sourceReference}`, classification: null, createdAt: item.retrievedAt }));
  return [...creativeOptions, ...authorityOptions];
}

export function resolveCapabilityEvidenceReferences(input: { siteId: string; organizationId: string; referenceIds: string[] }): CapabilityEvidenceOption[] {
  if (!input.referenceIds.length) throw new Error("CAPABILITY_EVIDENCE_REQUIRED");
  const loaded = load();
  const target = loaded.state.workspaces.find((candidate) => candidate.siteId === input.siteId);
  if (!target) throw new Error("SITE_INTELLIGENCE_NOT_FOUND");
  if (target.organizationId !== input.organizationId) throw new Error("CAPABILITY_EVIDENCE_SCOPE_MISMATCH");
  const options = listCapabilityEvidenceOptions(input);
  const byId = new Map(options.map((option) => [option.referenceId, option]));
  return [...new Set(input.referenceIds)].map((referenceId) => {
    const option = byId.get(referenceId);
    if (option) {
      if (!option.provenance.trim() || !option.createdAt.trim()) throw new Error("CAPABILITY_EVIDENCE_PROVENANCE_INVALID");
      return option;
    }
    const [, rawId] = referenceId.split(":", 2);
    const elsewhere = loaded.state.workspaces.some((workspace) => workspace.siteId !== input.siteId && (workspace.creativeInputs.some((creative) => creative.inputId === rawId) || workspace.evidence.some((evidence) => evidence.evidenceId === rawId)));
    if (elsewhere) throw new Error("CAPABILITY_EVIDENCE_SCOPE_MISMATCH");
    const rejected = target.creativeInputs.some((creative) => creative.inputId === rawId && creative.classification === "REJECTED");
    if (rejected) throw new Error("CAPABILITY_EVIDENCE_REJECTED");
    const disallowedCreative = target.creativeInputs.some((creative) => creative.inputId === rawId);
    const disallowedEvidence = target.evidence.some((evidence) => evidence.evidenceId === rawId);
    if (disallowedCreative || disallowedEvidence) throw new Error("CAPABILITY_EVIDENCE_TYPE_NOT_ALLOWED");
    throw new Error("CAPABILITY_EVIDENCE_NOT_FOUND");
  });
}

export function addStrategyProposal(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; proposal: Omit<SiteStrategyProposal, "revision" | "status" | "createdBy" | "createdAt" | "decidedBy" | "decidedAt"> }) {
  return update({ ...input, action: "STRATEGY_PROPOSED", mutate(workspace) {
    if (workspace.intelligenceState !== "INTELLIGENCE_APPROVED") throw new Error("APPROVED_INTELLIGENCE_REQUIRED");
    if (!workspace.opportunities.some((candidate) => candidate.ownerDecision === "APPROVED")) throw new Error("APPROVED_INTELLIGENCE_REQUIRED");
    const latest = workspace.strategyRevisions.at(-1);
    if (latest && latest.status !== "REVISION_REQUESTED" && latest.status !== "REJECTED") throw new Error("STRATEGY_REVISION_NOT_REQUESTED");
    workspace.strategyRevisions.push({ ...input.proposal, revision: workspace.strategyRevisions.length + 1, status: "PROPOSED", createdBy: input.actor, createdAt: now(), decidedBy: null, decidedAt: null });
    workspace.strategyState = "STRATEGY_READY_FOR_REVIEW";
  }});
}

export function getStrategyReadiness(workspace: SiteIntelligenceWorkspace): { ready: boolean; blockers: string[]; approvedOpportunityCount: number; verifiedCapabilityCount: number; qualifiedCapabilityCount: number } {
  const opportunities = selectDistinctCapabilityOpportunities(workspace.opportunities);
  const approvedOpportunityCount = opportunities.filter((candidate) => candidate.ownerDecision === "APPROVED").length;
  const verifiedCapabilityCount = opportunities.filter((candidate) => candidate.capabilityState === "VERIFIED" && hasVerifiedCapability(candidate)).length;
  const qualifiedCapabilityCount = opportunities.filter((candidate) => candidate.capabilityState === "QUALIFIED" && hasVerifiedCapability(candidate)).length;
  const blockers: string[] = [];
  if (workspace.intelligenceState !== "INTELLIGENCE_APPROVED") blockers.push("Approve Site Intelligence after completing opportunity review.");
  if (approvedOpportunityCount === 0) blockers.push("Approve at least one market opportunity for strategy consideration.");
  return { ready: blockers.length === 0, blockers, approvedOpportunityCount, verifiedCapabilityCount, qualifiedCapabilityCount };
}

export function addInitialStrategyProposal(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; proposal: Omit<SiteStrategyProposal, "revision" | "status" | "createdBy" | "createdAt" | "decidedBy" | "decidedAt"> }) {
  const current = getSiteIntelligenceWorkspace(input.siteId);
  if (!current) throw new Error("SITE_INTELLIGENCE_NOT_FOUND");
  if (current.organizationId !== input.organizationId) throw new Error("SITE_INTELLIGENCE_ORGANIZATION_MISMATCH");
  if (current.strategyRevisions.length > 0) return current;
  return addStrategyProposal(input);
}

export function decideStrategy(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; decision: "APPROVED" | "REVISION_REQUESTED" | "REJECTED" }) {
  return update({ ...input, action: `STRATEGY_${input.decision}`, mutate(workspace) {
    const proposal = workspace.strategyRevisions.at(-1);
    if (!proposal) throw new Error("STRATEGY_NOT_FOUND");
    if (proposal.status !== "PROPOSED") throw new Error("STRATEGY_DECISION_ALREADY_FINAL");
    proposal.status = input.decision;
    proposal.decidedBy = input.actor; proposal.decidedAt = now();
    workspace.strategyState = input.decision === "APPROVED" ? "STRATEGY_APPROVED" : input.decision === "REJECTED" ? "STRATEGY_REJECTED" : "STRATEGY_READY_FOR_REVIEW";
  }});
}

export function reopenApprovedStrategyForReview(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string }) {
  return update({ ...input, action: "STRATEGY_REOPENED_FOR_REVIEW", mutate(workspace) {
    const approved = workspace.strategyRevisions.at(-1);
    if (!approved || approved.status !== "APPROVED" || workspace.strategyState !== "STRATEGY_APPROVED") throw new Error("APPROVED_STRATEGY_REQUIRED");
    workspace.strategyRevisions.push({ ...deepClone(approved), revision: approved.revision + 1, status: "REVISION_REQUESTED", reason: input.reason, createdBy: input.actor, createdAt: now(), decidedBy: null, decidedAt: null });
    workspace.strategyState = "STRATEGY_READY_FOR_REVIEW";
  }});
}

export function refreshApprovedStrategy(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; proposal: Omit<SiteStrategyProposal, "revision" | "status" | "createdBy" | "createdAt" | "decidedBy" | "decidedAt"> }) {
  return update({ ...input, action: "STRATEGY_REFRESH_PROPOSED", mutate(workspace) {
    const approved = workspace.strategyRevisions.at(-1);
    if (!approved || approved.status !== "APPROVED" || workspace.strategyState !== "STRATEGY_APPROVED") throw new Error("APPROVED_STRATEGY_REQUIRED");
    workspace.strategyRevisions.push({ ...input.proposal, revision: approved.revision + 1, status: "PROPOSED", createdBy: input.actor, createdAt: now(), decidedBy: null, decidedAt: null });
    workspace.strategyState = "STRATEGY_READY_FOR_REVIEW";
  }});
}

export function addCreativeInput(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; creativeInput: CreativeInput }) {
  return addCreativeInputs({ ...input, creativeInputs: [input.creativeInput] });
}

export function addCreativeInputs(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; creativeInputs: CreativeInput[] }) {
  return update({ ...input, action: "CREATIVE_INPUT_ADDED", mutate(workspace) {
    if (!input.creativeInputs.length || workspace.creativeInputs.length + input.creativeInputs.length > SITE_INTELLIGENCE_REFERENCE_LIMITS.maxCreativeInputs) throw new Error("REFERENCE_LIBRARY_LIMIT_REACHED");
    const additions = input.creativeInputs.map(normalizeCreativeInput);
    const combined = [...workspace.creativeInputs];
    for (const creativeInput of additions) {
      if (creativeInput.binaryAsset && (creativeInput.binaryAsset.organizationId !== input.organizationId || creativeInput.binaryAsset.siteId !== input.siteId)) throw new Error("ASSET_SCOPE_MISMATCH");
      if (creativeInput.kind === "URL" && combined.filter((candidate) => candidate.kind === "URL").length >= SITE_INTELLIGENCE_REFERENCE_LIMITS.maxUrlReferences) throw new Error("URL_REFERENCE_LIMIT_REACHED");
      const duplicateUrl = creativeInput.kind === "URL" ? combined.find((candidate) => candidate.kind === "URL" && normalizeReferenceUrl(candidate.reference) === creativeInput.reference) : null;
      if (duplicateUrl) throw new Error(`REFERENCE_ALREADY_EXISTS:${duplicateUrl.inputId}`);
      const duplicateAsset = creativeInput.binaryAsset ? combined.find((candidate) => candidate.binaryAsset?.sha256 === creativeInput.binaryAsset?.sha256) : null;
      if (duplicateAsset) throw new Error(`ASSET_ALREADY_EXISTS:${duplicateAsset.inputId}`);
      combined.push(creativeInput);
    }
    workspace.creativeInputs.push(...additions);
    workspace.creativeState = "CREATIVE_INPUTS_COLLECTING";
  }});
}

export function normalizeReferenceUrl(reference: string): string {
  const url = new URL(reference.trim());
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("REFERENCE_URL_INVALID");
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function normalizeCreativeInput(creativeInput: CreativeInput): CreativeInput {
  if (!CREATIVE_CLASSIFICATIONS.includes(creativeInput.classification) || !CREATIVE_SENTIMENTS.includes(creativeInput.sentiment)) throw new Error("CREATIVE_INPUT_METADATA_INVALID");
  const reference = creativeInput.kind === "URL" ? normalizeReferenceUrl(creativeInput.reference) : creativeInput.reference.trim();
  const notes = creativeInput.notes?.trim() || null;
  if (!creativeInput.inputId.trim() || !reference || reference.length > 2_048 || (notes?.length ?? 0) > 5_000) throw new Error("CREATIVE_INPUT_INVALID");
  return { ...creativeInput, reference, sentiment: creativeInput.sentiment === "NEUTRAL" ? "REFERENCE_ONLY" : creativeInput.sentiment, notes, binaryAsset: creativeInput.binaryAsset ? { ...creativeInput.binaryAsset, classification: creativeInput.classification, note: notes } : null };
}

export function updateCreativeInputMetadata(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; inputId: string; reference?: string; classification?: CreativeInput["classification"]; sentiment?: CreativeInput["sentiment"]; notes?: string | null }) {
  return update({ ...input, action: "CREATIVE_INPUT_METADATA_UPDATED", mutate(workspace) {
    const creative = workspace.creativeInputs.find((candidate) => candidate.inputId === input.inputId);
    if (!creative) throw new Error("CREATIVE_INPUT_NOT_FOUND");
    if ((input.classification !== undefined && !CREATIVE_CLASSIFICATIONS.includes(input.classification)) || (input.sentiment !== undefined && !CREATIVE_SENTIMENTS.includes(input.sentiment))) throw new Error("CREATIVE_INPUT_METADATA_INVALID");
    if (input.reference !== undefined) {
      if (creative.kind !== "URL") throw new Error("BINARY_REFERENCE_IMMUTABLE");
      const reference = normalizeReferenceUrl(input.reference);
      const existing = workspace.creativeInputs.find((candidate) => candidate.inputId !== creative.inputId && candidate.kind === "URL" && normalizeReferenceUrl(candidate.reference) === reference);
      if (existing) throw new Error(`REFERENCE_ALREADY_EXISTS:${existing.inputId}`);
      creative.reference = reference;
    }
    if (input.classification !== undefined) {
      creative.classification = input.classification;
      if (creative.binaryAsset) creative.binaryAsset.classification = input.classification;
    }
    if (input.sentiment !== undefined) creative.sentiment = input.sentiment === "NEUTRAL" ? "REFERENCE_ONLY" : input.sentiment;
    if (input.notes !== undefined) {
      const notes = input.notes?.trim() || null;
      if ((notes?.length ?? 0) > 5_000) throw new Error("CREATIVE_INPUT_INVALID");
      creative.notes = notes;
      if (creative.binaryAsset) creative.binaryAsset.note = creative.notes;
    }
  }});
}

export function addCreativeProposal(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; proposal: Omit<CreativeDirectionProposal, "revision" | "status" | "createdBy" | "createdAt" | "decidedBy" | "decidedAt"> }) {
  return update({ ...input, action: "CREATIVE_PROPOSED", mutate(workspace) {
    const strategy = workspace.strategyRevisions.at(-1);
    if (!strategy || strategy.status !== "APPROVED" || strategy.revision !== input.proposal.strategyRevision) throw new Error("APPROVED_STRATEGY_REQUIRED");
    const latest = workspace.creativeRevisions.at(-1);
    if (latest && latest.status !== "REVISION_REQUESTED" && latest.status !== "REJECTED") throw new Error("CREATIVE_REVISION_NOT_REQUESTED");
    workspace.creativeRevisions.push({ ...input.proposal, revision: workspace.creativeRevisions.length + 1, status: "PROPOSED", createdBy: input.actor, createdAt: now(), decidedBy: null, decidedAt: null });
    workspace.creativeState = "CREATIVE_READY_FOR_REVIEW";
  }});
}

export function decideCreativeProposal(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; decision: "APPROVED" | "REVISION_REQUESTED" | "REJECTED" }) {
  return update({ ...input, action: `CREATIVE_${input.decision}`, mutate(workspace) {
    if (!["APPROVED", "REVISION_REQUESTED", "REJECTED"].includes(input.decision)) throw new Error("CREATIVE_DECISION_INVALID");
    const proposal = workspace.creativeRevisions.at(-1);
    if (!proposal) throw new Error("CREATIVE_NOT_FOUND");
    if (proposal.status !== "PROPOSED") throw new Error("CREATIVE_DECISION_ALREADY_FINAL");
    proposal.status = input.decision; proposal.decidedBy = input.actor; proposal.decidedAt = now();
    workspace.creativeState = input.decision === "APPROVED" ? "CREATIVE_APPROVED" : input.decision === "REJECTED" ? "CREATIVE_REJECTED" : "CREATIVE_READY_FOR_REVIEW";
  }});
}

export function approveSiteIntelligence(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string }) {
  return update({ ...input, action: "INTELLIGENCE_APPROVED", mutate(workspace) {
    if (workspace.intelligenceState !== "INTELLIGENCE_READY_FOR_REVIEW") throw new Error("INTELLIGENCE_NOT_READY_FOR_APPROVAL");
    if (!workspace.opportunities.some((candidate) => candidate.ownerDecision === "APPROVED")) throw new Error("APPROVED_OPPORTUNITY_REQUIRED");
    workspace.intelligenceState = "INTELLIGENCE_APPROVED";
  }});
}

export function classifyCreativeInput(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; inputId: string; classification: CreativeInput["classification"] }) {
  return update({ ...input, action: "CREATIVE_INPUT_CLASSIFIED", mutate(workspace) {
    const creative = workspace.creativeInputs.find((candidate) => candidate.inputId === input.inputId);
    if (!creative) throw new Error("CREATIVE_INPUT_NOT_FOUND");
    if (!CREATIVE_CLASSIFICATIONS.includes(input.classification)) throw new Error("CREATIVE_INPUT_METADATA_INVALID");
    creative.classification = input.classification;
    if (creative.binaryAsset) creative.binaryAsset.classification = input.classification;
  }});
}

export function queueSiteResearchExecution(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; providerReference: string; kind: SiteResearchExecution["kind"]; focusOpportunityId?: string | null; timeoutMs: number; maxAttempts: number }) {
  const current = getSiteIntelligenceWorkspace(input.siteId);
  if (!current) throw new Error("SITE_INTELLIGENCE_NOT_FOUND");
  const executions = current.researchExecutions ?? [];
  const existingInitial = input.kind === "INITIAL" ? executions.find((execution) => execution.kind === "INITIAL") : null;
  if (existingInitial) {
    if (existingInitial.state !== "RECOVERABLE") return current;
    return update({ ...input, action: "RESEARCH_EXECUTION_REQUEUED", mutate(workspace) {
      const execution = (workspace.researchExecutions ?? []).find((candidate) => candidate.executionId === existingInitial.executionId);
      if (!execution || execution.state !== "RECOVERABLE") throw new Error("RESEARCH_EXECUTION_NOT_RECOVERABLE");
      execution.state = "QUEUED";
      execution.maxAttempts = execution.attemptCount + Math.min(Math.max(input.maxAttempts, 1), 2);
      execution.timeoutMs = Math.min(Math.max(input.timeoutMs, 60_000), 300_000);
      execution.providerReference = input.providerReference;
      execution.completedAt = null;
      execution.errorCode = null;
      execution.errorMessage = null;
    }});
  }
  const executionId = input.kind === "INITIAL" ? `site-research-${input.siteId}-initial` : `site-research-${input.siteId}-${input.focusOpportunityId}-${executions.filter((execution) => execution.focusOpportunityId === input.focusOpportunityId).length + 1}`;
  return update({ ...input, action: "RESEARCH_EXECUTION_QUEUED", mutate(workspace) {
    workspace.researchExecutions ??= [];
    workspace.researchExecutions.push({ executionId, organizationId: input.organizationId, siteId: input.siteId, kind: input.kind, focusOpportunityId: input.focusOpportunityId ?? null, state: "QUEUED", providerReference: input.providerReference, providerExecutionId: null, providerCompletedAt: null, attemptCount: 0, maxAttempts: Math.min(Math.max(input.maxAttempts, 1), 2), timeoutMs: Math.min(Math.max(input.timeoutMs, 60_000), 300_000), createdAt: now(), startedAt: null, completedAt: null, errorCode: null, errorMessage: null, evidenceCount: 0, opportunityCount: 0 });
  }});
}

export function updateSiteResearchExecution(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; executionId: string; state: SiteResearchExecution["state"]; attemptCount?: number; errorCode?: string | null; errorMessage?: string | null; providerExecutionId?: string; providerCompletedAt?: string; evidence?: SiteIntelligenceEvidence[]; opportunities?: SiteOpportunity[] }) {
  return update({ ...input, action: `RESEARCH_EXECUTION_${input.state}`, mutate(workspace) {
    const execution = (workspace.researchExecutions ?? []).find((candidate) => candidate.executionId === input.executionId);
    if (!execution) throw new Error("RESEARCH_EXECUTION_NOT_FOUND");
    execution.state = input.state;
    if (input.attemptCount !== undefined) execution.attemptCount = input.attemptCount;
    if (input.providerExecutionId !== undefined) execution.providerExecutionId = input.providerExecutionId;
    if (input.providerCompletedAt !== undefined) execution.providerCompletedAt = input.providerCompletedAt;
    execution.errorCode = input.errorCode ?? null; execution.errorMessage = input.errorMessage ?? null;
    if (input.state === "RESEARCHING" && !execution.startedAt) execution.startedAt = now();
    if (["READY_FOR_REVIEW", "FAILED", "RECOVERABLE"].includes(input.state)) execution.completedAt = now();
    if (input.evidence && input.opportunities) {
      workspace.evidence.push(...input.evidence); workspace.opportunities.push(...input.opportunities);
      execution.evidenceCount = input.evidence.length; execution.opportunityCount = input.opportunities.length;
      workspace.intelligenceState = "INTELLIGENCE_READY_FOR_REVIEW";
    }
  }});
}