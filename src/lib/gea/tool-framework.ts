import { geaId } from "./agent-models";

export type ToolDefinition = {
  toolId: string;
  toolKey: string;
  toolVersion: string;
  capabilityKey: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  enabled: boolean;
};

export type ToolInvocation = {
  invocationId: string;
  executionId: string;
  taskId: string;
  toolKey: string;
  toolVersion: string;
  input: Record<string, unknown>;
  createdAt: string;
};

export type ToolResult = {
  invocationId: string;
  status: "SUCCESS" | "FAILED";
  output: Record<string, unknown>;
  error?: string;
  completedAt: string;
};

export type ToolAuthorization = {
  allowed: boolean;
  reason: string;
};

export type ToolRegistry = {
  list: () => ToolDefinition[];
  get: (toolKey: string) => ToolDefinition | null;
  upsert: (tool: Omit<ToolDefinition, "toolId"> & { toolId?: string }) => ToolDefinition;
};

export type ToolExecutor = {
  execute: (invocation: ToolInvocation) => Promise<ToolResult>;
};

const DEFAULT_TOOLS: ToolDefinition[] = (
  [
  { toolKey: "genesis.workflow.dispatch", capabilityKey: "workflow", riskLevel: "MEDIUM" },
  { toolKey: "genesis.analytics.snapshot", capabilityKey: "analytics", riskLevel: "LOW" },
  { toolKey: "genesis.knowledge.search", capabilityKey: "knowledge", riskLevel: "LOW" },
  { toolKey: "genesis.reporting.generate", capabilityKey: "reporting", riskLevel: "LOW" },
  ] as const
).map((entry) => ({
  toolId: geaId("geatool"),
  toolVersion: "gea-tool/v1",
  enabled: true,
  ...entry,
}));

export function createInMemoryToolRegistry(seed: ToolDefinition[] = DEFAULT_TOOLS): ToolRegistry {
  const store = new Map(seed.map((entry) => [entry.toolKey, entry]));

  return {
    list: () => [...store.values()].sort((a, b) => a.toolKey.localeCompare(b.toolKey)),
    get: (toolKey) => store.get(toolKey) ?? null,
    upsert: (tool) => {
      const next: ToolDefinition = {
        toolId: tool.toolId ?? geaId("geatool"),
        toolKey: tool.toolKey,
        toolVersion: tool.toolVersion,
        capabilityKey: tool.capabilityKey,
        riskLevel: tool.riskLevel,
        enabled: tool.enabled,
      };
      store.set(next.toolKey, next);
      return next;
    },
  };
}

export function createDefaultToolExecutor(): ToolExecutor {
  return {
    async execute(invocation) {
      return {
        invocationId: invocation.invocationId,
        status: "SUCCESS",
        output: {
          toolKey: invocation.toolKey,
          echo: invocation.input,
          synthetic: true,
        },
        completedAt: new Date().toISOString(),
      };
    },
  };
}

export function authorizeToolUse(input: {
  allowedCapabilities: string[];
  tool: ToolDefinition | null;
}): ToolAuthorization {
  if (!input.tool || !input.tool.enabled) {
    return { allowed: false, reason: "Tool is not registered or not enabled." };
  }

  if (!input.allowedCapabilities.includes(input.tool.capabilityKey)) {
    return { allowed: false, reason: "Tool capability is not authorized for this execution." };
  }

  return { allowed: true, reason: "Allowed" };
}
