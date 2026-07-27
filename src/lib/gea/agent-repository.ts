import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import {
  geaId,
  nowIso,
  type Agent,
  type AgentAction,
  type AgentApprovalState,
  type AgentAuditRecord,
  type AgentExecution,
  type AgentMemoryReference,
  type AgentPlan,
  type AgentReplay,
  type AgentResult,
  type AgentVersion,
} from "./agent-models";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

type StoredApproval = {
  approvalId: string;
  executionId: string;
  taskId: string;
  state: AgentApprovalState;
  requestedBy: string;
  decidedBy?: string;
  reason?: string;
  createdAt: string;
  decidedAt?: string;
};

export type GeaRepository = {
  listAgents: (workspaceId: string) => Promise<Agent[]>;
  getAgent: (agentId: string) => Promise<Agent | null>;
  upsertAgent: (agent: Agent) => Promise<Agent>;

  savePlan: (plan: AgentPlan) => Promise<AgentPlan>;
  getPlan: (planId: string) => Promise<AgentPlan | null>;

  saveExecution: (execution: AgentExecution) => Promise<AgentExecution>;
  getExecution: (executionId: string) => Promise<AgentExecution | null>;
  listExecutions: (workspaceId: string, agentId?: string) => Promise<AgentExecution[]>;

  saveAction: (action: AgentAction) => Promise<AgentAction>;
  listActions: (executionId: string) => Promise<AgentAction[]>;

  saveResult: (result: AgentResult) => Promise<AgentResult>;
  getResult: (resultId: string) => Promise<AgentResult | null>;

  saveAuditRecord: (record: AgentAuditRecord) => Promise<AgentAuditRecord>;
  listAuditRecords: (executionId: string) => Promise<AgentAuditRecord[]>;

  saveReplay: (replay: AgentReplay) => Promise<AgentReplay>;
  listReplays: (executionId: string) => Promise<AgentReplay[]>;

  saveMemoryReference: (reference: AgentMemoryReference) => Promise<AgentMemoryReference>;
  listMemoryReferences: (agentId: string) => Promise<AgentMemoryReference[]>;

  saveApproval: (approval: StoredApproval) => Promise<StoredApproval>;
  listApprovals: (executionId: string) => Promise<StoredApproval[]>;
};

type InMemorySeed = {
  agents?: Agent[];
};

export function createInMemoryGeaRepository(seed: InMemorySeed = {}): GeaRepository {
  const agents = new Map((seed.agents ?? []).map((agent) => [agent.agentId, agent]));
  const plans = new Map<string, AgentPlan>();
  const executions = new Map<string, AgentExecution>();
  const actions = new Map<string, AgentAction>();
  const results = new Map<string, AgentResult>();
  const auditRecords = new Map<string, AgentAuditRecord>();
  const replays = new Map<string, AgentReplay>();
  const memoryReferences = new Map<string, AgentMemoryReference>();
  const approvals = new Map<string, StoredApproval>();

  return {
    async listAgents(workspaceId) {
      return [...agents.values()].filter((entry) => entry.workspaceId === workspaceId);
    },
    async getAgent(agentId) {
      return agents.get(agentId) ?? null;
    },
    async upsertAgent(agent) {
      const next = { ...agent, updatedAt: nowIso() };
      agents.set(next.agentId, next);
      return next;
    },

    async savePlan(plan) {
      plans.set(plan.planId, plan);
      return plan;
    },
    async getPlan(planId) {
      return plans.get(planId) ?? null;
    },

    async saveExecution(execution) {
      executions.set(execution.executionId, execution);
      return execution;
    },
    async getExecution(executionId) {
      return executions.get(executionId) ?? null;
    },
    async listExecutions(workspaceId, agentId) {
      return [...executions.values()]
        .filter((entry) => entry.workspaceId === workspaceId && (!agentId || entry.agentId === agentId))
        .sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
    },

    async saveAction(action) {
      actions.set(action.actionId, action);
      return action;
    },
    async listActions(executionId) {
      return [...actions.values()].filter((entry) => entry.executionId === executionId);
    },

    async saveResult(result) {
      results.set(result.resultId, result);
      return result;
    },
    async getResult(resultId) {
      return results.get(resultId) ?? null;
    },

    async saveAuditRecord(record) {
      auditRecords.set(record.auditRecordId, record);
      return record;
    },
    async listAuditRecords(executionId) {
      return [...auditRecords.values()].filter((entry) => entry.executionId === executionId);
    },

    async saveReplay(replay) {
      replays.set(replay.replayId, replay);
      return replay;
    },
    async listReplays(executionId) {
      return [...replays.values()].filter((entry) => entry.executionId === executionId);
    },

    async saveMemoryReference(reference) {
      memoryReferences.set(reference.memoryReferenceId, reference);
      return reference;
    },
    async listMemoryReferences(agentId) {
      return [...memoryReferences.values()].filter((entry) => entry.metadata?.agentId === agentId);
    },

    async saveApproval(approval) {
      approvals.set(approval.approvalId, approval);
      return approval;
    },
    async listApprovals(executionId) {
      return [...approvals.values()].filter((entry) => entry.executionId === executionId);
    },
  };
}

function mapAgent(row: {
  agentId: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  description: string | null;
  lifecycleState: string;
  identity: unknown;
  capabilities: unknown;
  permissions: unknown;
  currentVersion: unknown;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
}): Agent {
  return {
    agentId: row.agentId,
    workspaceId: row.workspaceId,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description ?? undefined,
    lifecycleState: row.lifecycleState as Agent["lifecycleState"],
    identity: row.identity as Agent["identity"],
    capabilities: row.capabilities as Agent["capabilities"],
    permissions: row.permissions as Agent["permissions"],
    currentVersion: row.currentVersion as AgentVersion,
    metadata: (row.metadata as Record<string, unknown>) ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createPrismaGeaRepository(prismaClient?: PrismaClient): GeaRepository {
  const prisma = prismaClient ?? getPrismaClient();

  return {
    async listAgents(workspaceId) {
      const rows = await prisma.geaAgent.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map(mapAgent);
    },
    async getAgent(agentId) {
      const row = await prisma.geaAgent.findUnique({ where: { agentId } });
      return row ? mapAgent(row) : null;
    },
    async upsertAgent(agent) {
      const row = await prisma.geaAgent.upsert({
        where: { agentId: agent.agentId },
        create: {
          agentId: agent.agentId,
          workspaceId: agent.workspaceId,
          organizationId: agent.organizationId,
          name: agent.name,
          description: agent.description ?? null,
          lifecycleState: agent.lifecycleState,
          identity: toJson(agent.identity),
          capabilities: toJson(agent.capabilities),
          permissions: toJson(agent.permissions),
          currentVersion: toJson(agent.currentVersion),
          metadata: toJson(agent.metadata ?? {}),
        },
        update: {
          name: agent.name,
          description: agent.description ?? null,
          lifecycleState: agent.lifecycleState,
          identity: toJson(agent.identity),
          capabilities: toJson(agent.capabilities),
          permissions: toJson(agent.permissions),
          currentVersion: toJson(agent.currentVersion),
          metadata: toJson(agent.metadata ?? {}),
        },
      });
      return mapAgent(row);
    },

    async savePlan(plan) {
      await prisma.geaAgentPlan.upsert({
        where: { planId: plan.planId },
        create: {
          planId: plan.planId,
          agentId: plan.agentId,
          planVersion: plan.planVersion,
          objective: plan.objective,
          createdBy: plan.createdBy,
          createdAt: new Date(plan.createdAt),
          immutableAfterStart: plan.immutableAfterStart,
          tasks: toJson(plan.tasks),
          dependencyChecksum: plan.dependencyChecksum,
        },
        update: {
          tasks: toJson(plan.tasks),
          dependencyChecksum: plan.dependencyChecksum,
        },
      });
      return plan;
    },
    async getPlan(planId) {
      const row = await prisma.geaAgentPlan.findUnique({ where: { planId } });
      if (!row) return null;
      return {
        planId: row.planId,
        agentId: row.agentId,
        planVersion: row.planVersion,
        objective: row.objective,
        createdBy: row.createdBy,
        createdAt: row.createdAt.toISOString(),
        immutableAfterStart: row.immutableAfterStart,
        tasks: row.tasks as AgentPlan["tasks"],
        dependencyChecksum: row.dependencyChecksum,
      };
    },

    async saveExecution(execution) {
      await prisma.geaAgentExecution.upsert({
        where: { executionId: execution.executionId },
        create: {
          executionId: execution.executionId,
          agentId: execution.agentId,
          workspaceId: execution.workspaceId,
          projectId: execution.projectId ?? null,
          state: execution.state,
          objective: execution.objective,
          planId: execution.planId,
          planVersion: execution.planVersion,
          capabilityVersions: toJson(execution.capabilityVersions),
          toolVersions: toJson(execution.toolVersions),
          permissionEvaluations: toJson(execution.permissionEvaluations),
          timeline: toJson(execution.timeline),
          retries: execution.retries,
          startedAt: execution.startedAt ? new Date(execution.startedAt) : null,
          completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
          resultId: execution.resultId ?? null,
        },
        update: {
          state: execution.state,
          permissionEvaluations: toJson(execution.permissionEvaluations),
          timeline: toJson(execution.timeline),
          retries: execution.retries,
          completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
          resultId: execution.resultId ?? null,
        },
      });
      return execution;
    },
    async getExecution(executionId) {
      const row = await prisma.geaAgentExecution.findUnique({ where: { executionId } });
      if (!row) return null;
      return {
        executionId: row.executionId,
        agentId: row.agentId,
        workspaceId: row.workspaceId,
        projectId: row.projectId ?? undefined,
        state: row.state as AgentExecution["state"],
        objective: row.objective,
        planId: row.planId,
        planVersion: row.planVersion,
        capabilityVersions: row.capabilityVersions as Record<string, string>,
        toolVersions: row.toolVersions as Record<string, string>,
        permissionEvaluations: row.permissionEvaluations as AgentExecution["permissionEvaluations"],
        timeline: row.timeline as AgentExecution["timeline"],
        retries: row.retries,
        startedAt: row.startedAt?.toISOString(),
        completedAt: row.completedAt?.toISOString(),
        resultId: row.resultId ?? undefined,
      };
    },
    async listExecutions(workspaceId, agentId) {
      const rows = await prisma.geaAgentExecution.findMany({
        where: { workspaceId, ...(agentId ? { agentId } : {}) },
        orderBy: { createdAt: "desc" },
      });

      return rows.map((row) => ({
        executionId: row.executionId,
        agentId: row.agentId,
        workspaceId: row.workspaceId,
        projectId: row.projectId ?? undefined,
        state: row.state as AgentExecution["state"],
        objective: row.objective,
        planId: row.planId,
        planVersion: row.planVersion,
        capabilityVersions: row.capabilityVersions as Record<string, string>,
        toolVersions: row.toolVersions as Record<string, string>,
        permissionEvaluations: row.permissionEvaluations as AgentExecution["permissionEvaluations"],
        timeline: row.timeline as AgentExecution["timeline"],
        retries: row.retries,
        startedAt: row.startedAt?.toISOString(),
        completedAt: row.completedAt?.toISOString(),
        resultId: row.resultId ?? undefined,
      }));
    },

    async saveAction(action) {
      await prisma.geaAgentAction.upsert({
        where: { actionId: action.actionId },
        create: {
          actionId: action.actionId,
          executionId: action.executionId,
          taskId: action.taskId,
          toolKey: action.toolKey,
          toolVersion: action.toolVersion,
          status: action.status,
          input: toJson(action.input),
          output: toJson(action.output ?? {}),
          error: action.error ?? null,
          startedAt: action.startedAt ? new Date(action.startedAt) : null,
          completedAt: action.completedAt ? new Date(action.completedAt) : null,
        },
        update: {
          status: action.status,
          output: toJson(action.output ?? {}),
          error: action.error ?? null,
          completedAt: action.completedAt ? new Date(action.completedAt) : null,
        },
      });
      return action;
    },
    async listActions(executionId) {
      const rows = await prisma.geaAgentAction.findMany({ where: { executionId }, orderBy: { createdAt: "asc" } });
      return rows.map((row) => ({
        actionId: row.actionId,
        executionId: row.executionId,
        taskId: row.taskId,
        toolKey: row.toolKey,
        toolVersion: row.toolVersion,
        status: row.status as AgentAction["status"],
        input: row.input as Record<string, unknown>,
        output: row.output as Record<string, unknown>,
        error: row.error ?? undefined,
        startedAt: row.startedAt?.toISOString(),
        completedAt: row.completedAt?.toISOString(),
      }));
    },

    async saveResult(result) {
      await prisma.geaAgentResult.upsert({
        where: { resultId: result.resultId },
        create: {
          resultId: result.resultId,
          executionId: result.executionId,
          status: result.status,
          summary: result.summary,
          outputs: toJson(result.outputs),
          producedAt: new Date(result.producedAt),
        },
        update: {
          status: result.status,
          summary: result.summary,
          outputs: toJson(result.outputs),
        },
      });
      return result;
    },
    async getResult(resultId) {
      const row = await prisma.geaAgentResult.findUnique({ where: { resultId } });
      return row
        ? {
          resultId: row.resultId,
          executionId: row.executionId,
          status: row.status as AgentResult["status"],
          summary: row.summary,
          outputs: row.outputs as Record<string, unknown>,
          producedAt: row.producedAt.toISOString(),
        }
        : null;
    },

    async saveAuditRecord(record) {
      await prisma.geaAgentAuditRecord.create({
        data: {
          auditRecordId: record.auditRecordId,
          executionId: record.executionId,
          eventType: record.eventType,
          actorId: record.actorId,
          details: toJson(record.details),
          createdAt: new Date(record.createdAt),
        },
      });
      return record;
    },
    async listAuditRecords(executionId) {
      const rows = await prisma.geaAgentAuditRecord.findMany({ where: { executionId }, orderBy: { createdAt: "asc" } });
      return rows.map((row) => ({
        auditRecordId: row.auditRecordId,
        executionId: row.executionId,
        eventType: row.eventType,
        actorId: row.actorId,
        details: row.details as Record<string, unknown>,
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveReplay(replay) {
      await prisma.geaAgentReplay.create({
        data: {
          replayId: replay.replayId,
          executionId: replay.executionId,
          replayOfExecutionId: replay.replayOfExecutionId,
          deterministicMatch: replay.deterministicMatch,
          replayChecksum: replay.replayChecksum,
          createdAt: new Date(replay.createdAt),
        },
      });
      return replay;
    },
    async listReplays(executionId) {
      const rows = await prisma.geaAgentReplay.findMany({ where: { executionId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        replayId: row.replayId,
        executionId: row.executionId,
        replayOfExecutionId: row.replayOfExecutionId,
        deterministicMatch: row.deterministicMatch,
        replayChecksum: row.replayChecksum,
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveMemoryReference(reference) {
      await prisma.geaAgentMemoryReference.upsert({
        where: { memoryReferenceId: reference.memoryReferenceId },
        create: {
          memoryReferenceId: reference.memoryReferenceId,
          referenceType: reference.referenceType,
          referenceId: reference.referenceId,
          referenceVersion: reference.referenceVersion,
          metadata: toJson(reference.metadata ?? {}),
        },
        update: {
          metadata: toJson(reference.metadata ?? {}),
          referenceVersion: reference.referenceVersion,
        },
      });
      return reference;
    },
    async listMemoryReferences(agentId) {
      const rows = await prisma.geaAgentMemoryReference.findMany({
        where: {
          metadata: {
            path: ["agentId"],
            equals: agentId,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return rows.map((row) => ({
        memoryReferenceId: row.memoryReferenceId,
        referenceType: row.referenceType as AgentMemoryReference["referenceType"],
        referenceId: row.referenceId,
        referenceVersion: row.referenceVersion,
        metadata: row.metadata as Record<string, unknown>,
      }));
    },

    async saveApproval(approval) {
      await prisma.geaAgentApproval.upsert({
        where: { approvalId: approval.approvalId },
        create: {
          approvalId: approval.approvalId,
          executionId: approval.executionId,
          taskId: approval.taskId,
          state: approval.state,
          requestedBy: approval.requestedBy,
          decidedBy: approval.decidedBy ?? null,
          reason: approval.reason ?? null,
          createdAt: new Date(approval.createdAt),
          decidedAt: approval.decidedAt ? new Date(approval.decidedAt) : null,
        },
        update: {
          state: approval.state,
          decidedBy: approval.decidedBy ?? null,
          reason: approval.reason ?? null,
          decidedAt: approval.decidedAt ? new Date(approval.decidedAt) : null,
        },
      });
      return approval;
    },
    async listApprovals(executionId) {
      const rows = await prisma.geaAgentApproval.findMany({ where: { executionId }, orderBy: { createdAt: "desc" } });
      return rows.map((row) => ({
        approvalId: row.approvalId,
        executionId: row.executionId,
        taskId: row.taskId,
        state: row.state as AgentApprovalState,
        requestedBy: row.requestedBy,
        decidedBy: row.decidedBy ?? undefined,
        reason: row.reason ?? undefined,
        createdAt: row.createdAt.toISOString(),
        decidedAt: row.decidedAt?.toISOString(),
      }));
    },
  };
}

export type GeaApprovalRecord = StoredApproval;

export function createSeedAgent(input?: Partial<Agent>): Agent {
  const createdAt = nowIso();
  return {
    agentId: input?.agentId ?? geaId("geaagent"),
    workspaceId: input?.workspaceId ?? "glw-led-display-warehouse",
    organizationId: input?.organizationId ?? "genesis",
    name: input?.name ?? "Executive Agent",
    description: input?.description,
    lifecycleState: input?.lifecycleState ?? "ACTIVE",
    identity: input?.identity ?? {
      workspaceId: input?.workspaceId ?? "glw-led-display-warehouse",
      organizationId: input?.organizationId ?? "genesis",
      actorId: "system@genesis.local",
      role: "SYSTEM",
    },
    capabilities: input?.capabilities ?? [],
    permissions: input?.permissions ?? [],
    currentVersion: input?.currentVersion ?? {
      agentVersionId: geaId("geaver"),
      agentId: input?.agentId ?? geaId("geaagent"),
      versionTag: "v1",
      planVersion: "gea-plan/v1",
      contextVersion: "gea-context/v1",
      toolsetVersion: "gea-tool/v1",
      createdAt,
    },
    metadata: input?.metadata,
    createdAt,
    updatedAt: createdAt,
  };
}
