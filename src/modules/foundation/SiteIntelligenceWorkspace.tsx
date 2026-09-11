"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import type {
  CapabilityEvidenceState,
  CreativeDirectionProposal,
  SiteAssetClassification,
  OpportunityDecision,
  SiteIntelligenceWorkspace as Workspace,
  SiteOpportunity,
  SiteStrategyProposal,
} from "./site-intelligence";
import { SiteIntelligenceReferenceLibrary } from "./SiteIntelligenceReferenceLibrary";

type Props = {
  organizationId: string;
  siteId: string;
  siteName: string;
  publicBrandIdentity: string;
};

function headers(organizationId: string, siteId: string) {
  return {
    "Content-Type": "application/json",
    "x-gcp-roles": "ops_manager",
    "x-gcp-organization-id": organizationId,
    "x-gcp-site-id": siteId,
  };
}

export function SiteIntelligenceWorkspace(props: Props) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerConfigured, setProviderConfigured] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sites/${encodeURIComponent(props.siteId)}/intelligence`, {
      headers: headers(props.organizationId, props.siteId),
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json() as { workspace?: Workspace; provider?: { configured: boolean }; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Unable to load site intelligence.");
        if (!cancelled) { setWorkspace(payload.workspace ?? null); setProviderConfigured(Boolean(payload.provider?.configured)); }
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Unable to load site intelligence."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [props.organizationId, props.siteId]);

  async function action(body: Record<string, unknown>) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(props.siteId)}/intelligence`, {
        method: "POST",
        headers: headers(props.organizationId, props.siteId),
        body: JSON.stringify({ ...body, expectedRevision: workspace?.revision ?? 0, actor: "site-owner" }),
      });
      const payload = await response.json() as { workspace?: Workspace; error?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.error ?? "Site intelligence action failed.");
      setWorkspace(payload.workspace);
      return payload.workspace;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Site intelligence action failed.");
      return null;
    } finally { setBusy(false); }
  }

  if (loading) return <div className="border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-400">Loading site intelligence…</div>;

  return (
    <section id="site-intelligence-workspace" className="space-y-6">
      <header className="border border-zinc-800 bg-zinc-950 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-400">Site Intelligence & Creative Direction</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{props.siteName}</h1>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
          <div><dt className="text-zinc-500">Internal organization</dt><dd className="mt-1 text-zinc-200">{props.organizationId}</dd></div>
          <div><dt className="text-zinc-500">Public brand</dt><dd className="mt-1 text-zinc-200">{workspace?.publicBrandIdentity ?? props.publicBrandIdentity}</dd></div>
          <div><dt className="text-zinc-500">Site</dt><dd className="mt-1 break-all text-zinc-200">{props.siteId}</dd></div>
        </dl>
      </header>

      {!workspace ? (
        <><section className="border border-red-900 bg-red-950/20 p-6">
          <p className="text-xs font-semibold uppercase text-red-300">Intelligence not started</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Establish market strategy before product generation</h2>
          <p className="mt-2 max-w-3xl text-sm text-zinc-300">Genesis will create a bounded research workspace for market observations, provenance, opportunities, owner capability validation, site strategy, and creative direction. Research does not create products, campaigns, assets, or WordPress content.</p>
          <button type="button" disabled={busy || !providerConfigured} onClick={() => action({ action: "START", reason: "Owner explicitly started site intelligence." })} className="mt-5 bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Starting…" : "START SITE INTELLIGENCE"}</button>{!providerConfigured ? <p className="mt-2 text-xs text-amber-300">Dedicated site-intelligence provider configuration is required before research can start.</p> : null}
        </section><SiteIntelligenceReferenceLibrary organizationId={props.organizationId} siteId={props.siteId} workspace={workspace} busy={busy} onAction={action} onWorkspace={setWorkspace} /></>
      ) : (
        <>
          {workspace.intelligenceState === "INTELLIGENCE_NOT_STARTED" ? <section className="border border-red-900 bg-red-950/20 p-6"><p className="text-xs font-semibold uppercase text-red-300">Intelligence not started</p><p className="mt-2 text-sm text-zinc-300">Uploaded references are retained, but research begins only after explicit owner action.</p><button type="button" disabled={busy || !providerConfigured} onClick={() => action({ action: "START", reason: "Owner explicitly started site intelligence." })} className="mt-4 bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">START SITE INTELLIGENCE</button>{!providerConfigured ? <p className="mt-2 text-xs text-amber-300">Dedicated site-intelligence provider configuration is required before research can start.</p> : null}</section> : null}
          <div className="grid gap-4 md:grid-cols-3">
            <StatePanel label="Intelligence" value={workspace.intelligenceState} />
            <StatePanel label="Strategy" value={workspace.strategyState} />
            <StatePanel label="Creative" value={workspace.creativeState} />
          </div>
          <ResearchExecutionList workspace={workspace} busy={busy} onAction={action} />
          <EvidenceJournal workspace={workspace} />
          <OpportunityBoard workspace={workspace} busy={busy} onAction={action} />
          {workspace.intelligenceState === "INTELLIGENCE_READY_FOR_REVIEW" ? <button type="button" disabled={busy || !workspace.opportunities.some((opportunity) => opportunity.ownerDecision === "APPROVED")} onClick={() => action({ action: "APPROVE_INTELLIGENCE", reason: "Owner approved reviewed site intelligence." })} className="bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40">APPROVE INTELLIGENCE</button> : null}
          <StrategyPanel proposal={workspace.strategyRevisions.at(-1) ?? null} state={workspace.strategyState} intelligenceApproved={workspace.intelligenceState === "INTELLIGENCE_APPROVED"} busy={busy} onAction={action} />
          <SiteIntelligenceReferenceLibrary organizationId={props.organizationId} siteId={props.siteId} workspace={workspace} busy={busy} onAction={action} onWorkspace={setWorkspace} />
          <CreativePanel proposal={workspace.creativeRevisions.at(-1) ?? null} state={workspace.creativeState} strategyApproved={workspace.strategyState === "STRATEGY_APPROVED"} strategyRevision={workspace.strategyRevisions.at(-1)?.revision ?? null} inputs={workspace.creativeInputs.length} busy={busy} onAction={action} />
          <section className="border border-zinc-800 p-5">
            <h2 className="font-semibold text-white">Product authority boundary</h2>
            <p className="mt-2 text-sm text-zinc-400">Product onboarding remains separate. Intelligence and creative approval never create products, campaigns, WordPress pages, or publishable assets.</p>
            <span className="mt-3 inline-block border border-zinc-800 px-3 py-2 text-xs text-zinc-500">Generation remains disabled in V1</span>
          </section>
        </>
      )}
      {error ? <div role="alert" className="border border-red-900 bg-red-950/30 p-4 text-sm text-red-200">{error}</div> : null}
      <Link href={`/sites/${encodeURIComponent(props.siteId)}`} className="inline-block text-sm font-semibold text-zinc-300 underline underline-offset-4">Back to site</Link>
    </section>
  );
}

function StatePanel({ label, value }: { label: string; value: string }) {
  return <div className="border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs uppercase text-zinc-500">{label}</p><p className="mt-2 break-words text-sm font-semibold text-white">{value}</p></div>;
}

function EvidenceJournal({ workspace }: { workspace: Workspace }) {
  return <section className="border border-zinc-800 bg-zinc-950"><header className="border-b border-zinc-800 p-5"><h2 className="font-semibold text-white">Evidence & Provenance Journal</h2><p className="mt-1 text-sm text-zinc-400">Research observations remain distinct from owner-supplied capability authority.</p></header>{workspace.evidence.length === 0 ? <p className="p-5 text-sm text-zinc-500">No evidence collected.</p> : <div>{workspace.evidence.map((item) => <article key={item.evidenceId} className="border-b border-zinc-800 p-4 last:border-0"><p className="text-sm text-zinc-200">{item.observedClaim}</p><dl className="mt-2 grid gap-2 text-xs text-zinc-500 sm:grid-cols-4"><div><dt>Source</dt><dd className="break-all text-zinc-300">{item.sourceReference}</dd></div><div><dt>Type / authority</dt><dd className="text-zinc-300">{item.sourceType} / {item.authority}</dd></div><div><dt>Entity</dt><dd className="text-zinc-300">{item.entity ?? "Not specified"}</dd></div><div><dt>Retrieved / confidence</dt><dd className="text-zinc-300">{item.retrievedAt} / {item.confidence}</dd></div></dl></article>)}</div>}</section>;
}

function OpportunityBoard({ workspace, busy, onAction }: { workspace: Workspace; busy: boolean; onAction(body: Record<string, unknown>): Promise<Workspace | null> }) {
  return <section className="border border-zinc-800 bg-zinc-950"><header className="border-b border-zinc-800 p-5"><h2 className="font-semibold text-white">Opportunity Board</h2><p className="mt-1 text-sm text-zinc-400">Discovered opportunities remain market hypotheses until owner capability authority is explicit.</p></header>{workspace.opportunities.length === 0 ? <p className="p-5 text-sm text-zinc-500">No opportunities recorded. Bounded research is awaiting provider results.</p> : <div>{workspace.opportunities.map((opportunity) => <OpportunityRow key={opportunity.opportunityId} opportunity={opportunity} busy={busy} onAction={onAction} />)}</div>}</section>;
}

function OpportunityRow({ opportunity, busy, onAction }: { opportunity: SiteOpportunity; busy: boolean; onAction(body: Record<string, unknown>): Promise<Workspace | null> }) {
  const [capabilityEvidence, setCapabilityEvidence] = useState("");
  const [capabilityNotes, setCapabilityNotes] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const marketActions: Array<{ decision: OpportunityDecision; label: string }> = [{ decision: "APPROVED", label: "APPROVE" }, { decision: "RESEARCH_MORE", label: "RESEARCH MORE" }, { decision: "HOLD", label: "HOLD" }, { decision: "REJECTED", label: "REJECT" }];
  async function decide(decision: OpportunityDecision) {
    setFeedback(null);
    const result = await onAction({ action: decision === "RESEARCH_MORE" ? "RESEARCH_MORE" : "DECIDE_OPPORTUNITY", opportunityId: opportunity.opportunityId, decision, reason: `Owner decision: ${decision}.` });
    setFeedback(result ? decision === "APPROVED" ? "Opportunity approved." : decision === "RESEARCH_MORE" ? "Opportunity marked Research More." : decision === "HOLD" ? "Opportunity placed on hold." : "Opportunity rejected." : "Opportunity decision failed. Review the workspace error and try again.");
  }
  async function capability(state: CapabilityEvidenceState) {
    setFeedback(null);
    if ((state === "VERIFIED" || state === "QUALIFIED") && !capabilityEvidence.trim()) { setFeedback(`Cannot mark capability ${state === "VERIFIED" ? "Verified" : "Qualified"} without supporting capability evidence.`); return; }
    const result = await onAction({ action: "VALIDATE_CAPABILITY", opportunityId: opportunity.opportunityId, state, evidenceIds: capabilityEvidence.trim() ? [capabilityEvidence.trim()] : [], notes: capabilityNotes, reason: `Owner capability decision: ${state}.` });
    setFeedback(result ? `Capability marked ${state.replace("_", " ").toLowerCase()}.` : "Capability decision failed. Review the workspace error and try again.");
  }
  return <article className="border-b border-zinc-800 p-5 last:border-0">
    <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold text-white">{opportunity.name}</h3><p className="mt-1 text-xs text-zinc-500">{opportunity.category} · {opportunity.buyer} · confidence {opportunity.confidence}</p></div><div className="text-right text-xs"><p className="text-zinc-500">Market decision <strong className="text-zinc-200">{opportunity.ownerDecision}</strong></p><p className="mt-1 text-zinc-500">Capability <strong className="text-amber-300">{opportunity.capabilityState}</strong></p></div></div>
    <p className="mt-3 text-sm text-zinc-300">{opportunity.rationale}</p><p className="mt-2 text-xs text-zinc-500">Evidence: {opportunity.evidenceIds.join(", ") || "None"} · Competitors: {opportunity.competitorEntities.join(", ") || "None"}</p>
    <fieldset className="mt-4"><legend className="text-xs font-semibold uppercase text-zinc-400">Market Opportunity Decision</legend><p className="mt-1 text-xs text-zinc-500">Choose whether Genesis should consider this market opportunity in strategy. This does not verify organizational capability.</p><div className="mt-2 flex flex-wrap gap-2">{marketActions.map(({ decision, label }) => { const selected = opportunity.ownerDecision === decision; return <button key={decision} type="button" aria-pressed={selected} disabled={busy || selected} onClick={() => decide(decision)} className={`border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed ${selected ? "border-emerald-600 bg-emerald-950 text-emerald-200" : "border-zinc-700 text-zinc-200 disabled:opacity-60"}`}>{selected ? decision.replace("_", " ") : label}</button>; })}</div></fieldset>
    <fieldset className="mt-5 border-t border-zinc-800 pt-4"><legend className="text-xs font-semibold uppercase text-zinc-400">Capability Authority</legend><p className="mt-1 text-xs text-zinc-500">Verified and Qualified require a supporting capability evidence reference. Market approval remains independent.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="text-xs text-zinc-400">Capability evidence reference<input value={capabilityEvidence} onChange={(event) => setCapabilityEvidence(event.target.value)} aria-describedby={`capability-help-${opportunity.opportunityId}`} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-900 px-2 text-white" /></label><label className="text-xs text-zinc-400">Owner notes<input value={capabilityNotes} onChange={(event) => setCapabilityNotes(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-900 px-2 text-white" /></label></div><p id={`capability-help-${opportunity.opportunityId}`} className="mt-2 text-xs text-amber-300">Supporting evidence is required for Verified or Qualified capability.</p><div className="mt-2 flex flex-wrap gap-2">{(["VERIFIED", "QUALIFIED", "REJECTED", "FUTURE_CAPABILITY"] as CapabilityEvidenceState[]).map((state) => { const selected = opportunity.capabilityState === state; return <button key={state} type="button" aria-pressed={selected} disabled={busy || selected} onClick={() => capability(state)} className={`border px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed ${selected ? "border-emerald-600 bg-emerald-950 text-emerald-200" : "border-zinc-700 text-zinc-200 disabled:opacity-60"}`}>{state.replaceAll("_", " ")}</button>; })}</div></fieldset>
    {feedback ? <p role="status" className="mt-3 border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-200">{feedback}</p> : null}
  </article>;
}

export function CreativeInputForm({ busy, onAction }: { busy: boolean; onAction(body: Record<string, unknown>): void }) {
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [classification, setClassification] = useState<SiteAssetClassification>("OWNER_SUPPLIED_REFERENCE");
  return <section className="border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold text-white">Creative Inputs</h2><p className="mt-1 text-sm text-zinc-400">Optional URLs, asset references, preferences, and inspiration. External and competitor references are never publishable.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-zinc-400">Asset, URL, or direction reference<input value={reference} onChange={(event) => setReference(event.target.value)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" /></label><label className="text-xs text-zinc-400">Classification<select value={classification} onChange={(event) => setClassification(event.target.value as SiteAssetClassification)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="OWNER_SUPPLIED_REFERENCE">Owner supplied reference</option><option value="OWNER_APPROVED_PUBLISHABLE">Owner approved publishable</option><option value="EXTERNAL_INSPIRATION_ONLY">External inspiration only</option><option value="COMPETITOR_REFERENCE_ONLY">Competitor reference only</option><option value="UNVERIFIED">Unverified</option></select></label><label className="text-xs text-zinc-400 sm:col-span-2">Notes / likes / dislikes<input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" /></label></div><button type="button" disabled={busy || !reference.trim()} onClick={() => onAction({ action: "ADD_CREATIVE_INPUT", reason: "Owner added classified creative input.", creativeInput: { inputId: `creative-input-${Date.now()}`, kind: reference.startsWith("http") ? "URL" : "TEXT", reference, sentiment: "NEUTRAL", classification, notes: notes || null, suppliedBy: "site-owner", suppliedAt: new Date().toISOString() } })} className="mt-4 border border-zinc-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">Add Creative Input</button></section>;
}

function StrategyPanel({ proposal, state, intelligenceApproved, busy, onAction }: { proposal: SiteStrategyProposal | null; state: string; intelligenceApproved: boolean; busy: boolean; onAction(body: Record<string, unknown>): void }) {
  const [positioning, setPositioning] = useState(proposal?.positioning ?? "");
  const [audience, setAudience] = useState(proposal?.primaryAudience ?? "");
  const [value, setValue] = useState(proposal?.valueProposition ?? "");
  const [sitemap, setSitemap] = useState(proposal?.proposedSitemap.join("\n") ?? "");
  const canPropose = intelligenceApproved || Boolean(proposal);
  const saveRevision = () => onAction({ action: "PROPOSE_STRATEGY", reason: proposal ? "Owner edited strategy as a new revision." : "Strategy proposed from approved intelligence.", proposal: { positioning, primaryAudience: audience, secondaryAudiences: [], valueProposition: value, majorVerticals: [], productServiceFamilies: [], informationArchitecture: sitemap.split("\n").filter(Boolean), proposedSitemap: sitemap.split("\n").filter(Boolean), homepageGoals: [], conversionPaths: [], ctaHierarchy: [], trustProofRequirements: [], geographicStrategy: "Owner review required", proposedProductAuthority: [], reason: "Owner-edited strategy proposal." } });
  return <section className="border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold text-white">Site Strategy</h2><p className="mt-1 text-xs text-zinc-500">{state}</p>{canPropose ? <div className="mt-4 grid gap-3"><label className="text-xs text-zinc-400">Positioning<textarea value={positioning} onChange={(event) => setPositioning(event.target.value)} rows={2} className="mt-1 w-full border border-zinc-700 bg-zinc-900 p-2 text-white" /></label><label className="text-xs text-zinc-400">Primary audience<input value={audience} onChange={(event) => setAudience(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-900 px-2 text-white" /></label><label className="text-xs text-zinc-400">Value proposition<textarea value={value} onChange={(event) => setValue(event.target.value)} rows={2} className="mt-1 w-full border border-zinc-700 bg-zinc-900 p-2 text-white" /></label><label className="text-xs text-zinc-400">Proposed sitemap, one path per line<textarea value={sitemap} onChange={(event) => setSitemap(event.target.value)} rows={4} className="mt-1 w-full border border-zinc-700 bg-zinc-900 p-2 text-white" /></label><button type="button" disabled={busy || !positioning.trim() || !audience.trim() || !value.trim()} onClick={saveRevision} className="border border-zinc-700 px-3 py-2 text-xs text-white disabled:opacity-40">{proposal ? "EDIT AS NEW REVISION" : "PROPOSE STRATEGY"}</button></div> : <p className="mt-3 text-sm text-zinc-500">A strategy proposal requires reviewed and approved intelligence.</p>}{proposal ? <div className="mt-4 flex gap-2">{(["APPROVED", "REVISION_REQUESTED", "REJECTED"] as const).map((decision) => <button key={decision} type="button" disabled={busy} onClick={() => onAction({ action: "DECIDE_STRATEGY", decision, reason: `Owner strategy decision: ${decision}.` })} className="border border-zinc-700 px-3 py-2 text-xs text-zinc-200">{decision.replace("_", " ")}</button>)}</div> : null}</section>;
}

function CreativePanel({ proposal, state, strategyApproved, strategyRevision, inputs, busy, onAction }: { proposal: CreativeDirectionProposal | null; state: string; strategyApproved: boolean; strategyRevision: number | null; inputs: number; busy: boolean; onAction(body: Record<string, unknown>): void }) {
  const [direction, setDirection] = useState(proposal?.overallDirection ?? "");
  const [colors, setColors] = useState(proposal?.colorDirection ?? "");
  const [typography, setTypography] = useState(proposal?.typographyDirection ?? "");
  const [layout, setLayout] = useState(proposal?.spacingLayoutDirection ?? "");
  const [photography, setPhotography] = useState(proposal?.photographyStyle ?? "");
  const [blueprint, setBlueprint] = useState(proposal?.homepageBlueprint.join("\n") ?? "");
  const canPropose = strategyApproved || Boolean(proposal);
  const saveRevision = () => onAction({ action: "PROPOSE_CREATIVE", reason: proposal ? "Owner edited creative direction as a new revision." : "Creative direction proposed from approved strategy.", proposal: { strategyRevision: strategyRevision ?? 0, overallDirection: direction, brandInterpretation: direction, colorDirection: colors, typographyDirection: typography, spacingLayoutDirection: layout, photographyStyle: photography, generatedImageStyle: "Candidates require owner approval", heroTreatment: "Strategy-led", ctaTreatment: "Approved hierarchy", trustProofPresentation: "Verified proof only", productPresentation: "Authority-backed", verticalPresentation: "Approved capabilities only", mobileConsiderations: "Compact and legible", visualDos: ["Use approved assets"], visualDonts: ["Do not publish external references"], homepageBlueprint: blueprint.split("\n").filter(Boolean), imagePlan: [], reason: "Owner-edited creative proposal." } });
  return <section className="border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold text-white">Creative Direction</h2><p className="mt-1 text-xs text-zinc-500">{state} · {inputs} optional inputs</p>{canPropose ? <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-zinc-400 sm:col-span-2">Overall visual direction<textarea value={direction} onChange={(event) => setDirection(event.target.value)} rows={2} className="mt-1 w-full border border-zinc-700 bg-zinc-900 p-2 text-white" /></label><label className="text-xs text-zinc-400">Color direction<input value={colors} onChange={(event) => setColors(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-900 px-2 text-white" /></label><label className="text-xs text-zinc-400">Typography direction<input value={typography} onChange={(event) => setTypography(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-900 px-2 text-white" /></label><label className="text-xs text-zinc-400">Layout direction<input value={layout} onChange={(event) => setLayout(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-900 px-2 text-white" /></label><label className="text-xs text-zinc-400">Photography style<input value={photography} onChange={(event) => setPhotography(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-900 px-2 text-white" /></label><label className="text-xs text-zinc-400 sm:col-span-2">Homepage blueprint, one section per line<textarea value={blueprint} onChange={(event) => setBlueprint(event.target.value)} rows={5} className="mt-1 w-full border border-zinc-700 bg-zinc-900 p-2 text-white" /></label><button type="button" disabled={busy || !direction.trim()} onClick={saveRevision} className="border border-zinc-700 px-3 py-2 text-xs text-white disabled:opacity-40">{proposal ? "EDIT AS NEW REVISION" : "PROPOSE CREATIVE DIRECTION"}</button></div> : <p className="mt-3 text-sm text-zinc-500">Optional references may be collected before a brief is proposed from approved strategy.</p>}{proposal ? <div className="mt-4 flex gap-2">{(["APPROVED", "REVISION_REQUESTED", "REJECTED"] as const).map((decision) => <button key={decision} type="button" disabled={busy} onClick={() => onAction({ action: "DECIDE_CREATIVE", decision, reason: `Owner creative decision: ${decision}.` })} className="border border-zinc-700 px-3 py-2 text-xs text-zinc-200">{decision.replace("_", " ")}</button>)}</div> : null}</section>;
}

export function BinaryUploadForm({ props, workspace, onUploaded }: { props: Props; workspace: Workspace | null; onUploaded(workspace: Workspace): void }) {
  const [files, setFiles] = useState<File[]>([]); const [classification, setClassification] = useState<SiteAssetClassification>("OWNER_SUPPLIED_REFERENCE"); const [sentiment, setSentiment] = useState("NEUTRAL"); const [notes, setNotes] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  async function upload() { setBusy(true); setMessage(null); try { const form = new FormData(); files.forEach((file) => form.append("files", file)); form.set("classification", classification); form.set("sentiment", sentiment); form.set("notes", notes); form.set("expectedRevision", String(workspace?.revision ?? 0)); const response = await fetch(`/api/sites/${encodeURIComponent(props.siteId)}/intelligence/assets`, { method: "POST", headers: { "x-gcp-roles": "ops_manager", "x-gcp-organization-id": props.organizationId, "x-gcp-site-id": props.siteId }, body: form }); const payload = await response.json() as { workspace?: Workspace; assets?: unknown[]; error?: string }; if (!response.ok || !payload.workspace) throw new Error(payload.error ?? "Upload failed."); onUploaded(payload.workspace); setFiles([]); setNotes(""); setMessage(`${payload.assets?.length ?? 0} file(s) uploaded to Genesis.`); } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); } finally { setBusy(false); } }
  return <section className="border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold text-white">Upload Creative / Authority Files</h2><p className="mt-1 text-sm text-zinc-400">Images and PDFs are stored in Genesis only. Maximum 10 files, 25 MB each, 50 MB per batch.</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-zinc-400 sm:col-span-2">Upload files<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} className="mt-1 block w-full border border-dashed border-zinc-700 p-4 text-zinc-300" /></label><label className="text-xs text-zinc-400">Classification<select value={classification} onChange={(event) => setClassification(event.target.value as SiteAssetClassification)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="OWNER_SUPPLIED_REFERENCE">Owner supplied reference</option><option value="OWNER_APPROVED_PUBLISHABLE">Owner approved publishable</option><option value="EXTERNAL_INSPIRATION_ONLY">External inspiration only</option><option value="COMPETITOR_REFERENCE_ONLY">Competitor reference only</option><option value="UNVERIFIED">Unverified</option></select></label><label className="text-xs text-zinc-400">Preference<select value={sentiment} onChange={(event) => setSentiment(event.target.value)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white"><option value="NEUTRAL">Reference only</option><option value="LIKE">Like</option><option value="DISLIKE">Dislike</option></select></label><label className="text-xs text-zinc-400 sm:col-span-2">Purpose / notes<input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 h-10 w-full border border-zinc-700 bg-zinc-900 px-3 text-white" /></label></div><button type="button" disabled={busy || files.length === 0} onClick={upload} className="mt-4 bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40">{busy ? "Uploading…" : "UPLOAD FILES"}</button>{message ? <p className="mt-2 text-xs text-zinc-300">{message}</p> : null}</section>;
}

export function AssetList({ props, workspace }: { props: Props; workspace: Workspace }) {
  const assets = workspace.creativeInputs.filter((input) => input.binaryAsset);
  if (assets.length === 0) return null;
  return <section className="border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold text-white">Uploaded Assets</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{assets.map((input) => { const asset = input.binaryAsset!; const source = `/api/sites/${encodeURIComponent(props.siteId)}/intelligence/assets/${encodeURIComponent(asset.assetId)}`; return <article key={asset.assetId} className="border border-zinc-800 p-3">{asset.mediaType.startsWith("image/") ? <AssetThumbnail source={source} organizationId={props.organizationId} siteId={props.siteId} fileName={asset.originalFileName} /> : <div className="flex aspect-video items-center justify-center bg-zinc-900 text-sm text-zinc-400">PDF document</div>}<p className="mt-2 break-all text-sm text-white">{asset.originalFileName}</p><p className="mt-1 text-xs text-zinc-500">{asset.mediaType} · {asset.sizeBytes} bytes</p><p className="mt-1 break-all text-xs text-zinc-500">SHA-256 {asset.sha256}</p><p className={`mt-2 text-xs font-semibold ${input.classification === "OWNER_APPROVED_PUBLISHABLE" ? "text-emerald-300" : "text-amber-300"}`}>{input.classification}</p><p className="mt-1 text-xs text-zinc-500">{input.classification === "OWNER_APPROVED_PUBLISHABLE" ? "Eligible for later approved use" : "Not publishable"}</p><p className="mt-2 text-xs text-zinc-500">Use the classification selector during upload; later classification changes are explicit and audited through the intelligence API.</p></article>; })}</div></section>;
}

function AssetThumbnail({ source, organizationId, siteId, fileName }: { source: string; organizationId: string; siteId: string; fileName: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let objectUrl: string | null = null;
    fetch(source, { headers: { "x-gcp-roles": "ops_manager", "x-gcp-organization-id": organizationId, "x-gcp-site-id": siteId }, cache: "no-store" }).then((response) => { if (!response.ok) throw new Error("Asset preview unavailable."); return response.blob(); }).then((blob) => { if (!active) return; objectUrl = URL.createObjectURL(blob); setBlobUrl(objectUrl); }).catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [organizationId, siteId, source]);
  return blobUrl ? <Image src={blobUrl} alt={fileName} width={640} height={360} unoptimized className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center bg-zinc-900 text-xs text-zinc-500">Loading preview…</div>;
}

function ResearchExecutionList({ workspace, busy, onAction }: { workspace: Workspace; busy: boolean; onAction(body: Record<string, unknown>): void }) {
  if ((workspace.researchExecutions ?? []).length === 0) return null;
  return <section className="border border-zinc-800 bg-zinc-950 p-5"><h2 className="font-semibold text-white">Research Executions</h2><div className="mt-3 space-y-2">{workspace.researchExecutions.map((execution) => <article key={execution.executionId} className="border border-zinc-800 p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><span className="break-all text-zinc-200">{execution.executionId}</span><strong className={execution.state === "READY_FOR_REVIEW" ? "text-emerald-300" : execution.state === "RECOVERABLE" || execution.state === "FAILED" ? "text-amber-300" : "text-red-300"}>{execution.state}</strong></div><p className="mt-1 text-zinc-500">{execution.kind} · attempts {execution.attemptCount}/{execution.maxAttempts} · evidence {execution.evidenceCount} · opportunities {execution.opportunityCount}</p>{execution.errorMessage ? <p className="mt-1 text-amber-200">{execution.errorCode}: {execution.errorMessage}</p> : null}{execution.kind === "INITIAL" && execution.state === "RECOVERABLE" ? <button type="button" disabled={busy} onClick={() => onAction({ action: "RETRY_RESEARCH", reason: "Owner resumed the existing recoverable Site Intelligence execution." })} className="mt-3 border border-amber-700 px-3 py-2 text-xs font-semibold text-amber-200 disabled:opacity-40">RETRY EXISTING EXECUTION</button> : null}</article>)}</div></section>;
}