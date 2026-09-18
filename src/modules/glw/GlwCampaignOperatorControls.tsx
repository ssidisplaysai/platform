"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { operatorMutationHeaders } from "@/modules/foundation/operator-session-client";
import {
  runExactTargetDispatchFlow,
  type ExactDispatchStage,
} from "@/modules/glw/exact-target-dispatch-ui-flow";
import { summarizeCampaignReconciliation } from "@/modules/glw/campaign-reconciliation-ui-summary";

type QueueSummary = {
  total: number;
  referenceComplete: number;
  queued: number;
  running: number;
  contentReady: number;
  draftReady: number;
  published: number;
  failed: number;
  skipped: number;
};

type ContinuableTargetSummary = {
  targetId: string;
  identity: string;
  lifecycleState: string;
  jobId: string | null;
  executionId: string | null;
  wordpressObjectId: string | null;
};

type SchedulePreview = {
  dailyLimit: number;
  maxConcurrentExecution: number;
  availableConcurrency: number;
  alreadyDispatchedToday: number;
  remainingAllowance: number;
  nextTargets: readonly {
    targetId: string;
    stateCode: string;
    citySlug: string | null;
    cityName: string | null;
    status: string;
  }[];
};

type SchedulerPayload = {
  dispatchDate: string;
  queue: QueueSummary;
  schedule: SchedulePreview;
  executionReadiness: {
    configured: boolean;
    urlConfigured: boolean;
    tokenConfigured: boolean;
    transport: "N8N_MCP";
  };
  releaseAuthority: { runningReleaseSha: string | null; capability: { ready: boolean; status: string } };
  wordpressReadiness: { ready: boolean };
  executionPreflight: { ready: boolean };
  dispatchPreflight: {
    preflightReceiptId: string;
    targetId: string;
    targetFingerprint: string;
    runtimeSha: string;
    createdAt: string;
    expiresAt: string;
    publicationPolicy: string;
  } | null;
  ownerAuthorizationRequired: true;
  dryRun: boolean;
};

type ReconcilePayload = {
  campaignId: string;
  reconciledTargetCount: number;
  results: readonly {
    stateCode: string;
    citySlug: string | null;
    cityName: string | null;
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

type PublishPreviewPayload = {
  campaignId: string;
  eligibleCount: number;
  eligible: readonly {
    stateCode: string;
    wordpressObjectId: string;
    jobId: string | null;
  }[];
  publicationPerformed: boolean;
  policyBlocked?: boolean;
  policyReason?: string;
  error?: string;
};

type PublishRunPayload = {
  ok: boolean;
  campaignId: string;
  attempted: number;
  succeeded: number;
  failed: number;
  results: readonly {
    stateCode: string;
    wordpressObjectId: string;
    wordpressUrl?: string;
    ok: boolean;
    error?: string;
    state?: string;
  }[];
  queue?: QueueSummary;
  publicationPerformed: boolean;
  error?: string;
};

type PublishRunRecord = PublishRunPayload & {
  completedAt: string;
};

type SeoRefreshPreviewPayload = {
  campaignId: string;
  eligibleCount: number;
  eligible: readonly {
    stateCode: string;
    citySlug?: string | null;
    cityName?: string | null;
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
    citySlug: string | null;
    cityName: string | null;
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
  principalId: string;
  targets: readonly ContinuableTargetSummary[];
};

export function GlwCampaignOperatorControls({
  campaignId,
  organizationId,
  siteId,
  campaignStatus,
  targets,
}: Props) {
  const router = useRouter();
  const [scheduler, setScheduler] = useState<SchedulerPayload | null>(null);
  const [publishPreview, setPublishPreview] = useState<PublishPreviewPayload | null>(null);
  const [publishRun, setPublishRun] = useState<PublishRunRecord | null>(null);
  const [seoPreview, setSeoPreview] = useState<SeoRefreshPreviewPayload | null>(null);
  const [seoRun, setSeoRun] = useState<SeoRefreshRunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchStage, setDispatchStage] = useState<ExactDispatchStage>("IDLE");
  const dispatchInFlight = useRef(false);
  const [reconciling, setReconciling] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [refreshingSeo, setRefreshingSeo] = useState(false);
  const [enablingReleaseCapability, setEnablingReleaseCapability] = useState(false);
  const [continuingTarget, setContinuingTarget] = useState(false);
  const [selectedContinuationTargetId, setSelectedContinuationTargetId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestHeaders = useCallback((includeJson = false): HeadersInit => {
    const headers = {
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
      "x-gcp-organization-id": organizationId,
      "x-gcp-site-id": siteId,
    };
    return includeJson ? operatorMutationHeaders(headers) : headers;
  }, [organizationId, siteId]);

  const loadScheduler = useCallback(async () => {
    setLoading(true);

    const [schedulerResponse, seoResponse, publishResponse] = await Promise.all([
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
      fetch(`/api/glw/campaigns/${campaignId}/publish`, {
        method: "GET",
        headers: requestHeaders(),
        cache: "no-store",
      }),
    ]);

    const schedulerPayload = await schedulerResponse.json().catch(() => null) as SchedulerPayload & { error?: string } | null;
    const seoPayload = await seoResponse.json().catch(() => null) as SeoRefreshPreviewPayload | null;
    const publishPayload = await publishResponse.json().catch(() => null) as PublishPreviewPayload | null;

    if (!schedulerResponse.ok || !schedulerPayload) {
      setScheduler(null);
      setError(schedulerPayload?.error ?? `Unable to load scheduler preview (HTTP ${schedulerResponse.status}).`);
      setLoading(false);
      return;
    }

    setScheduler(schedulerPayload);
    setSeoPreview(seoResponse.ok && seoPayload ? seoPayload : null);
    setPublishPreview(publishResponse.ok && publishPayload ? publishPayload : null);
    setError(null);
    setLoading(false);
  }, [campaignId, requestHeaders]);

  const refreshWorkspace = useCallback(async () => {
    await loadScheduler();
    router.refresh();
  }, [loadScheduler, router]);

  useEffect(() => {
    if (campaignStatus !== "active") return;
    const timeout = window.setTimeout(() => void loadScheduler(), 0);
    return () => window.clearTimeout(timeout);
  }, [campaignStatus, loadScheduler]);

  useEffect(() => {
    const firstContinuable = targets.find((target) =>
      target.lifecycleState === "content_ready"
      && Boolean(target.jobId)
      && Boolean(target.executionId)
      && !target.wordpressObjectId,
    );
    setSelectedContinuationTargetId((current) => current || firstContinuable?.targetId || "");
  }, [targets]);

  const continuableTargets = targets.filter((target) =>
    target.lifecycleState === "content_ready"
    && Boolean(target.jobId)
    && Boolean(target.executionId)
    && !target.wordpressObjectId,
  );

  async function authorizeAndDispatchExactTarget() {
    if (!scheduler || dispatchInFlight.current) return;
    dispatchInFlight.current = true;
    setDispatching(true);
    setMessage(null);
    setError(null);
    try {
      const result = await runExactTargetDispatchFlow({
        campaignId,
        organizationId,
        siteId,
        scheduler,
        requestHeaders,
        confirm: (confirmation) => window.confirm(confirmation),
        onStage: setDispatchStage,
        onSchedulerRefreshed: (refreshed) => setScheduler(refreshed as SchedulerPayload),
      });
      if (!result.accepted) {
        setDispatchStage("READY TO AUTHORIZE");
        return;
      }
      const payload = result.payload;
      setMessage(`Exact target dispatch submitted: ${payload.dispatchedCount ?? 0} accepted, ${payload.errorCount ?? 0} dispatch errors. Publication performed: ${payload.publicationPerformed === true ? "yes" : "no"}.`);
      await refreshWorkspace();
    } catch (flowError) {
      setError(flowError instanceof Error ? flowError.message : "Exact-target dispatch failed.");
      setDispatchStage("IDLE");
    } finally {
      setDispatching(false);
      dispatchInFlight.current = false;
    }
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

    const summary = summarizeCampaignReconciliation(payload.results);
    if (summary.requiresAttention) {
      setError(summary.message);
    } else {
      setMessage(`${summary.message} Publication: ${payload.publicationPerformed ? "YES" : "NO"}.`);
    }

    setReconciling(false);
    await refreshWorkspace();
  }

  async function continueContentReadyTarget() {
    const target = continuableTargets.find((entry) => entry.targetId === selectedContinuationTargetId) ?? null;
    if (!target || !target.jobId || !target.executionId) return;

    const confirmed = window.confirm(
      `Continue ${target.identity} to governed WordPress draft using existing job ${target.jobId} and execution ${target.executionId}? No dispatch will be consumed.`,
    );
    if (!confirmed) return;

    setContinuingTarget(true);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/glw/campaigns/${campaignId}/reconcile`, {
      method: "POST",
      headers: requestHeaders(true),
      body: JSON.stringify({
        confirm: "RECONCILE_EXISTING_DRAFT_BATCH",
        targetId: target.targetId,
        jobId: target.jobId,
        executionId: target.executionId,
      }),
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null) as ReconcilePayload | { error?: string; results?: ReconcilePayload["results"] } | null;

    if (!response.ok || !payload) {
      setError(payload && "error" in payload ? (payload.error ?? `Continue to WordPress draft failed (HTTP ${response.status}).`) : `Continue to WordPress draft failed (HTTP ${response.status}).`);
      setContinuingTarget(false);
      return;
    }

    const result = Array.isArray(payload.results) ? payload.results[0] : null;
    if (!result || (result.action !== "draft_ready" && result.action !== "wait")) {
      setError(result?.error ?? "Continuation did not produce a draft-ready reconciliation result.");
      setContinuingTarget(false);
      await refreshWorkspace();
      return;
    }

    if (result.action === "draft_ready") {
      setMessage(`Continued ${target.identity} to WordPress draft${result.wordpressObjectId ? ` #${result.wordpressObjectId}` : ""} using existing job ${target.jobId}.`);
    } else {
      setError(result.error ?? `${target.identity} continuation is still waiting on exact execution completion.`);
    }

    setContinuingTarget(false);
    await refreshWorkspace();
  }

  async function publishDraftReady() {
    if (!publishPreview || publishPreview.eligibleCount < 1) return;

    const states = publishPreview.eligible.map((entry) => entry.stateCode);
    const confirmed = window.confirm(
      `Publish ${states.length} exact draft-ready campaign pages now?\n\n${states.join(", ")}\n\nOnly these persisted draft-ready WordPress objects will be eligible.`,
    );
    if (!confirmed) return;

    setPublishing(true);
    setPublishRun(null);
    setMessage(null);
    setError(null);

    const response = await fetch(`/api/glw/campaigns/${campaignId}/publish`, {
      method: "POST",
      headers: requestHeaders(true),
      body: JSON.stringify({
        confirm: "PUBLISH_DRAFT_READY_CAMPAIGN_TARGETS",
        stateCodes: states,
      }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as PublishRunPayload | null;

    if (!response.ok || !payload) {
      setError(payload?.error ?? `Campaign publication failed (HTTP ${response.status}).`);
      setPublishing(false);
      return;
    }

    setPublishRun({
      ...payload,
      completedAt: new Date().toLocaleString(),
    });

    if (payload.failed > 0) {
      const details = payload.results
        .filter((entry) => !entry.ok)
        .map((entry) => `${entry.stateCode}: ${entry.error ?? entry.state ?? "publish failed"}`)
        .join(" | ");
      setError(`Campaign publication completed with ${payload.succeeded} published and ${payload.failed} failed. ${details}`);
    } else {
      setMessage(`Campaign publication complete: ${payload.succeeded} exact draft-ready pages published.`);
    }

    setPublishing(false);
    await refreshWorkspace();
  }

  async function refreshCampaignSeo() {
    if (!seoPreview || seoPreview.eligibleCount < 1) return;

    const stateList = seoPreview.eligible.map((target) => target.cityName ? `${target.cityName}, ${target.stateCode}` : target.stateCode).join(", ");
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

    setSeoRun({ ...payload, completedAt: new Date().toLocaleString() });
    const failedStates = payload.results.filter((entry) => !entry.ok).map((entry) => `${entry.stateCode}: ${entry.error ?? "unknown error"}`);

    if (payload.failed > 0) {
      setError(`Campaign SEO refresh completed with ${payload.succeeded} succeeded and ${payload.failed} failed. ${failedStates.join(" | ")}`);
    } else {
      setMessage(`Campaign SEO refresh complete: ${payload.succeeded} draft-ready pages updated. Image generation: no. Publication: no.`);
    }

    setRefreshingSeo(false);
    await refreshWorkspace();
  }

  async function enableRunningReleaseCapability() {
    if (!scheduler?.releaseAuthority.runningReleaseSha) return;
    setEnablingReleaseCapability(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/glw/release-capabilities/campaign-activation", {
      method: "POST",
      headers: requestHeaders(true),
      body: JSON.stringify({
        operation: "ENABLE_RELEASE_CAPABILITY",
        capabilityOperation: "GLW_CAMPAIGN_ACTIVATION",
        releaseSha: scheduler.releaseAuthority.runningReleaseSha,
      }),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as { error?: string; capability?: { releaseSha?: string } } | null;

    if (!response.ok) {
      setError(payload?.error ?? `Release capability enablement failed (HTTP ${response.status}).`);
      setEnablingReleaseCapability(false);
      return;
    }

    setMessage(`Release capability enabled for running SHA ${payload?.capability?.releaseSha ?? scheduler.releaseAuthority.runningReleaseSha}.`);
    setEnablingReleaseCapability(false);
    await refreshWorkspace();
  }

  if (campaignStatus !== "active") return null;

  const busy = loading || dispatching || reconciling || publishing || refreshingSeo || enablingReleaseCapability || continuingTarget;
  const hasContentReady = (scheduler?.queue.contentReady ?? 0) > 0;
  const hasRunningOrFailed = (scheduler?.queue.running ?? 0) + (scheduler?.queue.failed ?? 0) > 0;

  return (
    <section id="campaign-actions" className="border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-400">Owner Actions</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Campaign Controls</h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-400">The primary action follows the current lifecycle stage. Maintenance and publication remain separate.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void reconcileCampaign()} disabled={busy || !scheduler || !hasRunningOrFailed} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40">
            {reconciling ? "Reconciling..." : "Reconcile Campaign"}
          </button>
          <button type="button" onClick={() => void continueContentReadyTarget()} disabled={busy || !scheduler || !hasContentReady || !selectedContinuationTargetId} className="rounded-lg border border-red-700 bg-red-950/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-red-200 transition hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-40">
            {continuingTarget ? "Continuing..." : "Continue to WordPress Draft"}
          </button>
          <button type="button" onClick={() => void refreshWorkspace()} disabled={busy} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40">
            {loading ? "Refreshing..." : "Refresh Preview"}
          </button>
        </div>
      </div>

      {hasContentReady ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="text-xs uppercase tracking-wider text-zinc-500" htmlFor="content-ready-target">Content-ready target</label>
          <div />
          <select
            id="content-ready-target"
            value={selectedContinuationTargetId}
            onChange={(event) => setSelectedContinuationTargetId(event.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
          >
            {continuableTargets.map((target) => (
              <option key={target.targetId} value={target.targetId}>
                {target.identity} · job {target.jobId} · execution {target.executionId}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {error ? <p className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-300">{error}</p> : null}
      {message ? <p className="mt-4 rounded-lg border border-emerald-900/60 bg-emerald-950/30 p-3 text-sm text-emerald-300">{message}</p> : null}

      {publishRun ? (
        <div className="mt-5 rounded-xl border border-zinc-700 bg-zinc-950/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Publication Results</p>
              <p className="mt-1 text-sm text-zinc-300">Last run: {publishRun.completedAt}</p>
            </div>
            <div className="flex gap-2 text-xs uppercase">
              <span className="rounded-full border border-emerald-800 px-3 py-1 text-emerald-300">Published {publishRun.succeeded}</span>
              <span className="rounded-full border border-red-900 px-3 py-1 text-red-300">Failed {publishRun.failed}</span>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-zinc-800 uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-2 py-2">State</th>
                  <th className="px-2 py-2">Result</th>
                  <th className="px-2 py-2">WordPress</th>
                  <th className="px-2 py-2">Detail</th>
                </tr>
              </thead>
              <tbody>
                {publishRun.results.map((entry) => (
                  <tr key={`${entry.stateCode}-${entry.wordpressObjectId}`} className="border-b border-zinc-900 text-zinc-300">
                    <td className="px-2 py-2 font-semibold text-white">{entry.stateCode}</td>
                    <td className={`px-2 py-2 font-semibold ${entry.ok ? "text-emerald-300" : "text-red-300"}`}>{entry.ok ? "PUBLISHED" : "FAILED"}</td>
                    <td className="px-2 py-2 font-mono text-zinc-400">{entry.wordpressObjectId}</td>
                    <td className="px-2 py-2 text-zinc-400">{entry.ok ? (entry.wordpressUrl ?? "Published and verified") : (entry.error ?? entry.state ?? "Publish failed")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {publishPreview?.policyBlocked ? (
        <div className="mt-5 border-y border-amber-900/60 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Publication Blocked by Policy</p>
          <p className="mt-1 text-sm text-zinc-400">{publishPreview.policyReason ?? "Campaign publication is not permitted."} No publish action is available.</p>
        </div>
      ) : publishPreview ? (
        <div className="mt-5 rounded-xl border border-amber-800/60 bg-amber-950/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-amber-400">Protected Campaign Publication</p>
              <p className="mt-1 text-sm text-zinc-300">
                {publishPreview.eligibleCount > 0
                  ? `${publishPreview.eligibleCount} exact draft-ready pages eligible: ${publishPreview.eligible.map((entry) => entry.stateCode).join(", ")}`
                  : "No draft-ready campaign pages are currently eligible for publication."}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Exact persisted WordPress object only · read-before-write · publish read-back verification</p>
            </div>
            <button type="button" onClick={() => void publishDraftReady()} disabled={busy || publishPreview.eligibleCount < 1} className="rounded-lg border border-amber-600 bg-amber-950/40 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40">
              {publishing ? "Publishing..." : `Publish ${publishPreview.eligibleCount} Draft-Ready ${publishPreview.eligibleCount === 1 ? "Page" : "Pages"}`}
            </button>
          </div>
        </div>
      ) : null}

      {seoPreview ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500">Optional Existing Draft SEO Maintenance</p>
              <p className="mt-1 text-sm text-zinc-300">{seoPreview.eligibleCount > 0 ? `${seoPreview.eligibleCount} draft-ready pages eligible: ${seoPreview.eligible.map((target) => target.cityName ? `${target.cityName}, ${target.stateCode}` : target.stateCode).join(", ")}` : "No draft-ready pages currently require campaign SEO maintenance."}</p>
              <p className="mt-1 text-xs text-zinc-500">Not required for draft persistence · no regeneration · no image generation · no publication</p>
            </div>
            <button type="button" onClick={() => void refreshCampaignSeo()} disabled={busy || seoPreview.eligibleCount < 1} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40">
              {refreshingSeo ? "Refreshing SEO..." : "Refresh SEO on Draft-Ready Pages"}
            </button>
          </div>
        </div>
      ) : null}

      {seoRun ? (
        <div className="mt-5 rounded-xl border border-zinc-700 bg-zinc-950/80 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs uppercase tracking-wider text-zinc-500">SEO Maintenance Results</p><p className="mt-1 text-sm text-zinc-300">Last run: {seoRun.completedAt}</p></div>
            <div className="flex gap-2 text-xs uppercase"><span className="rounded-full border border-emerald-800 px-3 py-1 text-emerald-300">Succeeded {seoRun.succeeded}</span><span className="rounded-full border border-red-900 px-3 py-1 text-red-300">Failed {seoRun.failed}</span></div>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">Image generation: <span className="font-semibold text-white">{seoRun.imageGenerationPerformed ? "YES" : "NO"}</span></div><div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-300">Publication: <span className="font-semibold text-white">{seoRun.publicationPerformed ? "YES" : "NO"}</span></div></div>
        </div>
      ) : null}

      {scheduler ? (
        <>
          {!scheduler.executionReadiness.configured ? (
            <div className="mt-5 border border-amber-800 bg-amber-950/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Execution Configuration Required</p>
              <p className="mt-2 text-sm text-zinc-300">A platform operator must restart this supervised runtime with its approved GLW n8n MCP endpoint and token bindings. No target will be leased while execution authority is unavailable.</p>
            </div>
          ) : null}
          {!scheduler.releaseAuthority.capability.ready ? (
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Release Capability Required</p>
                  <p className="mt-1 text-sm text-zinc-300">{scheduler.releaseAuthority.runningReleaseSha ? `Activation requires an enabled capability for running SHA ${scheduler.releaseAuthority.runningReleaseSha}.` : "Activation requires an exact running release SHA."}</p>
                </div>
                <button type="button" onClick={() => void enableRunningReleaseCapability()} disabled={busy || !scheduler.releaseAuthority.runningReleaseSha} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40">
                  {enablingReleaseCapability ? "Enabling..." : "Enable Running Release Capability"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Dispatch Date</p><p className="mt-2 font-semibold text-white">{scheduler.dispatchDate}</p></div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Daily Limit</p><p className="mt-2 text-2xl font-bold text-white">{scheduler.schedule.dailyLimit}</p></div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Used Today</p><p className="mt-2 text-2xl font-bold text-white">{scheduler.schedule.alreadyDispatchedToday}</p></div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4"><p className="text-xs uppercase tracking-wider text-zinc-500">Remaining Allowance</p><p className="mt-2 text-2xl font-bold text-white">{scheduler.schedule.remainingAllowance}</p></div>
          </div>
          <div className="mt-5 border border-zinc-800 bg-zinc-950/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-zinc-500">Exact Authorized Target</p><p className="mt-1 text-sm text-zinc-300">{scheduler.schedule.nextTargets[0] ? (scheduler.schedule.nextTargets[0].cityName ? `${scheduler.schedule.nextTargets[0].cityName}, ${scheduler.schedule.nextTargets[0].stateCode}` : scheduler.schedule.nextTargets[0].stateCode) : "No queued target is eligible for owner authorization."}</p>{scheduler.dispatchPreflight ? <p className="mt-2 text-xs text-zinc-500">Preflight {scheduler.dispatchPreflight.preflightReceiptId} · expires {new Date(scheduler.dispatchPreflight.expiresAt).toLocaleTimeString()}</p> : null}</div><span className="border border-zinc-700 px-3 py-1 text-xs uppercase text-zinc-300">exact-target preflight</span></div></div>
          <p className="mt-3 text-xs font-semibold uppercase text-zinc-400">{dispatchStage}</p>
          <button type="button" onClick={() => void authorizeAndDispatchExactTarget()} disabled={busy || !scheduler.executionReadiness.configured || !scheduler.executionPreflight.ready || !scheduler.releaseAuthority.capability.ready || !scheduler.wordpressReadiness.ready || scheduler.schedule.availableConcurrency < 1 || scheduler.schedule.remainingAllowance < 1 || scheduler.schedule.nextTargets.length !== 1} className="mt-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">{dispatching ? dispatchStage : scheduler.schedule.nextTargets[0] ? `Authorize & Dispatch ${scheduler.schedule.nextTargets[0].cityName ?? scheduler.schedule.nextTargets[0].stateCode} Draft` : "No Exact Target Available"}</button>
        </>
      ) : loading ? <p className="mt-5 text-sm text-zinc-400">Loading scheduler preview...</p> : null}
    </section>
  );
}
