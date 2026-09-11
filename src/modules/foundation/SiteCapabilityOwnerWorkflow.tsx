"use client";

import { useState } from "react";
import type {
  CapabilityEvidenceOption,
  CapabilityEvidenceRelevanceType,
  OpportunityDecision,
  SiteIntelligenceWorkspace,
  SiteOpportunity,
} from "./site-intelligence";
import { getCapabilityAuthorityAssurance, getCapabilityAuthorityStatus } from "./site-intelligence";
import {
  canonicalCapabilityState,
  CAPABILITY_RELEVANCE_TYPES,
  evidenceNeedsClarification,
  getOwnerCapabilityPreview,
  inferEvidenceRelevance,
  OWNER_CAPABILITY_CHOICES,
  OWNER_EVIDENCE_CHOICES,
  ownerCapabilityChoice,
  type OwnerCapabilityChoice,
} from "./site-capability-owner-ux";

type Props = {
  opportunity: SiteOpportunity;
  capabilityEvidenceOptions: CapabilityEvidenceOption[];
  publicBrandIdentity: string;
  busy: boolean;
  onAction(body: Record<string, unknown>): Promise<SiteIntelligenceWorkspace | null>;
};

const MARKET_CHOICES: ReadonlyArray<{ decision: OpportunityDecision; label: string }> = [
  { decision: "APPROVED", label: "YES - PURSUE" },
  { decision: "RESEARCH_MORE", label: "RESEARCH MORE" },
  { decision: "HOLD", label: "HOLD" },
  { decision: "REJECTED", label: "NO" },
];

function evidenceTypeLabel(option: CapabilityEvidenceOption): string {
  if (option.sourceType === "OWNER_UPLOAD") return "Owner file";
  if (option.sourceType === "OWNER_URL") return "Owner link";
  return "Owner-provided material";
}

export function SiteCapabilityOwnerWorkflow({ opportunity, capabilityEvidenceOptions, publicBrandIdentity, busy, onAction }: Props) {
  const latestAuthority = opportunity.capabilityAuthorityRevisions?.at(-1);
  const [capabilityChoice, setCapabilityChoice] = useState<OwnerCapabilityChoice | null>(() => ownerCapabilityChoice(opportunity.capabilityState));
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>(opportunity.capabilityEvidenceIds);
  const [evidenceRelevance, setEvidenceRelevance] = useState<Record<string, CapabilityEvidenceRelevanceType>>(() => ({
    ...Object.fromEntries((latestAuthority?.evidenceRelevance ?? []).map((link) => [link.evidenceId, link.relevanceType])),
    ...Object.fromEntries(capabilityEvidenceOptions.map((option) => {
      const existing = latestAuthority?.evidenceRelevance.find((link) => link.evidenceId === option.referenceId)?.relevanceType;
      return [option.referenceId, existing ?? inferEvidenceRelevance(option)];
    })),
  }));
  const [ownerConfirmed, setOwnerConfirmed] = useState(() => Boolean(latestAuthority?.attestation.trim() && latestAuthority.decision === opportunity.capabilityState));
  const [limitations, setLimitations] = useState(opportunity.capabilityNotes ?? "");
  const [feedback, setFeedback] = useState<string | null>(null);
  const canonicalState = capabilityChoice ? canonicalCapabilityState(capabilityChoice) : null;
  const currentDecision = canonicalState === "VERIFIED" || canonicalState === "QUALIFIED";
  const requiresConfirmation = currentDecision || canonicalState === "FUTURE_CAPABILITY";
  const status = getOwnerCapabilityPreview({ opportunity, choice: capabilityChoice, ownerConfirmed, selectedEvidence, evidenceRelevance, limitations });

  async function decideMarket(decision: OpportunityDecision) {
    setFeedback(null);
    const result = await onAction({
      action: decision === "RESEARCH_MORE" ? "RESEARCH_MORE" : "DECIDE_OPPORTUNITY",
      opportunityId: opportunity.opportunityId,
      decision,
      reason: `Owner market decision: ${decision}.`,
    });
    setFeedback(result ? "Market decision saved." : "Market decision failed. Review the workspace error and try again.");
  }

  async function saveCapability() {
    if (!canonicalState || !status.canSubmit) return;
    const attestation = canonicalState === "FUTURE_CAPABILITY"
      ? `${publicBrandIdentity} does not currently have this capability and may develop it.`
      : currentDecision
        ? `${publicBrandIdentity} currently provides ${opportunity.name}${canonicalState === "QUALIFIED" ? " subject to the recorded limitations" : ""}.`
        : "";
    const result = await onAction({
      action: "VALIDATE_CAPABILITY",
      opportunityId: opportunity.opportunityId,
      state: canonicalState,
      evidenceIds: currentDecision ? selectedEvidence : [],
      evidenceRelevance: currentDecision ? selectedEvidence.map((evidenceId) => ({ evidenceId, relevanceType: evidenceRelevance[evidenceId] ?? "GENERAL_REFERENCE", ownerConfirmedRelevant: true })) : [],
      attestation,
      notes: canonicalState === "QUALIFIED" ? limitations : canonicalState === "FUTURE_CAPABILITY" ? "Future capability; not authorized as a current claim." : canonicalState === "REJECTED" ? "Not offered as a current capability." : "",
      reason: `Owner capability decision: ${canonicalState}.`,
    });
    setFeedback(result ? "Capability decision saved." : "Capability decision failed. Review the workspace error and try again.");
  }

  return (
    <article className="border-b border-zinc-800 p-5 last:border-0">
      <header className="flex flex-wrap justify-between gap-3">
        <div><h3 className="font-semibold text-white">{opportunity.name}</h3><p className="mt-1 max-w-3xl text-sm text-zinc-400">{opportunity.rationale}</p></div>
        <p className="text-xs text-zinc-500">Research confidence {opportunity.confidence}</p>
      </header>

      {getCapabilityAuthorityStatus(opportunity) === "AUTHORITY_REVIEW_REQUIRED" ? <div className="mt-4 border border-amber-800 bg-amber-950/20 p-4"><strong className="text-xs text-amber-200">REVIEW REQUIRED</strong><p className="mt-1 text-sm text-amber-100">We need you to reconfirm this capability because Genesis&apos;s proof requirements were upgraded.</p></div> : null}

      <section className="mt-5 border-l-4 border-blue-600 bg-blue-950/20 p-4">
        <p className="text-xs font-semibold uppercase text-blue-300">Market</p>
        <h4 className="mt-1 font-semibold text-white">Should we pursue this?</h4>
        <p className="mt-1 text-xs text-zinc-400">This decides whether Genesis should include this market in strategy. It does not claim that we currently provide it.</p>
        <div className="mt-3 flex flex-wrap gap-2">{MARKET_CHOICES.map(({ decision, label }) => <button key={decision} type="button" aria-pressed={opportunity.ownerDecision === decision} disabled={busy || opportunity.ownerDecision === decision} onClick={() => decideMarket(decision)} className="border border-blue-800 px-3 py-2 text-xs font-semibold text-blue-100 disabled:bg-blue-950 disabled:opacity-70">{label}</button>)}</div>
      </section>

      <section className="mt-4 border-l-4 border-emerald-600 bg-emerald-950/20 p-4">
        <p className="text-xs font-semibold uppercase text-emerald-300">Current capability</p>
        <h4 className="mt-1 font-semibold text-white">Can we actually provide this today?</h4>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">{OWNER_CAPABILITY_CHOICES.map((choice) => <button key={choice.value} type="button" aria-pressed={capabilityChoice === choice.value} disabled={busy} onClick={() => { setCapabilityChoice(choice.value); setOwnerConfirmed(false); setFeedback(null); }} className="border border-emerald-800 px-3 py-3 text-left text-xs font-semibold text-emerald-100 aria-pressed:bg-emerald-900">{choice.label}</button>)}</div>
        {canonicalState === "FUTURE_CAPABILITY" ? <p className="mt-3 text-sm text-blue-200">Genesis may consider this strategically, but it cannot describe it as a current capability.</p> : null}
        {canonicalState === "REJECTED" ? <p className="mt-3 text-sm text-zinc-300">Genesis will not treat this as a current organizational capability. This does not reject the market.</p> : null}
      </section>

      {currentDecision ? <section className="mt-4 border border-zinc-800 p-4">
        <p className="text-xs font-semibold uppercase text-zinc-400">Proof</p>
        <h4 className="mt-1 font-semibold text-white">How can we support this?</h4>
        <p className="mt-1 text-xs text-zinc-500">{status.proofRequired ? "Independent proof is required for this protected claim." : "Supporting proof is optional and can independently verify the owner-confirmed capability."} General references do not establish independent proof.</p>
        {status.proofReason ? <p className="mt-2 text-xs text-amber-200">{status.proofReason}</p> : null}
        {capabilityEvidenceOptions.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{capabilityEvidenceOptions.map((option) => {
          const selected = selectedEvidence.includes(option.referenceId);
          const relevance = evidenceRelevance[option.referenceId] ?? inferEvidenceRelevance(option);
          return <div key={option.referenceId} className="border border-zinc-800 bg-zinc-950 p-3"><label className="flex gap-3"><input type="checkbox" checked={selected} onChange={(event) => setSelectedEvidence((current) => event.target.checked ? [...new Set([...current, option.referenceId])] : current.filter((id) => id !== option.referenceId))} /><span><strong className="block text-sm text-zinc-100">{option.label}</strong><span className="block text-xs text-zinc-500">{evidenceTypeLabel(option)} · {option.provenance}</span></span></label>{selected && evidenceNeedsClarification(relevance) ? <label className="mt-3 block text-xs text-zinc-300">What does this show?<select value={relevance} onChange={(event) => setEvidenceRelevance((current) => ({ ...current, [option.referenceId]: event.target.value as CapabilityEvidenceRelevanceType }))} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-2 text-white">{OWNER_EVIDENCE_CHOICES.map((choice) => <option key={choice.relevanceType} value={choice.relevanceType}>{choice.label}</option>)}</select></label> : null}</div>;
        })}</div> : <p className="mt-3 text-sm text-amber-200">Add an owner link or upload proof in the Reference Library below.</p>}
        <details className="mt-3 border border-zinc-800 p-3"><summary className="cursor-pointer text-xs font-semibold text-zinc-400">Advanced evidence details</summary><div className="mt-3 space-y-2">{selectedEvidence.map((evidenceId) => <label key={evidenceId} className="block text-xs text-zinc-400">{capabilityEvidenceOptions.find((option) => option.referenceId === evidenceId)?.label ?? evidenceId}<select value={evidenceRelevance[evidenceId] ?? "GENERAL_REFERENCE"} onChange={(event) => setEvidenceRelevance((current) => ({ ...current, [evidenceId]: event.target.value as CapabilityEvidenceRelevanceType }))} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-900 px-2 text-white">{CAPABILITY_RELEVANCE_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>)}</div></details>
      </section> : null}

      {canonicalState === "QUALIFIED" ? <label className="mt-4 block border border-zinc-800 p-4 text-sm text-zinc-300">What are the limitations?<textarea value={limitations} onChange={(event) => setLimitations(event.target.value)} rows={3} className="mt-2 w-full border border-zinc-700 bg-zinc-900 p-2 text-white" /></label> : null}

      {requiresConfirmation ? <label className="mt-4 flex gap-3 border border-zinc-800 p-4 text-sm text-zinc-200"><input type="checkbox" checked={ownerConfirmed} onChange={(event) => setOwnerConfirmed(event.target.checked)} /><span>{canonicalState === "FUTURE_CAPABILITY" ? `I confirm that ${publicBrandIdentity} does not currently have this capability.` : `I confirm that ${publicBrandIdentity} currently has this capability.`}<span className="mt-1 block text-xs text-zinc-500">Owner confirmation is recorded as owner authority. {status.proofRequired ? "This protected claim also requires independent proof." : "Independent proof may be added now or later."}</span></span></label> : null}

      <div className="mt-4 grid gap-3 border border-zinc-800 bg-zinc-950 p-4 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-xs font-semibold uppercase text-zinc-500">Capability status</p><strong className={`mt-1 block ${status.label === "VERIFIED" || status.label === "OWNER CONFIRMED" || status.label === "QUALIFIED" ? "text-emerald-200" : status.label === "NOT A CURRENT CAPABILITY" ? "text-blue-200" : "text-amber-200"}`}>{status.label}</strong><dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-zinc-400"><div><dt>Owner confirmed</dt><dd>{status.ownerConfirmation}</dd></div><div><dt>Supporting proof</dt><dd>{status.supportingProof}</dd></div></dl>{getCapabilityAuthorityAssurance(opportunity) === "OWNER_ATTESTED" ? <p className="mt-2 text-xs text-zinc-400">Authority source: Owner attestation · Evidence status: Not independently verified</p> : getCapabilityAuthorityAssurance(opportunity) === "EVIDENCE_VERIFIED" ? <p className="mt-2 text-xs text-zinc-400">Authority source: Owner + evidence</p> : null}{opportunity.capabilityState === "QUALIFIED" && opportunity.capabilityNotes ? <p className="mt-2 text-xs text-zinc-300">Limitations: {opportunity.capabilityNotes}</p> : null}</div><button type="button" disabled={busy || !status.canSubmit} onClick={saveCapability} className="bg-emerald-700 px-4 py-3 text-xs font-semibold text-white disabled:opacity-40">SAVE CAPABILITY REVIEW</button></div>
      {feedback ? <p role="status" className="mt-3 border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-200">{feedback}</p> : null}
    </article>
  );
}