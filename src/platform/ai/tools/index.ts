import type { AIToolDefinition, AIToolExecutionRequest, AIToolExecutionResult, AIAuditRecord } from "../contracts";

export class ToolAuthorizationError extends Error {
  constructor(toolId: string) {
    super(`tool authorization denied: ${toolId}`);
    this.name = "ToolAuthorizationError";
  }
}

export class ToolValidationError extends Error {
  constructor(toolId: string, reason: string) {
    super(`tool validation failed for ${toolId}: ${reason}`);
    this.name = "ToolValidationError";
  }
}

export type ToolHandler = (input: unknown) => unknown | Promise<unknown>;

export type ToolRegistration = AIToolDefinition & {
  execute: ToolHandler;
  validateInput?: (input: unknown) => boolean;
  validateOutput?: (output: unknown) => boolean;
};

export class ToolRegistry {
  private readonly tools = new Map<string, ToolRegistration>();
  private readonly auditRecords: AIAuditRecord[] = [];

  register(tool: ToolRegistration): void {
    this.tools.set(tool.toolId, tool);
  }

  get(toolId: string): ToolRegistration | undefined {
    return this.tools.get(toolId);
  }

  list(): AIToolDefinition[] {
    return Array.from(this.tools.values()).map(({ execute, validateInput, validateOutput, ...tool }) => structuredClone(tool));
  }

  async execute(request: AIToolExecutionRequest): Promise<AIToolExecutionResult> {
    const tool = this.tools.get(request.toolId);
    const completedAt = new Date().toISOString();

    if (!tool) {
      const result: AIToolExecutionResult = {
        toolId: request.toolId,
        status: "FAILED",
        reason: "unknown tool",
        retryable: false,
        completedAt,
      };
      this.auditRecords.push(this.buildAudit(request, result, "TOOL_REJECTED", "unknown tool"));
      return result;
    }

    if (!tool.permissions.every((permission) => request.permissions.includes(permission))) {
      const result: AIToolExecutionResult = {
        toolId: request.toolId,
        status: "BLOCKED",
        reason: "insufficient permissions",
        retryable: false,
        completedAt,
      };
      this.auditRecords.push(this.buildAudit(request, result, "TOOL_REJECTED", "insufficient permissions"));
      return result;
    }

    if (tool.validateInput && !tool.validateInput(request.input)) {
      throw new ToolValidationError(request.toolId, "invalid input");
    }

    try {
      const output = await tool.execute(request.input);
      if (tool.validateOutput && !tool.validateOutput(output)) {
        throw new ToolValidationError(request.toolId, "invalid output");
      }

      const result: AIToolExecutionResult = {
        toolId: request.toolId,
        status: "SUCCEEDED",
        output,
        retryable: false,
        completedAt,
      };
      this.auditRecords.push(this.buildAudit(request, result, "TOOL_EXECUTED", "tool executed"));
      return result;
    } catch (error) {
      const result: AIToolExecutionResult = {
        toolId: request.toolId,
        status: "FAILED",
        reason: error instanceof Error ? error.message : "tool execution failed",
        retryable: false,
        completedAt,
      };
      this.auditRecords.push(this.buildAudit(request, result, "TOOL_REJECTED", result.reason ?? "tool execution failed"));
      return result;
    }
  }

  auditTrail(): AIAuditRecord[] {
    return this.auditRecords.map((record) => structuredClone(record));
  }

  private buildAudit(request: AIToolExecutionRequest, result: AIToolExecutionResult, eventType: "TOOL_EXECUTED" | "TOOL_REJECTED", message: string): AIAuditRecord {
    return {
      recordId: `atool_${request.executionId}_${request.toolId}`,
      eventType,
      executionId: request.executionId,
      toolId: request.toolId,
      tenant: request.tenant,
      workspace: request.workspace,
      actorId: request.actorId,
      message,
      details: {
        status: result.status,
        reason: result.reason,
      },
      recordedAt: result.completedAt,
    };
  }
}
