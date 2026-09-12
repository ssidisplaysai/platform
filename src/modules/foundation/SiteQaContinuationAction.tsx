"use client";

import { useState } from "react";

export function SiteQaContinuationAction({ site }: { site: { organizationId: string; siteId: string } }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function continueToNavigation() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(site.siteId)}/site-build`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": site.organizationId, "x-gcp-site-id": site.siteId },
        body: JSON.stringify({ confirm: "CONTINUE_TO_NAVIGATION_REVIEW" }),
      });
      const payload = await response.json() as { workspace?: { next: { route: string } }; error?: string };
      if (!response.ok || !payload.workspace) throw new Error(payload.error ?? "Navigation review could not be started.");
      location.assign(payload.workspace.next.route);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Navigation review could not be started.");
      setBusy(false);
    }
  }

  return <section className="border-l-4 border-emerald-500 bg-emerald-950/20 p-6">
    <p className="text-xs font-semibold uppercase text-emerald-300">Site QA Passed</p>
    <h2 className="mt-2 text-xl font-semibold text-white">The verified draft site is ready for navigation review.</h2>
    <p className="mt-2 text-sm text-zinc-300">Continue explicitly to review and assemble the approved site navigation. This does not change WordPress menus or publication state.</p>
    <button disabled={busy} onClick={continueToNavigation} className="mt-4 bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">{busy ? "STARTING NAVIGATION REVIEW..." : "REVIEW NAVIGATION"}</button>
    {error ? <p role="alert" className="mt-3 text-sm text-red-300">{error}</p> : null}
  </section>;
}
