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
  queueRecoveryClass?: "POST_DRAFT_REVIEW_COMPLETION" | "RESUMABLE_CONTINUATION" | "OWNER_RETRY_REQUIRED" | "QUEUED_NEW_DISPATCH" | "NONE";
  ownerAttentionRequired?: boolean;
  continuationEligible: boolean;
  jobId: string | null;
  executionId: string | null;
  executionState: string | null;
  wordpressObjectId: string | null;
  wordpressStatus: string | null;
  canonicalPath: string | null;
  applicationPath: string | null;
  canonicalParentId: string | null;
  visualCertificationCurrentPass: boolean;
  issue: string | null;
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
    waitReason?: string;
    leaseExpiresAt?: string | null;
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

type OperatorFreeTargetLock = {
  targetId: string;
  jobId: string | null;
  executionId: string | null;
};

type ReviewQueueState = "IDLE" | "ACTIVE" | "COMPLETE" | "DAILY_LIMIT_REACHED" | "BLOCKED";

function resolveQueueRecoveryClass(target: ContinuableTargetSummary): "POST_DRAFT_REVIEW_COMPLETION" | "RESUMABLE_CONTINUATION" | "OWNER_RETRY_REQUIRED" | "QUEUED_NEW_DISPATCH" | "NONE" {
  if (target.queueRecoveryClass) return target.queueRecoveryClass;
  if (target.ownerAttentionRequired) return "OWNER_RETRY_REQUIRED";
  if (
    target.lifecycleState === "draft_ready"
    && Boolean(target.wordpressObjectId)
    && !target.visualCertificationCurrentPass
  ) {
    return "POST_DRAFT_REVIEW_COMPLETION";
  }
  if (
    target.continuationEligible === true
    && (target.lifecycleState === "content_ready" || target.lifecycleState === "running")
    && Boolean(target.jobId)
    && Boolean(target.executionId)
  ) {
    return "RESUMABLE_CONTINUATION";
  }
  if (target.lifecycleState === "queued" && !target.jobId && !target.wordpressObjectId) {
    return "QUEUED_NEW_DISPATCH";
  }
  return "NONE";
}

export function GlwCampaignOperatorControls({
  campaignId,
  organizationId,
  siteId,
  campaignStatus,
  targets,
}: Props) {
  const isOutdoorSphereOperatorFreeScope = campaignId === "campaign-led-display-warehouse-site-led-display-warehouse-production-outdoor-led-sphere-overview"
    && organizationId === "led-display-warehouse"
    && siteId === "site-led-display-warehouse-production";
  const autoProgressInFlight = useRef(false);
  const router = useRouter();
  const [scheduler, setScheduler] = useState<SchedulerPayload | null>(null);
  const [publishPreview, setPublishPreview] = useState<PublishPreviewPayload | null>(null);
  const [publishRun, setPublishRun] = useState<PublishRunRecord | null>(null);
  const [seoPreview, setSeoPreview] = useState<SeoRefreshPreviewPayload | null>(null);
  const [seoRun, setSeoRun] = useState<SeoRefreshRunRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchStage, setDispatchStage] = useState<ExactDispatchStage>("IDLE");
  const [autoPipelineStage, setAutoPipelineStage] = useState<string>("IDLE");
  const [autoNextCheckAt, setAutoNextCheckAt] = useState<number | null>(null);
  const [autoTargetLock, setAutoTargetLock] = useState<OperatorFreeTargetLock | null>(null);
  const [autoTargetLockHydrated, setAutoTargetLockHydrated] = useState(false);
  const autoTargetLockRef = useRef<OperatorFreeTargetLock | null>(null);
  const autoProgressPollTimerRef = useRef<number | null>(null);
  const autoProgressPollIntervalMs = 5000;
  const [reviewQueueState, setReviewQueueState] = useState<ReviewQueueState>("IDLE");
  const [reviewQueueCurrentTargetId, setReviewQueueCurrentTargetId] = useState<string | null>(null);
  const [reviewQueueBlockedReason, setReviewQueueBlockedReason] = useState<string | null>(null);
  const reviewQueueStateRef = useRef<ReviewQueueState>("IDLE");
  const targetsRef = useRef<readonly ContinuableTargetSummary[]>(targets);
  const queueStateStorageKey = `glw:auto-review-queue:${campaignId}:${organizationId}:${siteId}`;
  const autoQueueInFlightRef = useRef(false);
  const dispatchInFlight = useRef(false);
  const [reconciling, setReconciling] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [refreshingSeo, setRefreshingSeo] = useState(false);
  const [enablingReleaseCapability, setEnablingReleaseCapability] = useState(false);
  const [continuingTarget, setContinuingTarget] = useState(false);
  const [selectedContinuationTargetId, setSelectedContinuationTargetId] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const targetLockStorageKey = `glw:auto-target-lock:${campaignId}:${organizationId}:${siteId}`;
  const requestHeaders = useCallback((includeJson = false): HeadersInit => {
    const headers = {
      ...(includeJson ? { "Content-Type": "application/json" } : {}),
      "x-gcp-organization-id": organizationId,
      "x-gcp-site-id": siteId,
    };
    return includeJson ? operatorMutationHeaders(headers) : headers;
  }, [organizationId, siteId]);

  useEffect(() => {
    reviewQueueStateRef.current = reviewQueueState;
  }, [reviewQueueState]);

  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  const clearOperatorFreeProgressionPoll = useCallback(() => {
    if (typeof window === "undefined") return;
    if (autoProgressPollTimerRef.current !== null) {
      window.clearTimeout(autoProgressPollTimerRef.current);
      autoProgressPollTimerRef.current = null;
    }
    setAutoNextCheckAt(null);
  }, []);

  function scheduleOperatorFreeProgressionPoll(delayMs = autoProgressPollIntervalMs) {
    if (!isOutdoorSphereOperatorFreeScope || typeof window === "undefined") return;
    if (!autoTargetLockRef.current?.targetId) {
      clearOperatorFreeProgressionPoll();
      return;
    }
    clearOperatorFreeProgressionPoll();
    const effectiveDelayMs = document.visibilityState === "hidden"
      ? Math.max(delayMs, 15_000)
      : delayMs;
    setAutoNextCheckAt(Date.now() + effectiveDelayMs);
    autoProgressPollTimerRef.current = window.setTimeout(() => {
      if (!autoTargetLockRef.current?.targetId) {
        clearOperatorFreeProgressionPoll();
        return;
      }
      if (autoProgressInFlight.current) {
        scheduleOperatorFreeProgressionPoll(1000);
        return;
      }
      void runOperatorFreeProgression(autoTargetLockRef.current.targetId);
    }, effectiveDelayMs);
  }

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

  const readSchedulerSnapshot = useCallback(async () => {
    const response = await fetch(`/api/glw/campaigns/${campaignId}/scheduler`, {
      method: "GET",
      headers: requestHeaders(),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => null) as SchedulerPayload & { error?: string } | null;
    if (!response.ok || !payload) {
      throw new Error(payload?.error ?? `Unable to load scheduler preview (HTTP ${response.status}).`);
    }
    setScheduler(payload);
    return payload;
  }, [campaignId, requestHeaders]);

  useEffect(() => {
    if (campaignStatus !== "active") return;
    const timeout = window.setTimeout(() => void loadScheduler(), 0);
    return () => window.clearTimeout(timeout);
  }, [campaignStatus, loadScheduler]);

  useEffect(() => {
    const firstContinuable = targets.find((target) =>
      target.continuationEligible === true,
    );
    setSelectedContinuationTargetId((current) => current || firstContinuable?.targetId || "");
  }, [targets]);

  useEffect(() => {
    if (!isOutdoorSphereOperatorFreeScope || typeof window === "undefined") return;
    const serialized = window.sessionStorage.getItem(targetLockStorageKey);
    if (serialized) {
      window.sessionStorage.removeItem(targetLockStorageKey);
    }
    setAutoTargetLockHydrated(true);
  }, [isOutdoorSphereOperatorFreeScope, targetLockStorageKey]);

  useEffect(() => {
    if (!isOutdoorSphereOperatorFreeScope || typeof window === "undefined") return;
    const serialized = window.sessionStorage.getItem(queueStateStorageKey);
    if (serialized) {
      window.sessionStorage.removeItem(queueStateStorageKey);
      setReviewQueueState("IDLE");
      setReviewQueueCurrentTargetId(null);
      setReviewQueueBlockedReason(null);
    }
  }, [isOutdoorSphereOperatorFreeScope, queueStateStorageKey]);

  useEffect(() => {
    if (!isOutdoorSphereOperatorFreeScope || typeof window === "undefined" || !autoTargetLockHydrated) return;
    if (!autoTargetLock) {
      autoTargetLockRef.current = null;
      window.sessionStorage.removeItem(targetLockStorageKey);
      clearOperatorFreeProgressionPoll();
      return;
    }
    autoTargetLockRef.current = autoTargetLock;
    window.sessionStorage.setItem(targetLockStorageKey, JSON.stringify(autoTargetLock));
  }, [autoTargetLock, autoTargetLockHydrated, clearOperatorFreeProgressionPoll, isOutdoorSphereOperatorFreeScope, targetLockStorageKey]);

  useEffect(() => {
    if (!isOutdoorSphereOperatorFreeScope || typeof window === "undefined") return;
    if (reviewQueueState === "IDLE" || reviewQueueState === "COMPLETE") {
      window.sessionStorage.removeItem(queueStateStorageKey);
      return;
    }
    window.sessionStorage.setItem(queueStateStorageKey, JSON.stringify({
      state: reviewQueueState,
      currentTargetId: reviewQueueCurrentTargetId,
      blockedReason: reviewQueueBlockedReason,
    }));
  }, [isOutdoorSphereOperatorFreeScope, queueStateStorageKey, reviewQueueBlockedReason, reviewQueueCurrentTargetId, reviewQueueState]);

  const continuableTargets = targets.filter((target) =>
    resolveQueueRecoveryClass(target) === "RESUMABLE_CONTINUATION",
  );

  const ownerRetryTargets = targets.filter((target) =>
    resolveQueueRecoveryClass(target) === "OWNER_RETRY_REQUIRED",
  );

  const queuedNewDispatchTargets = targets.filter((target) =>
    resolveQueueRecoveryClass(target) === "QUEUED_NEW_DISPATCH",
  );

  const postDraftReviewCompletionTargets = targets.filter((target) =>
    resolveQueueRecoveryClass(target) === "POST_DRAFT_REVIEW_COMPLETION",
  );

  const autoTarget = autoTargetLock
    ? targets.find((target) => target.targetId === autoTargetLock.targetId) ?? null
    : null;

  useEffect(() => {
    if (!isOutdoorSphereOperatorFreeScope || !autoTargetLock || !autoTarget?.jobId) return;
    const nextJobId = autoTarget.jobId;
    const nextExecutionId = autoTarget.executionId ?? null;
    if (autoTargetLock.jobId === nextJobId && autoTargetLock.executionId === nextExecutionId) return;
    setAutoTargetLock({
      targetId: autoTargetLock.targetId,
      jobId: nextJobId,
      executionId: nextExecutionId,
    });
  }, [isOutdoorSphereOperatorFreeScope, autoTargetLock, autoTarget?.jobId, autoTarget?.executionId]);

  useEffect(() => {
    if (reviewQueueState !== "ACTIVE") return;
    setReviewQueueCurrentTargetId(autoTargetLock?.targetId ?? null);
  }, [autoTargetLock?.targetId, reviewQueueState]);

  useEffect(() => {
    if (reviewQueueState === "IDLE" && !autoTargetLock?.targetId) {
      setAutoPipelineStage("IDLE");
    }
  }, [autoTargetLock?.targetId, reviewQueueState]);

  useEffect(() => {
    if (!isOutdoorSphereOperatorFreeScope || typeof window === "undefined") return;
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (!autoTargetLockRef.current?.targetId) return;
      clearOperatorFreeProgressionPoll();
      void runOperatorFreeProgression(autoTargetLockRef.current.targetId);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [clearOperatorFreeProgressionPoll, isOutdoorSphereOperatorFreeScope]);

  useEffect(() => {
    return () => {
      clearOperatorFreeProgressionPoll();
    };
  }, [clearOperatorFreeProgressionPoll]);

  useEffect(() => {
    clearOperatorFreeProgressionPoll();
  }, [campaignId, clearOperatorFreeProgressionPoll, organizationId, siteId]);

  function isSupersededPreflightError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    return error.message.includes("DISPATCH_PREFLIGHT_SUPERSEDED");
  }

  async function dispatchExactTarget(input?: { auto?: boolean; schedulerOverride?: SchedulerPayload; rethrowOnError?: boolean }) {
    const activeScheduler = input?.schedulerOverride ?? scheduler;
    if (!activeScheduler || dispatchInFlight.current) return { accepted: false, exactTargetId: null as string | null };
    const auto = input?.auto === true;
    dispatchInFlight.current = true;
    setDispatching(true);
    if (!auto) {
      setMessage(null);
    }
    setError(null);
    try {
      let schedulerForFlow = activeScheduler;
      const result = await runExactTargetDispatchFlow({
        campaignId,
        organizationId,
        siteId,
        scheduler: schedulerForFlow,
        requestHeaders,
        confirm: (confirmation) => auto ? true : window.confirm(confirmation),
        onStage: setDispatchStage,
        onSchedulerRefreshed: (refreshed) => {
          schedulerForFlow = refreshed as SchedulerPayload;
          setScheduler(schedulerForFlow);
        },
      });
      if (!result.accepted) {
        setDispatchStage("READY TO AUTHORIZE");
        return { accepted: false, exactTargetId: null as string | null };
      }
      const payload = result.payload;
      const exactTargetId = schedulerForFlow.schedule.nextTargets[0]?.targetId ?? null;
      if (isOutdoorSphereOperatorFreeScope && exactTargetId) {
        setAutoTargetLock({ targetId: exactTargetId, jobId: null, executionId: null });
        setReviewQueueCurrentTargetId(exactTargetId);
      }
      if (!auto) {
        setMessage(`Exact target dispatch submitted: ${payload.dispatchedCount ?? 0} accepted, ${payload.errorCount ?? 0} dispatch errors. Publication performed: ${payload.publicationPerformed === true ? "yes" : "no"}.`);
      }
      await refreshWorkspace();
      if (isOutdoorSphereOperatorFreeScope && exactTargetId) {
        void runOperatorFreeProgression(exactTargetId);
      }
      return { accepted: true, exactTargetId };
    } catch (flowError) {
      setError(flowError instanceof Error ? flowError.message : "Exact-target dispatch failed.");
      setDispatchStage("IDLE");
      if (input?.rethrowOnError) {
        throw flowError;
      }
      return { accepted: false, exactTargetId: null as string | null };
    } finally {
      setDispatching(false);
      dispatchInFlight.current = false;
    }
  }

  async function authorizeAndDispatchExactTarget() {
    await dispatchExactTarget();
  }

  function startOwnerReviewQueue() {
    if (!isOutdoorSphereOperatorFreeScope || !scheduler || busy) return;
    setAutoTargetLock(null);
    setReviewQueueBlockedReason(null);
    setReviewQueueCurrentTargetId(null);
    setReviewQueueState("ACTIVE");
    setAutoPipelineStage("IDLE");
  }

  function stopOwnerReviewQueue() {
    setAutoTargetLock(null);
    setReviewQueueState("IDLE");
    setReviewQueueBlockedReason(null);
    setReviewQueueCurrentTargetId(null);
    setAutoPipelineStage("IDLE");
    clearOperatorFreeProgressionPoll();
  }

  async function runOperatorFreeProgression(targetIdOverride?: string) {
    if (!isOutdoorSphereOperatorFreeScope) {
      clearOperatorFreeProgressionPoll();
      return;
    }

    if (reviewQueueStateRef.current === "BLOCKED") {
      setAutoPipelineStage("BLOCKED");
      setAutoTargetLock(null);
      clearOperatorFreeProgressionPoll();
      return;
    }

    if (autoProgressInFlight.current) {
      scheduleOperatorFreeProgressionPoll(1000);
      return;
    }

    const lockedTargetId = targetIdOverride ?? autoTargetLock?.targetId ?? null;
    if (!lockedTargetId) {
      clearOperatorFreeProgressionPoll();
      return;
    }
    const exactTarget = targets.find((target) => target.targetId === lockedTargetId) ?? null;
    if (!exactTarget) {
      setAutoPipelineStage("WAITING FOR GENERATION");
      await refreshWorkspace();
      scheduleOperatorFreeProgressionPoll();
      return;
    }
    if (exactTarget.lifecycleState === "published") {
      clearOperatorFreeProgressionPoll();
      return;
    }
    if (exactTarget.lifecycleState === "draft_ready" && exactTarget.visualCertificationCurrentPass) {
      setAutoPipelineStage("READY FOR OWNER REVIEW");
      if (reviewQueueStateRef.current === "ACTIVE") {
        setAutoTargetLock(null);
        setReviewQueueCurrentTargetId(null);
      }
      clearOperatorFreeProgressionPoll();
      return;
    }

    autoProgressInFlight.current = true;
    setAutoPipelineStage("DISPATCH ✓");
    setError(null);
    clearOperatorFreeProgressionPoll();

    try {
      if (!exactTarget.jobId || !exactTarget.executionId) {
        setAutoPipelineStage("WAITING FOR GENERATION");
        await refreshWorkspace();
        scheduleOperatorFreeProgressionPoll();
        return;
      }

      setAutoPipelineStage("GENERATION / RECONCILIATION");
      const reconcileBody = {
        confirm: "RECONCILE_EXISTING_DRAFT_BATCH",
        targetId: exactTarget.targetId,
        jobId: exactTarget.jobId,
        executionId: exactTarget.executionId,
      };

      const reconcileResponse = await fetch(`/api/glw/campaigns/${campaignId}/reconcile`, {
        method: "POST",
        headers: requestHeaders(true),
        body: JSON.stringify(reconcileBody),
        cache: "no-store",
      });

      const reconcilePayload = await reconcileResponse.json().catch(() => null) as ReconcilePayload | { error?: string; results?: ReconcilePayload["results"] } | null;
      if (!reconcileResponse.ok || !reconcilePayload) {
        setError(reconcilePayload && "error" in reconcilePayload ? (reconcilePayload.error ?? `Automatic reconciliation failed (HTTP ${reconcileResponse.status}).`) : `Automatic reconciliation failed (HTTP ${reconcileResponse.status}).`);
        setAutoPipelineStage("FAILED");
        if (reviewQueueStateRef.current === "ACTIVE") {
          setReviewQueueState("BLOCKED");
          setReviewQueueBlockedReason(reconcilePayload && "error" in reconcilePayload ? (reconcilePayload.error ?? "Automatic reconciliation failed.") : "Automatic reconciliation failed.");
          setReviewQueueCurrentTargetId(exactTarget.targetId);
        }
        setAutoTargetLock(null);
        clearOperatorFreeProgressionPoll();
        return;
      }

      const result = Array.isArray(reconcilePayload.results)
        ? reconcilePayload.results.find((entry) => entry.jobId === exactTarget.jobId) ?? null
        : null;

      if (!result) {
        setAutoPipelineStage("WAITING FOR GENERATION");
        setError("EXACT_TARGET_PROTOCOL_RESULT_MISSING");
        await refreshWorkspace();
        scheduleOperatorFreeProgressionPoll();
        return;
      }
      if (["failed", "error", "continue_error"].includes(result.action)) {
        setError(result.error ?? "Automatic progression halted with a recoverable failure.");
        setAutoPipelineStage("FAILED");
        if (reviewQueueStateRef.current === "ACTIVE") {
          setReviewQueueState("BLOCKED");
          setReviewQueueBlockedReason(result.error ?? "Automatic progression halted with a recoverable failure.");
          setReviewQueueCurrentTargetId(exactTarget.targetId);
        }
        setAutoTargetLock(null);
        await refreshWorkspace();
        clearOperatorFreeProgressionPoll();
        return;
      }

      if (result.action === "draft_ready") {
        setAutoPipelineStage("VISUAL CERTIFICATION");
        const captureResponse = await fetch(`/api/glw/pages/${encodeURIComponent(result.jobId)}/visual-certification`, {
          method: "POST",
          headers: requestHeaders(true),
          body: JSON.stringify({ mode: "CURRENT" }),
          cache: "no-store",
        });
        const capturePayload = await captureResponse.json().catch(() => null) as { error?: string } | null;
        if (!captureResponse.ok && capturePayload?.error !== "VISUAL_CERTIFICATION_IDENTITY_ALREADY_EXISTS") {
          setError(capturePayload?.error ?? `Automatic visual certification failed (HTTP ${captureResponse.status}).`);
          setAutoPipelineStage("CAPTURE_FAILED");
          if (reviewQueueStateRef.current === "ACTIVE") {
            setReviewQueueState("BLOCKED");
            setReviewQueueBlockedReason(capturePayload?.error ?? "Automatic visual certification failed.");
            setReviewQueueCurrentTargetId(exactTarget.targetId);
          }
          setAutoTargetLock(null);
          await refreshWorkspace();
          clearOperatorFreeProgressionPoll();
          return;
        }
        setAutoPipelineStage("READY FOR OWNER REVIEW");
        if (reviewQueueStateRef.current === "ACTIVE") {
          setMessage("Prepared one page to READY FOR OWNER REVIEW. Continuing with the next exact queued target.");
        } else {
          setMessage("Operator-free progression reached READY FOR OWNER REVIEW. Owner touchpoints remain Approve/Needs Fix and Publish.");
        }
        setAutoTargetLock(null);
        setReviewQueueCurrentTargetId(null);
        await refreshWorkspace();
        clearOperatorFreeProgressionPoll();
        return;
      }

      if (result.action === "wait") {
        if (result.waitReason === "ACTIVE_LEASE") {
          setAutoPipelineStage("WAITING FOR ACTIVE LEASE");
        } else {
          setAutoPipelineStage("WAITING FOR GENERATION");
        }
      } else {
        setAutoPipelineStage("GENERATION / RECONCILIATION");
      }
      await refreshWorkspace();
      scheduleOperatorFreeProgressionPoll();
    } finally {
      autoProgressInFlight.current = false;
    }
  }

  useEffect(() => {
    if (!isOutdoorSphereOperatorFreeScope || !autoTargetLockHydrated || loading || !scheduler) return;
    if (reviewQueueState === "BLOCKED") {
      clearOperatorFreeProgressionPoll();
      return;
    }
    if (!autoTargetLock?.targetId) {
      clearOperatorFreeProgressionPoll();
      return;
    }
    if (autoTarget?.lifecycleState === "draft_ready" && autoTarget.visualCertificationCurrentPass) {
      setAutoPipelineStage("READY FOR OWNER REVIEW");
      clearOperatorFreeProgressionPoll();
      return;
    }
    if (autoTarget?.lifecycleState === "published") {
      clearOperatorFreeProgressionPoll();
      return;
    }
    void runOperatorFreeProgression();
  }, [isOutdoorSphereOperatorFreeScope, autoTargetLockHydrated, loading, scheduler, reviewQueueState, autoTargetLock?.targetId, autoTarget?.jobId, autoTarget?.executionId, autoTarget?.lifecycleState, autoTarget?.visualCertificationCurrentPass, clearOperatorFreeProgressionPoll]);

  useEffect(() => {
    if (!isOutdoorSphereOperatorFreeScope || !autoTargetLockHydrated || loading || !scheduler) return;
    if (reviewQueueState !== "ACTIVE") return;
    if (autoQueueInFlightRef.current || dispatching || dispatchInFlight.current || reconciling || continuingTarget || publishing || refreshingSeo || enablingReleaseCapability) {
      return;
    }

    const processingTarget = autoTargetLock?.targetId
      ? targets.find((target) => target.targetId === autoTargetLock.targetId) ?? null
      : null;

    if (processingTarget) {
      setReviewQueueCurrentTargetId(processingTarget.targetId);
      void runOperatorFreeProgression(processingTarget.targetId);
      return;
    }

    const postDraftTargets = postDraftReviewCompletionTargets
      .filter((target) =>
        target.lifecycleState === "draft_ready"
        && Boolean(target.wordpressObjectId)
        && !target.visualCertificationCurrentPass
        && Boolean(target.jobId)
        && Boolean(target.executionId),
      )
      .sort((left, right) => left.identity.localeCompare(right.identity));

    if (postDraftTargets.length >= 1) {
      const postDraft = postDraftTargets[0];
      setReviewQueueCurrentTargetId(postDraft.targetId);
      setAutoTargetLock({
        targetId: postDraft.targetId,
        jobId: postDraft.jobId,
        executionId: postDraft.executionId,
      });
      void runOperatorFreeProgression(postDraft.targetId);
      return;
    }

    const resumableTargets = targets.filter((target) =>
      resolveQueueRecoveryClass(target) === "RESUMABLE_CONTINUATION"
      && (target.lifecycleState === "content_ready" || target.lifecycleState === "running")
      && Boolean(target.jobId)
      && Boolean(target.executionId),
    ).sort((left, right) => left.identity.localeCompare(right.identity));

    if (resumableTargets.length >= 1) {
      const resumable = resumableTargets[0];
      setReviewQueueCurrentTargetId(resumable.targetId);
      setAutoTargetLock({
        targetId: resumable.targetId,
        jobId: resumable.jobId,
        executionId: resumable.executionId,
      });
      void runOperatorFreeProgression(resumable.targetId);
      return;
    }

    autoQueueInFlightRef.current = true;
    void (async () => {
      try {
        const freshScheduler = await readSchedulerSnapshot();
        if (freshScheduler.schedule.remainingAllowance < 1 && freshScheduler.queue.queued > 0) {
          setReviewQueueState("DAILY_LIMIT_REACHED");
          setAutoPipelineStage("DAILY_LIMIT_REACHED");
          setReviewQueueCurrentTargetId(null);
          return;
        }

        if (freshScheduler.queue.queued < 1) {
          setReviewQueueState("COMPLETE");
          setAutoPipelineStage("COMPLETE");
          setReviewQueueCurrentTargetId(null);
          return;
        }

        if (freshScheduler.schedule.nextTargets.length !== 1 || freshScheduler.schedule.availableConcurrency < 1) {
          setReviewQueueState("BLOCKED");
          setReviewQueueBlockedReason("Exact queued target is unavailable for dispatch.");
          setAutoPipelineStage("BLOCKED");
          return;
        }

        if (!freshScheduler.executionReadiness.configured || !freshScheduler.executionPreflight.ready || !freshScheduler.wordpressReadiness.ready) {
          setReviewQueueState("BLOCKED");
          setReviewQueueBlockedReason("Execution or WordPress authority is unavailable for exact dispatch.");
          setAutoPipelineStage("BLOCKED");
          return;
        }

        const initialTargetId = freshScheduler.schedule.nextTargets[0]?.targetId ?? null;
        if (!initialTargetId) {
          setReviewQueueState("BLOCKED");
          setReviewQueueBlockedReason("Exact queued target is unavailable for dispatch.");
          setAutoPipelineStage("BLOCKED");
          return;
        }
        const projected = targetsRef.current.find((target) => target.targetId === initialTargetId) ?? null;
        if (projected && projected.lifecycleState !== "queued") {
          setReviewQueueState("BLOCKED");
          setReviewQueueBlockedReason(`Selected target is not queued: ${projected.identity} is ${projected.lifecycleState}.`);
          setAutoPipelineStage("BLOCKED");
          return;
        }

        setReviewQueueBlockedReason(null);
        setAutoPipelineStage("DISPATCH ✓");
        try {
          await dispatchExactTarget({
            auto: true,
            schedulerOverride: freshScheduler,
            rethrowOnError: true,
          });
        } catch (dispatchError) {
          if (!isSupersededPreflightError(dispatchError)) {
            throw dispatchError;
          }

          const retryScheduler = await readSchedulerSnapshot();
          if (retryScheduler.schedule.remainingAllowance < 1) {
            setReviewQueueState("DAILY_LIMIT_REACHED");
            setAutoPipelineStage("DAILY_LIMIT_REACHED");
            setReviewQueueCurrentTargetId(null);
            return;
          }
          if (retryScheduler.schedule.nextTargets.length !== 1 || retryScheduler.schedule.availableConcurrency < 1) {
            setReviewQueueState("BLOCKED");
            setReviewQueueBlockedReason("Exact queued target is unavailable for dispatch.");
            setAutoPipelineStage("BLOCKED");
            return;
          }
          const retryTargetId = retryScheduler.schedule.nextTargets[0]?.targetId ?? null;
          if (!retryTargetId || retryTargetId !== initialTargetId) {
            setReviewQueueState("BLOCKED");
            setReviewQueueBlockedReason("Canonical exact target changed during preflight refresh.");
            setAutoPipelineStage("BLOCKED");
            return;
          }
          if (!retryScheduler.executionReadiness.configured || !retryScheduler.executionPreflight.ready || !retryScheduler.wordpressReadiness.ready) {
            setReviewQueueState("BLOCKED");
            setReviewQueueBlockedReason("Execution or WordPress authority is unavailable for exact dispatch.");
            setAutoPipelineStage("BLOCKED");
            return;
          }
          const retryProjected = targetsRef.current.find((target) => target.targetId === retryTargetId) ?? null;
          if (retryProjected && retryProjected.lifecycleState !== "queued") {
            setReviewQueueState("BLOCKED");
            setReviewQueueBlockedReason(`Selected target is not queued: ${retryProjected.identity} is ${retryProjected.lifecycleState}.`);
            setAutoPipelineStage("BLOCKED");
            return;
          }

          await dispatchExactTarget({
            auto: true,
            schedulerOverride: retryScheduler,
            rethrowOnError: true,
          });
        }
      } catch (queueError) {
        setReviewQueueState("BLOCKED");
        setReviewQueueBlockedReason(queueError instanceof Error ? queueError.message : "Unable to refresh queue eligibility.");
        setAutoPipelineStage("BLOCKED");
      }
    })().finally(() => {
      autoQueueInFlightRef.current = false;
    });
  }, [
    isOutdoorSphereOperatorFreeScope,
    autoTargetLockHydrated,
    loading,
    scheduler,
    reviewQueueState,
    autoTargetLock?.targetId,
    dispatching,
    reconciling,
    continuingTarget,
    publishing,
    refreshingSeo,
    enablingReleaseCapability,
    targets,
    postDraftReviewCompletionTargets,
    readSchedulerSnapshot,
  ]);

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
  const canonicalIdentityReady = Boolean(autoTarget?.canonicalPath && autoTarget?.applicationPath && autoTarget?.canonicalParentId);
  const visualReady = Boolean(autoTarget?.visualCertificationCurrentPass);
  const generationComplete = Boolean(
    autoTarget && ["content_ready", "draft_ready", "failed", "published"].includes(autoTarget.lifecycleState),
  );
  const readyForOwnerReviewCount = targets.filter((target) =>
    target.lifecycleState === "draft_ready" && target.visualCertificationCurrentPass,
  ).length;
  const processingCount = reviewQueueState === "ACTIVE" && autoTargetLock?.targetId ? 1 : 0;
  const ownerAttentionCount = ownerRetryTargets.length;
  const queuedNewDispatchCount = queuedNewDispatchTargets.length;
  const queueUsedToday = scheduler?.schedule.alreadyDispatchedToday ?? 0;
  const queueDailyLimit = scheduler?.schedule.dailyLimit ?? 0;
  const queueRemainingAllowance = scheduler?.schedule.remainingAllowance ?? 0;

  return (
    <section id="campaign-actions" className="border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-red-400">Owner Actions</p>
          <h2 className="mt-2 text-lg font-semibold text-white">Campaign Controls</h2>
          <p className="mt-1 max-w-3xl text-sm text-zinc-400">The primary action follows the current lifecycle stage. Maintenance and publication remain separate.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isOutdoorSphereOperatorFreeScope ? (
            <>
              <button type="button" onClick={() => void reconcileCampaign()} disabled={busy || !scheduler || !hasRunningOrFailed} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40">
                {reconciling ? "Reconciling..." : "Reconcile Campaign"}
              </button>
              <button type="button" onClick={() => void continueContentReadyTarget()} disabled={busy || !scheduler || !hasContentReady || !selectedContinuationTargetId} className="rounded-lg border border-red-700 bg-red-950/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-red-200 transition hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-40">
                {continuingTarget ? "Continuing..." : "Continue to WordPress Draft"}
              </button>
            </>
          ) : null}
          <button type="button" onClick={() => void refreshWorkspace()} disabled={busy} className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40">
            {loading ? "Refreshing..." : "Refresh Preview"}
          </button>
        </div>
      </div>

      {isOutdoorSphereOperatorFreeScope ? (
        <div className="mt-4 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Operator-Free Pipeline V1</p>
              <p className="mt-1 text-sm text-zinc-300">No manual Reconcile or Continue actions are required between dispatch and owner review for this campaign.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startOwnerReviewQueue()}
                disabled={busy || !scheduler || reviewQueueState === "ACTIVE"}
                className="rounded-lg border border-emerald-700 bg-emerald-900/30 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-200 transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prepare Pages for Owner Review
              </button>
              <button
                type="button"
                onClick={() => stopOwnerReviewQueue()}
                disabled={reviewQueueState !== "ACTIVE"}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Stop Queue
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
              <p className="uppercase tracking-wider text-zinc-500">Review Queue</p>
              <p className="mt-1 font-semibold text-white">{reviewQueueState}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
              <p className="uppercase tracking-wider text-zinc-500">Ready for Review</p>
              <p className="mt-1 text-lg font-bold text-white">{readyForOwnerReviewCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
              <p className="uppercase tracking-wider text-zinc-500">Processing</p>
              <p className="mt-1 text-lg font-bold text-white">{processingCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
              <p className="uppercase tracking-wider text-zinc-500">Queued</p>
              <p className="mt-1 text-lg font-bold text-white">{queuedNewDispatchCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
              <p className="uppercase tracking-wider text-zinc-500">Owner Attention</p>
              <p className="mt-1 text-lg font-bold text-white">{ownerAttentionCount}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300 sm:col-span-2 xl:col-span-5">
              <p className="uppercase tracking-wider text-zinc-500">Used Today</p>
              <p className="mt-1 text-lg font-bold text-white">{queueUsedToday} / {queueDailyLimit}</p>
              <p className="mt-1 text-[11px] text-zinc-500">Remaining {queueRemainingAllowance}</p>
            </div>
          </div>
          {ownerAttentionCount > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3 text-xs text-amber-200">
              <p className="font-semibold uppercase tracking-wider">Owner Attention Required</p>
              <p className="mt-1">{ownerAttentionCount} target{ownerAttentionCount === 1 ? "" : "s"}</p>
              <ul className="mt-2 space-y-1 text-zinc-300">
                {ownerRetryTargets.map((target) => (
                  <li key={`owner-retry-${target.targetId}`}>
                    {target.identity} - Regeneration required. {target.issue ?? "Protected factual claim could not be safely canonicalized."}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {reviewQueueState === "ACTIVE" && reviewQueueCurrentTargetId ? (
            <p className="mt-3 text-xs text-zinc-300">Current target: {reviewQueueCurrentTargetId}</p>
          ) : null}
          {reviewQueueBlockedReason ? (
            <p className="mt-2 text-xs text-red-300">Queue blocked: {reviewQueueBlockedReason}</p>
          ) : null}
          <ol className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Authorized", true],
              ["Dispatch", Boolean(autoTarget?.jobId)],
              ["Generation", generationComplete],
              ["Content Ready", Boolean(autoTarget?.lifecycleState === "content_ready" || autoTarget?.lifecycleState === "draft_ready")],
              ["Rich Composition", Boolean(autoTarget?.wordpressObjectId)],
              ["Contextual Media", Boolean(autoTarget?.lifecycleState === "draft_ready")],
              ["WordPress Draft", Boolean(autoTarget?.wordpressObjectId)],
              ["Canonical Identity", canonicalIdentityReady],
              ["Visual Certification", visualReady],
              ["Ready for Owner Review", Boolean(autoTarget?.lifecycleState === "draft_ready" && visualReady)],
            ].map(([label, complete]) => (
              <li key={label as string} className={`rounded-md border px-2 py-2 ${complete ? "border-emerald-700 text-emerald-200" : "border-zinc-700 text-zinc-400"}`}>
                {(label as string).toUpperCase()} {complete ? "✓" : ""}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-zinc-400">Current automatic stage: {autoPipelineStage}</p>
          {autoNextCheckAt ? (
            <p className="mt-1 text-xs text-zinc-500">Automatic check in ~{Math.max(1, Math.ceil((autoNextCheckAt - Date.now()) / 1000))}s</p>
          ) : null}
        </div>
      ) : null}

      {hasContentReady && !isOutdoorSphereOperatorFreeScope ? (
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
          <button type="button" onClick={() => void authorizeAndDispatchExactTarget()} disabled={busy || !scheduler.executionReadiness.configured || !scheduler.executionPreflight.ready || !scheduler.wordpressReadiness.ready || scheduler.schedule.availableConcurrency < 1 || scheduler.schedule.remainingAllowance < 1 || scheduler.schedule.nextTargets.length !== 1} className="mt-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">{dispatching ? dispatchStage : scheduler.schedule.nextTargets[0] ? `Authorize & Dispatch ${scheduler.schedule.nextTargets[0].cityName ?? scheduler.schedule.nextTargets[0].stateCode} Draft` : "No Exact Target Available"}</button>
        </>
      ) : loading ? <p className="mt-5 text-sm text-zinc-400">Loading scheduler preview...</p> : null}
    </section>
  );
}
