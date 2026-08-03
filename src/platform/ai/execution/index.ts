import { randomUUID } from "node:crypto";
import type {
  AIExecutionContext,
  AIExecutionHistoryEntry,
  AIExecutionResult,
  AIExecutionStatus,
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
};

export class AIExecutionEngine {
  private readonly history: AIExecutionHistoryEntry[] = [];

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
  ) {}

  historyEntries(): AIExecutionHistoryEntry[] {
    return this.history.map((entry) => structuredClone(entry));
  }

  async execute(input: AIExecutionInput): Promise<AIExecutionResult> {
    const executionId = randomUUID();
    const startedAt = new Date().toISOString();
    const agent = this.agents.require(input.agentId);
    const promptDefinition = this.prompts.get(agent.defaultPromptId);

    if (!promptDefinition) {
      throw new Error(`unknown prompt: ${agent.defaultPromptId}`);
    }

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
      this.metrics.recordBudgetExhausted();
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
      if (!agent.toolAllowList.includes(toolId) || !agent.executionPolicy.allowToolExecution) {
        const blocked = await this.tools.execute({
          toolId,
          input: {},
          executionId,
          actorId: input.approvedBy ?? input.context.approvedBy ?? "system",
          tenant: input.context.tenant,
          workspace: input.context.workspace,
          permissions: agent.permissions,
        });
        toolResults.push(blocked);
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
        details: { status: result.status },
      });
    }

    const provider = this.providers.select(plan.providerName, plan.fallbackModelIds.map((modelId) => this.models.get(modelId)?.providerName).filter((providerName): providerName is NonNullable<typeof providerName> => Boolean(providerName)), plan.modelId);
    const providerStart = Date.now();

    try {
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
        context: input.context,
      });

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
