"use client";

import Link from "next/link";
import { useState } from "react";
import type { GenerationReadinessResult } from "./site-generation-readiness";
import type { SiteGenerationReadinessCertification } from "./site-generation-readiness-repository";

type Props = {
  organizationId: string;
  siteId: string;
  siteName: string;
  readiness: GenerationReadinessResult;
  certification: SiteGenerationReadinessCertification | null;
  certificationStatus: "CURRENT" | "STALE" | "NOT_CERTIFIED";
};

const groups = ["FOUNDATION", "DIRECTION", "CONTENT_AUTHORITY", "BUILD_SAFETY"] as const;

export function SiteGenerationReadinessWorkflow(props: Props) {
  const [certification, setCertification] = useState(props.certification);
  const [status, setStatus] = useState(props.certificationStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const certified = status === "CURRENT" && certification;

  async function certify() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(props.siteId)}/generation-readiness`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": props.organizationId, "x-gcp-site-id": props.siteId },
        body: JSON.stringify({ confirm: "CERTIFY_GENERATION_READINESS" }),
      });
      const payload = await response.json() as { certification?: SiteGenerationReadinessCertification; error?: string };
      if (!response.ok || !payload.certification) throw new Error(payload.error ?? "Certification failed.");
      setCertification(payload.certification);
      setStatus("CURRENT");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Certification failed.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="space-y-6">
    <header className="border border-zinc-800 bg-zinc-950 p-6">
      <p className="text-xs font-semibold uppercase text-red-400">Generation Readiness</p>
      <h1 className="mt-2 text-2xl font-semibold text-white">Final checks before Genesis builds the site</h1>
      <p className="mt-2 max-w-3xl text-sm text-zinc-300">Passing this stage allows draft site generation; it does not enable publication.</p>
    </header>

    <div className="grid gap-4 lg:grid-cols-2">
      {groups.map((group) => <section key={group} className="border border-zinc-800 bg-zinc-950 p-5"><h2 className="text-xs font-semibold uppercase text-zinc-400">{group.replaceAll("_", " ")}</h2><ul className="mt-3 space-y-3">{props.readiness.checks.filter((check) => check.group === group).map((check) => <li key={check.key} className="flex gap-3"><span aria-hidden className={check.passed ? "text-emerald-300" : "text-amber-300"}>{check.passed ? "✓" : "!"}</span><div><p className="text-sm font-semibold text-white">{check.label}</p><p className="text-xs text-zinc-400">{check.detail}</p>{!check.passed && check.actionHref ? <Link href={check.actionHref} className="mt-1 inline-block text-xs font-semibold text-red-300 underline">Resolve this requirement</Link> : null}</div></li>)}</ul></section>)}
    </div>

    <section className={`border-l-4 p-6 ${props.readiness.readyToCertify ? "border-emerald-600 bg-emerald-950/20" : "border-amber-600 bg-amber-950/20"}`}>
      <p className="text-xs font-semibold uppercase text-zinc-300">Generation Readiness</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">{certified ? "CERTIFIED FOR SITE BUILD" : props.readiness.readyToCertify ? "READY TO BUILD" : "ACTION REQUIRED"}</h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-200">{certified ? `Generation Readiness revision ${certification.revision} is current. Site Build remains a separate owner action.` : props.readiness.readyToCertify ? `Genesis has enough approved authority and configuration to begin building ${props.siteName} in safe draft mode.` : "Complete the requirements shown above before certifying Generation Readiness."}</p>
      <p className="mt-2 text-sm font-semibold text-zinc-300">Publication remains disabled and is not required for this stage.</p>
      {status === "STALE" ? <p className="mt-3 text-sm text-amber-200">The previous certification is stale because material upstream authority changed. Review and certify the current snapshot.</p> : null}
      {certified ? <Link href={`/sites/${encodeURIComponent(props.siteId)}/build?organizationId=${encodeURIComponent(props.organizationId)}&siteId=${encodeURIComponent(props.siteId)}`} className="mt-4 inline-block bg-emerald-700 px-5 py-3 text-sm font-semibold text-white">CONTINUE TO SITE BUILD</Link> : <button type="button" disabled={!props.readiness.readyToCertify || busy} onClick={certify} className="mt-4 bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-700">{busy ? "CERTIFYING…" : status === "STALE" ? "RECERTIFY GENERATION READINESS" : "CERTIFY GENERATION READINESS"}</button>}
      {error ? <p role="alert" className="mt-3 text-sm text-red-200">{error}</p> : null}
    </section>

    <section className="border border-zinc-800 bg-zinc-950 p-5"><h2 className="text-lg font-semibold text-white">Sources of Truth</h2><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-zinc-500">Approved factual sources</dt><dd className="text-xl font-semibold text-white">{props.readiness.counts.approvedFactualSources}</dd></div><div><dt className="text-zinc-500">Owner-attested authority</dt><dd className="text-xl font-semibold text-white">{props.readiness.counts.ownerAttestedAuthority}</dd></div><div><dt className="text-zinc-500">Evidence-verified authority</dt><dd className="text-xl font-semibold text-white">{props.readiness.counts.evidenceVerifiedAuthority}</dd></div><div><dt className="text-zinc-500">Reference-only sources</dt><dd className="text-xl font-semibold text-white">{props.readiness.counts.referenceOnlySources}</dd></div><div><dt className="text-zinc-500">Publishable assets</dt><dd className="text-xl font-semibold text-white">{props.readiness.counts.publishableAssets}</dd></div><div><dt className="text-zinc-500">Non-publishable references</dt><dd className="text-xl font-semibold text-white">{props.readiness.counts.nonPublishableReferences}</dd></div></dl><p className="mt-3 text-xs text-zinc-400">Sources may support multiple offerings. Creative and reference-only material never becomes factual or publishable authority here.</p></section>
  </section>;
}