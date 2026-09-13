"use client";

import React, { useState } from "react";

export function GlwVisualReviewAction(props: { endpoint: string; organizationId: string; siteId: string; state: "NOT_CERTIFIED" | "CURRENT" | "STALE" }) {
  const [running, setRunning] = useState(false); const [error, setError] = useState<string | null>(null);
  const run = async (mode: "CURRENT" | "RECAPTURE") => {
    setRunning(true); setError(null);
    try {
      const response = await fetch(props.endpoint, { method: "POST", headers: { "content-type": "application/json", "x-gcp-roles": "ops_manager", "x-gcp-organization-id": props.organizationId, "x-gcp-site-id": props.siteId }, body: JSON.stringify({ mode }) });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Visual capture failed");
      window.location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Visual capture failed"); }
    finally { setRunning(false); }
  };
  if (props.state === "CURRENT") return <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-semibold text-emerald-300">Visual Review Current</span><button type="button" disabled={running} onClick={() => run("RECAPTURE")} className="border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 disabled:opacity-50">{running ? "Capturing..." : "Recapture"}</button>{error ? <p role="alert" className="text-xs text-red-300">{error}</p> : null}</div>;
  return <div><button type="button" disabled={running} onClick={() => run(props.state === "STALE" ? "RECAPTURE" : "CURRENT")} className="bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{running ? "Capturing desktop and mobile..." : props.state === "STALE" ? "Re-run Visual Review" : "Run Visual Review"}</button>{error ? <p role="alert" className="mt-2 text-xs text-red-300">{error}</p> : null}</div>;
}