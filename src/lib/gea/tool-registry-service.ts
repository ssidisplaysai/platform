import { nowIso, stableChecksum } from "./agent-models";
import {
  createImmutableChecksum,
  createToolId,
  createToolLifecycleEventId,
  createToolPolicyRecordId,
  createToolValidationId,
  createToolVersionId,
  type Tool,
  type ToolCatalogEntry,
  type ToolCategory,
  type ToolDefinition,
  type ToolLifecycleState,
  type ToolPolicyHistoryRecord,
  type ToolRegistrationInput,
  type ToolValidationRecord,
  BUILTIN_TOOL_CATEGORIES,
} from "./tool-models";
import type { ToolFrameworkRepository } from "./tool-repository";

export type ToolRegistryService = {
  registerTool: (input: ToolRegistrationInput) => Promise<Tool>;
  getTool: (toolId: string) => Promise<Tool | null>;
  resolveToolByIdentifier: (identifier: string) => Promise<Tool | null>;
  listTools: (workspaceId: string) => Promise<Tool[]>;
  discoverTools: (workspaceId: string, query?: string, category?: ToolCategory) => Promise<ToolCatalogEntry[]>;
  setToolLifecycle: (toolId: string, state: ToolLifecycleState, actorId: string, reason?: string) => Promise<Tool>;
  publishVersion: (toolId: string, input: ToolRegistrationInput) => Promise<Tool>;
  listCategories: () => ToolCategory[];
};

function toCatalogEntry(tool: Tool, healthState: ToolCatalogEntry["healthState"]): ToolCatalogEntry {
  const activeVersion = tool.versions.find((entry) => entry.versionTag === tool.activeVersionTag) ?? tool.versions[0];
  return {
    toolId: tool.definition.toolId,
    identifier: tool.definition.toolKey,
    name: tool.definition.name,
    version: activeVersion?.versionTag ?? "unknown",
    category: tool.definition.category,
    description: tool.definition.description,
    owner: tool.definition.manifest.owner,
    capabilityRequirements: tool.definition.manifest.capabilityRequirements,
    permissionRequirements: tool.definition.manifest.permissionRequirements,
    inputSchema: activeVersion?.inputContract.schema ?? {},
    outputSchema: activeVersion?.outputContract.schema ?? {},
    executionMode: tool.definition.manifest.executionMode,
    healthState,
    replaySupport: activeVersion?.executionPolicy.replaySupported ?? false,
    deprecationStatus: tool.definition.manifest.deprecated,
  };
}

export function createToolRegistryService(repository: ToolFrameworkRepository): ToolRegistryService {
  return {
    async registerTool(input) {
      const now = nowIso();
      const existing = await repository.getToolByKey(input.toolKey);
      if (existing) {
        throw new Error("Tool identifier already exists.");
      }

      const toolId = createToolId();
      const definition: ToolDefinition = {
        toolId,
        workspaceId: input.workspaceId,
        organizationId: input.organizationId,
        toolKey: input.toolKey,
        name: input.name,
        description: input.description,
        category: input.category,
        lifecycleState: "ACTIVE",
        manifest: {
          owner: input.owner,
          executionMode: input.executionMode,
          permissionRequirements: [...input.permissionRequirements].sort(),
          capabilityRequirements: [...input.capabilityRequirements].sort(),
          deprecated: false,
        },
        createdAt: now,
        updatedAt: now,
      };

      const inputContract = {
        contractVersion: `${input.versionTag}.input`,
        schema: input.inputSchema,
        validationRules: [...input.validationRules],
        immutableChecksum: createImmutableChecksum({ schema: input.inputSchema, rules: input.validationRules }),
      };

      const outputContract = {
        contractVersion: `${input.versionTag}.output`,
        schema: input.outputSchema,
        errorTypes: [...input.errorTypes],
        immutableChecksum: createImmutableChecksum({ schema: input.outputSchema, errorTypes: input.errorTypes }),
      };

      const executionPolicy = {
        timeoutMs: input.timeoutMs,
        retryLimit: input.retryLimit,
        replaySupported: input.replaySupported,
        deterministic: input.deterministic,
        compatibilityPolicy: input.compatibilityPolicy,
      };

      const version = {
        toolVersionId: createToolVersionId(),
        toolId,
        versionTag: input.versionTag,
        runtimeVersion: "gea-tool-runtime/v1",
        inputContract,
        outputContract,
        executionPolicy,
        publishedAt: now,
        publishedBy: input.actorId,
      };

      const validation: ToolValidationRecord = {
        validationId: createToolValidationId(),
        toolVersionId: version.toolVersionId,
        validationStatus: "PASSED",
        issues: [],
        validatedBy: input.actorId,
        validatedAt: now,
      };

      const policyHistory: ToolPolicyHistoryRecord = {
        policyRecordId: createToolPolicyRecordId(),
        toolVersionId: version.toolVersionId,
        nextPolicyChecksum: stableChecksum(executionPolicy),
        changedBy: input.actorId,
        changedAt: now,
      };

      await repository.saveTool({
        definition,
        versions: [version],
        activeVersionTag: version.versionTag,
      });
      await repository.saveValidationRecord(validation);
      await repository.savePolicyHistory(policyHistory);
      await repository.saveLifecycleEvent({
        lifecycleEventId: createToolLifecycleEventId(),
        toolId,
        nextState: "ACTIVE",
        actorId: input.actorId,
        reason: "Initial registration and activation",
        createdAt: now,
      });

      const tool = await repository.getTool(toolId);
      if (!tool) {
        throw new Error("Tool registration failed.");
      }
      return tool;
    },

    async getTool(toolId) {
      return repository.getTool(toolId);
    },

    async resolveToolByIdentifier(identifier) {
      return repository.getToolByKey(identifier);
    },

    async listTools(workspaceId) {
      return repository.listTools(workspaceId);
    },

    async discoverTools(workspaceId, query, category) {
      const tools = await repository.listTools(workspaceId);
      const lower = query?.trim().toLowerCase();
      const filtered = tools.filter((tool) => {
        if (category && tool.definition.category !== category) return false;
        if (!lower) return true;
        return tool.definition.name.toLowerCase().includes(lower)
          || tool.definition.description.toLowerCase().includes(lower)
          || tool.definition.toolKey.toLowerCase().includes(lower);
      });

      const health = await repository.listHealthSnapshots();
      const healthByTool = new Map(health.map((entry) => [entry.toolId, entry.healthStatus]));

      return filtered.map((tool) => toCatalogEntry(tool, healthByTool.get(tool.definition.toolId) ?? "UNKNOWN"));
    },

    async setToolLifecycle(toolId, state, actorId, reason) {
      const tool = await repository.getTool(toolId);
      if (!tool) {
        throw new Error("Tool not found.");
      }

      const next: Tool = {
        ...tool,
        definition: {
          ...tool.definition,
          lifecycleState: state,
          manifest: {
            ...tool.definition.manifest,
            deprecated: state === "DEPRECATED" || state === "ARCHIVED",
          },
          updatedAt: nowIso(),
        },
      };

      await repository.saveTool(next);
      await repository.saveLifecycleEvent({
        lifecycleEventId: createToolLifecycleEventId(),
        toolId,
        previousState: tool.definition.lifecycleState,
        nextState: state,
        actorId,
        reason,
        createdAt: nowIso(),
      });

      return next;
    },

    async publishVersion(toolId, input) {
      const tool = await repository.getTool(toolId);
      if (!tool) {
        throw new Error("Tool not found.");
      }

      const currentVersion = tool.versions.find((entry) => entry.versionTag === tool.activeVersionTag);
      if (!currentVersion) {
        throw new Error("Active tool version not found.");
      }

      const candidateInputChecksum = createImmutableChecksum({ schema: input.inputSchema, rules: input.validationRules });
      const candidateOutputChecksum = createImmutableChecksum({ schema: input.outputSchema, errorTypes: input.errorTypes });

      if (input.compatibilityPolicy === "STRICT") {
        if (candidateInputChecksum !== currentVersion.inputContract.immutableChecksum) {
          throw new Error("Strict compatibility prevents input contract mutation.");
        }
        if (candidateOutputChecksum !== currentVersion.outputContract.immutableChecksum) {
          throw new Error("Strict compatibility prevents output contract mutation.");
        }
      }

      const nextVersion = {
        toolVersionId: createToolVersionId(),
        toolId,
        versionTag: input.versionTag,
        runtimeVersion: "gea-tool-runtime/v1",
        inputContract: {
          contractVersion: `${input.versionTag}.input`,
          schema: input.inputSchema,
          validationRules: [...input.validationRules],
          immutableChecksum: candidateInputChecksum,
        },
        outputContract: {
          contractVersion: `${input.versionTag}.output`,
          schema: input.outputSchema,
          errorTypes: [...input.errorTypes],
          immutableChecksum: candidateOutputChecksum,
        },
        executionPolicy: {
          timeoutMs: input.timeoutMs,
          retryLimit: input.retryLimit,
          replaySupported: input.replaySupported,
          deterministic: input.deterministic,
          compatibilityPolicy: input.compatibilityPolicy,
        },
        publishedAt: nowIso(),
        publishedBy: input.actorId,
      };

      const next: Tool = {
        ...tool,
        definition: {
          ...tool.definition,
          updatedAt: nowIso(),
        },
        versions: [...tool.versions, nextVersion],
        activeVersionTag: nextVersion.versionTag,
      };

      await repository.saveTool(next);
      await repository.saveValidationRecord({
        validationId: createToolValidationId(),
        toolVersionId: nextVersion.toolVersionId,
        validationStatus: "PASSED",
        issues: [],
        validatedBy: input.actorId,
        validatedAt: nowIso(),
      });
      await repository.savePolicyHistory({
        policyRecordId: createToolPolicyRecordId(),
        toolVersionId: nextVersion.toolVersionId,
        previousPolicyChecksum: stableChecksum(currentVersion.executionPolicy),
        nextPolicyChecksum: stableChecksum(nextVersion.executionPolicy),
        changedBy: input.actorId,
        changedAt: nowIso(),
      });

      return next;
    },

    listCategories() {
      return [...BUILTIN_TOOL_CATEGORIES];
    },
  };
}
