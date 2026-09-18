"use client";

import React, { useState } from "react";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";
import type { RenderedVisualOwnerDecisionState } from "@/modules/foundation/rendered-visual-certification";

type OwnerDecision = Extract<RenderedVisualOwnerDecisionState, "APPROVED" | "NEEDS_FIX">;

export function GlwOwnerReviewDecisionAction(props: { endpoint: string; organizationId: string; siteId: string; currentDecision: RenderedVisualOwnerDecisionState | null }) {
  const [running, setRunning] = useState<OwnerDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const approveDisabled = running !== null || props.currentDecision === "APPROVED";
  const needsFixDisabled = running !== null || props.currentDecision === "NEEDS_FIX";
  const approveLabel = running === "APPROVED"
    ? "Approving..."
    : props.currentDecision === "APPROVED"
      ? "Approved ✓"
      : "Approve Page";
  const needsFixLabel = running === "NEEDS_FIX"
    ? "Saving..."
    : props.currentDecision === "APPROVED"
      ? "Change to Needs Fix"
      : props.currentDecision === "NEEDS_FIX"
        ? "Needs Fix ✓"
        : "Needs Fix";
  const decide = async (decision: OwnerDecision) => {
    setRunning(decision); setError(null);
    try {
      const response = await fetch(props.endpoint, { method: "POST", headers: operatorMutationHeaders({ "content-type": "application/json", "x-gcp-roles": "platform_admin", "x-gcp-organization-id": props.organizationId, "x-gcp-site-id": props.siteId }), body: JSON.stringify({ operation: "DECIDE_VISUAL_CERTIFICATION", decision }) });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Owner decision failed");
      window.location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Owner decision failed"); }
    finally { setRunning(null); }
  };
  return <div className="flex flex-wrap items-center gap-3" aria-label="Owner page decision">
    <button type="button" disabled={approveDisabled} onClick={() => decide("APPROVED")} className="bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-50">{approveLabel}</button>
    <button type="button" disabled={needsFixDisabled} onClick={() => decide("NEEDS_FIX")} className="border border-amber-600 px-4 py-2 text-sm font-bold text-amber-200 hover:border-amber-400 disabled:opacity-50">{needsFixLabel}</button>
    {props.currentDecision ? <span className="text-xs text-zinc-400">Current decision: {props.currentDecision.replaceAll("_", " ")}</span> : null}
    {error ? <p role="alert" className="w-full text-xs text-red-300">{error}</p> : null}
  </div>;
}