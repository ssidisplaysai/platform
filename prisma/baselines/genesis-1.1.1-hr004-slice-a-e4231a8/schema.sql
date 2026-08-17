-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "GlwJobType" AS ENUM ('PAGE_GENERATION', 'BLOG_GENERATION');

-- CreateEnum
CREATE TYPE "GlwJobStatus" AS ENUM ('QUEUED', 'STARTING', 'RUNNING', 'GENERATING_CONTENT', 'GENERATING_IMAGE', 'UPLOADING_IMAGE', 'PUBLISHING', 'COMPLETE', 'FAILED_QA', 'FAILED');

-- CreateEnum
CREATE TYPE "GlwBusinessStatus" AS ENUM ('UNKNOWN', 'IN_PROGRESS', 'COMPLETE', 'FAILED', 'FAILED_QA');

-- CreateEnum
CREATE TYPE "GlwCallbackDeliveryStatus" AS ENUM ('NOT_READY', 'PENDING', 'RETRYING', 'ACKNOWLEDGED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "GlwCallbackReceiptOutcome" AS ENUM ('RECEIVED', 'APPLIED', 'ALREADY_APPLIED', 'CONFLICT', 'REJECTED');

-- CreateEnum
CREATE TYPE "GlwDailyPublishPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAUSED', 'EXECUTING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "GlwDailyPublishCandidateAction" AS ENUM ('CREATE_STATE', 'CREATE_CITY', 'UPDATE_CITY', 'SKIP_EXISTING', 'BLOCKED_PARENT', 'BLOCKED_DUPLICATE', 'BLOCKED_QA', 'BLOCKED_SITE');

-- CreateEnum
CREATE TYPE "GlwDailyPublishCandidateApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'EXCLUDED', 'BLOCKED', 'QUEUED', 'SKIPPED_ALREADY_QUEUED');

-- CreateTable
CREATE TABLE "GlwJob" (
    "id" TEXT NOT NULL,
    "type" "GlwJobType" NOT NULL,
    "status" "GlwJobStatus" NOT NULL,
    "retryOfJobId" TEXT,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB,
    "error" JSONB,
    "externalExecutionId" TEXT,
    "operationKey" TEXT,
    "businessStatus" "GlwBusinessStatus",
    "callbackDeliveryStatus" "GlwCallbackDeliveryStatus",
    "terminalReceiptId" TEXT,
    "publicationKey" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlwJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlwCallbackReceipt" (
    "receiptId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "terminalScopeKey" TEXT NOT NULL,
    "operationKey" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "externalExecutionId" TEXT NOT NULL,
    "callbackType" TEXT NOT NULL,
    "terminalStatus" TEXT NOT NULL,
    "payloadSha256" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "outcome" "GlwCallbackReceiptOutcome" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),
    "responseStatus" INTEGER,
    "conflictReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlwCallbackReceipt_pkey" PRIMARY KEY ("receiptId")
);

-- CreateTable
CREATE TABLE "GlwDailyPublishPlan" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "status" "GlwDailyPublishPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "dailyPageLimit" INTEGER NOT NULL,
    "hourlyPageLimit" INTEGER NOT NULL,
    "maxConcurrentJobs" INTEGER NOT NULL,
    "retryLimit" INTEGER NOT NULL,
    "minimumDelaySeconds" INTEGER NOT NULL,
    "summaryJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlwDailyPublishPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlwDailyPublishCandidate" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "stateSlug" TEXT NOT NULL,
    "cityName" TEXT,
    "citySlug" TEXT,
    "canonicalPath" TEXT NOT NULL,
    "desiredAction" "GlwDailyPublishCandidateAction" NOT NULL,
    "priority" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "existingWordPressId" TEXT,
    "existingStatus" TEXT,
    "parentProductId" TEXT,
    "parentStateId" TEXT,
    "approvalStatus" "GlwDailyPublishCandidateApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "queueJobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlwDailyPublishCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlwPublishingControl" (
    "siteId" TEXT NOT NULL,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" TIMESTAMP(3),
    "pausedBy" TEXT,
    "publishingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlwPublishingControl_pkey" PRIMARY KEY ("siteId")
);

-- CreateTable
CREATE TABLE "GopJobEvent" (
    "eventId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "stage" TEXT,
    "status" TEXT,
    "message" TEXT,
    "source" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "metadata" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "correlationId" TEXT,
    "causationId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GopJobEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "GopExecution" (
    "executionId" TEXT NOT NULL,
    "executionType" TEXT,
    "jobId" TEXT,
    "moduleId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "parentExecutionId" TEXT,
    "childExecutionIds" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "currentState" TEXT,
    "currentNodeId" TEXT,
    "priority" TEXT NOT NULL,
    "queueName" TEXT,
    "workerAssignment" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "retryHistory" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "timeoutMs" INTEGER,
    "correlationId" TEXT,
    "causationId" TEXT,
    "context" JSONB NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "artifacts" JSONB NOT NULL,
    "metadata" JSONB,
    "executionVersion" INTEGER NOT NULL DEFAULT 1,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GopExecution_pkey" PRIMARY KEY ("executionId")
);

-- CreateTable
CREATE TABLE "GopExecutionSnapshot" (
    "snapshotId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "snapshotVersion" INTEGER NOT NULL,
    "snapshotSequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "currentState" TEXT,
    "currentNodeId" TEXT,
    "progressPercent" INTEGER NOT NULL,
    "queuePosition" INTEGER,
    "workerAssignment" JSONB,
    "retryCount" INTEGER NOT NULL,
    "retryHistory" JSONB NOT NULL,
    "output" JSONB,
    "timing" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "artifacts" JSONB NOT NULL,
    "state" JSONB NOT NULL,
    "upToEventSequence" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GopExecutionSnapshot_pkey" PRIMARY KEY ("snapshotId")
);

-- CreateTable
CREATE TABLE "GopWorker" (
    "workerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "workerType" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "maxCapacity" INTEGER NOT NULL,
    "currentWorkload" INTEGER NOT NULL DEFAULT 0,
    "heartbeatAt" TIMESTAMP(3) NOT NULL,
    "health" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "supportedProtocolVersions" JSONB NOT NULL,
    "instanceId" TEXT,
    "environment" TEXT,
    "tokenId" TEXT,
    "authMode" TEXT NOT NULL,
    "leaseTtlMs" INTEGER,
    "heartbeatIntervalMs" INTEGER,
    "lastLeaseId" TEXT,
    "disconnectedAt" TIMESTAMP(3),
    "workspaceId" TEXT,
    "moduleId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GopWorker_pkey" PRIMARY KEY ("workerId")
);

-- CreateTable
CREATE TABLE "GopExecutionLease" (
    "leaseId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "queueItemId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "leaseStartAt" TIMESTAMP(3) NOT NULL,
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "heartbeatDeadlineAt" TIMESTAMP(3) NOT NULL,
    "renewalCount" INTEGER NOT NULL DEFAULT 0,
    "leaseState" TEXT NOT NULL,
    "protocolVersion" TEXT NOT NULL,
    "tokenId" TEXT,
    "stolenFromWorkerId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releaseReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GopExecutionLease_pkey" PRIMARY KEY ("leaseId")
);

-- CreateTable
CREATE TABLE "GopDeadLetter" (
    "deadLetterId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "queueItemId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "queueName" TEXT,
    "reason" TEXT NOT NULL,
    "retryHistory" JSONB NOT NULL,
    "failureHistory" JSONB NOT NULL,
    "operatorNotes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "recoveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GopDeadLetter_pkey" PRIMARY KEY ("deadLetterId")
);

-- CreateTable
CREATE TABLE "GopRecoveryRecord" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "executionId" TEXT,
    "previousJobStatus" TEXT NOT NULL,
    "newJobStatus" TEXT NOT NULL,
    "previousExecutionStatus" TEXT,
    "newExecutionStatus" TEXT,
    "reason" TEXT NOT NULL,
    "recoveredBy" TEXT NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "safeRecovery" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GopRecoveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmpProject" (
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "organization" TEXT,
    "workspaceId" TEXT NOT NULL,
    "ownerActorId" TEXT NOT NULL,
    "members" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "businessProfileRef" TEXT,
    "businessGenomeRef" TEXT,
    "defaultLanguage" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpProject_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "GmpSite" (
    "siteId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "primaryDomain" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "publishingPlatform" TEXT NOT NULL,
    "publishingStatus" TEXT NOT NULL,
    "authenticationMethod" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL,
    "publishingCapabilities" JSONB NOT NULL,
    "defaultLanguage" TEXT NOT NULL,
    "defaultTheme" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpSite_pkey" PRIMARY KEY ("siteId")
);

-- CreateTable
CREATE TABLE "GmpBrandProfile" (
    "brandProfileId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "tagline" TEXT,
    "mission" TEXT,
    "brandVoice" TEXT,
    "writingStyle" TEXT,
    "primaryAudience" TEXT,
    "secondaryAudience" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "logoReferences" JSONB NOT NULL,
    "typography" JSONB,
    "assetReferences" JSONB NOT NULL,
    "socialLinks" JSONB NOT NULL,
    "contactInformation" JSONB,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpBrandProfile_pkey" PRIMARY KEY ("brandProfileId")
);

-- CreateTable
CREATE TABLE "GmpPublishingConnection" (
    "connectionId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "publishingStatus" TEXT NOT NULL,
    "authenticationMethod" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL,
    "publishingCapabilities" JSONB NOT NULL,
    "configuration" JSONB,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastValidatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpPublishingConnection_pkey" PRIMARY KEY ("connectionId")
);

-- CreateTable
CREATE TABLE "GmpEnvironmentConfig" (
    "configId" TEXT NOT NULL,
    "projectId" TEXT,
    "siteId" TEXT,
    "environment" TEXT NOT NULL,
    "variables" JSONB NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpEnvironmentConfig_pkey" PRIMARY KEY ("configId")
);

-- CreateTable
CREATE TABLE "GmpBusinessKnowledgeWorkspace" (
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workspaceVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "completenessScore" INTEGER NOT NULL DEFAULT 0,
    "confidenceScore" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),
    "lastApprovedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpBusinessKnowledgeWorkspace_pkey" PRIMARY KEY ("knowledgeWorkspaceId")
);

-- CreateTable
CREATE TABLE "GmpKnowledgeRecord" (
    "knowledgeRecordId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "recordType" TEXT NOT NULL,
    "canonicalKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "structuredValue" JSONB NOT NULL,
    "normalizedValue" JSONB,
    "status" TEXT NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "conflictState" TEXT NOT NULL DEFAULT 'NONE',
    "reviewState" TEXT NOT NULL DEFAULT 'DRAFT',
    "supersededByRecordId" TEXT,
    "parentRecordId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpKnowledgeRecord_pkey" PRIMARY KEY ("knowledgeRecordId")
);

-- CreateTable
CREATE TABLE "GmpKnowledgeRecordVersion" (
    "knowledgeRecordVersionId" TEXT NOT NULL,
    "knowledgeRecordId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB NOT NULL,
    "changeReason" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceImpact" JSONB,
    "approvalImpact" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpKnowledgeRecordVersion_pkey" PRIMARY KEY ("knowledgeRecordVersionId")
);

-- CreateTable
CREATE TABLE "GmpKnowledgeSource" (
    "sourceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "locationReference" TEXT,
    "externalIdentifier" TEXT,
    "checksum" TEXT,
    "sourceVersion" TEXT,
    "capturedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpKnowledgeSource_pkey" PRIMARY KEY ("sourceId")
);

-- CreateTable
CREATE TABLE "GmpKnowledgeEvidenceLink" (
    "knowledgeEvidenceLinkId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "knowledgeRecordId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "evidenceLocation" TEXT,
    "evidenceSummary" TEXT,
    "extractionMethod" TEXT,
    "confidence" INTEGER NOT NULL DEFAULT 50,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpKnowledgeEvidenceLink_pkey" PRIMARY KEY ("knowledgeEvidenceLinkId")
);

-- CreateTable
CREATE TABLE "GmpKnowledgeReview" (
    "knowledgeReviewId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "knowledgeRecordId" TEXT NOT NULL,
    "assignedTo" TEXT,
    "reviewState" TEXT NOT NULL,
    "operatorNotes" TEXT,
    "reviewNotes" TEXT,
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpKnowledgeReview_pkey" PRIMARY KEY ("knowledgeReviewId")
);

-- CreateTable
CREATE TABLE "GmpKnowledgeApproval" (
    "knowledgeApprovalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "knowledgeRecordId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "approvalNotes" TEXT,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpKnowledgeApproval_pkey" PRIMARY KEY ("knowledgeApprovalId")
);

-- CreateTable
CREATE TABLE "GmpKnowledgeConflict" (
    "knowledgeConflictId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "conflictGroup" TEXT NOT NULL,
    "conflictReason" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "resolutionStatus" TEXT NOT NULL,
    "selectedRecordId" TEXT,
    "resolutionNotes" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpKnowledgeConflict_pkey" PRIMARY KEY ("knowledgeConflictId")
);

-- CreateTable
CREATE TABLE "GmpKnowledgeConflictMember" (
    "knowledgeConflictMemberId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "knowledgeConflictId" TEXT NOT NULL,
    "knowledgeRecordId" TEXT NOT NULL,
    "role" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpKnowledgeConflictMember_pkey" PRIMARY KEY ("knowledgeConflictMemberId")
);

-- CreateTable
CREATE TABLE "GmpKnowledgeCompletenessAssessment" (
    "knowledgeCompletenessAssessmentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "scoringModelVersion" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "domainScores" JSONB NOT NULL,
    "missingCriticalFields" JSONB NOT NULL,
    "missingRecommendedFields" JSONB NOT NULL,
    "conflictedFields" JSONB NOT NULL,
    "unapprovedFields" JSONB NOT NULL,
    "expiredFields" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpKnowledgeCompletenessAssessment_pkey" PRIMARY KEY ("knowledgeCompletenessAssessmentId")
);

-- CreateTable
CREATE TABLE "GmpContextAssemblyRecord" (
    "contextAssemblyRecordId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "siteId" TEXT,
    "operationType" TEXT NOT NULL,
    "previewMode" BOOLEAN NOT NULL DEFAULT false,
    "inputMetadata" JSONB,
    "assembledContext" JSONB NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "knowledgeWorkspaceVersion" INTEGER NOT NULL,
    "recordVersions" JSONB NOT NULL,
    "gopExecutionId" TEXT,
    "createdBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpContextAssemblyRecord_pkey" PRIMARY KEY ("contextAssemblyRecordId")
);

-- CreateTable
CREATE TABLE "GmpPage" (
    "pageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "parentPageId" TEXT,
    "pageType" TEXT NOT NULL,
    "pageTemplateType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "proposedUrl" TEXT,
    "title" TEXT NOT NULL,
    "workingTitle" TEXT,
    "summary" TEXT,
    "purpose" TEXT,
    "primaryObjective" TEXT,
    "secondaryObjectives" JSONB NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "contentState" TEXT NOT NULL,
    "seoState" TEXT NOT NULL,
    "publishingState" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "locale" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "audienceReferences" JSONB NOT NULL,
    "productReferences" JSONB NOT NULL,
    "serviceReferences" JSONB NOT NULL,
    "industryReferences" JSONB NOT NULL,
    "applicationReferences" JSONB NOT NULL,
    "knowledgeWorkspaceVersion" INTEGER NOT NULL,
    "brandProfileVersion" INTEGER NOT NULL,
    "currentBriefId" TEXT,
    "currentContentPlanId" TEXT,
    "currentApprovedRevisionId" TEXT,
    "publishingConnectionId" TEXT,
    "intent" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpPage_pkey" PRIMARY KEY ("pageId")
);

-- CreateTable
CREATE TABLE "GmpPageBrief" (
    "briefId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "briefVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "purpose" TEXT,
    "audience" TEXT,
    "userNeed" TEXT,
    "businessGoal" TEXT,
    "primaryTopic" TEXT,
    "secondaryTopics" JSONB NOT NULL,
    "primaryKeyword" TEXT,
    "secondaryKeywords" JSONB NOT NULL,
    "searchIntent" TEXT,
    "funnelStage" TEXT,
    "valueProposition" TEXT,
    "requiredClaims" JSONB NOT NULL,
    "requiredProofPoints" JSONB NOT NULL,
    "requiredProductsOrServices" JSONB NOT NULL,
    "requiredApplications" JSONB NOT NULL,
    "requiredIndustries" JSONB NOT NULL,
    "requiredTechnicalSpecifications" JSONB NOT NULL,
    "requiredFaqs" JSONB NOT NULL,
    "restrictedMessaging" JSONB NOT NULL,
    "conversionGoal" TEXT,
    "primaryCta" TEXT,
    "secondaryCta" TEXT,
    "competitorContext" JSONB NOT NULL,
    "toneGuidance" TEXT,
    "evidenceRequirements" JSONB NOT NULL,
    "knowledgeRecordReferences" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "metadata" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpPageBrief_pkey" PRIMARY KEY ("briefId")
);

-- CreateTable
CREATE TABLE "GmpPageBriefVersion" (
    "briefVersionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "briefId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB NOT NULL,
    "changeReason" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPageBriefVersion_pkey" PRIMARY KEY ("briefVersionId")
);

-- CreateTable
CREATE TABLE "GmpContentPlan" (
    "contentPlanId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageBriefId" TEXT NOT NULL,
    "planVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "planningModelVersion" TEXT NOT NULL,
    "targetWordRange" JSONB NOT NULL,
    "readingLevel" TEXT,
    "requiredSectionCount" INTEGER NOT NULL DEFAULT 0,
    "optionalSectionCount" INTEGER NOT NULL DEFAULT 0,
    "sectionOrder" JSONB NOT NULL,
    "internalLinkRequirements" JSONB NOT NULL,
    "externalEvidenceRequirements" JSONB NOT NULL,
    "structuredDataRequirements" JSONB NOT NULL,
    "mediaRequirements" JSONB NOT NULL,
    "ctaRequirements" JSONB NOT NULL,
    "seoRequirements" JSONB NOT NULL,
    "accessibilityRequirements" JSONB NOT NULL,
    "approvalRequirements" JSONB NOT NULL,
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "metadata" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpContentPlan_pkey" PRIMARY KEY ("contentPlanId")
);

-- CreateTable
CREATE TABLE "GmpContentPlanVersion" (
    "contentPlanVersionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentPlanId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "previousValue" JSONB,
    "newValue" JSONB NOT NULL,
    "changeReason" TEXT,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpContentPlanVersion_pkey" PRIMARY KEY ("contentPlanVersionId")
);

-- CreateTable
CREATE TABLE "GmpPageSection" (
    "sectionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentPlanId" TEXT NOT NULL,
    "parentSectionId" TEXT,
    "sectionType" TEXT NOT NULL,
    "sectionKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "headingLevel" INTEGER NOT NULL,
    "workingHeading" TEXT,
    "purpose" TEXT,
    "audienceNeed" TEXT,
    "requiredKnowledgeRecords" JSONB NOT NULL,
    "requiredClaims" JSONB NOT NULL,
    "requiredEvidence" JSONB NOT NULL,
    "requiredProducts" JSONB NOT NULL,
    "requiredServices" JSONB NOT NULL,
    "requiredSpecifications" JSONB NOT NULL,
    "requiredFaqs" JSONB NOT NULL,
    "targetWordRange" JSONB NOT NULL,
    "ctaType" TEXT,
    "mediaRequirement" JSONB NOT NULL,
    "internalLinkRequirement" JSONB NOT NULL,
    "structuredDataContribution" JSONB NOT NULL,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpPageSection_pkey" PRIMARY KEY ("sectionId")
);

-- CreateTable
CREATE TABLE "GmpPageRelationship" (
    "relationshipId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourcePageId" TEXT NOT NULL,
    "targetPageId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPageRelationship_pkey" PRIMARY KEY ("relationshipId")
);

-- CreateTable
CREATE TABLE "GmpInternalLinkPlan" (
    "internalLinkPlanId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourcePageId" TEXT NOT NULL,
    "targetPageId" TEXT NOT NULL,
    "sourcePageRefId" TEXT NOT NULL,
    "targetPageRefId" TEXT NOT NULL,
    "linkPurpose" TEXT NOT NULL,
    "anchorTextGuidance" TEXT,
    "requirementLevel" TEXT NOT NULL,
    "sectionPlacement" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 50,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "knowledgeRelationship" TEXT,
    "seoRelationship" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpInternalLinkPlan_pkey" PRIMARY KEY ("internalLinkPlanId")
);

-- CreateTable
CREATE TABLE "GmpPageReview" (
    "pageReviewId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
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

    CONSTRAINT "GmpPageReview_pkey" PRIMARY KEY ("pageReviewId")
);

-- CreateTable
CREATE TABLE "GmpPageApproval" (
    "pageApprovalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPageApproval_pkey" PRIMARY KEY ("pageApprovalId")
);

-- CreateTable
CREATE TABLE "GmpPageReadinessAssessment" (
    "pageReadinessAssessmentId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "scoringModelVersion" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "planningReadiness" INTEGER NOT NULL,
    "knowledgeReadiness" INTEGER NOT NULL,
    "seoReadiness" INTEGER NOT NULL,
    "evidenceReadiness" INTEGER NOT NULL,
    "linkingReadiness" INTEGER NOT NULL,
    "blockingIssues" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPageReadinessAssessment_pkey" PRIMARY KEY ("pageReadinessAssessmentId")
);

-- CreateTable
CREATE TABLE "GmpPageKnowledgeReference" (
    "pageKnowledgeReferenceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageBriefId" TEXT,
    "contentPlanId" TEXT,
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "knowledgeRecordId" TEXT NOT NULL,
    "knowledgeRecordVersion" INTEGER NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "role" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPageKnowledgeReference_pkey" PRIMARY KEY ("pageKnowledgeReferenceId")
);

-- CreateTable
CREATE TABLE "GmpPageSourceReference" (
    "pageSourceReferenceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageBriefId" TEXT,
    "contentPlanId" TEXT,
    "sourceId" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpPageSourceReference_pkey" PRIMARY KEY ("pageSourceReferenceId")
);

-- CreateTable
CREATE TABLE "GmpContentDraft" (
    "contentDraftId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageVersion" INTEGER NOT NULL,
    "pageBriefId" TEXT NOT NULL,
    "pageBriefVersion" INTEGER NOT NULL,
    "contentPlanId" TEXT NOT NULL,
    "contentPlanVersion" INTEGER NOT NULL,
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "knowledgeWorkspaceVersion" INTEGER NOT NULL,
    "brandProfileVersion" INTEGER NOT NULL,
    "generationRequestId" TEXT,
    "generationStatus" TEXT NOT NULL,
    "editorialStatus" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelIdentifier" TEXT NOT NULL,
    "generationPolicyVersion" TEXT NOT NULL,
    "promptAdapterVersion" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "supersededAt" TIMESTAMP(3),
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpContentDraft_pkey" PRIMARY KEY ("contentDraftId")
);

-- CreateTable
CREATE TABLE "GmpGenerationRequest" (
    "generationRequestId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "requestedSections" JSONB NOT NULL,
    "generationMode" TEXT NOT NULL,
    "providerPreference" TEXT,
    "modelPreference" TEXT,
    "temperature" DOUBLE PRECISION,
    "maximumOutputPolicy" INTEGER,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "gopExecutionId" TEXT,
    "contextPackageReference" TEXT,
    "inputFingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "GmpGenerationRequest_pkey" PRIMARY KEY ("generationRequestId")
);

-- CreateTable
CREATE TABLE "GmpSectionContent" (
    "sectionContentId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "pageSectionId" TEXT NOT NULL,
    "pageSectionStableKey" TEXT NOT NULL,
    "sectionType" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "heading" TEXT,
    "bodyContent" TEXT,
    "structuredContent" JSONB NOT NULL,
    "ctaContent" JSONB NOT NULL,
    "mediaGuidance" JSONB NOT NULL,
    "internalLinkSuggestions" JSONB NOT NULL,
    "externalEvidenceReferences" JSONB NOT NULL,
    "knowledgeRecordReferences" JSONB NOT NULL,
    "claimReferences" JSONB NOT NULL,
    "sourceReferences" JSONB NOT NULL,
    "restrictionEvaluation" JSONB NOT NULL,
    "generationStatus" TEXT NOT NULL,
    "editorialStatus" TEXT NOT NULL,
    "approvalStatus" TEXT NOT NULL,
    "currentRevisionId" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "readingLevel" TEXT,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpSectionContent_pkey" PRIMARY KEY ("sectionContentId")
);

-- CreateTable
CREATE TABLE "GmpSectionContentRevision" (
    "sectionContentRevisionId" TEXT NOT NULL,
    "sectionContentId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "revisionType" TEXT NOT NULL,
    "instruction" TEXT,
    "reason" TEXT,
    "previousContent" JSONB NOT NULL,
    "newContent" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "provider" TEXT,
    "modelIdentifier" TEXT,
    "inputFingerprint" TEXT,
    "knowledgeImpact" JSONB NOT NULL,
    "evidenceImpact" JSONB NOT NULL,
    "validationResult" JSONB NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "GmpSectionContentRevision_pkey" PRIMARY KEY ("sectionContentRevisionId")
);

-- CreateTable
CREATE TABLE "GmpContentReview" (
    "contentReviewId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "sectionContentId" TEXT,
    "assignedTo" TEXT,
    "reviewState" TEXT NOT NULL,
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "sectionNotes" TEXT,
    "approvalNotes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpContentReview_pkey" PRIMARY KEY ("contentReviewId")
);

-- CreateTable
CREATE TABLE "GmpContentApproval" (
    "contentApprovalId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "sectionContentId" TEXT,
    "decision" TEXT NOT NULL,
    "decidedBy" TEXT NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpContentApproval_pkey" PRIMARY KEY ("contentApprovalId")
);

-- CreateTable
CREATE TABLE "GmpContentValidation" (
    "contentValidationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "validationModelVersion" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "blockingIssues" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "sectionScores" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpContentValidation_pkey" PRIMARY KEY ("contentValidationId")
);

-- CreateTable
CREATE TABLE "GmpSectionValidation" (
    "sectionValidationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "sectionContentId" TEXT NOT NULL,
    "validationModelVersion" TEXT NOT NULL,
    "editorialScore" INTEGER NOT NULL,
    "blockingIssues" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "claimClassifications" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpSectionValidation_pkey" PRIMARY KEY ("sectionValidationId")
);

-- CreateTable
CREATE TABLE "GmpGenerationLineage" (
    "generationLineageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "sectionContentId" TEXT,
    "pageVersion" INTEGER NOT NULL,
    "pageBriefId" TEXT NOT NULL,
    "pageBriefVersion" INTEGER NOT NULL,
    "contentPlanId" TEXT NOT NULL,
    "contentPlanVersion" INTEGER NOT NULL,
    "pageSectionId" TEXT,
    "pageSectionStableKey" TEXT,
    "knowledgeWorkspaceId" TEXT NOT NULL,
    "knowledgeWorkspaceVersion" INTEGER NOT NULL,
    "knowledgeRecordVersions" JSONB NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "claims" JSONB NOT NULL,
    "restrictions" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "modelIdentifier" TEXT NOT NULL,
    "promptAdapterVersion" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "generationRequestId" TEXT NOT NULL,
    "gopExecutionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpGenerationLineage_pkey" PRIMARY KEY ("generationLineageId")
);

-- CreateTable
CREATE TABLE "GmpContentAssembly" (
    "contentAssemblyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "contentDraftId" TEXT NOT NULL,
    "assemblyType" TEXT NOT NULL,
    "assembledDocument" JSONB NOT NULL,
    "validationSummary" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpContentAssembly_pkey" PRIMARY KEY ("contentAssemblyId")
);

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

-- CreateTable
CREATE TABLE "GmpAnalyticsSource" (
    "analyticsSourceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceStatus" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL,
    "collectionMode" TEXT NOT NULL,
    "providerReference" TEXT,
    "credentialsReference" TEXT,
    "configuration" JSONB,
    "metadata" JSONB,
    "lastHealthCheckAt" TIMESTAMP(3),
    "lastCollectionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpAnalyticsSource_pkey" PRIMARY KEY ("analyticsSourceId")
);

-- CreateTable
CREATE TABLE "GmpAnalyticsSourceCapability" (
    "analyticsSourceCapabilityId" TEXT NOT NULL,
    "analyticsSourceId" TEXT NOT NULL,
    "capabilityKey" TEXT NOT NULL,
    "supported" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpAnalyticsSourceCapability_pkey" PRIMARY KEY ("analyticsSourceCapabilityId")
);

-- CreateTable
CREATE TABLE "GmpAnalyticsCollection" (
    "analyticsCollectionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "analyticsSourceId" TEXT NOT NULL,
    "siteId" TEXT,
    "collectionStatus" TEXT NOT NULL,
    "requestedPeriodStart" TIMESTAMP(3),
    "requestedPeriodEnd" TIMESTAMP(3),
    "requestedDimensions" JSONB NOT NULL,
    "requestedMetrics" JSONB NOT NULL,
    "collectionMode" TEXT NOT NULL,
    "gopExecutionId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "parentCollectionId" TEXT,
    "sourceCursor" JSONB,
    "nextCursor" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "adapterKey" TEXT NOT NULL,
    "adapterVersion" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "collectionWindowStart" TIMESTAMP(3),
    "collectionWindowEnd" TIMESTAMP(3),
    "eligibilityVersion" TEXT NOT NULL,
    "errorCategory" TEXT,
    "errorSummary" TEXT,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedObservationCount" INTEGER NOT NULL DEFAULT 0,
    "partialFailureCount" INTEGER NOT NULL DEFAULT 0,
    "forcedRecollection" BOOLEAN NOT NULL DEFAULT false,
    "blockingIssues" JSONB NOT NULL,
    "warnings" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpAnalyticsCollection_pkey" PRIMARY KEY ("analyticsCollectionId")
);

-- CreateTable
CREATE TABLE "GmpAnalyticsObservation" (
    "analyticsObservationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "analyticsSourceId" TEXT NOT NULL,
    "analyticsCollectionId" TEXT NOT NULL,
    "sourceRecordIdentity" TEXT NOT NULL,
    "observationType" TEXT NOT NULL,
    "sourceTimestamp" TIMESTAMP(3) NOT NULL,
    "observationPeriodStart" TIMESTAMP(3),
    "observationPeriodEnd" TIMESTAMP(3),
    "dimensions" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "rawPayloadChecksum" TEXT NOT NULL,
    "rawPayload" JSONB,
    "rawPayloadReference" JSONB,
    "providerBatchId" TEXT,
    "providerCursor" JSONB,
    "collectionExecutionId" TEXT,
    "dataQualityStatus" TEXT NOT NULL,
    "diagnosticSummary" TEXT,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededByObservationId" TEXT,
    "correctedFromObservationId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "observationKey" TEXT NOT NULL,
    "dimensionKey" TEXT,
    "rawValue" DECIMAL(20,6) NOT NULL,
    "unit" TEXT NOT NULL,
    "confidenceScore" DECIMAL(5,4),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpAnalyticsObservation_pkey" PRIMARY KEY ("analyticsObservationId")
);

-- CreateTable
CREATE TABLE "GmpAnalyticsCollectionEvent" (
    "analyticsCollectionEventId" TEXT NOT NULL,
    "analyticsCollectionId" TEXT NOT NULL,
    "parentCollectionId" TEXT,
    "retryOfCollectionId" TEXT,
    "gopExecutionId" TEXT,
    "eventType" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorId" TEXT,
    "attemptNumber" INTEGER,
    "batchNumber" INTEGER,
    "pageNumber" INTEGER,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedObservationCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "cursorSummary" JSONB,
    "errorCategory" TEXT,
    "safeOutcomeSummary" TEXT,
    "outcomeSummary" TEXT,
    "safeDiagnostic" TEXT,
    "evidenceReferences" JSONB,
    "timelineContractVersion" TEXT,
    "eventVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpAnalyticsCollectionEvent_pkey" PRIMARY KEY ("analyticsCollectionEventId")
);

-- CreateTable
CREATE TABLE "GmpMetricDefinition" (
    "metricDefinitionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "aggregationMethod" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "precisionScale" INTEGER NOT NULL DEFAULT 2,
    "defaultMetric" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpMetricDefinition_pkey" PRIMARY KEY ("metricDefinitionId")
);

-- CreateTable
CREATE TABLE "GmpNormalizedMetric" (
    "normalizedMetricId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "analyticsSourceId" TEXT NOT NULL,
    "analyticsCollectionId" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "analyticsObservationId" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "normalizedValue" DECIMAL(20,6) NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpNormalizedMetric_pkey" PRIMARY KEY ("normalizedMetricId")
);

-- CreateTable
CREATE TABLE "GmpPerformanceSnapshot" (
    "performanceSnapshotId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "snapshotStatus" TEXT NOT NULL,
    "snapshotLabel" TEXT NOT NULL,
    "snapshotWindowStart" TIMESTAMP(3) NOT NULL,
    "snapshotWindowEnd" TIMESTAMP(3) NOT NULL,
    "totalMetrics" INTEGER NOT NULL DEFAULT 0,
    "baselineScore" DECIMAL(12,4),
    "trendDelta" DECIMAL(12,4),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpPerformanceSnapshot_pkey" PRIMARY KEY ("performanceSnapshotId")
);

-- CreateTable
CREATE TABLE "GmpMeasurementLineage" (
    "measurementLineageId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "analyticsSourceId" TEXT NOT NULL,
    "analyticsCollectionId" TEXT,
    "analyticsObservationId" TEXT,
    "normalizedMetricId" TEXT,
    "performanceSnapshotId" TEXT,
    "lineageStage" TEXT NOT NULL,
    "evidenceCompilerVersion" TEXT NOT NULL,
    "lineageFingerprint" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpMeasurementLineage_pkey" PRIMARY KEY ("measurementLineageId")
);

-- CreateTable
CREATE TABLE "GmpEvidenceCompilerVersion" (
    "evidenceCompilerVersionId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "compilerName" TEXT NOT NULL,
    "compilerVersion" TEXT NOT NULL,
    "normalizationVersion" TEXT,
    "metricCatalogVersion" TEXT,
    "correlationVersion" TEXT,
    "snapshotVersion" TEXT,
    "validationVersion" TEXT,
    "releasedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpEvidenceCompilerVersion_pkey" PRIMARY KEY ("evidenceCompilerVersionId")
);

-- CreateTable
CREATE TABLE "GmpEvidenceCompilerRun" (
    "evidenceCompilerRunId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "replayOfRunId" TEXT,
    "runStatus" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "compilerVersion" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "metricCatalogVersion" TEXT NOT NULL,
    "correlationVersion" TEXT NOT NULL,
    "snapshotVersion" TEXT NOT NULL,
    "validationVersion" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "outputChecksum" TEXT,
    "evidenceSnapshotId" TEXT,
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedObservationCount" INTEGER NOT NULL DEFAULT 0,
    "compiledMetricCount" INTEGER NOT NULL DEFAULT 0,
    "publicationReferenceCount" INTEGER NOT NULL DEFAULT 0,
    "qualityStatus" TEXT NOT NULL,
    "confidenceStatus" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpEvidenceCompilerRun_pkey" PRIMARY KEY ("evidenceCompilerRunId")
);

-- CreateTable
CREATE TABLE "GmpEvidenceSnapshot" (
    "evidenceSnapshotId" TEXT NOT NULL,
    "performanceSnapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "cadence" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "compilerVersion" TEXT NOT NULL,
    "normalizationVersion" TEXT NOT NULL,
    "metricCatalogVersion" TEXT NOT NULL,
    "correlationVersion" TEXT NOT NULL,
    "snapshotVersion" TEXT NOT NULL,
    "validationVersion" TEXT NOT NULL,
    "dataQualityStatus" TEXT NOT NULL,
    "evidenceConfidence" TEXT NOT NULL,
    "snapshotChecksum" TEXT NOT NULL,
    "sourceObservationCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedObservationCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpEvidenceSnapshot_pkey" PRIMARY KEY ("evidenceSnapshotId")
);

-- CreateTable
CREATE TABLE "GmpEvidenceCompiledMetric" (
    "evidenceCompiledMetricId" TEXT NOT NULL,
    "evidenceSnapshotId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "metricDefinitionId" TEXT,
    "canonicalMetricKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "aggregationMethod" TEXT NOT NULL,
    "precisionScale" INTEGER NOT NULL DEFAULT 4,
    "compiledValue" DECIMAL(20,6) NOT NULL,
    "dataQualityStatus" TEXT NOT NULL,
    "evidenceConfidence" TEXT NOT NULL,
    "compilerVersion" TEXT NOT NULL,
    "sourceObservationIds" JSONB NOT NULL,
    "lineageFingerprint" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpEvidenceCompiledMetric_pkey" PRIMARY KEY ("evidenceCompiledMetricId")
);

-- CreateTable
CREATE TABLE "GmpEvidencePublicationReference" (
    "evidencePublicationReferenceId" TEXT NOT NULL,
    "evidenceSnapshotId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "publicationRecordId" TEXT,
    "publicationIdentity" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "publicationStatus" TEXT NOT NULL,
    "publicationTimestamp" TIMESTAMP(3),
    "correlationQuality" TEXT NOT NULL,
    "matchedObservationIds" JSONB NOT NULL,
    "lineageFingerprint" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpEvidencePublicationReference_pkey" PRIMARY KEY ("evidencePublicationReferenceId")
);

-- CreateTable
CREATE TABLE "GmpAnalyticsAttributionRegistry" (
    "attributionRegistryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "registryStatus" TEXT NOT NULL,
    "registryVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpAnalyticsAttributionRegistry_pkey" PRIMARY KEY ("attributionRegistryId")
);

-- CreateTable
CREATE TABLE "GmpAnalyticsRecommendationRegistry" (
    "recommendationRegistryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "registryStatus" TEXT NOT NULL,
    "registryVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpAnalyticsRecommendationRegistry_pkey" PRIMARY KEY ("recommendationRegistryId")
);

-- CreateTable
CREATE TABLE "GmpAttributionAnalysis" (
    "attributionAnalysisId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "evidenceSnapshotId" TEXT NOT NULL,
    "attributionVersion" TEXT NOT NULL,
    "attributionWindowDays" INTEGER NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "outputChecksum" TEXT NOT NULL,
    "sourceMetricCount" INTEGER NOT NULL DEFAULT 0,
    "sourcePublicationCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpAttributionAnalysis_pkey" PRIMARY KEY ("attributionAnalysisId")
);

-- CreateTable
CREATE TABLE "GmpAttributionResult" (
    "attributionResultId" TEXT NOT NULL,
    "attributionAnalysisId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "evidenceSnapshotId" TEXT NOT NULL,
    "dimensionType" TEXT NOT NULL,
    "dimensionValue" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "attributedValue" DECIMAL(20,6) NOT NULL,
    "confidence" TEXT NOT NULL,
    "lineageFingerprint" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpAttributionResult_pkey" PRIMARY KEY ("attributionResultId")
);

-- CreateTable
CREATE TABLE "GmpRecommendationRuleCatalogEntry" (
    "recommendationRuleCatalogEntryId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "registryVersion" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "inputs" JSONB NOT NULL,
    "thresholds" JSONB NOT NULL,
    "outputSchema" JSONB NOT NULL,
    "severityMapping" JSONB NOT NULL,
    "priorityMapping" JSONB NOT NULL,
    "replayCompatible" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpRecommendationRuleCatalogEntry_pkey" PRIMARY KEY ("recommendationRuleCatalogEntryId")
);

-- CreateTable
CREATE TABLE "GmpRecommendationRun" (
    "recommendationRunId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "evidenceSnapshotId" TEXT NOT NULL,
    "attributionAnalysisId" TEXT NOT NULL,
    "replayOfRunId" TEXT,
    "triggerType" TEXT NOT NULL,
    "runStatus" TEXT NOT NULL,
    "recommendationEngineVersion" TEXT NOT NULL,
    "ruleCatalogVersion" TEXT NOT NULL,
    "attributionVersion" TEXT NOT NULL,
    "decisionSupportVersion" TEXT NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "outputChecksum" TEXT,
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpRecommendationRun_pkey" PRIMARY KEY ("recommendationRunId")
);

-- CreateTable
CREATE TABLE "GmpRecommendationRuleExecution" (
    "recommendationRuleExecutionId" TEXT NOT NULL,
    "recommendationRunId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "evidenceSnapshotId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "producedCount" INTEGER NOT NULL DEFAULT 0,
    "executionChecksum" TEXT NOT NULL,
    "diagnostics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpRecommendationRuleExecution_pkey" PRIMARY KEY ("recommendationRuleExecutionId")
);

-- CreateTable
CREATE TABLE "GmpRecommendationRecord" (
    "recommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "recommendationRunId" TEXT NOT NULL,
    "evidenceSnapshotId" TEXT NOT NULL,
    "attributionAnalysisId" TEXT NOT NULL,
    "recommendationVersion" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "evidenceCompilerVersion" TEXT NOT NULL,
    "snapshotVersion" TEXT NOT NULL,
    "attributionVersion" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "supportingEvidence" JSONB NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "lineageFingerprint" TEXT NOT NULL,
    "immutablePayloadChecksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpRecommendationRecord_pkey" PRIMARY KEY ("recommendationId")
);

-- CreateTable
CREATE TABLE "GmpRecommendationLifecycleEvent" (
    "recommendationLifecycleEventId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpRecommendationLifecycleEvent_pkey" PRIMARY KEY ("recommendationLifecycleEventId")
);

-- CreateTable
CREATE TABLE "GmpRecommendationReplayRun" (
    "recommendationReplayRunId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "evidenceSnapshotId" TEXT NOT NULL,
    "recommendationRunId" TEXT NOT NULL,
    "ruleCatalogVersion" TEXT NOT NULL,
    "attributionVersion" TEXT NOT NULL,
    "replayChecksum" TEXT NOT NULL,
    "recommendationCount" INTEGER NOT NULL DEFAULT 0,
    "deterministicMatch" BOOLEAN,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpRecommendationReplayRun_pkey" PRIMARY KEY ("recommendationReplayRunId")
);

-- CreateTable
CREATE TABLE "GmpDecisionSupportSummary" (
    "decisionSupportSummaryId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "evidenceSnapshotId" TEXT NOT NULL,
    "recommendationRunId" TEXT,
    "summaryType" TEXT NOT NULL,
    "summaryKey" TEXT NOT NULL,
    "summaryValue" JSONB NOT NULL,
    "summaryChecksum" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpDecisionSupportSummary_pkey" PRIMARY KEY ("decisionSupportSummaryId")
);

-- CreateTable
CREATE TABLE "GeaAgent" (
    "agentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lifecycleState" TEXT NOT NULL,
    "identity" JSONB NOT NULL,
    "capabilities" JSONB NOT NULL,
    "permissions" JSONB NOT NULL,
    "currentVersion" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaAgent_pkey" PRIMARY KEY ("agentId")
);

-- CreateTable
CREATE TABLE "GeaAgentPlan" (
    "planId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "planVersion" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableAfterStart" BOOLEAN NOT NULL DEFAULT true,
    "tasks" JSONB NOT NULL,
    "dependencyChecksum" TEXT NOT NULL,

    CONSTRAINT "GeaAgentPlan_pkey" PRIMARY KEY ("planId")
);

-- CreateTable
CREATE TABLE "GeaAgentExecution" (
    "executionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "state" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planVersion" TEXT NOT NULL,
    "capabilityVersions" JSONB NOT NULL,
    "toolVersions" JSONB NOT NULL,
    "permissionEvaluations" JSONB NOT NULL,
    "timeline" JSONB NOT NULL,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "resultId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaAgentExecution_pkey" PRIMARY KEY ("executionId")
);

-- CreateTable
CREATE TABLE "GeaAgentAction" (
    "actionId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "toolVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaAgentAction_pkey" PRIMARY KEY ("actionId")
);

-- CreateTable
CREATE TABLE "GeaAgentResult" (
    "resultId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "outputs" JSONB NOT NULL,
    "producedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaAgentResult_pkey" PRIMARY KEY ("resultId")
);

-- CreateTable
CREATE TABLE "GeaAgentAuditRecord" (
    "auditRecordId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaAgentAuditRecord_pkey" PRIMARY KEY ("auditRecordId")
);

-- CreateTable
CREATE TABLE "GeaAgentReplay" (
    "replayId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "replayOfExecutionId" TEXT NOT NULL,
    "deterministicMatch" BOOLEAN NOT NULL,
    "replayChecksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaAgentReplay_pkey" PRIMARY KEY ("replayId")
);

-- CreateTable
CREATE TABLE "GeaAgentMemoryReference" (
    "memoryReferenceId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaAgentMemoryReference_pkey" PRIMARY KEY ("memoryReferenceId")
);

-- CreateTable
CREATE TABLE "GeaAgentApproval" (
    "approvalId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "decidedBy" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaAgentApproval_pkey" PRIMARY KEY ("approvalId")
);

-- CreateTable
CREATE TABLE "GeaToolDefinition" (
    "toolId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "toolKey" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "activeVersionTag" TEXT NOT NULL,
    "versions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaToolDefinition_pkey" PRIMARY KEY ("toolId")
);

-- CreateTable
CREATE TABLE "GeaToolExecution" (
    "executionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT,
    "organizationId" TEXT,
    "toolId" TEXT NOT NULL,
    "toolVersionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "warnings" JSONB NOT NULL,
    "error" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "authorization" JSONB NOT NULL,
    "timeline" JSONB NOT NULL,
    "immutableLineage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaToolExecution_pkey" PRIMARY KEY ("executionId")
);

-- CreateTable
CREATE TABLE "GeaToolExecutionTimeline" (
    "timelineEventId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaToolExecutionTimeline_pkey" PRIMARY KEY ("timelineEventId")
);

-- CreateTable
CREATE TABLE "GeaToolReplay" (
    "replayId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "toolVersionId" TEXT NOT NULL,
    "inputContractVersion" TEXT NOT NULL,
    "agentVersion" TEXT NOT NULL,
    "permissionEvaluation" JSONB NOT NULL,
    "runtimeVersion" TEXT NOT NULL,
    "deterministicSupported" BOOLEAN NOT NULL,
    "deterministicMatch" BOOLEAN,
    "replayChecksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaToolReplay_pkey" PRIMARY KEY ("replayId")
);

-- CreateTable
CREATE TABLE "GeaToolHealth" (
    "healthId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "toolVersionId" TEXT,
    "availability" DOUBLE PRECISION NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL,
    "failureRate" DOUBLE PRECISION NOT NULL,
    "version" TEXT NOT NULL,
    "lastSuccessfulExecution" TEXT,
    "lastFailure" TEXT,
    "healthStatus" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeaToolHealth_pkey" PRIMARY KEY ("healthId")
);

-- CreateTable
CREATE TABLE "GeaToolValidation" (
    "validationId" TEXT NOT NULL,
    "toolVersionId" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "validatedBy" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeaToolValidation_pkey" PRIMARY KEY ("validationId")
);

-- CreateTable
CREATE TABLE "GeaToolLifecycleEvent" (
    "lifecycleEventId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "previousState" TEXT,
    "nextState" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaToolLifecycleEvent_pkey" PRIMARY KEY ("lifecycleEventId")
);

-- CreateTable
CREATE TABLE "GeaToolPolicyHistory" (
    "policyRecordId" TEXT NOT NULL,
    "toolVersionId" TEXT NOT NULL,
    "previousPolicyChecksum" TEXT,
    "nextPolicyChecksum" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeaToolPolicyHistory_pkey" PRIMARY KEY ("policyRecordId")
);

-- CreateTable
CREATE TABLE "GeaMemorySource" (
    "memorySourceId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "authoritative" BOOLEAN NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaMemorySource_pkey" PRIMARY KEY ("memorySourceId")
);

-- CreateTable
CREATE TABLE "GeaMemoryReference" (
    "memoryReferenceId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "registryIdentity" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceVersion" TEXT NOT NULL,
    "source" JSONB NOT NULL,
    "memoryVersion" JSONB NOT NULL,
    "capabilityKey" TEXT,
    "permissionAction" TEXT,
    "authorityState" TEXT NOT NULL,
    "immutable" BOOLEAN NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaMemoryReference_pkey" PRIMARY KEY ("memoryReferenceId")
);

-- CreateTable
CREATE TABLE "GeaMemoryVersion" (
    "memoryVersionId" TEXT NOT NULL,
    "memoryReferenceId" TEXT NOT NULL,
    "versionTag" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaMemoryVersion_pkey" PRIMARY KEY ("memoryVersionId")
);

-- CreateTable
CREATE TABLE "GeaMemoryCollection" (
    "memoryCollectionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lifecycleState" TEXT NOT NULL,
    "memoryReferenceIds" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaMemoryCollection_pkey" PRIMARY KEY ("memoryCollectionId")
);

-- CreateTable
CREATE TABLE "GeaMemorySnapshot" (
    "memorySnapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "memoryCollectionId" TEXT,
    "memoryReferenceIds" JSONB NOT NULL,
    "snapshotChecksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaMemorySnapshot_pkey" PRIMARY KEY ("memorySnapshotId")
);

-- CreateTable
CREATE TABLE "GeaContextPackage" (
    "contextPackageId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "agentId" TEXT,
    "lifecycleState" TEXT NOT NULL,
    "contextVersion" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "dependencies" JSONB NOT NULL,
    "assembly" JSONB NOT NULL,
    "policy" JSONB NOT NULL,
    "timeline" JSONB NOT NULL,
    "packageChecksum" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "deterministic" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaContextPackage_pkey" PRIMARY KEY ("contextPackageId")
);

-- CreateTable
CREATE TABLE "GeaContextValidation" (
    "contextValidationId" TEXT NOT NULL,
    "contextPackageId" TEXT NOT NULL,
    "validationStatus" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaContextValidation_pkey" PRIMARY KEY ("contextValidationId")
);

-- CreateTable
CREATE TABLE "GeaContextReplay" (
    "contextReplayId" TEXT NOT NULL,
    "contextPackageId" TEXT NOT NULL,
    "replayChecksum" TEXT NOT NULL,
    "deterministicPossible" BOOLEAN NOT NULL,
    "deterministicMatch" BOOLEAN,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaContextReplay_pkey" PRIMARY KEY ("contextReplayId")
);

-- CreateTable
CREATE TABLE "GeaContextCache" (
    "contextCacheId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "contextPackageId" TEXT NOT NULL,
    "sourceVersionFingerprint" TEXT NOT NULL,
    "cacheStatus" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL,
    "lastHitAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaContextCache_pkey" PRIMARY KEY ("contextCacheId")
);

-- CreateTable
CREATE TABLE "GeaContextHealth" (
    "contextHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assemblyLatencyMs" INTEGER NOT NULL,
    "cacheUtilization" DOUBLE PRECISION NOT NULL,
    "validationFailures" INTEGER NOT NULL,
    "authorizationFailures" INTEGER NOT NULL,
    "missingReferences" INTEGER NOT NULL,
    "staleReferences" INTEGER NOT NULL,
    "versionDrift" INTEGER NOT NULL,
    "healthStatus" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaContextHealth_pkey" PRIMARY KEY ("contextHealthId")
);

-- CreateTable
CREATE TABLE "GeaOrchestration" (
    "orchestrationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "activeWorkflowId" TEXT NOT NULL,
    "activeWorkflowVersionId" TEXT NOT NULL,
    "versions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaOrchestration_pkey" PRIMARY KEY ("orchestrationId")
);

-- CreateTable
CREATE TABLE "GeaWorkflowDefinition" (
    "workflowId" TEXT NOT NULL,
    "orchestrationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "workflowKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "transitions" JSONB NOT NULL,
    "dependencies" JSONB NOT NULL,
    "scheduling" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaWorkflowDefinition_pkey" PRIMARY KEY ("workflowId")
);

-- CreateTable
CREATE TABLE "GeaWorkflowVersion" (
    "workflowVersionId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "versionTag" TEXT NOT NULL,
    "immutable" BOOLEAN NOT NULL,
    "definitionChecksum" TEXT NOT NULL,
    "publishedBy" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaWorkflowVersion_pkey" PRIMARY KEY ("workflowVersionId")
);

-- CreateTable
CREATE TABLE "GeaOrchestrationExecution" (
    "executionId" TEXT NOT NULL,
    "orchestrationId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowVersionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "initiatedBy" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "coordinationStateByStep" JSONB NOT NULL,
    "contextPackageId" TEXT,
    "toolExecutionIds" JSONB NOT NULL,
    "delegations" JSONB NOT NULL,
    "approvals" JSONB NOT NULL,
    "compensationActions" JSONB NOT NULL,
    "retryCounts" JSONB NOT NULL,
    "timeline" JSONB NOT NULL,
    "immutableLineage" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GeaOrchestrationExecution_pkey" PRIMARY KEY ("executionId")
);

-- CreateTable
CREATE TABLE "GeaOrchestrationDelegation" (
    "delegationId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "fromAgentId" TEXT NOT NULL,
    "toAgentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "delegatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaOrchestrationDelegation_pkey" PRIMARY KEY ("delegationId")
);

-- CreateTable
CREATE TABLE "GeaOrchestrationApproval" (
    "approvalCheckpointId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "requiredApprovers" JSONB NOT NULL,
    "approvedBy" JSONB NOT NULL,
    "timeoutAt" TIMESTAMP(3),
    "escalationPolicy" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaOrchestrationApproval_pkey" PRIMARY KEY ("approvalCheckpointId")
);

-- CreateTable
CREATE TABLE "GeaOrchestrationCompensation" (
    "compensationActionId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "reversible" BOOLEAN NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaOrchestrationCompensation_pkey" PRIMARY KEY ("compensationActionId")
);

-- CreateTable
CREATE TABLE "GeaOrchestrationSnapshot" (
    "snapshotId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "state" TEXT NOT NULL,
    "coordinationStateByStep" JSONB NOT NULL,
    "approvals" JSONB NOT NULL,
    "retries" JSONB NOT NULL,
    "pendingSteps" JSONB NOT NULL,
    "completedSteps" JSONB NOT NULL,
    "failedSteps" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaOrchestrationSnapshot_pkey" PRIMARY KEY ("snapshotId")
);

-- CreateTable
CREATE TABLE "GeaOrchestrationReplay" (
    "replayRecordId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "replayChecksum" TEXT NOT NULL,
    "determinism" TEXT NOT NULL,
    "nonDeterministicDependencies" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeaOrchestrationReplay_pkey" PRIMARY KEY ("replayRecordId")
);

-- CreateTable
CREATE TABLE "GeaOrchestrationHealth" (
    "healthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "activeExecutions" INTEGER NOT NULL,
    "pausedExecutions" INTEGER NOT NULL,
    "approvalBacklog" INTEGER NOT NULL,
    "failureRate" DOUBLE PRECISION NOT NULL,
    "replayDriftRate" DOUBLE PRECISION NOT NULL,
    "queueDepth" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "GeaOrchestrationHealth_pkey" PRIMARY KEY ("healthId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveBriefing" (
    "briefingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "executiveSummary" TEXT NOT NULL,
    "criticalAlerts" JSONB NOT NULL,
    "topOpportunities" JSONB NOT NULL,
    "topRisks" JSONB NOT NULL,
    "completedGoals" JSONB NOT NULL,
    "behindScheduleGoals" JSONB NOT NULL,
    "operationalHighlights" JSONB NOT NULL,
    "financialHighlights" JSONB NOT NULL,
    "marketingHighlights" JSONB NOT NULL,
    "manufacturingHighlights" JSONB NOT NULL,
    "salesHighlights" JSONB NOT NULL,
    "supportHighlights" JSONB NOT NULL,
    "recommendedExecutiveActions" JSONB NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "contextPackageId" TEXT,
    "replayChecksum" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaExecutiveBriefing_pkey" PRIMARY KEY ("briefingId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveGoal" (
    "goalId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentGoalId" TEXT,
    "level" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "keyResults" JSONB NOT NULL,
    "milestones" JSONB NOT NULL,
    "dependencies" JSONB NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "progressPercent" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbaExecutiveGoal_pkey" PRIMARY KEY ("goalId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveGoalHistory" (
    "goalHistoryId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "progressPercent" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaExecutiveGoalHistory_pkey" PRIMARY KEY ("goalHistoryId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveKpi" (
    "kpiId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "thresholdGreen" DOUBLE PRECISION NOT NULL,
    "thresholdYellow" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "versionTag" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbaExecutiveKpi_pkey" PRIMARY KEY ("kpiId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveKpiHistory" (
    "kpiHistoryId" TEXT NOT NULL,
    "kpiId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "measuredValue" DOUBLE PRECISION NOT NULL,
    "trend" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaExecutiveKpiHistory_pkey" PRIMARY KEY ("kpiHistoryId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveRecommendation" (
    "recommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "businessImpact" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "requiredApprovals" JSONB NOT NULL,
    "suggestedOwner" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "deterministicChecksum" TEXT NOT NULL,
    "reviewed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaExecutiveRecommendation_pkey" PRIMARY KEY ("recommendationId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveRecommendationReview" (
    "recommendationReviewId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaExecutiveRecommendationReview_pkey" PRIMARY KEY ("recommendationReviewId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveRisk" (
    "riskId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "probability" INTEGER NOT NULL,
    "impact" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "mitigation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbaExecutiveRisk_pkey" PRIMARY KEY ("riskId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveRiskHistory" (
    "riskHistoryId" TEXT NOT NULL,
    "riskId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reviewNote" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaExecutiveRiskHistory_pkey" PRIMARY KEY ("riskHistoryId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveOpportunity" (
    "opportunityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "projectedImpact" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbaExecutiveOpportunity_pkey" PRIMARY KEY ("opportunityId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveOpportunityHistory" (
    "opportunityHistoryId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaExecutiveOpportunityHistory_pkey" PRIMARY KEY ("opportunityHistoryId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveDelegation" (
    "delegationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "targetAgent" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "orchestrationExecutionId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaExecutiveDelegation_pkey" PRIMARY KEY ("delegationId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveApproval" (
    "approvalId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "requiredApprovers" JSONB NOT NULL,
    "approvedBy" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbaExecutiveApproval_pkey" PRIMARY KEY ("approvalId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveTimelineEvent" (
    "timelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbaExecutiveTimelineEvent_pkey" PRIMARY KEY ("timelineEventId")
);

-- CreateTable
CREATE TABLE "GbaExecutiveHealth" (
    "healthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "criticalRiskCount" INTEGER NOT NULL,
    "behindGoalCount" INTEGER NOT NULL,
    "openRecommendationCount" INTEGER NOT NULL,
    "pendingApprovalCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaExecutiveHealth_pkey" PRIMARY KEY ("healthId")
);

-- CreateTable
CREATE TABLE "GbaOperationsWorkOrder" (
    "workOrderId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dependencies" JSONB NOT NULL,
    "assignedResources" JSONB NOT NULL,
    "estimatedLaborHours" DOUBLE PRECISION NOT NULL,
    "actualLaborHours" DOUBLE PRECISION NOT NULL,
    "completionPercent" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsWorkOrder_pkey" PRIMARY KEY ("workOrderId")
);

-- CreateTable
CREATE TABLE "GbaOperationsWorkOrderHistory" (
    "workOrderHistoryId" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsWorkOrderHistory_pkey" PRIMARY KEY ("workOrderHistoryId")
);

-- CreateTable
CREATE TABLE "GbaOperationsProductionSchedule" (
    "scheduleId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "queueName" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "shiftCode" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "plannedStartAt" TIMESTAMP(3) NOT NULL,
    "plannedEndAt" TIMESTAMP(3) NOT NULL,
    "plannedLaborHours" DOUBLE PRECISION NOT NULL,
    "plannedUnits" INTEGER NOT NULL,
    "bottleneckRisk" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsProductionSchedule_pkey" PRIMARY KEY ("scheduleId")
);

-- CreateTable
CREATE TABLE "GbaOperationsInventoryRecord" (
    "inventoryRecordId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "onHandQuantity" INTEGER NOT NULL,
    "allocatedQuantity" INTEGER NOT NULL,
    "availableQuantity" INTEGER NOT NULL,
    "safetyStock" INTEGER NOT NULL,
    "reorderPoint" INTEGER NOT NULL,
    "lotTrackingEnabled" BOOLEAN NOT NULL,
    "serialTrackingEnabled" BOOLEAN NOT NULL,
    "valuationAmount" DOUBLE PRECISION NOT NULL,
    "agingDays" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsInventoryRecord_pkey" PRIMARY KEY ("inventoryRecordId")
);

-- CreateTable
CREATE TABLE "GbaOperationsInventoryHistory" (
    "inventoryHistoryId" TEXT NOT NULL,
    "inventoryRecordId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "quantityDelta" INTEGER NOT NULL,
    "resultingOnHand" INTEGER NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsInventoryHistory_pkey" PRIMARY KEY ("inventoryHistoryId")
);

-- CreateTable
CREATE TABLE "GbaOperationsWarehouseOperation" (
    "warehouseOperationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "utilizationPercent" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsWarehouseOperation_pkey" PRIMARY KEY ("warehouseOperationId")
);

-- CreateTable
CREATE TABLE "GbaOperationsWarehouseHistory" (
    "warehouseHistoryId" TEXT NOT NULL,
    "warehouseOperationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsWarehouseHistory_pkey" PRIMARY KEY ("warehouseHistoryId")
);

-- CreateTable
CREATE TABLE "GbaOperationsPurchasingRecord" (
    "purchasingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "purchaseOrderNumber" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL,
    "deliveryDueDate" TIMESTAMP(3) NOT NULL,
    "totalCostAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsPurchasingRecord_pkey" PRIMARY KEY ("purchasingId")
);

-- CreateTable
CREATE TABLE "GbaOperationsPurchasingHistory" (
    "purchasingHistoryId" TEXT NOT NULL,
    "purchasingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsPurchasingHistory_pkey" PRIMARY KEY ("purchasingHistoryId")
);

-- CreateTable
CREATE TABLE "GbaOperationsShippingRecord" (
    "shippingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shipmentType" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "trackingNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "freightCostAmount" DOUBLE PRECISION NOT NULL,
    "damageClaimOpen" BOOLEAN NOT NULL,
    "estimatedDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsShippingRecord_pkey" PRIMARY KEY ("shippingId")
);

-- CreateTable
CREATE TABLE "GbaOperationsShippingHistory" (
    "shippingHistoryId" TEXT NOT NULL,
    "shippingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsShippingHistory_pkey" PRIMARY KEY ("shippingHistoryId")
);

-- CreateTable
CREATE TABLE "GbaOperationsCapacityRecord" (
    "capacityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "machineUtilizationPercent" DOUBLE PRECISION NOT NULL,
    "laborUtilizationPercent" DOUBLE PRECISION NOT NULL,
    "productionCapacityUnits" INTEGER NOT NULL,
    "availableHours" DOUBLE PRECISION NOT NULL,
    "constrainedHours" DOUBLE PRECISION NOT NULL,
    "forecastDemandUnits" INTEGER NOT NULL,
    "bottleneckSummary" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsCapacityRecord_pkey" PRIMARY KEY ("capacityId")
);

-- CreateTable
CREATE TABLE "GbaOperationsCapacityHistory" (
    "capacityHistoryId" TEXT NOT NULL,
    "capacityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "machineUtilizationPercent" DOUBLE PRECISION NOT NULL,
    "laborUtilizationPercent" DOUBLE PRECISION NOT NULL,
    "productionCapacityUnits" INTEGER NOT NULL,
    "availableHours" DOUBLE PRECISION NOT NULL,
    "constrainedHours" DOUBLE PRECISION NOT NULL,
    "forecastDemandUnits" INTEGER NOT NULL,
    "bottleneckSummary" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsCapacityHistory_pkey" PRIMARY KEY ("capacityHistoryId")
);

-- CreateTable
CREATE TABLE "GbaOperationsKpi" (
    "operationsKpiId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "versionTag" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbaOperationsKpi_pkey" PRIMARY KEY ("operationsKpiId")
);

-- CreateTable
CREATE TABLE "GbaOperationsKpiHistory" (
    "operationsKpiHistoryId" TEXT NOT NULL,
    "operationsKpiId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "measuredValue" DOUBLE PRECISION NOT NULL,
    "trend" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsKpiHistory_pkey" PRIMARY KEY ("operationsKpiHistoryId")
);

-- CreateTable
CREATE TABLE "GbaOperationsRecommendation" (
    "operationsRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "businessImpact" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "suggestedOwner" TEXT NOT NULL,
    "requiredApprovals" JSONB NOT NULL,
    "deterministicChecksum" TEXT NOT NULL,
    "reviewed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsRecommendation_pkey" PRIMARY KEY ("operationsRecommendationId")
);

-- CreateTable
CREATE TABLE "GbaOperationsRecommendationReview" (
    "operationsRecommendationReviewId" TEXT NOT NULL,
    "operationsRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsRecommendationReview_pkey" PRIMARY KEY ("operationsRecommendationReviewId")
);

-- CreateTable
CREATE TABLE "GbaOperationsVendorMetric" (
    "vendorMetricId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "onTimeDeliveryRate" DOUBLE PRECISION NOT NULL,
    "qualityAcceptanceRate" DOUBLE PRECISION NOT NULL,
    "averageLeadTimeDays" DOUBLE PRECISION NOT NULL,
    "costVariancePercent" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsVendorMetric_pkey" PRIMARY KEY ("vendorMetricId")
);

-- CreateTable
CREATE TABLE "GbaOperationsVendorMetricHistory" (
    "vendorMetricHistoryId" TEXT NOT NULL,
    "vendorMetricId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "onTimeDeliveryRate" DOUBLE PRECISION NOT NULL,
    "qualityAcceptanceRate" DOUBLE PRECISION NOT NULL,
    "averageLeadTimeDays" DOUBLE PRECISION NOT NULL,
    "costVariancePercent" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsVendorMetricHistory_pkey" PRIMARY KEY ("vendorMetricHistoryId")
);

-- CreateTable
CREATE TABLE "GbaOperationsTimelineEvent" (
    "operationsTimelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbaOperationsTimelineEvent_pkey" PRIMARY KEY ("operationsTimelineEventId")
);

-- CreateTable
CREATE TABLE "GbaOperationsHealth" (
    "operationsHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "blockedWorkOrderCount" INTEGER NOT NULL,
    "lowStockSkuCount" INTEGER NOT NULL,
    "delayedShipmentCount" INTEGER NOT NULL,
    "overCapacitySignalCount" INTEGER NOT NULL,
    "unreviewedRecommendationCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsHealth_pkey" PRIMARY KEY ("operationsHealthId")
);

-- CreateTable
CREATE TABLE "GbaOperationsExecutiveSummary" (
    "summaryId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "kpiRollups" JSONB NOT NULL,
    "exceptions" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "opportunities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaOperationsExecutiveSummary_pkey" PRIMARY KEY ("summaryId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingBom" (
    "bomId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "components" JSONB NOT NULL,
    "approvedSubstitutions" JSONB NOT NULL,
    "costRollup" DOUBLE PRECISION NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingBom_pkey" PRIMARY KEY ("bomId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingBomHistory" (
    "bomHistoryId" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingBomHistory_pkey" PRIMARY KEY ("bomHistoryId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingRouting" (
    "routingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "workCenter" TEXT NOT NULL,
    "machineAssignments" JSONB NOT NULL,
    "processSteps" JSONB NOT NULL,
    "laborRequirements" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingRouting_pkey" PRIMARY KEY ("routingId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingRoutingHistory" (
    "routingHistoryId" TEXT NOT NULL,
    "routingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "revision" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingRoutingHistory_pkey" PRIMARY KEY ("routingHistoryId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingProductionOrder" (
    "productionOrderId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "operationsWorkOrderId" TEXT,
    "title" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "bomRevision" TEXT NOT NULL,
    "routingRevision" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "quantityPlanned" INTEGER NOT NULL,
    "quantityCompleted" INTEGER NOT NULL,
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "scheduledEndAt" TIMESTAMP(3) NOT NULL,
    "materialAllocations" JSONB NOT NULL,
    "laborAssignments" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingProductionOrder_pkey" PRIMARY KEY ("productionOrderId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingProductionOrderHistory" (
    "productionOrderHistoryId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingProductionOrderHistory_pkey" PRIMARY KEY ("productionOrderHistoryId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingMachine" (
    "machineId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "machineType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "runtimeMinutes" INTEGER NOT NULL,
    "downtimeMinutes" INTEGER NOT NULL,
    "plannedMaintenanceMinutes" INTEGER NOT NULL,
    "unplannedFailureCount" INTEGER NOT NULL,
    "availabilityPercent" DOUBLE PRECISION NOT NULL,
    "performancePercent" DOUBLE PRECISION NOT NULL,
    "qualityPercent" DOUBLE PRECISION NOT NULL,
    "utilizationPercent" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingMachine_pkey" PRIMARY KEY ("machineId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingMachineHistory" (
    "machineHistoryId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingMachineHistory_pkey" PRIMARY KEY ("machineHistoryId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingLabor" (
    "laborRecordId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "certifications" JSONB NOT NULL,
    "skills" JSONB NOT NULL,
    "shift" TEXT NOT NULL,
    "utilizationPercent" DOUBLE PRECISION NOT NULL,
    "overtimeHours" DOUBLE PRECISION NOT NULL,
    "laborEfficiencyPercent" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingLabor_pkey" PRIMARY KEY ("laborRecordId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingLaborHistory" (
    "laborHistoryId" TEXT NOT NULL,
    "laborRecordId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shift" TEXT NOT NULL,
    "utilizationPercent" DOUBLE PRECISION NOT NULL,
    "overtimeHours" DOUBLE PRECISION NOT NULL,
    "laborEfficiencyPercent" DOUBLE PRECISION NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingLaborHistory_pkey" PRIMARY KEY ("laborHistoryId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingMaterialConsumption" (
    "materialConsumptionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "rawMaterialUsed" DOUBLE PRECISION NOT NULL,
    "componentConsumed" DOUBLE PRECISION NOT NULL,
    "yieldPercent" DOUBLE PRECISION NOT NULL,
    "wasteQuantity" DOUBLE PRECISION NOT NULL,
    "scrapQuantity" DOUBLE PRECISION NOT NULL,
    "reworkMaterialQuantity" DOUBLE PRECISION NOT NULL,
    "variancePercent" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingMaterialConsumption_pkey" PRIMARY KEY ("materialConsumptionId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingQualityEvent" (
    "qualityEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "defectCategory" TEXT NOT NULL,
    "rootCauseReference" TEXT,
    "firstPassYieldPercent" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingQualityEvent_pkey" PRIMARY KEY ("qualityEventId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingCostRecord" (
    "manufacturingCostId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "costingVersion" TEXT NOT NULL,
    "materialCost" DOUBLE PRECISION NOT NULL,
    "laborCost" DOUBLE PRECISION NOT NULL,
    "machineCost" DOUBLE PRECISION NOT NULL,
    "overheadCost" DOUBLE PRECISION NOT NULL,
    "burdenCost" DOUBLE PRECISION NOT NULL,
    "totalManufacturingCost" DOUBLE PRECISION NOT NULL,
    "costVariance" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingCostRecord_pkey" PRIMARY KEY ("manufacturingCostId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingKpi" (
    "manufacturingKpiId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "versionTag" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbaManufacturingKpi_pkey" PRIMARY KEY ("manufacturingKpiId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingKpiHistory" (
    "manufacturingKpiHistoryId" TEXT NOT NULL,
    "manufacturingKpiId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "measuredValue" DOUBLE PRECISION NOT NULL,
    "trend" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingKpiHistory_pkey" PRIMARY KEY ("manufacturingKpiHistoryId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingRecommendation" (
    "manufacturingRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "confidence" TEXT NOT NULL,
    "businessImpact" TEXT NOT NULL,
    "estimatedSavings" DOUBLE PRECISION NOT NULL,
    "suggestedOwner" TEXT NOT NULL,
    "requiredApprovals" JSONB NOT NULL,
    "priority" TEXT NOT NULL,
    "deterministicChecksum" TEXT NOT NULL,
    "reviewed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingRecommendation_pkey" PRIMARY KEY ("manufacturingRecommendationId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingRecommendationReview" (
    "manufacturingRecommendationReviewId" TEXT NOT NULL,
    "manufacturingRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingRecommendationReview_pkey" PRIMARY KEY ("manufacturingRecommendationReviewId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingOperationsSignal" (
    "operationsSignalId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productionCompletionPercent" INTEGER NOT NULL,
    "capacityUtilizationPercent" INTEGER NOT NULL,
    "materialShortageCount" INTEGER NOT NULL,
    "machineHealthStatus" TEXT NOT NULL,
    "laborAvailabilityPercent" INTEGER NOT NULL,
    "qualityAlertCount" INTEGER NOT NULL,
    "kpiSummary" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingOperationsSignal_pkey" PRIMARY KEY ("operationsSignalId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingExecutiveReport" (
    "manufacturingExecutiveReportId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "productionSummary" JSONB NOT NULL,
    "capacityOutlook" JSONB NOT NULL,
    "qualitySummary" JSONB NOT NULL,
    "costSummary" JSONB NOT NULL,
    "risks" JSONB NOT NULL,
    "opportunities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingExecutiveReport_pkey" PRIMARY KEY ("manufacturingExecutiveReportId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingTimelineEvent" (
    "manufacturingTimelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GbaManufacturingTimelineEvent_pkey" PRIMARY KEY ("manufacturingTimelineEventId")
);

-- CreateTable
CREATE TABLE "GbaManufacturingHealth" (
    "manufacturingHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "blockedProductionOrders" INTEGER NOT NULL,
    "criticalQualityEvents" INTEGER NOT NULL,
    "machineDowntimeSignals" INTEGER NOT NULL,
    "materialVarianceSignals" INTEGER NOT NULL,
    "unreviewedRecommendations" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaManufacturingHealth_pkey" PRIMARY KEY ("manufacturingHealthId")
);

-- CreateTable
CREATE TABLE "GbaMarketingCampaignPlan" (
    "marketingCampaignPlanId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "campaignName" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "channelFocus" JSONB NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "budgetCents" DOUBLE PRECISION NOT NULL,
    "expectedImpressions" INTEGER NOT NULL,
    "expectedConversions" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingCampaignPlan_pkey" PRIMARY KEY ("marketingCampaignPlanId")
);

-- CreateTable
CREATE TABLE "GbaMarketingCampaignPlanHistory" (
    "marketingCampaignPlanHistoryId" TEXT NOT NULL,
    "marketingCampaignPlanId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingCampaignPlanHistory_pkey" PRIMARY KEY ("marketingCampaignPlanHistoryId")
);

-- CreateTable
CREATE TABLE "GbaMarketingContentStrategy" (
    "marketingContentStrategyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "pillarTopics" JSONB NOT NULL,
    "brandVoice" TEXT NOT NULL,
    "seoTheme" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingContentStrategy_pkey" PRIMARY KEY ("marketingContentStrategyId")
);

-- CreateTable
CREATE TABLE "GbaMarketingSeoIntelligence" (
    "marketingSeoIntelligenceId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "primaryKeyword" TEXT NOT NULL,
    "secondaryKeywords" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "opportunities" JSONB NOT NULL,
    "blockers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingSeoIntelligence_pkey" PRIMARY KEY ("marketingSeoIntelligenceId")
);

-- CreateTable
CREATE TABLE "GbaMarketingBrandGovernanceReview" (
    "marketingBrandGovernanceReviewId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "reviewState" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingBrandGovernanceReview_pkey" PRIMARY KEY ("marketingBrandGovernanceReviewId")
);

-- CreateTable
CREATE TABLE "GbaMarketingAnalyticsSnapshot" (
    "marketingAnalyticsSnapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "sourceRecommendations" INTEGER NOT NULL,
    "sourceCollections" INTEGER NOT NULL,
    "trafficScore" DOUBLE PRECISION NOT NULL,
    "engagementScore" DOUBLE PRECISION NOT NULL,
    "conversionScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingAnalyticsSnapshot_pkey" PRIMARY KEY ("marketingAnalyticsSnapshotId")
);

-- CreateTable
CREATE TABLE "GbaMarketingRecommendation" (
    "marketingRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingRecommendation_pkey" PRIMARY KEY ("marketingRecommendationId")
);

-- CreateTable
CREATE TABLE "GbaMarketingRecommendationReview" (
    "marketingRecommendationReviewId" TEXT NOT NULL,
    "marketingRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingRecommendationReview_pkey" PRIMARY KEY ("marketingRecommendationReviewId")
);

-- CreateTable
CREATE TABLE "GbaMarketingTimelineEvent" (
    "marketingTimelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingTimelineEvent_pkey" PRIMARY KEY ("marketingTimelineEventId")
);

-- CreateTable
CREATE TABLE "GbaMarketingExecutiveReport" (
    "marketingExecutiveReportId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "period" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "campaignHighlights" JSONB NOT NULL,
    "contentHighlights" JSONB NOT NULL,
    "seoHighlights" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingExecutiveReport_pkey" PRIMARY KEY ("marketingExecutiveReportId")
);

-- CreateTable
CREATE TABLE "GbaMarketingHealth" (
    "marketingHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "siteId" TEXT,
    "status" TEXT NOT NULL,
    "blockedCampaigns" INTEGER NOT NULL,
    "reviewBacklog" INTEGER NOT NULL,
    "seoRisks" INTEGER NOT NULL,
    "analyticsGaps" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaMarketingHealth_pkey" PRIMARY KEY ("marketingHealthId")
);

-- CreateTable
CREATE TABLE "GbaSalesPipelineRecord" (
    "salesPipelineRecordId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "opportunityReference" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "amountCents" DOUBLE PRECISION NOT NULL,
    "weightedAmountCents" DOUBLE PRECISION NOT NULL,
    "probabilityPercent" DOUBLE PRECISION NOT NULL,
    "expectedCloseAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesPipelineRecord_pkey" PRIMARY KEY ("salesPipelineRecordId")
);

-- CreateTable
CREATE TABLE "GbaSalesForecastSnapshot" (
    "salesForecastSnapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "pipelineAmountCents" DOUBLE PRECISION NOT NULL,
    "weightedAmountCents" DOUBLE PRECISION NOT NULL,
    "committedAmountCents" DOUBLE PRECISION NOT NULL,
    "modeledWinRatePercent" DOUBLE PRECISION NOT NULL,
    "confidence" TEXT NOT NULL,
    "assumptions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesForecastSnapshot_pkey" PRIMARY KEY ("salesForecastSnapshotId")
);

-- CreateTable
CREATE TABLE "GbaSalesAccountIntelligence" (
    "salesAccountIntelligenceId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "relationshipHealthScore" DOUBLE PRECISION NOT NULL,
    "expansionPotentialScore" DOUBLE PRECISION NOT NULL,
    "churnRiskScore" DOUBLE PRECISION NOT NULL,
    "openOpportunities" INTEGER NOT NULL,
    "openRevenueCents" DOUBLE PRECISION NOT NULL,
    "signals" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesAccountIntelligence_pkey" PRIMARY KEY ("salesAccountIntelligenceId")
);

-- CreateTable
CREATE TABLE "GbaSalesRecommendation" (
    "salesRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesRecommendation_pkey" PRIMARY KEY ("salesRecommendationId")
);

-- CreateTable
CREATE TABLE "GbaSalesRecommendationReview" (
    "salesRecommendationReviewId" TEXT NOT NULL,
    "salesRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesRecommendationReview_pkey" PRIMARY KEY ("salesRecommendationReviewId")
);

-- CreateTable
CREATE TABLE "GbaSalesTimelineEvent" (
    "salesTimelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesTimelineEvent_pkey" PRIMARY KEY ("salesTimelineEventId")
);

-- CreateTable
CREATE TABLE "GbaSalesHealth" (
    "salesHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stalledOpportunityCount" INTEGER NOT NULL,
    "riskyAccountCount" INTEGER NOT NULL,
    "forecastGapCount" INTEGER NOT NULL,
    "fulfillmentConstraintCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaSalesHealth_pkey" PRIMARY KEY ("salesHealthId")
);

-- CreateTable
CREATE TABLE "GbaFinanceGeneralLedgerEntry" (
    "financeGeneralLedgerEntryId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fiscalPeriod" TEXT NOT NULL,
    "journalReference" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "debitAmountCents" DOUBLE PRECISION NOT NULL,
    "creditAmountCents" DOUBLE PRECISION NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "auditReference" TEXT NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceGeneralLedgerEntry_pkey" PRIMARY KEY ("financeGeneralLedgerEntryId")
);

-- CreateTable
CREATE TABLE "GbaFinanceChartOfAccount" (
    "financeChartOfAccountId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "balanceCents" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceChartOfAccount_pkey" PRIMARY KEY ("financeChartOfAccountId")
);

-- CreateTable
CREATE TABLE "GbaFinanceReceivable" (
    "financeReceivableId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "invoiceReference" TEXT NOT NULL,
    "outstandingAmountCents" DOUBLE PRECISION NOT NULL,
    "agingBucket" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "creditExposureCents" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceReceivable_pkey" PRIMARY KEY ("financeReceivableId")
);

-- CreateTable
CREATE TABLE "GbaFinancePayable" (
    "financePayableId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "billReference" TEXT NOT NULL,
    "outstandingAmountCents" DOUBLE PRECISION NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "paymentPriority" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinancePayable_pkey" PRIMARY KEY ("financePayableId")
);

-- CreateTable
CREATE TABLE "GbaFinanceBudget" (
    "financeBudgetId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "budgetScope" TEXT NOT NULL,
    "scopeReference" TEXT NOT NULL,
    "capexBudgetCents" DOUBLE PRECISION NOT NULL,
    "opexBudgetCents" DOUBLE PRECISION NOT NULL,
    "spentCapexCents" DOUBLE PRECISION NOT NULL,
    "spentOpexCents" DOUBLE PRECISION NOT NULL,
    "varianceCents" DOUBLE PRECISION NOT NULL,
    "period" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceBudget_pkey" PRIMARY KEY ("financeBudgetId")
);

-- CreateTable
CREATE TABLE "GbaFinanceProfitabilitySnapshot" (
    "financeProfitabilitySnapshotId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "revenueCents" DOUBLE PRECISION NOT NULL,
    "costCents" DOUBLE PRECISION NOT NULL,
    "grossMarginPercent" DOUBLE PRECISION NOT NULL,
    "netMarginPercent" DOUBLE PRECISION NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceProfitabilitySnapshot_pkey" PRIMARY KEY ("financeProfitabilitySnapshotId")
);

-- CreateTable
CREATE TABLE "GbaFinanceForecast" (
    "financeForecastId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "revenueForecastCents" DOUBLE PRECISION NOT NULL,
    "expenseForecastCents" DOUBLE PRECISION NOT NULL,
    "cashFlowForecastCents" DOUBLE PRECISION NOT NULL,
    "profitForecastCents" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "varianceProjectionCents" DOUBLE PRECISION NOT NULL,
    "assumptions" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceForecast_pkey" PRIMARY KEY ("financeForecastId")
);

-- CreateTable
CREATE TABLE "GbaFinanceKpi" (
    "financeKpiId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "trend" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceKpi_pkey" PRIMARY KEY ("financeKpiId")
);

-- CreateTable
CREATE TABLE "GbaFinanceRecommendation" (
    "financeRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceRecommendation_pkey" PRIMARY KEY ("financeRecommendationId")
);

-- CreateTable
CREATE TABLE "GbaFinanceRecommendationReview" (
    "financeRecommendationReviewId" TEXT NOT NULL,
    "financeRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceRecommendationReview_pkey" PRIMARY KEY ("financeRecommendationReviewId")
);

-- CreateTable
CREATE TABLE "GbaFinanceExecutiveReport" (
    "financeExecutiveReportId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "strategicRisks" JSONB NOT NULL,
    "growthOpportunities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceExecutiveReport_pkey" PRIMARY KEY ("financeExecutiveReportId")
);

-- CreateTable
CREATE TABLE "GbaFinanceHealth" (
    "financeHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "overdueReceivables" INTEGER NOT NULL,
    "overduePayables" INTEGER NOT NULL,
    "budgetOverruns" INTEGER NOT NULL,
    "cashFlowRiskFlags" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceHealth_pkey" PRIMARY KEY ("financeHealthId")
);

-- CreateTable
CREATE TABLE "GbaFinanceTimelineEvent" (
    "financeTimelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaFinanceTimelineEvent_pkey" PRIMARY KEY ("financeTimelineEventId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessOnboarding" (
    "customerSuccessOnboardingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "implementationMilestones" JSONB NOT NULL,
    "trainingProgressPercent" DOUBLE PRECISION NOT NULL,
    "documentationCompletionPercent" DOUBLE PRECISION NOT NULL,
    "goLiveReadinessPercent" DOUBLE PRECISION NOT NULL,
    "adoptionCheckpointPercent" DOUBLE PRECISION NOT NULL,
    "ownerId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessOnboarding_pkey" PRIMARY KEY ("customerSuccessOnboardingId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessHealth" (
    "customerSuccessHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "overallHealthScore" DOUBLE PRECISION NOT NULL,
    "trendDirection" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "productAdoptionScore" DOUBLE PRECISION NOT NULL,
    "renewalHistoryScore" DOUBLE PRECISION NOT NULL,
    "supportInteractionScore" DOUBLE PRECISION NOT NULL,
    "engagementScore" DOUBLE PRECISION NOT NULL,
    "satisfactionScore" DOUBLE PRECISION NOT NULL,
    "executiveEscalationScore" DOUBLE PRECISION NOT NULL,
    "financialStandingScore" DOUBLE PRECISION NOT NULL,
    "operationalDeliveryScore" DOUBLE PRECISION NOT NULL,
    "recommendedActions" JSONB NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessHealth_pkey" PRIMARY KEY ("customerSuccessHealthId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessPlan" (
    "customerSuccessPlanId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "strategicObjectives" JSONB NOT NULL,
    "customerGoals" JSONB NOT NULL,
    "milestones" JSONB NOT NULL,
    "actionItems" JSONB NOT NULL,
    "reviewSchedule" TEXT NOT NULL,
    "successOutcomes" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessPlan_pkey" PRIMARY KEY ("customerSuccessPlanId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessRenewal" (
    "customerSuccessRenewalId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "contractReference" TEXT NOT NULL,
    "contractExpiresAt" TIMESTAMP(3) NOT NULL,
    "renewalProbabilityPercent" DOUBLE PRECISION NOT NULL,
    "renewalForecastCents" DOUBLE PRECISION NOT NULL,
    "churnRiskPercent" DOUBLE PRECISION NOT NULL,
    "escalationRequired" BOOLEAN NOT NULL,
    "recommendationSummary" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessRenewal_pkey" PRIMARY KEY ("customerSuccessRenewalId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessSatisfaction" (
    "customerSuccessSatisfactionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "csatScore" DOUBLE PRECISION NOT NULL,
    "npsScore" DOUBLE PRECISION NOT NULL,
    "sentimentTrend" TEXT NOT NULL,
    "surveySummary" TEXT NOT NULL,
    "feedbackHighlights" JSONB NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessSatisfaction_pkey" PRIMARY KEY ("customerSuccessSatisfactionId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessSupportSignal" (
    "customerSuccessSupportSignalId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "openIssues" INTEGER NOT NULL,
    "escalations" INTEGER NOT NULL,
    "resolutionProgressPercent" DOUBLE PRECISION NOT NULL,
    "slaPerformancePercent" DOUBLE PRECISION NOT NULL,
    "communicationSummary" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessSupportSignal_pkey" PRIMARY KEY ("customerSuccessSupportSignalId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessExpansionOpportunity" (
    "customerSuccessExpansionOpportunityId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "opportunityType" TEXT NOT NULL,
    "productAdoptionGap" TEXT NOT NULL,
    "growthIndicator" TEXT NOT NULL,
    "projectedRevenueCents" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "recommendationSummary" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessExpansionOpportunity_pkey" PRIMARY KEY ("customerSuccessExpansionOpportunityId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessKpi" (
    "customerSuccessKpiId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "trend" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessKpi_pkey" PRIMARY KEY ("customerSuccessKpiId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessRecommendation" (
    "customerSuccessRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "recommendedAction" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessRecommendation_pkey" PRIMARY KEY ("customerSuccessRecommendationId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessRecommendationReview" (
    "customerSuccessRecommendationReviewId" TEXT NOT NULL,
    "customerSuccessRecommendationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "reviewedBy" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessRecommendationReview_pkey" PRIMARY KEY ("customerSuccessRecommendationReviewId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessExecutiveReport" (
    "customerSuccessExecutiveReportId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "churnForecast" TEXT NOT NULL,
    "renewalForecast" TEXT NOT NULL,
    "strategicRisks" JSONB NOT NULL,
    "strategicOpportunities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessExecutiveReport_pkey" PRIMARY KEY ("customerSuccessExecutiveReportId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessTimelineEvent" (
    "customerSuccessTimelineEventId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "evidenceReferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessTimelineEvent_pkey" PRIMARY KEY ("customerSuccessTimelineEventId")
);

-- CreateTable
CREATE TABLE "GbaCustomerSuccessAgentHealth" (
    "customerSuccessAgentHealthId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "atRiskCustomers" INTEGER NOT NULL,
    "renewalsAtRisk" INTEGER NOT NULL,
    "escalatedAccounts" INTEGER NOT NULL,
    "onboardingDelays" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GbaCustomerSuccessAgentHealth_pkey" PRIMARY KEY ("customerSuccessAgentHealthId")
);

-- CreateTable
CREATE TABLE "GedEntityDefinition" (
    "enterpriseEntityId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "entityCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pluralName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stewardshipArea" TEXT NOT NULL,
    "lifecyclePreset" TEXT NOT NULL,
    "lifecycle" JSONB NOT NULL,
    "authorizationBoundary" TEXT NOT NULL,
    "consumerAgents" JSONB NOT NULL,
    "relationshipKeys" JSONB NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "immutableLineage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GedEntityDefinition_pkey" PRIMARY KEY ("enterpriseEntityId")
);

-- CreateTable
CREATE TABLE "GedRelationshipDefinition" (
    "enterpriseRelationshipId" TEXT NOT NULL,
    "relationshipKey" TEXT NOT NULL,
    "sourceEntityKey" TEXT NOT NULL,
    "targetEntityKey" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "cardinality" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorizationBoundary" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "immutableLineage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GedRelationshipDefinition_pkey" PRIMARY KEY ("enterpriseRelationshipId")
);

-- CreateTable
CREATE TABLE "GedEntityVersion" (
    "enterpriseEntityVersionId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "definitionSnapshot" JSONB NOT NULL,
    "immutableLineage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GedEntityVersion_pkey" PRIMARY KEY ("enterpriseEntityVersionId")
);

-- CreateTable
CREATE TABLE "GedValidationResult" (
    "enterpriseValidationId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "immutableLineage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GedValidationResult_pkey" PRIMARY KEY ("enterpriseValidationId")
);

-- CreateTable
CREATE TABLE "GedHealthSnapshot" (
    "enterpriseHealthId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalEntities" INTEGER NOT NULL,
    "totalRelationships" INTEGER NOT NULL,
    "validationIssueCount" INTEGER NOT NULL,
    "duplicateOwnershipCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GedHealthSnapshot_pkey" PRIMARY KEY ("enterpriseHealthId")
);

-- CreateTable
CREATE TABLE "GedAuditLineage" (
    "enterpriseAuditLineageId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "relatedEntityKeys" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GedAuditLineage_pkey" PRIMARY KEY ("enterpriseAuditLineageId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GlwJob_operationKey_key" ON "GlwJob"("operationKey");

-- CreateIndex
CREATE INDEX "GlwJob_type_createdAt_idx" ON "GlwJob"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GlwJob_siteId_createdAt_idx" ON "GlwJob"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GlwJob_status_createdAt_idx" ON "GlwJob"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GlwJob_retryOfJobId_idx" ON "GlwJob"("retryOfJobId");

-- CreateIndex
CREATE INDEX "GlwJob_businessStatus_updatedAt_idx" ON "GlwJob"("businessStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GlwJob_callbackDeliveryStatus_updatedAt_idx" ON "GlwJob"("callbackDeliveryStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GlwJob_publicationKey_idx" ON "GlwJob"("publicationKey");

-- CreateIndex
CREATE UNIQUE INDEX "GlwCallbackReceipt_idempotencyKey_key" ON "GlwCallbackReceipt"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GlwCallbackReceipt_terminalScopeKey_key" ON "GlwCallbackReceipt"("terminalScopeKey");

-- CreateIndex
CREATE INDEX "GlwCallbackReceipt_jobId_receivedAt_idx" ON "GlwCallbackReceipt"("jobId", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "GlwCallbackReceipt_operationKey_receivedAt_idx" ON "GlwCallbackReceipt"("operationKey", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "GlwCallbackReceipt_externalExecutionId_receivedAt_idx" ON "GlwCallbackReceipt"("externalExecutionId", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "GlwCallbackReceipt_outcome_receivedAt_idx" ON "GlwCallbackReceipt"("outcome", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "GlwDailyPublishPlan_siteId_generatedAt_idx" ON "GlwDailyPublishPlan"("siteId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GlwDailyPublishPlan_status_generatedAt_idx" ON "GlwDailyPublishPlan"("status", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GlwDailyPublishCandidate_siteId_desiredAction_idx" ON "GlwDailyPublishCandidate"("siteId", "desiredAction");

-- CreateIndex
CREATE INDEX "GlwDailyPublishCandidate_approvalStatus_priority_idx" ON "GlwDailyPublishCandidate"("approvalStatus", "priority");

-- CreateIndex
CREATE INDEX "GlwDailyPublishCandidate_queueJobId_idx" ON "GlwDailyPublishCandidate"("queueJobId");

-- CreateIndex
CREATE UNIQUE INDEX "GlwDailyPublishCandidate_planId_canonicalPath_key" ON "GlwDailyPublishCandidate"("planId", "canonicalPath");

-- CreateIndex
CREATE INDEX "GlwPublishingControl_paused_updatedAt_idx" ON "GlwPublishingControl"("paused", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GopJobEvent_jobId_sequence_idx" ON "GopJobEvent"("jobId", "sequence");

-- CreateIndex
CREATE INDEX "GopJobEvent_moduleId_occurredAt_idx" ON "GopJobEvent"("moduleId", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "GopJobEvent_jobType_occurredAt_idx" ON "GopJobEvent"("jobType", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "GopJobEvent_eventType_occurredAt_idx" ON "GopJobEvent"("eventType", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "GopJobEvent_status_occurredAt_idx" ON "GopJobEvent"("status", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "GopJobEvent_idempotencyKey_idx" ON "GopJobEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GopJobEvent_jobId_sequence_key" ON "GopJobEvent"("jobId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "GopJobEvent_jobId_idempotencyKey_unique_when_not_null" ON "GopJobEvent"("jobId", "idempotencyKey") WHERE ("idempotencyKey" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "GopExecution_jobId_key" ON "GopExecution"("jobId");

-- CreateIndex
CREATE INDEX "GopExecution_workspaceId_updatedAt_idx" ON "GopExecution"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GopExecution_moduleId_updatedAt_idx" ON "GopExecution"("moduleId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GopExecution_status_updatedAt_idx" ON "GopExecution"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GopExecution_parentExecutionId_idx" ON "GopExecution"("parentExecutionId");

-- CreateIndex
CREATE INDEX "GopExecution_correlationId_idx" ON "GopExecution"("correlationId");

-- CreateIndex
CREATE INDEX "GopExecutionSnapshot_executionId_createdAt_idx" ON "GopExecutionSnapshot"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GopExecutionSnapshot_status_createdAt_idx" ON "GopExecutionSnapshot"("status", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GopExecutionSnapshot_executionId_snapshotSequence_key" ON "GopExecutionSnapshot"("executionId", "snapshotSequence");

-- CreateIndex
CREATE INDEX "GopWorker_workerType_updatedAt_idx" ON "GopWorker"("workerType", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GopWorker_health_updatedAt_idx" ON "GopWorker"("health", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GopWorker_workspaceId_moduleId_idx" ON "GopWorker"("workspaceId", "moduleId");

-- CreateIndex
CREATE INDEX "GopExecutionLease_executionId_leaseStartAt_idx" ON "GopExecutionLease"("executionId", "leaseStartAt" DESC);

-- CreateIndex
CREATE INDEX "GopExecutionLease_workerId_leaseStartAt_idx" ON "GopExecutionLease"("workerId", "leaseStartAt" DESC);

-- CreateIndex
CREATE INDEX "GopExecutionLease_leaseState_leaseExpiresAt_idx" ON "GopExecutionLease"("leaseState", "leaseExpiresAt" DESC);

-- CreateIndex
CREATE INDEX "GopDeadLetter_workspaceId_createdAt_idx" ON "GopDeadLetter"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GopDeadLetter_moduleId_createdAt_idx" ON "GopDeadLetter"("moduleId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GopDeadLetter_archivedAt_createdAt_idx" ON "GopDeadLetter"("archivedAt", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GopRecoveryRecord_workspaceId_createdAt_idx" ON "GopRecoveryRecord"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GopRecoveryRecord_jobId_createdAt_idx" ON "GopRecoveryRecord"("jobId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GopRecoveryRecord_executionId_createdAt_idx" ON "GopRecoveryRecord"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpProject_workspaceId_updatedAt_idx" ON "GmpProject"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpProject_status_updatedAt_idx" ON "GmpProject"("status", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpProject_workspaceId_slug_key" ON "GmpProject"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "GmpSite_projectId_updatedAt_idx" ON "GmpSite"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSite_environment_updatedAt_idx" ON "GmpSite"("environment", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSite_connectionStatus_updatedAt_idx" ON "GmpSite"("connectionStatus", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpBrandProfile_projectId_key" ON "GmpBrandProfile"("projectId");

-- CreateIndex
CREATE INDEX "GmpBrandProfile_updatedAt_idx" ON "GmpBrandProfile"("updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingConnection_siteId_updatedAt_idx" ON "GmpPublishingConnection"("siteId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingConnection_provider_updatedAt_idx" ON "GmpPublishingConnection"("provider", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPublishingConnection_connectionStatus_updatedAt_idx" ON "GmpPublishingConnection"("connectionStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEnvironmentConfig_projectId_environment_idx" ON "GmpEnvironmentConfig"("projectId", "environment");

-- CreateIndex
CREATE INDEX "GmpEnvironmentConfig_siteId_environment_idx" ON "GmpEnvironmentConfig"("siteId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "GmpBusinessKnowledgeWorkspace_projectId_key" ON "GmpBusinessKnowledgeWorkspace"("projectId");

-- CreateIndex
CREATE INDEX "GmpBusinessKnowledgeWorkspace_lifecycleState_updatedAt_idx" ON "GmpBusinessKnowledgeWorkspace"("lifecycleState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpBusinessKnowledgeWorkspace_status_updatedAt_idx" ON "GmpBusinessKnowledgeWorkspace"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeRecord_projectId_domain_updatedAt_idx" ON "GmpKnowledgeRecord"("projectId", "domain", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeRecord_knowledgeWorkspaceId_canonicalKey_idx" ON "GmpKnowledgeRecord"("knowledgeWorkspaceId", "canonicalKey");

-- CreateIndex
CREATE INDEX "GmpKnowledgeRecord_reviewState_updatedAt_idx" ON "GmpKnowledgeRecord"("reviewState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeRecord_conflictState_updatedAt_idx" ON "GmpKnowledgeRecord"("conflictState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeRecord_status_effectiveUntil_idx" ON "GmpKnowledgeRecord"("status", "effectiveUntil");

-- CreateIndex
CREATE INDEX "GmpKnowledgeRecordVersion_projectId_changedAt_idx" ON "GmpKnowledgeRecordVersion"("projectId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeRecordVersion_knowledgeWorkspaceId_changedAt_idx" ON "GmpKnowledgeRecordVersion"("knowledgeWorkspaceId", "changedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpKnowledgeRecordVersion_knowledgeRecordId_versionNumber_key" ON "GmpKnowledgeRecordVersion"("knowledgeRecordId", "versionNumber");

-- CreateIndex
CREATE INDEX "GmpKnowledgeSource_projectId_createdAt_idx" ON "GmpKnowledgeSource"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeSource_sourceType_createdAt_idx" ON "GmpKnowledgeSource"("sourceType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeEvidenceLink_projectId_createdAt_idx" ON "GmpKnowledgeEvidenceLink"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeEvidenceLink_sourceId_createdAt_idx" ON "GmpKnowledgeEvidenceLink"("sourceId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpKnowledgeEvidenceLink_knowledgeRecordId_sourceId_evidenc_key" ON "GmpKnowledgeEvidenceLink"("knowledgeRecordId", "sourceId", "evidenceLocation");

-- CreateIndex
CREATE INDEX "GmpKnowledgeReview_projectId_reviewState_updatedAt_idx" ON "GmpKnowledgeReview"("projectId", "reviewState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeReview_knowledgeRecordId_updatedAt_idx" ON "GmpKnowledgeReview"("knowledgeRecordId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeApproval_projectId_decidedAt_idx" ON "GmpKnowledgeApproval"("projectId", "decidedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeApproval_knowledgeRecordId_decidedAt_idx" ON "GmpKnowledgeApproval"("knowledgeRecordId", "decidedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeConflict_projectId_resolutionStatus_updatedAt_idx" ON "GmpKnowledgeConflict"("projectId", "resolutionStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeConflict_severity_updatedAt_idx" ON "GmpKnowledgeConflict"("severity", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeConflictMember_projectId_createdAt_idx" ON "GmpKnowledgeConflictMember"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpKnowledgeConflictMember_knowledgeConflictId_knowledgeRec_key" ON "GmpKnowledgeConflictMember"("knowledgeConflictId", "knowledgeRecordId");

-- CreateIndex
CREATE INDEX "GmpKnowledgeCompletenessAssessment_projectId_createdAt_idx" ON "GmpKnowledgeCompletenessAssessment"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpKnowledgeCompletenessAssessment_knowledgeWorkspaceId_cre_idx" ON "GmpKnowledgeCompletenessAssessment"("knowledgeWorkspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContextAssemblyRecord_projectId_createdAt_idx" ON "GmpContextAssemblyRecord"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContextAssemblyRecord_knowledgeWorkspaceId_createdAt_idx" ON "GmpContextAssemblyRecord"("knowledgeWorkspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContextAssemblyRecord_operationType_createdAt_idx" ON "GmpContextAssemblyRecord"("operationType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPage_projectId_updatedAt_idx" ON "GmpPage"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPage_siteId_updatedAt_idx" ON "GmpPage"("siteId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPage_pageType_updatedAt_idx" ON "GmpPage"("pageType", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPage_lifecycleState_updatedAt_idx" ON "GmpPage"("lifecycleState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPage_contentState_updatedAt_idx" ON "GmpPage"("contentState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPage_seoState_updatedAt_idx" ON "GmpPage"("seoState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPage_publishingState_updatedAt_idx" ON "GmpPage"("publishingState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPage_priority_updatedAt_idx" ON "GmpPage"("priority", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPage_parentPageId_idx" ON "GmpPage"("parentPageId");

-- CreateIndex
CREATE INDEX "GmpPage_canonicalUrl_idx" ON "GmpPage"("canonicalUrl");

-- CreateIndex
CREATE INDEX "GmpPage_currentBriefId_idx" ON "GmpPage"("currentBriefId");

-- CreateIndex
CREATE INDEX "GmpPage_currentContentPlanId_idx" ON "GmpPage"("currentContentPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "GmpPage_siteId_slug_key" ON "GmpPage"("siteId", "slug");

-- CreateIndex
CREATE INDEX "GmpPageBrief_projectId_pageId_updatedAt_idx" ON "GmpPageBrief"("projectId", "pageId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPageBrief_status_updatedAt_idx" ON "GmpPageBrief"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPageBriefVersion_projectId_changedAt_idx" ON "GmpPageBriefVersion"("projectId", "changedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpPageBriefVersion_briefId_versionNumber_key" ON "GmpPageBriefVersion"("briefId", "versionNumber");

-- CreateIndex
CREATE INDEX "GmpContentPlan_projectId_pageId_updatedAt_idx" ON "GmpContentPlan"("projectId", "pageId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentPlan_status_updatedAt_idx" ON "GmpContentPlan"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentPlan_readinessScore_updatedAt_idx" ON "GmpContentPlan"("readinessScore", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentPlanVersion_projectId_changedAt_idx" ON "GmpContentPlanVersion"("projectId", "changedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpContentPlanVersion_contentPlanId_versionNumber_key" ON "GmpContentPlanVersion"("contentPlanId", "versionNumber");

-- CreateIndex
CREATE INDEX "GmpPageSection_projectId_pageId_position_idx" ON "GmpPageSection"("projectId", "pageId", "position");

-- CreateIndex
CREATE INDEX "GmpPageSection_sectionType_updatedAt_idx" ON "GmpPageSection"("sectionType", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpPageSection_contentPlanId_sectionKey_key" ON "GmpPageSection"("contentPlanId", "sectionKey");

-- CreateIndex
CREATE INDEX "GmpPageRelationship_projectId_relationshipType_createdAt_idx" ON "GmpPageRelationship"("projectId", "relationshipType", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpPageRelationship_sourcePageId_targetPageId_relationshipT_key" ON "GmpPageRelationship"("sourcePageId", "targetPageId", "relationshipType");

-- CreateIndex
CREATE INDEX "GmpInternalLinkPlan_projectId_sourcePageId_updatedAt_idx" ON "GmpInternalLinkPlan"("projectId", "sourcePageId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpInternalLinkPlan_projectId_targetPageId_updatedAt_idx" ON "GmpInternalLinkPlan"("projectId", "targetPageId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPageReview_projectId_pageId_reviewState_updatedAt_idx" ON "GmpPageReview"("projectId", "pageId", "reviewState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPageApproval_projectId_pageId_decidedAt_idx" ON "GmpPageApproval"("projectId", "pageId", "decidedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPageReadinessAssessment_projectId_pageId_createdAt_idx" ON "GmpPageReadinessAssessment"("projectId", "pageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPageReadinessAssessment_overallScore_createdAt_idx" ON "GmpPageReadinessAssessment"("overallScore", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPageKnowledgeReference_projectId_pageId_createdAt_idx" ON "GmpPageKnowledgeReference"("projectId", "pageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPageKnowledgeReference_knowledgeRecordId_createdAt_idx" ON "GmpPageKnowledgeReference"("knowledgeRecordId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPageSourceReference_projectId_pageId_createdAt_idx" ON "GmpPageSourceReference"("projectId", "pageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPageSourceReference_sourceId_createdAt_idx" ON "GmpPageSourceReference"("sourceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentDraft_projectId_createdAt_idx" ON "GmpContentDraft"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentDraft_siteId_createdAt_idx" ON "GmpContentDraft"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentDraft_pageId_createdAt_idx" ON "GmpContentDraft"("pageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentDraft_generationStatus_updatedAt_idx" ON "GmpContentDraft"("generationStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentDraft_editorialStatus_updatedAt_idx" ON "GmpContentDraft"("editorialStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentDraft_approvalStatus_updatedAt_idx" ON "GmpContentDraft"("approvalStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentDraft_provider_modelIdentifier_updatedAt_idx" ON "GmpContentDraft"("provider", "modelIdentifier", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpGenerationRequest_projectId_requestedAt_idx" ON "GmpGenerationRequest"("projectId", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpGenerationRequest_pageId_requestedAt_idx" ON "GmpGenerationRequest"("pageId", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpGenerationRequest_contentDraftId_requestedAt_idx" ON "GmpGenerationRequest"("contentDraftId", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpGenerationRequest_status_requestedAt_idx" ON "GmpGenerationRequest"("status", "requestedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpGenerationRequest_gopExecutionId_idx" ON "GmpGenerationRequest"("gopExecutionId");

-- CreateIndex
CREATE INDEX "GmpGenerationRequest_inputFingerprint_idx" ON "GmpGenerationRequest"("inputFingerprint");

-- CreateIndex
CREATE INDEX "GmpSectionContent_contentDraftId_position_idx" ON "GmpSectionContent"("contentDraftId", "position");

-- CreateIndex
CREATE INDEX "GmpSectionContent_pageSectionId_updatedAt_idx" ON "GmpSectionContent"("pageSectionId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSectionContent_generationStatus_updatedAt_idx" ON "GmpSectionContent"("generationStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSectionContent_editorialStatus_updatedAt_idx" ON "GmpSectionContent"("editorialStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSectionContent_approvalStatus_updatedAt_idx" ON "GmpSectionContent"("approvalStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSectionContent_currentRevisionId_idx" ON "GmpSectionContent"("currentRevisionId");

-- CreateIndex
CREATE INDEX "GmpSectionContentRevision_sectionContentId_changedAt_idx" ON "GmpSectionContentRevision"("sectionContentId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSectionContentRevision_contentDraftId_changedAt_idx" ON "GmpSectionContentRevision"("contentDraftId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSectionContentRevision_inputFingerprint_idx" ON "GmpSectionContentRevision"("inputFingerprint");

-- CreateIndex
CREATE INDEX "GmpContentReview_projectId_reviewState_updatedAt_idx" ON "GmpContentReview"("projectId", "reviewState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentReview_contentDraftId_updatedAt_idx" ON "GmpContentReview"("contentDraftId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentReview_sectionContentId_updatedAt_idx" ON "GmpContentReview"("sectionContentId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentReview_assignedTo_idx" ON "GmpContentReview"("assignedTo");

-- CreateIndex
CREATE INDEX "GmpContentApproval_projectId_decidedAt_idx" ON "GmpContentApproval"("projectId", "decidedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentApproval_contentDraftId_decidedAt_idx" ON "GmpContentApproval"("contentDraftId", "decidedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentApproval_sectionContentId_decidedAt_idx" ON "GmpContentApproval"("sectionContentId", "decidedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentValidation_projectId_createdAt_idx" ON "GmpContentValidation"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentValidation_contentDraftId_createdAt_idx" ON "GmpContentValidation"("contentDraftId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentValidation_overallScore_createdAt_idx" ON "GmpContentValidation"("overallScore", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSectionValidation_projectId_createdAt_idx" ON "GmpSectionValidation"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSectionValidation_contentDraftId_createdAt_idx" ON "GmpSectionValidation"("contentDraftId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSectionValidation_sectionContentId_createdAt_idx" ON "GmpSectionValidation"("sectionContentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpSectionValidation_editorialScore_createdAt_idx" ON "GmpSectionValidation"("editorialScore", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpGenerationLineage_projectId_createdAt_idx" ON "GmpGenerationLineage"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpGenerationLineage_contentDraftId_createdAt_idx" ON "GmpGenerationLineage"("contentDraftId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpGenerationLineage_sectionContentId_createdAt_idx" ON "GmpGenerationLineage"("sectionContentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpGenerationLineage_gopExecutionId_idx" ON "GmpGenerationLineage"("gopExecutionId");

-- CreateIndex
CREATE INDEX "GmpGenerationLineage_inputFingerprint_idx" ON "GmpGenerationLineage"("inputFingerprint");

-- CreateIndex
CREATE INDEX "GmpContentAssembly_projectId_updatedAt_idx" ON "GmpContentAssembly"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpContentAssembly_contentDraftId_updatedAt_idx" ON "GmpContentAssembly"("contentDraftId", "updatedAt" DESC);

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

-- CreateIndex
CREATE INDEX "GmpAnalyticsSource_projectId_updatedAt_idx" ON "GmpAnalyticsSource"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsSource_siteId_updatedAt_idx" ON "GmpAnalyticsSource"("siteId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsSource_sourceStatus_updatedAt_idx" ON "GmpAnalyticsSource"("sourceStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsSource_connectionStatus_updatedAt_idx" ON "GmpAnalyticsSource"("connectionStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsSourceCapability_analyticsSourceId_updatedAt_idx" ON "GmpAnalyticsSourceCapability"("analyticsSourceId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpAnalyticsSourceCapability_analyticsSourceId_capabilityKe_key" ON "GmpAnalyticsSourceCapability"("analyticsSourceId", "capabilityKey");

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_workspaceId_updatedAt_idx" ON "GmpAnalyticsCollection"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_projectId_updatedAt_idx" ON "GmpAnalyticsCollection"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_siteId_updatedAt_idx" ON "GmpAnalyticsCollection"("siteId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_analyticsSourceId_updatedAt_idx" ON "GmpAnalyticsCollection"("analyticsSourceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_collectionStatus_updatedAt_idx" ON "GmpAnalyticsCollection"("collectionStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_gopExecutionId_idx" ON "GmpAnalyticsCollection"("gopExecutionId");

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_parentCollectionId_updatedAt_idx" ON "GmpAnalyticsCollection"("parentCollectionId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_idempotencyKey_idx" ON "GmpAnalyticsCollection"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_inputFingerprint_idx" ON "GmpAnalyticsCollection"("inputFingerprint");

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_projectId_observedAt_idx" ON "GmpAnalyticsObservation"("projectId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_analyticsSourceId_observedAt_idx" ON "GmpAnalyticsObservation"("analyticsSourceId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_analyticsCollectionId_observedAt_idx" ON "GmpAnalyticsObservation"("analyticsCollectionId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_observationKey_observedAt_idx" ON "GmpAnalyticsObservation"("observationKey", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_sourceRecordIdentity_observedAt_idx" ON "GmpAnalyticsObservation"("sourceRecordIdentity", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_rawPayloadChecksum_idx" ON "GmpAnalyticsObservation"("rawPayloadChecksum");

-- CreateIndex
CREATE UNIQUE INDEX "GmpAnalyticsObservation_analyticsSourceId_sourceRecordIdent_key" ON "GmpAnalyticsObservation"("analyticsSourceId", "sourceRecordIdentity", "sourceTimestamp", "rawPayloadChecksum");

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollectionEvent_analyticsCollectionId_occurredA_idx" ON "GmpAnalyticsCollectionEvent"("analyticsCollectionId", "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollectionEvent_gopExecutionId_occurredAt_idx" ON "GmpAnalyticsCollectionEvent"("gopExecutionId", "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollectionEvent_eventType_occurredAt_idx" ON "GmpAnalyticsCollectionEvent"("eventType", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollectionEvent_parentCollectionId_occurredAt_idx" ON "GmpAnalyticsCollectionEvent"("parentCollectionId", "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollectionEvent_retryOfCollectionId_occurredAt_idx" ON "GmpAnalyticsCollectionEvent"("retryOfCollectionId", "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "GmpMetricDefinition_projectId_updatedAt_idx" ON "GmpMetricDefinition"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMetricDefinition_active_updatedAt_idx" ON "GmpMetricDefinition"("active", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpMetricDefinition_projectId_metricKey_key" ON "GmpMetricDefinition"("projectId", "metricKey");

-- CreateIndex
CREATE INDEX "GmpNormalizedMetric_projectId_measuredAt_idx" ON "GmpNormalizedMetric"("projectId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GmpNormalizedMetric_analyticsCollectionId_measuredAt_idx" ON "GmpNormalizedMetric"("analyticsCollectionId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GmpNormalizedMetric_metricDefinitionId_measuredAt_idx" ON "GmpNormalizedMetric"("metricDefinitionId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPerformanceSnapshot_projectId_createdAt_idx" ON "GmpPerformanceSnapshot"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPerformanceSnapshot_siteId_createdAt_idx" ON "GmpPerformanceSnapshot"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpPerformanceSnapshot_snapshotStatus_createdAt_idx" ON "GmpPerformanceSnapshot"("snapshotStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMeasurementLineage_projectId_createdAt_idx" ON "GmpMeasurementLineage"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMeasurementLineage_analyticsSourceId_createdAt_idx" ON "GmpMeasurementLineage"("analyticsSourceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMeasurementLineage_analyticsCollectionId_createdAt_idx" ON "GmpMeasurementLineage"("analyticsCollectionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMeasurementLineage_performanceSnapshotId_createdAt_idx" ON "GmpMeasurementLineage"("performanceSnapshotId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMeasurementLineage_lineageFingerprint_idx" ON "GmpMeasurementLineage"("lineageFingerprint");

-- CreateIndex
CREATE INDEX "GmpEvidenceCompilerVersion_projectId_updatedAt_idx" ON "GmpEvidenceCompilerVersion"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpEvidenceCompilerVersion_projectId_compilerName_compilerV_key" ON "GmpEvidenceCompilerVersion"("projectId", "compilerName", "compilerVersion");

-- CreateIndex
CREATE INDEX "GmpEvidenceCompilerRun_workspaceId_createdAt_idx" ON "GmpEvidenceCompilerRun"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidenceCompilerRun_projectId_createdAt_idx" ON "GmpEvidenceCompilerRun"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidenceCompilerRun_siteId_createdAt_idx" ON "GmpEvidenceCompilerRun"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidenceCompilerRun_replayOfRunId_createdAt_idx" ON "GmpEvidenceCompilerRun"("replayOfRunId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidenceCompilerRun_evidenceSnapshotId_idx" ON "GmpEvidenceCompilerRun"("evidenceSnapshotId");

-- CreateIndex
CREATE INDEX "GmpEvidenceCompilerRun_inputFingerprint_idx" ON "GmpEvidenceCompilerRun"("inputFingerprint");

-- CreateIndex
CREATE INDEX "GmpEvidenceSnapshot_workspaceId_createdAt_idx" ON "GmpEvidenceSnapshot"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidenceSnapshot_projectId_createdAt_idx" ON "GmpEvidenceSnapshot"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidenceSnapshot_siteId_createdAt_idx" ON "GmpEvidenceSnapshot"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidenceSnapshot_snapshotChecksum_idx" ON "GmpEvidenceSnapshot"("snapshotChecksum");

-- CreateIndex
CREATE UNIQUE INDEX "GmpEvidenceSnapshot_performanceSnapshotId_key" ON "GmpEvidenceSnapshot"("performanceSnapshotId");

-- CreateIndex
CREATE INDEX "GmpEvidenceCompiledMetric_evidenceSnapshotId_canonicalMetri_idx" ON "GmpEvidenceCompiledMetric"("evidenceSnapshotId", "canonicalMetricKey");

-- CreateIndex
CREATE INDEX "GmpEvidenceCompiledMetric_projectId_createdAt_idx" ON "GmpEvidenceCompiledMetric"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidenceCompiledMetric_siteId_createdAt_idx" ON "GmpEvidenceCompiledMetric"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidenceCompiledMetric_metricDefinitionId_idx" ON "GmpEvidenceCompiledMetric"("metricDefinitionId");

-- CreateIndex
CREATE INDEX "GmpEvidenceCompiledMetric_lineageFingerprint_idx" ON "GmpEvidenceCompiledMetric"("lineageFingerprint");

-- CreateIndex
CREATE INDEX "GmpEvidencePublicationReference_evidenceSnapshotId_createdA_idx" ON "GmpEvidencePublicationReference"("evidenceSnapshotId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidencePublicationReference_projectId_createdAt_idx" ON "GmpEvidencePublicationReference"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidencePublicationReference_siteId_createdAt_idx" ON "GmpEvidencePublicationReference"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpEvidencePublicationReference_publicationRecordId_idx" ON "GmpEvidencePublicationReference"("publicationRecordId");

-- CreateIndex
CREATE INDEX "GmpEvidencePublicationReference_canonicalUrl_idx" ON "GmpEvidencePublicationReference"("canonicalUrl");

-- CreateIndex
CREATE INDEX "GmpEvidencePublicationReference_lineageFingerprint_idx" ON "GmpEvidencePublicationReference"("lineageFingerprint");

-- CreateIndex
CREATE INDEX "GmpAnalyticsAttributionRegistry_projectId_updatedAt_idx" ON "GmpAnalyticsAttributionRegistry"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsRecommendationRegistry_projectId_updatedAt_idx" ON "GmpAnalyticsRecommendationRegistry"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAttributionAnalysis_workspaceId_createdAt_idx" ON "GmpAttributionAnalysis"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAttributionAnalysis_projectId_createdAt_idx" ON "GmpAttributionAnalysis"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAttributionAnalysis_siteId_createdAt_idx" ON "GmpAttributionAnalysis"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAttributionAnalysis_evidenceSnapshotId_createdAt_idx" ON "GmpAttributionAnalysis"("evidenceSnapshotId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAttributionAnalysis_inputFingerprint_idx" ON "GmpAttributionAnalysis"("inputFingerprint");

-- CreateIndex
CREATE INDEX "GmpAttributionResult_attributionAnalysisId_dimensionType_di_idx" ON "GmpAttributionResult"("attributionAnalysisId", "dimensionType", "dimensionValue");

-- CreateIndex
CREATE INDEX "GmpAttributionResult_workspaceId_createdAt_idx" ON "GmpAttributionResult"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAttributionResult_projectId_createdAt_idx" ON "GmpAttributionResult"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAttributionResult_evidenceSnapshotId_createdAt_idx" ON "GmpAttributionResult"("evidenceSnapshotId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAttributionResult_lineageFingerprint_idx" ON "GmpAttributionResult"("lineageFingerprint");

-- CreateIndex
CREATE INDEX "GmpRecommendationRuleCatalogEntry_projectId_createdAt_idx" ON "GmpRecommendationRuleCatalogEntry"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRuleCatalogEntry_registryVersion_idx" ON "GmpRecommendationRuleCatalogEntry"("registryVersion");

-- CreateIndex
CREATE UNIQUE INDEX "GmpRecommendationRuleCatalogEntry_projectId_ruleId_ruleVers_key" ON "GmpRecommendationRuleCatalogEntry"("projectId", "ruleId", "ruleVersion");

-- CreateIndex
CREATE INDEX "GmpRecommendationRun_workspaceId_createdAt_idx" ON "GmpRecommendationRun"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRun_projectId_createdAt_idx" ON "GmpRecommendationRun"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRun_siteId_createdAt_idx" ON "GmpRecommendationRun"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRun_evidenceSnapshotId_createdAt_idx" ON "GmpRecommendationRun"("evidenceSnapshotId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRun_replayOfRunId_createdAt_idx" ON "GmpRecommendationRun"("replayOfRunId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRun_inputFingerprint_idx" ON "GmpRecommendationRun"("inputFingerprint");

-- CreateIndex
CREATE INDEX "GmpRecommendationRuleExecution_recommendationRunId_createdA_idx" ON "GmpRecommendationRuleExecution"("recommendationRunId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRuleExecution_projectId_createdAt_idx" ON "GmpRecommendationRuleExecution"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRuleExecution_evidenceSnapshotId_createdAt_idx" ON "GmpRecommendationRuleExecution"("evidenceSnapshotId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRuleExecution_ruleId_ruleVersion_idx" ON "GmpRecommendationRuleExecution"("ruleId", "ruleVersion");

-- CreateIndex
CREATE INDEX "GmpRecommendationRecord_workspaceId_createdAt_idx" ON "GmpRecommendationRecord"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRecord_projectId_createdAt_idx" ON "GmpRecommendationRecord"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRecord_siteId_createdAt_idx" ON "GmpRecommendationRecord"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRecord_recommendationRunId_createdAt_idx" ON "GmpRecommendationRecord"("recommendationRunId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRecord_evidenceSnapshotId_createdAt_idx" ON "GmpRecommendationRecord"("evidenceSnapshotId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationRecord_ruleId_ruleVersion_idx" ON "GmpRecommendationRecord"("ruleId", "ruleVersion");

-- CreateIndex
CREATE INDEX "GmpRecommendationRecord_lineageFingerprint_idx" ON "GmpRecommendationRecord"("lineageFingerprint");

-- CreateIndex
CREATE INDEX "GmpRecommendationLifecycleEvent_recommendationId_createdAt_idx" ON "GmpRecommendationLifecycleEvent"("recommendationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationLifecycleEvent_workspaceId_createdAt_idx" ON "GmpRecommendationLifecycleEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationLifecycleEvent_projectId_createdAt_idx" ON "GmpRecommendationLifecycleEvent"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationLifecycleEvent_lifecycleState_createdAt_idx" ON "GmpRecommendationLifecycleEvent"("lifecycleState", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationReplayRun_workspaceId_createdAt_idx" ON "GmpRecommendationReplayRun"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationReplayRun_projectId_createdAt_idx" ON "GmpRecommendationReplayRun"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationReplayRun_evidenceSnapshotId_createdAt_idx" ON "GmpRecommendationReplayRun"("evidenceSnapshotId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpRecommendationReplayRun_recommendationRunId_createdAt_idx" ON "GmpRecommendationReplayRun"("recommendationRunId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpDecisionSupportSummary_workspaceId_createdAt_idx" ON "GmpDecisionSupportSummary"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpDecisionSupportSummary_projectId_createdAt_idx" ON "GmpDecisionSupportSummary"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpDecisionSupportSummary_evidenceSnapshotId_createdAt_idx" ON "GmpDecisionSupportSummary"("evidenceSnapshotId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpDecisionSupportSummary_summaryType_createdAt_idx" ON "GmpDecisionSupportSummary"("summaryType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GmpDecisionSupportSummary_summaryChecksum_idx" ON "GmpDecisionSupportSummary"("summaryChecksum");

-- CreateIndex
CREATE INDEX "GeaAgent_workspaceId_updatedAt_idx" ON "GeaAgent"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgent_organizationId_updatedAt_idx" ON "GeaAgent"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgent_lifecycleState_updatedAt_idx" ON "GeaAgent"("lifecycleState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentPlan_agentId_createdAt_idx" ON "GeaAgentPlan"("agentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentPlan_dependencyChecksum_idx" ON "GeaAgentPlan"("dependencyChecksum");

-- CreateIndex
CREATE INDEX "GeaAgentExecution_workspaceId_createdAt_idx" ON "GeaAgentExecution"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentExecution_agentId_createdAt_idx" ON "GeaAgentExecution"("agentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentExecution_projectId_createdAt_idx" ON "GeaAgentExecution"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentExecution_state_createdAt_idx" ON "GeaAgentExecution"("state", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentAction_executionId_createdAt_idx" ON "GeaAgentAction"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentAction_toolKey_createdAt_idx" ON "GeaAgentAction"("toolKey", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentAction_status_createdAt_idx" ON "GeaAgentAction"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentResult_executionId_producedAt_idx" ON "GeaAgentResult"("executionId", "producedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentResult_status_producedAt_idx" ON "GeaAgentResult"("status", "producedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentAuditRecord_executionId_createdAt_idx" ON "GeaAgentAuditRecord"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentAuditRecord_eventType_createdAt_idx" ON "GeaAgentAuditRecord"("eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentReplay_executionId_createdAt_idx" ON "GeaAgentReplay"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentReplay_replayOfExecutionId_createdAt_idx" ON "GeaAgentReplay"("replayOfExecutionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentReplay_replayChecksum_idx" ON "GeaAgentReplay"("replayChecksum");

-- CreateIndex
CREATE INDEX "GeaAgentMemoryReference_referenceType_createdAt_idx" ON "GeaAgentMemoryReference"("referenceType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentMemoryReference_referenceId_createdAt_idx" ON "GeaAgentMemoryReference"("referenceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentApproval_executionId_createdAt_idx" ON "GeaAgentApproval"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaAgentApproval_state_createdAt_idx" ON "GeaAgentApproval"("state", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolDefinition_workspaceId_updatedAt_idx" ON "GeaToolDefinition"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolDefinition_organizationId_updatedAt_idx" ON "GeaToolDefinition"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolDefinition_category_updatedAt_idx" ON "GeaToolDefinition"("category", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolDefinition_lifecycleState_updatedAt_idx" ON "GeaToolDefinition"("lifecycleState", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GeaToolDefinition_workspaceId_toolKey_key" ON "GeaToolDefinition"("workspaceId", "toolKey");

-- CreateIndex
CREATE INDEX "GeaToolExecution_workspaceId_startedAt_idx" ON "GeaToolExecution"("workspaceId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolExecution_projectId_startedAt_idx" ON "GeaToolExecution"("projectId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolExecution_toolId_startedAt_idx" ON "GeaToolExecution"("toolId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolExecution_agentId_startedAt_idx" ON "GeaToolExecution"("agentId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolExecution_state_startedAt_idx" ON "GeaToolExecution"("state", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolExecution_immutableLineage_idx" ON "GeaToolExecution"("immutableLineage");

-- CreateIndex
CREATE INDEX "GeaToolExecutionTimeline_executionId_sequence_idx" ON "GeaToolExecutionTimeline"("executionId", "sequence");

-- CreateIndex
CREATE INDEX "GeaToolExecutionTimeline_executionId_createdAt_idx" ON "GeaToolExecutionTimeline"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolReplay_executionId_createdAt_idx" ON "GeaToolReplay"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolReplay_toolVersionId_createdAt_idx" ON "GeaToolReplay"("toolVersionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolReplay_replayChecksum_idx" ON "GeaToolReplay"("replayChecksum");

-- CreateIndex
CREATE INDEX "GeaToolHealth_toolId_computedAt_idx" ON "GeaToolHealth"("toolId", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolHealth_healthStatus_computedAt_idx" ON "GeaToolHealth"("healthStatus", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolValidation_toolVersionId_validatedAt_idx" ON "GeaToolValidation"("toolVersionId", "validatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolValidation_validationStatus_validatedAt_idx" ON "GeaToolValidation"("validationStatus", "validatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolLifecycleEvent_toolId_createdAt_idx" ON "GeaToolLifecycleEvent"("toolId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolLifecycleEvent_nextState_createdAt_idx" ON "GeaToolLifecycleEvent"("nextState", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolPolicyHistory_toolVersionId_changedAt_idx" ON "GeaToolPolicyHistory"("toolVersionId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaToolPolicyHistory_nextPolicyChecksum_idx" ON "GeaToolPolicyHistory"("nextPolicyChecksum");

-- CreateIndex
CREATE INDEX "GeaMemorySource_workspaceId_updatedAt_idx" ON "GeaMemorySource"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemorySource_organizationId_updatedAt_idx" ON "GeaMemorySource"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemorySource_sourceType_updatedAt_idx" ON "GeaMemorySource"("sourceType", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemorySource_sourceId_updatedAt_idx" ON "GeaMemorySource"("sourceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemoryReference_workspaceId_updatedAt_idx" ON "GeaMemoryReference"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemoryReference_organizationId_updatedAt_idx" ON "GeaMemoryReference"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemoryReference_projectId_updatedAt_idx" ON "GeaMemoryReference"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemoryReference_registryIdentity_idx" ON "GeaMemoryReference"("registryIdentity");

-- CreateIndex
CREATE INDEX "GeaMemoryReference_referenceType_updatedAt_idx" ON "GeaMemoryReference"("referenceType", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemoryReference_referenceId_updatedAt_idx" ON "GeaMemoryReference"("referenceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemoryVersion_memoryReferenceId_createdAt_idx" ON "GeaMemoryVersion"("memoryReferenceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemoryVersion_checksum_idx" ON "GeaMemoryVersion"("checksum");

-- CreateIndex
CREATE INDEX "GeaMemoryCollection_workspaceId_updatedAt_idx" ON "GeaMemoryCollection"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemoryCollection_organizationId_updatedAt_idx" ON "GeaMemoryCollection"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemoryCollection_lifecycleState_updatedAt_idx" ON "GeaMemoryCollection"("lifecycleState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemorySnapshot_workspaceId_createdAt_idx" ON "GeaMemorySnapshot"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemorySnapshot_organizationId_createdAt_idx" ON "GeaMemorySnapshot"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemorySnapshot_projectId_createdAt_idx" ON "GeaMemorySnapshot"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaMemorySnapshot_snapshotChecksum_idx" ON "GeaMemorySnapshot"("snapshotChecksum");

-- CreateIndex
CREATE INDEX "GeaContextPackage_workspaceId_createdAt_idx" ON "GeaContextPackage"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextPackage_organizationId_createdAt_idx" ON "GeaContextPackage"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextPackage_projectId_createdAt_idx" ON "GeaContextPackage"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextPackage_agentId_createdAt_idx" ON "GeaContextPackage"("agentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextPackage_cacheKey_idx" ON "GeaContextPackage"("cacheKey");

-- CreateIndex
CREATE INDEX "GeaContextPackage_packageChecksum_idx" ON "GeaContextPackage"("packageChecksum");

-- CreateIndex
CREATE INDEX "GeaContextValidation_contextPackageId_validatedAt_idx" ON "GeaContextValidation"("contextPackageId", "validatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextValidation_validationStatus_validatedAt_idx" ON "GeaContextValidation"("validationStatus", "validatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextReplay_contextPackageId_createdAt_idx" ON "GeaContextReplay"("contextPackageId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextReplay_replayChecksum_idx" ON "GeaContextReplay"("replayChecksum");

-- CreateIndex
CREATE INDEX "GeaContextCache_workspaceId_updatedAt_idx" ON "GeaContextCache"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextCache_organizationId_updatedAt_idx" ON "GeaContextCache"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextCache_cacheKey_idx" ON "GeaContextCache"("cacheKey");

-- CreateIndex
CREATE INDEX "GeaContextCache_cacheStatus_updatedAt_idx" ON "GeaContextCache"("cacheStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextHealth_workspaceId_computedAt_idx" ON "GeaContextHealth"("workspaceId", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextHealth_organizationId_computedAt_idx" ON "GeaContextHealth"("organizationId", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaContextHealth_healthStatus_computedAt_idx" ON "GeaContextHealth"("healthStatus", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestration_workspaceId_updatedAt_idx" ON "GeaOrchestration"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestration_organizationId_updatedAt_idx" ON "GeaOrchestration"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestration_projectId_updatedAt_idx" ON "GeaOrchestration"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestration_lifecycleState_updatedAt_idx" ON "GeaOrchestration"("lifecycleState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaWorkflowDefinition_workspaceId_updatedAt_idx" ON "GeaWorkflowDefinition"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaWorkflowDefinition_organizationId_updatedAt_idx" ON "GeaWorkflowDefinition"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaWorkflowDefinition_orchestrationId_updatedAt_idx" ON "GeaWorkflowDefinition"("orchestrationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaWorkflowDefinition_workflowKey_idx" ON "GeaWorkflowDefinition"("workflowKey");

-- CreateIndex
CREATE INDEX "GeaWorkflowDefinition_lifecycleState_updatedAt_idx" ON "GeaWorkflowDefinition"("lifecycleState", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaWorkflowVersion_workflowId_publishedAt_idx" ON "GeaWorkflowVersion"("workflowId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaWorkflowVersion_definitionChecksum_idx" ON "GeaWorkflowVersion"("definitionChecksum");

-- CreateIndex
CREATE INDEX "GeaOrchestrationExecution_workspaceId_startedAt_idx" ON "GeaOrchestrationExecution"("workspaceId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationExecution_organizationId_startedAt_idx" ON "GeaOrchestrationExecution"("organizationId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationExecution_projectId_startedAt_idx" ON "GeaOrchestrationExecution"("projectId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationExecution_orchestrationId_startedAt_idx" ON "GeaOrchestrationExecution"("orchestrationId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationExecution_workflowId_startedAt_idx" ON "GeaOrchestrationExecution"("workflowId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationExecution_state_startedAt_idx" ON "GeaOrchestrationExecution"("state", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationExecution_immutableLineage_idx" ON "GeaOrchestrationExecution"("immutableLineage");

-- CreateIndex
CREATE INDEX "GeaOrchestrationDelegation_executionId_delegatedAt_idx" ON "GeaOrchestrationDelegation"("executionId", "delegatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationDelegation_toAgentId_delegatedAt_idx" ON "GeaOrchestrationDelegation"("toAgentId", "delegatedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationApproval_executionId_createdAt_idx" ON "GeaOrchestrationApproval"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationApproval_state_createdAt_idx" ON "GeaOrchestrationApproval"("state", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationCompensation_executionId_createdAt_idx" ON "GeaOrchestrationCompensation"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationCompensation_status_createdAt_idx" ON "GeaOrchestrationCompensation"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationSnapshot_executionId_sequence_idx" ON "GeaOrchestrationSnapshot"("executionId", "sequence");

-- CreateIndex
CREATE INDEX "GeaOrchestrationSnapshot_executionId_createdAt_idx" ON "GeaOrchestrationSnapshot"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationReplay_executionId_createdAt_idx" ON "GeaOrchestrationReplay"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationReplay_replayChecksum_idx" ON "GeaOrchestrationReplay"("replayChecksum");

-- CreateIndex
CREATE INDEX "GeaOrchestrationHealth_workspaceId_computedAt_idx" ON "GeaOrchestrationHealth"("workspaceId", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationHealth_organizationId_computedAt_idx" ON "GeaOrchestrationHealth"("organizationId", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "GeaOrchestrationHealth_status_computedAt_idx" ON "GeaOrchestrationHealth"("status", "computedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveBriefing_workspaceId_createdAt_idx" ON "GbaExecutiveBriefing"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveBriefing_organizationId_createdAt_idx" ON "GbaExecutiveBriefing"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveBriefing_period_createdAt_idx" ON "GbaExecutiveBriefing"("period", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveBriefing_replayChecksum_idx" ON "GbaExecutiveBriefing"("replayChecksum");

-- CreateIndex
CREATE INDEX "GbaExecutiveGoal_workspaceId_updatedAt_idx" ON "GbaExecutiveGoal"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveGoal_organizationId_updatedAt_idx" ON "GbaExecutiveGoal"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveGoal_status_updatedAt_idx" ON "GbaExecutiveGoal"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveGoalHistory_workspaceId_changedAt_idx" ON "GbaExecutiveGoalHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveGoalHistory_goalId_changedAt_idx" ON "GbaExecutiveGoalHistory"("goalId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveGoalHistory_immutableLineage_idx" ON "GbaExecutiveGoalHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaExecutiveKpi_workspaceId_updatedAt_idx" ON "GbaExecutiveKpi"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveKpi_organizationId_updatedAt_idx" ON "GbaExecutiveKpi"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveKpi_name_updatedAt_idx" ON "GbaExecutiveKpi"("name", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveKpiHistory_workspaceId_measuredAt_idx" ON "GbaExecutiveKpiHistory"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveKpiHistory_kpiId_measuredAt_idx" ON "GbaExecutiveKpiHistory"("kpiId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveKpiHistory_immutableLineage_idx" ON "GbaExecutiveKpiHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaExecutiveRecommendation_workspaceId_createdAt_idx" ON "GbaExecutiveRecommendation"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRecommendation_organizationId_createdAt_idx" ON "GbaExecutiveRecommendation"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRecommendation_category_createdAt_idx" ON "GbaExecutiveRecommendation"("category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRecommendation_reviewed_createdAt_idx" ON "GbaExecutiveRecommendation"("reviewed", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRecommendation_deterministicChecksum_idx" ON "GbaExecutiveRecommendation"("deterministicChecksum");

-- CreateIndex
CREATE INDEX "GbaExecutiveRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaExecutiveRecommendationReview"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRecommendationReview_recommendationId_reviewedA_idx" ON "GbaExecutiveRecommendationReview"("recommendationId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRecommendationReview_immutableLineage_idx" ON "GbaExecutiveRecommendationReview"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaExecutiveRisk_workspaceId_updatedAt_idx" ON "GbaExecutiveRisk"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRisk_organizationId_updatedAt_idx" ON "GbaExecutiveRisk"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRisk_category_updatedAt_idx" ON "GbaExecutiveRisk"("category", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRisk_status_updatedAt_idx" ON "GbaExecutiveRisk"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRiskHistory_workspaceId_reviewedAt_idx" ON "GbaExecutiveRiskHistory"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRiskHistory_riskId_reviewedAt_idx" ON "GbaExecutiveRiskHistory"("riskId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveRiskHistory_immutableLineage_idx" ON "GbaExecutiveRiskHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaExecutiveOpportunity_workspaceId_updatedAt_idx" ON "GbaExecutiveOpportunity"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveOpportunity_organizationId_updatedAt_idx" ON "GbaExecutiveOpportunity"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveOpportunity_category_updatedAt_idx" ON "GbaExecutiveOpportunity"("category", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveOpportunity_status_updatedAt_idx" ON "GbaExecutiveOpportunity"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveOpportunityHistory_workspaceId_changedAt_idx" ON "GbaExecutiveOpportunityHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveOpportunityHistory_opportunityId_changedAt_idx" ON "GbaExecutiveOpportunityHistory"("opportunityId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveOpportunityHistory_immutableLineage_idx" ON "GbaExecutiveOpportunityHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaExecutiveDelegation_workspaceId_createdAt_idx" ON "GbaExecutiveDelegation"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveDelegation_organizationId_createdAt_idx" ON "GbaExecutiveDelegation"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveDelegation_targetAgent_createdAt_idx" ON "GbaExecutiveDelegation"("targetAgent", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveDelegation_orchestrationExecutionId_idx" ON "GbaExecutiveDelegation"("orchestrationExecutionId");

-- CreateIndex
CREATE INDEX "GbaExecutiveApproval_workspaceId_createdAt_idx" ON "GbaExecutiveApproval"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveApproval_organizationId_createdAt_idx" ON "GbaExecutiveApproval"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveApproval_state_createdAt_idx" ON "GbaExecutiveApproval"("state", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveTimelineEvent_workspaceId_createdAt_idx" ON "GbaExecutiveTimelineEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveTimelineEvent_organizationId_createdAt_idx" ON "GbaExecutiveTimelineEvent"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveTimelineEvent_eventType_createdAt_idx" ON "GbaExecutiveTimelineEvent"("eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveHealth_workspaceId_generatedAt_idx" ON "GbaExecutiveHealth"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveHealth_organizationId_generatedAt_idx" ON "GbaExecutiveHealth"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaExecutiveHealth_status_generatedAt_idx" ON "GbaExecutiveHealth"("status", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWorkOrder_workspaceId_updatedAt_idx" ON "GbaOperationsWorkOrder"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWorkOrder_organizationId_updatedAt_idx" ON "GbaOperationsWorkOrder"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWorkOrder_status_updatedAt_idx" ON "GbaOperationsWorkOrder"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWorkOrderHistory_workspaceId_changedAt_idx" ON "GbaOperationsWorkOrderHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWorkOrderHistory_workOrderId_changedAt_idx" ON "GbaOperationsWorkOrderHistory"("workOrderId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWorkOrderHistory_immutableLineage_idx" ON "GbaOperationsWorkOrderHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaOperationsProductionSchedule_workspaceId_sequence_idx" ON "GbaOperationsProductionSchedule"("workspaceId", "sequence");

-- CreateIndex
CREATE INDEX "GbaOperationsProductionSchedule_organizationId_createdAt_idx" ON "GbaOperationsProductionSchedule"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsProductionSchedule_bottleneckRisk_createdAt_idx" ON "GbaOperationsProductionSchedule"("bottleneckRisk", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsInventoryRecord_workspaceId_updatedAt_idx" ON "GbaOperationsInventoryRecord"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsInventoryRecord_organizationId_updatedAt_idx" ON "GbaOperationsInventoryRecord"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsInventoryRecord_sku_updatedAt_idx" ON "GbaOperationsInventoryRecord"("sku", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsInventoryHistory_workspaceId_changedAt_idx" ON "GbaOperationsInventoryHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsInventoryHistory_inventoryRecordId_changedAt_idx" ON "GbaOperationsInventoryHistory"("inventoryRecordId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsInventoryHistory_immutableLineage_idx" ON "GbaOperationsInventoryHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaOperationsWarehouseOperation_workspaceId_updatedAt_idx" ON "GbaOperationsWarehouseOperation"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWarehouseOperation_organizationId_updatedAt_idx" ON "GbaOperationsWarehouseOperation"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWarehouseOperation_operationType_updatedAt_idx" ON "GbaOperationsWarehouseOperation"("operationType", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWarehouseHistory_workspaceId_changedAt_idx" ON "GbaOperationsWarehouseHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWarehouseHistory_warehouseOperationId_changedA_idx" ON "GbaOperationsWarehouseHistory"("warehouseOperationId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsWarehouseHistory_immutableLineage_idx" ON "GbaOperationsWarehouseHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaOperationsPurchasingRecord_workspaceId_updatedAt_idx" ON "GbaOperationsPurchasingRecord"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsPurchasingRecord_organizationId_updatedAt_idx" ON "GbaOperationsPurchasingRecord"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsPurchasingRecord_vendorId_updatedAt_idx" ON "GbaOperationsPurchasingRecord"("vendorId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsPurchasingRecord_status_updatedAt_idx" ON "GbaOperationsPurchasingRecord"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsPurchasingHistory_workspaceId_changedAt_idx" ON "GbaOperationsPurchasingHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsPurchasingHistory_purchasingId_changedAt_idx" ON "GbaOperationsPurchasingHistory"("purchasingId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsPurchasingHistory_immutableLineage_idx" ON "GbaOperationsPurchasingHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaOperationsShippingRecord_workspaceId_updatedAt_idx" ON "GbaOperationsShippingRecord"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsShippingRecord_organizationId_updatedAt_idx" ON "GbaOperationsShippingRecord"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsShippingRecord_shipmentType_updatedAt_idx" ON "GbaOperationsShippingRecord"("shipmentType", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsShippingRecord_status_updatedAt_idx" ON "GbaOperationsShippingRecord"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsShippingHistory_workspaceId_changedAt_idx" ON "GbaOperationsShippingHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsShippingHistory_shippingId_changedAt_idx" ON "GbaOperationsShippingHistory"("shippingId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsShippingHistory_immutableLineage_idx" ON "GbaOperationsShippingHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaOperationsCapacityRecord_workspaceId_measuredAt_idx" ON "GbaOperationsCapacityRecord"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsCapacityRecord_organizationId_measuredAt_idx" ON "GbaOperationsCapacityRecord"("organizationId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsCapacityHistory_workspaceId_measuredAt_idx" ON "GbaOperationsCapacityHistory"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsCapacityHistory_capacityId_measuredAt_idx" ON "GbaOperationsCapacityHistory"("capacityId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsCapacityHistory_immutableLineage_idx" ON "GbaOperationsCapacityHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaOperationsKpi_workspaceId_updatedAt_idx" ON "GbaOperationsKpi"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsKpi_organizationId_updatedAt_idx" ON "GbaOperationsKpi"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsKpi_name_updatedAt_idx" ON "GbaOperationsKpi"("name", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsKpiHistory_workspaceId_measuredAt_idx" ON "GbaOperationsKpiHistory"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsKpiHistory_operationsKpiId_measuredAt_idx" ON "GbaOperationsKpiHistory"("operationsKpiId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsKpiHistory_immutableLineage_idx" ON "GbaOperationsKpiHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaOperationsRecommendation_workspaceId_createdAt_idx" ON "GbaOperationsRecommendation"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsRecommendation_organizationId_createdAt_idx" ON "GbaOperationsRecommendation"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsRecommendation_category_createdAt_idx" ON "GbaOperationsRecommendation"("category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsRecommendation_reviewed_createdAt_idx" ON "GbaOperationsRecommendation"("reviewed", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsRecommendation_deterministicChecksum_idx" ON "GbaOperationsRecommendation"("deterministicChecksum");

-- CreateIndex
CREATE INDEX "GbaOperationsRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaOperationsRecommendationReview"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsRecommendationReview_operationsRecommendationI_idx" ON "GbaOperationsRecommendationReview"("operationsRecommendationId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsRecommendationReview_immutableLineage_idx" ON "GbaOperationsRecommendationReview"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaOperationsVendorMetric_workspaceId_measuredAt_idx" ON "GbaOperationsVendorMetric"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsVendorMetric_organizationId_measuredAt_idx" ON "GbaOperationsVendorMetric"("organizationId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsVendorMetric_vendorId_measuredAt_idx" ON "GbaOperationsVendorMetric"("vendorId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsVendorMetricHistory_workspaceId_measuredAt_idx" ON "GbaOperationsVendorMetricHistory"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsVendorMetricHistory_vendorMetricId_measuredAt_idx" ON "GbaOperationsVendorMetricHistory"("vendorMetricId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsVendorMetricHistory_immutableLineage_idx" ON "GbaOperationsVendorMetricHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaOperationsTimelineEvent_workspaceId_createdAt_idx" ON "GbaOperationsTimelineEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsTimelineEvent_organizationId_createdAt_idx" ON "GbaOperationsTimelineEvent"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsTimelineEvent_eventType_createdAt_idx" ON "GbaOperationsTimelineEvent"("eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsHealth_workspaceId_generatedAt_idx" ON "GbaOperationsHealth"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsHealth_organizationId_generatedAt_idx" ON "GbaOperationsHealth"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsHealth_status_generatedAt_idx" ON "GbaOperationsHealth"("status", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsExecutiveSummary_workspaceId_createdAt_idx" ON "GbaOperationsExecutiveSummary"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsExecutiveSummary_organizationId_createdAt_idx" ON "GbaOperationsExecutiveSummary"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaOperationsExecutiveSummary_period_createdAt_idx" ON "GbaOperationsExecutiveSummary"("period", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingBom_workspaceId_updatedAt_idx" ON "GbaManufacturingBom"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingBom_organizationId_updatedAt_idx" ON "GbaManufacturingBom"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingBom_sku_updatedAt_idx" ON "GbaManufacturingBom"("sku", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingBomHistory_workspaceId_changedAt_idx" ON "GbaManufacturingBomHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingBomHistory_bomId_changedAt_idx" ON "GbaManufacturingBomHistory"("bomId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingBomHistory_immutableLineage_idx" ON "GbaManufacturingBomHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaManufacturingRouting_workspaceId_updatedAt_idx" ON "GbaManufacturingRouting"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRouting_organizationId_updatedAt_idx" ON "GbaManufacturingRouting"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRouting_sku_updatedAt_idx" ON "GbaManufacturingRouting"("sku", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRoutingHistory_workspaceId_changedAt_idx" ON "GbaManufacturingRoutingHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRoutingHistory_routingId_changedAt_idx" ON "GbaManufacturingRoutingHistory"("routingId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRoutingHistory_immutableLineage_idx" ON "GbaManufacturingRoutingHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaManufacturingProductionOrder_workspaceId_updatedAt_idx" ON "GbaManufacturingProductionOrder"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingProductionOrder_organizationId_updatedAt_idx" ON "GbaManufacturingProductionOrder"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingProductionOrder_status_updatedAt_idx" ON "GbaManufacturingProductionOrder"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingProductionOrderHistory_workspaceId_changedA_idx" ON "GbaManufacturingProductionOrderHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingProductionOrderHistory_productionOrderId_ch_idx" ON "GbaManufacturingProductionOrderHistory"("productionOrderId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingProductionOrderHistory_immutableLineage_idx" ON "GbaManufacturingProductionOrderHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaManufacturingMachine_workspaceId_updatedAt_idx" ON "GbaManufacturingMachine"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingMachine_organizationId_updatedAt_idx" ON "GbaManufacturingMachine"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingMachine_status_updatedAt_idx" ON "GbaManufacturingMachine"("status", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingMachineHistory_workspaceId_changedAt_idx" ON "GbaManufacturingMachineHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingMachineHistory_machineId_changedAt_idx" ON "GbaManufacturingMachineHistory"("machineId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingMachineHistory_immutableLineage_idx" ON "GbaManufacturingMachineHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaManufacturingLabor_workspaceId_updatedAt_idx" ON "GbaManufacturingLabor"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingLabor_organizationId_updatedAt_idx" ON "GbaManufacturingLabor"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingLabor_operatorId_updatedAt_idx" ON "GbaManufacturingLabor"("operatorId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingLaborHistory_workspaceId_changedAt_idx" ON "GbaManufacturingLaborHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingLaborHistory_laborRecordId_changedAt_idx" ON "GbaManufacturingLaborHistory"("laborRecordId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingLaborHistory_immutableLineage_idx" ON "GbaManufacturingLaborHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaManufacturingMaterialConsumption_workspaceId_measuredAt_idx" ON "GbaManufacturingMaterialConsumption"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingMaterialConsumption_organizationId_measured_idx" ON "GbaManufacturingMaterialConsumption"("organizationId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingMaterialConsumption_productionOrderId_measu_idx" ON "GbaManufacturingMaterialConsumption"("productionOrderId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingQualityEvent_workspaceId_recordedAt_idx" ON "GbaManufacturingQualityEvent"("workspaceId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingQualityEvent_organizationId_recordedAt_idx" ON "GbaManufacturingQualityEvent"("organizationId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingQualityEvent_severity_recordedAt_idx" ON "GbaManufacturingQualityEvent"("severity", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingCostRecord_workspaceId_measuredAt_idx" ON "GbaManufacturingCostRecord"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingCostRecord_organizationId_measuredAt_idx" ON "GbaManufacturingCostRecord"("organizationId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingCostRecord_productionOrderId_measuredAt_idx" ON "GbaManufacturingCostRecord"("productionOrderId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingKpi_workspaceId_updatedAt_idx" ON "GbaManufacturingKpi"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingKpi_organizationId_updatedAt_idx" ON "GbaManufacturingKpi"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingKpi_name_updatedAt_idx" ON "GbaManufacturingKpi"("name", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingKpiHistory_workspaceId_measuredAt_idx" ON "GbaManufacturingKpiHistory"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingKpiHistory_manufacturingKpiId_measuredAt_idx" ON "GbaManufacturingKpiHistory"("manufacturingKpiId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingKpiHistory_immutableLineage_idx" ON "GbaManufacturingKpiHistory"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaManufacturingRecommendation_workspaceId_createdAt_idx" ON "GbaManufacturingRecommendation"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRecommendation_organizationId_createdAt_idx" ON "GbaManufacturingRecommendation"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRecommendation_category_createdAt_idx" ON "GbaManufacturingRecommendation"("category", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRecommendation_reviewed_createdAt_idx" ON "GbaManufacturingRecommendation"("reviewed", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRecommendation_deterministicChecksum_idx" ON "GbaManufacturingRecommendation"("deterministicChecksum");

-- CreateIndex
CREATE INDEX "GbaManufacturingRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaManufacturingRecommendationReview"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRecommendationReview_manufacturingRecommend_idx" ON "GbaManufacturingRecommendationReview"("manufacturingRecommendationId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingRecommendationReview_immutableLineage_idx" ON "GbaManufacturingRecommendationReview"("immutableLineage");

-- CreateIndex
CREATE INDEX "GbaManufacturingOperationsSignal_workspaceId_publishedAt_idx" ON "GbaManufacturingOperationsSignal"("workspaceId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingOperationsSignal_organizationId_publishedAt_idx" ON "GbaManufacturingOperationsSignal"("organizationId", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingOperationsSignal_machineHealthStatus_publis_idx" ON "GbaManufacturingOperationsSignal"("machineHealthStatus", "publishedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingExecutiveReport_workspaceId_createdAt_idx" ON "GbaManufacturingExecutiveReport"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingExecutiveReport_organizationId_createdAt_idx" ON "GbaManufacturingExecutiveReport"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingExecutiveReport_period_createdAt_idx" ON "GbaManufacturingExecutiveReport"("period", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingTimelineEvent_workspaceId_createdAt_idx" ON "GbaManufacturingTimelineEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingTimelineEvent_organizationId_createdAt_idx" ON "GbaManufacturingTimelineEvent"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingTimelineEvent_eventType_createdAt_idx" ON "GbaManufacturingTimelineEvent"("eventType", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingHealth_workspaceId_generatedAt_idx" ON "GbaManufacturingHealth"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingHealth_organizationId_generatedAt_idx" ON "GbaManufacturingHealth"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaManufacturingHealth_status_generatedAt_idx" ON "GbaManufacturingHealth"("status", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingCampaignPlan_workspaceId_updatedAt_idx" ON "GbaMarketingCampaignPlan"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingCampaignPlan_organizationId_updatedAt_idx" ON "GbaMarketingCampaignPlan"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingCampaignPlan_projectId_updatedAt_idx" ON "GbaMarketingCampaignPlan"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingCampaignPlanHistory_workspaceId_changedAt_idx" ON "GbaMarketingCampaignPlanHistory"("workspaceId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingCampaignPlanHistory_marketingCampaignPlanId_cha_idx" ON "GbaMarketingCampaignPlanHistory"("marketingCampaignPlanId", "changedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingContentStrategy_workspaceId_updatedAt_idx" ON "GbaMarketingContentStrategy"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingContentStrategy_organizationId_updatedAt_idx" ON "GbaMarketingContentStrategy"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingContentStrategy_projectId_updatedAt_idx" ON "GbaMarketingContentStrategy"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingSeoIntelligence_workspaceId_createdAt_idx" ON "GbaMarketingSeoIntelligence"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingSeoIntelligence_organizationId_createdAt_idx" ON "GbaMarketingSeoIntelligence"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingSeoIntelligence_projectId_createdAt_idx" ON "GbaMarketingSeoIntelligence"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingBrandGovernanceReview_workspaceId_reviewedAt_idx" ON "GbaMarketingBrandGovernanceReview"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingBrandGovernanceReview_organizationId_reviewedAt_idx" ON "GbaMarketingBrandGovernanceReview"("organizationId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingBrandGovernanceReview_projectId_reviewedAt_idx" ON "GbaMarketingBrandGovernanceReview"("projectId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingAnalyticsSnapshot_workspaceId_createdAt_idx" ON "GbaMarketingAnalyticsSnapshot"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingAnalyticsSnapshot_organizationId_createdAt_idx" ON "GbaMarketingAnalyticsSnapshot"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingAnalyticsSnapshot_projectId_createdAt_idx" ON "GbaMarketingAnalyticsSnapshot"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingRecommendation_workspaceId_createdAt_idx" ON "GbaMarketingRecommendation"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingRecommendation_organizationId_createdAt_idx" ON "GbaMarketingRecommendation"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingRecommendation_projectId_createdAt_idx" ON "GbaMarketingRecommendation"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaMarketingRecommendationReview"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingRecommendationReview_marketingRecommendationId__idx" ON "GbaMarketingRecommendationReview"("marketingRecommendationId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingTimelineEvent_workspaceId_createdAt_idx" ON "GbaMarketingTimelineEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingTimelineEvent_organizationId_createdAt_idx" ON "GbaMarketingTimelineEvent"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingTimelineEvent_projectId_createdAt_idx" ON "GbaMarketingTimelineEvent"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingExecutiveReport_workspaceId_createdAt_idx" ON "GbaMarketingExecutiveReport"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingExecutiveReport_organizationId_createdAt_idx" ON "GbaMarketingExecutiveReport"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingExecutiveReport_projectId_createdAt_idx" ON "GbaMarketingExecutiveReport"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingHealth_workspaceId_generatedAt_idx" ON "GbaMarketingHealth"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingHealth_organizationId_generatedAt_idx" ON "GbaMarketingHealth"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaMarketingHealth_projectId_generatedAt_idx" ON "GbaMarketingHealth"("projectId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesPipelineRecord_workspaceId_updatedAt_idx" ON "GbaSalesPipelineRecord"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesPipelineRecord_organizationId_updatedAt_idx" ON "GbaSalesPipelineRecord"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesPipelineRecord_accountId_updatedAt_idx" ON "GbaSalesPipelineRecord"("accountId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesForecastSnapshot_workspaceId_createdAt_idx" ON "GbaSalesForecastSnapshot"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesForecastSnapshot_organizationId_createdAt_idx" ON "GbaSalesForecastSnapshot"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesForecastSnapshot_period_createdAt_idx" ON "GbaSalesForecastSnapshot"("period", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesAccountIntelligence_workspaceId_updatedAt_idx" ON "GbaSalesAccountIntelligence"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesAccountIntelligence_organizationId_updatedAt_idx" ON "GbaSalesAccountIntelligence"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesAccountIntelligence_accountId_updatedAt_idx" ON "GbaSalesAccountIntelligence"("accountId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesRecommendation_workspaceId_createdAt_idx" ON "GbaSalesRecommendation"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesRecommendation_organizationId_createdAt_idx" ON "GbaSalesRecommendation"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesRecommendation_status_createdAt_idx" ON "GbaSalesRecommendation"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaSalesRecommendationReview"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesRecommendationReview_salesRecommendationId_reviewed_idx" ON "GbaSalesRecommendationReview"("salesRecommendationId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesTimelineEvent_workspaceId_createdAt_idx" ON "GbaSalesTimelineEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesTimelineEvent_organizationId_createdAt_idx" ON "GbaSalesTimelineEvent"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesHealth_workspaceId_generatedAt_idx" ON "GbaSalesHealth"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesHealth_organizationId_generatedAt_idx" ON "GbaSalesHealth"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaSalesHealth_status_generatedAt_idx" ON "GbaSalesHealth"("status", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceGeneralLedgerEntry_workspaceId_postedAt_idx" ON "GbaFinanceGeneralLedgerEntry"("workspaceId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceGeneralLedgerEntry_organizationId_postedAt_idx" ON "GbaFinanceGeneralLedgerEntry"("organizationId", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceGeneralLedgerEntry_accountCode_postedAt_idx" ON "GbaFinanceGeneralLedgerEntry"("accountCode", "postedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceChartOfAccount_workspaceId_accountCode_idx" ON "GbaFinanceChartOfAccount"("workspaceId", "accountCode");

-- CreateIndex
CREATE INDEX "GbaFinanceChartOfAccount_organizationId_updatedAt_idx" ON "GbaFinanceChartOfAccount"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceReceivable_workspaceId_updatedAt_idx" ON "GbaFinanceReceivable"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceReceivable_organizationId_updatedAt_idx" ON "GbaFinanceReceivable"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceReceivable_customerId_updatedAt_idx" ON "GbaFinanceReceivable"("customerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinancePayable_workspaceId_updatedAt_idx" ON "GbaFinancePayable"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinancePayable_organizationId_updatedAt_idx" ON "GbaFinancePayable"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinancePayable_vendorId_updatedAt_idx" ON "GbaFinancePayable"("vendorId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceBudget_workspaceId_updatedAt_idx" ON "GbaFinanceBudget"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceBudget_organizationId_updatedAt_idx" ON "GbaFinanceBudget"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceBudget_period_updatedAt_idx" ON "GbaFinanceBudget"("period", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceProfitabilitySnapshot_workspaceId_capturedAt_idx" ON "GbaFinanceProfitabilitySnapshot"("workspaceId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceProfitabilitySnapshot_organizationId_capturedAt_idx" ON "GbaFinanceProfitabilitySnapshot"("organizationId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceProfitabilitySnapshot_dimension_capturedAt_idx" ON "GbaFinanceProfitabilitySnapshot"("dimension", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceForecast_workspaceId_generatedAt_idx" ON "GbaFinanceForecast"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceForecast_organizationId_generatedAt_idx" ON "GbaFinanceForecast"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceForecast_period_generatedAt_idx" ON "GbaFinanceForecast"("period", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceKpi_workspaceId_measuredAt_idx" ON "GbaFinanceKpi"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceKpi_organizationId_measuredAt_idx" ON "GbaFinanceKpi"("organizationId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceKpi_name_measuredAt_idx" ON "GbaFinanceKpi"("name", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceRecommendation_workspaceId_createdAt_idx" ON "GbaFinanceRecommendation"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceRecommendation_organizationId_createdAt_idx" ON "GbaFinanceRecommendation"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceRecommendation_status_createdAt_idx" ON "GbaFinanceRecommendation"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceRecommendationReview_workspaceId_reviewedAt_idx" ON "GbaFinanceRecommendationReview"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceRecommendationReview_financeRecommendationId_revi_idx" ON "GbaFinanceRecommendationReview"("financeRecommendationId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceExecutiveReport_workspaceId_createdAt_idx" ON "GbaFinanceExecutiveReport"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceExecutiveReport_organizationId_createdAt_idx" ON "GbaFinanceExecutiveReport"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceExecutiveReport_period_createdAt_idx" ON "GbaFinanceExecutiveReport"("period", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceHealth_workspaceId_generatedAt_idx" ON "GbaFinanceHealth"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceHealth_organizationId_generatedAt_idx" ON "GbaFinanceHealth"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceHealth_status_generatedAt_idx" ON "GbaFinanceHealth"("status", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceTimelineEvent_workspaceId_createdAt_idx" ON "GbaFinanceTimelineEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaFinanceTimelineEvent_organizationId_createdAt_idx" ON "GbaFinanceTimelineEvent"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessOnboarding_workspaceId_updatedAt_idx" ON "GbaCustomerSuccessOnboarding"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessOnboarding_organizationId_updatedAt_idx" ON "GbaCustomerSuccessOnboarding"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessOnboarding_customerId_updatedAt_idx" ON "GbaCustomerSuccessOnboarding"("customerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessHealth_workspaceId_measuredAt_idx" ON "GbaCustomerSuccessHealth"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessHealth_organizationId_measuredAt_idx" ON "GbaCustomerSuccessHealth"("organizationId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessHealth_customerId_measuredAt_idx" ON "GbaCustomerSuccessHealth"("customerId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessPlan_workspaceId_updatedAt_idx" ON "GbaCustomerSuccessPlan"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessPlan_organizationId_updatedAt_idx" ON "GbaCustomerSuccessPlan"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessPlan_customerId_updatedAt_idx" ON "GbaCustomerSuccessPlan"("customerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessRenewal_workspaceId_updatedAt_idx" ON "GbaCustomerSuccessRenewal"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessRenewal_organizationId_updatedAt_idx" ON "GbaCustomerSuccessRenewal"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessRenewal_contractExpiresAt_updatedAt_idx" ON "GbaCustomerSuccessRenewal"("contractExpiresAt", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessSatisfaction_workspaceId_measuredAt_idx" ON "GbaCustomerSuccessSatisfaction"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessSatisfaction_organizationId_measuredAt_idx" ON "GbaCustomerSuccessSatisfaction"("organizationId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessSatisfaction_customerId_measuredAt_idx" ON "GbaCustomerSuccessSatisfaction"("customerId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessSupportSignal_workspaceId_updatedAt_idx" ON "GbaCustomerSuccessSupportSignal"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessSupportSignal_organizationId_updatedAt_idx" ON "GbaCustomerSuccessSupportSignal"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessSupportSignal_customerId_updatedAt_idx" ON "GbaCustomerSuccessSupportSignal"("customerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessExpansionOpportunity_workspaceId_updatedA_idx" ON "GbaCustomerSuccessExpansionOpportunity"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessExpansionOpportunity_organizationId_updat_idx" ON "GbaCustomerSuccessExpansionOpportunity"("organizationId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessExpansionOpportunity_customerId_updatedAt_idx" ON "GbaCustomerSuccessExpansionOpportunity"("customerId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessKpi_workspaceId_measuredAt_idx" ON "GbaCustomerSuccessKpi"("workspaceId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessKpi_organizationId_measuredAt_idx" ON "GbaCustomerSuccessKpi"("organizationId", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessKpi_name_measuredAt_idx" ON "GbaCustomerSuccessKpi"("name", "measuredAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessRecommendation_workspaceId_createdAt_idx" ON "GbaCustomerSuccessRecommendation"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessRecommendation_organizationId_createdAt_idx" ON "GbaCustomerSuccessRecommendation"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessRecommendation_status_createdAt_idx" ON "GbaCustomerSuccessRecommendation"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessRecommendationReview_workspaceId_reviewed_idx" ON "GbaCustomerSuccessRecommendationReview"("workspaceId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessRecommendationReview_customerSuccessRecom_idx" ON "GbaCustomerSuccessRecommendationReview"("customerSuccessRecommendationId", "reviewedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessExecutiveReport_workspaceId_createdAt_idx" ON "GbaCustomerSuccessExecutiveReport"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessExecutiveReport_organizationId_createdAt_idx" ON "GbaCustomerSuccessExecutiveReport"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessExecutiveReport_period_createdAt_idx" ON "GbaCustomerSuccessExecutiveReport"("period", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessTimelineEvent_workspaceId_createdAt_idx" ON "GbaCustomerSuccessTimelineEvent"("workspaceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessTimelineEvent_organizationId_createdAt_idx" ON "GbaCustomerSuccessTimelineEvent"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessAgentHealth_workspaceId_generatedAt_idx" ON "GbaCustomerSuccessAgentHealth"("workspaceId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessAgentHealth_organizationId_generatedAt_idx" ON "GbaCustomerSuccessAgentHealth"("organizationId", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GbaCustomerSuccessAgentHealth_status_generatedAt_idx" ON "GbaCustomerSuccessAgentHealth"("status", "generatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GedEntityDefinition_entityKey_key" ON "GedEntityDefinition"("entityKey");

-- CreateIndex
CREATE UNIQUE INDEX "GedEntityDefinition_entityCode_key" ON "GedEntityDefinition"("entityCode");

-- CreateIndex
CREATE INDEX "GedEntityDefinition_stewardshipArea_updatedAt_idx" ON "GedEntityDefinition"("stewardshipArea", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GedEntityDefinition_authorizationBoundary_updatedAt_idx" ON "GedEntityDefinition"("authorizationBoundary", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GedRelationshipDefinition_relationshipKey_key" ON "GedRelationshipDefinition"("relationshipKey");

-- CreateIndex
CREATE INDEX "GedRelationshipDefinition_sourceEntityKey_updatedAt_idx" ON "GedRelationshipDefinition"("sourceEntityKey", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GedRelationshipDefinition_targetEntityKey_updatedAt_idx" ON "GedRelationshipDefinition"("targetEntityKey", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GedRelationshipDefinition_authorizationBoundary_updatedAt_idx" ON "GedRelationshipDefinition"("authorizationBoundary", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GedEntityVersion_entityKey_createdAt_idx" ON "GedEntityVersion"("entityKey", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GedEntityVersion_entityKey_version_key" ON "GedEntityVersion"("entityKey", "version");

-- CreateIndex
CREATE INDEX "GedValidationResult_status_createdAt_idx" ON "GedValidationResult"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GedHealthSnapshot_status_generatedAt_idx" ON "GedHealthSnapshot"("status", "generatedAt" DESC);

-- CreateIndex
CREATE INDEX "GedAuditLineage_entityKey_occurredAt_idx" ON "GedAuditLineage"("entityKey", "occurredAt" DESC);

-- CreateIndex
CREATE INDEX "GedAuditLineage_eventType_occurredAt_idx" ON "GedAuditLineage"("eventType", "occurredAt" DESC);

-- AddForeignKey
ALTER TABLE "GlwDailyPublishCandidate" ADD CONSTRAINT "GlwDailyPublishCandidate_planId_fkey" FOREIGN KEY ("planId") REFERENCES "GlwDailyPublishPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GopExecutionSnapshot" ADD CONSTRAINT "GopExecutionSnapshot_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "GopExecution"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GopExecutionLease" ADD CONSTRAINT "GopExecutionLease_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "GopExecution"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GopDeadLetter" ADD CONSTRAINT "GopDeadLetter_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "GopExecution"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpSite" ADD CONSTRAINT "GmpSite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpBrandProfile" ADD CONSTRAINT "GmpBrandProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPublishingConnection" ADD CONSTRAINT "GmpPublishingConnection_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "GmpSite"("siteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpEnvironmentConfig" ADD CONSTRAINT "GmpEnvironmentConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpEnvironmentConfig" ADD CONSTRAINT "GmpEnvironmentConfig_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "GmpSite"("siteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpBusinessKnowledgeWorkspace" ADD CONSTRAINT "GmpBusinessKnowledgeWorkspace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeRecord" ADD CONSTRAINT "GmpKnowledgeRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeRecord" ADD CONSTRAINT "GmpKnowledgeRecord_knowledgeWorkspaceId_fkey" FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeRecord" ADD CONSTRAINT "GmpKnowledgeRecord_parentRecordId_fkey" FOREIGN KEY ("parentRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeRecord" ADD CONSTRAINT "GmpKnowledgeRecord_supersededByRecordId_fkey" FOREIGN KEY ("supersededByRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeRecordVersion" ADD CONSTRAINT "GmpKnowledgeRecordVersion_knowledgeRecordId_fkey" FOREIGN KEY ("knowledgeRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeSource" ADD CONSTRAINT "GmpKnowledgeSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeEvidenceLink" ADD CONSTRAINT "GmpKnowledgeEvidenceLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeEvidenceLink" ADD CONSTRAINT "GmpKnowledgeEvidenceLink_knowledgeRecordId_fkey" FOREIGN KEY ("knowledgeRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeEvidenceLink" ADD CONSTRAINT "GmpKnowledgeEvidenceLink_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "GmpKnowledgeSource"("sourceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeReview" ADD CONSTRAINT "GmpKnowledgeReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeReview" ADD CONSTRAINT "GmpKnowledgeReview_knowledgeWorkspaceId_fkey" FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeReview" ADD CONSTRAINT "GmpKnowledgeReview_knowledgeRecordId_fkey" FOREIGN KEY ("knowledgeRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeApproval" ADD CONSTRAINT "GmpKnowledgeApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeApproval" ADD CONSTRAINT "GmpKnowledgeApproval_knowledgeWorkspaceId_fkey" FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeApproval" ADD CONSTRAINT "GmpKnowledgeApproval_knowledgeRecordId_fkey" FOREIGN KEY ("knowledgeRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeConflict" ADD CONSTRAINT "GmpKnowledgeConflict_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeConflict" ADD CONSTRAINT "GmpKnowledgeConflict_knowledgeWorkspaceId_fkey" FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeConflictMember" ADD CONSTRAINT "GmpKnowledgeConflictMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeConflictMember" ADD CONSTRAINT "GmpKnowledgeConflictMember_knowledgeConflictId_fkey" FOREIGN KEY ("knowledgeConflictId") REFERENCES "GmpKnowledgeConflict"("knowledgeConflictId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeConflictMember" ADD CONSTRAINT "GmpKnowledgeConflictMember_knowledgeRecordId_fkey" FOREIGN KEY ("knowledgeRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeCompletenessAssessment" ADD CONSTRAINT "GmpKnowledgeCompletenessAssessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpKnowledgeCompletenessAssessment" ADD CONSTRAINT "GmpKnowledgeCompletenessAssessment_knowledgeWorkspaceId_fkey" FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContextAssemblyRecord" ADD CONSTRAINT "GmpContextAssemblyRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContextAssemblyRecord" ADD CONSTRAINT "GmpContextAssemblyRecord_knowledgeWorkspaceId_fkey" FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPage" ADD CONSTRAINT "GmpPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPage" ADD CONSTRAINT "GmpPage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "GmpSite"("siteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPage" ADD CONSTRAINT "GmpPage_parentPageId_fkey" FOREIGN KEY ("parentPageId") REFERENCES "GmpPage"("pageId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageBrief" ADD CONSTRAINT "GmpPageBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageBrief" ADD CONSTRAINT "GmpPageBrief_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageBriefVersion" ADD CONSTRAINT "GmpPageBriefVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageBriefVersion" ADD CONSTRAINT "GmpPageBriefVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageBriefVersion" ADD CONSTRAINT "GmpPageBriefVersion_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "GmpPageBrief"("briefId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentPlan" ADD CONSTRAINT "GmpContentPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentPlan" ADD CONSTRAINT "GmpContentPlan_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentPlan" ADD CONSTRAINT "GmpContentPlan_pageBriefId_fkey" FOREIGN KEY ("pageBriefId") REFERENCES "GmpPageBrief"("briefId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentPlanVersion" ADD CONSTRAINT "GmpContentPlanVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentPlanVersion" ADD CONSTRAINT "GmpContentPlanVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentPlanVersion" ADD CONSTRAINT "GmpContentPlanVersion_contentPlanId_fkey" FOREIGN KEY ("contentPlanId") REFERENCES "GmpContentPlan"("contentPlanId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageSection" ADD CONSTRAINT "GmpPageSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageSection" ADD CONSTRAINT "GmpPageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageSection" ADD CONSTRAINT "GmpPageSection_contentPlanId_fkey" FOREIGN KEY ("contentPlanId") REFERENCES "GmpContentPlan"("contentPlanId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageSection" ADD CONSTRAINT "GmpPageSection_parentSectionId_fkey" FOREIGN KEY ("parentSectionId") REFERENCES "GmpPageSection"("sectionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageRelationship" ADD CONSTRAINT "GmpPageRelationship_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageRelationship" ADD CONSTRAINT "GmpPageRelationship_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageRelationship" ADD CONSTRAINT "GmpPageRelationship_targetPageId_fkey" FOREIGN KEY ("targetPageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpInternalLinkPlan" ADD CONSTRAINT "GmpInternalLinkPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpInternalLinkPlan" ADD CONSTRAINT "GmpInternalLinkPlan_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpInternalLinkPlan" ADD CONSTRAINT "GmpInternalLinkPlan_targetPageId_fkey" FOREIGN KEY ("targetPageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageReview" ADD CONSTRAINT "GmpPageReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageReview" ADD CONSTRAINT "GmpPageReview_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageApproval" ADD CONSTRAINT "GmpPageApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageApproval" ADD CONSTRAINT "GmpPageApproval_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageReadinessAssessment" ADD CONSTRAINT "GmpPageReadinessAssessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageReadinessAssessment" ADD CONSTRAINT "GmpPageReadinessAssessment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageKnowledgeReference" ADD CONSTRAINT "GmpPageKnowledgeReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageKnowledgeReference" ADD CONSTRAINT "GmpPageKnowledgeReference_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageSourceReference" ADD CONSTRAINT "GmpPageSourceReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpPageSourceReference" ADD CONSTRAINT "GmpPageSourceReference_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentDraft" ADD CONSTRAINT "GmpContentDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentDraft" ADD CONSTRAINT "GmpContentDraft_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "GmpSite"("siteId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentDraft" ADD CONSTRAINT "GmpContentDraft_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpGenerationRequest" ADD CONSTRAINT "GmpGenerationRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpGenerationRequest" ADD CONSTRAINT "GmpGenerationRequest_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpGenerationRequest" ADD CONSTRAINT "GmpGenerationRequest_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "GmpContentDraft"("contentDraftId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpSectionContent" ADD CONSTRAINT "GmpSectionContent_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "GmpContentDraft"("contentDraftId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpSectionContent" ADD CONSTRAINT "GmpSectionContent_pageSectionId_fkey" FOREIGN KEY ("pageSectionId") REFERENCES "GmpPageSection"("sectionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpSectionContentRevision" ADD CONSTRAINT "GmpSectionContentRevision_sectionContentId_fkey" FOREIGN KEY ("sectionContentId") REFERENCES "GmpSectionContent"("sectionContentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpSectionContentRevision" ADD CONSTRAINT "GmpSectionContentRevision_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "GmpContentDraft"("contentDraftId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentReview" ADD CONSTRAINT "GmpContentReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentReview" ADD CONSTRAINT "GmpContentReview_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentReview" ADD CONSTRAINT "GmpContentReview_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "GmpContentDraft"("contentDraftId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentReview" ADD CONSTRAINT "GmpContentReview_sectionContentId_fkey" FOREIGN KEY ("sectionContentId") REFERENCES "GmpSectionContent"("sectionContentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentApproval" ADD CONSTRAINT "GmpContentApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentApproval" ADD CONSTRAINT "GmpContentApproval_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentApproval" ADD CONSTRAINT "GmpContentApproval_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "GmpContentDraft"("contentDraftId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentApproval" ADD CONSTRAINT "GmpContentApproval_sectionContentId_fkey" FOREIGN KEY ("sectionContentId") REFERENCES "GmpSectionContent"("sectionContentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentValidation" ADD CONSTRAINT "GmpContentValidation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentValidation" ADD CONSTRAINT "GmpContentValidation_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentValidation" ADD CONSTRAINT "GmpContentValidation_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "GmpContentDraft"("contentDraftId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpSectionValidation" ADD CONSTRAINT "GmpSectionValidation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpSectionValidation" ADD CONSTRAINT "GmpSectionValidation_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpSectionValidation" ADD CONSTRAINT "GmpSectionValidation_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "GmpContentDraft"("contentDraftId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpSectionValidation" ADD CONSTRAINT "GmpSectionValidation_sectionContentId_fkey" FOREIGN KEY ("sectionContentId") REFERENCES "GmpSectionContent"("sectionContentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpGenerationLineage" ADD CONSTRAINT "GmpGenerationLineage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpGenerationLineage" ADD CONSTRAINT "GmpGenerationLineage_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpGenerationLineage" ADD CONSTRAINT "GmpGenerationLineage_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "GmpContentDraft"("contentDraftId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpGenerationLineage" ADD CONSTRAINT "GmpGenerationLineage_sectionContentId_fkey" FOREIGN KEY ("sectionContentId") REFERENCES "GmpSectionContent"("sectionContentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpGenerationLineage" ADD CONSTRAINT "GmpGenerationLineage_pageSectionId_fkey" FOREIGN KEY ("pageSectionId") REFERENCES "GmpPageSection"("sectionId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentAssembly" ADD CONSTRAINT "GmpContentAssembly_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentAssembly" ADD CONSTRAINT "GmpContentAssembly_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmpContentAssembly" ADD CONSTRAINT "GmpContentAssembly_contentDraftId_fkey" FOREIGN KEY ("contentDraftId") REFERENCES "GmpContentDraft"("contentDraftId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GedEntityVersion" ADD CONSTRAINT "GedEntityVersion_entityKey_fkey" FOREIGN KEY ("entityKey") REFERENCES "GedEntityDefinition"("entityKey") ON DELETE CASCADE ON UPDATE CASCADE;
