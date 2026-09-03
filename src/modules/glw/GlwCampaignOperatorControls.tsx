"use client";

import { useEffect, useState } from "react";

type QueueSummary = {
  total: number;
  referenceComplete: number;
  queued: number;
  running: number;
  draftReady: number;
  published: number;
  failed: number;
  skipped: number;
};

type SchedulePreview = {
  dailyLimit: number;
  alreadyDispatchedToday: number;
  remainingAllowance: number;
  nextTargets: readonly {
    targetId: string;
    stateCode: string;
    status: string;
  }[];
};

type SchedulerPayload = {
  dispatchDate: string;
  queue: QueueSummary;
  schedule: SchedulePreview;
  dryRun: boolean;
};

type DispatchPayload = {
  dispatchDate?: string;
  leasedCount?: number;
  dispatchedCount?: number;
  errorCount?: number;
  queue?: QueueSummary;
  publicationPerformed?: boolean;
  error?: string;
};

type SeoRefreshPreviewPayload = {
  campaignId: string;
  eligibleCount: number;
  eligible: readonly {
    stateCode: string;
    jobId: string;
    wordpressObjectId: string;
  }[];
  imageGenerationPerformed: boolean;
  publicationPerformed: boolean;
  error?: string;
};

type SeoRefreshRunPayload = {
  ok: boolean;
  campaignId: string;
  eligibleCount: number;
  succeeded: number;
  failed: number;
  results: readonly {
    stateCode: string;
    jobId: string;
    wordpressObjectId: string | null;
    ok: boolean;
    error?: string;
  }[];
  imageGenerationPerformed: boolean;
  publicationPerformed: boolean;
  error?: string;
};

type Props = {
  campaignId: string;
  organizationId: string;
  siteId: string;
  campaignStatus: string;
};

export function GlwCampaignOperatorControls({
  campaignId,
  organizationId,
  siteId,
  campaignStatus,
}: Props) {
  const [scheduler, setScheduler] = useState<SchedulerPayload | null>(null);
  const [seoPreview, setSeoPreview] = useState<SeoRefreshPreviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [refreshingSeo, setRefreshingSeo] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function requestHeaders(includeJson = false): HeadersInit {
    return {
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
      "x-gcp-roles": "platform_admin",
      "x-gcp-organization-id": organizationId,
      "x-gcp-site-id": siteId,
    };
  }

  async function loadScheduler() {
    setLoading(true);
    setError(null);

    const [schedulerResponse, seoResponse] = await Promise.all([
      fetch(`/api/glw/campaigns/${campaignId}/scheduler`, {
        method: "GET",
        headers: requestHeaders(),
        cache: "no-store",
      }),
      fetch(`/api/glw/campaigns/${campaignId}/seo-refresh`, {
        method: "GET",
        headers: requestHeaders(),
        cache: "no-store",
      }),
    ]);

    const schedulerPayload = await schedulerResponse.json().catch(() => null) as SchedulerPayload & { error?: string } | null;
    const seoPayload = await seoResponse.json().catch(() => null) as SeoRefreshPreviewPayload | null;

    if (!schedulerResponse.ok || !schedulerPayload) {
      setScheduler(null);
      setError(schedulerPayload?.error ?? `Unable to load scheduler preview (HTTP ${schedulerResponse.status}).`);
      setLoading(false);
      return;
    }

    setScheduler(schedulerPayload);

    if (seoResponse.ok && seoPayload) {
      setSeoPreview(seoPayload);
    } else {
      setSeoPreview(null);
    }

    setLoading(false);
  }

  useEffect(() => {
    if (campaignStatus !== "active") {
      setLoading(false);
      return;
    }

    void loadScheduler();
  }, [campaignId, campaignStatus, organizationId, siteId]);

  async function runNextBatch() {
    if (!scheduler || scheduler.schedule.remainingAllowance < 1 || scheduler.schedule.nextTargets.length < 1) {
      return;
    }

    const stateList = scheduler.schedule.nextTargets.map((target) => target.stateCode).join(", ");
    const confirmed = window.confirm(
      `Run the next draft-only GLW batch for ${stateList}? This dispatches generation jobs only. Publication remains blocked.`,
    );

    if (!confirmed) return;

    setDispatching(true);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/glw/campaigns/${campaignId}/scheduler`, {
      method: "POST",
      headers: requestHeaders(true),
      body: JSON.stringify({ confirm: "RUN_DRAFT_BATCH" }),
    });

    const payload = await response.json().catch(() => null) as DispatchPayload | null;

    if (!response.ok || !payload) {
      setError(payload?.error ?? `Draft batch dispatch failed (HTTP ${response.status}).`);
      setDispatching(false);
      return;
    }

    setMessage(
      `Draft batch dispatched: ${payload.dispatchedCount ?? 0} accepted, ${payload.errorCount ?? 0} dispatch errors. Publication performed: ${payload.publicationPerformed === true ? "yes" : "no"}.`,
    );
    setDispatching(false);
    await loadScheduler();
    window.location.reload();
  }

  async function refreshCampaignSeo() {
    if (!seoPreview || seoPreview.eligibleCount < 1) return;

    const stateList = seoPreview.eligible.map((target) => target.stateCode).join(", ");
    const confirmed = window.confirm(
      `Refresh certified SEO enrichment on ${seoPreview.eligibleCount} draft-ready pages (${stateList})? Content regeneration, image generation, and publication remain blocked.`,
    );

    if (!confirmed) return;

    setRefreshingSeo(true);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/glw/campaigns/${campaignId}/seo-refresh`, {
      method: "POST",
      headers: requestHeaders(true),
      body: JSON.stringify({ confirm: "REFRESH_CAMPAIGN_DRAFT_SEO" }),
    });

    const payload = await response.json().catch(() => null) as SeoRefreshRunPayload | null;

    if (!response.ok || !payload) {
      setError(payload?.error ?? `Campaign SEO refresh failed (HTTP ${response.status}).`);
      setRefreshingSeo(false);
      return;
    }

    const failedStates = payload.results
      .filter((entry) => !entry.ok)
      .map((entry) => `${entry.stateCode}: ${entry.error ?? "unknown error"}`);

    if (payload.failed > 0) {
      setError(
        `Campaign SEO refresh completed with ${payload.succeeded} succeeded and ${payload.failed} failed. ${failedStates.join(" | ")}`,
      );
    } else {
      setMessage(
        `Campaign SEO refresh complete: ${payload.succeeded} draft-ready pages updated. Image generation: no. Publication: no.`,
      );
    }

    setRefreshingSeo(false);
    await loadScheduler();
  }

  if (campaignStatus !== "active") return null;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-400">Operator Controls</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Draft Batch Dispatch</h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-400">
            Review today&apos;s scheduler allowance and explicitly dispatch the next bounded draft-only batch. Publication remains a separate protected action.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadScheduler()}
          disabled={loading || dispatching || refreshingSeo}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Refreshing..." : "Refresh Preview"}
        </button>
      </div>

      {error ? <p className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="mt-4 rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-300">{message}</p> : null}

      {seoPreview ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Existing Draft SEO Maintenance</p>
              <p className="mt-1 text-sm text-zinc-300">
                {seoPreview.eligibleCount > 0
                  ? `${seoPreview.eligibleCount} draft-ready pages eligible: ${seoPreview.eligible.map((target) => target.stateCode).join(", ")}`
                  : "No draft-ready pages currently require campaign SEO maintenance."}
              </p>
              <p className="mt-1 text-xs text-zinc-500">No regeneration · no image generation · no publication</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshCampaignSeo()}
              disabled={refreshingSeo || dispatching || seoPreview.eligibleCount < 1}
              className="rounded-lg border border-emerald-700 bg-emerald-950/30 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {refreshingSeo ? "Refreshing SEO..." : "Refresh SEO on Draft-Ready Pages"}
            </button>
          </div>
        </div>
      ) : null}

      {scheduler ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Dispatch Date</p><p className="mt-2 font-semibold text-white">{scheduler.dispatchDate}</p></div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Daily Limit</p><p className="mt-2 text-2xl font-bold text-white">{scheduler.schedule.dailyLimit}</p></div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Used Today</p><p className="mt-2 text-2xl font-bold text-white">{scheduler.schedule.alreadyDispatchedToday}</p></div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Remaining Allowance</p><p className="mt-2 text-2xl font-bold text-white">{scheduler.schedule.remainingAllowance}</p></div>
          </div>

          <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500">Next Targets</p>
                <p className="mt-1 text-sm text-zinc-300">{scheduler.schedule.nextTargets.length > 0 ? scheduler.schedule.nextTargets.map((target) => target.stateCode).join(", ") : "No queued targets are eligible for dispatch today."}</p>
              </div>
              <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs uppercase text-zinc-300">dry run preview</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void runNextBatch()}
            disabled={dispatching || refreshingSeo || scheduler.schedule.remainingAllowance < 1 || scheduler.schedule.nextTargets.length < 1}
            className="mt-5 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {dispatching ? "Dispatching..." : "Run Next Draft Batch"}
          </button>
        </>
      ) : loading ? <p className="mt-5 text-sm text-zinc-400">Loading scheduler preview...</p> : null}
    </section>
  );
}
