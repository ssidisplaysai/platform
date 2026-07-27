import { createHash, randomUUID } from "node:crypto";

export const gmpPublishingDestinationTypes = [
  "WORDPRESS",
  "SHOPIFY",
  "HEADLESS_CMS",
  "STATIC_EXPORT",
  "GENERIC_JSON_API",
  "GENESIS_NATIVE",
  "CUSTOM_ADAPTER",
] as const;

export const gmpPublishingPackageStatuses = [
  "DRAFT",
  "BUILDING",
  "BUILT",
  "VALIDATION_FAILED",
  "READY_FOR_REVIEW",
  "IN_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
  "QUEUED",
  "PUBLISHING",
  "PUBLISHED",
  "PARTIALLY_PUBLISHED",
  "FAILED",
  "SUPERSEDED",
  "ROLLED_BACK",
  "ARCHIVED",
] as const;

export const gmpReleaseStatuses = [
  "DRAFT",
  "VALIDATING",
  "READY_FOR_REVIEW",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "SCHEDULED",
  "QUEUED",
  "RUNNING",
  "PARTIALLY_COMPLETED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "ROLLING_BACK",
  "ROLLED_BACK",
] as const;

export const gmpReleaseTypes = [
  "SINGLE_PACKAGE",
  "BATCH",
  "SCHEDULED",
  "UPDATE",
  "REPUBLISH",
  "ROLLBACK",
  "EMERGENCY_CORRECTION",
] as const;

export const gmpPublicationAttemptStatuses = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED", "SKIPPED"] as const;
export const gmpPublicationOperationTypes = ["CREATE", "UPDATE", "SCHEDULE", "PUBLISH", "ARCHIVE", "DELETE", "VERIFY", "ROLLBACK", "RECONCILE"] as const;
export const gmpVerificationStatuses = ["PENDING", "VERIFIED", "VERIFIED_WITH_WARNINGS", "MISMATCH", "UNAVAILABLE", "FAILED"] as const;

export const GMP_PUBLISHING_ELIGIBILITY_MODEL_VERSION = "gmp-publishing-eligibility/v1";
export const GMP_PUBLISHING_POLICY_VERSION = "gmp-publishing-policy/v1";
export const GMP_PUBLISHING_PACKAGE_SCHEMA_VERSION = "gmp-publishing-package/v1";
export const GMP_PUBLISHING_MANIFEST_SCHEMA_VERSION = "gmp-publishing-manifest/v1";
export const GMP_PUBLISHING_VALIDATION_MODEL_VERSION = "gmp-publishing-validation/v1";
export const GMP_PUBLISHING_RENDERER_VERSION = "gmp-publishing-renderer/v1";

export type GmpPublishingDestinationType = (typeof gmpPublishingDestinationTypes)[number];
export type GmpPublishingPackageStatus = (typeof gmpPublishingPackageStatuses)[number];
export type GmpReleaseStatus = (typeof gmpReleaseStatuses)[number];
export type GmpReleaseType = (typeof gmpReleaseTypes)[number];
export type GmpPublicationAttemptStatus = (typeof gmpPublicationAttemptStatuses)[number];
export type GmpPublicationOperationType = (typeof gmpPublicationOperationTypes)[number];
export type GmpVerificationStatus = (typeof gmpVerificationStatuses)[number];

export type GmpPublishingEligibilityReport = {
  eligible: boolean;
  blockingIssues: string[];
  warnings: string[];
  requiredInputs: string[];
  missingInputs: string[];
  draftVersion: number;
  approvedRevisionSetId?: string;
  destinationId?: string;
  destinationType?: GmpPublishingDestinationType;
  publishingPolicyVersion: string;
  eligibilityModelVersion: string;
};

export type GmpPublishingDestinationCapability = {
  capabilityId: string;
  destinationId: string;
  key: string;
  supported: boolean;
  metadata?: Record<string, unknown>;
};

export type GmpPublishingDestination = {
  destinationId: string;
  projectId: string;
  siteId: string;
  destinationType: GmpPublishingDestinationType;
  name: string;
  baseUrl: string;
  environment: string;
  connectionStatus: string;
  credentialReference?: string;
  capabilityProfile: Record<string, boolean>;
  configuration?: Record<string, unknown>;
  defaultAuthor?: string;
  defaultStatus?: string;
  defaultTaxonomyMapping?: Record<string, unknown>;
  defaultMediaPolicy?: Record<string, unknown>;
  defaultSeoPolicy?: Record<string, unknown>;
  webhookConfiguration?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  lastValidatedAt?: string | null;
  lastSuccessfulPublishAt?: string | null;
  lastFailureAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GmpApprovedRevisionSet = {
  approvedRevisionSetId: string;
  projectId: string;
  siteId: string;
  pageId: string;
  contentDraftId: string;
  contentDraftVersion: number;
  sourceFingerprint: string;
  sections: Array<{
    sectionContentId: string;
    sectionContentVersion: number;
    pageSectionId: string;
    pageSectionStableKey: string;
    position: number;
    heading?: string;
    bodyContent?: string;
    ctaContent?: Record<string, unknown>;
    internalLinkSelections: Array<Record<string, unknown>>;
    mediaGuidance?: Record<string, unknown>;
    evidenceReferences: string[];
    metadata?: Record<string, unknown>;
  }>;
  seoMetadata: Record<string, unknown>;
  structuredDataInputs: Record<string, unknown>;
  approvalRecords: Array<Record<string, unknown>>;
  validationRecords: Array<Record<string, unknown>>;
  createdAt: string;
};

export type GmpPublishingManifest = {
  packageId: string;
  packageVersion: number;
  projectIdentity: Record<string, unknown>;
  siteIdentity: Record<string, unknown>;
  pageIdentity: Record<string, unknown>;
  sourceDraftIdentity: Record<string, unknown>;
  approvedRevisionReferences: Array<Record<string, unknown>>;
  destinationIdentity: Record<string, unknown>;
  destinationType: GmpPublishingDestinationType;
  contentPayloadReference: Record<string, unknown>;
  seoPayload: Record<string, unknown>;
  metadataPayload: Record<string, unknown>;
  structuredDataPayload: Record<string, unknown>;
  mediaManifest: Record<string, unknown>;
  internalLinkManifest: Record<string, unknown>;
  externalLinkManifest: Record<string, unknown>;
  redirectInstructions: Array<Record<string, unknown>>;
  canonicalInstructions: Record<string, unknown>;
  openGraphData: Record<string, unknown>;
  socialMetadata: Record<string, unknown>;
  publicationMode: string;
  schedule?: Record<string, unknown>;
  validationSummary: Record<string, unknown>;
  lineageSummary: Record<string, unknown>;
  packageFingerprint: string;
  createdAt: string;
  manifestSchemaVersion: string;
};

export type GmpPublishingPackage = {
  publishingPackageId: string;
  projectId: string;
  siteId: string;
  pageId: string;
  contentDraftId: string;
  contentDraftVersion: number;
  approvedRevisionSetId?: string;
  destinationId: string;
  destinationType: GmpPublishingDestinationType;
  packageStatus: GmpPublishingPackageStatus;
  releaseStatus: GmpReleaseStatus;
  packageVersion: number;
  packageSchemaVersion: string;
  publishingPolicyVersion: string;
  sourceFingerprint: string;
  packageFingerprint: string;
  canonicalUrl: string;
  targetSlug: string;
  language: string;
  locale: string;
  createdBy: string;
  validatedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  supersededAt?: string | null;
  archivedAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpPublishingPackageValidation = {
  packageValidationId: string;
  publishingPackageId: string;
  valid: boolean;
  blockingIssues: string[];
  warnings: string[];
  recommendations: string[];
  capabilityGaps: string[];
  validationModelVersion: string;
  validatedAt: string;
  metadata?: Record<string, unknown>;
};

export type GmpRelease = {
  releaseId: string;
  projectId: string;
  siteId: string;
  releaseName: string;
  releaseType: GmpReleaseType;
  releaseStatus: GmpReleaseStatus;
  requestedBy: string;
  approvedBy?: string;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  cancelledAt?: string | null;
  rollbackReleaseId?: string;
  gopExecutionId?: string;
  policyVersion: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type GmpReleaseItem = {
  releaseItemId: string;
  releaseId: string;
  publishingPackageId: string;
  destinationId: string;
  sequence: number;
  dependencyReferences: string[];
  status: GmpReleaseStatus;
  publicationAttemptCount: number;
  currentPublicationRecordId?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type GmpPublicationAttempt = {
  publicationAttemptId: string;
  releaseId: string;
  releaseItemId: string;
  publishingPackageId: string;
  destinationId: string;
  operationType: GmpPublicationOperationType;
  attemptNumber: number;
  status: GmpPublicationAttemptStatus;
  gopExecutionId?: string;
  requestFingerprint: string;
  startedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
  failureCategory?: string;
  failureCode?: string;
  failureMessage?: string;
  retryable: boolean;
  remoteResponseReference?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type GmpPublicationRecord = {
  publicationRecordId: string;
  projectId: string;
  siteId: string;
  pageId: string;
  publishingPackageId: string;
  releaseId: string;
  destinationId: string;
  externalObjectType: string;
  externalObjectId: string;
  externalRevisionId?: string;
  externalUrl: string;
  publishedStatus: string;
  publishedAt?: string | null;
  updatedAt: string;
  verifiedAt?: string | null;
  remoteContentFingerprint?: string;
  expectedContentFingerprint: string;
  verificationStatus: GmpVerificationStatus;
  supersedesPublicationRecordId?: string;
  rolledBackFromRecordId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};

export type GmpPublicationVerification = {
  publicationVerificationId: string;
  publicationRecordId: string;
  verificationStatus: GmpVerificationStatus;
  expectedState: Record<string, unknown>;
  remoteState: Record<string, unknown>;
  differences: Array<Record<string, unknown>>;
  blockingDifferences: Array<Record<string, unknown>>;
  warnings: string[];
  verificationModelVersion: string;
  verifiedAt: string;
  metadata?: Record<string, unknown>;
};

export type GmpPublicationReconciliation = {
  publicationReconciliationId: string;
  publicationRecordId: string;
  reconciliationStatus: string;
  driftDetected: boolean;
  driftReasons: string[];
  expectedState: Record<string, unknown>;
  remoteState: Record<string, unknown>;
  detectedAt: string;
  metadata?: Record<string, unknown>;
};

export type GmpPublishingIdempotencyRecord = {
  publishingIdempotencyRecordId: string;
  destinationId: string;
  publishingPackageId: string;
  packageVersion: number;
  operationType: GmpPublicationOperationType;
  releaseItemId: string;
  requestFingerprint: string;
  resultFingerprint: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export function stablePublishingFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createPublishingPackage(input: Omit<GmpPublishingPackage, "publishingPackageId" | "createdAt" | "updatedAt">): GmpPublishingPackage {
  const createdAt = nowIso();
  return {
    publishingPackageId: `gmppkg_${randomUUID()}`,
    createdAt,
    updatedAt: createdAt,
    ...input,
  };
}
