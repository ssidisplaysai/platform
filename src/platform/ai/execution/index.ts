import { randomUUID } from "node:crypto";
import type {
  AIAuthorizationDecision,
  AIAuthorizationRequest,
  AIExecutionContext,
  AIExecutionHistoryEntry,
  AIExecutionResult,
  AIToolExecutionResult,
} from "../contracts";
import type { AIProviderRegistry } from "../providers";
import type { AgentRegistry } from "../agents";
import type { PromptRegistry } from "../prompts";
import type { ToolRegistry } from "../tools";
import type { ModelRegistry, ExecutionPlanner } from "../planning";
import type { AIContextMemoryStore } from "../memory";
import type { ExecutionAuditTrail } from "../audit";
import type { AIMetricsService } from "../metrics";

const DEFAULT_TIMEOUT_MS = 30_000;

export class AICancelledError extends Error {
  constructor(message = "execution cancelled") {
    super(message);
    this.name = "AICancelledError";
  }
}

export class AITimeoutError extends Error {
  constructor(message = "execution timed out") {
    super(message);
    this.name = "AITimeoutError";
  }
}

export class AIBudgetExceededError extends Error {
  constructor(message = "execution budget exceeded") {
    super(message);
    this.name = "AIBudgetExceededError";
  }
}

export class AIAuthorizationDeniedError extends Error {
  constructor(message = "authorization denied") {
    super(message);
    this.name = "AIAuthorizationDeniedError";
  }
}

export type CancellationSignalLike = {
  readonly aborted: boolean;
};

export type AIAuthorizationResolver = (request: AIAuthorizationRequest) => Promise<AIAuthorizationDecision> | AIAuthorizationDecision;

type ExecutionBudgetState = {
  maxTokens?: number;
  maxCost?: number;
  consumedTokens: number;
  consumedCost: number;
};

type ExecutionGuard = {
  executionId: string;
  cancelSignal?: CancellationSignalLike;
  timeoutAtMs: number;
  budget: ExecutionBudgetState;
};

export type AIExecutionInput = {
  agentId: string;
  context: AIExecutionContext;
  variables: Record<string, string>;
  preferredProviderName?: Parameters<AIProviderRegistry["select"]>[0];
  preferredModelId?: string;
  toolIds?: string[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  approvedBy?: string;
  cancelSignal?: CancellationSignalLike;
};

export class AIExecutionEngine {
  private readonly history: AIExecutionHistoryEntry[] = [];
  private readonly authorizationCache = new Map<string, { decision: AIAuthorizationDecision; expiresAtMs: number }>();

  constructor(
    private readonly providers: AIProviderRegistry,
    private readonly agents: AgentRegistry,
    private readonly prompts: PromptRegistry,
    private readonly tools: ToolRegistry,
    private readonly models: ModelRegistry,
    private readonly planner: ExecutionPlanner,
    private readonly memory: AIContextMemoryStore,
    private readonly audit: ExecutionAuditTrail,
    private readonly metrics: AIMetricsService,
    private readonly authorizationResolver?: AIAuthorizationResolver,
    private readonly authorizationCacheTtlMs = 30_000,
  ) {}

  historyEntries(): AIExecutionHistoryEntry[] {
    return this.history.map((entry) => structuredClone(entry));
  }

  async execute(input: AIExecutionInput): Promise<AIExecutionResult> {
    const executionId = randomUUID();
    const startedAt = new Date().toISOString();
    const startedAtMs = Date.now();
    const agent = this.agents.require(input.agentId);
    const promptDefinition = this.prompts.get(agent.defaultPromptId);

    if (!promptDefinition) {
      throw new Error(`unknown prompt: ${agent.defaultPromptId}`);
    }

    const timeoutMs = this.resolveTimeoutMs(input.timeoutMs, agent.executionPolicy.maxExecutionMs);
    const guard: ExecutionGuard = {
      executionId,
      cancelSignal: input.cancelSignal ?? input.context.cancelSignal,
      timeoutAtMs: startedAtMs + timeoutMs,
      budget: {
        maxTokens: this.resolveMaxTokens(input.maxTokens, agent.defaultModelId),
        maxCost: this.resolveMaxCost(agent.defaultModelId),
        consumedTokens: 0,
        consumedCost: 0,
      },
    };

    this.enforceExecutionGuards(guard, input.context, "START");

    const variables = structuredClone(input.variables);
    const render = this.prompts.render(promptDefinition.promptId, variables, {
      tenant: input.context.tenant,
      workspace: input.context.workspace,
      conversationId: input.context.conversationId,
      sessionId: input.context.sessionId,
      actorId: input.approvedBy ?? input.context.approvedBy,
    });
    this.metrics.recordPromptRender();

    this.audit.append({
      eventType: "EXECUTION_PLANNED",
      executionId,
      agentId: agent.agentId,
      modelId: agent.defaultModelId,
      promptId: render.promptId,
      tenant: input.context.tenant,
      workspace: input.context.workspace,
      conversationId: input.context.conversationId,
      sessionId: input.context.sessionId,
      actorId: input.approvedBy ?? input.context.approvedBy,
      message: "execution planned",
      details: {
        toolIds: input.toolIds ?? [],
        approvedBy: input.approvedBy,
      },
    });

    if (agent.executionPolicy.requireHumanApproval && !input.approvedBy) {
      this.metrics.recordExecution("WAITING_FOR_APPROVAL", 0);
      this.audit.append({
        eventType: "APPROVAL_REQUESTED",
        executionId,
        agentId: agent.agentId,
        promptId: render.promptId,
        tenant: input.context.tenant,
        workspace: input.context.workspace,
        conversationId: input.context.conversationId,
        sessionId: input.context.sessionId,
        message: "human approval required",
      });
      return this.recordHistory({
        executionId,
        status: "WAITING_FOR_APPROVAL",
        agentId: agent.agentId,
        modelId: agent.defaultModelId,
        providerName: "MOCK",
        promptId: render.promptId,
        startedAt,
        tokenUsage: { input: 0, output: 0, total: 0 },
        cost: 0,
        toolCount: 0,
      });
    }

    const plan = this.planner.plan({
      agent,
      context: input.context,
      promptId: render.promptId,
      prompt: render.renderedPrompt,
      modelRegistry: this.models,
      preferredProviderName: input.preferredProviderName,
      preferredModelId: input.preferredModelId,
      toolIds: input.toolIds,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      timeoutMs: input.timeoutMs,
    });

    guard.budget.maxTokens = this.resolveMaxTokens(plan.maxTokens, plan.modelId);
    guard.budget.maxCost = this.resolveMaxCost(plan.modelId);
    this.enforceExecutionGuards(guard, input.context, "PLAN");

    this.audit.append({
      eventType: "MODEL_ROUTED",
      executionId,
      agentId: agent.agentId,
      modelId: plan.modelId,
      providerName: plan.providerName,
      promptId: render.promptId,
      tenant: input.context.tenant,
      workspace: input.context.workspace,
      conversationId: input.context.conversationId,
      sessionId: input.context.sessionId,
      actorId: input.approvedBy ?? input.context.approvedBy,
      message: plan.routingReason,
      details: {
        fallbackModelIds: plan.fallbackModelIds,
      },
    });

    if (agent.executionPolicy.requireHumanApproval && !input.approvedBy && input.context.humanApprovalCheckpoint) {
      this.metrics.recordExecution("WAITING_FOR_APPROVAL", 0);
      return this.recordHistory({
        executionId,
        status: "WAITING_FOR_APPROVAL",
        agentId: agent.agentId,
        modelId: plan.modelId,
        providerName: plan.providerName,
        promptId: render.promptId,
        startedAt,
        tokenUsage: { input: 0, output: 0, total: 0 },
        cost: 0,
        toolCount: 0,
      });
    }

    if (input.toolIds && input.toolIds.length > agent.executionPolicy.maxToolCalls) {
      this.metrics.recordBudgetRejected();
      const failure = this.audit.recordFailure({
        stage: "TOOL_POLICY",
        retryable: false,
        severity: "ERROR",
        message: "tool call limit exceeded",
        executionId,
      });
      this.metrics.recordExecution("FAILED", 0);
      return this.recordHistory({
        executionId,
        status: "FAILED",
        agentId: agent.agentId,
        modelId: plan.modelId,
        providerName: plan.providerName,
        promptId: render.promptId,
        startedAt,
        failureReason: failure.message,
        tokenUsage: { input: 0, output: 0, total: 0 },
        cost: 0,
        toolCount: 0,
      });
    }

    this.memory.write({
      scope: "CONVERSATION",
      tenant: input.context.tenant,
      workspace: input.context.workspace,
      conversationId: input.context.conversationId,
      sessionId: input.context.sessionId,
      key: `${input.context.conversationId}:prompt`,
      value: render.renderedPrompt,
      metadata: { agentId: agent.agentId, promptId: render.promptId },
    });

    const toolResults: AIToolExecutionResult[] = [];
    for (const toolId of input.toolIds ?? []) {
      this.enforceExecutionGuards(guard, input.context, "TOOL_LOOP");

      if (!agent.toolAllowList.includes(toolId) || !agent.executionPolicy.allowToolExecution) {
        const blocked = await this.tools.execute({
          toolId,
          input: {},
          executionId,
          actorId: input.approvedBy ?? input.context.approvedBy ?? "system",
          tenant: input.context.tenant,
          workspace: input.context.workspace,
          permissions: agent.permissions,
          authorizationDecision: {
            allowed: false,
            reason: "tool not allowed by agent policy",
            policyId: "agent-tool-allow-list",
            cacheHit: false,
            evaluatedAt: new Date().toISOString(),
            provenance: {
              source: "GENESIS_AUTHORIZATION_RESOLVER",
              principalId: input.approvedBy ?? input.context.approvedBy ?? "system",
              actionId: "ai.tool.execute",
              workspaceId: input.context.workspace,
              requestId: `tool-policy:${executionId}:${toolId}`,
            },
            grantedPermissions: [],
          },
        });
        toolResults.push(blocked);
        continue;
      }

      const authorizationDecision = await this.authorizeToolExecution({
        principalId: input.approvedBy ?? input.context.approvedBy ?? "system",
        principalName: input.approvedBy ?? input.context.approvedBy,
        tenant: input.context.tenant,
        workspace: input.context.workspace,
        agentId: agent.agentId,
        toolId,
        requiredPermissions: this.tools.get(toolId)?.permissions ?? [],
        metadata: {
          executionId,
          conversationId: input.context.conversationId,
          sessionId: input.context.sessionId,
        },
      }, input.context);

      if (!authorizationDecision.allowed) {
        this.metrics.recordAuthorizationDenied();
        const denied: AIToolExecutionResult = {
          toolId,
          status: "BLOCKED",
          reason: authorizationDecision.reason,
          retryable: false,
          completedAt: new Date().toISOString(),
        };
        toolResults.push(denied);
        this.audit.append({
          eventType: "TOOL_REJECTED",
          executionId,
          agentId: agent.agentId,
          modelId: plan.modelId,
          promptId: render.promptId,
          toolId,
          tenant: input.context.tenant,
          workspace: input.context.workspace,
          conversationId: input.context.conversationId,
          sessionId: input.context.sessionId,
          actorId: input.approvedBy ?? input.context.approvedBy,
          message: authorizationDecision.reason,
          details: {
            status: denied.status,
            reason: denied.reason,
            authorization: {
              policyId: authorizationDecision.policyId,
              cacheHit: authorizationDecision.cacheHit,
              provenance: authorizationDecision.provenance,
            },
          },
        });
        continue;
      }

      const result = await this.tools.execute({
        toolId,
        input: { variables: render.variables },
        executionId,
        actorId: input.approvedBy ?? input.context.approvedBy ?? "system",
        tenant: input.context.tenant,
        workspace: input.context.workspace,
        permissions: agent.permissions,
        authorizationDecision,
      });
      toolResults.push(result);
      this.metrics.recordToolExecution();
      this.audit.append({
        eventType: result.status === "SUCCEEDED" ? "TOOL_EXECUTED" : "TOOL_REJECTED",
        executionId,
        agentId: agent.agentId,
        modelId: plan.modelId,
        promptId: render.promptId,
        toolId,
        tenant: input.context.tenant,
        workspace: input.context.workspace,
        conversationId: input.context.conversationId,
        sessionId: input.context.sessionId,
        actorId: input.approvedBy ?? input.context.approvedBy,
        message: result.status === "SUCCEEDED" ? "tool executed" : result.reason ?? "tool rejected",
        details: {
          status: result.status,
          authorization: {
            policyId: authorizationDecision.policyId,
            cacheHit: authorizationDecision.cacheHit,
            provenance: authorizationDecision.provenance,
          },
        },
      });

      this.consumeBudgetAfterTool(guard, input.context, toolId);
    }

    const provider = this.providers.select(plan.providerName, plan.fallbackModelIds.map((modelId) => this.models.get(modelId)?.providerName).filter((providerName): providerName is NonNullable<typeof providerName> => Boolean(providerName)), plan.modelId);
    const providerStart = Date.now();

    try {
      this.enforceExecutionGuards(guard, input.context, "PROVIDER_START");
      this.metrics.recordModelUsage(plan.modelId);
      const response = await provider.generate({
        executionId,
        modelId: plan.modelId,
        prompt: render.renderedPrompt,
        variables: render.variables,
        messages: [],
        temperature: plan.temperature,
        maxTokens: plan.maxTokens,
        toolResults,
        context: {
          ...input.context,
          cancelSignal: input.cancelSignal ?? input.context.cancelSignal,
        },
      });

      this.consumeBudget(guard, response.tokens.total, response.cost, input.context, "PROVIDER_RESPONSE");

      this.metrics.recordExecution("COMPLETED", Date.now() - providerStart);
      this.metrics.recordTokens(response.tokens.input, response.tokens.output, response.cost);
      this.metrics.recordProviderHealth(response.providerName, "HEALTHY", response.latencyMs);
      this.audit.append({
        eventType: "EXECUTION_COMPLETED",
        executionId,
        agentId: agent.agentId,
        modelId: response.modelId,
        providerName: response.providerName,
        promptId: render.promptId,
        tenant: input.context.tenant,
        workspace: input.context.workspace,
        conversationId: input.context.conversationId,
        sessionId: input.context.sessionId,
        actorId: input.approvedBy ?? input.context.approvedBy,
        message: "execution completed",
        details: { tokenUsage: response.tokens, cost: response.cost },
      });

      return this.recordHistory({
        executionId,
        status: "COMPLETED",
        agentId: agent.agentId,
        modelId: response.modelId,
        providerName: response.providerName,
        promptId: render.promptId,
        startedAt,
        completedAt: new Date().toISOString(),
        tokenUsage: response.tokens,
        cost: response.cost,
        toolCount: toolResults.length,
        approvedBy: input.approvedBy,
        renderedPrompt: render.renderedPrompt,
        output: response.output,
        toolResults,
      });
    } catch (error) {
      if (error instanceof AICancelledError) {
        this.metrics.recordExecution("CANCELLED", Date.now() - providerStart);
        this.audit.append({
          eventType: "EXECUTION_CANCELLED",
          executionId,
          agentId: agent.agentId,
          modelId: plan.modelId,
          providerName: plan.providerName,
          promptId: render.promptId,
          tenant: input.context.tenant,
          workspace: input.context.workspace,
          conversationId: input.context.conversationId,
          sessionId: input.context.sessionId,
          actorId: input.approvedBy ?? input.context.approvedBy,
          message: error.message,
          details: { stage: "EXECUTION_GUARD" },
        });
        return this.recordHistory({
          executionId,
          status: "CANCELLED",
          agentId: agent.agentId,
          modelId: plan.modelId,
          providerName: plan.providerName,
          promptId: render.promptId,
          startedAt,
          completedAt: new Date().toISOString(),
          failureReason: error.message,
          tokenUsage: { input: 0, output: 0, total: 0 },
          cost: 0,
          toolCount: toolResults.length,
          approvedBy: input.approvedBy,
          renderedPrompt: render.renderedPrompt,
          output: "",
          toolResults,
        });
      }

      if (error instanceof AITimeoutError) {
        this.metrics.recordExecution("TIMED_OUT", Date.now() - providerStart);
        this.audit.append({
          eventType: "EXECUTION_TIMED_OUT",
          executionId,
          agentId: agent.agentId,
          modelId: plan.modelId,
          providerName: plan.providerName,
          promptId: render.promptId,
          tenant: input.context.tenant,
          workspace: input.context.workspace,
          conversationId: input.context.conversationId,
          sessionId: input.context.sessionId,
          actorId: input.approvedBy ?? input.context.approvedBy,
          message: error.message,
          details: { stage: "EXECUTION_GUARD" },
        });
        return this.recordHistory({
          executionId,
          status: "TIMED_OUT",
          agentId: agent.agentId,
          modelId: plan.modelId,
          providerName: plan.providerName,
          promptId: render.promptId,
          startedAt,
          completedAt: new Date().toISOString(),
          failureReason: error.message,
          tokenUsage: { input: 0, output: 0, total: 0 },
          cost: 0,
          toolCount: toolResults.length,
          approvedBy: input.approvedBy,
          renderedPrompt: render.renderedPrompt,
          output: "",
          toolResults,
        });
      }

      if (error instanceof AIBudgetExceededError) {
        this.metrics.recordExecution("FAILED", Date.now() - providerStart);
        this.metrics.recordBudgetExhausted();
        this.audit.append({
          eventType: "EXECUTION_FAILED",
          executionId,
          agentId: agent.agentId,
          modelId: plan.modelId,
          providerName: plan.providerName,
          promptId: render.promptId,
          tenant: input.context.tenant,
          workspace: input.context.workspace,
          conversationId: input.context.conversationId,
          sessionId: input.context.sessionId,
          actorId: input.approvedBy ?? input.context.approvedBy,
          message: error.message,
          details: {
            stage: "BUDGET_GUARD",
            consumedTokens: guard.budget.consumedTokens,
            consumedCost: guard.budget.consumedCost,
          },
        });
        return this.recordHistory({
          executionId,
          status: "FAILED",
          agentId: agent.agentId,
          modelId: plan.modelId,
          providerName: plan.providerName,
          promptId: render.promptId,
          startedAt,
          completedAt: new Date().toISOString(),
          failureReason: error.message,
          tokenUsage: { input: 0, output: 0, total: 0 },
          cost: 0,
          toolCount: toolResults.length,
          approvedBy: input.approvedBy,
          renderedPrompt: render.renderedPrompt,
          output: "",
          toolResults,
        });
      }

      if (error instanceof AIAuthorizationDeniedError) {
        this.metrics.recordExecution("FAILED", Date.now() - providerStart);
        this.metrics.recordAuthorizationDenied();
        this.audit.append({
          eventType: "EXECUTION_FAILED",
          executionId,
          agentId: agent.agentId,
          modelId: plan.modelId,
          providerName: plan.providerName,
          promptId: render.promptId,
          tenant: input.context.tenant,
          workspace: input.context.workspace,
          conversationId: input.context.conversationId,
          sessionId: input.context.sessionId,
          actorId: input.approvedBy ?? input.context.approvedBy,
          message: error.message,
          details: { stage: "AUTHORIZATION_GUARD" },
        });
        return this.recordHistory({
          executionId,
          status: "FAILED",
          agentId: agent.agentId,
          modelId: plan.modelId,
          providerName: plan.providerName,
          promptId: render.promptId,
          startedAt,
          completedAt: new Date().toISOString(),
          failureReason: error.message,
          tokenUsage: { input: 0, output: 0, total: 0 },
          cost: 0,
          toolCount: toolResults.length,
          approvedBy: input.approvedBy,
          renderedPrompt: render.renderedPrompt,
          output: "",
          toolResults,
        });
      }

      const retryable = error instanceof Error && (error as Error & { retryable?: boolean }).retryable === true;
      this.metrics.recordExecution("FAILED", Date.now() - providerStart);
      if (retryable) {
        this.metrics.recordRetry();
      }
      this.audit.recordFailure({
        stage: "PROVIDER_EXECUTION",
        retryable,
        severity: retryable ? "WARN" : "ERROR",
        message: error instanceof Error ? error.message : "execution failed",
        executionId,
      });
      this.audit.append({
        eventType: "EXECUTION_FAILED",
        executionId,
        agentId: agent.agentId,
        modelId: plan.modelId,
        providerName: plan.providerName,
        promptId: render.promptId,
        tenant: input.context.tenant,
        workspace: input.context.workspace,
        conversationId: input.context.conversationId,
        sessionId: input.context.sessionId,
        actorId: input.approvedBy ?? input.context.approvedBy,
        message: error instanceof Error ? error.message : "execution failed",
        details: { retryable },
      });
      if (input.context.metadata && typeof input.context.metadata === "object" && "compensation" in input.context.metadata) {
        const compensation = input.context.metadata.compensation;
        if (typeof compensation === "function") {
          await compensation();
        }
      }
      return this.recordHistory({
        executionId,
        status: "FAILED",
        agentId: agent.agentId,
        modelId: plan.modelId,
        providerName: plan.providerName,
        promptId: render.promptId,
        startedAt,
        completedAt: new Date().toISOString(),
        failureReason: error instanceof Error ? error.message : "execution failed",
        tokenUsage: { input: 0, output: 0, total: 0 },
        cost: 0,
        toolCount: toolResults.length,
        approvedBy: input.approvedBy,
        renderedPrompt: render.renderedPrompt,
        output: "",
        toolResults,
      });
    }
  }

  private enforceExecutionGuards(guard: ExecutionGuard, context: AIExecutionContext, stage: string): void {
    if (guard.cancelSignal?.aborted) {
      throw new AICancelledError(`execution cancelled at ${stage.toLowerCase()}`);
    }

    if (Date.now() > guard.timeoutAtMs) {
      throw new AITimeoutError(`execution timed out at ${stage.toLowerCase()}`);
    }

    if (guard.budget.maxTokens !== undefined && guard.budget.consumedTokens > guard.budget.maxTokens) {
      throw new AIBudgetExceededError(`token budget exceeded at ${stage.toLowerCase()}`);
    }

    if (guard.budget.maxCost !== undefined && guard.budget.consumedCost > guard.budget.maxCost) {
      throw new AIBudgetExceededError(`cost budget exceeded at ${stage.toLowerCase()}`);
    }

    void context;
  }

  private consumeBudget(guard: ExecutionGuard, tokens: number, cost: number, context: AIExecutionContext, stage: string): void {
    guard.budget.consumedTokens += Math.max(0, tokens);
    guard.budget.consumedCost = Number((guard.budget.consumedCost + Math.max(0, cost)).toFixed(6));
    this.enforceExecutionGuards(guard, context, stage);
  }

  private consumeBudgetAfterTool(guard: ExecutionGuard, context: AIExecutionContext, toolId: string): void {
    this.consumeBudget(guard, 1, 0.0001, context, `TOOL:${toolId}`);
  }

  private resolveMaxTokens(inputMaxTokens: number | undefined, modelId: string): number | undefined {
    const model = this.models.get(modelId);
    const modelBudget = model?.budget?.maxTokensPerExecution;
    const candidates = [inputMaxTokens, modelBudget].filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
    if (candidates.length === 0) {
      return undefined;
    }
    return Math.min(...candidates);
  }

  private resolveMaxCost(modelId: string): number | undefined {
    const model = this.models.get(modelId);
    const maxCost = model?.budget?.maxCostPerExecution;
    return typeof maxCost === "number" && Number.isFinite(maxCost) && maxCost > 0 ? maxCost : undefined;
  }

  private resolveTimeoutMs(inputTimeoutMs: number | undefined, policyTimeoutMs: number): number {
    const candidates = [inputTimeoutMs, policyTimeoutMs, DEFAULT_TIMEOUT_MS]
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);
    return candidates.length > 0 ? Math.min(...candidates) : DEFAULT_TIMEOUT_MS;
  }

  private async authorizeToolExecution(request: AIAuthorizationRequest, context: AIExecutionContext): Promise<AIAuthorizationDecision> {
    const cacheKey = JSON.stringify({
      principalId: request.principalId,
      tenant: request.tenant,
      workspace: request.workspace,
      agentId: request.agentId,
      toolId: request.toolId,
      requiredPermissions: [...request.requiredPermissions].sort(),
    });

    const cached = this.authorizationCache.get(cacheKey);
    if (cached && cached.expiresAtMs > Date.now()) {
      return {
        ...cached.decision,
        cacheHit: true,
        evaluatedAt: new Date().toISOString(),
      };
    }

    if (!this.authorizationResolver) {
      return {
        allowed: false,
        reason: "authorization resolver not configured",
        policyId: "ai-default-deny",
        cacheHit: false,
        evaluatedAt: new Date().toISOString(),
        provenance: {
          source: "GENESIS_AUTHORIZATION_RESOLVER",
          principalId: request.principalId,
          actionId: "ai.tool.execute",
          workspaceId: request.workspace,
          requestId: `ai-auth-${randomUUID()}`,
        },
        grantedPermissions: [],
      };
    }

    try {
      const decision = await this.authorizationResolver(request);
      const normalized: AIAuthorizationDecision = {
        ...decision,
        cacheHit: decision.cacheHit,
        evaluatedAt: decision.evaluatedAt,
        grantedPermissions: [...decision.grantedPermissions],
      };
      this.authorizationCache.set(cacheKey, {
        decision: { ...normalized, cacheHit: false },
        expiresAtMs: Date.now() + this.authorizationCacheTtlMs,
      });
      return normalized;
    } catch (error) {
      this.metrics.recordAuthorizationError();
      this.audit.recordFailure({
        stage: "AUTHORIZATION",
        retryable: false,
        severity: "ERROR",
        message: error instanceof Error ? error.message : "authorization resolver failure",
        executionId: request.metadata && typeof request.metadata.executionId === "string" ? request.metadata.executionId : "unknown",
      });
      throw new AIAuthorizationDeniedError(error instanceof Error ? error.message : "authorization resolver failure");
    } finally {
      void context;
    }
  }

  private recordHistory(entry: Omit<AIExecutionHistoryEntry, "executionId"> & { executionId: string; renderedPrompt?: string; output?: string; toolResults?: AIToolExecutionResult[]; approvedBy?: string }): AIExecutionResult {
    this.history.push({
      executionId: entry.executionId,
      status: entry.status,
      agentId: entry.agentId,
      modelId: entry.modelId,
      providerName: entry.providerName,
      promptId: entry.promptId,
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      failureReason: entry.failureReason,
      tokenUsage: entry.tokenUsage,
      cost: entry.cost,
      toolCount: entry.toolCount,
    });

    return {
      executionId: entry.executionId,
      status: entry.status,
      agentId: entry.agentId,
      modelId: entry.modelId,
      providerName: entry.providerName,
      promptId: entry.promptId,
      renderedPrompt: entry.renderedPrompt ?? "",
      output: entry.output ?? "",
      toolResults: entry.toolResults ?? [],
      startedAt: entry.startedAt,
      completedAt: entry.completedAt,
      failureReason: entry.failureReason,
      approvedBy: entry.approvedBy,
      tokenUsage: entry.tokenUsage,
      cost: entry.cost,
    };
  }
}
