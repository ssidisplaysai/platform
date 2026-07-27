import { randomUUID } from "node:crypto";

export const gmpKnowledgeWorkspaceLifecycleStates = ["DRAFT", "IN_REVIEW", "APPROVED", "SUPERSEDED", "ARCHIVED"] as const;
export const gmpKnowledgeWorkspaceStatuses = ["ACTIVE", "PAUSED", "ARCHIVED"] as const;

export const gmpKnowledgeRecordStatuses = ["DRAFT", "ACTIVE", "APPROVED", "REJECTED", "SUPERSEDED", "ARCHIVED", "EXPIRED"] as const;
export const gmpKnowledgeReviewStates = ["DRAFT", "REQUIRES_REVIEW", "UNDER_REVIEW", "APPROVED", "REJECTED", "CONFLICTED", "EXPIRED"] as const;
export const gmpConflictStates = ["NONE", "CONFLICTED", "RESOLVED"] as const;

export const gmpKnowledgeSourceTypes = [
  "MANUAL_ENTRY",
  "WEBSITE",
  "DOCUMENT",
  "SPREADSHEET",
  "PRESENTATION",
  "IMAGE",
  "EMAIL",
  "TRANSCRIPT",
  "EXTERNAL_URL",
  "API",
  "LEGACY_SYSTEM",
  "FUTURE_GBG_OBJECT",
] as const;

export const gmpKnowledgeDomains = [
  "company_identity",
  "brand",
  "products",
  "services",
  "product_categories",
  "applications",
  "industries",
  "audiences",
  "buyer_personas",
  "problems_solved",
  "value_propositions",
  "differentiators",
  "features",
  "benefits",
  "use_cases",
  "technical_specifications",
  "pricing_context",
  "geographic_markets",
  "competitors",
  "claims",
  "frequently_asked_questions",
  "objections",
  "proof_points",
  "certifications",
  "warranties",
  "policies",
  "contact_conversion",
  "marketing_goals",
  "seo_topics",
  "restricted_messaging",
] as const;

export type GmpKnowledgeDomain = (typeof gmpKnowledgeDomains)[number];
export type GmpKnowledgeWorkspaceLifecycleState = (typeof gmpKnowledgeWorkspaceLifecycleStates)[number];
export type GmpKnowledgeWorkspaceStatus = (typeof gmpKnowledgeWorkspaceStatuses)[number];
export type GmpKnowledgeRecordStatus = (typeof gmpKnowledgeRecordStatuses)[number];
export type GmpKnowledgeReviewState = (typeof gmpKnowledgeReviewStates)[number];
export type GmpConflictState = (typeof gmpConflictStates)[number];
export type GmpKnowledgeSourceType = (typeof gmpKnowledgeSourceTypes)[number];

export type GmpBusinessKnowledgeWorkspace = {
  knowledgeWorkspaceId: string;
  projectId: string;
  workspaceVersion: number;
  status: GmpKnowledgeWorkspaceStatus;
  lifecycleState: GmpKnowledgeWorkspaceLifecycleState;
  completenessScore: number;
  confidenceScore: number;
  lastReviewedAt?: string | null;
  lastApprovedAt?: string | null;
  approvedBy?: string | null;
  version: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpKnowledgeRecord = {
  knowledgeRecordId: string;
  projectId: string;
  knowledgeWorkspaceId: string;
  domain: GmpKnowledgeDomain;
  recordType: string;
  canonicalKey: string;
  title: string;
  summary?: string;
  structuredValue: Record<string, unknown>;
  normalizedValue?: Record<string, unknown>;
  status: GmpKnowledgeRecordStatus;
  confidence: number;
  priority: number;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  sourceCount: number;
  conflictState: GmpConflictState;
  reviewState: GmpKnowledgeReviewState;
  parentRecordId?: string | null;
  supersededByRecordId?: string | null;
  version: number;
  archivedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpKnowledgeRecordVersion = {
  knowledgeRecordVersionId: string;
  knowledgeRecordId: string;
  projectId: string;
  knowledgeWorkspaceId: string;
  versionNumber: number;
  previousValue?: Record<string, unknown>;
  newValue: Record<string, unknown>;
  changeReason?: string;
  changedBy: string;
  changedAt: string;
  sourceImpact?: Record<string, unknown>;
  approvalImpact?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpKnowledgeSource = {
  sourceId: string;
  projectId: string;
  sourceType: GmpKnowledgeSourceType;
  displayName: string;
  locationReference?: string;
  externalIdentifier?: string;
  checksum?: string;
  sourceVersion?: string;
  capturedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpKnowledgeEvidenceLink = {
  knowledgeEvidenceLinkId: string;
  projectId: string;
  knowledgeRecordId: string;
  sourceId: string;
  evidenceLocation?: string;
  evidenceSummary?: string;
  extractionMethod?: string;
  confidence: number;
  verifiedBy?: string;
  verifiedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpKnowledgeReview = {
  knowledgeReviewId: string;
  projectId: string;
  knowledgeWorkspaceId: string;
  knowledgeRecordId: string;
  assignedTo?: string;
  reviewState: GmpKnowledgeReviewState;
  operatorNotes?: string;
  reviewNotes?: string;
  requestedBy?: string;
  requestedAt?: string | null;
  completedBy?: string;
  completedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpKnowledgeApproval = {
  knowledgeApprovalId: string;
  projectId: string;
  knowledgeWorkspaceId: string;
  knowledgeRecordId: string;
  decision: "APPROVED" | "REJECTED";
  approvalNotes?: string;
  decidedBy: string;
  decidedAt: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpKnowledgeConflict = {
  knowledgeConflictId: string;
  projectId: string;
  knowledgeWorkspaceId: string;
  conflictGroup: string;
  conflictReason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  resolutionStatus: "OPEN" | "RESOLVED";
  selectedRecordId?: string | null;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpKnowledgeConflictMember = {
  knowledgeConflictMemberId: string;
  projectId: string;
  knowledgeConflictId: string;
  knowledgeRecordId: string;
  role?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpKnowledgeCompletenessAssessment = {
  knowledgeCompletenessAssessmentId: string;
  projectId: string;
  knowledgeWorkspaceId: string;
  scoringModelVersion: string;
  overallScore: number;
  domainScores: Record<string, number>;
  missingCriticalFields: string[];
  missingRecommendedFields: string[];
  conflictedFields: string[];
  unapprovedFields: string[];
  expiredFields: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpContextAssemblyRecord = {
  contextAssemblyRecordId: string;
  projectId: string;
  knowledgeWorkspaceId: string;
  siteId?: string;
  operationType: string;
  previewMode: boolean;
  inputMetadata?: Record<string, unknown>;
  assembledContext: Record<string, unknown>;
  schemaVersion: string;
  knowledgeWorkspaceVersion: number;
  recordVersions: Record<string, number>;
  gopExecutionId?: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export const GMP_KNOWLEDGE_CONTEXT_SCHEMA_VERSION = "gmp-context/v1";
export const GMP_KNOWLEDGE_COMPLETENESS_MODEL_VERSION = "gmp-completeness/v1";

function nowIso(): string {
  return new Date().toISOString();
}

export function asCanonicalKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export function parseKnowledgeDomain(value: unknown): GmpKnowledgeDomain | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase() as GmpKnowledgeDomain;
  return gmpKnowledgeDomains.includes(normalized) ? normalized : null;
}

export function parseKnowledgeSourceType(value: unknown): GmpKnowledgeSourceType | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase() as GmpKnowledgeSourceType;
  return gmpKnowledgeSourceTypes.includes(normalized) ? normalized : null;
}

export function buildKnowledgeWorkspace(projectId: string): GmpBusinessKnowledgeWorkspace {
  const createdAt = nowIso();
  return {
    knowledgeWorkspaceId: `gmpknow_${randomUUID()}`,
    projectId,
    workspaceVersion: 1,
    status: "ACTIVE",
    lifecycleState: "DRAFT",
    completenessScore: 0,
    confidenceScore: 0,
    lastReviewedAt: null,
    lastApprovedAt: null,
    approvedBy: null,
    version: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

export function validateKnowledgeRecordInput(input: Record<string, unknown> | null): { ok: true; value: { domain: GmpKnowledgeDomain; recordType: string; canonicalKey: string; title: string; summary?: string; structuredValue: Record<string, unknown>; normalizedValue?: Record<string, unknown>; confidence?: number; priority?: number; parentRecordId?: string } } | { ok: false; error: string } {
  if (!input) {
    return { ok: false, error: "Request body must be valid JSON." };
  }

  const domain = parseKnowledgeDomain(input.domain);
  if (!domain) {
    return { ok: false, error: "A valid knowledge domain is required." };
  }

  if (typeof input.recordType !== "string" || input.recordType.trim().length < 2) {
    return { ok: false, error: "recordType is required." };
  }

  if (typeof input.title !== "string" || input.title.trim().length < 2) {
    return { ok: false, error: "title is required." };
  }

  if (typeof input.structuredValue !== "object" || input.structuredValue === null || Array.isArray(input.structuredValue)) {
    return { ok: false, error: "structuredValue must be an object." };
  }

  const canonicalKey = typeof input.canonicalKey === "string"
    ? asCanonicalKey(input.canonicalKey)
    : asCanonicalKey(`${domain}_${input.title}`);

  if (!canonicalKey) {
    return { ok: false, error: "canonicalKey cannot be empty." };
  }

  return {
    ok: true,
    value: {
      domain,
      recordType: input.recordType,
      canonicalKey,
      title: input.title,
      summary: typeof input.summary === "string" ? input.summary : undefined,
      structuredValue: input.structuredValue as Record<string, unknown>,
      normalizedValue: typeof input.normalizedValue === "object" && input.normalizedValue !== null
        ? input.normalizedValue as Record<string, unknown>
        : undefined,
      confidence: typeof input.confidence === "number" ? input.confidence : undefined,
      priority: typeof input.priority === "number" ? input.priority : undefined,
      parentRecordId: typeof input.parentRecordId === "string" ? input.parentRecordId : undefined,
    },
  };
}
