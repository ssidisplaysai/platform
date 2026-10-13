"use client";

import Link from "next/link";
import { useState } from "react";

export function SiteVisualPropagationAction({ site, summary }: {
  site: { organizationId: string; siteId: string };
  summary: { expected: number; assembled: number; readyForOwnerReview: number; blocked: number };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = `/sites/${encodeURIComponent(site.siteId)}/build/designs?organizationId=${encodeURIComponent(site.organizationId)}&siteId=${encodeURIComponent(site.siteId)}`;

  if (summary.assembled === summary.expected && summary.expected > 0) {
    return <section className="border-l-4 border-red-600 bg-red-950/20 p-5">
      <p className="text-xs font-semibold uppercase text-red-300">Site Visual Review</p>
      <h2 className="mt-2 text-xl font-semibold text-white">{summary.assembled} page designs assembled</h2>
      <p className="mt-2 text-sm text-zinc-300">Review each rendered page design. No design is auto-approved and publication remains disabled.</p>
      <Link href={href} className="mt-4 inline-block bg-red-600 px-5 py-3 text-sm font-semibold text-white">REVIEW SITE DESIGNS</Link>
    </section>;
  }

  async function assemble() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(site.siteId)}/site-build`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": site.organizationId, "x-gcp-site-id": site.siteId },
        body: JSON.stringify({ confirm: "ASSEMBLE_REMAINING_VISUALS" }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Visual assembly failed.");
      location.assign(href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Visual assembly failed.");
      setBusy(false);
    }
  }

  return <section className="border-l-4 border-red-600 bg-red-950/20 p-5">
    <p className="text-xs font-semibold uppercase text-red-300">Approved Home Design System</p>
    <h2 className="mt-2 text-xl font-semibold text-white">Assemble the remaining {summary.expected} page designs</h2>
    <p className="mt-2 text-sm text-zinc-300">Use approved Home visual revision 2 with the approved content and image for each page. Existing WordPress drafts stay unpublished.</p>
    <button disabled={busy} onClick={assemble} className="mt-4 bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "ASSEMBLING PAGE DESIGNS..." : "ASSEMBLE REMAINING PAGE DESIGNS"}</button>
    {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
  </section>;
}
