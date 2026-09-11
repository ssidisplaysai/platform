"use client";

import { useState } from "react";
import type { SiteBuildSession } from "./site-generation-readiness-repository";

export function SiteBuildWorkflow(props: { organizationId: string; siteId: string; certificationId: string; initialSession: SiteBuildSession | null }) {
  const [session, setSession] = useState(props.initialSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function start() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(props.siteId)}/site-build`, { method: "POST", headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": props.organizationId, "x-gcp-site-id": props.siteId }, body: JSON.stringify({ confirm: "START_SITE_BUILD", certificationId: props.certificationId }) });
      const payload = await response.json() as { session?: SiteBuildSession; error?: string };
      if (!response.ok || !payload.session) throw new Error(payload.error ?? "Unable to start Site Build.");
      setSession(payload.session);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to start Site Build."); } finally { setBusy(false); }
  }
  return <section className="border border-zinc-800 bg-zinc-950 p-6"><p className="text-xs font-semibold uppercase text-red-400">Site Build</p><h1 className="mt-2 text-2xl font-semibold text-white">Bounded draft site build</h1><p className="mt-2 max-w-3xl text-sm text-zinc-300">Starting this workflow records owner intent only. It does not create WordPress pages, publish content, or enable the site.</p>{session ? <div className="mt-5 border border-emerald-800 bg-emerald-950/20 p-4"><h2 className="font-semibold text-white">SITE BUILD STARTED</h2><p className="mt-1 text-sm text-zinc-300">Build session {session.buildSessionId} is ready for later bounded draft-generation steps.</p></div> : <button type="button" disabled={busy} onClick={start} className="mt-5 bg-red-600 px-5 py-3 text-sm font-semibold text-white disabled:bg-zinc-700">{busy ? "STARTING…" : "START SITE BUILD"}</button>}{error ? <p role="alert" className="mt-3 text-sm text-red-200">{error}</p> : null}</section>;
}