"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";
import type { GeneratedVisualCandidateRole, ProductMediaAuthorityClass, ProductMediaSourceType } from "./product-media-authority";
import { createProductMediaReviewDraft, projectProductMediaReviewControlState } from "./product-media-review-state";

type MediaRecord = {
  mediaAuthorityId: string;
  originalFilename: string;
  mimeType: string;
  dimensions: { width: number; height: number };
  sourceType: ProductMediaSourceType;
  generatedCandidateRole: GeneratedVisualCandidateRole | null;
  campaignId: string | null;
  generationPrompt: string | null;
  generationModel: string | null;
  generationProvider: string | null;
  generationReferenceMetadata: Record<string, string>;
  sourceDescription: string;
  ownerApproval: "PENDING_OWNER_APPROVAL" | "APPROVED" | "REJECTED";
  ownerApprovalTimestamp: string | null;
  ownerPrincipalId: string | null;
  provenance: string;
  authorityClass: ProductMediaAuthorityClass;
  usageScopes: readonly ProductMediaAuthorityClass[];
  proposedUsageScopes: readonly ProductMediaAuthorityClass[];
  approvedUsageScopes: readonly ProductMediaAuthorityClass[];
  localAtmosphereStateCodes: readonly string[];
  depictsActualProduct: boolean;
  heroEligible: boolean;
  heroSelectable: boolean;
  heroSelected: boolean;
  heroSelectedBy: string | null;
  heroSelectedAt: string | null;
  altTextAuthority: string;
  captionAuthority: string;
  hash: string;
  updatedAt: string;
  contentUrl: string;
};

type Payload = {
  records: MediaRecord[];
  readiness: {
    state: "REFERENCE_COMPOSITION_MEDIA_READY" | "PRODUCT_MEDIA_AUTHORITY_REQUIRED";
    approvedProductAuthorityMediaCount: number;
    approvedContextualMediaCount: number;
    approvedApplicationMediaCount: number;
    approvedLocalAtmosphereMediaCount: number;
    heroAuthorityReady: boolean;
    supportingProductMediaReady: boolean;
    applicationMediaReady: boolean;
    mediaProvenanceReady: boolean;
    productFactAuthorityScope: string;
    blockers: readonly string[];
  };
  forensic: { candidateMediaCount: number; plausibleCandidateCount: number; ownerReviewCandidateCount: number; groups: Record<string, number> };
};

type CampaignMediaPolicyPayload = {
  policy: {
    mode: "INHERIT_PRODUCT_MEDIA" | "EXPLICIT_ALLOWLIST";
    allowlistMediaAuthorityIds: string[];
  };
  effectiveMediaAuthorityIds: string[];
  readiness: {
    state: "REFERENCE_COMPOSITION_MEDIA_READY" | "PRODUCT_MEDIA_AUTHORITY_REQUIRED";
    approvedProductAuthorityMediaCount: number;
    approvedContextualMediaCount: number;
    approvedApplicationMediaCount: number;
    approvedLocalAtmosphereMediaCount: number;
    heroAuthorityReady: boolean;
    supportingProductMediaReady: boolean;
    applicationMediaReady: boolean;
    mediaProvenanceReady: boolean;
    productFactAuthorityScope: string;
    blockers: readonly string[];
  };
};

const roles: ProductMediaAuthorityClass[] = ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"];
const sources: ProductMediaSourceType[] = ["FACTORY_SUPPLIED", "OWNER_SUPPLIED", "OWNER_APPROVED_EXISTING", "GENESIS_GENERATED_CONTEXTUAL", "REFERENCE_ONLY", "UNVERIFIED"];

async function fetchMediaAuthority(endpoint: string, headers: Record<string, string>): Promise<Payload | null> {
  const response = await fetch(endpoint, { headers, cache: "no-store" });
  return response.ok ? await response.json() as Payload : null;
}

function MediaReviewCard(props: {
  record: MediaRecord;
  busy: boolean;
  campaignEligible: boolean | null;
  onSelectHero: (record: MediaRecord) => Promise<void>;
  onRevise: (record: MediaRecord, visualDirection: string) => Promise<void>;
  onReview: (record: MediaRecord, decision: "APPROVE" | "REJECT", review: {
    authorityClass: ProductMediaAuthorityClass;
    usageScopes: ProductMediaAuthorityClass[];
    depictsActualProduct: boolean;
    heroEligible: boolean;
    altTextAuthority: string;
    captionAuthority: string;
    authorityAndScopesConfirmed: boolean;
    localAtmosphereConfirmed: boolean;
    localAtmosphereStateCodes: string[];
  }) => Promise<void>;
  targetStateCode: string;
}) {
  const controls = projectProductMediaReviewControlState(props.record.ownerApproval);
  const [durableDraft] = useState(() => createProductMediaReviewDraft({ ...props.record, usageScopes: [...props.record.proposedUsageScopes] }));
  const [authorityClass, setAuthorityClass] = useState<ProductMediaAuthorityClass>(durableDraft.authorityClass);
  const [usageScopes, setUsageScopes] = useState<ProductMediaAuthorityClass[]>(durableDraft.usageScopes);
  const [depictsActualProduct, setDepictsActualProduct] = useState(durableDraft.depictsActualProduct);
  const [heroEligible, setHeroEligible] = useState(durableDraft.heroEligible);
  const [altTextAuthority, setAltTextAuthority] = useState(durableDraft.altTextAuthority);
  const [captionAuthority, setCaptionAuthority] = useState(durableDraft.captionAuthority);
  const [authorityAndScopesConfirmed, setAuthorityAndScopesConfirmed] = useState(false);
  const [localAtmosphereConfirmed, setLocalAtmosphereConfirmed] = useState(false);
  const [revisionDirection, setRevisionDirection] = useState("");
  const hasLocalScope = usageScopes.includes("LOCAL_CONTEXTUAL_ATMOSPHERE");
  const generatedCandidate = props.record.sourceType === "GENESIS_GENERATED_VISUAL_CANDIDATE";
  const aspectRatio = props.record.dimensions.height > 0 ? (props.record.dimensions.width / props.record.dimensions.height).toFixed(2) : "n/a";
  const review = { authorityClass, usageScopes, depictsActualProduct, heroEligible, altTextAuthority, captionAuthority, authorityAndScopesConfirmed, localAtmosphereConfirmed, localAtmosphereStateCodes: hasLocalScope && localAtmosphereConfirmed ? [props.targetStateCode] : [] };

  function toggleScope(role: ProductMediaAuthorityClass) {
    setUsageScopes((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  }

  return (
    <article className="border border-zinc-800 p-3">
      <Image src={props.record.contentUrl} alt={props.record.altTextAuthority} width={props.record.dimensions.width} height={props.record.dimensions.height} unoptimized className="aspect-video w-full object-contain" />
      <div className="mt-3 flex items-start justify-between gap-3"><p className="text-sm font-semibold text-white">{props.record.originalFilename}</p><span className={props.record.ownerApproval === "APPROVED" ? "text-xs font-semibold text-emerald-300" : props.record.ownerApproval === "REJECTED" ? "text-xs font-semibold text-red-300" : "text-xs font-semibold text-amber-300"}>{controls.label}</span></div>
      <p className="mt-1 break-all text-xs text-zinc-500">{props.record.hash}</p>
      <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-1 text-xs"><dt className="text-zinc-500">Class</dt><dd className="text-zinc-200">{props.record.authorityClass}</dd><dt className="text-zinc-500">Source</dt><dd className="text-zinc-200">{props.record.sourceType}</dd><dt className="text-zinc-500">Candidate role</dt><dd className="text-zinc-200">{props.record.generatedCandidateRole ?? "n/a"}</dd><dt className="text-zinc-500">Provenance</dt><dd className="text-zinc-200">{props.record.provenance}</dd><dt className="text-zinc-500">Dimensions</dt><dd className="text-zinc-200">{props.record.dimensions.width}x{props.record.dimensions.height} (ratio {aspectRatio})</dd><dt className="text-zinc-500">Generated</dt><dd className="text-zinc-200">{new Date(props.record.createdAt).toLocaleString()}</dd><dt className="text-zinc-500">Actual product</dt><dd className="text-zinc-200">{props.record.depictsActualProduct ? "YES" : "NO"}</dd><dt className="text-zinc-500">Primary hero</dt><dd className="text-zinc-200">{props.record.heroSelected ? "YES" : "NO"}</dd><dt className="text-zinc-500">{props.record.ownerApproval === "APPROVED" ? "Approved scopes" : "Proposed scopes"}</dt><dd className="text-zinc-200">{(props.record.ownerApproval === "APPROVED" ? props.record.approvedUsageScopes : props.record.proposedUsageScopes).join(", ") || "NONE"}</dd></dl>
      {props.campaignEligible === false ? <p className="mt-2 text-xs font-semibold text-amber-300">NOT USED IN THIS CAMPAIGN</p> : null}
      {generatedCandidate && props.record.generationPrompt ? <p className="mt-2 text-xs text-zinc-400">Prompt metadata recorded ({props.record.generationProvider ?? "unknown provider"} / {props.record.generationModel ?? "unknown model"}).</p> : null}
      {props.record.ownerApproval === "APPROVED" ? <p className="mt-3 text-xs text-emerald-300">Approved by {props.record.ownerPrincipalId ?? "recorded owner"} at {props.record.ownerApprovalTimestamp ? new Date(props.record.ownerApprovalTimestamp).toLocaleString() : "recorded time"}. Reclassification requires a separate governed action.</p> : null}
      {props.record.heroSelected ? <p className="mt-3 text-xs font-semibold text-emerald-300">Selected primary hero by {props.record.heroSelectedBy ?? "recorded owner"}.</p> : props.record.heroSelectable ? <button type="button" disabled={props.busy} onClick={() => void props.onSelectHero(props.record)} className="mt-3 border border-sky-700 px-3 py-2 text-xs font-semibold text-sky-300 disabled:opacity-40">Set as Hero</button> : null}
      {controls.reviewFieldsEditable ? <div className="mt-4 border-t border-zinc-800 pt-3">
        <p className="text-xs font-semibold text-zinc-300">{props.record.ownerApproval === "REJECTED" ? "Reconsider rejected media" : "Owner review"}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">Authority class<select value={authorityClass} onChange={(event) => { const next = event.target.value as ProductMediaAuthorityClass; setAuthorityClass(next); setUsageScopes([next]); setAuthorityAndScopesConfirmed(false); setLocalAtmosphereConfirmed(false); }} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-950 px-2 text-white">{roles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Authoritative alt text<input value={altTextAuthority} onChange={(event) => setAltTextAuthority(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-950 px-2 text-white" /></label>
          <label className="text-xs text-zinc-400 sm:col-span-2">Authoritative caption<input value={captionAuthority} onChange={(event) => setCaptionAuthority(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-950 px-2 text-white" /></label>
        </div>
        <fieldset className="mt-3"><legend className="text-xs text-zinc-400">Approved usage scopes</legend><div className="mt-2 flex flex-wrap gap-3">{roles.map((role) => <label key={role} className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={usageScopes.includes(role)} onChange={() => { toggleScope(role); setAuthorityAndScopesConfirmed(false); }} />{role.replaceAll("_", " ")}</label>)}</div></fieldset>
        <div className="mt-3 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={depictsActualProduct} onChange={(event) => setDepictsActualProduct(event.target.checked)} />Depicts actual product</label></div>
        <label className="mt-3 flex items-start gap-2 text-xs text-zinc-300"><input type="checkbox" checked={authorityAndScopesConfirmed} onChange={(event) => setAuthorityAndScopesConfirmed(event.target.checked)} />I confirm this authority class and each checked usage scope for this exact asset.</label>
        {hasLocalScope ? <label className="mt-2 flex items-start gap-2 text-xs text-amber-300"><input type="checkbox" checked={localAtmosphereConfirmed} onChange={(event) => setLocalAtmosphereConfirmed(event.target.checked)} />I confirm this asset is local to {props.targetStateCode}. Chicago or Texas provenance is not Indiana-local authority.</label> : null}
        <div className="mt-3 flex gap-2">{controls.approvalActionVisible ? <button type="button" disabled={props.busy || !authorityAndScopesConfirmed || (hasLocalScope && !localAtmosphereConfirmed) || !usageScopes.includes(authorityClass) || !altTextAuthority.trim()} onClick={() => void props.onReview(props.record, "APPROVE", review)} className="border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:border-zinc-800 disabled:text-zinc-600">{props.record.ownerApproval === "REJECTED" ? "Approve After Re-review" : "Approve"}</button> : null}{controls.rejectionActionVisible ? <button type="button" disabled={props.busy} onClick={() => void props.onReview(props.record, "REJECT", review)} className="border border-red-800 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-40">Reject</button> : null}</div>
      </div> : null}
      {generatedCandidate ? <div className="mt-4 border-t border-zinc-800 pt-3">
        <p className="text-xs font-semibold text-zinc-300">Revise Candidate</p>
        <p className="mt-1 text-xs text-zinc-500">Create a new candidate while retaining this record as historical evidence.</p>
        <label className="mt-2 block text-xs text-zinc-400">Revised visual direction<input value={revisionDirection} onChange={(event) => setRevisionDirection(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-950 px-2 text-white" /></label>
        <button type="button" disabled={props.busy || !revisionDirection.trim()} onClick={() => void props.onRevise(props.record, revisionDirection)} className="mt-3 border border-amber-700 px-3 py-2 text-xs font-semibold text-amber-300 disabled:opacity-40">Revise</button>
      </div> : null}
    </article>
  );
}

export function OutdoorSphereMediaAuthorityPanel(props: { organizationId: string; siteId: string; productId: string; targetStateCode: string; campaignId?: string | null; onAuthorityChanged?: () => Promise<void> }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<ProductMediaSourceType>("OWNER_SUPPLIED");
  const [authorityClass, setAuthorityClass] = useState<ProductMediaAuthorityClass>("PRODUCT_AUTHORITY");
  const [sourceDescription, setSourceDescription] = useState("");
  const [provenance, setProvenance] = useState("");
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [generatedCandidateRole, setGeneratedCandidateRole] = useState<GeneratedVisualCandidateRole>("HERO");
  const [generatedVisualDirection, setGeneratedVisualDirection] = useState("");
  const [campaignMediaPolicy, setCampaignMediaPolicy] = useState<CampaignMediaPolicyPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const endpoint = `/api/glw/products/${encodeURIComponent(props.productId)}/media-authority?stateCode=${encodeURIComponent(props.targetStateCode)}`;
  const policyEndpoint = props.campaignId
    ? `/api/glw/campaigns/${encodeURIComponent(props.campaignId)}/media-policy?stateCode=${encodeURIComponent(props.targetStateCode)}`
    : null;
  const scopeHeaders = { "x-gcp-organization-id": props.organizationId, "x-gcp-site-id": props.siteId };

  useEffect(() => {
    let active = true;
    void fetch(endpoint, { headers: { "x-gcp-organization-id": props.organizationId, "x-gcp-site-id": props.siteId }, cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => null) as Payload | null }))
      .then(({ ok, body }) => { if (active && ok && body) setPayload(body); });
    return () => { active = false; };
  }, [endpoint, props.organizationId, props.siteId]);

  useEffect(() => {
    let active = true;
    if (!policyEndpoint) {
      setCampaignMediaPolicy(null);
      return () => {
        active = false;
      };
    }

    void fetch(policyEndpoint, { headers: scopeHeaders, cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => null) as CampaignMediaPolicyPayload | null }))
      .then(({ ok, body }) => {
        if (active && ok && body) {
          setCampaignMediaPolicy(body);
        }
      });

    return () => {
      active = false;
    };
  }, [policyEndpoint, props.organizationId, props.siteId, props.targetStateCode]);

  async function saveCampaignMediaPolicy(input: {
    mode: "INHERIT_PRODUCT_MEDIA" | "EXPLICIT_ALLOWLIST";
    allowlistMediaAuthorityIds: readonly string[];
  }) {
    if (!policyEndpoint) return;
    const response = await fetch(policyEndpoint, {
      method: "PATCH",
      headers: operatorMutationHeaders({ ...scopeHeaders, "Content-Type": "application/json" }),
      body: JSON.stringify(input),
    });
    const next = await response.json().catch(() => null) as (CampaignMediaPolicyPayload & { error?: string; errors?: string[] }) | null;
    if (!response.ok || !next) {
      throw new Error(next?.error ?? next?.errors?.join(" ") ?? "Campaign media policy update failed.");
    }
    setCampaignMediaPolicy(next);
  }

  async function updateCampaignPolicyMode(mode: "INHERIT_PRODUCT_MEDIA" | "EXPLICIT_ALLOWLIST") {
    if (!campaignMediaPolicy) return;
    setBusy(true);
    setMessage(null);
    try {
      await saveCampaignMediaPolicy({
        mode,
        allowlistMediaAuthorityIds: campaignMediaPolicy.policy.allowlistMediaAuthorityIds,
      });
      setMessage(mode === "INHERIT_PRODUCT_MEDIA" ? "Campaign now inherits globally eligible product media." : "Campaign now enforces an explicit media allowlist.");
      await props.onAuthorityChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign media policy update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAllowlistMediaId(mediaAuthorityId: string) {
    if (!campaignMediaPolicy) return;
    const current = new Set(campaignMediaPolicy.policy.allowlistMediaAuthorityIds);
    if (current.has(mediaAuthorityId)) {
      current.delete(mediaAuthorityId);
    } else {
      current.add(mediaAuthorityId);
    }

    setBusy(true);
    setMessage(null);
    try {
      await saveCampaignMediaPolicy({
        mode: campaignMediaPolicy.policy.mode,
        allowlistMediaAuthorityIds: Array.from(current),
      });
      setMessage("Campaign allowlist updated.");
      await props.onAuthorityChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Campaign allowlist update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set("action", "INTAKE_PRODUCT_MEDIA");
      form.set("file", file);
      form.set("sourceType", sourceType);
      form.set("sourceDescription", sourceDescription);
      form.set("provenance", provenance);
      form.set("authorityClass", authorityClass);
      form.set("usageScopes", JSON.stringify([authorityClass]));
      form.set("depictsActualProduct", "false");
      form.set("heroEligible", "false");
      form.set("altTextAuthority", altText);
      form.set("captionAuthority", caption);
      const response = await fetch(endpoint, { method: "POST", headers: operatorMutationHeaders(scopeHeaders), body: form });
      const next = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(next.error ?? "Media intake failed.");
      setPayload(await fetchMediaAuthority(endpoint, scopeHeaders) ?? next);
      setFile(null);
      setMessage("Media stored as pending. Review and explicitly approve or reject it below.");
      await props.onAuthorityChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Media intake failed.");
    } finally {
      setBusy(false);
    }
  }

  async function review(record: MediaRecord, decision: "APPROVE" | "REJECT", reviewInput: { authorityClass: ProductMediaAuthorityClass; usageScopes: ProductMediaAuthorityClass[]; depictsActualProduct: boolean; heroEligible: boolean; altTextAuthority: string; captionAuthority: string; authorityAndScopesConfirmed: boolean; localAtmosphereConfirmed: boolean; localAtmosphereStateCodes: string[] }) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: operatorMutationHeaders({ ...scopeHeaders, "Content-Type": "application/json" }),
        body: JSON.stringify({ action: "REVIEW_PRODUCT_MEDIA", mediaAuthorityId: record.mediaAuthorityId, decision, ...reviewInput }),
      });
      const next = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(next.error ?? "Media review failed.");
      setPayload(await fetchMediaAuthority(endpoint, scopeHeaders) ?? next);
      setMessage(decision === "APPROVE" ? "Owner approval persisted." : "Owner rejection persisted.");
      await props.onAuthorityChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Media review failed.");
    } finally {
      setBusy(false);
    }
  }

  async function generateCandidate() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: operatorMutationHeaders({ ...scopeHeaders, "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "GENERATE_VISUAL_CANDIDATE",
          candidateRole: generatedCandidateRole,
          visualDirection: generatedVisualDirection,
          campaignId: props.campaignId ?? null,
        }),
      });
      const next = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(next.error ?? "Generated visual candidate failed.");
      setPayload(await fetchMediaAuthority(endpoint, scopeHeaders) ?? next);
      setMessage(`Generated ${generatedCandidateRole} candidate stored as pending owner approval.`);
      await props.onAuthorityChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generated visual candidate failed.");
    } finally {
      setBusy(false);
    }
  }

  async function reviseCandidate(record: MediaRecord, visualDirection: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: operatorMutationHeaders({ ...scopeHeaders, "Content-Type": "application/json" }),
        body: JSON.stringify({
          action: "REVISE_GENERATED_VISUAL_CANDIDATE",
          mediaAuthorityId: record.mediaAuthorityId,
          candidateRole: record.generatedCandidateRole ?? "CONTEXTUAL_IN_USE",
          visualDirection,
          campaignId: props.campaignId ?? null,
        }),
      });
      const next = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(next.error ?? "Candidate revision failed.");
      setPayload(await fetchMediaAuthority(endpoint, scopeHeaders) ?? next);
      setMessage("Generated candidate revision stored as pending owner approval.");
      await props.onAuthorityChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Candidate revision failed.");
    } finally {
      setBusy(false);
    }
  }

  async function selectHero(record: MediaRecord) {
    const currentHero = payload?.records.find((candidate) => candidate.heroSelected) ?? null;
    const replacementConfirmed = Boolean(currentHero && currentHero.mediaAuthorityId !== record.mediaAuthorityId);
    if (replacementConfirmed && !window.confirm(`Replace ${currentHero?.originalFilename} with ${record.originalFilename} as the primary hero?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const request = async (body: Record<string, unknown>) => {
        const response = await fetch(endpoint, { method: "POST", headers: operatorMutationHeaders({ ...scopeHeaders, "Content-Type": "application/json" }), body: JSON.stringify(body) });
        const result = await response.json() as { error?: string; receipt?: { receiptId: string }; grant?: { grantId: string }; records?: MediaRecord[] };
        if (!response.ok) throw new Error(result.error ?? "Hero selection failed.");
        return result;
      };
      const target = { mediaAuthorityId: record.mediaAuthorityId, hash: record.hash, replacementConfirmed };
      const preflight = await request({ action: "RUN_HERO_PREFLIGHT", ...target });
      if (!preflight.receipt) throw new Error("Hero preflight receipt was not issued.");
      const authorization = await request({ action: "AUTHORIZE_HERO_SELECTION", ...target, preflightReceiptId: preflight.receipt.receiptId });
      if (!authorization.grant) throw new Error("Hero selection grant was not issued.");
      const selection = await request({ action: "SELECT_PRODUCT_MEDIA_HERO", ...target, preflightReceiptId: preflight.receipt.receiptId, grantId: authorization.grant.grantId });
      setPayload(await fetchMediaAuthority(endpoint, scopeHeaders) ?? selection as Payload);
      setMessage(`${record.originalFilename} is now the explicitly selected primary hero.`);
      await props.onAuthorityChanged?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Hero selection failed.");
    } finally {
      setBusy(false);
    }
  }

  const resolvedReadiness = campaignMediaPolicy?.readiness ?? payload?.readiness ?? null;
  const effectiveIdSet = new Set(campaignMediaPolicy?.effectiveMediaAuthorityIds ?? []);
  const campaignEffectiveMediaCount = campaignMediaPolicy?.effectiveMediaAuthorityIds.length ?? null;
  const globalMediaCount = payload?.records.length ?? null;

  return (
    <section className="mt-4 border-t border-zinc-800 pt-4" aria-labelledby="outdoor-sphere-media-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 id="outdoor-sphere-media-heading" className="font-semibold text-white">Outdoor Digital Sphere Media Authority</h4>
          <p className="mt-1 text-xs text-zinc-400">Media approval establishes visual usage only. It does not establish specifications or generate a reference page.</p>
        </div>
        <span className={`text-xs font-semibold ${resolvedReadiness?.state === "REFERENCE_COMPOSITION_MEDIA_READY" ? "text-emerald-300" : "text-amber-300"}`}>{resolvedReadiness?.state.replaceAll("_", " ") ?? "Checking media authority"}</span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-4">
        <p>Forensic candidates: <strong>{payload?.forensic.candidateMediaCount ?? 68}</strong></p>
        <p>Plausible: <strong>{payload?.forensic.plausibleCandidateCount ?? 0}</strong></p>
        <p>Owner review: <strong>{payload?.forensic.ownerReviewCandidateCount ?? 0}</strong></p>
        <p>Clearly unrelated: <strong>{payload?.forensic.groups.clearlyUnrelated ?? 68}</strong></p>
      </div>
      <p className="mt-2 text-xs text-zinc-500">No forensic candidate is currently relevant enough to request review. None has been auto-approved.</p>

      {policyEndpoint && campaignMediaPolicy ? (
        <section className="mt-4 border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-300">Campaign Media Eligibility Policy</p>
          <p className="mt-1 text-xs text-zinc-500">Choose whether this campaign inherits globally eligible media or enforces a campaign-specific allowlist.</p>
          <p className="mt-1 text-xs text-zinc-500">Product library records: {globalMediaCount ?? "CHECKING"} · Campaign-approved media: {campaignEffectiveMediaCount ?? "CHECKING"}</p>
          <label className="mt-2 block text-xs text-zinc-300">
            Eligibility mode
            <select
              value={campaignMediaPolicy.policy.mode}
              onChange={(event) => { void updateCampaignPolicyMode(event.target.value as "INHERIT_PRODUCT_MEDIA" | "EXPLICIT_ALLOWLIST"); }}
              className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-950 px-2 text-white"
              disabled={busy}
            >
              <option value="INHERIT_PRODUCT_MEDIA">Inherit Product Media</option>
              <option value="EXPLICIT_ALLOWLIST">Explicit Allowlist</option>
            </select>
          </label>

          {campaignMediaPolicy.policy.mode === "EXPLICIT_ALLOWLIST" ? (
            <div className="mt-3">
              <p className="text-xs text-zinc-400">Allowlisted IDs: {campaignMediaPolicy.policy.allowlistMediaAuthorityIds.length}</p>
              <div className="mt-2 max-h-48 space-y-2 overflow-auto">
                {(payload?.records ?? []).map((record) => (
                  <label key={record.mediaAuthorityId} className="flex items-center justify-between gap-3 rounded border border-zinc-800 px-2 py-2 text-xs text-zinc-200">
                    <span className="min-w-0 truncate">{record.originalFilename}</span>
                    <span className="flex items-center gap-2">
                      <span className={campaignMediaPolicy.effectiveMediaAuthorityIds.includes(record.mediaAuthorityId) ? "text-emerald-300" : "text-zinc-500"}>
                        {campaignMediaPolicy.effectiveMediaAuthorityIds.includes(record.mediaAuthorityId) ? "EFFECTIVE" : "NOT EFFECTIVE"}
                      </span>
                      <input
                        type="checkbox"
                        checked={campaignMediaPolicy.policy.allowlistMediaAuthorityIds.includes(record.mediaAuthorityId)}
                        onChange={() => { void toggleAllowlistMediaId(record.mediaAuthorityId); }}
                        disabled={busy}
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-2 text-xs text-zinc-400">
            <p>Effective readiness: {campaignMediaPolicy.readiness.state.replaceAll("_", " ")}</p>
            <p className="mt-1">Hero: {campaignMediaPolicy.readiness.heroAuthorityReady ? "READY" : "NOT READY"} · Supporting: {campaignMediaPolicy.readiness.supportingProductMediaReady ? "READY" : "NOT READY"} · Application: {campaignMediaPolicy.readiness.applicationMediaReady ? "READY" : "NOT READY"}</p>
            {campaignMediaPolicy.readiness.blockers.length > 0 ? <p className="mt-1">Blockers: {campaignMediaPolicy.readiness.blockers.join(", ")}</p> : null}
          </div>
        </section>
      ) : null}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-zinc-300">Media file<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs" /></label>
        <label className="text-xs text-zinc-300">Source type<select value={sourceType} onChange={(event) => setSourceType(event.target.value as ProductMediaSourceType)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white">{sources.map((source) => <option key={source} value={source}>{source.replaceAll("_", " ")}</option>)}</select></label>
        <label className="text-xs text-zinc-300">Intended authority class<select value={authorityClass} onChange={(event) => setAuthorityClass(event.target.value as ProductMediaAuthorityClass)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white">{roles.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
        <label className="text-xs text-zinc-300">Authoritative alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
        <label className="text-xs text-zinc-300">Source description<input value={sourceDescription} onChange={(event) => setSourceDescription(event.target.value)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
        <label className="text-xs text-zinc-300">Provenance<input value={provenance} onChange={(event) => setProvenance(event.target.value)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
        <label className="text-xs text-zinc-300 md:col-span-2">Authoritative caption<input value={caption} onChange={(event) => setCaption(event.target.value)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
      </div>
      <p className="mt-3 text-xs text-zinc-500">Upload records only the intended authority class. Usage scopes become authoritative only during explicit owner review.</p>
      <p className="mt-2 text-xs text-zinc-500">Actual-product representation is decided during owner review. Primary hero selection is a separate governed owner action after approval.</p>
      <button type="button" onClick={() => void upload()} disabled={busy || !file || !sourceDescription.trim() || !provenance.trim() || !altText.trim()} className="mt-4 bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:bg-zinc-800 disabled:text-zinc-500">Store Pending Media</button>

      <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
        <p className="text-xs font-semibold text-zinc-200">Generated Visual Candidates</p>
        <p className="mt-1 text-xs text-zinc-500">Create one governed generated candidate for owner review. Generated visuals never establish factual product authority.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs text-zinc-300">Candidate role<select value={generatedCandidateRole} onChange={(event) => setGeneratedCandidateRole(event.target.value as GeneratedVisualCandidateRole)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white"><option value="HERO">HERO</option><option value="CONTEXTUAL_IN_USE">CONTEXTUAL IN USE</option></select></label>
          <label className="text-xs text-zinc-300">Visual direction<input value={generatedVisualDirection} onChange={(event) => setGeneratedVisualDirection(event.target.value)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
        </div>
        <button type="button" onClick={() => void generateCandidate()} disabled={busy || !generatedVisualDirection.trim()} className="mt-3 border border-indigo-700 px-3 py-2 text-xs font-semibold text-indigo-300 disabled:opacity-40">Generate Candidate</button>
      </div>

      {message ? <p className="mt-3 text-sm text-amber-300" role="status">{message}</p> : null}

      {payload?.records.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{payload.records.map((record) => <MediaReviewCard key={`${record.mediaAuthorityId}:${record.updatedAt}`} record={record} busy={busy} campaignEligible={campaignMediaPolicy ? effectiveIdSet.has(record.mediaAuthorityId) : null} onReview={review} onSelectHero={selectHero} onRevise={reviseCandidate} targetStateCode={props.targetStateCode} />)}</div> : null}

      {resolvedReadiness ? <div className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-300"><p>Product authority: {resolvedReadiness.approvedProductAuthorityMediaCount} · Contextual: {resolvedReadiness.approvedContextualMediaCount} · Application: {resolvedReadiness.approvedApplicationMediaCount} · Local atmosphere: {resolvedReadiness.approvedLocalAtmosphereMediaCount}</p><p className="mt-1">Hero: {resolvedReadiness.heroAuthorityReady ? "READY" : "NOT READY"} · Supporting: {resolvedReadiness.supportingProductMediaReady ? "READY" : "NOT READY"} · Application: {resolvedReadiness.applicationMediaReady ? "READY" : "NOT READY"} · Provenance: {resolvedReadiness.mediaProvenanceReady ? "READY" : "NOT READY"}</p><p className="mt-1 text-zinc-500">Product fact authority remains {resolvedReadiness.productFactAuthorityScope.replaceAll("_", " ")}.</p></div> : null}
    </section>
  );
}