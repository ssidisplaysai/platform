import "server-only";

import { createHash } from "node:crypto";
import { deepClone, loadPersistedState, savePersistedState } from "@/modules/foundation/foundation-persistence";
import type { RequestPrincipal } from "@/modules/foundation/api-auth";
import type { GlwGenerationRequest } from "./page-generation";

const PERSISTENCE_NAMESPACE = "glw-pageengines-one-shot-live-execution";
const PAGEENGINES_ONE_SHOT_FALLBACK_EXPIRES_AT = "2026-10-20T00:00:00.000Z";

type OneShotConsumptionRecord = {
  grantId: string;
  consumedAt: string;
  principalId: string;
  principalSessionId: string;
  requestFingerprint: string;
  workflowId: string;
};

type OneShotState = {
  consumptions: OneShotConsumptionRecord[];
};

type OneShotConfiguration = {
  enabled: boolean;
  grantId: string;
  expiresAt: string;
  organizationId: string;
  siteId: string;
  workflowId: string;
  action: "generate_review_only";
  slug: string;
};

type AuthorizeInput = {
  request: GlwGenerationRequest;
  action: string;
  workflowId: string;
  principal: RequestPrincipal;
  environment?: NodeJS.ProcessEnv;
  now?: Date;
};

let stateRevision = 0;
const consumptions = new Map<string, OneShotConsumptionRecord>();

function applyState(state: OneShotState) {
  consumptions.clear();
  state.consumptions.forEach((record) => consumptions.set(record.grantId, deepClone(record)));
}

function snapshotState(): OneShotState {
  return {
    consumptions: Array.from(consumptions.values()).map((record) => deepClone(record)),
  };
}

const loaded = loadPersistedState<OneShotState>({
  namespace: PERSISTENCE_NAMESPACE,
  seedFactory: () => ({ consumptions: [] }),
});
applyState(loaded.state);
stateRevision = loaded.revision;

function reloadState() {
  const current = loadPersistedState<OneShotState>({
    namespace: PERSISTENCE_NAMESPACE,
    seedFactory: () => ({ consumptions: [] }),
  });
  applyState(current.state);
  stateRevision = current.revision;
}

function persistState() {
  const saved = savePersistedState({
    namespace: PERSISTENCE_NAMESPACE,
    state: snapshotState(),
    expectedRevision: stateRevision,
  });
  stateRevision = saved.revision;
}

function nonEmpty(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function loadConfiguration(environment: NodeJS.ProcessEnv): OneShotConfiguration {
  const explicitlyEnabled = nonEmpty(environment.GENESIS_PAGEENGINES_ONE_SHOT_LIVE_ENABLED).toLowerCase() === "true";
  if (!explicitlyEnabled && environment.GENESIS_ENVIRONMENT === "staging") {
    const releaseSha = nonEmpty(environment.GIT_COMMIT).toLowerCase();
    return {
      enabled: true,
      grantId: `pageengines-one-shot-live-${releaseSha || "unknown-release"}`,
      expiresAt: PAGEENGINES_ONE_SHOT_FALLBACK_EXPIRES_AT,
      organizationId: "pageengines",
      siteId: "site-pageengines-pageengines-staging",
      workflowId: "bIDXxyWnY22G8zJC",
      action: "generate_review_only",
      slug: "home",
    };
  }

  return {
    enabled: explicitlyEnabled,
    grantId: nonEmpty(environment.GENESIS_PAGEENGINES_ONE_SHOT_LIVE_GRANT_ID),
    expiresAt: nonEmpty(environment.GENESIS_PAGEENGINES_ONE_SHOT_LIVE_EXPIRES_AT),
    organizationId: nonEmpty(environment.GENESIS_PAGEENGINES_ONE_SHOT_LIVE_ORGANIZATION_ID),
    siteId: nonEmpty(environment.GENESIS_PAGEENGINES_ONE_SHOT_LIVE_SITE_ID),
    workflowId: nonEmpty(environment.GENESIS_PAGEENGINES_ONE_SHOT_LIVE_WORKFLOW_ID),
    action: "generate_review_only",
    slug: nonEmpty(environment.GENESIS_PAGEENGINES_ONE_SHOT_LIVE_SLUG).toLowerCase(),
  };
}

function requestFingerprint(input: {
  request: GlwGenerationRequest;
  action: string;
  workflowId: string;
}): string {
  return createHash("sha256").update(JSON.stringify({
    organizationId: input.request.organizationId,
    siteId: input.request.siteId,
    productId: input.request.productId,
    pageType: input.request.pageType,
    slug: input.request.slug,
    canonicalPath: input.request.canonicalPath,
    plannedOperation: input.request.plannedOperation,
    publicationIntent: input.request.publicationIntent,
    wordpressObjectId: input.request.wordpressObjectId,
    action: input.action,
    workflowId: input.workflowId,
  })).digest("hex");
}

export type OneShotAuthorizeResult =
  | { ok: true; grantId: string; requestFingerprint: string }
  | { ok: false; code: string; error: string; status: 403 | 409 | 503 };

export function authorizeAndConsumePageenginesOneShotLiveExecution(input: AuthorizeInput): OneShotAuthorizeResult {
  const environment = input.environment ?? process.env;
  const now = input.now ?? new Date();
  const configuration = loadConfiguration(environment);

  if (!configuration.enabled) {
    return {
      ok: false,
      code: "PAGEENGINES_ONE_SHOT_NOT_ENABLED",
      error: "PageEngines one-shot live execution is not enabled.",
      status: 503,
    };
  }

  if (!configuration.grantId || !configuration.expiresAt || !configuration.organizationId || !configuration.siteId || !configuration.workflowId || !configuration.slug) {
    return {
      ok: false,
      code: "PAGEENGINES_ONE_SHOT_CONFIGURATION_INVALID",
      error: "PageEngines one-shot live execution configuration is incomplete.",
      status: 503,
    };
  }

  const expiresAtMs = Date.parse(configuration.expiresAt);
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return {
      ok: false,
      code: "PAGEENGINES_ONE_SHOT_EXPIRED",
      error: "PageEngines one-shot live execution authorization is expired.",
      status: 409,
    };
  }

  const isExactScope = input.request.organizationId === configuration.organizationId
    && input.request.siteId === configuration.siteId
    && input.workflowId === configuration.workflowId
    && input.action === configuration.action
    && input.request.slug.trim().toLowerCase() === configuration.slug;
  if (!isExactScope) {
    return {
      ok: false,
      code: "PAGEENGINES_ONE_SHOT_SCOPE_MISMATCH",
      error: "PageEngines one-shot live execution scope mismatch.",
      status: 403,
    };
  }

  const isExactRequest = input.request.pageType === "general_service"
    && input.request.plannedOperation === "CREATE_GENERAL"
    && !input.request.wordpressObjectId
    && input.request.publicationIntent === "draft";
  if (!isExactRequest) {
    return {
      ok: false,
      code: "PAGEENGINES_ONE_SHOT_REQUEST_INVALID",
      error: "PageEngines one-shot live execution requires exact review-only draft create authority.",
      status: 409,
    };
  }

  reloadState();
  if (consumptions.has(configuration.grantId)) {
    return {
      ok: false,
      code: "PAGEENGINES_ONE_SHOT_ALREADY_CONSUMED",
      error: "PageEngines one-shot live execution authorization is already consumed.",
      status: 409,
    };
  }

  const fingerprint = requestFingerprint({
    request: input.request,
    action: input.action,
    workflowId: input.workflowId,
  });
  consumptions.set(configuration.grantId, {
    grantId: configuration.grantId,
    consumedAt: now.toISOString(),
    principalId: input.principal.principalId,
    principalSessionId: input.principal.sessionId,
    requestFingerprint: fingerprint,
    workflowId: input.workflowId,
  });
  persistState();

  return {
    ok: true,
    grantId: configuration.grantId,
    requestFingerprint: fingerprint,
  };
}
