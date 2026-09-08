"use client";

import React from "react";
import type {
  GlwCampaignLaunchRequest,
  GlwCampaignLaunchResult,
  GlwLaunchStatusCounts,
  GlwLaunchUiState,
} from "./campaign-launch-contract";
import { presentGlwLaunchResult } from "./campaign-launch-contract";

const PROGRESS_COPY: Partial<Record<GlwLaunchUiState, string>> = {
  REVALIDATING: "Revalidating campaign...",
  CREATING_CAMPAIGN: "Creating campaign...",
  RESERVING_TARGETS: "Reserving targets...",
  REFERENCE_BOOTSTRAP: "Preparing reference page...",
  STARTING: "Starting campaign...",
};

export function CampaignLaunchConfirmation({
  request,
  siteName,
  productName,
  maximumSafeReach,
  onCancel,
  onConfirm,
}: {
  request: GlwCampaignLaunchRequest;
  siteName: string;
  productName: string;
  maximumSafeReach: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="launch-confirmation-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-4 sm:items-center">
      <section className="w-full max-w-lg border border-zinc-700 bg-zinc-950 p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.25em] text-red-400">Confirm Campaign</p>
        <h2 id="launch-confirmation-title" className="mt-2 text-xl font-semibold text-white">Launch {request.selectedTargets.length} pages for {productName}?</h2>
        <dl className="mt-5 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 text-sm">
          <dt className="text-zinc-500">Site</dt><dd className="text-right text-zinc-100">{siteName}</dd>
          <dt className="text-zinc-500">Product</dt><dd className="text-right text-zinc-100">{productName}</dd>
          <dt className="text-zinc-500">Desired reach</dt><dd className="text-right text-zinc-100">{request.reach.replaceAll("_", " ")}</dd>
          <dt className="text-zinc-500">Selected targets</dt><dd className="text-right text-zinc-100">{request.selectedTargets.length}</dd>
          <dt className="text-zinc-500">Maximum safe reach</dt><dd className="text-right text-zinc-100">{maximumSafeReach}</dd>
          <dt className="text-zinc-500">Publication policy</dt><dd className="text-right text-zinc-100">{request.acknowledgedPublicationPolicy}</dd>
        </dl>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} className="min-h-11 border border-zinc-700 px-4 text-sm text-zinc-200">Cancel</button>
          <button type="button" onClick={onConfirm} className="min-h-11 bg-red-600 px-5 text-sm font-semibold text-white">Launch Campaign</button>
        </div>
      </section>
    </div>
  );
}

export function CampaignLaunchProgress({ state }: { state: GlwLaunchUiState }) {
  return (
    <section role="status" className="border border-red-500/40 bg-red-950/20 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-red-400">Campaign Launch</p>
      <p className="mt-2 text-base font-semibold text-white">{PROGRESS_COPY[state] ?? "Preparing campaign..."}</p>
      <div className="mt-4 h-1 overflow-hidden bg-zinc-800"><div className="h-full w-2/3 animate-pulse bg-red-500" /></div>
    </section>
  );
}

export function CampaignStatusPanel({ counts }: { counts?: Partial<GlwLaunchStatusCounts> }) {
  const values: GlwLaunchStatusCounts = { researching: null, generating: null, qa: null, draft: null, review: null, published: null, failed: null, ...counts };
  return (
    <section aria-label="Campaign status" className="border-t border-zinc-700 pt-5">
      <h3 className="text-sm font-semibold text-white">Campaign status</h3>
      <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden bg-zinc-800 sm:grid-cols-4 lg:grid-cols-7">
        {Object.entries(values).map(([label, count]) => <div key={label} className="bg-zinc-950 p-3"><p className="text-xs capitalize text-zinc-500">{label}</p><p className="mt-1 text-lg font-semibold text-white">{count ?? "Unavailable"}</p></div>)}
      </div>
    </section>
  );
}

export function CampaignLaunchOutcome({ result, productName, reach, onAnalyzeAgain, onStartAnother }: {
  result: GlwCampaignLaunchResult;
  productName: string;
  reach: string;
  onAnalyzeAgain: () => void;
  onStartAnother: () => void;
}) {
  const presentation = presentGlwLaunchResult(result);
  const attention = presentation.uiState === "FAILED" || presentation.uiState === "RECOVERY_REQUIRED" || presentation.uiState === "REVIEW_REQUIRED";
  return (
    <section className={`space-y-5 border p-5 ${attention ? "border-amber-500/50 bg-amber-950/20" : "border-emerald-500/50 bg-emerald-950/20"}`}>
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-zinc-500">Campaign Launch</p>
        <h2 className="mt-2 text-xl font-semibold text-white">{presentation.heading}</h2>
        <p className="mt-2 text-sm text-zinc-300">{presentation.message}</p>
      </div>
      {result.campaignId ? (
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 text-sm">
          <dt className="text-zinc-500">Product</dt><dd className="text-right text-white">{productName}</dd>
          <dt className="text-zinc-500">Reach</dt><dd className="text-right text-white">{reach.replaceAll("_", " ")}</dd>
          <dt className="text-zinc-500">Targets</dt><dd className="text-right text-white">{result.selectedTargetCount}</dd>
          <dt className="text-zinc-500">Publication policy</dt><dd className="text-right text-white">{result.publicationPolicy}</dd>
          <dt className="text-zinc-500">Campaign ID</dt><dd className="max-w-xs break-all text-right text-white">{result.campaignId}</dd>
          <dt className="text-zinc-500">Current state</dt><dd className="text-right text-white">{result.campaignState ?? "UNKNOWN"}</dd>
          {result.referenceTarget ? <><dt className="text-zinc-500">Reference target</dt><dd className="text-right text-white">{result.referenceTarget.cityName}, {result.referenceTarget.stateCode}</dd></> : null}
          {result.referenceState ? <><dt className="text-zinc-500">Reference state</dt><dd className="text-right text-white">{result.referenceState.replaceAll("_", " ")}</dd></> : null}
          {result.recoveryState ? <><dt className="text-zinc-500">Recovery state</dt><dd className="text-right text-white">{result.recoveryState.replaceAll("_", " ")}</dd></> : null}
        </dl>
      ) : null}
      {result.blockers.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-amber-200">Launch blockers</h3>
          <ul className="mt-2 space-y-2">{result.blockers.map((blocker) => <li key={`${blocker.code}-${blocker.target.canonicalPath}`} className="border border-amber-700/40 p-3 text-sm text-amber-100"><p>{blocker.message}</p><p className="mt-1 text-xs text-amber-300/70">{blocker.target.cityName}, {blocker.target.stateCode}{blocker.owningCampaignId ? ` / Campaign ${blocker.owningCampaignId}` : ""}{blocker.targetState ? ` / ${blocker.targetState}` : ""}</p></li>)}</ul>
        </section>
      ) : null}
      {result.campaignId ? <CampaignStatusPanel counts={result.state === "REFERENCE_REVIEW_REQUIRED" ? { review: 1 } : undefined} /> : null}
      <div className="flex flex-wrap gap-3">
        {!presentation.durable ? <button type="button" onClick={onAnalyzeAgain} className="min-h-11 bg-red-600 px-4 text-sm font-semibold text-white">Analyze Again</button> : null}
        {presentation.durable ? <button type="button" onClick={onStartAnother} className="min-h-11 border border-zinc-700 px-4 text-sm text-zinc-200">Start Another Campaign</button> : null}
      </div>
    </section>
  );
}