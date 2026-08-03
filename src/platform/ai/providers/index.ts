import { randomUUID } from "node:crypto";
import type {
  AIProviderAdapterDefinition,
  AIProviderCapability,
  AIProviderHealth,
  AIProviderName,
  AIProviderRequest,
  AIProviderResponse,
  AIHealthStatus,
} from "../contracts";

function stableSerialize(input: Record<string, string>): string {
  return Object.keys(input).sort().map((key) => `${key}=${input[key]}`).join("|");
}

export interface AIProvider {
  readonly capability: AIProviderCapability;
  generate(request: AIProviderRequest): Promise<AIProviderResponse>;
  health(): Promise<AIProviderHealth>;
}

export type MockProviderOptions = {
  providerName?: AIProviderName;
  failureReason?: string;
  retryable?: boolean;
  structuredOutput?: boolean;
};

export class MockAIProvider implements AIProvider {
  readonly capability: AIProviderCapability;

  constructor(private readonly options: MockProviderOptions = {}) {
    const providerName = options.providerName ?? "MOCK";
    this.capability = {
      providerName,
      supportedModels: ["mock-chat", "mock-router", "mock-tooling"],
      supportsStreaming: false,
      supportsStructuredOutput: options.structuredOutput ?? true,
      metadata: { adapter: "mock" },
    };
  }

  async generate(request: AIProviderRequest): Promise<AIProviderResponse> {
    if (this.options.failureReason) {
      const error = new Error(this.options.failureReason);
      (error as Error & { retryable?: boolean }).retryable = this.options.retryable ?? true;
      throw error;
    }

    const orderedVariables = stableSerialize(request.variables);
    const toolSummary = request.toolResults.length > 0
      ? request.toolResults.map((result) => `${result.toolId}:${result.status}`).join(",")
      : "no-tools";
    const output = [
      `provider=${this.capability.providerName}`,
      `model=${request.modelId}`,
      `prompt=${request.prompt}`,
      `variables=${orderedVariables}`,
      `tools=${toolSummary}`,
    ].join("\n");

    const latencyMs = Math.max(1, request.prompt.length + orderedVariables.length + toolSummary.length);
    const tokenInput = Math.max(1, Math.ceil(request.prompt.length / 4));
    const tokenOutput = Math.max(1, Math.ceil(output.length / 4));

    return {
      providerName: this.capability.providerName,
      modelId: request.modelId,
      output,
      tokens: {
        input: tokenInput,
        output: tokenOutput,
        total: tokenInput + tokenOutput,
      },
      cost: Number(((tokenInput + tokenOutput) * 0.0001).toFixed(4)),
      latencyMs,
      structuredOutput: this.capability.supportsStructuredOutput
        ? {
          executionId: request.executionId,
          promptHash: Buffer.from(request.prompt, "utf8").toString("base64url"),
        }
        : undefined,
      metadata: {
        executionId: request.executionId,
        toolCount: String(request.toolResults.length),
        requestId: randomUUID(),
      },
    };
  }

  async health(): Promise<AIProviderHealth> {
    if (this.options.failureReason) {
      return {
        providerName: this.capability.providerName,
        status: "DEGRADED",
        detail: this.options.failureReason,
      };
    }

    return {
      providerName: this.capability.providerName,
      status: "HEALTHY",
      detail: "mock provider available",
      latencyMs: 1,
    };
  }
}

export class AIProviderRegistry {
  private readonly providers = new Map<AIProviderName, AIProvider>();
  private readonly adapters = new Map<AIProviderName, AIProviderAdapterDefinition>();

  register(provider: AIProvider, adapter?: AIProviderAdapterDefinition): void {
    this.providers.set(provider.capability.providerName, provider);
    this.adapters.set(provider.capability.providerName, adapter ?? {
      providerName: provider.capability.providerName,
      description: `${provider.capability.providerName} adapter`,
      supportedModels: provider.capability.supportedModels,
      supportsStreaming: provider.capability.supportsStreaming,
      supportsStructuredOutput: provider.capability.supportsStructuredOutput,
    });
  }

  registerAdapter(adapter: AIProviderAdapterDefinition): void {
    this.adapters.set(adapter.providerName, adapter);
  }

  get(providerName: AIProviderName): AIProvider | undefined {
    return this.providers.get(providerName);
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  listAdapters(): AIProviderAdapterDefinition[] {
    return Array.from(this.adapters.values());
  }

  async health(): Promise<AIProviderHealth[]> {
    const result: AIProviderHealth[] = [];
    for (const provider of this.providers.values()) {
      result.push(await provider.health());
    }
    return result;
  }

  select(providerName?: AIProviderName, fallbackProviderNames: AIProviderName[] = [], modelId?: string): AIProvider {
    const candidates = [providerName, ...fallbackProviderNames].filter((candidate): candidate is AIProviderName => Boolean(candidate));
    for (const candidate of candidates) {
      const provider = this.providers.get(candidate);
      if (provider) {
        return provider;
      }
    }

    if (modelId) {
      for (const provider of this.providers.values()) {
        if (provider.capability.supportedModels.includes(modelId)) {
          return provider;
        }
      }
    }

    const first = this.providers.values().next();
    if (!first.done) {
      return first.value;
    }

    throw new Error("no AI provider registered");
  }
}

export function createAIProviderRegistry(providers: AIProvider[] = []): AIProviderRegistry {
  const registry = new AIProviderRegistry();
  for (const provider of providers) {
    registry.register(provider);
  }
  return registry;
}

export function createOpenAIAdapter(models: string[] = ["gpt-4.1", "gpt-4.1-mini"]): AIProviderAdapterDefinition {
  return {
    providerName: "OPENAI",
    description: "OpenAI adapter placeholder",
    supportedModels: models,
    supportsStreaming: true,
    supportsStructuredOutput: true,
  };
}

export function createAnthropicAdapter(models: string[] = ["claude-3.5-sonnet"]): AIProviderAdapterDefinition {
  return {
    providerName: "ANTHROPIC",
    description: "Anthropic adapter placeholder",
    supportedModels: models,
    supportsStreaming: true,
    supportsStructuredOutput: true,
  };
}

export function createGeminiAdapter(models: string[] = ["gemini-2.0-pro"]): AIProviderAdapterDefinition {
  return {
    providerName: "GEMINI",
    description: "Gemini adapter placeholder",
    supportedModels: models,
    supportsStreaming: true,
    supportsStructuredOutput: true,
  };
}

export function createAzureOpenAIAdapter(models: string[] = ["azure-gpt-4.1"]): AIProviderAdapterDefinition {
  return {
    providerName: "AZURE_OPENAI",
    description: "Azure OpenAI adapter placeholder",
    supportedModels: models,
    supportsStreaming: true,
    supportsStructuredOutput: true,
  };
}

export function createLocalLLMAdapter(models: string[] = ["local-llm"]): AIProviderAdapterDefinition {
  return {
    providerName: "LOCAL_LLM",
    description: "Local LLM adapter placeholder",
    supportedModels: models,
    supportsStreaming: false,
    supportsStructuredOutput: true,
  };
}
