import type { AIHealthSnapshot } from "../contracts";
import type { AIProviderRegistry } from "../providers";
import type { AgentRegistry } from "../agents";
import type { ModelRegistry } from "../planning";
import type { PromptRegistry } from "../prompts";
import type { ToolRegistry } from "../tools";
import type { AIContextMemoryStore } from "../memory";
import type { ExecutionAuditTrail } from "../audit";
import type { AIMetricsService } from "../metrics";

export class AIHealthService {
  constructor(
    private readonly providers: AIProviderRegistry,
    private readonly models: ModelRegistry,
    private readonly agents: AgentRegistry,
    private readonly prompts: PromptRegistry,
    private readonly tools: ToolRegistry,
    private readonly memory: AIContextMemoryStore,
    private readonly audit: ExecutionAuditTrail,
    private readonly metrics: AIMetricsService,
  ) {}

  async snapshot(): Promise<AIHealthSnapshot> {
    const providerHealth = await this.providers.health();
    const providerWarnings = providerHealth.filter((item) => item.status === "DEGRADED");

    const checks: AIHealthSnapshot["checks"] = [
      {
        name: "providers",
        status: providerHealth.length > 0 && providerWarnings.length === 0 ? "PASS" : providerHealth.length > 0 ? "WARN" : "FAIL",
        detail: providerHealth.length > 0 ? `providers=${providerHealth.length}` : "no providers registered",
      },
      {
        name: "models",
        status: this.models.list().length > 0 ? "PASS" : "FAIL",
        detail: `models=${this.models.list().length}`,
      },
      {
        name: "agents",
        status: this.agents.list().length > 0 ? "PASS" : "WARN",
        detail: `agents=${this.agents.list().length}`,
      },
      {
        name: "prompts",
        status: this.prompts.list().length > 0 ? "PASS" : "WARN",
        detail: `prompts=${this.prompts.list().length}`,
      },
      {
        name: "tools",
        status: this.tools.list().length > 0 ? "PASS" : "WARN",
        detail: `tools=${this.tools.list().length}`,
      },
      {
        name: "memory",
        status: this.memory.list().length >= 0 ? "PASS" : "FAIL",
        detail: `memoryRecords=${this.memory.list().length}`,
      },
      {
        name: "audit",
        status: this.audit.listFailures().length > 0 ? "WARN" : "PASS",
        detail: `auditRecords=${this.audit.list().length}; auditFailures=${this.audit.listFailures().length}`,
      },
      {
        name: "metrics",
        status: this.metrics.snapshot().executionCount >= 0 ? "PASS" : "FAIL",
        detail: `executions=${this.metrics.snapshot().executionCount}`,
      },
      {
        name: "integration",
        status: "PASS",
        detail: "mission control snapshot available",
      },
    ];

    const failed = checks.some((check) => check.status === "FAIL");
    const warned = checks.some((check) => check.status === "WARN");

    return {
      status: failed ? "DEGRADED" : warned ? "DEGRADED" : "HEALTHY",
      checks,
      generatedAt: new Date().toISOString(),
    };
  }
}
