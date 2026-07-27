import { createHash, randomUUID } from "node:crypto";

export const gmpContentDraftStatuses = [
  "PENDING",
  "GENERATING",
  "GENERATED",
  "PARTIALLY_GENERATED",
  "GENERATION_FAILED",
  "EDITING",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "SUPERSEDED",
  "ARCHIVED",
] as const;

export const gmpContentGenerationModes = [
  "FULL_PAGE",
  "SELECTED_SECTIONS",
  "MISSING_SECTIONS",
  "REGENERATE_SECTION",
  "REVISE_SECTION",
  "REPAIR_FAILED_SECTIONS",
] as const;

export const gmpEditorialStatuses = [
  "DRAFT",
  "READY_FOR_REVIEW",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "SUPERSEDED",
] as const;

export const gmpApprovalStatuses = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUPERSEDED",
] as const;

export const gmpGenerationRequestStatuses = [
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

export const gmpGenerationOperationTypes = [
  "FULL_PAGE_GENERATION",
  "SECTION_GENERATION",
  "SECTION_REGENERATION",
  "SECTION_REVISION",
  "FAILED_SECTION_REPAIR",
  "OUTPUT_VALIDATION",
  "DRAFT_ASSEMBLY",
  "EDITORIAL_PREPARATION",
] as const;

export const gmpRevisionTypes = [
  "MANUAL_EDIT",
  "AI_ASSISTED_REVISION",
  "REGENERATE_SECTION",
  "SHORTEN",
  "EXPAND",
  "CHANGE_TONE",
  "IMPROVE_CLARITY",
  "IMPROVE_SEO_ALIGNMENT",
  "REPAIR_UNSUPPORTED_CLAIM",
  "APPLY_REVIEWER_REQUEST",
] as const;

export const gmpClaimValidationClassifications = [
  "SUPPORTED_CLAIM",
  "UNSUPPORTED_CLAIM",
  "UNVERIFIED_CLAIM",
  "RESTRICTED_CLAIM",
  "PROHIBITED_CLAIM",
  "GENERAL_MARKETING_STATEMENT",
] as const;

export const GMP_CONTENT_ELIGIBILITY_MODEL_VERSION = "gmp-content-eligibility/v1";
export const GMP_GENERATION_INPUT_SCHEMA_VERSION = "gmp-generation-input/v1";
export const GMP_PROMPT_ADAPTER_VERSION = "gmp-prompt-adapter/v1";
export const GMP_SECTION_OUTPUT_SCHEMA_VERSION = "gmp-section-output/v1";
export const GMP_EDITORIAL_VALIDATION_MODEL_VERSION = "gmp-editorial-validation/v1";
export const GMP_GENERATION_POLICY_VERSION = "gmp-generation-policy/v1";
export const GMP_GENERATION_PROVIDER_ID = "deterministic-openai-compatible/v1";

export type GmpContentDraftStatus = (typeof gmpContentDraftStatuses)[number];
export type GmpContentGenerationMode = (typeof gmpContentGenerationModes)[number];
export type GmpEditorialStatus = (typeof gmpEditorialStatuses)[number];
export type GmpApprovalStatus = (typeof gmpApprovalStatuses)[number];
export type GmpGenerationRequestStatus = (typeof gmpGenerationRequestStatuses)[number];
export type GmpGenerationOperationType = (typeof gmpGenerationOperationTypes)[number];
export type GmpRevisionType = (typeof gmpRevisionTypes)[number];
export type GmpClaimValidationClassification = (typeof gmpClaimValidationClassifications)[number];

export type GmpGenerationEligibilityReport = {
  eligible: boolean;
  blockingIssues: string[];
  warnings: string[];
  requiredInputs: string[];
  missingInputs: string[];
  pageVersion: number;
  briefVersion?: number;
  planVersion?: number;
  knowledgeWorkspaceVersion?: number;
  eligibilityModelVersion: string;
};

export type GmpContentDraft = {
  contentDraftId: string;
  projectId: string;
  siteId: string;
  pageId: string;
  pageVersion: number;
  pageBriefId: string;
  pageBriefVersion: number;
  contentPlanId: string;
  contentPlanVersion: number;
  knowledgeWorkspaceId: string;
  knowledgeWorkspaceVersion: number;
  brandProfileVersion: number;
  generationRequestId?: string;
  generationStatus: GmpContentDraftStatus;
  editorialStatus: GmpEditorialStatus;
  approvalStatus: GmpApprovalStatus;
  language: string;
  locale: string;
  provider: string;
  modelIdentifier: string;
  generationPolicyVersion: string;
  promptAdapterVersion: string;
  createdBy: string;
  submittedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  supersededAt?: string | null;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type GmpSectionContent = {
  sectionContentId: string;
  contentDraftId: string;
  pageSectionId: string;
  pageSectionStableKey: string;
  sectionType: string;
  position: number;
  heading?: string;
  bodyContent?: string;
  structuredContent: Record<string, unknown>;
  ctaContent: Record<string, unknown>;
  mediaGuidance: Record<string, unknown>;
  internalLinkSuggestions: Array<Record<string, unknown>>;
  externalEvidenceReferences: string[];
  knowledgeRecordReferences: Array<{ knowledgeRecordId: string; version: number }>;
  claimReferences: string[];
  sourceReferences: string[];
  restrictionEvaluation: Record<string, unknown>;
  generationStatus: GmpContentDraftStatus;
  editorialStatus: GmpEditorialStatus;
  approvalStatus: GmpApprovalStatus;
  wordCount: number;
  readingLevel?: string;
  metadata?: Record<string, unknown>;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type GmpGenerationRequest = {
  generationRequestId: string;
  projectId: string;
  pageId: string;
  contentDraftId: string;
  operationType: GmpGenerationOperationType;
  requestedSections: string[];
  generationMode: GmpContentGenerationMode;
  providerPreference?: string;
  modelPreference?: string;
  temperature?: number;
  maximumOutputPolicy?: number;
  requestedBy: string;
  requestedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  retryCount: number;
  gopExecutionId?: string | null;
  contextPackageReference?: string | null;
  inputFingerprint: string;
  status: GmpGenerationRequestStatus;
  metadata?: Record<string, unknown>;
};

export type GmpSectionContentRevision = {
  sectionContentRevisionId: string;
  sectionContentId: string;
  contentDraftId: string;
  revisionType: GmpRevisionType;
  instruction?: string;
  reason?: string;
  previousContent: Record<string, unknown>;
  newContent: Record<string, unknown>;
  changedBy: string;
  changedAt: string;
  provider?: string;
  modelIdentifier?: string;
  inputFingerprint?: string;
  knowledgeImpact: Record<string, unknown>;
  evidenceImpact: Record<string, unknown>;
  validationResult: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type GmpContentReview = {
  contentReviewId: string;
  projectId: string;
  pageId: string;
  contentDraftId: string;
  sectionContentId?: string;
  assignedTo?: string;
  reviewState: GmpEditorialStatus;
  requestedBy?: string;
  requestedAt?: string | null;
  completedBy?: string;
  completedAt?: string | null;
  reviewNotes?: string;
  sectionNotes?: string;
  approvalNotes?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpContentApproval = {
  contentApprovalId: string;
  projectId: string;
  pageId: string;
  contentDraftId: string;
  sectionContentId?: string;
  decision: GmpApprovalStatus;
  decidedBy: string;
  decidedAt: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpContentValidation = {
  contentValidationId: string;
  projectId: string;
  pageId: string;
  contentDraftId: string;
  validationModelVersion: string;
  overallScore: number;
  blockingIssues: string[];
  warnings: string[];
  recommendations: string[];
  sectionScores: Array<{ sectionContentId: string; score: number }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpSectionValidation = {
  sectionValidationId: string;
  projectId: string;
  pageId: string;
  contentDraftId: string;
  sectionContentId: string;
  validationModelVersion: string;
  editorialScore: number;
  blockingIssues: string[];
  warnings: string[];
  recommendations: string[];
  claimClassifications: Array<{ statement: string; classification: GmpClaimValidationClassification; reason: string }>;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpGenerationLineage = {
  generationLineageId: string;
  projectId: string;
  pageId: string;
  contentDraftId: string;
  sectionContentId?: string;
  pageVersion: number;
  pageBriefId: string;
  pageBriefVersion: number;
  contentPlanId: string;
  contentPlanVersion: number;
  pageSectionId?: string;
  pageSectionStableKey?: string;
  knowledgeWorkspaceId: string;
  knowledgeWorkspaceVersion: number;
  knowledgeRecordVersions: Array<{ knowledgeRecordId: string; version: number }>;
  evidenceReferences: string[];
  claims: string[];
  restrictions: string[];
  provider: string;
  modelIdentifier: string;
  promptAdapterVersion: string;
  inputFingerprint: string;
  generationRequestId: string;
  gopExecutionId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpContentAssembly = {
  contentAssemblyId: string;
  projectId: string;
  pageId: string;
  contentDraftId: string;
  assemblyType: string;
  assembledDocument: Record<string, unknown>;
  validationSummary: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpCanonicalGenerationInput = {
  schemaVersion: string;
  generationPolicyVersion: string;
  project: Record<string, unknown>;
  site: Record<string, unknown>;
  page: Record<string, unknown>;
  brief: Record<string, unknown>;
  contentPlan: Record<string, unknown>;
  section: Record<string, unknown>;
  approvedKnowledge: Array<Record<string, unknown>>;
  evidenceReferences: string[];
  claims: string[];
  proofPoints: string[];
  restrictions: string[];
  brand: Record<string, unknown>;
  seoRequirements: string[];
  internalLinkRequirements: Array<Record<string, unknown>>;
  ctaRequirements: string[];
  accessibilityRequirements: string[];
  locale: string;
  language: string;
};

export type GmpStructuredSectionOutput = {
  sectionKey: string;
  heading: string;
  body: string;
  cta: Record<string, unknown>;
  claimsUsed: string[];
  knowledgeRecordsUsed: Array<{ knowledgeRecordId: string; version: number }>;
  evidenceReferencesUsed: string[];
  internalLinksSuggested: Array<Record<string, unknown>>;
  mediaGuidance: Record<string, unknown>;
  warnings: string[];
  unresolvedRequirements: string[];
  generationNotes: string[];
  outputSchemaVersion: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function stableInputFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function createContentDraft(input: Omit<GmpContentDraft, "contentDraftId" | "createdAt" | "updatedAt" | "version">): GmpContentDraft {
  const createdAt = nowIso();
  return {
    contentDraftId: `gmpdr_${randomUUID()}`,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    ...input,
  };
}

export function createGenerationRequest(input: Omit<GmpGenerationRequest, "generationRequestId" | "requestedAt">): GmpGenerationRequest {
  return {
    generationRequestId: `gmpgr_${randomUUID()}`,
    requestedAt: nowIso(),
    ...input,
  };
}

export function createSectionContent(input: Omit<GmpSectionContent, "sectionContentId" | "createdAt" | "updatedAt" | "version">): GmpSectionContent {
  const createdAt = nowIso();
  return {
    sectionContentId: `gmpsc_${randomUUID()}`,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    ...input,
  };
}
