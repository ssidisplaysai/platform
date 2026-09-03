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

type ReconcilePayload = {
  campaignId: string;
  reconciledTargetCount: number;
  results: readonly {
    stateCode: string;
    jobId: string;
    action: string;
    wordpressObjectId?: string | null;
    generationStatus?: string;
    httpStatus?: number;
    error?: string;
  }[];
  publicationIntent: "draft";
  publicationPerformed: boolean;
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

type SeoRefreshRunRecord = SeoRefreshRunPayload & {
  completedAt: string;
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
  const [seoRun, setSeoRun] = useState<SeoRefreshRunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [reconciling, setReconciling] = useState(false);
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

  async function reconcileCampaign() {
    const confirmed = window.confirm(
      "Reconcile all existing running or recoverable failed draft jobs for this campaign? Exact jobs only. Publication remains blocked.",
    );

    if (!confirmed) return;

    setReconciling(true);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/glw/campaigns/${campaignId}/reconcile`, {
      method: "POST",
      headers: requestHeaders(true),
      body: JSON.stringify({ confirm: "RECONCILE_EXISTING_DRAFT_BATCH" }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null) as ReconcilePayload | null;

    if (!response.ok || !payload) {
      setError(payload?.error ?? `Campaign reconciliation failed (HTTP ${response.status}).`);
      setReconciling(false);
      return;
    }

    const draftReady = payload.results.filter((entry) => entry.action === "draft_ready").length;
    const waiting = payload.results.filter((entry) => entry.action === "wait").length;
    const failed = payload.results.filter((entry) => entry.action === "failed" || entry.action === "error" || entry.action === "continue_error").length;

    if (failed > 0) {
      const details = payload.results
        .filter((entry) => entry.action === "failed" || entry.action === "error" || entry.action === "continue_error")
        .map((entry) => `${entry.stateCode}: ${entry.error ?? entry.action}`)
        .join(" | ");
      setError(`Campaign reconciliation completed with ${draftReady} draft-ready, ${waiting} waiting, and ${failed} requiring review. ${details}`);
    } else {
      setMessage(`Campaign reconciliation complete: ${draftReady} draft-ready, ${waiting} still waiting. Publication: ${payload.publicationPerformed ? "YES" : "NO"}.`);
    }

    setReconciling(false);
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

    setSeoRun({
      ...payload,
      completedAt: new Date().toLocaleString(),
    });

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
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void reconcileCampaign()}
            disabled={loading || dispatching || reconciling || refreshingSeo}
            className="rounded-lg border border-sky-700 bg-sky-950/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-sky-200 transition hover:border-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {reconciling ? "Reconciling..." : "Reconcile Campaign"}
          </button>
          <button
            type="button"
            onClick={() => void loadScheduler()}
            disabled={loading || dispatching || reconciling || refreshingSeo}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Refreshing..." : "Refresh Preview"}
          </button>
        </div>
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
              disabled={refreshingSeo || dispatching || reconciling || seoPreview.eligibleCount < 1}
              className="rounded-lg border border-emerald-700 bg-emerald-950/30 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {refreshingSeo ? "Refreshing SEO..." : "Refresh SEO on Draft-Ready Pages"}
            </button>
          </div>
        </div>
      ) : null}

      {seoRun ? (
        <div className="mt-5 rounded-xl border border-zinc-700 bg-zinc-950/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">SEO Maintenance Results</p>
              <p className="mt-1 text-sm text-zinc-300">Last run: {seoRun.completedAt}</p>
            </div>
            <div className="flex gap-2 text-xs uppercase">
              <span className="rounded-full border border-emerald-800 px-3 py-1 text-emerald-300">Succeeded {seoRun.succeeded}</span>
              <span className="rounded-full border border-red-900 px-3 py-1 text-red-300">Failed {seoRun.failed}</span>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-zinc-800 uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-2 py-2">State</th>
                  <th className="px-2 py-2">Result</th>
                  <th className="px-2 py-2">WordPress</th>
                  <th className="px-2 py-2">Job</th>
                  <th className="px-2 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {seoRun.results.map((entry) => (
                  <tr key={`${entry.stateCode}-${entry.jobId}`} className="border-b border-zinc-900 text-zinc-300">
                    <td className="px-2 py-2 font-semibold text-white">{entry.stateCode}</td>
                    <td className={`px-2 py-2 font-semibold ${entry.ok ? "text-emerald-300" : "text-red-300"}`}>{entry.ok ? "PASS" : "FAIL"}</td>
                    <td className="px-2 py-2 font-mono text-zinc-400">{entry.wordpressObjectId ?? "—"}</td>
                    <td className="px-2 py-2 font-mono text-zinc-500">{entry.jobId}</td>
                    <td className="px-2 py-2 text-zinc-400">{entry.error ?? "SEO enrichment updated"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">Image generation: <span className="font-semibold text-white">{seoRun.imageGenerationPerformed ? "YES" : "NO"}</span></div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">Publication: <span className="font-semibold text-white">{seoRun.publicationPerformed ? "YES" : "NO"}</span></div>
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
            disabled={dispatching || reconciling || refreshingSeo || scheduler.schedule.remainingAllowance < 1 || scheduler.schedule.nextTargets.length < 1}
            className="mt-5 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {dispatching ? "Dispatching..." : "Run Next Draft Batch"}
          </button>
        </>
      ) : loading ? <p className="mt-5 text-sm text-zinc-400">Loading scheduler preview...</p> : null}
    </section>
  );
}