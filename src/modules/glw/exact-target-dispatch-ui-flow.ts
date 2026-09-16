export type ExactDispatchStage =
  | "IDLE"
  | "REFRESHING PREFLIGHT"
  | "READY TO AUTHORIZE"
  | "DISPATCHING"
  | "DISPATCH ACCEPTED";

type DispatchPreflight = {
  preflightReceiptId: string;
  targetId: string;
  expiresAt: string;
  publicationPolicy: string;
};

export type ExactDispatchScheduler = {
  schedule: {
    remainingAllowance: number;
    nextTargets: readonly {
      targetId: string;
      stateCode: string;
      cityName: string | null;
    }[];
  };
  releaseAuthority: { capability: { ready: boolean } };
  wordpressReadiness: { ready: boolean };
  executionPreflight: { ready: boolean };
  dispatchPreflight: DispatchPreflight | null;
};

type DispatchPayload = {
  dispatchedCount?: number;
  errorCount?: number;
  publicationPerformed?: boolean;
  error?: string;
};

type FlowInput = {
  campaignId: string;
  organizationId: string;
  siteId: string;
  scheduler: ExactDispatchScheduler;
  requestHeaders: (includeJson?: boolean) => HeadersInit;
  confirm: (message: string) => boolean;
  onStage: (stage: ExactDispatchStage) => void;
  onSchedulerRefreshed: (scheduler: ExactDispatchScheduler) => void;
  now?: () => number;
  fetcher?: typeof fetch;
};

type FlowResult =
  | { accepted: false; scheduler: ExactDispatchScheduler }
  | { accepted: true; scheduler: ExactDispatchScheduler; payload: DispatchPayload };

function getExactTarget(scheduler: ExactDispatchScheduler) {
  return scheduler.schedule.nextTargets.length === 1
    ? scheduler.schedule.nextTargets[0]
    : null;
}

function hasFreshExactPreflight(
  scheduler: ExactDispatchScheduler,
  targetId: string,
  now: number,
) {
  const preflight = scheduler.dispatchPreflight;
  return Boolean(
    preflight
      && preflight.targetId === targetId
      && Number.isFinite(Date.parse(preflight.expiresAt))
      && Date.parse(preflight.expiresAt) > now,
  );
}

async function readPayload<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null) as Promise<T | null>;
}

export async function runExactTargetDispatchFlow(input: FlowInput): Promise<FlowResult> {
  const fetcher = input.fetcher ?? fetch;
  const initialTarget = getExactTarget(input.scheduler);
  if (!initialTarget) throw new Error("EXACT_TARGET_UNAVAILABLE");
  if (input.scheduler.schedule.remainingAllowance < 1) throw new Error("GLW_CAMPAIGN_DAILY_ALLOWANCE_EXHAUSTED");

  let activeScheduler = input.scheduler;
  if (!hasFreshExactPreflight(activeScheduler, initialTarget.targetId, (input.now ?? Date.now)())) {
    input.onStage("REFRESHING PREFLIGHT");
    const response = await fetcher(`/api/glw/campaigns/${input.campaignId}/scheduler`, {
      method: "GET",
      headers: input.requestHeaders(),
      cache: "no-store",
    });
    const payload = await readPayload<ExactDispatchScheduler & { error?: string }>(response);
    if (!response.ok || !payload) {
      throw new Error(payload?.error ?? `Exact-target preflight refresh failed (HTTP ${response.status}).`);
    }

    const refreshedTarget = getExactTarget(payload);
    if (!refreshedTarget || refreshedTarget.targetId !== initialTarget.targetId) {
      throw new Error("EXACT_TARGET_CHANGED_DURING_PREFLIGHT_REFRESH");
    }
    if (!hasFreshExactPreflight(payload, initialTarget.targetId, (input.now ?? Date.now)())) {
      throw new Error("FRESH_EXACT_TARGET_PREFLIGHT_REQUIRED");
    }
    activeScheduler = payload;
    input.onSchedulerRefreshed(payload);
  }

  const preflight = activeScheduler.dispatchPreflight;
  const target = getExactTarget(activeScheduler);
  if (!preflight || !target || preflight.targetId !== target.targetId) {
    throw new Error("EXACT_TARGET_PREFLIGHT_MISMATCH");
  }

  input.onStage("READY TO AUTHORIZE");
  const targetLabel = target.cityName ? `${target.cityName}, ${target.stateCode}` : target.stateCode;
  const confirmed = input.confirm(
    `Authorize & Dispatch ${targetLabel} Draft?\n\nOrganization: ${input.organizationId}\nSite: ${input.siteId}\nCampaign: ${input.campaignId}\nTarget: ${target.targetId}\nOperation: OWNER_EXACT_TARGET_DISPATCH\nPolicy: ${preflight.publicationPolicy}\nAllowance: ${activeScheduler.schedule.remainingAllowance} → ${activeScheduler.schedule.remainingAllowance - 1}\nRelease: ${activeScheduler.releaseAuthority.capability.ready ? "READY" : "BLOCKED"}\nWordPress: ${activeScheduler.wordpressReadiness.ready ? "READY" : "BLOCKED"}\nMCP / n8n: ${activeScheduler.executionPreflight.ready ? "READY" : "BLOCKED"}\n\nThis authorization is exact-target, short-lived, and single-use. Publication remains blocked.`,
  );
  if (!confirmed) return { accepted: false, scheduler: activeScheduler };

  input.onStage("DISPATCHING");
  const grantResponse = await fetcher(`/api/glw/campaigns/${input.campaignId}/dispatch-authorization`, {
    method: "POST",
    headers: input.requestHeaders(true),
    body: JSON.stringify({
      operation: "OWNER_EXACT_TARGET_DISPATCH",
      confirmationMode: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET",
      preflightReceiptId: preflight.preflightReceiptId,
      targetId: target.targetId,
    }),
  });
  const grantPayload = await readPayload<{ grant?: { grantId?: string }; error?: string }>(grantResponse);
  if (!grantResponse.ok || !grantPayload?.grant?.grantId) {
    throw new Error(grantPayload?.error ?? `Owner dispatch authorization failed (HTTP ${grantResponse.status}).`);
  }

  const dispatchResponse = await fetcher(`/api/glw/campaigns/${input.campaignId}/scheduler`, {
    method: "POST",
    headers: input.requestHeaders(true),
    body: JSON.stringify({
      confirm: "AUTHORIZE_AND_DISPATCH_EXACT_TARGET",
      preflightReceiptId: preflight.preflightReceiptId,
      ownerDispatchGrantId: grantPayload.grant.grantId,
      targetId: target.targetId,
    }),
  });
  const dispatchPayload = await readPayload<DispatchPayload>(dispatchResponse);
  if (!dispatchResponse.ok || !dispatchPayload) {
    throw new Error(dispatchPayload?.error ?? `Draft batch dispatch failed (HTTP ${dispatchResponse.status}).`);
  }

  input.onStage("DISPATCH ACCEPTED");
  return { accepted: true, scheduler: activeScheduler, payload: dispatchPayload };
}