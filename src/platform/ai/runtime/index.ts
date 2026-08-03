import { AIProviderRegistry, MockAIProvider, createAIProviderRegistry } from "../providers";
import { AgentRegistry } from "../agents";
import { PromptRegistry } from "../prompts";
import { ToolRegistry } from "../tools";
import { ModelRegistry, ExecutionPlanner } from "../planning";
import { AIContextMemoryStore } from "../memory";
import { ExecutionAuditTrail } from "../audit";
import { AIMetricsService } from "../metrics";
import { AIHealthService } from "../health";
import { MissionControlIntegrationService } from "../integration";
import { AIExecutionEngine, type AIAuthorizationResolver } from "../execution";

export type GenesisAIOrchestrationRuntime = {
  providers: AIProviderRegistry;
  agents: AgentRegistry;
  prompts: PromptRegistry;
  tools: ToolRegistry;
  models: ModelRegistry;
  memory: AIContextMemoryStore;
  audit: ExecutionAuditTrail;
  metrics: AIMetricsService;
  health: AIHealthService;
  integration: MissionControlIntegrationService;
  planner: ExecutionPlanner;
  engine: AIExecutionEngine;
};

export type GenesisAIOrchestrationRuntimeOptions = {
  providers?: MockAIProvider[];
  authorizationResolver?: AIAuthorizationResolver;
  authorizationCacheTtlMs?: number;
};

export function createGenesisAIOrchestrationRuntime(options: GenesisAIOrchestrationRuntimeOptions = {}): GenesisAIOrchestrationRuntime {
  const providers = createAIProviderRegistry(options.providers ?? [new MockAIProvider()]);
  const agents = new AgentRegistry();
  const prompts = new PromptRegistry();
  const tools = new ToolRegistry();
  const models = new ModelRegistry();
  const memory = new AIContextMemoryStore();
  const audit = new ExecutionAuditTrail();
  const metrics = new AIMetricsService();
  const planner = new ExecutionPlanner();
  const health = new AIHealthService(providers, models, agents, prompts, tools, memory, audit, metrics);
  const integration = new MissionControlIntegrationService(providers, models, agents, prompts, tools, memory, audit, metrics, health);
  const engine = new AIExecutionEngine(
    providers,
    agents,
    prompts,
    tools,
    models,
    planner,
    memory,
    audit,
    metrics,
    options.authorizationResolver,
    options.authorizationCacheTtlMs,
  );

  return { providers, agents, prompts, tools, models, memory, audit, metrics, health, integration, planner, engine };
}

let singleton: GenesisAIOrchestrationRuntime | null = null;

export function getGenesisAIOrchestrationRuntime(): GenesisAIOrchestrationRuntime {
  if (!singleton) {
    singleton = createGenesisAIOrchestrationRuntime();
  }
  return singleton;
}
