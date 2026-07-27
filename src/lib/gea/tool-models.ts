import { geaId, nowIso, stableChecksum } from "./agent-models";

export type ToolLifecycleState = "REGISTERED" | "VALIDATED" | "ACTIVE" | "DEPRECATED" | "DISABLED" | "ARCHIVED";
export type ToolExecutionState = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED" | "TIMED_OUT";
export type ToolExecutionMode = "SYNCHRONOUS" | "ASYNCHRONOUS";
export type ToolHealthStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";

export type ToolCategory =
  | "BUSINESS_GENOME"
  | "MARKETING"
  | "ANALYTICS"
  | "WORKFLOW"
  | "DOCUMENTS"
  | "FILES"
  | "EMAIL"
  | "CALENDAR"
  | "STORAGE"
  | "SEARCH"
  | "COMMUNICATIONS"
  | "FINANCE"
  | "MANUFACTURING"
  | "CRM"
  | "ERP"
  | "EXTERNAL_API"
  | "UTILITY"
  | "SYSTEM";

export type ToolCapability = {
  capabilityKey: string;
  required: boolean;
};

export type ToolInputContract = {
  contractVersion: string;
  schema: Record<string, unknown>;
  validationRules: string[];
  immutableChecksum: string;
};

export type ToolOutputContract = {
  contractVersion: string;
  schema: Record<string, unknown>;
  errorTypes: string[];
  immutableChecksum: string;
};

export type ToolExecutionPolicy = {
  timeoutMs: number;
  retryLimit: number;
  replaySupported: boolean;
  deterministic: boolean;
  compatibilityPolicy: "STRICT" | "BACKWARD";
};

export type ToolManifest = {
  owner: string;
  executionMode: ToolExecutionMode;
  permissionRequirements: string[];
  capabilityRequirements: string[];
  deprecated: boolean;
};

export type ToolDefinition = {
  toolId: string;
  workspaceId: string;
  organizationId: string;
  toolKey: string;
  name: string;
  description: string;
  category: ToolCategory;
  lifecycleState: ToolLifecycleState;
  manifest: ToolManifest;
  createdAt: string;
  updatedAt: string;
};

export type ToolVersion = {
  toolVersionId: string;
  toolId: string;
  versionTag: string;
  runtimeVersion: string;
  inputContract: ToolInputContract;
  outputContract: ToolOutputContract;
  executionPolicy: ToolExecutionPolicy;
  publishedAt: string;
  publishedBy: string;
};

export type Tool = {
  definition: ToolDefinition;
  versions: ToolVersion[];
  activeVersionTag: string;
};

export type ToolAuthorization = {
  authorizationId: string;
  toolId: string;
  toolVersionId: string;
  workspaceId: string;
  projectId?: string;
  organizationId?: string;
  agentId: string;
  actorId: string;
  allowed: boolean;
  reason: string;
  permissionEvaluation: string[];
  capabilityResolution: string[];
  evaluatedAt: string;
};

export type ToolExecutionTimeline = {
  sequence: number;
  at: string;
  state: ToolExecutionState;
  note: string;
  metadata?: Record<string, unknown>;
};

export type ToolExecutionResult = {
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  output: Record<string, unknown>;
  warnings: string[];
  error?: string;
};

export type ToolExecution = {
  executionId: string;
  toolId: string;
  toolVersionId: string;
  workspaceId: string;
  projectId?: string;
  organizationId?: string;
  agentId: string;
  actorId: string;
  state: ToolExecutionState;
  mode: ToolExecutionMode;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  warnings: string[];
  error?: string;
  durationMs?: number;
  startedAt: string;
  completedAt?: string;
  authorization: ToolAuthorization;
  timeline: ToolExecutionTimeline[];
  immutableLineage: string;
};

export type ToolReplayRecord = {
  replayId: string;
  executionId: string;
  toolVersionId: string;
  inputContractVersion: string;
  agentVersion: string;
  permissionEvaluation: string[];
  runtimeVersion: string;
  deterministicSupported: boolean;
  deterministicMatch?: boolean;
  replayChecksum: string;
  createdAt: string;
};

export type ToolHealth = {
  healthId: string;
  toolId: string;
  toolVersionId?: string;
  availability: number;
  latencyMs: number;
  successRate: number;
  failureRate: number;
  version: string;
  lastSuccessfulExecution?: string;
  lastFailure?: string;
  healthStatus: ToolHealthStatus;
  computedAt: string;
};

export type ToolValidationRecord = {
  validationId: string;
  toolVersionId: string;
  validationStatus: "PASSED" | "FAILED";
  issues: string[];
  validatedBy: string;
  validatedAt: string;
};

export type ToolLifecycleEvent = {
  lifecycleEventId: string;
  toolId: string;
  previousState?: ToolLifecycleState;
  nextState: ToolLifecycleState;
  actorId: string;
  reason?: string;
  createdAt: string;
};

export type ToolPolicyHistoryRecord = {
  policyRecordId: string;
  toolVersionId: string;
  previousPolicyChecksum?: string;
  nextPolicyChecksum: string;
  changedBy: string;
  changedAt: string;
};

export type ToolCatalogEntry = {
  toolId: string;
  identifier: string;
  name: string;
  version: string;
  category: ToolCategory;
  description: string;
  owner: string;
  capabilityRequirements: string[];
  permissionRequirements: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  executionMode: ToolExecutionMode;
  healthState: ToolHealthStatus;
  replaySupport: boolean;
  deprecationStatus: boolean;
};

export type ToolRegistrationInput = {
  workspaceId: string;
  organizationId: string;
  toolKey: string;
  name: string;
  description: string;
  category: ToolCategory;
  owner: string;
  executionMode: ToolExecutionMode;
  capabilityRequirements: string[];
  permissionRequirements: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  validationRules: string[];
  errorTypes: string[];
  timeoutMs: number;
  retryLimit: number;
  replaySupported: boolean;
  deterministic: boolean;
  compatibilityPolicy: "STRICT" | "BACKWARD";
  versionTag: string;
  actorId: string;
};

export function createImmutableChecksum(value: unknown): string {
  return stableChecksum(value);
}

export function createToolLineage(value: {
  toolId: string;
  toolVersionId: string;
  workspaceId: string;
  projectId?: string;
  agentId: string;
  actorId: string;
  input: Record<string, unknown>;
}): string {
  return stableChecksum(value);
}

export function createToolExecutionTimelineInitial(state: ToolExecutionState, note: string): ToolExecutionTimeline[] {
  return [{ sequence: 1, at: nowIso(), state, note }];
}

export function createToolId(): string {
  return geaId("geatool");
}

export function createToolVersionId(): string {
  return geaId("geatoolver");
}

export function createToolExecutionId(): string {
  return geaId("geatoolexec");
}

export function createToolReplayId(): string {
  return geaId("geatoolreplay");
}

export function createToolHealthId(): string {
  return geaId("geatoolhealth");
}

export function createToolValidationId(): string {
  return geaId("geatoolval");
}

export function createToolLifecycleEventId(): string {
  return geaId("geatoollife");
}

export function createToolPolicyRecordId(): string {
  return geaId("geatoolpolicy");
}

export const BUILTIN_TOOL_CATEGORIES: ToolCategory[] = [
  "BUSINESS_GENOME",
  "MARKETING",
  "ANALYTICS",
  "WORKFLOW",
  "DOCUMENTS",
  "FILES",
  "EMAIL",
  "CALENDAR",
  "STORAGE",
  "SEARCH",
  "COMMUNICATIONS",
  "FINANCE",
  "MANUFACTURING",
  "CRM",
  "ERP",
  "EXTERNAL_API",
  "UTILITY",
  "SYSTEM",
];
