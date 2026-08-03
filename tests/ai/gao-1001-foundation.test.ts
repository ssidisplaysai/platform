import { describe, expect, it } from "@jest/globals";
import {
  AIContextMemoryStore,
  AIExecutionEngine,
  AIHealthService,
  AIMetricsService,
  AgentRegistry,
  ExecutionAuditTrail,
  ExecutionPlanner,
  ModelRegistry,
  MockAIProvider,
  MissionControlIntegrationService,
  PromptRegistry,
  ToolRegistry,
  createGenesisAIAuthorizationResolver,
  createGenesisAIOrchestrationRuntime,
} from "@/platform/ai";
import type { AIAgentDefinition, AIPromptDefinition, AIToolDefinition, AIModelDefinition, AIProvider, AIProviderRequest } from "@/platform/ai";

function buildModel(overrides?: Partial<AIModelDefinition>): AIModelDefinition {
  return {
    modelId: "mock-chat",
    providerName: "MOCK",
    kind: "CHAT",
    version: { major: 1, minor: 0, patch: 0 },
    state: "ACTIVE",
    contextWindowTokens: 4096,
    maxOutputTokens: 1024,
    defaultTemperature: 0.2,
    fallbackModelIds: ["mock-router"],
    supportsStructuredOutput: true,
    supportsToolCalls: true,
    ...overrides,
  };
}

function buildAgent(overrides?: Partial<AIAgentDefinition>): AIAgentDefinition {
  return {
    agentId: "agent.genesis.assistant",
    name: "Genesis Assistant",
    version: { major: 1, minor: 0, patch: 0 },
    state: "ACTIVE",
    capabilities: ["summarize", "plan", "explain"],
    permissions: ["tool.read", "tool.execute", "ai.invoke"],
    defaultModelId: "mock-chat",
    defaultPromptId: "prompt.system.root",
    toolAllowList: ["tool.lookup"],
    memoryScopes: ["CONVERSATION", "SESSION", "WORKSPACE"],
    executionPolicy: {
      allowToolExecution: true,
      requireHumanApproval: false,
      maxToolCalls: 2,
      maxExecutionMs: 5000,
      fallbackModelIds: ["mock-router"],
      allowedMemoryScopes: ["CONVERSATION", "SESSION", "WORKSPACE"],
    },
    ...overrides,
  };
}

function buildPrompt(overrides?: Partial<AIPromptDefinition>): AIPromptDefinition {
  return {
    promptId: "prompt.system.root",
    name: "Root System Prompt",
    version: { major: 1, minor: 0, patch: 0 },
    state: "ACTIVE",
    template: "You are Genesis AI. Tenant={{tenant}} Workspace={{workspace}} Mode={{mode}}.\nContext={{context}}",
    variables: ["tenant", "workspace", "mode", "context"],
    ...overrides,
  };
}

function buildPromptChild(overrides?: Partial<AIPromptDefinition>): AIPromptDefinition {
  return {
    promptId: "prompt.system.child",
    name: "Child Prompt",
    version: { major: 1, minor: 0, patch: 0 },
    state: "ACTIVE",
    template: "Task={{task}}",
    variables: ["task"],
    inheritsFrom: "prompt.system.root",
    ...overrides,
  };
}

function buildTool(overrides?: Partial<AIToolDefinition>): AIToolDefinition & { execute: (input: unknown) => unknown } {
  return {
    toolId: "tool.lookup",
    name: "Lookup Tool",
    version: { major: 1, minor: 0, patch: 0 },
    state: "ACTIVE",
    permissions: ["tool.execute"],
    description: "Deterministic lookup helper.",
    execute: (input: unknown) => ({ echo: input, result: "ok" }),
    ...overrides,
  };
}

function createAllowResolver() {
  return (request: { principalId: string; workspace: string; requiredPermissions: string[] }) => ({
    allowed: true,
    reason: "approved by resolver",
    policyId: "gop-policy-ai-tool",
    cacheHit: false,
    evaluatedAt: new Date().toISOString(),
    provenance: {
      source: "GENESIS_AUTHORIZATION_RESOLVER" as const,
      principalId: request.principalId,
      actionId: "ai.tool.execute",
      workspaceId: request.workspace,
      requestId: "allow-1",
    },
    grantedPermissions: [...request.requiredPermissions],
  });
}

class SlowMockProvider extends MockAIProvider implements AIProvider {
  constructor(private readonly delayMs: number) {
    super();
  }

  async generate(request: AIProviderRequest) {
    await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    return super.generate(request);
  }
}

describe("GAO-1001 Genesis AI Orchestration Platform foundation", () => {
  it("renders prompts deterministically with inheritance", () => {
    const prompts = new PromptRegistry();
    prompts.register(buildPrompt());
    prompts.register(buildPromptChild());

    const first = prompts.render("prompt.system.child", {
      tenant: "tenant-1",
      workspace: "workspace-1",
      mode: "analysis",
      context: "release-review",
      task: "summarize",
    }, {
      tenant: "tenant-1",
      workspace: "workspace-1",
      conversationId: "conversation-1",
      sessionId: "session-1",
      executionId: "exec-1",
    });

    const second = prompts.render("prompt.system.child", {
      tenant: "tenant-1",
      workspace: "workspace-1",
      mode: "analysis",
      context: "release-review",
      task: "summarize",
    }, {
      tenant: "tenant-1",
      workspace: "workspace-1",
      conversationId: "conversation-1",
      sessionId: "session-1",
      executionId: "exec-2",
    });

    expect(first.renderedPrompt).toBe(second.renderedPrompt);
    expect(first.lineage).toEqual(["prompt.system.root", "prompt.system.child"]);
    expect(first.variables).toEqual(second.variables);
  });

  it("executes a tool-aware orchestration plan and records metrics", async () => {
    const providers = new MockAIProvider();
    const runtime = createGenesisAIOrchestrationRuntime({ providers: [providers], authorizationResolver: createAllowResolver() });
    runtime.models.register(buildModel());
    runtime.models.register(buildModel({ modelId: "mock-router", kind: "ROUTER", defaultTemperature: 0.1 }));
    runtime.agents.register(buildAgent());
    runtime.prompts.register(buildPrompt());
    runtime.tools.register(buildTool());

    const result = await runtime.engine.execute({
      agentId: "agent.genesis.assistant",
      context: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        conversationId: "conversation-1",
        sessionId: "session-1",
        locale: "en-US",
        approvedBy: "admin@example.com",
      },
      variables: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        mode: "analysis",
        context: "release-review",
      },
      toolIds: ["tool.lookup"],
      approvedBy: "admin@example.com",
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.providerName).toBe("MOCK");
    expect(result.toolResults[0]?.status).toBe("SUCCEEDED");
    expect(result.output).toContain("provider=MOCK");

    const metrics = runtime.metrics.snapshot();
    expect(metrics.executionCount).toBe(1);
    expect(metrics.completedCount).toBe(1);
    expect(metrics.toolExecutionCount).toBe(1);
    expect(metrics.promptRenderCount).toBe(1);
    expect(metrics.tokenTotalCount).toBeGreaterThan(0);

    const memoryRecord = runtime.memory.read("CONVERSATION", "tenant-1", "workspace-1", "conversation-1:prompt");
    expect(memoryRecord?.value).toContain("Genesis AI");

    const health = await runtime.health.snapshot();
    expect(health.status).toBe("HEALTHY");

    const integration = await runtime.integration.snapshot();
    expect(integration.capabilityId).toBe("platform.ai");
    expect(integration.readiness.missionControlCompatible).toBe(true);
  });

  it("blocks unauthorized tool execution while preserving audit visibility", async () => {
    const runtime = createGenesisAIOrchestrationRuntime({ providers: [new MockAIProvider()] });
    runtime.models.register(buildModel());
    runtime.agents.register(buildAgent({ permissions: ["ai.invoke"] }));
    runtime.prompts.register(buildPrompt());
    runtime.tools.register(buildTool({ permissions: ["tool.execute", "tool.admin"] }));

    const result = await runtime.engine.execute({
      agentId: "agent.genesis.assistant",
      context: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        conversationId: "conversation-2",
        sessionId: "session-2",
      },
      variables: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        mode: "analysis",
        context: "guardrail-check",
      },
      toolIds: ["tool.lookup"],
      approvedBy: "auditor@example.com",
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.toolResults[0]?.status).toBe("BLOCKED");

    const audit = runtime.audit.list();
    expect(audit.some((record) => record.eventType === "TOOL_REJECTED")).toBe(true);
  });

  it("isolates memory scopes by tenant and workspace", () => {
    const memory = new AIContextMemoryStore();
    memory.write({
      scope: "SESSION",
      tenant: "tenant-1",
      workspace: "workspace-1",
      sessionId: "session-1",
      key: "state",
      value: "alpha",
    });
    memory.write({
      scope: "SESSION",
      tenant: "tenant-2",
      workspace: "workspace-2",
      sessionId: "session-2",
      key: "state",
      value: "beta",
    });

    expect(memory.read("SESSION", "tenant-1", "workspace-1", "state")?.value).toBe("alpha");
    expect(memory.read("SESSION", "tenant-2", "workspace-2", "state")?.value).toBe("beta");
    expect(memory.list("SESSION", "tenant-1", "workspace-1")).toHaveLength(1);
  });

  it("enforces cancellation and records cancelled execution", async () => {
    const runtime = createGenesisAIOrchestrationRuntime({
      providers: [new SlowMockProvider(10)],
      authorizationResolver: createAllowResolver(),
    });
    runtime.models.register(buildModel());
    runtime.agents.register(buildAgent());
    runtime.prompts.register(buildPrompt());

    const cancelSignal = { aborted: false };
    setTimeout(() => {
      cancelSignal.aborted = true;
    }, 1);

    const result = await runtime.engine.execute({
      agentId: "agent.genesis.assistant",
      context: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        conversationId: "conversation-cancel-1",
        sessionId: "session-cancel-1",
      },
      variables: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        mode: "analysis",
        context: "cancel-check",
      },
      cancelSignal,
    });

    expect(result.status).toBe("CANCELLED");
    expect(result.failureReason).toContain("cancelled");

    const metrics = runtime.metrics.snapshot();
    expect(metrics.cancelledCount).toBe(1);

    const audit = runtime.audit.list();
    expect(audit.some((record) => record.eventType === "EXECUTION_CANCELLED")).toBe(true);
  });

  it("enforces timeout and records timed out execution", async () => {
    const runtime = createGenesisAIOrchestrationRuntime({ providers: [new SlowMockProvider(10)] });
    runtime.models.register(buildModel());
    runtime.agents.register(buildAgent({ executionPolicy: {
      allowToolExecution: true,
      requireHumanApproval: false,
      maxToolCalls: 2,
      maxExecutionMs: 1,
      fallbackModelIds: ["mock-router"],
      allowedMemoryScopes: ["CONVERSATION", "SESSION", "WORKSPACE"],
    } }));
    runtime.prompts.register(buildPrompt());

    const result = await runtime.engine.execute({
      agentId: "agent.genesis.assistant",
      context: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        conversationId: "conversation-timeout-1",
        sessionId: "session-timeout-1",
      },
      variables: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        mode: "analysis",
        context: "timeout-check",
      },
      timeoutMs: 1,
    });

    expect(result.status).toBe("TIMED_OUT");
    expect(result.failureReason).toContain("timed out");

    const metrics = runtime.metrics.snapshot();
    expect(metrics.timedOutCount).toBe(1);

    const audit = runtime.audit.list();
    expect(audit.some((record) => record.eventType === "EXECUTION_TIMED_OUT")).toBe(true);
  });

  it("enforces budget hard limits before provider completion", async () => {
    const runtime = createGenesisAIOrchestrationRuntime({ providers: [new MockAIProvider()] });
    runtime.models.register(buildModel({
      budget: {
        maxTokensPerExecution: 1,
        maxCostPerExecution: 0.00001,
      },
    }));
    runtime.agents.register(buildAgent());
    runtime.prompts.register(buildPrompt());

    const result = await runtime.engine.execute({
      agentId: "agent.genesis.assistant",
      context: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        conversationId: "conversation-budget-1",
        sessionId: "session-budget-1",
      },
      variables: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        mode: "analysis",
        context: "budget-check",
      },
    });

    expect(result.status).toBe("FAILED");
    expect(result.failureReason).toContain("budget exceeded");

    const metrics = runtime.metrics.snapshot();
    expect(metrics.budgetExhaustedCount).toBe(1);

    const audit = runtime.audit.list();
    expect(audit.some((record) => record.eventType === "EXECUTION_FAILED" && record.details?.stage === "BUDGET_GUARD")).toBe(true);
  });

  it("uses resolver-backed authorization with provenance and cache for tool execution", async () => {
    let authorizationCalls = 0;
    const adapterResolver = createGenesisAIAuthorizationResolver({
      resolveSubject: (request) => {
        authorizationCalls += 1;
        return {
          actorId: request.principalId,
          actorName: request.principalName,
          role: "ADMINISTRATOR",
          permissions: ["read", "write", "admin", "tool.execute", "ai.invoke"],
          workspaceMemberships: [
            {
              workspaceId: request.workspace,
              actorId: request.principalId,
              role: "ADMINISTRATOR",
              permissions: ["read", "write", "admin", "tool.execute", "ai.invoke"],
              active: true,
            },
          ],
        };
      },
    });

    const runtime = createGenesisAIOrchestrationRuntime({
      providers: [new MockAIProvider()],
      authorizationResolver: adapterResolver,
      authorizationCacheTtlMs: 60_000,
    });

    runtime.models.register(buildModel());
    runtime.agents.register(buildAgent());
    runtime.prompts.register(buildPrompt());
    runtime.tools.register(buildTool());

    const input = {
      agentId: "agent.genesis.assistant",
      context: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        conversationId: "conversation-auth-1",
        sessionId: "session-auth-1",
        approvedBy: "admin@example.com",
      },
      variables: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        mode: "analysis",
        context: "authorization-check",
      },
      toolIds: ["tool.lookup"],
      approvedBy: "admin@example.com",
    } as const;

    const first = await runtime.engine.execute(input);
    const second = await runtime.engine.execute({
      ...input,
      context: {
        ...input.context,
        conversationId: "conversation-auth-2",
        sessionId: "session-auth-2",
      },
    });

    expect(first.status).toBe("COMPLETED");
    expect(second.status).toBe("COMPLETED");
    expect(authorizationCalls).toBe(1);

    const audit = runtime.audit.list();
    const executedWithAuth = audit.filter((record) => record.eventType === "TOOL_EXECUTED");
    expect(executedWithAuth.length).toBeGreaterThanOrEqual(2);
    expect(executedWithAuth[0]?.details?.authorization).toBeDefined();
    expect(executedWithAuth[0]?.details?.authorization?.policyId).toBeDefined();
  });

  it("fails closed when authorization resolver denies tool execution", async () => {
    const runtime = createGenesisAIOrchestrationRuntime({
      providers: [new MockAIProvider()],
      authorizationResolver: () => ({
        allowed: false,
        reason: "denied by policy",
        policyId: "gop-deny-policy",
        cacheHit: false,
        evaluatedAt: new Date().toISOString(),
        provenance: {
          source: "GENESIS_AUTHORIZATION_RESOLVER",
          principalId: "auditor@example.com",
          actionId: "ai.tool.execute",
          workspaceId: "workspace-1",
          requestId: "deny-1",
        },
        grantedPermissions: [],
      }),
    });
    runtime.models.register(buildModel());
    runtime.agents.register(buildAgent());
    runtime.prompts.register(buildPrompt());
    runtime.tools.register(buildTool());

    const result = await runtime.engine.execute({
      agentId: "agent.genesis.assistant",
      context: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        conversationId: "conversation-auth-denied-1",
        sessionId: "session-auth-denied-1",
      },
      variables: {
        tenant: "tenant-1",
        workspace: "workspace-1",
        mode: "analysis",
        context: "authorization-denied-check",
      },
      toolIds: ["tool.lookup"],
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.toolResults[0]?.status).toBe("BLOCKED");
    expect(result.toolResults[0]?.reason).toContain("denied");

    const metrics = runtime.metrics.snapshot();
    expect(metrics.authorizationDeniedCount).toBe(1);

    const audit = runtime.audit.list();
    expect(audit.some((record) => record.eventType === "TOOL_REJECTED" && record.details?.authorization?.policyId === "gop-deny-policy")).toBe(true);
  });
});
