"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";
import type { ProductMediaAuthorityClass, ProductMediaSourceType } from "./product-media-authority";

type MediaRecord = {
  mediaAuthorityId: string;
  originalFilename: string;
  mimeType: string;
  dimensions: { width: number; height: number };
  sourceType: ProductMediaSourceType;
  sourceDescription: string;
  ownerApproval: "PENDING" | "APPROVED" | "REJECTED";
  ownerApprovalTimestamp: string | null;
  ownerPrincipalId: string | null;
  provenance: string;
  authorityClass: ProductMediaAuthorityClass;
  usageScopes: readonly ProductMediaAuthorityClass[];
  depictsActualProduct: boolean;
  heroEligible: boolean;
  altTextAuthority: string;
  captionAuthority: string;
  hash: string;
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

export function OutdoorSphereMediaAuthorityPanel(props: { organizationId: string; siteId: string; productId: string }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<ProductMediaSourceType>("OWNER_SUPPLIED");
  const [authorityClass, setAuthorityClass] = useState<ProductMediaAuthorityClass>("PRODUCT_AUTHORITY");
  const [usageScopes, setUsageScopes] = useState<ProductMediaAuthorityClass[]>(["PRODUCT_AUTHORITY"]);
  const [depictsActualProduct, setDepictsActualProduct] = useState(false);
  const [heroEligible, setHeroEligible] = useState(false);
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

  function toggleScope(role: ProductMediaAuthorityClass) {
    setUsageScopes((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
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
      form.set("usageScopes", JSON.stringify(usageScopes));
      form.set("depictsActualProduct", String(depictsActualProduct));
      form.set("heroEligible", String(heroEligible));
      form.set("altTextAuthority", altText);
      form.set("captionAuthority", caption);
      const response = await fetch(endpoint, { method: "POST", headers: operatorMutationHeaders(scopeHeaders), body: form });
      const next = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(next.error ?? "Media intake failed.");
      setPayload(next);
      setFile(null);
      setMessage("Media stored as pending. Review and explicitly approve or reject it below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Media intake failed.");
    } finally {
      setBusy(false);
    }
  }

  async function review(record: MediaRecord, decision: "APPROVE" | "REJECT") {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: operatorMutationHeaders({ ...scopeHeaders, "Content-Type": "application/json" }),
        body: JSON.stringify({ action: "REVIEW_PRODUCT_MEDIA", mediaAuthorityId: record.mediaAuthorityId, decision, authorityClass: record.authorityClass, usageScopes: record.usageScopes, depictsActualProduct: record.depictsActualProduct, heroEligible: record.heroEligible, altTextAuthority: record.altTextAuthority, captionAuthority: record.captionAuthority }),
      });
      const next = await response.json() as Payload & { error?: string };
      if (!response.ok) throw new Error(next.error ?? "Media review failed.");
      setPayload(next);
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
        <label className="text-xs text-zinc-300">Intended authority class<select value={authorityClass} onChange={(event) => { const next = event.target.value as ProductMediaAuthorityClass; setAuthorityClass(next); setUsageScopes((current) => current.includes(next) ? current : [...current, next]); }} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white">{roles.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
        <label className="text-xs text-zinc-300">Authoritative alt text<input value={altText} onChange={(event) => setAltText(event.target.value)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
        <label className="text-xs text-zinc-300">Source description<input value={sourceDescription} onChange={(event) => setSourceDescription(event.target.value)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
        <label className="text-xs text-zinc-300">Provenance<input value={provenance} onChange={(event) => setProvenance(event.target.value)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
        <label className="text-xs text-zinc-300 md:col-span-2">Authoritative caption<input value={caption} onChange={(event) => setCaption(event.target.value)} className="mt-2 h-10 w-full border border-zinc-700 bg-zinc-950 px-3 text-white" /></label>
      </div>
      <fieldset className="mt-3">
        <legend className="text-xs text-zinc-400">Usage scopes</legend>
        <div className="mt-2 flex flex-wrap gap-4">{roles.map((item) => <label key={item} className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={usageScopes.includes(item)} onChange={() => toggleScope(item)} />{item.replaceAll("_", " ")}</label>)}</div>
      </fieldset>
      <div className="mt-3 flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={depictsActualProduct} onChange={(event) => setDepictsActualProduct(event.target.checked)} />Depicts the actual Outdoor Digital Sphere</label>
        <label className="flex items-center gap-2 text-xs text-zinc-300"><input type="checkbox" checked={heroEligible} onChange={(event) => setHeroEligible(event.target.checked)} />Hero eligible</label>
      </div>
      <button type="button" onClick={() => void upload()} disabled={busy || !file || !sourceDescription.trim() || !provenance.trim() || !altText.trim() || usageScopes.length === 0} className="mt-4 bg-red-600 px-4 py-2 text-xs font-semibold text-white disabled:bg-zinc-800 disabled:text-zinc-500">Store Pending Media</button>
      {message ? <p className="mt-3 text-sm text-amber-300" role="status">{message}</p> : null}

      {payload?.records.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">{payload.records.map((record) => (
        <article key={record.mediaAuthorityId} className="border border-zinc-800 p-3">
          <Image src={record.contentUrl} alt={record.altTextAuthority} width={record.dimensions.width} height={record.dimensions.height} unoptimized className="aspect-video w-full object-contain" />
          <p className="mt-3 text-sm font-semibold text-white">{record.originalFilename}</p>
          <p className="mt-1 break-all text-xs text-zinc-500">{record.hash}</p>
          <dl className="mt-2 grid grid-cols-[8rem_1fr] gap-1 text-xs"><dt className="text-zinc-500">Status</dt><dd className="text-zinc-200">{record.ownerApproval}</dd><dt className="text-zinc-500">Class</dt><dd className="text-zinc-200">{record.authorityClass}</dd><dt className="text-zinc-500">Source</dt><dd className="text-zinc-200">{record.sourceType}</dd><dt className="text-zinc-500">Provenance</dt><dd className="text-zinc-200">{record.provenance}</dd><dt className="text-zinc-500">Actual product</dt><dd className="text-zinc-200">{record.depictsActualProduct ? "YES" : "NO"}</dd><dt className="text-zinc-500">Hero eligible</dt><dd className="text-zinc-200">{record.heroEligible ? "YES" : "NO"}</dd></dl>
          <div className="mt-3 flex gap-2"><button type="button" disabled={busy} onClick={() => void review(record, "APPROVE")} className="border border-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-300 disabled:opacity-40">Approve</button><button type="button" disabled={busy} onClick={() => void review(record, "REJECT")} className="border border-red-800 px-3 py-2 text-xs font-semibold text-red-300 disabled:opacity-40">Reject</button></div>
        </article>
      ))}</div> : null}

      {payload ? <div className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-300"><p>Product authority: {payload.readiness.approvedProductAuthorityMediaCount} · Contextual: {payload.readiness.approvedContextualMediaCount} · Application: {payload.readiness.approvedApplicationMediaCount} · Local atmosphere: {payload.readiness.approvedLocalAtmosphereMediaCount}</p><p className="mt-1">Hero: {payload.readiness.heroAuthorityReady ? "READY" : "REQUIRED"} · Supporting: {payload.readiness.supportingProductMediaReady ? "READY" : "REQUIRED"} · Application: {payload.readiness.applicationMediaReady ? "READY" : "REQUIRED"} · Provenance: {payload.readiness.mediaProvenanceReady ? "READY" : "REQUIRED"}</p><p className="mt-1 text-zinc-500">Product fact authority remains {payload.readiness.productFactAuthorityScope.replaceAll("_", " ")}.</p></div> : null}
    </section>
  );
}