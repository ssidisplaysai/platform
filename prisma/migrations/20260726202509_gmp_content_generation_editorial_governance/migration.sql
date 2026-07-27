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

-- RenameForeignKey
ALTER TABLE "GmpContextAssemblyRecord" RENAME CONSTRAINT "GmpContextAssemblyRecord_workspaceId_fkey" TO "GmpContextAssemblyRecord_knowledgeWorkspaceId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeApproval" RENAME CONSTRAINT "GmpKnowledgeApproval_recordId_fkey" TO "GmpKnowledgeApproval_knowledgeRecordId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeApproval" RENAME CONSTRAINT "GmpKnowledgeApproval_workspaceId_fkey" TO "GmpKnowledgeApproval_knowledgeWorkspaceId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeCompletenessAssessment" RENAME CONSTRAINT "GmpKnowledgeCompletenessAssessment_workspaceId_fkey" TO "GmpKnowledgeCompletenessAssessment_knowledgeWorkspaceId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeConflict" RENAME CONSTRAINT "GmpKnowledgeConflict_workspaceId_fkey" TO "GmpKnowledgeConflict_knowledgeWorkspaceId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeConflictMember" RENAME CONSTRAINT "GmpKnowledgeConflictMember_conflictId_fkey" TO "GmpKnowledgeConflictMember_knowledgeConflictId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeConflictMember" RENAME CONSTRAINT "GmpKnowledgeConflictMember_recordId_fkey" TO "GmpKnowledgeConflictMember_knowledgeRecordId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeEvidenceLink" RENAME CONSTRAINT "GmpKnowledgeEvidenceLink_recordId_fkey" TO "GmpKnowledgeEvidenceLink_knowledgeRecordId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeRecord" RENAME CONSTRAINT "GmpKnowledgeRecord_workspaceId_fkey" TO "GmpKnowledgeRecord_knowledgeWorkspaceId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeRecordVersion" RENAME CONSTRAINT "GmpKnowledgeRecordVersion_recordId_fkey" TO "GmpKnowledgeRecordVersion_knowledgeRecordId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeReview" RENAME CONSTRAINT "GmpKnowledgeReview_recordId_fkey" TO "GmpKnowledgeReview_knowledgeRecordId_fkey";

-- RenameForeignKey
ALTER TABLE "GmpKnowledgeReview" RENAME CONSTRAINT "GmpKnowledgeReview_workspaceId_fkey" TO "GmpKnowledgeReview_knowledgeWorkspaceId_fkey";

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

-- RenameIndex
ALTER INDEX "GmpContextAssemblyRecord_workspaceId_createdAt_idx" RENAME TO "GmpContextAssemblyRecord_knowledgeWorkspaceId_createdAt_idx";

-- RenameIndex
ALTER INDEX "GmpInternalLinkPlan_project_source_updatedAt_idx" RENAME TO "GmpInternalLinkPlan_projectId_sourcePageId_updatedAt_idx";

-- RenameIndex
ALTER INDEX "GmpInternalLinkPlan_project_target_updatedAt_idx" RENAME TO "GmpInternalLinkPlan_projectId_targetPageId_updatedAt_idx";

-- RenameIndex
ALTER INDEX "GmpKnowledgeCompletenessAssessment_workspaceId_createdAt_idx" RENAME TO "GmpKnowledgeCompletenessAssessment_knowledgeWorkspaceId_cre_idx";

-- RenameIndex
ALTER INDEX "GmpKnowledgeConflictMember_conflict_record_key" RENAME TO "GmpKnowledgeConflictMember_knowledgeConflictId_knowledgeRec_key";

-- RenameIndex
ALTER INDEX "GmpKnowledgeEvidenceLink_record_source_location_key" RENAME TO "GmpKnowledgeEvidenceLink_knowledgeRecordId_sourceId_evidenc_key";

-- RenameIndex
ALTER INDEX "GmpPageApproval_project_page_decidedAt_idx" RENAME TO "GmpPageApproval_projectId_pageId_decidedAt_idx";

-- RenameIndex
ALTER INDEX "GmpPageKnowledgeReference_project_page_createdAt_idx" RENAME TO "GmpPageKnowledgeReference_projectId_pageId_createdAt_idx";

-- RenameIndex
ALTER INDEX "GmpPageKnowledgeReference_record_createdAt_idx" RENAME TO "GmpPageKnowledgeReference_knowledgeRecordId_createdAt_idx";

-- RenameIndex
ALTER INDEX "GmpPageReadinessAssessment_project_page_createdAt_idx" RENAME TO "GmpPageReadinessAssessment_projectId_pageId_createdAt_idx";

-- RenameIndex
ALTER INDEX "GmpPageRelationship_projectId_type_createdAt_idx" RENAME TO "GmpPageRelationship_projectId_relationshipType_createdAt_idx";

-- RenameIndex
ALTER INDEX "GmpPageRelationship_source_target_type_key" RENAME TO "GmpPageRelationship_sourcePageId_targetPageId_relationshipT_key";

-- RenameIndex
ALTER INDEX "GmpPageReview_project_page_state_updatedAt_idx" RENAME TO "GmpPageReview_projectId_pageId_reviewState_updatedAt_idx";

-- RenameIndex
ALTER INDEX "GmpPageSourceReference_project_page_createdAt_idx" RENAME TO "GmpPageSourceReference_projectId_pageId_createdAt_idx";

-- RenameIndex
ALTER INDEX "GmpPageSourceReference_source_createdAt_idx" RENAME TO "GmpPageSourceReference_sourceId_createdAt_idx";
