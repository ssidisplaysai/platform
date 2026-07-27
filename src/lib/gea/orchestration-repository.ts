import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import type {
  AgentDelegation,
  ApprovalCheckpoint,
  CompensationAction,
  ExecutionSnapshot,
  Orchestration,
  OrchestrationExecution,
  OrchestrationHealth,
  ReplayRecord,
  WorkflowDefinition,
  WorkflowVersion,
} from "./orchestration-models";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type OrchestrationRepository = {
  saveOrchestration: (orchestration: Orchestration) => Promise<Orchestration>;
  getOrchestration: (orchestrationId: string) => Promise<Orchestration | null>;
  listOrchestrations: (workspaceId: string) => Promise<Orchestration[]>;

  saveWorkflow: (workflow: WorkflowDefinition) => Promise<WorkflowDefinition>;
  getWorkflow: (workflowId: string) => Promise<WorkflowDefinition | null>;
  listWorkflows: (workspaceId: string) => Promise<WorkflowDefinition[]>;

  saveWorkflowVersion: (version: WorkflowVersion) => Promise<WorkflowVersion>;
  listWorkflowVersions: (workflowId: string) => Promise<WorkflowVersion[]>;

  saveExecution: (execution: OrchestrationExecution) => Promise<OrchestrationExecution>;
  getExecution: (executionId: string) => Promise<OrchestrationExecution | null>;
  listExecutions: (workspaceId: string) => Promise<OrchestrationExecution[]>;

  saveDelegation: (delegation: AgentDelegation) => Promise<AgentDelegation>;
  listDelegations: (executionId?: string) => Promise<AgentDelegation[]>;

  saveApproval: (approval: ApprovalCheckpoint) => Promise<ApprovalCheckpoint>;
  listApprovals: (executionId?: string) => Promise<ApprovalCheckpoint[]>;

  saveCompensation: (action: CompensationAction) => Promise<CompensationAction>;
  listCompensations: (executionId?: string) => Promise<CompensationAction[]>;

  saveSnapshot: (snapshot: ExecutionSnapshot) => Promise<ExecutionSnapshot>;
  listSnapshots: (executionId: string) => Promise<ExecutionSnapshot[]>;

  saveReplay: (replay: ReplayRecord) => Promise<ReplayRecord>;
  listReplays: (executionId?: string) => Promise<ReplayRecord[]>;

  saveHealth: (health: OrchestrationHealth) => Promise<OrchestrationHealth>;
  listHealth: (workspaceId: string) => Promise<OrchestrationHealth[]>;
};

export function createInMemoryOrchestrationRepository(): OrchestrationRepository {
  const orchestrations = new Map<string, Orchestration>();
  const workflows = new Map<string, WorkflowDefinition>();
  const workflowVersions = new Map<string, WorkflowVersion>();
  const executions = new Map<string, OrchestrationExecution>();
  const delegations = new Map<string, AgentDelegation>();
  const approvals = new Map<string, ApprovalCheckpoint>();
  const compensations = new Map<string, CompensationAction>();
  const snapshots = new Map<string, ExecutionSnapshot>();
  const replays = new Map<string, ReplayRecord>();
  const health = new Map<string, OrchestrationHealth>();

  return {
    async saveOrchestration(orchestration) {
      orchestrations.set(orchestration.orchestrationId, orchestration);
      return orchestration;
    },
    async getOrchestration(orchestrationId) {
      return orchestrations.get(orchestrationId) ?? null;
    },
    async listOrchestrations(workspaceId) {
      return [...orchestrations.values()]
        .filter((entry) => entry.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async saveWorkflow(workflow) {
      workflows.set(workflow.workflowId, workflow);
      return workflow;
    },
    async getWorkflow(workflowId) {
      return workflows.get(workflowId) ?? null;
    },
    async listWorkflows(workspaceId) {
      return [...workflows.values()]
        .filter((entry) => entry.workspaceId === workspaceId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    async saveWorkflowVersion(version) {
      workflowVersions.set(version.workflowVersionId, version);
      return version;
    },
    async listWorkflowVersions(workflowId) {
      return [...workflowVersions.values()].filter((entry) => entry.workflowId === workflowId);
    },

    async saveExecution(execution) {
      executions.set(execution.executionId, execution);
      return execution;
    },
    async getExecution(executionId) {
      return executions.get(executionId) ?? null;
    },
    async listExecutions(workspaceId) {
      return [...executions.values()]
        .filter((entry) => entry.workspaceId === workspaceId)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },

    async saveDelegation(delegation) {
      delegations.set(delegation.delegationId, delegation);
      return delegation;
    },
    async listDelegations(executionId) {
      const rows = [...delegations.values()];
      return executionId ? rows.filter((entry) => entry.executionId === executionId) : rows;
    },

    async saveApproval(approval) {
      approvals.set(approval.approvalCheckpointId, approval);
      return approval;
    },
    async listApprovals(executionId) {
      const rows = [...approvals.values()];
      return executionId ? rows.filter((entry) => entry.executionId === executionId) : rows;
    },

    async saveCompensation(action) {
      compensations.set(action.compensationActionId, action);
      return action;
    },
    async listCompensations(executionId) {
      const rows = [...compensations.values()];
      return executionId ? rows.filter((entry) => entry.executionId === executionId) : rows;
    },

    async saveSnapshot(snapshot) {
      snapshots.set(snapshot.snapshotId, snapshot);
      return snapshot;
    },
    async listSnapshots(executionId) {
      return [...snapshots.values()]
        .filter((entry) => entry.executionId === executionId)
        .sort((a, b) => a.sequence - b.sequence);
    },

    async saveReplay(replay) {
      replays.set(replay.replayRecordId, replay);
      return replay;
    },
    async listReplays(executionId) {
      const rows = [...replays.values()];
      return executionId ? rows.filter((entry) => entry.executionId === executionId) : rows;
    },

    async saveHealth(entry) {
      health.set(entry.healthId, entry);
      return entry;
    },
    async listHealth(workspaceId) {
      return [...health.values()]
        .filter((entry) => entry.workspaceId === workspaceId)
        .sort((a, b) => b.computedAt.localeCompare(a.computedAt));
    },
  };
}

export function createPrismaOrchestrationRepository(prismaClient?: PrismaClient): OrchestrationRepository {
  const prisma = prismaClient ?? getPrismaClient();

  return {
    async saveOrchestration(orchestration) {
      await prisma.geaOrchestration.upsert({
        where: { orchestrationId: orchestration.orchestrationId },
        create: {
          orchestrationId: orchestration.orchestrationId,
          workspaceId: orchestration.workspaceId,
          organizationId: orchestration.organizationId,
          projectId: orchestration.projectId ?? null,
          name: orchestration.name,
          description: orchestration.description,
          lifecycleState: orchestration.lifecycleState,
          activeWorkflowId: orchestration.activeWorkflowId,
          activeWorkflowVersionId: orchestration.activeWorkflowVersionId,
          versions: toJson(orchestration.versions),
          createdAt: new Date(orchestration.createdAt),
          updatedAt: new Date(orchestration.updatedAt),
        },
        update: {
          name: orchestration.name,
          description: orchestration.description,
          lifecycleState: orchestration.lifecycleState,
          activeWorkflowId: orchestration.activeWorkflowId,
          activeWorkflowVersionId: orchestration.activeWorkflowVersionId,
          versions: toJson(orchestration.versions),
          updatedAt: new Date(orchestration.updatedAt),
        },
      });
      return orchestration;
    },
    async getOrchestration(orchestrationId) {
      const row = await prisma.geaOrchestration.findUnique({ where: { orchestrationId } });
      if (!row) return null;
      return {
        orchestrationId: row.orchestrationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        projectId: row.projectId ?? undefined,
        name: row.name,
        description: row.description,
        lifecycleState: row.lifecycleState as Orchestration["lifecycleState"],
        activeWorkflowId: row.activeWorkflowId,
        activeWorkflowVersionId: row.activeWorkflowVersionId,
        versions: row.versions as Orchestration["versions"],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },
    async listOrchestrations(workspaceId) {
      const rows = await prisma.geaOrchestration.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        orchestrationId: row.orchestrationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        projectId: row.projectId ?? undefined,
        name: row.name,
        description: row.description,
        lifecycleState: row.lifecycleState as Orchestration["lifecycleState"],
        activeWorkflowId: row.activeWorkflowId,
        activeWorkflowVersionId: row.activeWorkflowVersionId,
        versions: row.versions as Orchestration["versions"],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async saveWorkflow(workflow) {
      await prisma.geaWorkflowDefinition.upsert({
        where: { workflowId: workflow.workflowId },
        create: {
          workflowId: workflow.workflowId,
          orchestrationId: workflow.orchestrationId,
          workspaceId: workflow.workspaceId,
          organizationId: workflow.organizationId,
          projectId: workflow.projectId ?? null,
          workflowKey: workflow.workflowKey,
          name: workflow.name,
          description: workflow.description,
          lifecycleState: workflow.lifecycleState,
          steps: toJson(workflow.steps),
          transitions: toJson(workflow.transitions),
          dependencies: toJson(workflow.dependencies),
          scheduling: toJson(workflow.scheduling),
          createdAt: new Date(workflow.createdAt),
          updatedAt: new Date(workflow.updatedAt),
        },
        update: {
          name: workflow.name,
          description: workflow.description,
          lifecycleState: workflow.lifecycleState,
          steps: toJson(workflow.steps),
          transitions: toJson(workflow.transitions),
          dependencies: toJson(workflow.dependencies),
          scheduling: toJson(workflow.scheduling),
          updatedAt: new Date(workflow.updatedAt),
        },
      });
      return workflow;
    },
    async getWorkflow(workflowId) {
      const row = await prisma.geaWorkflowDefinition.findUnique({ where: { workflowId } });
      if (!row) return null;
      return {
        workflowId: row.workflowId,
        orchestrationId: row.orchestrationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        projectId: row.projectId ?? undefined,
        workflowKey: row.workflowKey,
        name: row.name,
        description: row.description,
        lifecycleState: row.lifecycleState as WorkflowDefinition["lifecycleState"],
        steps: row.steps as WorkflowDefinition["steps"],
        transitions: row.transitions as WorkflowDefinition["transitions"],
        dependencies: row.dependencies as WorkflowDefinition["dependencies"],
        scheduling: row.scheduling as WorkflowDefinition["scheduling"],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    },
    async listWorkflows(workspaceId) {
      const rows = await prisma.geaWorkflowDefinition.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        workflowId: row.workflowId,
        orchestrationId: row.orchestrationId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        projectId: row.projectId ?? undefined,
        workflowKey: row.workflowKey,
        name: row.name,
        description: row.description,
        lifecycleState: row.lifecycleState as WorkflowDefinition["lifecycleState"],
        steps: row.steps as WorkflowDefinition["steps"],
        transitions: row.transitions as WorkflowDefinition["transitions"],
        dependencies: row.dependencies as WorkflowDefinition["dependencies"],
        scheduling: row.scheduling as WorkflowDefinition["scheduling"],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async saveWorkflowVersion(version) {
      await prisma.geaWorkflowVersion.upsert({
        where: { workflowVersionId: version.workflowVersionId },
        create: {
          workflowVersionId: version.workflowVersionId,
          workflowId: version.workflowId,
          versionTag: version.versionTag,
          immutable: version.immutable,
          definitionChecksum: version.definitionChecksum,
          publishedBy: version.publishedBy,
          publishedAt: new Date(version.publishedAt),
        },
        update: {
          versionTag: version.versionTag,
          immutable: version.immutable,
          definitionChecksum: version.definitionChecksum,
          publishedBy: version.publishedBy,
          publishedAt: new Date(version.publishedAt),
        },
      });
      return version;
    },
    async listWorkflowVersions(workflowId) {
      const rows = await prisma.geaWorkflowVersion.findMany({ where: { workflowId }, orderBy: { publishedAt: "desc" } });
      return rows.map((row) => ({
        workflowVersionId: row.workflowVersionId,
        workflowId: row.workflowId,
        versionTag: row.versionTag,
        immutable: row.immutable,
        definitionChecksum: row.definitionChecksum,
        publishedBy: row.publishedBy,
        publishedAt: row.publishedAt.toISOString(),
      }));
    },

    async saveExecution(execution) {
      await prisma.geaOrchestrationExecution.upsert({
        where: { executionId: execution.executionId },
        create: {
          executionId: execution.executionId,
          orchestrationId: execution.orchestrationId,
          workflowId: execution.workflowId,
          workflowVersionId: execution.workflowVersionId,
          workspaceId: execution.workspaceId,
          organizationId: execution.organizationId,
          projectId: execution.projectId ?? null,
          initiatedBy: execution.initiatedBy,
          state: execution.state,
          coordinationStateByStep: toJson(execution.coordinationStateByStep),
          contextPackageId: execution.contextPackageId ?? null,
          toolExecutionIds: toJson(execution.toolExecutionIds),
          delegations: toJson(execution.delegations),
          approvals: toJson(execution.approvals),
          compensationActions: toJson(execution.compensationActions),
          retryCounts: toJson(execution.retryCounts),
          timeline: toJson(execution.timeline),
          immutableLineage: execution.immutableLineage,
          startedAt: new Date(execution.startedAt),
          completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
        },
        update: {
          state: execution.state,
          coordinationStateByStep: toJson(execution.coordinationStateByStep),
          contextPackageId: execution.contextPackageId ?? null,
          toolExecutionIds: toJson(execution.toolExecutionIds),
          delegations: toJson(execution.delegations),
          approvals: toJson(execution.approvals),
          compensationActions: toJson(execution.compensationActions),
          retryCounts: toJson(execution.retryCounts),
          timeline: toJson(execution.timeline),
          completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
        },
      });
      return execution;
    },
    async getExecution(executionId) {
      const row = await prisma.geaOrchestrationExecution.findUnique({ where: { executionId } });
      if (!row) return null;
      return {
        executionId: row.executionId,
        orchestrationId: row.orchestrationId,
        workflowId: row.workflowId,
        workflowVersionId: row.workflowVersionId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        projectId: row.projectId ?? undefined,
        initiatedBy: row.initiatedBy,
        state: row.state as OrchestrationExecution["state"],
        coordinationStateByStep: row.coordinationStateByStep as Record<string, OrchestrationExecution["coordinationStateByStep"][string]>,
        contextPackageId: row.contextPackageId ?? undefined,
        toolExecutionIds: row.toolExecutionIds as string[],
        delegations: row.delegations as AgentDelegation[],
        approvals: row.approvals as ApprovalCheckpoint[],
        compensationActions: row.compensationActions as CompensationAction[],
        retryCounts: row.retryCounts as Record<string, number>,
        timeline: row.timeline as OrchestrationExecution["timeline"],
        immutableLineage: row.immutableLineage,
        startedAt: row.startedAt.toISOString(),
        completedAt: row.completedAt?.toISOString(),
      };
    },
    async listExecutions(workspaceId) {
      const rows = await prisma.geaOrchestrationExecution.findMany({ where: { workspaceId }, orderBy: { startedAt: "desc" } });
      return rows.map((row) => ({
        executionId: row.executionId,
        orchestrationId: row.orchestrationId,
        workflowId: row.workflowId,
        workflowVersionId: row.workflowVersionId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        projectId: row.projectId ?? undefined,
        initiatedBy: row.initiatedBy,
        state: row.state as OrchestrationExecution["state"],
        coordinationStateByStep: row.coordinationStateByStep as Record<string, OrchestrationExecution["coordinationStateByStep"][string]>,
        contextPackageId: row.contextPackageId ?? undefined,
        toolExecutionIds: row.toolExecutionIds as string[],
        delegations: row.delegations as AgentDelegation[],
        approvals: row.approvals as ApprovalCheckpoint[],
        compensationActions: row.compensationActions as CompensationAction[],
        retryCounts: row.retryCounts as Record<string, number>,
        timeline: row.timeline as OrchestrationExecution["timeline"],
        immutableLineage: row.immutableLineage,
        startedAt: row.startedAt.toISOString(),
        completedAt: row.completedAt?.toISOString(),
      }));
    },

    async saveDelegation(delegation) {
      await prisma.geaOrchestrationDelegation.upsert({
        where: { delegationId: delegation.delegationId },
        create: {
          delegationId: delegation.delegationId,
          executionId: delegation.executionId,
          stepId: delegation.stepId,
          fromAgentId: delegation.fromAgentId,
          toAgentId: delegation.toAgentId,
          reason: delegation.reason,
          delegatedAt: new Date(delegation.delegatedAt),
        },
        update: {
          reason: delegation.reason,
          delegatedAt: new Date(delegation.delegatedAt),
        },
      });
      return delegation;
    },
    async listDelegations(executionId) {
      const rows = await prisma.geaOrchestrationDelegation.findMany({ where: executionId ? { executionId } : undefined, orderBy: { delegatedAt: "desc" } });
      return rows.map((row) => ({
        delegationId: row.delegationId,
        executionId: row.executionId,
        stepId: row.stepId,
        fromAgentId: row.fromAgentId,
        toAgentId: row.toAgentId,
        reason: row.reason,
        delegatedAt: row.delegatedAt.toISOString(),
      }));
    },

    async saveApproval(approval) {
      await prisma.geaOrchestrationApproval.upsert({
        where: { approvalCheckpointId: approval.approvalCheckpointId },
        create: {
          approvalCheckpointId: approval.approvalCheckpointId,
          executionId: approval.executionId,
          stepId: approval.stepId,
          stage: approval.stage,
          state: approval.state,
          requiredApprovers: toJson(approval.requiredApprovers),
          approvedBy: toJson(approval.approvedBy),
          timeoutAt: approval.timeoutAt ? new Date(approval.timeoutAt) : null,
          escalationPolicy: toJson(approval.escalationPolicy ?? null),
          createdAt: new Date(approval.createdAt),
          updatedAt: new Date(approval.updatedAt),
        },
        update: {
          state: approval.state,
          approvedBy: toJson(approval.approvedBy),
          timeoutAt: approval.timeoutAt ? new Date(approval.timeoutAt) : null,
          escalationPolicy: toJson(approval.escalationPolicy ?? null),
          updatedAt: new Date(approval.updatedAt),
        },
      });
      return approval;
    },
    async listApprovals(executionId) {
      const rows = await prisma.geaOrchestrationApproval.findMany({ where: executionId ? { executionId } : undefined, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        approvalCheckpointId: row.approvalCheckpointId,
        executionId: row.executionId,
        stepId: row.stepId,
        stage: row.stage,
        state: row.state as ApprovalCheckpoint["state"],
        requiredApprovers: row.requiredApprovers as string[],
        approvedBy: row.approvedBy as string[],
        timeoutAt: row.timeoutAt?.toISOString(),
        escalationPolicy: (row.escalationPolicy ?? undefined) as ApprovalCheckpoint["escalationPolicy"],
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },

    async saveCompensation(action) {
      await prisma.geaOrchestrationCompensation.upsert({
        where: { compensationActionId: action.compensationActionId },
        create: {
          compensationActionId: action.compensationActionId,
          executionId: action.executionId,
          stepId: action.stepId,
          reversible: action.reversible,
          actionType: action.actionType,
          status: action.status,
          reason: action.reason ?? null,
          createdAt: new Date(action.createdAt),
        },
        update: {
          status: action.status,
          reason: action.reason ?? null,
        },
      });
      return action;
    },
    async listCompensations(executionId) {
      const rows = await prisma.geaOrchestrationCompensation.findMany({ where: executionId ? { executionId } : undefined, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        compensationActionId: row.compensationActionId,
        executionId: row.executionId,
        stepId: row.stepId,
        reversible: row.reversible,
        actionType: row.actionType as CompensationAction["actionType"],
        status: row.status as CompensationAction["status"],
        reason: row.reason ?? undefined,
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveSnapshot(snapshot) {
      await prisma.geaOrchestrationSnapshot.upsert({
        where: { snapshotId: snapshot.snapshotId },
        create: {
          snapshotId: snapshot.snapshotId,
          executionId: snapshot.executionId,
          sequence: snapshot.sequence,
          state: snapshot.state,
          coordinationStateByStep: toJson(snapshot.coordinationStateByStep),
          approvals: toJson(snapshot.approvals),
          retries: toJson(snapshot.retries),
          pendingSteps: toJson(snapshot.pendingSteps),
          completedSteps: toJson(snapshot.completedSteps),
          failedSteps: toJson(snapshot.failedSteps),
          createdAt: new Date(snapshot.createdAt),
        },
        update: {
          state: snapshot.state,
          coordinationStateByStep: toJson(snapshot.coordinationStateByStep),
          approvals: toJson(snapshot.approvals),
          retries: toJson(snapshot.retries),
          pendingSteps: toJson(snapshot.pendingSteps),
          completedSteps: toJson(snapshot.completedSteps),
          failedSteps: toJson(snapshot.failedSteps),
        },
      });
      return snapshot;
    },
    async listSnapshots(executionId) {
      const rows = await prisma.geaOrchestrationSnapshot.findMany({ where: { executionId }, orderBy: { sequence: "asc" } });
      return rows.map((row) => ({
        snapshotId: row.snapshotId,
        executionId: row.executionId,
        sequence: row.sequence,
        state: row.state as ExecutionSnapshot["state"],
        coordinationStateByStep: row.coordinationStateByStep as Record<string, ExecutionSnapshot["coordinationStateByStep"][string]>,
        approvals: row.approvals as ApprovalCheckpoint[],
        retries: row.retries as Record<string, number>,
        pendingSteps: row.pendingSteps as string[],
        completedSteps: row.completedSteps as string[],
        failedSteps: row.failedSteps as string[],
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveReplay(replay) {
      await prisma.geaOrchestrationReplay.upsert({
        where: { replayRecordId: replay.replayRecordId },
        create: {
          replayRecordId: replay.replayRecordId,
          executionId: replay.executionId,
          replayChecksum: replay.replayChecksum,
          determinism: replay.determinism,
          nonDeterministicDependencies: toJson(replay.nonDeterministicDependencies),
          createdAt: new Date(replay.createdAt),
        },
        update: {
          replayChecksum: replay.replayChecksum,
          determinism: replay.determinism,
          nonDeterministicDependencies: toJson(replay.nonDeterministicDependencies),
        },
      });
      return replay;
    },
    async listReplays(executionId) {
      const rows = await prisma.geaOrchestrationReplay.findMany({ where: executionId ? { executionId } : undefined, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        replayRecordId: row.replayRecordId,
        executionId: row.executionId,
        replayChecksum: row.replayChecksum,
        determinism: row.determinism as ReplayRecord["determinism"],
        nonDeterministicDependencies: row.nonDeterministicDependencies as string[],
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveHealth(entry) {
      await prisma.geaOrchestrationHealth.upsert({
        where: { healthId: entry.healthId },
        create: {
          healthId: entry.healthId,
          workspaceId: entry.workspaceId,
          organizationId: entry.organizationId,
          status: entry.status,
          activeExecutions: entry.activeExecutions,
          pausedExecutions: entry.pausedExecutions,
          approvalBacklog: entry.approvalBacklog,
          failureRate: entry.failureRate,
          replayDriftRate: entry.replayDriftRate,
          queueDepth: entry.queueDepth,
          computedAt: new Date(entry.computedAt),
          metrics: toJson(entry.metrics),
        },
        update: {
          status: entry.status,
          activeExecutions: entry.activeExecutions,
          pausedExecutions: entry.pausedExecutions,
          approvalBacklog: entry.approvalBacklog,
          failureRate: entry.failureRate,
          replayDriftRate: entry.replayDriftRate,
          queueDepth: entry.queueDepth,
          computedAt: new Date(entry.computedAt),
          metrics: toJson(entry.metrics),
        },
      });
      return entry;
    },
    async listHealth(workspaceId) {
      const rows = await prisma.geaOrchestrationHealth.findMany({ where: { workspaceId }, orderBy: { computedAt: "desc" } });
      return rows.map((row) => ({
        healthId: row.healthId,
        workspaceId: row.workspaceId,
        organizationId: row.organizationId,
        status: row.status as OrchestrationHealth["status"],
        activeExecutions: row.activeExecutions,
        pausedExecutions: row.pausedExecutions,
        approvalBacklog: row.approvalBacklog,
        failureRate: row.failureRate,
        replayDriftRate: row.replayDriftRate,
        queueDepth: row.queueDepth,
        computedAt: row.computedAt.toISOString(),
        metrics: row.metrics as OrchestrationHealth["metrics"],
      }));
    },
  };
}
