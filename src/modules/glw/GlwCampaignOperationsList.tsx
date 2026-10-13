"use client";

import React from "react";
import Link from "next/link";
import { useState } from "react";
import type { CampaignAttentionState, GlwCampaignListOperatorSummary } from "./campaign-list-operator-read-model";

type Filter = "ALL" | "ACTION_REQUIRED" | "ACTIVE" | "DRAFT_REVIEW" | "BLOCKED" | "COMPLETE";

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTION_REQUIRED", label: "Action Required" },
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT_REVIEW", label: "Draft Review" },
  { value: "BLOCKED", label: "Blocked" },
  { value: "COMPLETE", label: "Complete" },
];

const ATTENTION_STYLES: Record<CampaignAttentionState, string> = {
  ACTION_REQUIRED: "border-amber-500/50 bg-amber-500/10 text-amber-200",
  BLOCKED: "border-red-500/50 bg-red-500/10 text-red-200",
  RUNNING: "border-sky-500/50 bg-sky-500/10 text-sky-200",
  READY: "border-emerald-500/50 bg-emerald-500/10 text-emerald-200",
  COMPLETE: "border-zinc-700 bg-zinc-800/60 text-zinc-300",
};

export function matchesCampaignOperationsFilter(summary: GlwCampaignListOperatorSummary, filter: Filter): boolean {
  if (filter === "ALL") return true;
  if (filter === "ACTION_REQUIRED") return summary.attention === "ACTION_REQUIRED";
  if (filter === "ACTIVE") return !["Reference", "Authorization", "Activation", "Complete"].includes(summary.lifecycle);
  if (filter === "DRAFT_REVIEW") return summary.lifecycle === "Draft Review";
  return summary.attention === filter;
}

function Count({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return <span className="whitespace-nowrap"><strong className="text-white">{value}</strong> {label}</span>;
}

function imageLabel(state: GlwCampaignListOperatorSummary["productAuthorityImage"]): string {
  return state.replaceAll("_", " ").toLowerCase();
}

export function GlwCampaignOperationsList({ summaries }: { summaries: readonly GlwCampaignListOperatorSummary[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const visible = summaries.filter((summary) => matchesCampaignOperationsFilter(summary, filter));

  return <section aria-labelledby="campaign-operations-heading">
    <div className="flex flex-col gap-4 border-b border-zinc-800 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-red-400">Genesis Operations</p>
        <h2 id="campaign-operations-heading" className="mt-2 text-xl font-bold text-white">Campaign Control Surface</h2>
      </div>
      <div className="flex max-w-full gap-1 overflow-x-auto pb-1" aria-label="Campaign filters">
        {FILTERS.map((item) => <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={`whitespace-nowrap border px-3 py-2 text-xs font-semibold ${filter === item.value ? "border-red-500 bg-red-500/10 text-white" : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-white"}`}>{item.label}</button>)}
      </div>
    </div>

    <div className="divide-y divide-zinc-800">
      {visible.map((summary) => <article key={summary.campaignId} className="grid gap-4 py-5 xl:grid-cols-[minmax(15rem,1.4fr)_minmax(10rem,0.8fr)_minmax(14rem,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-1 text-[11px] font-semibold uppercase ${ATTENTION_STYLES[summary.attention]}`}>{summary.attention.replace("_", " ")}</span>
            <span className="text-xs font-semibold uppercase text-zinc-400">{summary.lifecycle}</span>
          </div>
          <Link href={summary.href} className="mt-2 block break-words text-base font-semibold text-white hover:text-red-300">{summary.name}</Link>
          <p className="mt-1 break-words text-sm text-zinc-400">{summary.organizationId.toUpperCase()} · {summary.siteName}{summary.domain ? ` · ${summary.domain}` : ""}</p>
          <p className="mt-1 text-xs text-zinc-500">{summary.productName} · {summary.scope}</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Progress</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-300">
            <Count label="reference" value={summary.counts.referenceComplete} />
            <Count label="queued" value={summary.counts.queued} />
            <Count label="running" value={summary.counts.running} />
            <Count label="content ready" value={summary.counts.contentReady} />
            <Count label="draft ready" value={summary.counts.draftReady} />
            <Count label="failed" value={summary.counts.failed} />
            <Count label="published" value={summary.counts.published} />
          </div>
          <p className="mt-3 text-xs text-zinc-400">{summary.executionReadiness === "NOT_REQUIRED" ? "Execution not required" : `Execution ${summary.executionReadiness.toLowerCase()}`}</p>
          <p className="mt-1 text-xs text-zinc-500">{summary.capabilityDetails.join(" · ")}</p>
          <p className="mt-1 text-xs text-zinc-500">{summary.policy} · Images {summary.imagePackage.toLowerCase()}</p>
          <p className="mt-1 text-xs text-zinc-600">Product {imageLabel(summary.productAuthorityImage)} · In-use {imageLabel(summary.contextualInUseImage)}</p>
        </div>

        <div className="min-w-0 border-l-2 border-red-600 pl-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Next</p>
          <p className="mt-1 font-semibold text-white">{summary.nextAction}</p>
          {summary.nextTarget ? <p className="mt-1 text-xs text-zinc-400">Next target: {summary.nextTarget}</p> : null}
          {summary.blocker ? <div className="mt-3 text-xs"><p className="font-semibold text-red-300">{summary.blocker.what}</p><p className="mt-1 text-zinc-400">{summary.blocker.why}</p><p className="mt-1 text-zinc-300">Safe next step: {summary.blocker.safeNextStep}</p></div> : null}
        </div>

        <Link href={summary.href} className="inline-flex h-10 items-center justify-center border border-zinc-700 px-4 text-xs font-semibold uppercase tracking-wider text-zinc-200 hover:border-red-500 hover:text-white">Open campaign</Link>
        <p className="truncate text-[11px] text-zinc-700 xl:col-span-4" title={summary.campaignId}>ID {summary.campaignId}</p>
      </article>)}
      {visible.length === 0 ? <p className="py-8 text-sm text-zinc-400">No campaigns match this view.</p> : null}
    </div>
  </section>;
}