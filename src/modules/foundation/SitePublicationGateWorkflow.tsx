"use client";

import Link from "next/link";
import { useState } from "react";

export function SitePublicationGateWorkflow({ mode, site, summary, authorized, nextRoute }: { mode: "READINESS" | "AUTHORIZATION"; site: { organizationId: string; siteId: string }; summary: { drafts: number; designs: number; media: number; navigationItems: number }; authorized?: boolean; nextRoute?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(site.siteId)}/site-build`, { method: "POST", headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": site.organizationId, "x-gcp-site-id": site.siteId }, body: JSON.stringify({ confirm: mode === "READINESS" ? "CONFIRM_PUBLICATION_READINESS" : "AUTHORIZE_PUBLICATION" }) });
      const payload = await response.json() as { workspace?: { next: { route: string } }; error?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.error ?? "Publication gate action failed.");
      location.assign(payload.workspace.next.route);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Publication gate action failed.");
      setBusy(false);
    }
  }

  return <section className="space-y-6">
    <header className="border border-zinc-800 bg-zinc-950 p-6"><p className="text-xs font-semibold uppercase text-red-400">{mode === "READINESS" ? "Publication Readiness" : "Publication Authorization"}</p><h1 className="mt-2 text-2xl font-semibold text-white">{mode === "READINESS" ? "Review the complete launch boundary" : "Explicit owner authorization"}</h1><p className="mt-2 text-sm text-zinc-300">{mode === "READINESS" ? "Confirm the approved draft site and navigation are ready to proceed to owner authorization." : "Authorization records owner consent only. It does not publish pages, menus, or enable the site."}</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-5"><div><dt className="text-zinc-500">Drafts</dt><dd className="text-white">{summary.drafts}</dd></div><div><dt className="text-zinc-500">Designs</dt><dd className="text-white">{summary.designs}</dd></div><div><dt className="text-zinc-500">Media</dt><dd className="text-white">{summary.media}</dd></div><div><dt className="text-zinc-500">Navigation</dt><dd className="text-white">{summary.navigationItems} items</dd></div><div><dt className="text-zinc-500">Publication</dt><dd className="text-amber-300">DISABLED</dd></div></dl></header>
    <section className="border-l-4 border-red-600 bg-red-950/20 p-5"><p className="text-xs font-semibold uppercase text-red-300">Explicit Owner Gate</p>{authorized ? <><h2 className="mt-2 text-xl font-semibold text-white">Publication authorization recorded</h2><p className="mt-2 text-sm text-zinc-300">The approved launch boundary is ready for an exact mutation review. The site and all WordPress pages remain unpublished.</p>{nextRoute ? <Link href={nextRoute} className="mt-4 inline-block bg-red-600 px-5 py-3 text-sm font-semibold text-white">REVIEW PUBLICATION EXECUTION</Link> : null}</> : <><h2 className="mt-2 text-xl font-semibold text-white">{mode === "READINESS" ? "Continue to publication authorization" : "Authorize future publication execution"}</h2><button disabled={busy} onClick={act} className="mt-4 bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "RECORDING..." : mode === "READINESS" ? "REQUEST PUBLICATION AUTHORIZATION" : "AUTHORIZE PUBLICATION"}</button></>}{error ? <p role="alert" className="mt-3 text-red-300">{error}</p> : null}</section>
  </section>;
}
