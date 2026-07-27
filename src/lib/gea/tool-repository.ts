import { Prisma, type PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@/lib/glw/prisma";
import {
  type Tool,
  type ToolExecution,
  type ToolHealth,
  type ToolLifecycleEvent,
  type ToolPolicyHistoryRecord,
  type ToolReplayRecord,
  type ToolValidationRecord,
} from "./tool-models";

function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export type ToolFrameworkRepository = {
  saveTool: (tool: Tool) => Promise<Tool>;
  getTool: (toolId: string) => Promise<Tool | null>;
  getToolByKey: (toolKey: string) => Promise<Tool | null>;
  listTools: (workspaceId: string) => Promise<Tool[]>;

  saveExecution: (execution: ToolExecution) => Promise<ToolExecution>;
  getExecution: (executionId: string) => Promise<ToolExecution | null>;
  listExecutions: (workspaceId: string) => Promise<ToolExecution[]>;

  saveReplayRecord: (replay: ToolReplayRecord) => Promise<ToolReplayRecord>;
  listReplayRecords: (executionId?: string) => Promise<ToolReplayRecord[]>;

  saveHealthSnapshot: (health: ToolHealth) => Promise<ToolHealth>;
  listHealthSnapshots: () => Promise<ToolHealth[]>;

  saveValidationRecord: (record: ToolValidationRecord) => Promise<ToolValidationRecord>;
  listValidationRecords: (toolVersionId?: string) => Promise<ToolValidationRecord[]>;

  saveLifecycleEvent: (event: ToolLifecycleEvent) => Promise<ToolLifecycleEvent>;
  listLifecycleEvents: (toolId?: string) => Promise<ToolLifecycleEvent[]>;

  savePolicyHistory: (record: ToolPolicyHistoryRecord) => Promise<ToolPolicyHistoryRecord>;
  listPolicyHistory: (toolVersionId?: string) => Promise<ToolPolicyHistoryRecord[]>;
};

export function createInMemoryToolFrameworkRepository(): ToolFrameworkRepository {
  const tools = new Map<string, Tool>();
  const toolByKey = new Map<string, string>();
  const executions = new Map<string, ToolExecution>();
  const replays = new Map<string, ToolReplayRecord>();
  const health = new Map<string, ToolHealth>();
  const validations = new Map<string, ToolValidationRecord>();
  const lifecycleEvents = new Map<string, ToolLifecycleEvent>();
  const policyHistory = new Map<string, ToolPolicyHistoryRecord>();

  return {
    async saveTool(tool) {
      tools.set(tool.definition.toolId, tool);
      toolByKey.set(tool.definition.toolKey, tool.definition.toolId);
      return tool;
    },
    async getTool(toolId) {
      return tools.get(toolId) ?? null;
    },
    async getToolByKey(toolKey) {
      const id = toolByKey.get(toolKey);
      return id ? tools.get(id) ?? null : null;
    },
    async listTools(workspaceId) {
      return [...tools.values()]
        .filter((entry) => entry.definition.workspaceId === workspaceId)
        .sort((a, b) => a.definition.name.localeCompare(b.definition.name));
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

    async saveReplayRecord(record) {
      replays.set(record.replayId, record);
      return record;
    },
    async listReplayRecords(executionId) {
      const entries = [...replays.values()];
      return executionId ? entries.filter((entry) => entry.executionId === executionId) : entries;
    },

    async saveHealthSnapshot(snapshot) {
      health.set(snapshot.healthId, snapshot);
      return snapshot;
    },
    async listHealthSnapshots() {
      return [...health.values()].sort((a, b) => b.computedAt.localeCompare(a.computedAt));
    },

    async saveValidationRecord(record) {
      validations.set(record.validationId, record);
      return record;
    },
    async listValidationRecords(toolVersionId) {
      const entries = [...validations.values()];
      return toolVersionId ? entries.filter((entry) => entry.toolVersionId === toolVersionId) : entries;
    },

    async saveLifecycleEvent(event) {
      lifecycleEvents.set(event.lifecycleEventId, event);
      return event;
    },
    async listLifecycleEvents(toolId) {
      const entries = [...lifecycleEvents.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return toolId ? entries.filter((entry) => entry.toolId === toolId) : entries;
    },

    async savePolicyHistory(record) {
      policyHistory.set(record.policyRecordId, record);
      return record;
    },
    async listPolicyHistory(toolVersionId) {
      const entries = [...policyHistory.values()].sort((a, b) => b.changedAt.localeCompare(a.changedAt));
      return toolVersionId ? entries.filter((entry) => entry.toolVersionId === toolVersionId) : entries;
    },
  };
}

function parseTool(row: {
  toolId: string;
  workspaceId: string;
  organizationId: string;
  toolKey: string;
  definition: unknown;
  activeVersionTag: string;
  versions: unknown;
}): Tool {
  const definition = row.definition as Tool["definition"];
  const versions = row.versions as Tool["versions"];
  return {
    definition: {
      ...definition,
      toolId: row.toolId,
      workspaceId: row.workspaceId,
      organizationId: row.organizationId,
      toolKey: row.toolKey,
    },
    versions,
    activeVersionTag: row.activeVersionTag,
  };
}

function parseExecution(row: {
  executionId: string;
  workspaceId: string;
  toolId: string;
  toolVersionId: string;
  agentId: string;
  actorId: string;
  state: string;
  mode: string;
  input: unknown;
  output: unknown;
  warnings: unknown;
  error: string | null;
  durationMs: number | null;
  startedAt: Date;
  completedAt: Date | null;
  authorization: unknown;
  timeline: unknown;
  immutableLineage: string;
  projectId: string | null;
  organizationId: string | null;
}): ToolExecution {
  return {
    executionId: row.executionId,
    workspaceId: row.workspaceId,
    toolId: row.toolId,
    toolVersionId: row.toolVersionId,
    agentId: row.agentId,
    actorId: row.actorId,
    state: row.state as ToolExecution["state"],
    mode: row.mode as ToolExecution["mode"],
    input: row.input as Record<string, unknown>,
    output: row.output as Record<string, unknown> | undefined,
    warnings: (row.warnings as string[]) ?? [],
    error: row.error ?? undefined,
    durationMs: row.durationMs ?? undefined,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    authorization: row.authorization as ToolExecution["authorization"],
    timeline: row.timeline as ToolExecution["timeline"],
    immutableLineage: row.immutableLineage,
    projectId: row.projectId ?? undefined,
    organizationId: row.organizationId ?? undefined,
  };
}

export function createPrismaToolFrameworkRepository(prismaClient?: PrismaClient): ToolFrameworkRepository {
  const prisma = prismaClient ?? getPrismaClient();

  return {
    async saveTool(tool) {
      await prisma.geaToolDefinition.upsert({
        where: { toolId: tool.definition.toolId },
        create: {
          toolId: tool.definition.toolId,
          workspaceId: tool.definition.workspaceId,
          organizationId: tool.definition.organizationId,
          toolKey: tool.definition.toolKey,
          category: tool.definition.category,
          lifecycleState: tool.definition.lifecycleState,
          definition: toJson(tool.definition),
          activeVersionTag: tool.activeVersionTag,
          versions: toJson(tool.versions),
        },
        update: {
          workspaceId: tool.definition.workspaceId,
          organizationId: tool.definition.organizationId,
          toolKey: tool.definition.toolKey,
          category: tool.definition.category,
          lifecycleState: tool.definition.lifecycleState,
          definition: toJson(tool.definition),
          activeVersionTag: tool.activeVersionTag,
          versions: toJson(tool.versions),
        },
      });
      return tool;
    },

    async getTool(toolId) {
      const row = await prisma.geaToolDefinition.findUnique({ where: { toolId } });
      return row ? parseTool(row) : null;
    },

    async getToolByKey(toolKey) {
      const row = await prisma.geaToolDefinition.findFirst({ where: { toolKey } });
      return row ? parseTool(row) : null;
    },

    async listTools(workspaceId) {
      const rows = await prisma.geaToolDefinition.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
      return rows.map(parseTool);
    },

    async saveExecution(execution) {
      await prisma.geaToolExecution.upsert({
        where: { executionId: execution.executionId },
        create: {
          executionId: execution.executionId,
          workspaceId: execution.workspaceId,
          toolId: execution.toolId,
          toolVersionId: execution.toolVersionId,
          agentId: execution.agentId,
          actorId: execution.actorId,
          state: execution.state,
          mode: execution.mode,
          input: toJson(execution.input),
          output: toJson(execution.output ?? {}),
          warnings: toJson(execution.warnings),
          error: execution.error ?? null,
          durationMs: execution.durationMs ?? null,
          startedAt: new Date(execution.startedAt),
          completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
          authorization: toJson(execution.authorization),
          timeline: toJson(execution.timeline),
          immutableLineage: execution.immutableLineage,
          projectId: execution.projectId ?? null,
          organizationId: execution.organizationId ?? null,
        },
        update: {
          state: execution.state,
          output: toJson(execution.output ?? {}),
          warnings: toJson(execution.warnings),
          error: execution.error ?? null,
          durationMs: execution.durationMs ?? null,
          completedAt: execution.completedAt ? new Date(execution.completedAt) : null,
          timeline: toJson(execution.timeline),
        },
      });
      return execution;
    },

    async getExecution(executionId) {
      const row = await prisma.geaToolExecution.findUnique({ where: { executionId } });
      return row ? parseExecution(row) : null;
    },

    async listExecutions(workspaceId) {
      const rows = await prisma.geaToolExecution.findMany({ where: { workspaceId }, orderBy: { startedAt: "desc" } });
      return rows.map(parseExecution);
    },

    async saveReplayRecord(replay) {
      await prisma.geaToolReplay.upsert({
        where: { replayId: replay.replayId },
        create: {
          replayId: replay.replayId,
          executionId: replay.executionId,
          toolVersionId: replay.toolVersionId,
          inputContractVersion: replay.inputContractVersion,
          agentVersion: replay.agentVersion,
          permissionEvaluation: toJson(replay.permissionEvaluation),
          runtimeVersion: replay.runtimeVersion,
          deterministicSupported: replay.deterministicSupported,
          deterministicMatch: replay.deterministicMatch ?? null,
          replayChecksum: replay.replayChecksum,
          createdAt: new Date(replay.createdAt),
        },
        update: {
          deterministicMatch: replay.deterministicMatch ?? null,
          replayChecksum: replay.replayChecksum,
        },
      });
      return replay;
    },

    async listReplayRecords(executionId) {
      const rows = await prisma.geaToolReplay.findMany({
        where: executionId ? { executionId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map((row) => ({
        replayId: row.replayId,
        executionId: row.executionId,
        toolVersionId: row.toolVersionId,
        inputContractVersion: row.inputContractVersion,
        agentVersion: row.agentVersion,
        permissionEvaluation: row.permissionEvaluation as string[],
        runtimeVersion: row.runtimeVersion,
        deterministicSupported: row.deterministicSupported,
        deterministicMatch: row.deterministicMatch ?? undefined,
        replayChecksum: row.replayChecksum,
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async saveHealthSnapshot(snapshot) {
      await prisma.geaToolHealth.upsert({
        where: { healthId: snapshot.healthId },
        create: {
          healthId: snapshot.healthId,
          toolId: snapshot.toolId,
          toolVersionId: snapshot.toolVersionId ?? null,
          availability: snapshot.availability,
          latencyMs: snapshot.latencyMs,
          successRate: snapshot.successRate,
          failureRate: snapshot.failureRate,
          version: snapshot.version,
          lastSuccessfulExecution: snapshot.lastSuccessfulExecution ?? null,
          lastFailure: snapshot.lastFailure ?? null,
          healthStatus: snapshot.healthStatus,
          computedAt: new Date(snapshot.computedAt),
        },
        update: {
          availability: snapshot.availability,
          latencyMs: snapshot.latencyMs,
          successRate: snapshot.successRate,
          failureRate: snapshot.failureRate,
          version: snapshot.version,
          lastSuccessfulExecution: snapshot.lastSuccessfulExecution ?? null,
          lastFailure: snapshot.lastFailure ?? null,
          healthStatus: snapshot.healthStatus,
          computedAt: new Date(snapshot.computedAt),
        },
      });
      return snapshot;
    },

    async listHealthSnapshots() {
      const rows = await prisma.geaToolHealth.findMany({ orderBy: { computedAt: "desc" } });
      return rows.map((row) => ({
        healthId: row.healthId,
        toolId: row.toolId,
        toolVersionId: row.toolVersionId ?? undefined,
        availability: row.availability,
        latencyMs: row.latencyMs,
        successRate: row.successRate,
        failureRate: row.failureRate,
        version: row.version,
        lastSuccessfulExecution: row.lastSuccessfulExecution ?? undefined,
        lastFailure: row.lastFailure ?? undefined,
        healthStatus: row.healthStatus as ToolHealth["healthStatus"],
        computedAt: row.computedAt.toISOString(),
      }));
    },

    async saveValidationRecord(record) {
      await prisma.geaToolValidation.upsert({
        where: { validationId: record.validationId },
        create: {
          validationId: record.validationId,
          toolVersionId: record.toolVersionId,
          validationStatus: record.validationStatus,
          issues: toJson(record.issues),
          validatedBy: record.validatedBy,
          validatedAt: new Date(record.validatedAt),
        },
        update: {
          validationStatus: record.validationStatus,
          issues: toJson(record.issues),
          validatedBy: record.validatedBy,
          validatedAt: new Date(record.validatedAt),
        },
      });
      return record;
    },

    async listValidationRecords(toolVersionId) {
      const rows = await prisma.geaToolValidation.findMany({
        where: toolVersionId ? { toolVersionId } : undefined,
        orderBy: { validatedAt: "desc" },
      });
      return rows.map((row) => ({
        validationId: row.validationId,
        toolVersionId: row.toolVersionId,
        validationStatus: row.validationStatus as ToolValidationRecord["validationStatus"],
        issues: row.issues as string[],
        validatedBy: row.validatedBy,
        validatedAt: row.validatedAt.toISOString(),
      }));
    },

    async saveLifecycleEvent(event) {
      await prisma.geaToolLifecycleEvent.create({
        data: {
          lifecycleEventId: event.lifecycleEventId,
          toolId: event.toolId,
          previousState: event.previousState ?? null,
          nextState: event.nextState,
          actorId: event.actorId,
          reason: event.reason ?? null,
          createdAt: new Date(event.createdAt),
        },
      });
      return event;
    },

    async listLifecycleEvents(toolId) {
      const rows = await prisma.geaToolLifecycleEvent.findMany({
        where: toolId ? { toolId } : undefined,
        orderBy: { createdAt: "desc" },
      });
      return rows.map((row) => ({
        lifecycleEventId: row.lifecycleEventId,
        toolId: row.toolId,
        previousState: (row.previousState ?? undefined) as ToolLifecycleEvent["previousState"],
        nextState: row.nextState as ToolLifecycleEvent["nextState"],
        actorId: row.actorId,
        reason: row.reason ?? undefined,
        createdAt: row.createdAt.toISOString(),
      }));
    },

    async savePolicyHistory(record) {
      await prisma.geaToolPolicyHistory.upsert({
        where: { policyRecordId: record.policyRecordId },
        create: {
          policyRecordId: record.policyRecordId,
          toolVersionId: record.toolVersionId,
          previousPolicyChecksum: record.previousPolicyChecksum ?? null,
          nextPolicyChecksum: record.nextPolicyChecksum,
          changedBy: record.changedBy,
          changedAt: new Date(record.changedAt),
        },
        update: {
          previousPolicyChecksum: record.previousPolicyChecksum ?? null,
          nextPolicyChecksum: record.nextPolicyChecksum,
          changedBy: record.changedBy,
          changedAt: new Date(record.changedAt),
        },
      });
      return record;
    },

    async listPolicyHistory(toolVersionId) {
      const rows = await prisma.geaToolPolicyHistory.findMany({
        where: toolVersionId ? { toolVersionId } : undefined,
        orderBy: { changedAt: "desc" },
      });
      return rows.map((row) => ({
        policyRecordId: row.policyRecordId,
        toolVersionId: row.toolVersionId,
        previousPolicyChecksum: row.previousPolicyChecksum ?? undefined,
        nextPolicyChecksum: row.nextPolicyChecksum,
        changedBy: row.changedBy,
        changedAt: row.changedAt.toISOString(),
      }));
    },
  };
}
