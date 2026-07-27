-- GMP-0003 Canonical Page Architecture & Content Planning Engine (additive)

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

CREATE UNIQUE INDEX "GmpPage_siteId_slug_key" ON "GmpPage"("siteId", "slug");
CREATE UNIQUE INDEX "GmpPageBriefVersion_briefId_versionNumber_key" ON "GmpPageBriefVersion"("briefId", "versionNumber");
CREATE UNIQUE INDEX "GmpContentPlanVersion_contentPlanId_versionNumber_key" ON "GmpContentPlanVersion"("contentPlanId", "versionNumber");
CREATE UNIQUE INDEX "GmpPageSection_contentPlanId_sectionKey_key" ON "GmpPageSection"("contentPlanId", "sectionKey");
CREATE UNIQUE INDEX "GmpPageRelationship_source_target_type_key" ON "GmpPageRelationship"("sourcePageId", "targetPageId", "relationshipType");

CREATE INDEX "GmpPage_projectId_updatedAt_idx" ON "GmpPage"("projectId", "updatedAt" DESC);
CREATE INDEX "GmpPage_siteId_updatedAt_idx" ON "GmpPage"("siteId", "updatedAt" DESC);
CREATE INDEX "GmpPage_pageType_updatedAt_idx" ON "GmpPage"("pageType", "updatedAt" DESC);
CREATE INDEX "GmpPage_lifecycleState_updatedAt_idx" ON "GmpPage"("lifecycleState", "updatedAt" DESC);
CREATE INDEX "GmpPage_contentState_updatedAt_idx" ON "GmpPage"("contentState", "updatedAt" DESC);
CREATE INDEX "GmpPage_seoState_updatedAt_idx" ON "GmpPage"("seoState", "updatedAt" DESC);
CREATE INDEX "GmpPage_publishingState_updatedAt_idx" ON "GmpPage"("publishingState", "updatedAt" DESC);
CREATE INDEX "GmpPage_priority_updatedAt_idx" ON "GmpPage"("priority", "updatedAt" DESC);
CREATE INDEX "GmpPage_parentPageId_idx" ON "GmpPage"("parentPageId");
CREATE INDEX "GmpPage_canonicalUrl_idx" ON "GmpPage"("canonicalUrl");
CREATE INDEX "GmpPage_currentBriefId_idx" ON "GmpPage"("currentBriefId");
CREATE INDEX "GmpPage_currentContentPlanId_idx" ON "GmpPage"("currentContentPlanId");

CREATE INDEX "GmpPageBrief_projectId_pageId_updatedAt_idx" ON "GmpPageBrief"("projectId", "pageId", "updatedAt" DESC);
CREATE INDEX "GmpPageBrief_status_updatedAt_idx" ON "GmpPageBrief"("status", "updatedAt" DESC);
CREATE INDEX "GmpPageBriefVersion_projectId_changedAt_idx" ON "GmpPageBriefVersion"("projectId", "changedAt" DESC);

CREATE INDEX "GmpContentPlan_projectId_pageId_updatedAt_idx" ON "GmpContentPlan"("projectId", "pageId", "updatedAt" DESC);
CREATE INDEX "GmpContentPlan_status_updatedAt_idx" ON "GmpContentPlan"("status", "updatedAt" DESC);
CREATE INDEX "GmpContentPlan_readinessScore_updatedAt_idx" ON "GmpContentPlan"("readinessScore", "updatedAt" DESC);
CREATE INDEX "GmpContentPlanVersion_projectId_changedAt_idx" ON "GmpContentPlanVersion"("projectId", "changedAt" DESC);

CREATE INDEX "GmpPageSection_projectId_pageId_position_idx" ON "GmpPageSection"("projectId", "pageId", "position");
CREATE INDEX "GmpPageSection_sectionType_updatedAt_idx" ON "GmpPageSection"("sectionType", "updatedAt" DESC);

CREATE INDEX "GmpPageRelationship_projectId_type_createdAt_idx" ON "GmpPageRelationship"("projectId", "relationshipType", "createdAt" DESC);
CREATE INDEX "GmpInternalLinkPlan_project_source_updatedAt_idx" ON "GmpInternalLinkPlan"("projectId", "sourcePageId", "updatedAt" DESC);
CREATE INDEX "GmpInternalLinkPlan_project_target_updatedAt_idx" ON "GmpInternalLinkPlan"("projectId", "targetPageId", "updatedAt" DESC);

CREATE INDEX "GmpPageReview_project_page_state_updatedAt_idx" ON "GmpPageReview"("projectId", "pageId", "reviewState", "updatedAt" DESC);
CREATE INDEX "GmpPageApproval_project_page_decidedAt_idx" ON "GmpPageApproval"("projectId", "pageId", "decidedAt" DESC);
CREATE INDEX "GmpPageReadinessAssessment_project_page_createdAt_idx" ON "GmpPageReadinessAssessment"("projectId", "pageId", "createdAt" DESC);
CREATE INDEX "GmpPageReadinessAssessment_overallScore_createdAt_idx" ON "GmpPageReadinessAssessment"("overallScore", "createdAt" DESC);
CREATE INDEX "GmpPageKnowledgeReference_project_page_createdAt_idx" ON "GmpPageKnowledgeReference"("projectId", "pageId", "createdAt" DESC);
CREATE INDEX "GmpPageKnowledgeReference_record_createdAt_idx" ON "GmpPageKnowledgeReference"("knowledgeRecordId", "createdAt" DESC);
CREATE INDEX "GmpPageSourceReference_project_page_createdAt_idx" ON "GmpPageSourceReference"("projectId", "pageId", "createdAt" DESC);
CREATE INDEX "GmpPageSourceReference_source_createdAt_idx" ON "GmpPageSourceReference"("sourceId", "createdAt" DESC);

ALTER TABLE "GmpPage"
  ADD CONSTRAINT "GmpPage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPage"
  ADD CONSTRAINT "GmpPage_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "GmpSite"("siteId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPage"
  ADD CONSTRAINT "GmpPage_parentPageId_fkey" FOREIGN KEY ("parentPageId") REFERENCES "GmpPage"("pageId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GmpPageBrief"
  ADD CONSTRAINT "GmpPageBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageBrief"
  ADD CONSTRAINT "GmpPageBrief_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpPageBriefVersion"
  ADD CONSTRAINT "GmpPageBriefVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageBriefVersion"
  ADD CONSTRAINT "GmpPageBriefVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageBriefVersion"
  ADD CONSTRAINT "GmpPageBriefVersion_briefId_fkey" FOREIGN KEY ("briefId") REFERENCES "GmpPageBrief"("briefId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpContentPlan"
  ADD CONSTRAINT "GmpContentPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpContentPlan"
  ADD CONSTRAINT "GmpContentPlan_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpContentPlan"
  ADD CONSTRAINT "GmpContentPlan_pageBriefId_fkey" FOREIGN KEY ("pageBriefId") REFERENCES "GmpPageBrief"("briefId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpContentPlanVersion"
  ADD CONSTRAINT "GmpContentPlanVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpContentPlanVersion"
  ADD CONSTRAINT "GmpContentPlanVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpContentPlanVersion"
  ADD CONSTRAINT "GmpContentPlanVersion_contentPlanId_fkey" FOREIGN KEY ("contentPlanId") REFERENCES "GmpContentPlan"("contentPlanId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpPageSection"
  ADD CONSTRAINT "GmpPageSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageSection"
  ADD CONSTRAINT "GmpPageSection_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageSection"
  ADD CONSTRAINT "GmpPageSection_contentPlanId_fkey" FOREIGN KEY ("contentPlanId") REFERENCES "GmpContentPlan"("contentPlanId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageSection"
  ADD CONSTRAINT "GmpPageSection_parentSectionId_fkey" FOREIGN KEY ("parentSectionId") REFERENCES "GmpPageSection"("sectionId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GmpPageRelationship"
  ADD CONSTRAINT "GmpPageRelationship_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageRelationship"
  ADD CONSTRAINT "GmpPageRelationship_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageRelationship"
  ADD CONSTRAINT "GmpPageRelationship_targetPageId_fkey" FOREIGN KEY ("targetPageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpInternalLinkPlan"
  ADD CONSTRAINT "GmpInternalLinkPlan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpInternalLinkPlan"
  ADD CONSTRAINT "GmpInternalLinkPlan_sourcePageId_fkey" FOREIGN KEY ("sourcePageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpInternalLinkPlan"
  ADD CONSTRAINT "GmpInternalLinkPlan_targetPageId_fkey" FOREIGN KEY ("targetPageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpPageReview"
  ADD CONSTRAINT "GmpPageReview_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageReview"
  ADD CONSTRAINT "GmpPageReview_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpPageApproval"
  ADD CONSTRAINT "GmpPageApproval_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageApproval"
  ADD CONSTRAINT "GmpPageApproval_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpPageReadinessAssessment"
  ADD CONSTRAINT "GmpPageReadinessAssessment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageReadinessAssessment"
  ADD CONSTRAINT "GmpPageReadinessAssessment_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpPageKnowledgeReference"
  ADD CONSTRAINT "GmpPageKnowledgeReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageKnowledgeReference"
  ADD CONSTRAINT "GmpPageKnowledgeReference_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpPageSourceReference"
  ADD CONSTRAINT "GmpPageSourceReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpPageSourceReference"
  ADD CONSTRAINT "GmpPageSourceReference_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "GmpPage"("pageId") ON DELETE CASCADE ON UPDATE CASCADE;
