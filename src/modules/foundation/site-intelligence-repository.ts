import "server-only";

import { randomUUID } from "node:crypto";
import {
  FoundationPersistenceConflictError,
  deepClone,
  loadPersistedState,
  savePersistedState,
} from "./foundation-persistence";
import type {
  CapabilityEvidenceState,
  CreativeDirectionProposal,
  CreativeInput,
  OpportunityDecision,
  SiteIntelligenceEvidence,
  SiteIntelligenceWorkspace,
  SiteOpportunity,
  SiteStrategyProposal,
} from "./site-intelligence";

const NAMESPACE = "site-intelligence-repository";
type State = { workspaces: SiteIntelligenceWorkspace[] };

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
    const opportunity = workspace.opportunities.find((candidate) => candidate.opportunityId === input.opportunityId);
    if (!opportunity) throw new Error("OPPORTUNITY_NOT_FOUND");
    opportunity.ownerDecision = input.decision;
    opportunity.decidedBy = input.actor;
    opportunity.decidedAt = now();
  }});
}

export function validateOpportunityCapability(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; opportunityId: string; state: CapabilityEvidenceState; evidenceIds: string[]; notes: string }) {
  return update({ ...input, action: `CAPABILITY_${input.state}`, mutate(workspace) {
    const opportunity = workspace.opportunities.find((candidate) => candidate.opportunityId === input.opportunityId);
    if (!opportunity) throw new Error("OPPORTUNITY_NOT_FOUND");
    if ((input.state === "VERIFIED" || input.state === "QUALIFIED") && input.evidenceIds.length === 0) throw new Error("CAPABILITY_EVIDENCE_REQUIRED");
    opportunity.capabilityState = input.state;
    opportunity.capabilityEvidenceIds = [...input.evidenceIds];
    opportunity.capabilityNotes = input.notes;
  }});
}

export function addStrategyProposal(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; proposal: Omit<SiteStrategyProposal, "revision" | "status" | "createdBy" | "createdAt" | "decidedBy" | "decidedAt"> }) {
  return update({ ...input, action: "STRATEGY_PROPOSED", mutate(workspace) {
    if (workspace.intelligenceState !== "INTELLIGENCE_APPROVED") throw new Error("APPROVED_INTELLIGENCE_REQUIRED");
    if (!workspace.opportunities.some((candidate) => candidate.ownerDecision === "APPROVED")) throw new Error("APPROVED_INTELLIGENCE_REQUIRED");
    workspace.strategyRevisions.push({ ...input.proposal, revision: workspace.strategyRevisions.length + 1, status: "PROPOSED", createdBy: input.actor, createdAt: now(), decidedBy: null, decidedAt: null });
    workspace.strategyState = "STRATEGY_READY_FOR_REVIEW";
  }});
}

export function decideStrategy(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; decision: "APPROVED" | "REVISION_REQUESTED" | "REJECTED" }) {
  return update({ ...input, action: `STRATEGY_${input.decision}`, mutate(workspace) {
    const proposal = workspace.strategyRevisions.at(-1);
    if (!proposal) throw new Error("STRATEGY_NOT_FOUND");
    proposal.status = input.decision;
    proposal.decidedBy = input.actor; proposal.decidedAt = now();
    workspace.strategyState = input.decision === "APPROVED" ? "STRATEGY_APPROVED" : input.decision === "REJECTED" ? "STRATEGY_REJECTED" : "STRATEGY_READY_FOR_REVIEW";
  }});
}

export function addCreativeInput(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; creativeInput: CreativeInput }) {
  return update({ ...input, action: "CREATIVE_INPUT_ADDED", mutate(workspace) {
    workspace.creativeInputs.push(input.creativeInput);
    workspace.creativeState = "CREATIVE_INPUTS_COLLECTING";
  }});
}

export function addCreativeProposal(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; proposal: Omit<CreativeDirectionProposal, "revision" | "status" | "createdBy" | "createdAt" | "decidedBy" | "decidedAt"> }) {
  return update({ ...input, action: "CREATIVE_PROPOSED", mutate(workspace) {
    const strategy = workspace.strategyRevisions.at(-1);
    if (!strategy || strategy.status !== "APPROVED" || strategy.revision !== input.proposal.strategyRevision) throw new Error("APPROVED_STRATEGY_REQUIRED");
    workspace.creativeRevisions.push({ ...input.proposal, revision: workspace.creativeRevisions.length + 1, status: "PROPOSED", createdBy: input.actor, createdAt: now(), decidedBy: null, decidedAt: null });
    workspace.creativeState = "CREATIVE_READY_FOR_REVIEW";
  }});
}

export function decideCreativeProposal(input: { siteId: string; organizationId: string; expectedRevision: number; actor: string; reason: string; decision: "APPROVED" | "REVISION_REQUESTED" | "REJECTED" }) {
  return update({ ...input, action: `CREATIVE_${input.decision}`, mutate(workspace) {
    const proposal = workspace.creativeRevisions.at(-1);
    if (!proposal) throw new Error("CREATIVE_NOT_FOUND");
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