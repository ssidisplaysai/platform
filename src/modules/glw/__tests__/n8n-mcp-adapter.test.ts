import { FOUNDATION_PRODUCTS } from "@/modules/foundation/catalog-fixtures";
import { FOUNDATION_SITE_FIXTURES } from "@/modules/foundation/site-fixtures";
import {
  createGlwN8nMcpDispatcher,
  createGlwN8nMcpExecutionReader,
  getGlwN8nMcpConfigurationStatus,
  GLW_N8N_MCP_ENGINE_WORKFLOW_ID,
  GLW_N8N_MCP_RECOVERY_WORKFLOW_ID,
} from "../n8n-mcp-adapter";
import { GLW_N8N_WORKFLOW_ID } from "../n8n-draft-adapter";
import { validateGlwN8nMcpDraftRequest } from "../n8n-mcp-recovery-contract";
import {
  createGlwDraftExecutionService,
  createInMemoryGlwPageExecutionRepository,
  mapGenerationRequestToN8nDraft,
  type GlwN8nDraftRequest,
} from "../page-execution";
import {
  adaptProductForGeneration,
  adaptSiteForGeneration,
  buildLocalGlwGenerationPreview,
  createDefaultGlwGenerationInput,
} from "../page-generation";

const site = adaptSiteForGeneration(FOUNDATION_SITE_FIXTURES[0]);
const product = adaptProductForGeneration(FOUNDATION_PRODUCTS[0], site.siteId);
const request = buildLocalGlwGenerationPreview({
  form: createDefaultGlwGenerationInput(site, product),
  sites: [site],
  products: [product],
}).request!;
const mappedRequest = mapGenerationRequestToN8nDraft("glw-job-mcp", request);

const LIVE_EXECUTE_WORKFLOW_SCHEMA = {
  required: ["workflowId", "executionMode"],
  allowed: ["workflowId", "executionMode", "triggerNodeName", "inputs"],
  executionModes: ["manual", "production"],
  webhookMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
} as const;

function validateLiveExecuteArguments(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !LIVE_EXECUTE_WORKFLOW_SCHEMA.allowed.includes(key as never))) return false;
  if (typeof input.workflowId !== "string" || !LIVE_EXECUTE_WORKFLOW_SCHEMA.executionModes.includes(input.executionMode as never)) return false;
  if (input.triggerNodeName !== "GLW MCP Recovery Webhook") return false;
  if (!input.inputs || typeof input.inputs !== "object" || Array.isArray(input.inputs)) return false;
  const inputs = input.inputs as Record<string, unknown>;
  if (Object.keys(inputs).some((key) => key !== "webhookData")) return false;
  if (!inputs.webhookData || typeof inputs.webhookData !== "object" || Array.isArray(inputs.webhookData)) return false;
  const webhookData = inputs.webhookData as Record<string, unknown>;
  if (Object.keys(webhookData).some((key) => !["method", "query", "body", "headers"].includes(key))) return false;
  return LIVE_EXECUTE_WORKFLOW_SCHEMA.webhookMethods.includes(webhookData.method as never)
    && Boolean(webhookData.body && typeof webhookData.body === "object" && !Array.isArray(webhookData.body));
}

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    GLW_N8N_MCP_URL: "https://n8n.example.test/mcp-server/http",
    GLW_N8N_MCP_TOKEN: "mcp-secret-token",
    ...overrides,
  };
}

function nodeRun(json: Record<string, unknown>) {
  return [{ data: { main: [[{ json }]] } }];
}

function successfulExecution(executionId = "123") {
  return {
    structuredContent: {
      execution: { id: executionId, status: "success" },
      data: {
        resultData: {
          runData: {
            "Get row(s) in sheet": nodeRun({ job_id: "glw-job-mcp" }),
            "Build Pre-Publish QA Result": nodeRun({
              job_id: "glw-job-mcp",
              qa_callback_status: "COMPLETE",
              qa_disposition: "CREATED",
              qa_wordpress_status: "draft",
              qa_page_id: 19308,
              qa_wordpress_url: "https://example.test/?page_id=19308",
              qa_checks: { body: "PASS", seo: "PASS" },
              qa_failure_reasons: {},
              qa_title: "MCP draft title",
              qa_meta_title: "MCP SEO title",
              qa_focus_keyword: "indoor led video wall austin",
              qa_featured_image_url: "https://example.test/media/10.jpg",
            }),
            "Normalize Published City Page": nodeRun({
              job_id: "glw-job-mcp",
              normalized_city_page_id: 19308,
              normalized_city_page_url: "https://example.test/?page_id=19308",
              normalized_city_page_status: "draft",
              requested_publishing_mode: "draft",
              disposition: "CREATED",
            }),
            "Code in JavaScript": nodeRun({
              article_html: "<p>one two three four five</p>",
            }),
          },
        },
      },
    },
  };
}

describe("GLW n8n MCP recovery adapter", () => {
  test("accepts the existing complete GLW draft envelope unchanged", () => {
    expect(validateGlwN8nMcpDraftRequest(mappedRequest)).toBe(mappedRequest);
  });

  test("normalizes the exact sanitized 004G application site identity for the child engine", () => {
    const normalized = validateGlwN8nMcpDraftRequest({
      ...mappedRequest,
      jobId: "12a099f9-0f42-4f01-a707-30b3b8f3a29c",
      site: { ...mappedRequest.site, id: "site-led-display-warehouse-production" },
    });

    expect(normalized.site.id).toBe("site-led-display-warehouse-production");
    expect(normalized.jobId).toBe("12a099f9-0f42-4f01-a707-30b3b8f3a29c");
    expect(normalized.page).toMatchObject({ state: "Texas", city: "Austin", status: "draft" });
    expect(normalized.callbackUrl).toBe("");
  });

  test.each(["publish", "published"])("rejects %s publication intent before MCP dispatch", async (status) => {
    const invalidRequest = {
      ...mappedRequest,
      publishingSettings: { ...mappedRequest.publishingSettings, status },
    } as unknown as GlwN8nDraftRequest;
    const callTool = jest.fn();
    const dispatcher = createGlwN8nMcpDispatcher({ environment: environment(), callTool });
    await expect(dispatcher.dispatch(invalidRequest)).rejects.toThrow(/draft|publication/i);
    expect(callTool).not.toHaveBeenCalled();
  });

  test("rejects a missing job ID before MCP dispatch", async () => {
    const callTool = jest.fn();
    const dispatcher = createGlwN8nMcpDispatcher({ environment: environment(), callTool });
    await expect(dispatcher.dispatch({ ...mappedRequest, jobId: "" })).rejects.toThrow("jobId");
    expect(callTool).not.toHaveBeenCalled();
  });

  test("rejects a non-empty callback URL before MCP dispatch", async () => {
    const callTool = jest.fn();
    const dispatcher = createGlwN8nMcpDispatcher({ environment: environment(), callTool });
    await expect(dispatcher.dispatch({ ...mappedRequest, callbackUrl: "https://example.test/callback" }))
      .rejects.toThrow("callback URL must be empty");
    expect(callTool).not.toHaveBeenCalled();
  });

  test("rejects a conflicting publication alias before MCP dispatch", async () => {
    const callTool = jest.fn();
    const dispatcher = createGlwN8nMcpDispatcher({ environment: environment(), callTool });
    const invalidRequest = { ...mappedRequest, publishingMode: "publish" } as unknown as GlwN8nDraftRequest;
    await expect(dispatcher.dispatch(invalidRequest)).rejects.toThrow("conflicting publication alias");
    expect(callTool).not.toHaveBeenCalled();
  });

  test("detects complete server-only MCP configuration without returning the token", () => {
    const status = getGlwN8nMcpConfigurationStatus(environment());
    expect(status).toEqual({
      configured: true,
      urlConfigured: true,
      tokenConfigured: true,
      transport: "N8N_MCP",
      workflowId: "9WTjTDXX0QNgF6Mw",
      engineWorkflowId: "bIDXxyWnY22G8zJC",
    });
    expect(JSON.stringify(status)).not.toContain("mcp-secret-token");
  });

  test("missing MCP token fails closed at configuration detection", () => {
    expect(getGlwN8nMcpConfigurationStatus(environment({ GLW_N8N_MCP_TOKEN: "" })))
      .toMatchObject({ configured: false, tokenConfigured: false });
  });

  test("missing MCP token prevents dispatch before a tool call", async () => {
    const callTool = jest.fn();
    const dispatcher = createGlwN8nMcpDispatcher({
      environment: environment({ GLW_N8N_MCP_TOKEN: "" }),
      callTool,
    });
    await expect(dispatcher.dispatch(mappedRequest)).rejects.toThrow("not configured");
    expect(callTool).not.toHaveBeenCalled();
  });

  test("constructs fixed production execute_workflow request with webhook input", async () => {
    const callTool = jest.fn().mockResolvedValue({
      structuredContent: { status: "started", executionId: "123" },
    });
    const dispatcher = createGlwN8nMcpDispatcher({ environment: environment(), callTool });
    await dispatcher.dispatch(mappedRequest);
    expect(callTool).toHaveBeenCalledWith("execute_workflow", {
      workflowId: "9WTjTDXX0QNgF6Mw",
      executionMode: "production",
      triggerNodeName: "GLW MCP Recovery Webhook",
      inputs: {
        webhookData: {
          method: "POST",
          body: expect.objectContaining({
            jobId: "glw-job-mcp",
            type: "page_generation",
            site: mappedRequest.site,
            page: mappedRequest.page,
            workflowContext: mappedRequest.workflowContext,
            publishingSettings: { status: "draft", wordCount: 1500 },
            seoSettings: mappedRequest.seoSettings,
            callbackUrl: "",
          }) as unknown as GlwN8nDraftRequest,
        },
      },
    });
    expect(validateLiveExecuteArguments(callTool.mock.calls[0][1])).toBe(true);
    expect(Object.keys(callTool.mock.calls[0][1])).toEqual(["workflowId", "executionMode", "triggerNodeName", "inputs"]);
  });

  test("live schema fixture rejects a missing webhook trigger name", () => {
    expect(validateLiveExecuteArguments({
      workflowId: "9WTjTDXX0QNgF6Mw",
      executionMode: "production",
      inputs: { webhookData: { method: "POST", body: {} } },
    })).toBe(false);
  });

  test("live schema fixture rejects unsupported webhook input keys", () => {
    expect(validateLiveExecuteArguments({
      workflowId: "9WTjTDXX0QNgF6Mw",
      executionMode: "production",
      triggerNodeName: "GLW MCP Recovery Webhook",
      inputs: { type: "webhook", webhookData: { method: "POST", body: {} } },
    })).toBe(false);
  });

  test("handles structured isError result before execution identity parsing", async () => {
    const dispatcher = createGlwN8nMcpDispatcher({
      environment: environment(),
      callTool: async () => ({ isError: true, structuredContent: { error: "token=unsafe invalid inputs" } }),
    });
    await expect(dispatcher.dispatch(mappedRequest)).rejects.toThrow(
      "n8n MCP execute_workflow failed: token=[REDACTED] invalid inputs",
    );
  });

  test("preserves and redacts plain text MCP tool errors", async () => {
    const dispatcher = createGlwN8nMcpDispatcher({
      environment: environment(),
      callTool: async () => ({ isError: true, content: [{ type: "text", text: "authorization=unsafe denied" }] }),
    });
    await expect(dispatcher.dispatch(mappedRequest)).rejects.toThrow(
      "n8n MCP execute_workflow failed: authorization=[REDACTED] denied",
    );
  });

  test("preserves and redacts JSON text MCP tool errors", async () => {
    const dispatcher = createGlwN8nMcpDispatcher({
      environment: environment(),
      callTool: async () => ({ isError: true, content: [{ type: "text", text: JSON.stringify({ error: "secret=unsafe invalid" }) }] }),
    });
    await expect(dispatcher.dispatch(mappedRequest)).rejects.toThrow(
      "n8n MCP execute_workflow failed: secret=[REDACTED] invalid",
    );
  });

  test("returns the exact execution identifier from dispatch", async () => {
    const dispatcher = createGlwN8nMcpDispatcher({
      environment: environment(),
      callTool: async () => ({ structuredContent: { status: "started", executionId: "123" } }),
    });
    await expect(dispatcher.dispatch(mappedRequest)).resolves.toEqual({
      kind: "accepted",
      executionId: "123",
      status: "accepted",
    });
  });

  test.each([
    { status: "started" },
    { status: "started", executionId: "not-numeric" },
    { status: "error", executionId: "123" },
    null,
  ])("fails closed for malformed execute result %#", async (structuredContent) => {
    const dispatcher = createGlwN8nMcpDispatcher({
      environment: environment(),
      callTool: async () => ({ structuredContent }),
    });
    await expect(dispatcher.dispatch(mappedRequest)).rejects.toThrow("valid execution identifier");
  });

  test("polls only the exact execution identifier with includeData", async () => {
    const callTool = jest.fn().mockResolvedValue(successfulExecution());
    const reader = createGlwN8nMcpExecutionReader({ environment: environment(), callTool });
    await reader.readExecution("123");
    expect(callTool).toHaveBeenCalledWith("get_workflow_execution", {
      workflowId: "9WTjTDXX0QNgF6Mw",
      executionId: "123",
      includeData: true,
    });
  });

  test("normalizes running execution without terminal data", async () => {
    const reader = createGlwN8nMcpExecutionReader({
      environment: environment(),
      callTool: async () => ({ structuredContent: { execution: { id: "123", status: "running" } } }),
    });
    await expect(reader.readExecution("123")).resolves.toEqual({
      executionId: "123",
      state: "RUNNING",
      runData: null,
      errorMessage: null,
    });
  });

  test("normalizes terminal failure and redacts its error", async () => {
    const reader = createGlwN8nMcpExecutionReader({
      environment: environment(),
      callTool: async () => ({
        structuredContent: {
          execution: { id: "123", status: "error" },
          data: { resultData: { error: { message: "token=unsafe" } } },
        },
      }),
    });
    await expect(reader.readExecution("123")).resolves.toMatchObject({
      state: "FAILED",
      errorMessage: "token=[REDACTED]",
    });
  });

  test("rejects execution reader identity mismatch", async () => {
    const reader = createGlwN8nMcpExecutionReader({
      environment: environment(),
      callTool: async () => ({ structuredContent: { execution: { id: "999", status: "running" } } }),
    });
    await expect(reader.readExecution("123")).rejects.toThrow("mismatched execution identifier");
  });

  test("MCP execution discovery is disabled", async () => {
    const reader = createGlwN8nMcpExecutionReader({
      environment: environment(),
      callTool: async () => successfulExecution(),
    });
    await expect(reader.findExecutionIds({ jobId: "glw-job-mcp", startedAt: new Date().toISOString() }))
      .rejects.toThrow("not supported");
  });

  test("persists MCP transport and exact execution ID without redispatch", async () => {
    const dispatch = jest.fn().mockResolvedValue({ kind: "accepted", executionId: "123", status: "accepted" });
    const repository = createInMemoryGlwPageExecutionRepository();
    const service = createGlwDraftExecutionService({
      repository,
      dispatcher: { dispatch },
      executionTransport: "N8N_MCP",
      createJobId: () => "glw-job-mcp",
      now: () => "2030-01-01T00:00:00.000Z",
    });
    const dispatched = await service.execute(request);
    expect(dispatched).toMatchObject({
      executionTransport: "N8N_MCP",
      status: "DISPATCHED",
      externalExecutionId: "123",
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("missing execution ID fails once without redispatch", async () => {
    const dispatch = jest.fn().mockRejectedValue(new Error("n8n MCP dispatch did not return a valid execution identifier."));
    const repository = createInMemoryGlwPageExecutionRepository();
    const service = createGlwDraftExecutionService({
      repository,
      dispatcher: { dispatch },
      executionTransport: "N8N_MCP",
      createJobId: () => "glw-job-mcp",
    });
    await expect(service.execute(request)).resolves.toMatchObject({
      status: "FAILED",
      externalExecutionId: null,
      errorCode: "DISPATCH_FAILED",
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  test("reuses terminal normalization for WordPress and QA results", async () => {
    const repository = createInMemoryGlwPageExecutionRepository();
    const service = createGlwDraftExecutionService({
      repository,
      dispatcher: { async dispatch() { return { kind: "accepted", executionId: "123", status: "accepted" }; } },
      executionTransport: "N8N_MCP",
      createJobId: () => "glw-job-mcp",
    });
    await service.execute(request);
    const reader = createGlwN8nMcpExecutionReader({
      environment: environment(),
      callTool: async () => successfulExecution(),
    });
    await expect(service.pollToTerminal("glw-job-mcp", reader, { maxAttempts: 1 })).resolves.toMatchObject({
      status: "COMPLETE",
      wordpressObjectId: "19308",
      wordpressStatus: "draft",
      wordpressUrl: "https://example.test/?page_id=19308",
      qaStatus: "COMPLETE",
      qaChecks: { body: "PASS", seo: "PASS" },
      title: "MCP draft title",
      seoTitle: "MCP SEO title",
      focusKeyphrase: "indoor led video wall austin",
      wordCount: 5,
      featuredImagePresent: true,
    });
  });

  test("no MCP adapter payload contains OpenAI or WordPress credentials", () => {
    const serialized = JSON.stringify(mappedRequest);
    expect(serialized).not.toMatch(/applicationPassword|OPENAI_API_KEY|authorization|mcp-secret-token/i);
  });

  test("keeps the dedicated recovery and shared engine workflow identities distinct", () => {
    expect(GLW_N8N_MCP_RECOVERY_WORKFLOW_ID).toBe("9WTjTDXX0QNgF6Mw");
    expect(GLW_N8N_MCP_ENGINE_WORKFLOW_ID).toBe("bIDXxyWnY22G8zJC");
    expect(GLW_N8N_MCP_ENGINE_WORKFLOW_ID).toBe(GLW_N8N_WORKFLOW_ID);
    expect(GLW_N8N_MCP_RECOVERY_WORKFLOW_ID).not.toBe(GLW_N8N_MCP_ENGINE_WORKFLOW_ID);
  });

  test("existing webhook adapter remains present and separate", () => {
    expect(() => require.resolve("../n8n-draft-adapter")).not.toThrow();
  });
});
