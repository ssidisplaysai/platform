import "server-only";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  redactGlwExecutionError,
  type GlwN8nDraftDispatcher,
  type GlwN8nExecutionReader,
  type GlwN8nExecutionSnapshot,
} from "./page-execution";
import { GLW_N8N_WORKFLOW_ID } from "./n8n-draft-adapter";
import { validateGlwN8nMcpDraftRequest } from "./n8n-mcp-recovery-contract";

export const GLW_N8N_MCP_TRANSPORT = "N8N_MCP" as const;
export const GLW_N8N_MCP_RECOVERY_WORKFLOW_ID = "9WTjTDXX0QNgF6Mw";
export const GLW_N8N_MCP_ENGINE_WORKFLOW_ID = GLW_N8N_WORKFLOW_ID;

type McpConfiguration = {
  url: URL;
  token: string;
  timeoutMs: number;
};

type McpToolResult = {
  structuredContent?: unknown;
  content?: Array<{ type?: string; text?: string }>;
  isError?: boolean;
};

type McpToolCaller = (name: string, argumentsValue: Record<string, unknown>) => Promise<McpToolResult>;

function readConfiguration(environment: NodeJS.ProcessEnv = process.env): McpConfiguration | null {
  const rawUrl = environment.GLW_N8N_MCP_URL?.trim() ?? "";
  const token = environment.GLW_N8N_MCP_TOKEN?.trim() ?? "";
  if (!rawUrl || !token) return null;
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error("GLW n8n MCP endpoint must use HTTPS outside localhost.");
  }
  const parsedTimeout = Number(environment.GLW_N8N_MCP_TIMEOUT_MS ?? 15_000);
  const timeoutMs = Number.isFinite(parsedTimeout)
    ? Math.min(Math.max(parsedTimeout, 1_000), 60_000)
    : 15_000;
  return { url, token, timeoutMs };
}

export function getGlwN8nMcpConfigurationStatus(environment: NodeJS.ProcessEnv = process.env) {
  const urlConfigured = Boolean(environment.GLW_N8N_MCP_URL?.trim());
  const tokenConfigured = Boolean(environment.GLW_N8N_MCP_TOKEN?.trim());
  return {
    configured: urlConfigured && tokenConfigured,
    urlConfigured,
    tokenConfigured,
    transport: GLW_N8N_MCP_TRANSPORT,
    workflowId: GLW_N8N_MCP_RECOVERY_WORKFLOW_ID,
    engineWorkflowId: GLW_N8N_MCP_ENGINE_WORKFLOW_ID,
  } as const;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseToolResult(result: McpToolResult): Record<string, unknown> {
  const structured = asRecord(result.structuredContent);
  if (structured) return structured;
  const text = result.content?.find((entry) => entry.type === "text")?.text;
  if (!text) throw new Error("n8n MCP tool returned no structured result.");
  const parsed = JSON.parse(text) as unknown;
  const record = asRecord(parsed);
  if (!record) throw new Error("n8n MCP tool returned a malformed result.");
  return record;
}

function extractToolError(result: McpToolResult): string {
  const structured = asRecord(result.structuredContent);
  const structuredError = structured?.error ?? structured?.message;
  if (typeof structuredError === "string" && structuredError.trim()) {
    return redactGlwExecutionError(structuredError);
  }
  const text = result.content?.find((entry) => entry.type === "text" && entry.text)?.text?.trim();
  if (!text) return "n8n MCP tool returned an error.";
  try {
    const parsed = asRecord(JSON.parse(text) as unknown);
    const parsedError = parsed?.error ?? parsed?.message;
    if (typeof parsedError === "string" && parsedError.trim()) {
      return redactGlwExecutionError(parsedError);
    }
  } catch {
    return redactGlwExecutionError(text);
  }
  return redactGlwExecutionError(text);
}

async function withMcpClient<T>(input: {
  environment: NodeJS.ProcessEnv;
  operation: (client: Client) => Promise<T>;
}): Promise<T> {
  const configuration = readConfiguration(input.environment);
  if (!configuration) throw new Error("GLW n8n MCP execution is not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), configuration.timeoutMs);
  const client = new Client({ name: "genesis-glw", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(configuration.url, {
    requestInit: {
      headers: { Authorization: `Bearer ${configuration.token}` },
      signal: controller.signal,
    },
  });
  try {
    await client.connect(transport);
    return await input.operation(client);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("n8n MCP request timed out.");
    throw new Error(redactGlwExecutionError(error));
  } finally {
    clearTimeout(timeout);
    await client.close().catch(() => undefined);
  }
}

function createToolCaller(environment: NodeJS.ProcessEnv, injected?: McpToolCaller): McpToolCaller {
  if (injected) {
    return async (name, argumentsValue) => {
      if (!readConfiguration(environment)) throw new Error("GLW n8n MCP execution is not configured.");
      try {
        return await injected(name, argumentsValue);
      } catch (error) {
        throw new Error(redactGlwExecutionError(error));
      }
    };
  }
  return (name, argumentsValue) => withMcpClient({
    environment,
    operation: async (client) => client.callTool({ name, arguments: argumentsValue }) as Promise<McpToolResult>,
  });
}

function normalizeExecution(value: Record<string, unknown>, expectedExecutionId: string): GlwN8nExecutionSnapshot {
  const execution = asRecord(value.execution);
  const executionId = String(execution?.id ?? "").trim();
  if (executionId !== expectedExecutionId) throw new Error("n8n MCP returned a mismatched execution identifier.");
  const status = String(execution?.status ?? "").trim().toLowerCase();
  const state = status === "success"
    ? "SUCCESS"
    : ["error", "failed", "crashed", "canceled", "cancelled"].includes(status)
      ? "FAILED"
      : "RUNNING";
  const data = asRecord(value.data);
  const resultData = asRecord(data?.resultData);
  const executionError = asRecord(resultData?.error);
  return {
    executionId,
    state,
    runData: resultData?.runData ?? null,
    errorMessage: state === "FAILED"
      ? redactGlwExecutionError(executionError?.message ?? value.error ?? `n8n execution ended with status ${status || "unknown"}.`)
      : null,
  };
}

export function createGlwN8nMcpDispatcher(input?: {
  environment?: NodeJS.ProcessEnv;
  callTool?: McpToolCaller;
}): GlwN8nDraftDispatcher {
  const environment = input?.environment ?? process.env;
  const callTool = createToolCaller(environment, input?.callTool);
  return {
    async dispatch(request) {
      const validatedRequest = validateGlwN8nMcpDraftRequest(request);
      const result = await callTool("execute_workflow", {
        workflowId: GLW_N8N_MCP_RECOVERY_WORKFLOW_ID,
        executionMode: "production",
        inputs: {
          type: "webhook",
          webhookData: {
            method: "POST",
            body: validatedRequest,
          },
        },
      });
      if (result.isError) {
        throw new Error(`n8n MCP execute_workflow failed: ${extractToolError(result)}`);
      }
      let parsed: Record<string, unknown>;
      try {
        parsed = parseToolResult(result);
      } catch {
        throw new Error("n8n MCP dispatch did not return a valid execution identifier.");
      }
      const executionId = String(parsed.executionId ?? "").trim();
      if (parsed.status !== "started" || !/^\d+$/.test(executionId)) {
        const detail = typeof parsed.error === "string" && parsed.error.trim()
          ? ` ${redactGlwExecutionError(parsed.error)}`
          : "";
        throw new Error(`n8n MCP dispatch did not return a valid execution identifier.${detail}`);
      }
      return { kind: "accepted", executionId, status: "accepted" };
    },
  };
}

export function createGlwN8nMcpExecutionReader(input?: {
  environment?: NodeJS.ProcessEnv;
  callTool?: McpToolCaller;
}): GlwN8nExecutionReader {
  const environment = input?.environment ?? process.env;
  const callTool = createToolCaller(environment, input?.callTool);
  return {
    async readExecution(executionId) {
      if (!/^\d+$/.test(executionId)) throw new Error("n8n execution identifier must be numeric.");
      const result = await callTool("get_workflow_execution", {
        workflowId: GLW_N8N_MCP_RECOVERY_WORKFLOW_ID,
        executionId,
        includeData: true,
      });
      if (result.isError) throw new Error("n8n MCP execution read failed.");
      return normalizeExecution(parseToolResult(result), executionId);
    },
    async findExecutionIds() {
      throw new Error("Execution discovery is not supported for n8n MCP transport.");
    },
  };
}