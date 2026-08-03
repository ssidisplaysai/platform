import type { AIAgentDefinition, AIExecutionContext, AIExecutionPlan, AIModelDefinition, AIProviderName } from "../contracts";

export class ModelRegistry {
  private readonly models = new Map<string, AIModelDefinition>();

  register(model: AIModelDefinition): void {
    this.models.set(model.modelId, structuredClone(model));
  }

  get(modelId: string): AIModelDefinition | undefined {
    const model = this.models.get(modelId);
    return model ? structuredClone(model) : undefined;
  }

  list(): AIModelDefinition[] {
    return Array.from(this.models.values()).map((model) => structuredClone(model));
  }

  listByProvider(providerName: AIProviderName): AIModelDefinition[] {
    return this.list().filter((model) => model.providerName === providerName && model.state === "ACTIVE");
  }
}

export type ExecutionPlanningInput = {
  agent: AIAgentDefinition;
  context: AIExecutionContext;
  promptId: string;
  prompt: string;
  modelRegistry: ModelRegistry;
  preferredProviderName?: AIProviderName;
  preferredModelId?: string;
  toolIds?: string[];
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export class ExecutionPlanner {
  plan(input: ExecutionPlanningInput): AIExecutionPlan {
    const activeModels = input.modelRegistry.list();
    const candidateModels = [input.preferredModelId, input.agent.defaultModelId, ...input.agent.executionPolicy.fallbackModelIds].filter((modelId): modelId is string => Boolean(modelId));

    let selectedModel = candidateModels
      .map((modelId) => input.modelRegistry.get(modelId))
      .find((model): model is AIModelDefinition => Boolean(model && model.state === "ACTIVE"));

    if (!selectedModel && input.preferredProviderName) {
      selectedModel = activeModels.find((model) => model.providerName === input.preferredProviderName && model.state === "ACTIVE");
    }

    if (!selectedModel) {
      selectedModel = activeModels.find((model) => model.state === "ACTIVE");
    }

    if (!selectedModel) {
      throw new Error("no active AI model available");
    }

    return {
      executionId: `${input.agent.agentId}:${input.context.conversationId}:${Date.now()}`,
      agentId: input.agent.agentId,
      modelId: selectedModel.modelId,
      providerName: selectedModel.providerName,
      promptId: input.promptId,
      prompt: input.prompt,
      variables: {},
      toolIds: input.toolIds ?? [],
      temperature: input.temperature ?? selectedModel.defaultTemperature,
      maxTokens: input.maxTokens ?? selectedModel.maxOutputTokens,
      timeoutMs: input.timeoutMs ?? input.agent.executionPolicy.maxExecutionMs,
      approvalRequired: input.agent.executionPolicy.requireHumanApproval || input.context.humanApprovalCheckpoint === true,
      routingReason: input.preferredModelId === selectedModel.modelId ? "preferred-model" : input.agent.defaultModelId === selectedModel.modelId ? "default-model" : "fallback-model",
      fallbackModelIds: input.agent.executionPolicy.fallbackModelIds,
    };
  }
}
