"use client";

import { useEffect, useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";
import type { GlwReferenceMediaAuthority } from "./reference-media-authority";

export function GlwReferenceGoLiveReadiness(props: {
  record: GlwReferenceMediaAuthority;
}) {
  const [authenticated, setAuthenticated] = useState(false);
  const [record, setRecord] = useState(props.record);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch("/api/operator-session", { cache: "no-store" })
      .then((response) => { if (active) setAuthenticated(response.ok); })
      .catch(() => { if (active) setAuthenticated(false); });
    return () => { active = false; };
  }, []);

  async function approveMedia() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/glw/campaigns/${encodeURIComponent(record.campaignId)}/reference-media-authority`, {
        method: "POST",
        headers: operatorMutationHeaders({
          "Content-Type": "application/json",
          "x-gcp-organization-id": record.organizationId,
          "x-gcp-site-id": record.siteId,
        }),
        body: JSON.stringify({
          action: "APPROVE_REFERENCE_MEDIA",
          stateCode: record.stateCode,
          wordpressMediaId: record.wordpressMediaId,
          expectedLineageFingerprint: record.lineageFingerprint,
        }),
      });
      const payload = await response.json() as { record?: GlwReferenceMediaAuthority; error?: string };
      if (!response.ok || !payload.record) {
        setMessage(payload.error ?? "Media approval failed closed.");
        return;
      }
      setRecord(payload.record);
      setMessage("California reference media approved for this exact campaign and media object.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-zinc-800 bg-zinc-900/50 p-6" aria-label="California reference go-live readiness">
      <p className="text-xs font-semibold uppercase tracking-wider text-red-400">California Reference Readiness</p>
      <h2 className="mt-2 text-lg font-semibold text-white">Media and host certification</h2>
      <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[13rem_1fr]">
        <dt className="text-zinc-500">Reference media</dt><dd className="text-zinc-200">WordPress media {record.wordpressMediaId}</dd>
        <dt className="text-zinc-500">Provenance</dt><dd className="text-emerald-300">Genesis generated media · bounded lineage proven</dd>
        <dt className="text-zinc-500">Owner approval</dt><dd className={record.ownerApprovalStatus === "APPROVED" ? "text-emerald-300" : "text-amber-300"}>{record.ownerApprovalStatus === "APPROVED" ? "APPROVED" : "OWNER APPROVAL REQUIRED"}</dd>
        <dt className="text-zinc-500">Draft host certification</dt><dd className="text-amber-300">BLOCKED · WordPress browser-preview session authority unavailable</dd>
      </dl>
      <details className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-400">
        <summary className="cursor-pointer text-zinc-300">Lineage evidence</summary>
        <ul className="mt-2 space-y-1">{record.provenanceEvidence.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul>
        <p className="mt-2">Limits: {record.lineageLimitations.join(" ")}</p>
      </details>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={!authenticated || busy || record.ownerApprovalStatus === "APPROVED"} onClick={() => void approveMedia()} className="border border-red-600 px-3 py-2 text-xs font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-40">
          {busy ? "Approving..." : "Approve CA Media 15338"}
        </button>
        <button type="button" disabled className="border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-500">
          Run Authenticated Draft Host Certification
        </button>
      </div>
      {!authenticated ? <p className="mt-2 text-xs text-amber-300">Sign in with a server-verified Genesis operator session to approve media.</p> : null}
      {message ? <p className="mt-2 text-xs text-amber-300">{message}</p> : null}
    </section>
  );
}