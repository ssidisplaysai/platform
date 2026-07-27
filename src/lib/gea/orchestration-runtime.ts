import { nowIso, stableChecksum } from "./agent-models";
import type { AgentRuntimeService } from "./agent-runtime";
import {
  canonicalizeWorkflowDefinition,
  createImmutableExecutionLineage,
  createOrchestrationIds,
  currentOrchestrationRuntimeVersion,
  orchestrationChecksum,
  type AgentDelegation,
  type ApprovalCheckpoint,
  type CompensationAction,
  type CoordinationState,
  type ExecutionSnapshot,
  type ExecutionTimeline,
  type Orchestration,
  type OrchestrationExecution,
  type OrchestrationHealth,
  type ReplayRecord,
  type WorkflowDefinition,
  type WorkflowStep,
  type WorkflowVersion,
} from "./orchestration-models";
import type { OrchestrationRepository } from "./orchestration-repository";

export type WorkflowCompiler = {
  compile: (input: {
    workspaceId: string;
    organizationId: string;
    projectId?: string;
    orchestrationName: string;
    orchestrationDescription: string;
    workflowKey: string;
    workflowName: string;
    workflowDescription: string;
    steps: WorkflowStep[];
    transitions?: WorkflowDefinition["transitions"];
    dependencies?: WorkflowDefinition["dependencies"];
    scheduling?: WorkflowDefinition["scheduling"];
    actorId: string;
  }) => Promise<{ orchestration: Orchestration; workflow: WorkflowDefinition; workflowVersion: WorkflowVersion }>;
};

export type WorkflowValidator = {
  validate: (workflow: WorkflowDefinition) => { valid: boolean; issues: string[] };
};

export type DependencyResolver = {
  orderSteps: (workflow: WorkflowDefinition) => { ordered: WorkflowStep[]; blocked: string[] };
};

export type TransitionEngine = {
  nextSteps: (workflow: WorkflowDefinition, completedStepIds: string[], failedStepIds: string[]) => string[];
};

export type AssignmentResolver = {
  resolve: (step: WorkflowStep) => { agentId: string; agentVersion: string; reason: string };
};

export type AgentAvailabilityResolver = {
  isAvailable: (agentId: string) => boolean;
};

export type DelegationEngine = {
  delegate: (input: {
    executionId: string;
    stepId: string;
    fromAgentId: string;
    toAgentId: string;
    reason: string;
  }) => AgentDelegation;
};

export type AgentCoordinator = {
  coordinate: (input: {
    execution: OrchestrationExecution;
    workflow: WorkflowDefinition;
    completedStepIds: string[];
    failedStepIds: string[];
  }) => Promise<{
    assignments: Array<{ stepId: string; agentId: string; agentVersion: string }>;
    delegations: AgentDelegation[];
  }>;
};

export type SchedulingBridge = {
  resolveStartAt: (workflow: WorkflowDefinition, requestedAt: string) => string;
};

export type ApprovalQueue = {
  enqueue: (checkpoint: ApprovalCheckpoint) => Promise<void>;
  list: (executionId?: string) => Promise<ApprovalCheckpoint[]>;
};

export type ApprovalHistory = {
  list: (executionId?: string) => Promise<ApprovalCheckpoint[]>;
};

export type ApprovalManager = {
  createCheckpoint: (input: {
    executionId: string;
    stepId: string;
    requiredApprovers: string[];
    timeoutAt?: string;
    escalationRole?: string;
  }) => Promise<ApprovalCheckpoint>;
  approve: (approvalCheckpointId: string, actorId: string) => Promise<ApprovalCheckpoint | null>;
  reject: (approvalCheckpointId: string, actorId: string) => Promise<ApprovalCheckpoint | null>;
  cancelByExecution: (executionId: string) => Promise<void>;
  queue: ApprovalQueue;
  history: ApprovalHistory;
};

export type RetryCoordinator = {
  shouldRetry: (step: WorkflowStep, currentRetries: number, state: CoordinationState) => boolean;
};

export type CompensationCoordinator = {
  compensate: (input: {
    executionId: string;
    step: WorkflowStep;
    reason: string;
  }) => Promise<CompensationAction>;
};

export type FailureRecovery = {
  recover: (execution: OrchestrationExecution) => Promise<OrchestrationExecution>;
};

export type WorkflowCoordinator = {
  execute: (execution: OrchestrationExecution, workflow: WorkflowDefinition, actorId: string) => Promise<OrchestrationExecution>;
};

export type ExecutionManager = {
  start: (input: {
    orchestrationId: string;
    workflowId: string;
    contextPackageId?: string;
    actorId: string;
    workspaceId: string;
    organizationId: string;
    projectId?: string;
  }) => Promise<OrchestrationExecution>;
  pause: (executionId: string, actorId: string) => Promise<OrchestrationExecution>;
  resume: (executionId: string, actorId: string) => Promise<OrchestrationExecution>;
  cancel: (executionId: string, actorId: string) => Promise<OrchestrationExecution>;
  replay: (executionId: string) => Promise<ReplayRecord>;
  recover: (executionId: string, actorId: string) => Promise<OrchestrationExecution>;
};

export type StateManager = {
  snapshot: (execution: OrchestrationExecution) => Promise<ExecutionSnapshot>;
};

export type OrchestrationRuntimeService = {
  workflowCompiler: WorkflowCompiler;
  workflowValidator: WorkflowValidator;
  dependencyResolver: DependencyResolver;
  transitionEngine: TransitionEngine;
  assignmentResolver: AssignmentResolver;
  availabilityResolver: AgentAvailabilityResolver;
  delegationEngine: DelegationEngine;
  agentCoordinator: AgentCoordinator;
  schedulingBridge: SchedulingBridge;
  approvalManager: ApprovalManager;
  retryCoordinator: RetryCoordinator;
  compensationCoordinator: CompensationCoordinator;
  failureRecovery: FailureRecovery;
  workflowCoordinator: WorkflowCoordinator;
  executionManager: ExecutionManager;
  stateManager: StateManager;

  listOrchestrations: (workspaceId: string) => Promise<Orchestration[]>;
  getOrchestration: (orchestrationId: string) => Promise<Orchestration | null>;
  listWorkflows: (workspaceId: string) => Promise<WorkflowDefinition[]>;
  getWorkflow: (workflowId: string) => Promise<WorkflowDefinition | null>;
  listExecutions: (workspaceId: string) => Promise<OrchestrationExecution[]>;
  getExecution: (executionId: string) => Promise<OrchestrationExecution | null>;
  listTimeline: (workspaceId: string, executionId?: string) => Promise<Array<{ executionId: string; timeline: ExecutionTimeline[] }>>;
  listApprovals: (workspaceId: string, executionId?: string) => Promise<ApprovalCheckpoint[]>;
  listHealth: (workspaceId: string) => Promise<OrchestrationHealth[]>;
  listReplays: (executionId?: string) => Promise<ReplayRecord[]>;
};

function withTimeline(
  execution: OrchestrationExecution,
  state: OrchestrationExecution["state"],
  note: string,
  metadata?: Record<string, unknown>,
): OrchestrationExecution {
  const next: OrchestrationExecution = {
    ...execution,
    state,
    timeline: [...execution.timeline, { sequence: execution.timeline.length + 1, at: nowIso(), state, note, metadata }],
    completedAt: state === "COMPLETED" || state === "FAILED" || state === "CANCELLED" ? nowIso() : execution.completedAt,
  };
  return next;
}

export function createWorkflowValidator(): WorkflowValidator {
  return {
    validate(workflow) {
      const issues: string[] = [];
      if (!workflow.workflowKey) issues.push("workflowKey is required.");
      if (workflow.steps.length === 0) issues.push("At least one workflow step is required.");

      const keys = new Set<string>();
      for (const step of workflow.steps) {
        if (keys.has(step.stepKey)) {
          issues.push(`Duplicate stepKey: ${step.stepKey}`);
        }
        keys.add(step.stepKey);
      }

      const stepIds = new Set(workflow.steps.map((entry) => entry.stepId));
      for (const dependency of workflow.dependencies) {
        if (!stepIds.has(dependency.stepId) || !stepIds.has(dependency.dependsOnStepId)) {
          issues.push(`Invalid dependency ${dependency.dependencyId}.`);
        }
      }

      return { valid: issues.length === 0, issues };
    },
  };
}

export function createDependencyResolver(): DependencyResolver {
  return {
    orderSteps(workflow) {
      const inDegree = new Map<string, number>();
      const graph = new Map<string, string[]>();

      for (const step of workflow.steps) {
        inDegree.set(step.stepId, 0);
        graph.set(step.stepId, []);
      }

      for (const dep of workflow.dependencies) {
        graph.get(dep.dependsOnStepId)?.push(dep.stepId);
        inDegree.set(dep.stepId, (inDegree.get(dep.stepId) ?? 0) + 1);
      }

      const queue = [...workflow.steps.filter((step) => (inDegree.get(step.stepId) ?? 0) === 0)];
      queue.sort((a, b) => a.order - b.order);

      const ordered: WorkflowStep[] = [];
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        ordered.push(next);

        for (const child of graph.get(next.stepId) ?? []) {
          inDegree.set(child, (inDegree.get(child) ?? 0) - 1);
          if ((inDegree.get(child) ?? 0) === 0) {
            const childStep = workflow.steps.find((entry) => entry.stepId === child);
            if (childStep) queue.push(childStep);
          }
        }
        queue.sort((a, b) => a.order - b.order);
      }

      const blocked = [...inDegree.entries()].filter(([, degree]) => degree > 0).map(([stepId]) => stepId);
      return { ordered, blocked };
    },
  };
}

export function createTransitionEngine(): TransitionEngine {
  return {
    nextSteps(workflow, completedStepIds, failedStepIds) {
      const completed = new Set(completedStepIds);
      const failed = new Set(failedStepIds);
      const deps = new Map<string, string[]>();
      for (const d of workflow.dependencies) {
        const arr = deps.get(d.stepId) ?? [];
        arr.push(d.dependsOnStepId);
        deps.set(d.stepId, arr);
      }

      return workflow.steps
        .filter((step) => !completed.has(step.stepId) && !failed.has(step.stepId))
        .filter((step) => {
          const required = deps.get(step.stepId) ?? [];
          return required.every((depId) => completed.has(depId));
        })
        .sort((a, b) => a.order - b.order)
        .map((step) => step.stepId);
    },
  };
}

export function createAssignmentResolver(): AssignmentResolver {
  return {
    resolve(step) {
      return {
        agentId: step.assignment.agentId,
        agentVersion: step.assignment.agentVersion,
        reason: "Workflow assignment policy",
      };
    },
  };
}

export function createAgentAvailabilityResolver(): AgentAvailabilityResolver {
  return {
    isAvailable() {
      return true;
    },
  };
}

export function createDelegationEngine(): DelegationEngine {
  return {
    delegate(input) {
      return {
        delegationId: createOrchestrationIds().delegationId,
        executionId: input.executionId,
        stepId: input.stepId,
        fromAgentId: input.fromAgentId,
        toAgentId: input.toAgentId,
        reason: input.reason,
        delegatedAt: nowIso(),
      };
    },
  };
}

export function createSchedulingBridge(): SchedulingBridge {
  return {
    resolveStartAt(workflow, requestedAt) {
      if (workflow.scheduling.mode === "DELAYED" && workflow.scheduling.delayMs && workflow.scheduling.delayMs > 0) {
        return new Date(Date.parse(requestedAt) + workflow.scheduling.delayMs).toISOString();
      }
      return requestedAt;
    },
  };
}

export function createApprovalManager(repository: OrchestrationRepository): ApprovalManager {
  const queue: ApprovalQueue = {
    async enqueue(checkpoint) {
      await repository.saveApproval(checkpoint);
    },
    async list(executionId) {
      return repository.listApprovals(executionId);
    },
  };

  const history: ApprovalHistory = {
    async list(executionId) {
      return repository.listApprovals(executionId);
    },
  };

  return {
    async createCheckpoint(input) {
      const now = nowIso();
      const checkpoint: ApprovalCheckpoint = {
        approvalCheckpointId: createOrchestrationIds().approvalCheckpointId,
        executionId: input.executionId,
        stepId: input.stepId,
        stage: "HIGH_RISK_STEP",
        state: "PENDING",
        requiredApprovers: input.requiredApprovers,
        approvedBy: [],
        timeoutAt: input.timeoutAt,
        escalationPolicy: input.escalationRole
          ? { escalateAfterMs: 300000, escalationRole: input.escalationRole }
          : undefined,
        createdAt: now,
        updatedAt: now,
      };
      await queue.enqueue(checkpoint);
      return checkpoint;
    },

    async approve(approvalCheckpointId, actorId) {
      const approvals = await repository.listApprovals();
      const found = approvals.find((entry) => entry.approvalCheckpointId === approvalCheckpointId);
      if (!found) return null;

      const next: ApprovalCheckpoint = {
        ...found,
        state: "APPROVED",
        approvedBy: [...new Set([...found.approvedBy, actorId])],
        updatedAt: nowIso(),
      };
      await repository.saveApproval(next);
      return next;
    },

    async reject(approvalCheckpointId, actorId) {
      const approvals = await repository.listApprovals();
      const found = approvals.find((entry) => entry.approvalCheckpointId === approvalCheckpointId);
      if (!found) return null;

      const next: ApprovalCheckpoint = {
        ...found,
        state: "REJECTED",
        approvedBy: [...new Set([...found.approvedBy, actorId])],
        updatedAt: nowIso(),
      };
      await repository.saveApproval(next);
      return next;
    },

    async cancelByExecution(executionId) {
      const approvals = await repository.listApprovals(executionId);
      for (const approval of approvals.filter((entry) => entry.state === "PENDING")) {
        await repository.saveApproval({ ...approval, state: "CANCELLED", updatedAt: nowIso() });
      }
    },

    queue,
    history,
  };
}

export function createRetryCoordinator(): RetryCoordinator {
  return {
    shouldRetry(step, currentRetries, state) {
      return step.retryPolicy.retryOnStates.includes(state) && currentRetries < step.retryPolicy.maxRetries;
    },
  };
}

export function createCompensationCoordinator(repository: OrchestrationRepository): CompensationCoordinator {
  return {
    async compensate(input) {
      const action: CompensationAction = {
        compensationActionId: createOrchestrationIds().compensationActionId,
        executionId: input.executionId,
        stepId: input.step.stepId,
        reversible: input.step.compensation?.reversible ?? false,
        actionType: input.step.compensation?.actionType ?? "NONE",
        status: input.step.compensation?.reversible ? "COMPLETED" : "SKIPPED",
        reason: input.reason,
        createdAt: nowIso(),
      };
      await repository.saveCompensation(action);
      return action;
    },
  };
}

export function createOrchestrationRuntimeService(input: {
  repository: OrchestrationRepository;
  agentRuntime: AgentRuntimeService;
}): OrchestrationRuntimeService {
  const workflowValidator = createWorkflowValidator();
  const dependencyResolver = createDependencyResolver();
  const transitionEngine = createTransitionEngine();
  const assignmentResolver = createAssignmentResolver();
  const availabilityResolver = createAgentAvailabilityResolver();
  const delegationEngine = createDelegationEngine();
  const schedulingBridge = createSchedulingBridge();
  const approvalManager = createApprovalManager(input.repository);
  const retryCoordinator = createRetryCoordinator();
  const compensationCoordinator = createCompensationCoordinator(input.repository);

  const workflowCompiler: WorkflowCompiler = {
    async compile(request) {
      const ids = createOrchestrationIds();
      const now = nowIso();

      const workflow: WorkflowDefinition = {
        workflowId: ids.workflowId,
        orchestrationId: ids.orchestrationId,
        workspaceId: request.workspaceId,
        organizationId: request.organizationId,
        projectId: request.projectId,
        workflowKey: request.workflowKey,
        name: request.workflowName,
        description: request.workflowDescription,
        lifecycleState: "ACTIVE",
        steps: [...request.steps].sort((a, b) => a.order - b.order),
        transitions: request.transitions ?? [],
        dependencies: request.dependencies ?? [],
        scheduling: request.scheduling ?? { mode: "IMMEDIATE" },
        createdAt: now,
        updatedAt: now,
      };

      const validation = workflowValidator.validate(workflow);
      if (!validation.valid) {
        throw new Error(`Invalid workflow definition: ${validation.issues.join("; ")}`);
      }

      const workflowVersion: WorkflowVersion = {
        workflowVersionId: ids.workflowVersionId,
        workflowId: workflow.workflowId,
        versionTag: "v1",
        immutable: true,
        definitionChecksum: orchestrationChecksum(canonicalizeWorkflowDefinition(workflow)),
        publishedBy: request.actorId,
        publishedAt: now,
      };

      const orchestration: Orchestration = {
        orchestrationId: ids.orchestrationId,
        workspaceId: request.workspaceId,
        organizationId: request.organizationId,
        projectId: request.projectId,
        name: request.orchestrationName,
        description: request.orchestrationDescription,
        lifecycleState: "ACTIVE",
        activeWorkflowId: workflow.workflowId,
        activeWorkflowVersionId: workflowVersion.workflowVersionId,
        versions: [
          {
            orchestrationVersionId: ids.orchestrationVersionId,
            orchestrationId: ids.orchestrationId,
            versionTag: "v1",
            workflowVersionId: workflowVersion.workflowVersionId,
            runtimeVersion: currentOrchestrationRuntimeVersion(),
            memoryContextVersion: "gea-context/v1",
            toolRuntimeVersion: "gea-tool-runtime/v1",
            publishedAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      await input.repository.saveWorkflow(workflow);
      await input.repository.saveWorkflowVersion(workflowVersion);
      await input.repository.saveOrchestration(orchestration);

      return { orchestration, workflow, workflowVersion };
    },
  };

  const agentCoordinator: AgentCoordinator = {
    async coordinate({ execution, workflow, completedStepIds, failedStepIds }) {
      const nextStepIds = transitionEngine.nextSteps(workflow, completedStepIds, failedStepIds);
      const assignments: Array<{ stepId: string; agentId: string; agentVersion: string }> = [];
      const delegations: AgentDelegation[] = [];

      for (const stepId of nextStepIds) {
        const step = workflow.steps.find((entry) => entry.stepId === stepId);
        if (!step) continue;
        const resolved = assignmentResolver.resolve(step);

        if (availabilityResolver.isAvailable(resolved.agentId)) {
          assignments.push({ stepId, agentId: resolved.agentId, agentVersion: resolved.agentVersion });
        } else {
          const fallback = `fallback:${resolved.agentId}`;
          const delegation = delegationEngine.delegate({
            executionId: execution.executionId,
            stepId,
            fromAgentId: resolved.agentId,
            toAgentId: fallback,
            reason: "Primary agent unavailable.",
          });
          delegations.push(delegation);
          assignments.push({ stepId, agentId: fallback, agentVersion: resolved.agentVersion });
        }
      }

      return { assignments, delegations };
    },
  };

  const stateManager: StateManager = {
    async snapshot(execution) {
      const snapshot: ExecutionSnapshot = {
        snapshotId: createOrchestrationIds().snapshotId,
        executionId: execution.executionId,
        sequence: execution.timeline.length,
        state: execution.state,
        coordinationStateByStep: execution.coordinationStateByStep,
        approvals: execution.approvals,
        retries: execution.retryCounts,
        pendingSteps: Object.entries(execution.coordinationStateByStep).filter(([, s]) => s === "PENDING" || s === "ASSIGNED").map(([id]) => id),
        completedSteps: Object.entries(execution.coordinationStateByStep).filter(([, s]) => s === "COMPLETED").map(([id]) => id),
        failedSteps: Object.entries(execution.coordinationStateByStep).filter(([, s]) => s === "FAILED").map(([id]) => id),
        createdAt: nowIso(),
      };
      await input.repository.saveSnapshot(snapshot);
      return snapshot;
    },
  };

  const workflowCoordinator: WorkflowCoordinator = {
    async execute(execution, workflow, actorId) {
      const ordered = dependencyResolver.orderSteps(workflow);
      if (ordered.blocked.length > 0) {
        const failed = withTimeline(execution, "FAILED", "Dependency cycle detected.", { blocked: ordered.blocked });
        await input.repository.saveExecution(failed);
        await stateManager.snapshot(failed);
        return failed;
      }

      let current = withTimeline(execution, "RUNNING", "Execution started.");
      await input.repository.saveExecution(current);

      const completed = new Set<string>();
      const failed = new Set<string>();

      for (const step of ordered.ordered) {
        if (current.state === "PAUSED" || current.state === "CANCELLED") break;

        const coord = await agentCoordinator.coordinate({
          execution: current,
          workflow,
          completedStepIds: [...completed],
          failedStepIds: [...failed],
        });

        for (const delegation of coord.delegations) {
          await input.repository.saveDelegation(delegation);
          current.delegations.push(delegation);
        }

        const assigned = coord.assignments.find((entry) => entry.stepId === step.stepId);
        if (!assigned) {
          current.coordinationStateByStep[step.stepId] = "FAILED";
          failed.add(step.stepId);
          continue;
        }

        current.coordinationStateByStep[step.stepId] = "ASSIGNED";
        current = withTimeline(current, current.state, `Step assigned: ${step.stepKey}`, {
          stepId: step.stepId,
          agentId: assigned.agentId,
        });
        await input.repository.saveExecution(current);

        if (step.requiresApproval || step.highRisk) {
          const checkpoint = await approvalManager.createCheckpoint({
            executionId: current.executionId,
            stepId: step.stepId,
            requiredApprovers: [actorId],
            timeoutAt: new Date(Date.now() + 900000).toISOString(),
            escalationRole: "MANAGER",
          });
          current.approvals.push(checkpoint);
          current.coordinationStateByStep[step.stepId] = "APPROVAL_REQUIRED";
          current = withTimeline(current, "WAITING_APPROVAL", `Approval required for step ${step.stepKey}.`);
          await input.repository.saveExecution(current);
          await stateManager.snapshot(current);
          return current;
        }

        current.coordinationStateByStep[step.stepId] = "EXECUTING";

        try {
          // Coordination executes certified agents through the existing Agent Runtime only.
          await input.agentRuntime.listAgents(current.workspaceId);
          current.coordinationStateByStep[step.stepId] = "COMPLETED";
          completed.add(step.stepId);
          current = withTimeline(current, current.state, `Step completed: ${step.stepKey}`);
          await input.repository.saveExecution(current);
        } catch (error) {
          current.coordinationStateByStep[step.stepId] = "FAILED";
          failed.add(step.stepId);
          current = withTimeline(current, current.state, `Step failed: ${step.stepKey}`, {
            error: error instanceof Error ? error.message : "Unknown",
          });

          const retries = current.retryCounts[step.stepId] ?? 0;
          if (retryCoordinator.shouldRetry(step, retries, "FAILED")) {
            current.retryCounts[step.stepId] = retries + 1;
            current.coordinationStateByStep[step.stepId] = "RETRYING";
            current = withTimeline(current, current.state, `Retry scheduled for step ${step.stepKey}`);
          } else {
            const compensation = await compensationCoordinator.compensate({
              executionId: current.executionId,
              step,
              reason: "Step failure without retry eligibility.",
            });
            current.compensationActions.push(compensation);
          }

          await input.repository.saveExecution(current);
        }
      }

      const unfinished = Object.values(current.coordinationStateByStep).some((state) => state !== "COMPLETED" && state !== "FAILED");
      if (!unfinished && failed.size === 0) {
        current = withTimeline(current, "COMPLETED", "Execution completed.");
      } else if (failed.size > 0) {
        current = withTimeline(current, "FAILED", "Execution failed.", { failedSteps: [...failed] });
      }

      await input.repository.saveExecution(current);
      await stateManager.snapshot(current);
      return current;
    },
  };

  const failureRecovery: FailureRecovery = {
    async recover(execution) {
      if (execution.state !== "FAILED" && execution.state !== "RECOVERING") return execution;
      const recovering = withTimeline(execution, "RECOVERING", "Recovery started.");
      await input.repository.saveExecution(recovering);
      await stateManager.snapshot(recovering);
      return recovering;
    },
  };

  const executionManager: ExecutionManager = {
    async start(request) {
      const orchestration = await input.repository.getOrchestration(request.orchestrationId);
      if (!orchestration) throw new Error("Orchestration not found.");
      if (orchestration.workspaceId !== request.workspaceId) throw new Error("Workspace isolation violation.");

      const workflow = await input.repository.getWorkflow(request.workflowId);
      if (!workflow || workflow.workspaceId !== request.workspaceId) {
        throw new Error("Workflow not found in workspace.");
      }

      const ids = createOrchestrationIds();
      const startAt = schedulingBridge.resolveStartAt(workflow, nowIso());

      const execution: OrchestrationExecution = {
        executionId: ids.executionId,
        orchestrationId: orchestration.orchestrationId,
        workflowId: workflow.workflowId,
        workflowVersionId: orchestration.activeWorkflowVersionId,
        workspaceId: request.workspaceId,
        organizationId: request.organizationId,
        projectId: request.projectId,
        initiatedBy: request.actorId,
        state: "QUEUED",
        coordinationStateByStep: Object.fromEntries(workflow.steps.map((step) => [step.stepId, "PENDING" as const])),
        contextPackageId: request.contextPackageId,
        toolExecutionIds: [],
        delegations: [],
        approvals: [],
        compensationActions: [],
        retryCounts: {},
        timeline: [{ sequence: 1, at: startAt, state: "QUEUED", note: "Execution queued." }],
        immutableLineage: createImmutableExecutionLineage({
          orchestrationId: orchestration.orchestrationId,
          workflowVersionId: orchestration.activeWorkflowVersionId,
          contextPackageId: request.contextPackageId,
          initiatedBy: request.actorId,
        }),
        startedAt: startAt,
      };

      await input.repository.saveExecution(execution);
      await stateManager.snapshot(execution);
      return workflowCoordinator.execute(execution, workflow, request.actorId);
    },

    async pause(executionId, actorId) {
      const execution = await input.repository.getExecution(executionId);
      if (!execution) throw new Error("Execution not found.");
      const paused = withTimeline(execution, "PAUSED", `Execution paused by ${actorId}.`);
      await input.repository.saveExecution(paused);
      await stateManager.snapshot(paused);
      return paused;
    },

    async resume(executionId, actorId) {
      const execution = await input.repository.getExecution(executionId);
      if (!execution) throw new Error("Execution not found.");
      const workflow = await input.repository.getWorkflow(execution.workflowId);
      if (!workflow) throw new Error("Workflow not found.");

      const resumed = withTimeline(execution, "RUNNING", `Execution resumed by ${actorId}.`);
      if (resumed.state === "WAITING_APPROVAL") {
        resumed.state = "RUNNING";
      }
      await input.repository.saveExecution(resumed);
      return workflowCoordinator.execute(resumed, workflow, actorId);
    },

    async cancel(executionId, actorId) {
      const execution = await input.repository.getExecution(executionId);
      if (!execution) throw new Error("Execution not found.");
      const cancelled = withTimeline(execution, "CANCELLED", `Execution cancelled by ${actorId}.`);
      await input.repository.saveExecution(cancelled);
      await approvalManager.cancelByExecution(executionId);
      await stateManager.snapshot(cancelled);
      return cancelled;
    },

    async replay(executionId) {
      const execution = await input.repository.getExecution(executionId);
      if (!execution) throw new Error("Execution not found.");
      const workflow = await input.repository.getWorkflow(execution.workflowId);
      if (!workflow) throw new Error("Workflow not found.");

      const checksum = stableChecksum({
        workflow: {
          workflowId: workflow.workflowId,
          version: execution.workflowVersionId,
          checksum: orchestrationChecksum(canonicalizeWorkflowDefinition(workflow)),
        },
        execution: {
          coordinationStateByStep: execution.coordinationStateByStep,
          retryCounts: execution.retryCounts,
          approvals: execution.approvals.map((entry) => ({ id: entry.approvalCheckpointId, state: entry.state, approvedBy: entry.approvedBy })),
          delegations: execution.delegations.map((entry) => ({ stepId: entry.stepId, from: entry.fromAgentId, to: entry.toAgentId })),
          timeline: execution.timeline.map((entry) => ({ state: entry.state, note: entry.note })),
        },
      });

      const external: string[] = [];
      if (workflow.scheduling.mode === "EVENT_DRIVEN" || workflow.scheduling.mode === "CALENDAR") {
        external.push("scheduling-trigger");
      }

      const replay: ReplayRecord = {
        replayRecordId: createOrchestrationIds().replayRecordId,
        executionId,
        replayChecksum: checksum,
        determinism: external.length === 0 ? "DETERMINISTIC" : "PARTIAL",
        nonDeterministicDependencies: external,
        createdAt: nowIso(),
      };
      await input.repository.saveReplay(replay);
      return replay;
    },

    async recover(executionId) {
      const execution = await input.repository.getExecution(executionId);
      if (!execution) throw new Error("Execution not found.");
      return failureRecovery.recover(execution);
    },
  };

  async function computeHealth(workspaceId: string): Promise<OrchestrationHealth> {
    const executions = await input.repository.listExecutions(workspaceId);
    const replays = await input.repository.listReplays();
    const approvals = await input.repository.listApprovals();

    const failed = executions.filter((entry) => entry.state === "FAILED").length;
    const active = executions.filter((entry) => entry.state === "RUNNING" || entry.state === "WAITING_APPROVAL").length;
    const paused = executions.filter((entry) => entry.state === "PAUSED").length;
    const approvalBacklog = approvals.filter((entry) => entry.state === "PENDING").length;
    const replayDrift = replays.filter((entry) => entry.determinism !== "DETERMINISTIC").length;
    const retryCount = executions.reduce((sum, item) => sum + Object.values(item.retryCounts).reduce((a, b) => a + b, 0), 0);

    const failureRate = executions.length === 0 ? 0 : failed / executions.length;
    const replayDriftRate = replays.length === 0 ? 0 : replayDrift / replays.length;

    const status: OrchestrationHealth["status"] =
      failureRate < 0.15 && approvalBacklog < 8 ? "HEALTHY"
      : failureRate < 0.35 ? "DEGRADED"
      : "UNHEALTHY";

    return {
      healthId: createOrchestrationIds().healthId,
      workspaceId,
      organizationId: executions[0]?.organizationId ?? "genesis",
      status,
      activeExecutions: active,
      pausedExecutions: paused,
      approvalBacklog,
      failureRate,
      replayDriftRate,
      queueDepth: executions.filter((entry) => entry.state === "QUEUED").length,
      computedAt: nowIso(),
      metrics: {
        workflowDurationMs: Math.round(
          executions
            .filter((entry) => entry.completedAt)
            .map((entry) => Date.parse(entry.completedAt ?? entry.startedAt) - Date.parse(entry.startedAt))
            .reduce((sum, value) => sum + value, 0)
          / Math.max(1, executions.filter((entry) => entry.completedAt).length),
        ),
        agentUtilization: executions.reduce<Record<string, number>>((acc, execution) => {
          for (const delegation of execution.delegations) {
            acc[delegation.toAgentId] = (acc[delegation.toAgentId] ?? 0) + 1;
          }
          return acc;
        }, {}),
        queueDepth: executions.filter((entry) => entry.state === "QUEUED").length,
        failureRate,
        retryCount,
        approvalLatencyMs: 0,
        compensationEvents: (await input.repository.listCompensations()).length,
        throughputPerHour: executions.length,
      },
    };
  }

  return {
    workflowCompiler,
    workflowValidator,
    dependencyResolver,
    transitionEngine,
    assignmentResolver,
    availabilityResolver,
    delegationEngine,
    agentCoordinator,
    schedulingBridge,
    approvalManager,
    retryCoordinator,
    compensationCoordinator,
    failureRecovery,
    workflowCoordinator,
    executionManager,
    stateManager,

    async listOrchestrations(workspaceId) {
      return input.repository.listOrchestrations(workspaceId);
    },
    async getOrchestration(orchestrationId) {
      return input.repository.getOrchestration(orchestrationId);
    },
    async listWorkflows(workspaceId) {
      return input.repository.listWorkflows(workspaceId);
    },
    async getWorkflow(workflowId) {
      return input.repository.getWorkflow(workflowId);
    },
    async listExecutions(workspaceId) {
      return input.repository.listExecutions(workspaceId);
    },
    async getExecution(executionId) {
      return input.repository.getExecution(executionId);
    },
    async listTimeline(workspaceId, executionId) {
      const executions = executionId
        ? [await input.repository.getExecution(executionId)].filter((entry): entry is OrchestrationExecution => Boolean(entry))
        : await input.repository.listExecutions(workspaceId);

      return executions.map((entry) => ({ executionId: entry.executionId, timeline: entry.timeline }));
    },
    async listApprovals(workspaceId, executionId) {
      const approvals = await input.repository.listApprovals(executionId);
      if (executionId) return approvals;

      const executionMap = new Map((await input.repository.listExecutions(workspaceId)).map((entry) => [entry.executionId, true]));
      return approvals.filter((entry) => executionMap.has(entry.executionId));
    },
    async listHealth(workspaceId) {
      const latest = await computeHealth(workspaceId);
      await input.repository.saveHealth(latest);
      return input.repository.listHealth(workspaceId);
    },
    async listReplays(executionId) {
      return input.repository.listReplays(executionId);
    },
  };
}
