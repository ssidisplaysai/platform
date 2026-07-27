-- CreateTable
CREATE TABLE "GmpPublishingDestination" (
    "destinationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL,
    "credentialReference" TEXT,
    "capabilityProfile" JSONB NOT NULL,
    "configuration" JSONB,
    "defaultAuthor" TEXT,
    "defaultStatus" TEXT,
    "defaultTaxonomyMapping" JSONB,
    "defaultMediaPolicy" JSONB,
    "defaultSeoPolicy" JSONB,
    "webhookConfiguration" JSONB,
    "metadata" JSONB,
    "lastValidatedAt" TIMESTAMP(3),
    "lastSuccessfulPublishAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpPublishingDestination_pkey" PRIMARY KEY ("destinationId")
);

-- CreateTable
CREATE TABLE "GmpDestinationCapability" (
    "destinationCapabilityId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "supported" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpDestinationCapability_pkey" PRIMARY KEY ("destinationCapabilityId")
);

-- CreateTable
CREATE TABLE "GmpApprovedRevisionSet" (
    "approvedRevisionSetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "contentDraftVersion" INTEGER NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "seoMetadata" JSONB NOT NULL,
    "structuredDataInputs" JSONB NOT NULL,
    "approvalRecords" JSONB NOT NULL,
    "validationRecords" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpApprovedRevisionSet_pkey" PRIMARY KEY ("approvedRevisionSetId")
);

-- CreateTable
CREATE TABLE "GmpPublishingPackage" (
    "publishingPackageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "contentDraftVersion" INTEGER NOT NULL,
    "approvedRevisionSetId" TEXT,
    "destinationId" TEXT NOT NULL,
    "destinationType" TEXT NOT NULL,
    "packageStatus" TEXT NOT NULL,
    "releaseStatus" TEXT NOT NULL,
    "packageVersion" INTEGER NOT NULL,
    "packageSchemaVersion" TEXT NOT NULL,
    "publishingPolicyVersion" TEXT NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "packageFingerprint" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "targetSlug" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "supersededAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpPublishingPackage_pkey" PRIMARY KEY ("publishingPackageId")
);

-- CreateTable
CREATE TABLE "GmpPublishingManifest" (
    "publishingManifestId" TEXT NOT NULL,
    "publishingPackageId" TEXT NOT NULL,
    "packageVersion" INTEGER NOT NULL,
    "projectIdentity" JSONB NOT NULL,
    "siteIdentity" JSONB NOT NULL,
    "pageIdentity" JSONB NOT NULL,
    "sourceDraftIdentity" JSONB NOT NULL,
    "approvedRevisionReferences" JSONB NOT NULL,
    "destinationIdentity" JSONB NOT NULL,
    "destinationType" TEXT NOT NULL,
    "contentPayloadReference" JSONB NOT NULL,
    "seoPayload" JSONB NOT NULL,
    "metadataPayload" JSONB NOT NULL,
    "structuredDataPayload" JSONB NOT NULL,
    "mediaManifest" JSONB NOT NULL,
    "internalLinkManifest" JSONB NOT NULL,
    "externalLinkManifest" JSONB NOT NULL,
    "redirectInstructions" JSONB NOT NULL,
    "canonicalInstructions" JSONB NOT NULL,
    "openGraphData" JSONB NOT NULL,
    "socialMetadata" JSONB NOT NULL,
    "publicationMode" TEXT NOT NULL,
    "schedule" JSONB,
    "validationSummary" JSONB NOT NULL,
    "lineageSummary" JSONB NOT NULL,
    "packageFingerprint" TEXT NOT NULL,
    "manifestSchemaVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpPublishingManifest_pkey" PRIMARY KEY ("publishingManifestId")
);

-- CreateTable
CREATE TABLE "GmpPublishingPackageValidation" (
    "packageValidationId" TEXT NOT NULL,
    "publishingPackageId" TEXT NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "blockingIssues" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "capabilityGaps" JSONB NOT NULL,
    "validationModelVersion" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPublishingPackageValidation_pkey" PRIMARY KEY ("packageValidationId")
);

-- CreateTable
CREATE TABLE "GmpMediaManifest" (
    "mediaManifestId" TEXT NOT NULL,
    "publishingPackageId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpMediaManifest_pkey" PRIMARY KEY ("mediaManifestId")
);

-- CreateTable
CREATE TABLE "GmpMediaManifestItem" (
    "mediaManifestItemId" TEXT NOT NULL,
    "mediaManifestId" TEXT NOT NULL,
    "mediaReferenceId" TEXT NOT NULL,
    "sourceAssetId" TEXT,
    "role" TEXT NOT NULL,
    "featuredImageFlag" BOOLEAN NOT NULL DEFAULT false,
    "insertionLocation" TEXT,
    "altText" TEXT,
    "title" TEXT,
    "caption" TEXT,
    "description" TEXT,
    "fileType" TEXT,
    "dimensions" JSONB,
    "sourceUrlOrStorageReference" TEXT,
    "destinationMediaId" TEXT,
    "destinationUrl" TEXT,
    "uploadStatus" TEXT NOT NULL,
    "checksum" TEXT,
    "requiredFlag" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpMediaManifestItem_pkey" PRIMARY KEY ("mediaManifestItemId")
);

-- CreateTable
CREATE TABLE "GmpRelease" (
    "releaseId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "releaseName" TEXT NOT NULL,
    "releaseType" TEXT NOT NULL,
    "releaseStatus" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "rollbackReleaseId" TEXT,
    "gopExecutionId" TEXT,
    "policyVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpRelease_pkey" PRIMARY KEY ("releaseId")
);

-- CreateTable
CREATE TABLE "GmpReleaseItem" (
    "releaseItemId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "publishingPackageId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "dependencyReferences" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "publicationAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "currentPublicationRecordId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpReleaseItem_pkey" PRIMARY KEY ("releaseItemId")
);

-- CreateTable
CREATE TABLE "GmpReleaseReview" (
    "releaseReviewId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "reviewState" TEXT NOT NULL,
    "assignedTo" TEXT,
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpReleaseReview_pkey" PRIMARY KEY ("releaseReviewId")
);

-- CreateTable
CREATE TABLE "GmpReleaseApproval" (
    "releaseApprovalId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpReleaseApproval_pkey" PRIMARY KEY ("releaseApprovalId")
);

-- CreateTable
CREATE TABLE "GmpPublicationAttempt" (
    "publicationAttemptId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "releaseItemId" TEXT NOT NULL,
    "publishingPackageId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "gopExecutionId" TEXT,
    "requestFingerprint" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureCategory" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "remoteResponseReference" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPublicationAttempt_pkey" PRIMARY KEY ("publicationAttemptId")
);

-- CreateTable
CREATE TABLE "GmpPublicationRecord" (
    "publicationRecordId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "publishingPackageId" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "externalObjectType" TEXT NOT NULL,
    "externalObjectId" TEXT NOT NULL,
    "externalRevisionId" TEXT,
    "externalUrl" TEXT NOT NULL,
    "publishedStatus" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "remoteContentFingerprint" TEXT,
    "expectedContentFingerprint" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "supersedesPublicationRecordId" TEXT,
    "rolledBackFromRecordId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPublicationRecord_pkey" PRIMARY KEY ("publicationRecordId")
);

-- CreateTable
CREATE TABLE "GmpPublicationVerification" (
    "publicationVerificationId" TEXT NOT NULL,
    "publicationRecordId" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL,
    "expectedState" JSONB NOT NULL,
    "remoteState" JSONB NOT NULL,
    "differences" JSONB NOT NULL,
    "blockingDifferences" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "verificationModelVersion" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPublicationVerification_pkey" PRIMARY KEY ("publicationVerificationId")
);

-- CreateTable
CREATE TABLE "GmpPublicationDifference" (
    "publicationDifferenceId" TEXT NOT NULL,
    "publicationVerificationId" TEXT NOT NULL,
    "differenceKey" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "expectedValue" JSONB,
    "actualValue" JSONB,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPublicationDifference_pkey" PRIMARY KEY ("publicationDifferenceId")
);

-- CreateTable
CREATE TABLE "GmpPublicationReconciliation" (
    "publicationReconciliationId" TEXT NOT NULL,
    "publicationRecordId" TEXT NOT NULL,
    "reconciliationStatus" TEXT NOT NULL,
    "driftDetected" BOOLEAN NOT NULL DEFAULT false,
    "driftReasons" JSONB NOT NULL,
    "expectedState" JSONB NOT NULL,
    "remoteState" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPublicationReconciliation_pkey" PRIMARY KEY ("publicationReconciliationId")
);

-- CreateTable
CREATE TABLE "GmpPublishingLineage" (
    "publishingLineageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "publishingPackageId" TEXT NOT NULL,
    "packageVersion" INTEGER NOT NULL,
    "sourceFingerprint" TEXT NOT NULL,
    "packageFingerprint" TEXT NOT NULL,
    "releaseId" TEXT,
    "releaseItemId" TEXT,
    "publicationAttemptId" TEXT,
    "publicationRecordId" TEXT,
    "destinationId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "gopExecutionId" TEXT,
    "rendererVersion" TEXT,
    "adapterVersion" TEXT,
    "publishingPolicyVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPublishingLineage_pkey" PRIMARY KEY ("publishingLineageId")
);

-- CreateTable
CREATE TABLE "GmpPublishingIdempotencyRecord" (
    "publishingIdempotencyRecordId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "publishingPackageId" TEXT NOT NULL,
    "packageVersion" INTEGER NOT NULL,
    "operationType" TEXT NOT NULL,
    "releaseItemId" TEXT NOT NULL,
    "requestFingerprint" TEXT NOT NULL,
    "resultFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpPublishingIdempotencyRecord_pkey" PRIMARY KEY ("publishingIdempotencyRecordId")
);

-- CreateIndex
CREATE INDEX "GmpPublishingDestination_projectId_updatedAt_idx" ON "GmpPublishingDestination"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingDestination_siteId_updatedAt_idx" ON "GmpPublishingDestination"("siteId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingDestination_destinationType_updatedAt_idx" ON "GmpPublishingDestination"("destinationType", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingDestination_connectionStatus_updatedAt_idx" ON "GmpPublishingDestination"("connectionStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpDestinationCapability_destinationId_updatedAt_idx" ON "GmpDestinationCapability"("destinationId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpDestinationCapability_destinationId_capabilityKey_key" ON "GmpDestinationCapability"("destinationId", "capabilityKey");

-- CreateIndex
CREATE INDEX "GmpApprovedRevisionSet_projectId_createdAt_idx" ON "GmpApprovedRevisionSet"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpApprovedRevisionSet_siteId_createdAt_idx" ON "GmpApprovedRevisionSet"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpApprovedRevisionSet_pageId_createdAt_idx" ON "GmpApprovedRevisionSet"("pageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpApprovedRevisionSet_contentDraftId_createdAt_idx" ON "GmpApprovedRevisionSet"("contentDraftId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpApprovedRevisionSet_sourceFingerprint_idx" ON "GmpApprovedRevisionSet"("sourceFingerprint");

-- CreateIndex
CREATE INDEX "GmpPublishingPackage_projectId_updatedAt_idx" ON "GmpPublishingPackage"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingPackage_siteId_updatedAt_idx" ON "GmpPublishingPackage"("siteId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingPackage_pageId_updatedAt_idx" ON "GmpPublishingPackage"("pageId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingPackage_contentDraftId_updatedAt_idx" ON "GmpPublishingPackage"("contentDraftId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingPackage_destinationId_updatedAt_idx" ON "GmpPublishingPackage"("destinationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingPackage_packageStatus_updatedAt_idx" ON "GmpPublishingPackage"("packageStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingPackage_releaseStatus_updatedAt_idx" ON "GmpPublishingPackage"("releaseStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingPackage_sourceFingerprint_idx" ON "GmpPublishingPackage"("sourceFingerprint");

-- CreateIndex
CREATE INDEX "GmpPublishingPackage_packageFingerprint_idx" ON "GmpPublishingPackage"("packageFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "GmpPublishingManifest_publishingPackageId_key" ON "GmpPublishingManifest"("publishingPackageId");

-- CreateIndex
CREATE INDEX "GmpPublishingManifest_destinationType_updatedAt_idx" ON "GmpPublishingManifest"("destinationType", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingManifest_packageFingerprint_idx" ON "GmpPublishingManifest"("packageFingerprint");

-- CreateIndex
CREATE INDEX "GmpPublishingPackageValidation_publishingPackageId_validate_idx" ON "GmpPublishingPackageValidation"("publishingPackageId", "validatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMediaManifest_publishingPackageId_updatedAt_idx" ON "GmpMediaManifest"("publishingPackageId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMediaManifest_destinationId_updatedAt_idx" ON "GmpMediaManifest"("destinationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMediaManifestItem_mediaManifestId_updatedAt_idx" ON "GmpMediaManifestItem"("mediaManifestId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMediaManifestItem_destinationMediaId_idx" ON "GmpMediaManifestItem"("destinationMediaId");

-- CreateIndex
CREATE INDEX "GmpRelease_projectId_updatedAt_idx" ON "GmpRelease"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRelease_siteId_updatedAt_idx" ON "GmpRelease"("siteId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRelease_releaseStatus_updatedAt_idx" ON "GmpRelease"("releaseStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRelease_scheduledAt_idx" ON "GmpRelease"("scheduledAt");

-- CreateIndex
CREATE INDEX "GmpRelease_gopExecutionId_idx" ON "GmpRelease"("gopExecutionId");

-- CreateIndex
CREATE INDEX "GmpReleaseItem_releaseId_sequence_idx" ON "GmpReleaseItem"("releaseId", "sequence");

-- CreateIndex
CREATE INDEX "GmpReleaseItem_publishingPackageId_updatedAt_idx" ON "GmpReleaseItem"("publishingPackageId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpReleaseItem_status_updatedAt_idx" ON "GmpReleaseItem"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpReleaseReview_releaseId_updatedAt_idx" ON "GmpReleaseReview"("releaseId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpReleaseApproval_releaseId_decidedAt_idx" ON "GmpReleaseApproval"("releaseId", "decidedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationAttempt_releaseId_startedAt_idx" ON "GmpPublicationAttempt"("releaseId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationAttempt_releaseItemId_startedAt_idx" ON "GmpPublicationAttempt"("releaseItemId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationAttempt_publishingPackageId_startedAt_idx" ON "GmpPublicationAttempt"("publishingPackageId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationAttempt_destinationId_startedAt_idx" ON "GmpPublicationAttempt"("destinationId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationAttempt_status_startedAt_idx" ON "GmpPublicationAttempt"("status", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationAttempt_requestFingerprint_idx" ON "GmpPublicationAttempt"("requestFingerprint");

-- CreateIndex
CREATE INDEX "GmpPublicationAttempt_gopExecutionId_idx" ON "GmpPublicationAttempt"("gopExecutionId");

-- CreateIndex
CREATE INDEX "GmpPublicationRecord_projectId_createdAt_idx" ON "GmpPublicationRecord"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationRecord_siteId_createdAt_idx" ON "GmpPublicationRecord"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationRecord_pageId_createdAt_idx" ON "GmpPublicationRecord"("pageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationRecord_publishingPackageId_createdAt_idx" ON "GmpPublicationRecord"("publishingPackageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationRecord_destinationId_createdAt_idx" ON "GmpPublicationRecord"("destinationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationRecord_externalObjectId_idx" ON "GmpPublicationRecord"("externalObjectId");

-- CreateIndex
CREATE INDEX "GmpPublicationRecord_externalUrl_idx" ON "GmpPublicationRecord"("externalUrl");

-- CreateIndex
CREATE INDEX "GmpPublicationRecord_verificationStatus_createdAt_idx" ON "GmpPublicationRecord"("verificationStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationVerification_publicationRecordId_verifiedAt_idx" ON "GmpPublicationVerification"("publicationRecordId", "verifiedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationVerification_verificationStatus_verifiedAt_idx" ON "GmpPublicationVerification"("verificationStatus", "verifiedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationDifference_publicationVerificationId_createdA_idx" ON "GmpPublicationDifference"("publicationVerificationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationReconciliation_publicationRecordId_detectedAt_idx" ON "GmpPublicationReconciliation"("publicationRecordId", "detectedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublicationReconciliation_driftDetected_detectedAt_idx" ON "GmpPublicationReconciliation"("driftDetected", "detectedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingLineage_projectId_createdAt_idx" ON "GmpPublishingLineage"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingLineage_siteId_createdAt_idx" ON "GmpPublishingLineage"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingLineage_pageId_createdAt_idx" ON "GmpPublishingLineage"("pageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingLineage_publishingPackageId_createdAt_idx" ON "GmpPublishingLineage"("publishingPackageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingLineage_sourceFingerprint_idx" ON "GmpPublishingLineage"("sourceFingerprint");

-- CreateIndex
CREATE INDEX "GmpPublishingLineage_packageFingerprint_idx" ON "GmpPublishingLineage"("packageFingerprint");

-- CreateIndex
CREATE INDEX "GmpPublishingLineage_gopExecutionId_idx" ON "GmpPublishingLineage"("gopExecutionId");

-- CreateIndex
CREATE INDEX "GmpPublishingIdempotencyRecord_destinationId_updatedAt_idx" ON "GmpPublishingIdempotencyRecord"("destinationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingIdempotencyRecord_publishingPackageId_updatedA_idx" ON "GmpPublishingIdempotencyRecord"("publishingPackageId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingIdempotencyRecord_requestFingerprint_idx" ON "GmpPublishingIdempotencyRecord"("requestFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "GmpPublishingIdempotencyRecord_destinationId_publishingPack_key" ON "GmpPublishingIdempotencyRecord"("destinationId", "publishingPackageId", "packageVersion", "operationType", "releaseItemId", "requestFingerprint");
