import type { AIPromptDefinition, AIPromptRender, AIAuditRecord } from "../contracts";

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function collectVariables(template: string): string[] {
  const matches = template.match(VARIABLE_PATTERN) ?? [];
  return Array.from(new Set(matches.map((token) => token.replace(/\{\{|\}\}/g, "").trim())));
}

function interpolate(template: string, variables: Record<string, string>): string {
  return template.replace(VARIABLE_PATTERN, (_, variableName: string) => variables[variableName] ?? "");
}

export class PromptRegistry {
  private readonly prompts = new Map<string, AIPromptDefinition>();
  private readonly auditTrail: AIAuditRecord[] = [];

  register(prompt: AIPromptDefinition): void {
    this.prompts.set(prompt.promptId, structuredClone(prompt));
  }

  get(promptId: string): AIPromptDefinition | undefined {
    const prompt = this.prompts.get(promptId);
    return prompt ? structuredClone(prompt) : undefined;
  }

  list(): AIPromptDefinition[] {
    return Array.from(this.prompts.values()).map((prompt) => structuredClone(prompt));
  }

  render(promptId: string, variables: Record<string, string>, context: { tenant: string; workspace: string; executionId: string; conversationId?: string; sessionId?: string; actorId?: string; }): AIPromptRender {
    const lineage: AIPromptDefinition[] = [];
    const visited = new Set<string>();
    const visit = (currentPromptId: string): void => {
      if (visited.has(currentPromptId)) {
        throw new Error(`prompt inheritance cycle detected: ${currentPromptId}`);
      }
      visited.add(currentPromptId);
      const definition = this.get(currentPromptId);
      if (!definition) {
        throw new Error(`unknown prompt: ${currentPromptId}`);
      }
      if (definition.inheritsFrom) {
        visit(definition.inheritsFrom);
      }
      lineage.push(definition);
    };

    visit(promptId);

    const requiredVariables = new Set<string>();
    for (const prompt of lineage) {
      for (const variableName of prompt.variables) {
        requiredVariables.add(variableName);
      }
      for (const variableName of collectVariables(prompt.template)) {
        requiredVariables.add(variableName);
      }
    }

    const missing = Array.from(requiredVariables).filter((name) => variables[name] === undefined);
    if (missing.length > 0) {
      throw new Error(`missing prompt variables: ${missing.join(", ")}`);
    }

    const renderedPrompt = lineage.map((prompt) => interpolate(prompt.template, variables)).join("\n");
    const renderedAt = new Date().toISOString();

    this.auditTrail.push({
      recordId: `aprompt_${context.executionId}`,
      eventType: "PROMPT_RENDERED",
      executionId: context.executionId,
      agentId: undefined,
      modelId: undefined,
      providerName: undefined,
      promptId,
      tenant: context.tenant,
      workspace: context.workspace,
      conversationId: context.conversationId,
      sessionId: context.sessionId,
      actorId: context.actorId,
      message: "prompt rendered",
      details: { lineage: lineage.map((item) => item.promptId), variables },
      recordedAt: renderedAt,
    });

    return {
      promptId,
      renderedPrompt,
      variables: structuredClone(variables),
      lineage: lineage.map((item) => item.promptId),
      renderedAt,
    };
  }

  auditTrail(): AIAuditRecord[] {
    return this.auditTrail.map((record) => structuredClone(record));
  }
}
