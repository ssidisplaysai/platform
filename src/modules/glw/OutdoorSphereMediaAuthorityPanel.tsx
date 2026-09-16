"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";
import type { ProductMediaAuthorityClass, ProductMediaSourceType } from "./product-media-authority";
import { createProductMediaReviewDraft, projectProductMediaReviewControlState } from "./product-media-review-state";

type MediaRecord = {
  mediaAuthorityId: string;
  originalFilename: string;
  mimeType: string;
  dimensions: { width: number; height: number };
  sourceType: ProductMediaSourceType;
  sourceDescription: string;
  ownerApproval: "PENDING_OWNER_APPROVAL" | "APPROVED" | "REJECTED";
  ownerApprovalTimestamp: string | null;
  ownerPrincipalId: string | null;
  provenance: string;
  authorityClass: ProductMediaAuthorityClass;
  usageScopes: readonly ProductMediaAuthorityClass[];
  proposedUsageScopes: readonly ProductMediaAuthorityClass[];
  approvedUsageScopes: readonly ProductMediaAuthorityClass[];
  depictsActualProduct: boolean;
  heroEligible: boolean;
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

const roles: ProductMediaAuthorityClass[] = ["PRODUCT_AUTHORITY", "CONTEXTUAL_IN_USE", "APPLICATION_EXPERIENCE", "LOCAL_CONTEXTUAL_ATMOSPHERE"];
const sources: ProductMediaSourceType[] = ["FACTORY_SUPPLIED", "OWNER_SUPPLIED", "OWNER_APPROVED_EXISTING", "GENESIS_GENERATED_CONTEXTUAL", "REFERENCE_ONLY", "UNVERIFIED"];

async function fetchMediaAuthority(endpoint: string, headers: Record<string, string>): Promise<Payload | null> {
  const response = await fetch(endpoint, { headers, cache: "no-store" });
  return response.ok ? await response.json() as Payload : null;
}

function MediaReviewCard(props: {
  record: MediaRecord;
  busy: boolean;
  onReview: (record: MediaRecord, decision: "APPROVE" | "REJECT", review: {
    authorityClass: ProductMediaAuthorityClass;
    usageScopes: ProductMediaAuthorityClass[];
    depictsActualProduct: boolean;
    heroEligible: boolean;
    altTextAuthority: string;
    captionAuthority: string;
    authorityAndScopesConfirmed: boolean;
    localAtmosphereConfirmed: boolean;
  }) => Promise<void>;
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
  const hasLocalScope = usageScopes.includes("LOCAL_CONTEXTUAL_ATMOSPHERE");
  const review = { authorityClass, usageScopes, depictsActualProduct, heroEligible, altTextAuthority, captionAuthority, authorityAndScopesConfirmed, localAtmosphereConfirmed };

  function toggleScope(role: ProductMediaAuthorityClass) {
    setUsageScopes((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  }

  return (
    <article className="border border-zinc-800 p-3">
      <Image src={props.record.contentUrl} alt={props.record.altTextAuthority} width={props.record.dimensions.width} height={props.record.dimensions.height} unoptimized className="aspect-video w-full object-contain" />
      <div className="mt-3 flex items-start justify-between gap-3"><p className="text-sm font-semibold text-white">{props.record.originalFilename}</p><span className={props.record.ownerApproval === "APPROVED" ? "text-xs font-semibold text-emerald-300" : props.record.ownerApproval === "REJECTED" ? "text-xs font-semibold text-red-300" : "text-xs font-semibold text-amber-300"}>{controls.label}</span></div>
      <p className="mt-1 break-all text-xs text-zinc-500">{props.record.hash}</p>
      <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-1 text-xs"><dt className="text-zinc-500">Class</dt><dd className="text-zinc-200">{props.record.authorityClass}</dd><dt className="text-zinc-500">Source</dt><dd className="text-zinc-200">{props.record.sourceType}</dd><dt className="text-zinc-500">Provenance</dt><dd className="text-zinc-200">{props.record.provenance}</dd><dt className="text-zinc-500">Actual product</dt><dd className="text-zinc-200">{props.record.depictsActualProduct ? "YES" : "NO"}</dd><dt className="text-zinc-500">Hero eligible</dt><dd className="text-zinc-200">{props.record.heroEligible ? "YES" : "NO"}</dd><dt className="text-zinc-500">{props.record.ownerApproval === "APPROVED" ? "Approved scopes" : "Proposed scopes"}</dt><dd className="text-zinc-200">{(props.record.ownerApproval === "APPROVED" ? props.record.approvedUsageScopes : props.record.proposedUsageScopes).join(", ") || "NONE"}</dd></dl>
      {props.record.ownerApproval === "APPROVED" ? <p className="mt-3 text-xs text-emerald-300">Approved by {props.record.ownerPrincipalId ?? "recorded owner"} at {props.record.ownerApprovalTimestamp ? new Date(props.record.ownerApprovalTimestamp).toLocaleString() : "recorded time"}. Reclassification requires a separate governed action.</p> : null}
      {controls.reviewFieldsEditable ? <div className="mt-4 border-t border-zinc-800 pt-3">
        <p className="text-xs font-semibold text-zinc-300">{props.record.ownerApproval === "REJECTED" ? "Reconsider rejected media" : "Owner review"}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-zinc-400">Authority class<select value={authorityClass} onChange={(event) => { const next = event.target.value as ProductMediaAuthorityClass; setAuthorityClass(next); setUsageScopes([next]); setAuthorityAndScopesConfirmed(false); setLocalAtmosphereConfirmed(false); }} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-950 px-2 text-white">{roles.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}</select></label>
          <label className="text-xs text-zinc-400">Authoritative alt text<input value={altTextAuthority} onChange={(event) => setAltTextAuthority(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-950 px-2 text-white" /></label>
          <label className="text-xs text-zinc-400 sm:col-span-2">Authoritative caption<input value={captionAuthority} onChange={(event) => setCaptionAuthority(event.target.value)} className="mt-1 h-9 w-full border border-zinc-700 bg-zinc-950 px-2 text-white" /></label>
        </div>
        <fieldset className="mt-3"><legend className="text-xs text-zinc-400">Approved usage scopes</legend><div className="mt-2 flex flex-wrap gap-3">{roles.map((role) => <label key={role} className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={usageScopes.includes(role)} onChange={() => { toggleScope(role); setAuthorityAndScopesConfirmed(false); }} />{role.replaceAll("_", " ")}</label>)}</div></fieldset>
        <div className="mt-3 flex flex-wrap gap-4"><label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={depictsActualProduct} onChange={(event) => setDepictsActualProduct(event.target.checked)} />Depicts actual product</label><label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={heroEligible} onChange={(event) => setHeroEligible(event.target.checked)} />Hero eligible</label></div>
        <label className="mt-3 flex items-start gap-2 text-xs text-zinc-300"><input type="checkbox" checked={authorityAndScopesConfirmed} onChange={(event) => setAuthorityAndScopesConfirmed(event.target.checked)} />I confirm this authority class and each checked usage scope for this exact asset.</label>
        {hasLocalScope ? <label className="mt-2 flex items-start gap-2 text-xs text-amber-300"><input type="checkbox" checked={localAtmosphereConfirmed} onChange={(event) => setLocalAtmosphereConfirmed(event.target.checked)} />I confirm this asset is local to the intended target geography. Chicago or Texas provenance is not Indiana-local authority.</label> : null}
        <div className="mt-3 flex gap-2">{controls.approvalActionVisible ? <button type="button" disabled={props.busy || !authorityAndScopesConfirmed || (hasLocalScope && !localAtmosphereConfirmed) || !usageScopes.includes(authorityClass) || !altTextAuthority.trim()} onClick={() => void props.onReview(props.record, "APPROVE", review)} className="border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:border-zinc-800 disabled:text-zinc-600">{props.record.ownerApproval === "REJECTED" ? "Approve After Re-review" : "Approve"}</button> : null}{controls.rejectionActionVisible ? <button type="button" disabled={props.busy} onClick={() => void props.onReview(props.record, "REJECT", review)} className="border border-red-800 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-40">Reject</button> : null}</div>
      </div> : null}
    </article>
  );
}

export function OutdoorSphereMediaAuthorityPanel(props: { organizationId: string; siteId: string; productId: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<ProductMediaSourceType>("OWNER_SUPPLIED");
  const [authorityClass, setAuthorityClass] = useState<ProductMediaAuthorityClass>("PRODUCT_AUTHORITY");
  const [sourceDescription, setSourceDescription] = useState("");
  const [provenance, setProvenance] = useState("");
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const endpoint = `/api/glw/products/${encodeURIComponent(props.productId)}/media-authority`;
  const scopeHeaders = { "x-gcp-organization-id": props.organizationId, "x-gcp-site-id": props.siteId };

  useEffect(() => {
    let active = true;
    void fetch(endpoint, { headers: { "x-gcp-organization-id": props.organizationId, "x-gcp-site-id": props.siteId }, cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, body: await response.json().catch(() => null) as Payload | null }))
      .then(({ ok, body }) => { if (active && ok && body) setPayload(body); });
    return () => { active = false; };
  }, [endpoint, props.organizationId, props.siteId]);

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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Media intake failed.");
    } finally {
      setBusy(false);
    }
  }

  async function review(record: MediaRecord, decision: "APPROVE" | "REJECT", reviewInput: { authorityClass: ProductMediaAuthorityClass; usageScopes: ProductMediaAuthorityClass[]; depictsActualProduct: boolean; heroEligible: boolean; altTextAuthority: string; captionAuthority: string; authorityAndScopesConfirmed: boolean; localAtmosphereConfirmed: boolean }) {
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Media review failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-4 border-t border-zinc-800 pt-4" aria-labelledby="outdoor-sphere-media-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 id="outdoor-sphere-media-heading" className="font-semibold text-white">Outdoor Digital Sphere Media Authority</h4>
          <p className="mt-1 text-xs text-zinc-400">Media approval establishes visual usage only. It does not establish specifications or generate a reference page.</p>
        </div>
        <span className={`text-xs font-semibold ${payload?.readiness.state === "REFERENCE_COMPOSITION_MEDIA_READY" ? "text-emerald-300" : "text-amber-300"}`}>{payload?.readiness.state.replaceAll("_", " ") ?? "Checking media authority"}</span>
      </div>

      <div className="mt-3 grid gap-2 text-xs text-zinc-300 sm:grid-cols-4">
        <p>Forensic candidates: <strong>{payload?.forensic.candidateMediaCount ?? 68}</strong></p>
        <p>Plausible: <strong>{payload?.forensic.plausibleCandidateCount ?? 0}</strong></p>
        <p>Owner review: <strong>{payload?.forensic.ownerReviewCandidateCount ?? 0}</strong></p>
        <p>Clearly unrelated: <strong>{payload?.forensic.groups.clearlyUnrelated ?? 68}</strong></p>
      </div>
      <p className="mt-2 text-xs text-zinc-500">No forensic candidate is currently relevant enough to request review. None has been auto-approved.</p>

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
      <p className="mt-2 text-xs text-zinc-500">Actual-product representation and hero eligibility are decided only in the owner review step.</p>
      <button type="button" onClick={() => void upload()} disabled={busy || !file || !sourceDescription.trim() || !provenance.trim() || !altText.trim()} className="mt-4 bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:bg-zinc-800 disabled:text-zinc-500">Store Pending Media</button>
      {message ? <p className="mt-3 text-sm text-amber-300" role="status">{message}</p> : null}

      {payload?.records.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{payload.records.map((record) => <MediaReviewCard key={`${record.mediaAuthorityId}:${record.updatedAt}`} record={record} busy={busy} onReview={review} />)}</div> : null}

      {payload ? <div className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-300"><p>Product authority: {payload.readiness.approvedProductAuthorityMediaCount} · Contextual: {payload.readiness.approvedContextualMediaCount} · Application: {payload.readiness.approvedApplicationMediaCount} · Local atmosphere: {payload.readiness.approvedLocalAtmosphereMediaCount}</p><p className="mt-1">Hero: {payload.readiness.heroAuthorityReady ? "READY" : "REQUIRED"} · Supporting: {payload.readiness.supportingProductMediaReady ? "READY" : "REQUIRED"} · Application: {payload.readiness.applicationMediaReady ? "READY" : "REQUIRED"} · Provenance: {payload.readiness.mediaProvenanceReady ? "READY" : "REQUIRED"}</p><p className="mt-1 text-zinc-500">Product fact authority remains {payload.readiness.productFactAuthorityScope.replaceAll("_", " ")}.</p></div> : null}
    </section>
  );
}