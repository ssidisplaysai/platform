import { createHash, randomUUID } from "node:crypto";

export type AgentLifecycleState = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";
export type AgentExecutionState = "QUEUED" | "RUNNING" | "PAUSED" | "CANCELLED" | "FAILED" | "COMPLETED" | "WAITING_APPROVAL";
export type AgentApprovalState = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";

export type AgentIdentity = {
  workspaceId: string;
  organizationId: string;
  actorId: string;
  role: string;
};

export type AgentContext = {
  workspaceId: string;
  projectId?: string;
  organizationId?: string;
  references: AgentMemoryReference[];
  metadata?: Record<string, unknown>;
};

export type AgentPermission = {
  permissionId: string;
  capabilityKey: string;
  toolKey?: string;
  resourceScope: "WORKSPACE" | "PROJECT" | "ORGANIZATION";
  allowed: boolean;
  reason: string;
  evaluatedAt: string;
};

export type AgentCapability = {
  capabilityId: string;
  capabilityKey: string;
  capabilityVersion: string;
  enabled: boolean;
  constraints?: Record<string, unknown>;
};

export type AgentVersion = {
  agentVersionId: string;
  agentId: string;
  versionTag: string;
  planVersion: string;
  contextVersion: string;
  toolsetVersion: string;
  createdAt: string;
};

export type Agent = {
  agentId: string;
  workspaceId: string;
  organizationId: string;
  name: string;
  description?: string;
  lifecycleState: AgentLifecycleState;
  identity: AgentIdentity;
  capabilities: AgentCapability[];
  permissions: string[];
  currentVersion: AgentVersion;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AgentTask = {
  taskId: string;
  taskKey: string;
  title: string;
  dependsOn: string[];
  requiresApproval: boolean;
  requiredCapability: string;
  toolKey?: string;
  input: Record<string, unknown>;
};

export type AgentPlan = {
  planId: string;
  agentId: string;
  planVersion: string;
  objective: string;
  createdBy: string;
  createdAt: string;
  immutableAfterStart: boolean;
  tasks: AgentTask[];
  dependencyChecksum: string;
};

export type AgentAction = {
  actionId: string;
  executionId: string;
  taskId: string;
  toolKey: string;
  toolVersion: string;
  status: "PENDING" | "RUNNING" | "FAILED" | "COMPLETED";
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

export type AgentResult = {
  resultId: string;
  executionId: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  summary: string;
  outputs: Record<string, unknown>;
  producedAt: string;
};

export type AgentAuditRecord = {
  auditRecordId: string;
  executionId: string;
  eventType: string;
  actorId: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type AgentReplay = {
  replayId: string;
  executionId: string;
  replayOfExecutionId: string;
  deterministicMatch: boolean;
  replayChecksum: string;
  createdAt: string;
};

export type AgentMemoryReference = {
  memoryReferenceId: string;
  referenceType:
    | "BUSINESS_GENOME"
    | "EVIDENCE_SNAPSHOT"
    | "DOCUMENT"
    | "PROJECT"
    | "WORKSPACE"
    | "CONVERSATION"
    | "ARTIFACT"
    | "KNOWLEDGE_NODE";
  referenceId: string;
  referenceVersion: string;
  metadata?: Record<string, unknown>;
};

export type AgentExecution = {
  executionId: string;
  agentId: string;
  workspaceId: string;
  projectId?: string;
  state: AgentExecutionState;
  objective: string;
  planId: string;
  planVersion: string;
  capabilityVersions: Record<string, string>;
  toolVersions: Record<string, string>;
  permissionEvaluations: AgentPermission[];
  timeline: Array<{ at: string; state: AgentExecutionState; note: string }>;
  retries: number;
  startedAt?: string;
  completedAt?: string;
  resultId?: string;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function geaId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function stableChecksum(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort((a, b) => a[0].localeCompare(b[0]));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }

  return JSON.stringify(value);
}
