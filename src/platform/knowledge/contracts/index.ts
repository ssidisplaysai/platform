export type KnowledgeId = string;
export type TenantId = string;

export type KnowledgeLifecycleStatus = "DRAFT" | "ACTIVE" | "ARCHIVED" | "RETIRED";
export type KnowledgeGovernanceState = "REGISTERED" | "VERIFIED" | "ATTESTED";

export type KnowledgeActorContext = {
  actorId: string;
  occurredAt: string;
  source?: string;
  correlationId?: string;
  causationId?: string;
};

export type KnowledgeMetadataValue = string | number | boolean | null;
export type KnowledgeMetadata = Record<string, KnowledgeMetadataValue>;

export type KnowledgeRecord = {
  knowledgeId: KnowledgeId;
  tenantId: TenantId;
  identityKey: string;
  displayName: string;
  classification: "POLICY" | "REFERENCE" | "CONTROL" | "EVIDENCE" | "OTHER";
  metadata: KnowledgeMetadata;
  lifecycle: {
    status: KnowledgeLifecycleStatus;
    transitionedAt: string;
    transitionedBy: string;
    reason?: string;
  };
  governance: {
    state: KnowledgeGovernanceState;
    attestedAt?: string;
    attestedBy?: string;
  };
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
};

export type KnowledgeAuditRecord = {
  auditId: string;
  eventType: string;
  tenantId: TenantId;
  knowledgeId?: KnowledgeId;
  actor: KnowledgeActorContext;
  message: string;
  details?: Record<string, unknown>;
  recordedAt: string;
};

export type KnowledgeMetrics = {
  knowledgeTotal: number;
  draftKnowledge: number;
  activeKnowledge: number;
  archivedKnowledge: number;
  retiredKnowledge: number;
  registeredKnowledge: number;
  verifiedKnowledge: number;
  attestedKnowledge: number;
  auditEvents: number;
  recoveryCount: number;
  corruptStateCount: number;
};

export type KnowledgeHealth = {
  status: "HEALTHY" | "DEGRADED";
  generatedAt: string;
  checks: Array<{
    name: "persistence" | "registry" | "lifecycle" | "governance" | "audit";
    status: "PASS" | "WARN" | "FAIL";
    detail: string;
  }>;
};

export type KnowledgePersistedState = {
  schemaVersion: "1.0.0";
  knowledge: KnowledgeRecord[];
  audits: KnowledgeAuditRecord[];
  metrics: KnowledgeMetrics;
};

export function createDefaultKnowledgeMetrics(): KnowledgeMetrics {
  return {
    knowledgeTotal: 0,
    draftKnowledge: 0,
    activeKnowledge: 0,
    archivedKnowledge: 0,
    retiredKnowledge: 0,
    registeredKnowledge: 0,
    verifiedKnowledge: 0,
    attestedKnowledge: 0,
    auditEvents: 0,
    recoveryCount: 0,
    corruptStateCount: 0,
  };
}

export function createDefaultKnowledgePersistedState(): KnowledgePersistedState {
  return {
    schemaVersion: "1.0.0",
    knowledge: [],
    audits: [],
    metrics: createDefaultKnowledgeMetrics(),
  };
}

export type KnowledgeErrorCode =
  | "KNOWLEDGE_INVALID"
  | "KNOWLEDGE_DUPLICATE"
  | "KNOWLEDGE_NOT_FOUND"
  | "TENANT_MISMATCH"
  | "LIFECYCLE_TRANSITION_INVALID"
  | "STATE_CORRUPT"
  | "PERSISTENCE_FAILURE"
  | "RECOVERY_FAILURE";

export type KnowledgeErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export class KnowledgeError extends Error {
  constructor(
    public readonly code: KnowledgeErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly auditRequired: boolean,
    public readonly severity: KnowledgeErrorSeverity,
  ) {
    super(message);
    this.name = "KnowledgeError";
  }
}
