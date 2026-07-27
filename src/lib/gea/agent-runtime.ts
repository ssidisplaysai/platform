import {
  geaId,
  nowIso,
  stableChecksum,
  type Agent,
  type AgentAction,
  type AgentExecution,
  type AgentMemoryReference,
  type AgentReplay,
  type AgentResult,
} from "./agent-models";
import { createPlanGenerator, createExecutionPlanner } from "./planning-engine";
import { createPermissionEngine } from "./permission-engine";
import { createContextBuilderService } from "./context-builder";
import { createDefaultToolExecutor, authorizeToolUse, type ToolRegistry, type ToolInvocation } from "./tool-framework";
import { createCapabilityResolver, type CapabilityRegistry } from "./capability-registry";
import type { GeaRepository } from "./agent-repository";

export type AgentRuntimeService = {
  registerAgent: (agent: Agent) => Promise<Agent>;
  listAgents: (workspaceId: string) => Promise<Agent[]>;
  getAgent: (agentId: string) => Promise<Agent | null>;
  createPlan: (input: {
    agentId: string;
    workspaceId: string;
    objective: string;
    actorId: string;
    references: AgentMemoryReference[];
  }) => Promise<{ planId: string }>;
  executePlan: (input: {
    agentId: string;
    workspaceId: string;
    projectId?: string;
    planId: string;
    actorId: string;
    role: string;
    allowedActions: string[];
  }) => Promise<AgentExecution>;
  pauseExecution: (executionId: string, actorId: string) => Promise<AgentExecution>;
  resumeExecution: (executionId: string, actorId: string, allowedActions: string[]) => Promise<AgentExecution>;
  cancelExecution: (executionId: string, actorId: string) => Promise<AgentExecution>;
  replayExecution: (executionId: string, actorId: string) => Promise<AgentReplay>;
  approveTask: (executionId: string, taskId: string, actorId: string) => Promise<void>;
  rejectTask: (executionId: string, taskId: string, actorId: string, reason: string) => Promise<void>;
  listExecutions: (workspaceId: string, agentId?: string) => Promise<AgentExecution[]>;
  getTimeline: (executionId: string) => Promise<AgentExecution["timeline"]>;
  listAudits: (executionId: string) => Promise<Awaited<ReturnType<GeaRepository["listAuditRecords"]>>>
  listReplays: (executionId: string) => Promise<Awaited<ReturnType<GeaRepository["listReplays"]>>>
  listApprovals: (executionId: string) => Promise<Awaited<ReturnType<GeaRepository["listApprovals"]>>>
  listMemoryReferences: (agentId: string) => Promise<AgentMemoryReference[]>;
};

export type GeaRuntimeDependencies = {
  repository: GeaRepository;
  capabilityRegistry: CapabilityRegistry;
  toolRegistry: ToolRegistry;
};

async function appendAudit(repo: GeaRepository, executionId: string, actorId: string, eventType: string, details: Record<string, unknown>): Promise<void> {
  await repo.saveAuditRecord({
    auditRecordId: geaId("geaaudit"),
    executionId,
    actorId,
    eventType,
    details,
    createdAt: nowIso(),
  });
}

async function transitionExecution(repo: GeaRepository, execution: AgentExecution, state: AgentExecution["state"], note: string): Promise<AgentExecution> {
  const next: AgentExecution = {
    ...execution,
    state,
    timeline: [...execution.timeline, { at: nowIso(), state, note }],
    completedAt: state === "COMPLETED" || state === "FAILED" || state === "CANCELLED" ? nowIso() : execution.completedAt,
  };

  await repo.saveExecution(next);
  return next;
}

export function createAgentRuntimeService(deps: GeaRuntimeDependencies): AgentRuntimeService {
  const planGenerator = createPlanGenerator();
  const executionPlanner = createExecutionPlanner();
  const permissionEngine = createPermissionEngine();
  const contextBuilder = createContextBuilderService();
  const capabilityResolver = createCapabilityResolver(deps.capabilityRegistry);
  const toolExecutor = createDefaultToolExecutor();

  async function runExecution(execution: AgentExecution, actorId: string, allowedActions: string[]): Promise<AgentExecution> {
    const plan = await deps.repository.getPlan(execution.planId);
    if (!plan) {
      throw new Error("Execution plan not found.");
    }

    executionPlanner.assertPlanImmutable(plan, true);
    let current = await transitionExecution(deps.repository, execution, "RUNNING", "Execution started.");

    for (const task of plan.tasks) {
      if (current.state === "CANCELLED" || current.state === "FAILED") {
        break;
      }

      if (task.requiresApproval) {
        await deps.repository.saveApproval({
          approvalId: geaId("geaappr"),
          executionId: current.executionId,
          taskId: task.taskId,
          state: "PENDING",
          requestedBy: actorId,
          createdAt: nowIso(),
        });

        current = await transitionExecution(deps.repository, current, "WAITING_APPROVAL", `Approval required for task ${task.taskKey}.`);
        await appendAudit(deps.repository, current.executionId, actorId, "approval.pending", { taskId: task.taskId, taskKey: task.taskKey });
        return current;
      }

      const permission = permissionEngine.evaluate({
        workspaceId: current.workspaceId,
        projectId: current.projectId,
        role: "SYSTEM",
        capabilityKey: task.requiredCapability,
        toolKey: task.toolKey,
        runtimeState: current.state,
        allowedActions,
      });

      current.permissionEvaluations = [...current.permissionEvaluations, permission];
      await deps.repository.saveExecution(current);

      if (!permission.allowed) {
        current = await transitionExecution(deps.repository, current, "FAILED", `Permission denied for task ${task.taskKey}.`);
        await appendAudit(deps.repository, current.executionId, actorId, "permission.denied", { taskId: task.taskId, reason: permission.reason });
        return current;
      }

      const tool = task.toolKey ? deps.toolRegistry.get(task.toolKey) : null;
      const toolDecision = authorizeToolUse({
        allowedCapabilities: plan.tasks.map((entry) => entry.requiredCapability),
        tool,
      });

      if (task.toolKey && !toolDecision.allowed) {
        current = await transitionExecution(deps.repository, current, "FAILED", `Tool denied for task ${task.taskKey}.`);
        await appendAudit(deps.repository, current.executionId, actorId, "tool.denied", { taskId: task.taskId, reason: toolDecision.reason });
        return current;
      }

      const invocation: ToolInvocation = {
        invocationId: geaId("geainvoke"),
        executionId: current.executionId,
        taskId: task.taskId,
        toolKey: task.toolKey ?? "genesis.workflow.dispatch",
        toolVersion: tool?.toolVersion ?? "gea-tool/v1",
        input: task.input,
        createdAt: nowIso(),
      };

      const action: AgentAction = {
        actionId: geaId("geaact"),
        executionId: current.executionId,
        taskId: task.taskId,
        toolKey: invocation.toolKey,
        toolVersion: invocation.toolVersion,
        status: "RUNNING",
        input: invocation.input,
        startedAt: nowIso(),
      };
      await deps.repository.saveAction(action);

      const toolResult = await toolExecutor.execute(invocation);
      const completedAction: AgentAction = {
        ...action,
        status: toolResult.status === "SUCCESS" ? "COMPLETED" : "FAILED",
        output: toolResult.output,
        error: toolResult.error,
        completedAt: toolResult.completedAt,
      };
      await deps.repository.saveAction(completedAction);

      await appendAudit(deps.repository, current.executionId, actorId, "task.completed", {
        taskId: task.taskId,
        taskKey: task.taskKey,
        toolKey: completedAction.toolKey,
      });

      if (toolResult.status !== "SUCCESS") {
        current = await transitionExecution(deps.repository, current, "FAILED", `Task failed: ${task.taskKey}`);
        return current;
      }
    }

    const result: AgentResult = {
      resultId: geaId("geares"),
      executionId: current.executionId,
      status: "SUCCESS",
      summary: "Execution completed successfully.",
      outputs: {
        taskCount: plan.tasks.length,
      },
      producedAt: nowIso(),
    };

    await deps.repository.saveResult(result);
    const completed = await transitionExecution(deps.repository, { ...current, resultId: result.resultId }, "COMPLETED", "Execution completed.");
    await appendAudit(deps.repository, completed.executionId, actorId, "execution.completed", { resultId: result.resultId });
    return completed;
  }

  return {
    async registerAgent(agent) {
      return deps.repository.upsertAgent(agent);
    },

    async listAgents(workspaceId) {
      return deps.repository.listAgents(workspaceId);
    },

    async getAgent(agentId) {
      return deps.repository.getAgent(agentId);
    },

    async createPlan(input) {
      const agent = await deps.repository.getAgent(input.agentId);
      if (!agent) {
        throw new Error("Agent not found.");
      }

      const resolvedCapabilities = capabilityResolver.resolve(agent.capabilities.filter((entry) => entry.enabled).map((entry) => entry.capabilityKey));
      if (resolvedCapabilities.length === 0) {
        throw new Error("Agent has no enabled capabilities.");
      }

      const context = contextBuilder.build({
        workspaceId: input.workspaceId,
        references: input.references,
      });

      for (const reference of input.references) {
        await deps.repository.saveMemoryReference({
          ...reference,
          metadata: {
            ...(reference.metadata ?? {}),
            agentId: input.agentId,
            contextChecksum: context.checksum,
          },
        });
      }

      const plan = planGenerator.generatePlan({
        agentId: input.agentId,
        objective: input.objective,
        actorId: input.actorId,
        capabilities: resolvedCapabilities,
      });
      await deps.repository.savePlan(plan);
      return { planId: plan.planId };
    },

    async executePlan(input) {
      const plan = await deps.repository.getPlan(input.planId);
      if (!plan) {
        throw new Error("Plan not found.");
      }

      const execution: AgentExecution = {
        executionId: geaId("geaexec"),
        agentId: input.agentId,
        workspaceId: input.workspaceId,
        projectId: input.projectId,
        state: "QUEUED",
        objective: plan.objective,
        planId: plan.planId,
        planVersion: plan.planVersion,
        capabilityVersions: Object.fromEntries(plan.tasks.map((task) => [task.requiredCapability, "gea-capability/v1"])),
        toolVersions: Object.fromEntries(plan.tasks.map((task) => [task.toolKey ?? "genesis.workflow.dispatch", "gea-tool/v1"])),
        permissionEvaluations: [],
        timeline: [{ at: nowIso(), state: "QUEUED", note: "Execution queued." }],
        retries: 0,
        startedAt: nowIso(),
      };

      await deps.repository.saveExecution(execution);
      await appendAudit(deps.repository, execution.executionId, input.actorId, "execution.queued", {
        planId: execution.planId,
        planVersion: execution.planVersion,
      });

      return runExecution(execution, input.actorId, input.allowedActions);
    },

    async pauseExecution(executionId, actorId) {
      const execution = await deps.repository.getExecution(executionId);
      if (!execution) {
        throw new Error("Execution not found.");
      }

      const paused = await transitionExecution(deps.repository, execution, "PAUSED", "Execution paused by operator.");
      await appendAudit(deps.repository, executionId, actorId, "execution.paused", {});
      return paused;
    },

    async resumeExecution(executionId, actorId, allowedActions) {
      const execution = await deps.repository.getExecution(executionId);
      if (!execution) {
        throw new Error("Execution not found.");
      }

      if (execution.state !== "PAUSED" && execution.state !== "WAITING_APPROVAL") {
        throw new Error("Execution is not resumable.");
      }

      const resumed = await transitionExecution(deps.repository, execution, "RUNNING", "Execution resumed by operator.");
      await appendAudit(deps.repository, executionId, actorId, "execution.resumed", {});

      return runExecution(resumed, actorId, allowedActions);
    },

    async cancelExecution(executionId, actorId) {
      const execution = await deps.repository.getExecution(executionId);
      if (!execution) {
        throw new Error("Execution not found.");
      }

      const cancelled = await transitionExecution(deps.repository, execution, "CANCELLED", "Execution cancelled by operator.");
      await appendAudit(deps.repository, executionId, actorId, "execution.cancelled", {});
      return cancelled;
    },

    async replayExecution(executionId, actorId) {
      const execution = await deps.repository.getExecution(executionId);
      if (!execution) {
        throw new Error("Execution not found.");
      }

      const actions = await deps.repository.listActions(executionId);
      const checksum = stableChecksum({
        execution,
        actions: actions.map((entry) => ({ taskId: entry.taskId, toolKey: entry.toolKey, output: entry.output })),
      });

      const replay: AgentReplay = {
        replayId: geaId("geareplay"),
        executionId: geaId("geaexec"),
        replayOfExecutionId: executionId,
        deterministicMatch: true,
        replayChecksum: checksum,
        createdAt: nowIso(),
      };

      await deps.repository.saveReplay(replay);
      await appendAudit(deps.repository, executionId, actorId, "execution.replayed", { replayId: replay.replayId, checksum });
      return replay;
    },

    async approveTask(executionId, taskId, actorId) {
      const approvals = await deps.repository.listApprovals(executionId);
      const target = approvals.find((entry) => entry.taskId === taskId && entry.state === "PENDING");
      if (!target) {
        throw new Error("Approval request not found.");
      }

      await deps.repository.saveApproval({
        ...target,
        state: "APPROVED",
        decidedBy: actorId,
        decidedAt: nowIso(),
      });
      await appendAudit(deps.repository, executionId, actorId, "approval.approved", { taskId });
    },

    async rejectTask(executionId, taskId, actorId, reason) {
      const approvals = await deps.repository.listApprovals(executionId);
      const target = approvals.find((entry) => entry.taskId === taskId && entry.state === "PENDING");
      if (!target) {
        throw new Error("Approval request not found.");
      }

      await deps.repository.saveApproval({
        ...target,
        state: "REJECTED",
        reason,
        decidedBy: actorId,
        decidedAt: nowIso(),
      });
      await appendAudit(deps.repository, executionId, actorId, "approval.rejected", { taskId, reason });

      const execution = await deps.repository.getExecution(executionId);
      if (execution) {
        await transitionExecution(deps.repository, execution, "FAILED", `Approval rejected for task ${taskId}.`);
      }
    },

    async listExecutions(workspaceId, agentId) {
      return deps.repository.listExecutions(workspaceId, agentId);
    },

    async getTimeline(executionId) {
      const execution = await deps.repository.getExecution(executionId);
      return execution?.timeline ?? [];
    },

    async listAudits(executionId) {
      return deps.repository.listAuditRecords(executionId);
    },

    async listReplays(executionId) {
      return deps.repository.listReplays(executionId);
    },

    async listApprovals(executionId) {
      return deps.repository.listApprovals(executionId);
    },

    async listMemoryReferences(agentId) {
      return deps.repository.listMemoryReferences(agentId);
    },
  };
}
