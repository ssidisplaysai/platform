export type GlwN8nPageGenerationRequest = {
  jobId: string;
  operationKey: string;
  publicationKey: string;
  type: "page_generation";
  workspaceId: string;
  workspace_id: string;
  site: {
    id: string;
    name: string;
  };
  page: {
    pageType: "city_service" | "state_service" | "general_service";
    page_type: "city_service" | "state_service" | "general_service";
    productTopic: string;
    product_topic: string;
    state: string;
    city: string;
    citySlug: string;
    city_slug: string;
    hierarchicalSlug: string;
    hierarchical_slug: string;
    additionalInstructions: string;
    additional_instructions: string;
    title: string;
    targetSlug: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    wordCount: number;
    tone: string;
    audience: string;
    callToAction: string;
    category: string;
    status: "draft" | "publish";
  };
  promptData: {
    tone: string;
    audience: string;
    callToAction: string;
  };
  seoSettings: {
    targetSlug: string;
    citySlug: string;
    city_slug: string;
    primaryKeyword: string;
    secondaryKeywords: string[];
    category: string;
  };
  publishingSettings: {
    status: "draft" | "publish";
    wordCount: number;
  };
  imageSettings: {
    generateFeaturedImage: boolean;
    style: string;
  };
  workflowContext: {
    workspaceId: string;
    pageType: "city_service" | "state_service" | "general_service";
    productTopic: string;
    state: string;
    city: string;
    citySlug: string;
    hierarchicalSlug: string;
    additionalInstructions: string;
  };
  callbackUrl?: string;
  authToken?: string;
};

export type GlwN8nAcceptedResponse = {
  kind: "accepted";
  executionId: string;
  status: "accepted" | "running";
  title?: string;
};

export type GlwN8nCompleteResponse = {
  kind: "complete";
  executionId: string;
  status: "complete" | "completed" | "success" | "succeeded";
  title: string;
  wordpressPageId?: string | number;
  wordpressUrl: string;
  wordpressPostId: string | number;
  wordpressStatus?: "draft" | "publish" | "qa_failed";
  requestedPublishingMode?: "draft" | "publish";
  disposition?: "CREATED" | "UPDATED" | "SKIPPED_DUPLICATE" | "FAILED_QA" | (string & {});
  qaChecks?: Record<string, unknown>;
  qaFailureReasons?: Record<string, unknown>;
  featuredImageUrl?: string;
  executionTimeMs?: number;
};

export type GlwN8nFailedResponse = {
  kind: "failed";
  executionId?: string;
  status: "failed";
  error: {
    message: string;
    step?: string;
  };
};

export type GlwN8nResponse = GlwN8nAcceptedResponse | GlwN8nCompleteResponse | GlwN8nFailedResponse;

export type GlwN8nTransport = {
  invokePageGeneration(request: GlwN8nPageGenerationRequest): Promise<GlwN8nResponse>;
};

export type GlwN8nExecutionDiagnostics = {
  executionId: string;
  executionState: string;
  currentNode: string | null;
  lastCompletedNode: string | null;
  errorNode: string | null;
  errorDescription: string | null;
  errorHttpCode: number | "UNKNOWN";
  startedAt: string | null;
  lastUpdatedAt: string | null;
  durationMs: number | null;
  error: string | null;
  terminal: boolean;
  deepLinkUrl: string;
};

export type GlwN8nExecutionLookupResult =
  | {
      available: true;
      diagnostics: GlwN8nExecutionDiagnostics;
    }
  | {
      available: false;
      reason: string;
      deepLinkUrl: string | null;
      upstreamStatus?: number;
      upstreamContentType?: string | null;
      upstreamMessage?: string | null;
    };

export type GlwN8nExecutionService = {
  getExecutionDiagnostics(executionId: string): Promise<GlwN8nExecutionLookupResult>;
  getExecutionUrl(executionId: string): string | null;
};

export class GlwN8nAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GlwN8nAdapterError";
  }
}

function getRequiredValue(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new GlwN8nAdapterError(`${name} is required for GLW page generation.`);
  }

  return value;
}

function getAuthorizationHeader(): string {
  return `Bearer ${getRequiredValue("GLW_N8N_WEBHOOK_SECRET")}`;
}

function normalizeIsoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDurationMs(payload: Record<string, unknown>, startedAt: string | null, lastUpdatedAt: string | null): number | null {
  const explicitDuration = payload.durationMs;

  if (typeof explicitDuration === "number" && Number.isFinite(explicitDuration) && explicitDuration >= 0) {
    return explicitDuration;
  }

  const startedTime = startedAt ? Date.parse(startedAt) : Number.NaN;
  const updatedTime = lastUpdatedAt ? Date.parse(lastUpdatedAt) : Number.NaN;

  if (Number.isFinite(startedTime) && Number.isFinite(updatedTime) && updatedTime >= startedTime) {
    return updatedTime - startedTime;
  }

  return null;
}

function extractLastCompletedNode(runData: unknown): string | null {
  if (typeof runData !== "object" || runData === null) {
    return null;
  }

  let latestNode: string | null = null;
  let latestTime = 0;

  for (const [nodeName, runsUnknown] of Object.entries(runData as Record<string, unknown>)) {
    if (!Array.isArray(runsUnknown)) {
      continue;
    }

    for (const run of runsUnknown) {
      if (!Array.isArray(run)) {
        continue;
      }

      for (const item of run) {
        if (typeof item !== "object" || item === null) {
          continue;
        }

        const candidate = item as Record<string, unknown>;
        const hasError = candidate.error !== undefined && candidate.error !== null;
        if (hasError) {
          continue;
        }

        const startedAt = normalizeIsoTimestamp(candidate.startTime) ?? normalizeIsoTimestamp(candidate.startedAt);
        const executionTimeMs = typeof candidate.executionTime === "number" ? candidate.executionTime : 0;
        const startedMs = startedAt ? Date.parse(startedAt) : Number.NaN;

        if (!Number.isFinite(startedMs)) {
          continue;
        }

        const completedMs = startedMs + Math.max(0, executionTimeMs);
        if (completedMs > latestTime) {
          latestTime = completedMs;
          latestNode = nodeName;
        }
      }
    }
  }

  return latestNode;
}

function normalizeExecutionState(value: unknown): string {
  if (typeof value !== "string") {
    return "UNKNOWN";
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized.toUpperCase() : "UNKNOWN";
}

function isTerminalState(state: string): boolean {
  return ["SUCCESS", "SUCCEEDED", "COMPLETE", "COMPLETED", "FAILED", "ERROR", "CANCELED", "CANCELLED", "CRASHED"].includes(state);
}

function extractExecutionPayload(rawPayload: unknown): Record<string, unknown> | null {
  const root = asRecord(rawPayload);
  if (!root) {
    return null;
  }

  const rootDataRecord = asRecord(root.data);
  const rootExecution = asRecord(root.execution);
  const dataExecution = asRecord(rootDataRecord?.execution);

  const candidates: Record<string, unknown>[] = [
    root,
    ...(rootDataRecord ? [rootDataRecord] : []),
    ...(rootExecution ? [rootExecution] : []),
    ...(dataExecution ? [dataExecution] : []),
    ...asRecordArray(root.data),
    ...asRecordArray(root.results),
    ...asRecordArray(root.items),
  ];

  return candidates.find((candidate) => looksLikeExecutionPayload(candidate)) ?? null;
}

function getExecutionOrigin(): string {
  const webhookUrl = getRequiredValue("GLW_N8N_PAGE_WEBHOOK_URL");
  return new URL(webhookUrl).origin;
}

function sanitizeContentType(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value.split(";")[0]?.trim().toLowerCase() ?? null;
}

function sanitizeTextMessage(value: string, limit = 240): string {
  const collapsed = value
    .replace(/\bBearer\s+[A-Za-z0-9._\-+/=]+/gi, "Bearer [REDACTED]")
    .replace(/\b(sk|rk)-[A-Za-z0-9]{10,}\b/g, "[REDACTED_KEY]")
    .replace(/(x-n8n-api-key|authorization|api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) {
    return "";
  }

  return collapsed.length > limit ? `${collapsed.slice(0, limit - 1)}…` : collapsed;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asRecord(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null);
}

function looksLikeExecutionPayload(payload: Record<string, unknown>): boolean {
  return (
    payload.id !== undefined
    || payload.executionId !== undefined
    || payload.status !== undefined
    || payload.finished !== undefined
    || payload.currentNode !== undefined
    || payload.startedAt !== undefined
    || payload.stoppedAt !== undefined
    || payload.updatedAt !== undefined
    || payload.resultData !== undefined
    || payload.data !== undefined
  );
}

function isNumericExecutionId(executionId: string): boolean {
  return /^\d+$/.test(executionId);
}

function summarizeJsonShape(payload: unknown): string {
  if (payload === null) {
    return "json:null";
  }

  if (Array.isArray(payload)) {
    return `json:array(length=${payload.length})`;
  }

  if (typeof payload === "object") {
    const keys = Object.keys(payload as Record<string, unknown>);
    const keySummary = keys.slice(0, 8).join(", ");
    const suffix = keys.length > 8 ? ", …" : "";
    return `json:object(keys=${keySummary}${suffix})`;
  }

  return `json:${typeof payload}`;
}

function extractSanitizedJsonMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  const messageValue =
    typeof candidate.message === "string"
      ? candidate.message
      : typeof candidate.error === "string"
        ? candidate.error
        : typeof candidate.detail === "string"
          ? candidate.detail
          : null;

  if (!messageValue) {
    return null;
  }

  return sanitizeTextMessage(messageValue);
}

function normalizePublishingStatus(value: unknown): "draft" | "publish" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "draft" || normalized === "publish") {
    return normalized;
  }

  return undefined;
}

function normalizeWorkflowWordpressStatus(value: unknown): "draft" | "publish" | "qa_failed" | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "draft" || normalized === "publish" || normalized === "qa_failed") {
    return normalized;
  }

  return undefined;
}

function extractN8nErrorFields(resultData: Record<string, unknown> | null, topLevelError: unknown): {
  errorMessage: string | null;
  errorDescription: string | null;
  errorNode: string;
  errorHttpCode: number | "UNKNOWN";
} {
  const rawError = resultData?.error ?? topLevelError;

  if (typeof rawError === "string") {
    return {
      errorMessage: sanitizeTextMessage(rawError),
      errorDescription: "UNKNOWN",
      errorNode: "UNKNOWN",
      errorHttpCode: "UNKNOWN",
    };
  }

  if (typeof rawError !== "object" || rawError === null) {
    return {
      errorMessage: null,
      errorDescription: "UNKNOWN",
      errorNode: "UNKNOWN",
      errorHttpCode: "UNKNOWN",
    };
  }

  const errorObject = rawError as Record<string, unknown>;
  const errorMessage = typeof errorObject.message === "string" ? sanitizeTextMessage(errorObject.message) : null;
  const errorDescription = typeof errorObject.description === "string" ? sanitizeTextMessage(errorObject.description) : "UNKNOWN";
  const errorHttpCode = typeof errorObject.httpCode === "number" ? errorObject.httpCode : "UNKNOWN";

  let errorNode = "UNKNOWN";
  const node = errorObject.node;
  if (typeof node === "string") {
    errorNode = sanitizeTextMessage(node, 120);
  } else if (typeof node === "object" && node !== null && typeof (node as Record<string, unknown>).name === "string") {
    errorNode = sanitizeTextMessage((node as Record<string, unknown>).name as string, 120);
  }

  return {
    errorMessage,
    errorDescription,
    errorNode,
    errorHttpCode,
  };
}

function classifyUpstreamStatusReason(status: number): string {
  if (status === 401) {
    return "n8n API key was rejected.";
  }

  if (status === 403) {
    return "n8n API key lacks execution read permission.";
  }

  if (status === 404) {
    return "Execution was not found or is no longer retained.";
  }

  return `n8n execution API returned HTTP ${status}.`;
}

function resolveExecutionState(payload: Record<string, unknown>, resultData: Record<string, unknown> | null): string {
  if (typeof payload.status === "string" && payload.status.trim()) {
    return normalizeExecutionState(payload.status);
  }

  if (typeof payload.finished === "boolean") {
    if (!payload.finished) {
      return "RUNNING";
    }

    const hasError = Boolean(
      (typeof payload.error === "string" && payload.error.trim())
      || (typeof payload.error === "object" && payload.error !== null)
      || (typeof resultData?.error === "object" && resultData.error !== null)
      || (typeof resultData?.error === "string" && resultData.error.trim()),
    );

    return hasError ? "FAILED" : "SUCCESS";
  }

  return "UNKNOWN";
}

export function createGlwN8nExecutionService(options?: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  apiKey?: string;
}): GlwN8nExecutionService {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 15000;

  function getApiKey(): string {
    const fromOptions = options?.apiKey?.trim();
    if (fromOptions) {
      return fromOptions;
    }

    return process.env.GLW_N8N_API_KEY?.trim() ?? "";
  }

  function getExecutionUrl(executionId: string): string | null {
    try {
      return `${getExecutionOrigin()}/execution/${encodeURIComponent(executionId)}`;
    } catch {
      return null;
    }
  }

  return {
    getExecutionUrl,
    async getExecutionDiagnostics(executionId: string): Promise<GlwN8nExecutionLookupResult> {
      const normalizedExecutionId = executionId.trim();
      const deepLinkUrl = getExecutionUrl(normalizedExecutionId);

      if (!normalizedExecutionId) {
        return {
          available: false,
          reason: "Execution id is required.",
          deepLinkUrl,
        };
      }

      if (!isNumericExecutionId(normalizedExecutionId)) {
        return {
          available: false,
          reason: "Diagnostics unavailable for legacy execution",
          deepLinkUrl,
        };
      }

      const apiKey = getApiKey();

      if (!apiKey) {
        return {
          available: false,
          reason: "GLW_N8N_API_KEY is not configured.",
          deepLinkUrl,
        };
      }

      let origin: string;
      try {
        origin = getExecutionOrigin();
      } catch (error) {
        return {
          available: false,
          reason: error instanceof Error ? error.message : "GLW n8n origin is unavailable.",
          deepLinkUrl,
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const buildExecutionUrl = (includeData?: boolean): string => {
          const params = new URLSearchParams();
          if (includeData !== undefined) {
            params.set("includeData", includeData ? "true" : "false");
          }
          const query = params.toString();
          return `${origin}/api/v1/executions/${encodeURIComponent(normalizedExecutionId)}${query ? `?${query}` : ""}`;
        };

        const fetchExecutionPayload = async (includeData?: boolean) => {
          const diagnosticsUrl = buildExecutionUrl(includeData);
          const response = await fetchImpl(diagnosticsUrl, {
            method: "GET",
            headers: {
              "X-N8N-API-KEY": apiKey,
              Accept: "application/json",
            },
            signal: controller.signal,
          });

          const upstreamStatus = response.status;
          const upstreamContentType = sanitizeContentType(response.headers.get("content-type"));
          const rawBody = await response.text().catch(() => "");
          const isJsonResponse = Boolean(upstreamContentType?.includes("application/json"));

          let parsedJson: unknown = null;
          if (isJsonResponse && rawBody.trim()) {
            parsedJson = JSON.parse(rawBody);
          }

          return {
            response,
            upstreamStatus,
            upstreamContentType,
            rawBody,
            isJsonResponse,
            parsedJson,
          };
        };

        // Prefer rich execution payloads. Some historical cloud executions fail on includeData=true,
        // so fallback to metadata-only to preserve telemetry availability.
        let executionFetch = await fetchExecutionPayload(true);
        if (!executionFetch.response.ok && executionFetch.upstreamStatus >= 500) {
          executionFetch = await fetchExecutionPayload(false);
        }

        const {
          response,
          upstreamStatus,
          upstreamContentType,
          rawBody,
          isJsonResponse,
          parsedJson,
        } = executionFetch;

        if (!response.ok) {
          const statusReason = classifyUpstreamStatusReason(upstreamStatus);
          const sanitizedMessage = isJsonResponse
            ? (extractSanitizedJsonMessage(parsedJson) ?? summarizeJsonShape(parsedJson))
            : (sanitizeTextMessage(rawBody) || null);

          return {
            available: false,
            reason: statusReason,
            deepLinkUrl,
            upstreamStatus,
            upstreamContentType,
            upstreamMessage: sanitizedMessage,
          };
        }

        if (!isJsonResponse) {
          return {
            available: false,
            reason: "n8n returned a non-API response; verify the API base URL and path.",
            deepLinkUrl,
            upstreamStatus,
            upstreamContentType,
            upstreamMessage: sanitizeTextMessage(rawBody) || null,
          };
        }

        const executionPayload = extractExecutionPayload(parsedJson);

        if (!executionPayload) {
          return {
            available: false,
            reason: "Unexpected JSON response from n8n execution API.",
            deepLinkUrl,
            upstreamStatus,
            upstreamContentType,
            upstreamMessage: summarizeJsonShape(parsedJson),
          };
        }

        const startedAt = normalizeIsoTimestamp(executionPayload.startedAt)
          ?? normalizeIsoTimestamp(executionPayload.started)
          ?? normalizeIsoTimestamp(executionPayload.createdAt);
        const stoppedAt = normalizeIsoTimestamp(executionPayload.stoppedAt)
          ?? normalizeIsoTimestamp(executionPayload.endedAt);
        const updatedAt = normalizeIsoTimestamp(executionPayload.updatedAt)
          ?? normalizeIsoTimestamp(executionPayload.lastUpdatedAt)
          ?? normalizeIsoTimestamp(executionPayload.finishedAt);
        const lastUpdatedAt = stoppedAt ?? updatedAt ?? startedAt;
        const nestedData = asRecord(executionPayload.data);
        const nestedResultData = nestedData
          ? nestedData.resultData
          : undefined;
        const resultData = typeof nestedResultData === "object" && nestedResultData !== null
          ? nestedResultData as Record<string, unknown>
          : typeof executionPayload.resultData === "object" && executionPayload.resultData !== null
            ? executionPayload.resultData as Record<string, unknown>
            : null;
        const executionState = resolveExecutionState(executionPayload, resultData);
        const runData = resultData?.runData;
        const currentNode =
          (typeof executionPayload.currentNode === "string" ? sanitizeTextMessage(executionPayload.currentNode, 120) : null)
          ?? (typeof executionPayload.lastNodeExecuted === "string" ? sanitizeTextMessage(executionPayload.lastNodeExecuted, 120) : null)
          ?? (typeof resultData?.lastNodeExecuted === "string" ? sanitizeTextMessage(resultData.lastNodeExecuted, 120) : null)
          ?? "UNKNOWN";
        const lastCompletedNode = extractLastCompletedNode(runData);
        const errorFields = extractN8nErrorFields(resultData, executionPayload.error);
        const errorMessage =
          errorFields.errorMessage
          ?? (typeof executionPayload.error === "string" ? sanitizeTextMessage(executionPayload.error) : "UNKNOWN");
        const effectiveCurrentNode = currentNode ?? errorFields.errorNode;

        return {
          available: true,
          diagnostics: {
            executionId: String(executionPayload.id ?? executionPayload.executionId ?? normalizedExecutionId),
            executionState,
            currentNode: effectiveCurrentNode,
            lastCompletedNode: lastCompletedNode ?? "UNKNOWN",
            errorNode: errorFields.errorNode,
            errorDescription: errorFields.errorDescription,
            errorHttpCode: errorFields.errorHttpCode,
            startedAt,
            lastUpdatedAt,
            durationMs: normalizeDurationMs(executionPayload, startedAt, lastUpdatedAt),
            error: errorMessage,
            terminal: isTerminalState(executionState),
            deepLinkUrl: deepLinkUrl ?? `${origin}/execution/${encodeURIComponent(normalizedExecutionId)}`,
          },
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return {
            available: false,
            reason: "n8n execution API request timed out.",
            deepLinkUrl,
          };
        }

        if (error instanceof SyntaxError) {
          return {
            available: false,
            reason: "n8n returned a non-API response; verify the API base URL and path.",
            deepLinkUrl,
          };
        }

        return {
          available: false,
          reason: error instanceof Error ? error.message : "Unable to retrieve n8n execution diagnostics.",
          deepLinkUrl,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function parseJsonResponse(payload: unknown): GlwN8nResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new GlwN8nAdapterError("GLW n8n webhook returned an invalid JSON payload.");
  }

  const response = payload as Record<string, unknown>;
  const status = typeof response.status === "string" ? response.status.toLowerCase() : "";
  const executionId = typeof response.executionId === "string" ? response.executionId.trim() : "";

  if (!executionId) {
    throw new GlwN8nAdapterError("GLW n8n webhook response did not include an execution identifier.");
  }

  if (status === "accepted" || status === "running") {
    return {
      kind: "accepted",
      executionId,
      status,
      title: typeof response.title === "string" ? response.title : undefined,
    };
  }

  if (status === "complete" || status === "completed" || status === "success" || status === "succeeded") {
    const wordpressUrl = typeof response.wordpressUrl === "string" ? response.wordpressUrl.trim() : "";
    const wordpressPostId = response.wordpressPostId;
    const wordpressPageId = response.wordpressPageId;
    const pageIdentifier = wordpressPageId ?? wordpressPostId;
    const title = typeof response.title === "string" ? response.title.trim() : "";
    const featuredImageUrl = typeof response.featuredImageUrl === "string"
      ? response.featuredImageUrl.trim()
      : undefined;
    const wordpressStatus = normalizeWorkflowWordpressStatus(response.wordpressStatus);
    const requestedPublishingMode = normalizePublishingStatus(response.requestedPublishingMode);
    const disposition = typeof response.disposition === "string" ? response.disposition.trim().toUpperCase() : undefined;
    const qaChecks = typeof response.qaChecks === "object" && response.qaChecks !== null
      ? response.qaChecks as Record<string, unknown>
      : undefined;
    const qaFailureReasons = typeof response.qaFailureReasons === "object" && response.qaFailureReasons !== null
      ? response.qaFailureReasons as Record<string, unknown>
      : undefined;
    const executionTimeMs = typeof response.executionTimeMs === "number"
      ? response.executionTimeMs
      : undefined;

    if (!wordpressUrl || !title || pageIdentifier === undefined || pageIdentifier === null || pageIdentifier === "") {
      throw new GlwN8nAdapterError("GLW n8n webhook returned a completion response without the required WordPress fields.");
    }

    return {
      kind: "complete",
      executionId,
      status: status as GlwN8nCompleteResponse["status"],
      title,
      wordpressPageId: pageIdentifier as string | number,
      wordpressUrl,
      wordpressPostId: (wordpressPostId as string | number | undefined) ?? (pageIdentifier as string | number),
      wordpressStatus,
      requestedPublishingMode,
      disposition,
      qaChecks,
      qaFailureReasons,
      featuredImageUrl,
      executionTimeMs,
    };
  }

  if (status === "failed") {
    const error = response.error;

    if (typeof error !== "object" || error === null || typeof (error as { message?: unknown }).message !== "string") {
      throw new GlwN8nAdapterError("GLW n8n webhook returned a failure response without an error message.");
    }

    return {
      kind: "failed",
      executionId: executionId || undefined,
      status: "failed",
      error: {
        message: (error as { message: string }).message,
        step: typeof (error as { step?: unknown }).step === "string" ? (error as { step: string }).step : undefined,
      },
    };
  }

  throw new GlwN8nAdapterError("GLW n8n webhook returned an unsupported status value.");
}

export function createGlwN8nTransport(options?: {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): GlwN8nTransport {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 30000;

  return {
    async invokePageGeneration(request: GlwN8nPageGenerationRequest): Promise<GlwN8nResponse> {
      const webhookUrl = getRequiredValue("GLW_N8N_PAGE_WEBHOOK_URL");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetchImpl(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: getAuthorizationHeader(),
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          throw new GlwN8nAdapterError(`GLW n8n webhook returned ${response.status} ${response.statusText}${body ? `: ${body}` : ""}`);
        }

        const payload = await response.json().catch(() => {
          throw new GlwN8nAdapterError("GLW n8n webhook returned invalid JSON.");
        });

        return parseJsonResponse(payload);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new GlwN8nAdapterError("GLW n8n webhook request timed out.");
        }

        if (error instanceof GlwN8nAdapterError) {
          throw error;
        }

        throw new GlwN8nAdapterError(error instanceof Error ? error.message : "GLW n8n webhook request failed.");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
