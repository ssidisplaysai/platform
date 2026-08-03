import type { AIIntegrationSnapshot } from "../contracts";
import type { AIProviderRegistry } from "../providers";
import type { ModelRegistry } from "../planning";
import type { AgentRegistry } from "../agents";
import type { PromptRegistry } from "../prompts";
import type { ToolRegistry } from "../tools";
import type { AIContextMemoryStore } from "../memory";
import type { ExecutionAuditTrail } from "../audit";
import type { AIMetricsService } from "../metrics";
import type { AIHealthService } from "../health";

export class MissionControlIntegrationService {
  constructor(
    private readonly providers: AIProviderRegistry,
    private readonly models: ModelRegistry,
    private readonly agents: AgentRegistry,
    private readonly prompts: PromptRegistry,
    private readonly tools: ToolRegistry,
    private readonly memory: AIContextMemoryStore,
    private readonly audit: ExecutionAuditTrail,
    private readonly metrics: AIMetricsService,
    private readonly health: AIHealthService,
  ) {}

  async snapshot(): Promise<AIIntegrationSnapshot> {
    return {
      capabilityId: "platform.ai",
      capabilityName: "Genesis AI Orchestration Platform",
      version: "1.0.0",
      health: await this.health.snapshot(),
      metrics: this.metrics.snapshot(),
      statistics: {
        providers: this.providers.list().length,
        models: this.models.list().length,
        agents: this.agents.list().length,
        prompts: this.prompts.list().length,
        tools: this.tools.list().length,
        memoryRecords: this.memory.list().length,
        auditRecords: this.audit.list().length,
      },
      readiness: {
        providerNeutral: true,
        workflowNeutral: true,
        schedulingNeutral: true,
        messagingNeutral: true,
        missionControlCompatible: true,
      },
    };
  }
}
