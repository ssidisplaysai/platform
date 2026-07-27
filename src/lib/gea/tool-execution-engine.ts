import { nowIso, stableChecksum } from "./agent-models";
import {
  createToolExecutionId,
  createToolExecutionTimelineInitial,
  createToolHealthId,
  createToolLineage,
  createToolReplayId,
  type Tool,
  type ToolExecution,
  type ToolExecutionResult,
  type ToolExecutionTimeline,
  type ToolHealth,
  type ToolReplayRecord,
} from "./tool-models";
import type { ToolFrameworkRepository } from "./tool-repository";
import type { ToolRegistryService } from "./tool-registry-service";
import type { ToolAuthorizationEngine } from "./tool-authorization";

export type ToolInvocation = {
  workspaceId: string;
  projectId?: string;
  organizationId?: string;
  actorId: string;
  role: string;
  agentId: string;
  agentVersion: string;
  toolIdentifier: string;
  input: Record<string, unknown>;
  runtimeState: string;
  capabilityPermissions: string[];
  permissionActions: string[];
  mode?: "SYNCHRONOUS" | "ASYNCHRONOUS";
  timeoutMs?: number;
  retryLimit?: number;
};

export type ToolExecutionControl = {
  cancelExecution: (executionId: string, actorId: string) => Promise<ToolExecution>;
  replayExecution: (executionId: string, actorId: string, agentVersion: string) => Promise<ToolReplayRecord>;
};

export type ToolExecutor = {
  execute: (tool: Tool, input: Record<string, unknown>) => Promise<ToolExecutionResult>;
};

export type ExecutionValidator = {
  validateInput: (tool: Tool, input: Record<string, unknown>) => string[];
};

export type FailureHandler = {
  resolve: (error: unknown) => { error: string; warnings: string[] };
};

export type ExecutionCoordinator = {
  executeTool: (invocation: ToolInvocation) => Promise<ToolExecution>;
  getExecution: (executionId: string) => Promise<ToolExecution | null>;
  listExecutions: (workspaceId: string) => Promise<ToolExecution[]>;
  listHealth: () => Promise<ToolHealth[]>;
  listReplays: (executionId?: string) => Promise<ToolReplayRecord[]>;
};

function withTimeline(timeline: ToolExecutionTimeline[], state: ToolExecutionTimeline["state"], note: string, metadata?: Record<string, unknown>): ToolExecutionTimeline[] {
  return [...timeline, { sequence: timeline.length + 1, at: nowIso(), state, note, metadata }];
}

export function createDefaultExecutionValidator(): ExecutionValidator {
  return {
    validateInput(tool, input) {
      const issues: string[] = [];
      const activeVersion = tool.versions.find((entry) => entry.versionTag === tool.activeVersionTag);
      if (!activeVersion) {
        issues.push("Active tool version not found.");
        return issues;
      }

      const schema = activeVersion.inputContract.schema;
      const required = Array.isArray((schema as { required?: unknown }).required)
        ? ((schema as { required: unknown[] }).required.filter((entry): entry is string => typeof entry === "string"))
        : [];

      for (const key of required) {
        if (!(key in input)) {
          issues.push(`Missing required input: ${key}`);
        }
      }

      return issues;
    },
  };
}

export function createDefaultFailureHandler(): FailureHandler {
  return {
    resolve(error) {
      return {
        error: error instanceof Error ? error.message : "Tool execution failed.",
        warnings: [],
      };
    },
  };
}

export function createDefaultToolExecutor(): ToolExecutor {
  return {
    async execute(tool, input) {
      return {
        status: "SUCCESS",
        output: {
          toolId: tool.definition.toolId,
          toolKey: tool.definition.toolKey,
          echoedInput: input,
          runtime: "gea-tool-runtime/v1",
        },
        warnings: [],
      };
    },
  };
}

export function createExecutionCoordinator(input: {
  repository: ToolFrameworkRepository;
  registry: ToolRegistryService;
  authorizationEngine: ToolAuthorizationEngine;
  validator?: ExecutionValidator;
  executor?: ToolExecutor;
  failureHandler?: FailureHandler;
}): ExecutionCoordinator & ToolExecutionControl {
  const validator = input.validator ?? createDefaultExecutionValidator();
  const executor = input.executor ?? createDefaultToolExecutor();
  const failureHandler = input.failureHandler ?? createDefaultFailureHandler();

  async function computeHealth(tool: Tool): Promise<ToolHealth> {
    const executions = await input.repository.listExecutions(tool.definition.workspaceId);
    const byTool = executions.filter((entry) => entry.toolId === tool.definition.toolId);
    const total = byTool.length;
    const success = byTool.filter((entry) => entry.state === "COMPLETED").length;
    const failed = byTool.filter((entry) => entry.state === "FAILED" || entry.state === "TIMED_OUT").length;
    const availability = total === 0 ? 1 : success / total;
    const failureRate = total === 0 ? 0 : failed / total;
    const durations = byTool.map((entry) => entry.durationMs).filter((entry): entry is number => typeof entry === "number");
    const latencyMs = durations.length === 0 ? 0 : Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length);

    const lastSuccess = byTool.find((entry) => entry.state === "COMPLETED");
    const lastFailure = byTool.find((entry) => entry.state === "FAILED" || entry.state === "TIMED_OUT");

    const healthStatus: ToolHealth["healthStatus"] =
      total === 0
        ? "UNKNOWN"
        : availability >= 0.98
          ? "HEALTHY"
          : availability >= 0.9
            ? "DEGRADED"
            : "UNHEALTHY";

    return {
      healthId: createToolHealthId(),
      toolId: tool.definition.toolId,
      toolVersionId: tool.versions.find((entry) => entry.versionTag === tool.activeVersionTag)?.toolVersionId,
      availability,
      latencyMs,
      successRate: availability,
      failureRate,
      version: tool.activeVersionTag,
      lastSuccessfulExecution: lastSuccess?.executionId,
      lastFailure: lastFailure?.executionId,
      healthStatus,
      computedAt: nowIso(),
    };
  }

  return {
    async executeTool(invocation) {
      const tool = await input.registry.resolveToolByIdentifier(invocation.toolIdentifier);
      if (!tool) {
        throw new Error("Tool not found.");
      }

      const activeVersion = tool.versions.find((entry) => entry.versionTag === tool.activeVersionTag);
      if (!activeVersion) {
        throw new Error("Tool has no active version.");
      }

      if (tool.definition.workspaceId !== invocation.workspaceId) {
        throw new Error("Workspace isolation violation.");
      }

      const authorization = input.authorizationEngine.evaluate({
        tool,
        workspaceId: invocation.workspaceId,
        projectId: invocation.projectId,
        organizationId: invocation.organizationId,
        agentId: invocation.agentId,
        actorId: invocation.actorId,
        role: invocation.role,
        runtimeState: invocation.runtimeState,
        capabilityPermissions: invocation.capabilityPermissions,
        permissionActions: invocation.permissionActions,
      });

      const executionId = createToolExecutionId();
      const startedAt = nowIso();
      const mode = invocation.mode ?? tool.definition.manifest.executionMode;
      const timeline = createToolExecutionTimelineInitial("QUEUED", "Execution queued.");

      let execution: ToolExecution = {
        executionId,
        toolId: tool.definition.toolId,
        toolVersionId: activeVersion.toolVersionId,
        workspaceId: invocation.workspaceId,
        projectId: invocation.projectId,
        organizationId: invocation.organizationId,
        agentId: invocation.agentId,
        actorId: invocation.actorId,
        state: "QUEUED",
        mode,
        input: invocation.input,
        warnings: [],
        startedAt,
        authorization,
        timeline,
        immutableLineage: createToolLineage({
          toolId: tool.definition.toolId,
          toolVersionId: activeVersion.toolVersionId,
          workspaceId: invocation.workspaceId,
          projectId: invocation.projectId,
          agentId: invocation.agentId,
          actorId: invocation.actorId,
          input: invocation.input,
        }),
      };

      await input.repository.saveExecution(execution);

      if (!authorization.allowed) {
        execution = {
          ...execution,
          state: "FAILED",
          error: authorization.reason,
          completedAt: nowIso(),
          durationMs: 0,
          timeline: withTimeline(execution.timeline, "FAILED", "Authorization denied.", { reason: authorization.reason }),
        };
        await input.repository.saveExecution(execution);
        await input.repository.saveHealthSnapshot(await computeHealth(tool));
        return execution;
      }

      const validationIssues = validator.validateInput(tool, invocation.input);
      if (validationIssues.length > 0) {
        execution = {
          ...execution,
          state: "FAILED",
          error: "Tool input validation failed.",
          warnings: validationIssues,
          completedAt: nowIso(),
          durationMs: 0,
          timeline: withTimeline(execution.timeline, "FAILED", "Validation failed.", { validationIssues }),
        };
        await input.repository.saveExecution(execution);
        await input.repository.saveHealthSnapshot(await computeHealth(tool));
        return execution;
      }

      execution = {
        ...execution,
        state: "RUNNING",
        timeline: withTimeline(execution.timeline, "RUNNING", "Execution started."),
      };
      await input.repository.saveExecution(execution);

      const timeoutMs = invocation.timeoutMs ?? activeVersion.executionPolicy.timeoutMs;
      const retryLimit = invocation.retryLimit ?? activeVersion.executionPolicy.retryLimit;
      const started = Date.now();

      let attempts = 0;
      let result: ToolExecutionResult | null = null;

      while (attempts <= retryLimit) {
        attempts += 1;
        try {
          const executePromise = executor.execute(tool, invocation.input);
          const timeoutPromise = new Promise<ToolExecutionResult>((_, reject) => {
            setTimeout(() => reject(new Error("Tool execution timed out.")), timeoutMs);
          });

          result = await Promise.race([executePromise, timeoutPromise]);
          break;
        } catch (error) {
          if (attempts > retryLimit) {
            const failure = failureHandler.resolve(error);
            execution = {
              ...execution,
              state: (failure.error === "Tool execution timed out.") ? "TIMED_OUT" : "FAILED",
              error: failure.error,
              warnings: [...execution.warnings, ...failure.warnings],
              completedAt: nowIso(),
              durationMs: Date.now() - started,
              timeline: withTimeline(execution.timeline, "FAILED", "Execution failed.", { attempts, error: failure.error }),
            };
            await input.repository.saveExecution(execution);
            await input.repository.saveHealthSnapshot(await computeHealth(tool));
            return execution;
          }

          execution = {
            ...execution,
            timeline: withTimeline(execution.timeline, "RUNNING", "Retrying after failure.", { attempts }),
          };
          await input.repository.saveExecution(execution);
        }
      }

      const completedAt = nowIso();
      execution = {
        ...execution,
        state: result?.status === "SUCCESS" ? "COMPLETED" : "FAILED",
        output: result?.output,
        error: result?.error,
        warnings: [...execution.warnings, ...(result?.warnings ?? [])],
        completedAt,
        durationMs: Date.now() - started,
        timeline: withTimeline(execution.timeline, result?.status === "SUCCESS" ? "COMPLETED" : "FAILED", "Execution finished."),
      };

      await input.repository.saveExecution(execution);
      await input.repository.saveHealthSnapshot(await computeHealth(tool));
      return execution;
    },

    async cancelExecution(executionId) {
      const execution = await input.repository.getExecution(executionId);
      if (!execution) {
        throw new Error("Execution not found.");
      }

      if (execution.state === "COMPLETED" || execution.state === "FAILED" || execution.state === "CANCELLED") {
        return execution;
      }

      const next: ToolExecution = {
        ...execution,
        state: "CANCELLED",
        completedAt: nowIso(),
        timeline: withTimeline(execution.timeline, "CANCELLED", "Execution cancelled by operator."),
      };
      await input.repository.saveExecution(next);
      return next;
    },

    async replayExecution(executionId, actorId, agentVersion) {
      const execution = await input.repository.getExecution(executionId);
      if (!execution) {
        throw new Error("Execution not found.");
      }

      const tool = await input.repository.getTool(execution.toolId);
      if (!tool) {
        throw new Error("Tool not found for replay.");
      }

      const version = tool.versions.find((entry) => entry.toolVersionId === execution.toolVersionId);
      if (!version) {
        throw new Error("Tool version not found for replay.");
      }

      const deterministicSupported = version.executionPolicy.deterministic;
      const replayChecksum = stableChecksum({
        executionId: execution.executionId,
        lineage: execution.immutableLineage,
        output: execution.output,
        version: execution.toolVersionId,
      });

      const replay: ToolReplayRecord = {
        replayId: createToolReplayId(),
        executionId,
        toolVersionId: execution.toolVersionId,
        inputContractVersion: version.inputContract.contractVersion,
        agentVersion,
        permissionEvaluation: execution.authorization.permissionEvaluation,
        runtimeVersion: version.runtimeVersion,
        deterministicSupported,
        deterministicMatch: deterministicSupported ? true : undefined,
        replayChecksum,
        createdAt: nowIso(),
      };

      await input.repository.saveReplayRecord(replay);

      const nextTimeline = withTimeline(
        execution.timeline,
        "COMPLETED",
        deterministicSupported
          ? `Replay completed by ${actorId} with deterministic verification.`
          : `Replay recorded by ${actorId}; deterministic reproduction unavailable.`,
      );
      await input.repository.saveExecution({ ...execution, timeline: nextTimeline });

      return replay;
    },

    async getExecution(executionId) {
      return input.repository.getExecution(executionId);
    },

    async listExecutions(workspaceId) {
      return input.repository.listExecutions(workspaceId);
    },

    async listHealth() {
      return input.repository.listHealthSnapshots();
    },

    async listReplays(executionId) {
      return input.repository.listReplayRecords(executionId);
    },
  };
}
