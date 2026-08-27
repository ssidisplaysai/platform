import "server-only";

import {
  extractGlwJobId,
  redactGlwExecutionError,
  type GlwN8nDraftDispatcher,
  type GlwN8nDraftResponse,
  type GlwN8nExecutionReader,
  type GlwN8nExecutionSnapshot,
} from "./page-execution";

export const GLW_N8N_WORKFLOW_NAME = "Master SEO Page Engine v1.0 - PRODUCTION";
export const GLW_N8N_WORKFLOW_ID = "bIDXxyWnY22G8zJC";

export type GlwN8nConfigurationStatus = {
  configured: boolean;
  webhookConfigured: boolean;
  authenticationConfigured: boolean;
  diagnosticsConfigured: boolean;
  callbackConfigured: false;
  workflowName: typeof GLW_N8N_WORKFLOW_NAME;
  workflowId: typeof GLW_N8N_WORKFLOW_ID;
};

type Configuration = {
  webhookUrl: string;
  webhookSecret: string;
  timeoutMs: number;
};

type ExecutionApiConfiguration = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
};

function readConfiguration(environment: NodeJS.ProcessEnv = process.env): Configuration | null {
  const webhookUrl = environment.GLW_N8N_PAGE_WEBHOOK_URL?.trim() ?? "";
  const webhookSecret = environment.GLW_N8N_WEBHOOK_SECRET?.trim() ?? "";
  if (!webhookUrl || !webhookSecret) return null;

  const parsedTimeout = Number(environment.GLW_N8N_TIMEOUT_MS ?? 60_000);
  const timeoutMs = Number.isFinite(parsedTimeout)
    ? Math.min(Math.max(parsedTimeout, 1_000), 120_000)
    : 60_000;
  const url = new URL(webhookUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("GLW n8n webhook must use HTTPS outside localhost.");
  }

  return { webhookUrl: url.toString(), webhookSecret, timeoutMs };
}

function readExecutionApiConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): ExecutionApiConfiguration | null {
  const webhookUrl = environment.GLW_N8N_PAGE_WEBHOOK_URL?.trim() ?? "";
  const apiKey = environment.GLW_N8N_API_KEY?.trim() ?? "";
  if (!webhookUrl || !apiKey) return null;
  const url = new URL(webhookUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("GLW n8n API must use HTTPS outside localhost.");
  }
  const parsedTimeout = Number(environment.GLW_N8N_API_TIMEOUT_MS ?? 10_000);
  const timeoutMs = Number.isFinite(parsedTimeout)
    ? Math.min(Math.max(parsedTimeout, 1_000), 30_000)
    : 10_000;
  return { baseUrl: url.origin, apiKey, timeoutMs };
}

export function getGlwN8nConfigurationStatus(
  environment: NodeJS.ProcessEnv = process.env,
): GlwN8nConfigurationStatus {
  const webhookConfigured = Boolean(environment.GLW_N8N_PAGE_WEBHOOK_URL?.trim());
  const authenticationConfigured = Boolean(environment.GLW_N8N_WEBHOOK_SECRET?.trim());
  return {
    configured: webhookConfigured && authenticationConfigured,
    webhookConfigured,
    authenticationConfigured,
    diagnosticsConfigured: Boolean(environment.GLW_N8N_API_KEY?.trim()),
    callbackConfigured: false,
    workflowName: GLW_N8N_WORKFLOW_NAME,
    workflowId: GLW_N8N_WORKFLOW_ID,
  };
}

function normalizeResponse(value: unknown): GlwN8nDraftResponse {
  const response = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const status = String(response.status ?? "").trim().toLowerCase();
  const executionId = String(response.executionId ?? response.execution_id ?? "").trim();

  if (response.accepted === true || ["accepted", "queued", "running"].includes(status)) {
    return {
      kind: "accepted",
      executionId: executionId || null,
      status: status === "running" ? "running" : "accepted",
    };
  }

  if (["complete", "completed", "success", "succeeded"].includes(status)) {
    if (!executionId) throw new Error("n8n completion did not include an execution identifier.");
    const wordpressObjectId = String(
      response.wordpressPageId ?? response.wordpressPostId ?? response.wordpress_page_id ?? "",
    ).trim();
    const wordpressUrl = String(response.wordpressUrl ?? response.wordpress_url ?? "").trim();
    const wordpressStatus = String(response.wordpressStatus ?? response.wordpress_status ?? "").trim().toLowerCase();
    if (!wordpressObjectId || !wordpressUrl || wordpressStatus !== "draft") {
      throw new Error("n8n completion did not return a WordPress draft identity.");
    }
    return { kind: "complete", executionId, status: "complete", wordpressObjectId, wordpressUrl, wordpressStatus: "draft" };
  }

  const errorValue = response.error;
  const errorRecord = errorValue && typeof errorValue === "object"
    ? errorValue as Record<string, unknown>
    : {};
  return {
    kind: "failed",
    executionId: executionId || null,
    status: "failed",
    errorCode: String(errorRecord.code ?? "N8N_EXECUTION_FAILED"),
    errorMessage: redactGlwExecutionError(errorRecord.message ?? response.message ?? "n8n execution failed."),
  };
}

function normalizeExecutionSnapshot(value: unknown, expectedExecutionId: string): GlwN8nExecutionSnapshot {
  const execution = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const executionId = String(execution.id ?? "").trim();
  if (executionId !== expectedExecutionId) {
    throw new Error("n8n execution API returned a mismatched execution identifier.");
  }
  const status = String(execution.status ?? "").trim().toLowerCase();
  const data = execution.data && typeof execution.data === "object"
    ? execution.data as Record<string, unknown>
    : {};
  const resultData = data.resultData && typeof data.resultData === "object"
    ? data.resultData as Record<string, unknown>
    : {};
  const executionError = resultData.error && typeof resultData.error === "object"
    ? resultData.error as Record<string, unknown>
    : {};
  const state = status === "success"
    ? "SUCCESS"
    : ["error", "failed", "crashed", "canceled", "cancelled"].includes(status)
      ? "FAILED"
      : "RUNNING";
  return {
    executionId,
    state,
    runData: resultData.runData ?? null,
    errorMessage: state === "FAILED"
      ? redactGlwExecutionError(executionError.message ?? `n8n execution ended with status ${status || "unknown"}.`)
      : null,
  };
}

export function createGlwN8nExecutionReader(input?: {
  environment?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): GlwN8nExecutionReader {
  const environment = input?.environment ?? process.env;
  const fetchImpl = input?.fetchImpl ?? fetch;

  return {
    async readExecution(executionId) {
      if (!/^\d+$/.test(executionId)) {
        throw new Error("n8n execution identifier must be numeric.");
      }
      const configuration = readExecutionApiConfiguration(environment);
      if (!configuration) throw new Error("GLW n8n execution diagnostics are not configured.");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs);
      try {
        const response = await fetchImpl(
          `${configuration.baseUrl}/api/v1/executions/${executionId}?includeData=true`,
          {
            method: "GET",
            headers: { "X-N8N-API-KEY": configuration.apiKey, Accept: "application/json" },
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(`n8n execution read failed with HTTP ${response.status}.`);
        return normalizeExecutionSnapshot(body, executionId);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("n8n execution read timed out.");
        }
        throw new Error(redactGlwExecutionError(error));
      } finally {
        clearTimeout(timeout);
      }
    },
    async findExecutionIds({ jobId, startedAt }) {
      const configuration = readExecutionApiConfiguration(environment);
      if (!configuration) throw new Error("GLW n8n execution diagnostics are not configured.");
      const dispatchBoundary = Date.parse(startedAt);
      if (!Number.isFinite(dispatchBoundary)) throw new Error("GLW dispatch boundary is invalid.");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs);
      try {
        const listUrl = new URL("/api/v1/executions", configuration.baseUrl);
        listUrl.searchParams.set("workflowId", GLW_N8N_WORKFLOW_ID);
        listUrl.searchParams.set("limit", "100");
        const listResponse = await fetchImpl(listUrl.toString(), {
          method: "GET",
          headers: { "X-N8N-API-KEY": configuration.apiKey, Accept: "application/json" },
          cache: "no-store",
          signal: controller.signal,
        });
        const listBody = await listResponse.json().catch(() => null) as { data?: unknown } | null;
        if (!listResponse.ok) throw new Error(`n8n execution search failed with HTTP ${listResponse.status}.`);
        const candidates = Array.isArray(listBody?.data)
          ? listBody.data.filter((value): value is Record<string, unknown> => Boolean(value && typeof value === "object"))
          : [];
        const candidateIds = candidates
          .filter((candidate) => candidate.mode === "webhook")
          .filter((candidate) => {
            const candidateStartedAt = Date.parse(String(candidate.startedAt ?? ""));
            return Number.isFinite(candidateStartedAt) && candidateStartedAt >= dispatchBoundary;
          })
          .map((candidate) => String(candidate.id ?? ""))
          .filter((executionId) => /^\d+$/.test(executionId));

        const matches: string[] = [];
        for (const executionId of candidateIds) {
          const detailResponse = await fetchImpl(
            `${configuration.baseUrl}/api/v1/executions/${executionId}?includeData=true`,
            {
              method: "GET",
              headers: { "X-N8N-API-KEY": configuration.apiKey, Accept: "application/json" },
              cache: "no-store",
              signal: controller.signal,
            },
          );
          const detailBody = await detailResponse.json().catch(() => null);
          if (!detailResponse.ok) throw new Error(`n8n execution read failed with HTTP ${detailResponse.status}.`);
          const snapshot = normalizeExecutionSnapshot(detailBody, executionId);
          if (extractGlwJobId(snapshot.runData) === jobId) matches.push(executionId);
        }
        return matches;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("n8n execution discovery timed out.");
        }
        throw new Error(redactGlwExecutionError(error));
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function createGlwN8nDraftDispatcher(input?: {
  environment?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}): GlwN8nDraftDispatcher {
  const environment = input?.environment ?? process.env;
  const fetchImpl = input?.fetchImpl ?? fetch;

  return {
    async dispatch(request) {
      const configuration = readConfiguration(environment);
      if (!configuration) {
        throw new Error("GLW n8n draft execution is not configured.");
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs);
      try {
        const response = await fetchImpl(configuration.webhookUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${configuration.webhookSecret}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(request),
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(`n8n draft dispatch failed with HTTP ${response.status}.`);
        }
        return normalizeResponse(body);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error("n8n draft dispatch timed out.");
        }
        throw new Error(redactGlwExecutionError(error));
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}