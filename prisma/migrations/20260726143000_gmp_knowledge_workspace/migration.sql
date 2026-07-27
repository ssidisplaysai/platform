-- GMP-0002 Business Knowledge Workspace (additive)

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

CREATE UNIQUE INDEX "GmpBusinessKnowledgeWorkspace_projectId_key" ON "GmpBusinessKnowledgeWorkspace"("projectId");
CREATE INDEX "GmpBusinessKnowledgeWorkspace_lifecycleState_updatedAt_idx" ON "GmpBusinessKnowledgeWorkspace"("lifecycleState", "updatedAt" DESC);
CREATE INDEX "GmpBusinessKnowledgeWorkspace_status_updatedAt_idx" ON "GmpBusinessKnowledgeWorkspace"("status", "updatedAt" DESC);

CREATE INDEX "GmpKnowledgeRecord_projectId_domain_updatedAt_idx" ON "GmpKnowledgeRecord"("projectId", "domain", "updatedAt" DESC);
CREATE INDEX "GmpKnowledgeRecord_knowledgeWorkspaceId_canonicalKey_idx" ON "GmpKnowledgeRecord"("knowledgeWorkspaceId", "canonicalKey");
CREATE INDEX "GmpKnowledgeRecord_reviewState_updatedAt_idx" ON "GmpKnowledgeRecord"("reviewState", "updatedAt" DESC);
CREATE INDEX "GmpKnowledgeRecord_conflictState_updatedAt_idx" ON "GmpKnowledgeRecord"("conflictState", "updatedAt" DESC);
CREATE INDEX "GmpKnowledgeRecord_status_effectiveUntil_idx" ON "GmpKnowledgeRecord"("status", "effectiveUntil");

CREATE UNIQUE INDEX "GmpKnowledgeRecordVersion_knowledgeRecordId_versionNumber_key" ON "GmpKnowledgeRecordVersion"("knowledgeRecordId", "versionNumber");
CREATE INDEX "GmpKnowledgeRecordVersion_projectId_changedAt_idx" ON "GmpKnowledgeRecordVersion"("projectId", "changedAt" DESC);
CREATE INDEX "GmpKnowledgeRecordVersion_knowledgeWorkspaceId_changedAt_idx" ON "GmpKnowledgeRecordVersion"("knowledgeWorkspaceId", "changedAt" DESC);

CREATE INDEX "GmpKnowledgeSource_projectId_createdAt_idx" ON "GmpKnowledgeSource"("projectId", "createdAt" DESC);
CREATE INDEX "GmpKnowledgeSource_sourceType_createdAt_idx" ON "GmpKnowledgeSource"("sourceType", "createdAt" DESC);

CREATE UNIQUE INDEX "GmpKnowledgeEvidenceLink_record_source_location_key" ON "GmpKnowledgeEvidenceLink"("knowledgeRecordId", "sourceId", "evidenceLocation");
CREATE INDEX "GmpKnowledgeEvidenceLink_projectId_createdAt_idx" ON "GmpKnowledgeEvidenceLink"("projectId", "createdAt" DESC);
CREATE INDEX "GmpKnowledgeEvidenceLink_sourceId_createdAt_idx" ON "GmpKnowledgeEvidenceLink"("sourceId", "createdAt" DESC);

CREATE INDEX "GmpKnowledgeReview_projectId_reviewState_updatedAt_idx" ON "GmpKnowledgeReview"("projectId", "reviewState", "updatedAt" DESC);
CREATE INDEX "GmpKnowledgeReview_knowledgeRecordId_updatedAt_idx" ON "GmpKnowledgeReview"("knowledgeRecordId", "updatedAt" DESC);

CREATE INDEX "GmpKnowledgeApproval_projectId_decidedAt_idx" ON "GmpKnowledgeApproval"("projectId", "decidedAt" DESC);
CREATE INDEX "GmpKnowledgeApproval_knowledgeRecordId_decidedAt_idx" ON "GmpKnowledgeApproval"("knowledgeRecordId", "decidedAt" DESC);

CREATE INDEX "GmpKnowledgeConflict_projectId_resolutionStatus_updatedAt_idx" ON "GmpKnowledgeConflict"("projectId", "resolutionStatus", "updatedAt" DESC);
CREATE INDEX "GmpKnowledgeConflict_severity_updatedAt_idx" ON "GmpKnowledgeConflict"("severity", "updatedAt" DESC);

CREATE UNIQUE INDEX "GmpKnowledgeConflictMember_conflict_record_key" ON "GmpKnowledgeConflictMember"("knowledgeConflictId", "knowledgeRecordId");
CREATE INDEX "GmpKnowledgeConflictMember_projectId_createdAt_idx" ON "GmpKnowledgeConflictMember"("projectId", "createdAt" DESC);

CREATE INDEX "GmpKnowledgeCompletenessAssessment_projectId_createdAt_idx" ON "GmpKnowledgeCompletenessAssessment"("projectId", "createdAt" DESC);
CREATE INDEX "GmpKnowledgeCompletenessAssessment_workspaceId_createdAt_idx" ON "GmpKnowledgeCompletenessAssessment"("knowledgeWorkspaceId", "createdAt" DESC);

CREATE INDEX "GmpContextAssemblyRecord_projectId_createdAt_idx" ON "GmpContextAssemblyRecord"("projectId", "createdAt" DESC);
CREATE INDEX "GmpContextAssemblyRecord_workspaceId_createdAt_idx" ON "GmpContextAssemblyRecord"("knowledgeWorkspaceId", "createdAt" DESC);
CREATE INDEX "GmpContextAssemblyRecord_operationType_createdAt_idx" ON "GmpContextAssemblyRecord"("operationType", "createdAt" DESC);

ALTER TABLE "GmpBusinessKnowledgeWorkspace"
  ADD CONSTRAINT "GmpBusinessKnowledgeWorkspace_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpKnowledgeRecord"
  ADD CONSTRAINT "GmpKnowledgeRecord_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeRecord"
  ADD CONSTRAINT "GmpKnowledgeRecord_workspaceId_fkey"
  FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeRecord"
  ADD CONSTRAINT "GmpKnowledgeRecord_parentRecordId_fkey"
  FOREIGN KEY ("parentRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeRecord"
  ADD CONSTRAINT "GmpKnowledgeRecord_supersededByRecordId_fkey"
  FOREIGN KEY ("supersededByRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GmpKnowledgeRecordVersion"
  ADD CONSTRAINT "GmpKnowledgeRecordVersion_recordId_fkey"
  FOREIGN KEY ("knowledgeRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpKnowledgeSource"
  ADD CONSTRAINT "GmpKnowledgeSource_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpKnowledgeEvidenceLink"
  ADD CONSTRAINT "GmpKnowledgeEvidenceLink_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeEvidenceLink"
  ADD CONSTRAINT "GmpKnowledgeEvidenceLink_recordId_fkey"
  FOREIGN KEY ("knowledgeRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeEvidenceLink"
  ADD CONSTRAINT "GmpKnowledgeEvidenceLink_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "GmpKnowledgeSource"("sourceId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpKnowledgeReview"
  ADD CONSTRAINT "GmpKnowledgeReview_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeReview"
  ADD CONSTRAINT "GmpKnowledgeReview_workspaceId_fkey"
  FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeReview"
  ADD CONSTRAINT "GmpKnowledgeReview_recordId_fkey"
  FOREIGN KEY ("knowledgeRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpKnowledgeApproval"
  ADD CONSTRAINT "GmpKnowledgeApproval_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeApproval"
  ADD CONSTRAINT "GmpKnowledgeApproval_workspaceId_fkey"
  FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeApproval"
  ADD CONSTRAINT "GmpKnowledgeApproval_recordId_fkey"
  FOREIGN KEY ("knowledgeRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpKnowledgeConflict"
  ADD CONSTRAINT "GmpKnowledgeConflict_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeConflict"
  ADD CONSTRAINT "GmpKnowledgeConflict_workspaceId_fkey"
  FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpKnowledgeConflictMember"
  ADD CONSTRAINT "GmpKnowledgeConflictMember_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeConflictMember"
  ADD CONSTRAINT "GmpKnowledgeConflictMember_conflictId_fkey"
  FOREIGN KEY ("knowledgeConflictId") REFERENCES "GmpKnowledgeConflict"("knowledgeConflictId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeConflictMember"
  ADD CONSTRAINT "GmpKnowledgeConflictMember_recordId_fkey"
  FOREIGN KEY ("knowledgeRecordId") REFERENCES "GmpKnowledgeRecord"("knowledgeRecordId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpKnowledgeCompletenessAssessment"
  ADD CONSTRAINT "GmpKnowledgeCompletenessAssessment_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpKnowledgeCompletenessAssessment"
  ADD CONSTRAINT "GmpKnowledgeCompletenessAssessment_workspaceId_fkey"
  FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GmpContextAssemblyRecord"
  ADD CONSTRAINT "GmpContextAssemblyRecord_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "GmpProject"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GmpContextAssemblyRecord"
  ADD CONSTRAINT "GmpContextAssemblyRecord_workspaceId_fkey"
  FOREIGN KEY ("knowledgeWorkspaceId") REFERENCES "GmpBusinessKnowledgeWorkspace"("knowledgeWorkspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
