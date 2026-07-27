-- GMP-0006C enterprise evidence compiler v1 (additive)
ALTER TABLE "GmpEvidenceCompilerVersion"
ADD COLUMN "normalizationVersion" TEXT,
ADD COLUMN "metricCatalogVersion" TEXT,
ADD COLUMN "correlationVersion" TEXT,
ADD COLUMN "snapshotVersion" TEXT,
ADD COLUMN "validationVersion" TEXT;

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

CREATE UNIQUE INDEX "GmpEvidenceSnapshot_performanceSnapshotId_key"
ON "GmpEvidenceSnapshot"("performanceSnapshotId");

CREATE INDEX "GmpEvidenceCompilerRun_workspaceId_createdAt_idx"
ON "GmpEvidenceCompilerRun"("workspaceId", "createdAt" DESC);

CREATE INDEX "GmpEvidenceCompilerRun_projectId_createdAt_idx"
ON "GmpEvidenceCompilerRun"("projectId", "createdAt" DESC);

CREATE INDEX "GmpEvidenceCompilerRun_siteId_createdAt_idx"
ON "GmpEvidenceCompilerRun"("siteId", "createdAt" DESC);

CREATE INDEX "GmpEvidenceCompilerRun_replayOfRunId_createdAt_idx"
ON "GmpEvidenceCompilerRun"("replayOfRunId", "createdAt" DESC);

CREATE INDEX "GmpEvidenceCompilerRun_evidenceSnapshotId_idx"
ON "GmpEvidenceCompilerRun"("evidenceSnapshotId");

CREATE INDEX "GmpEvidenceCompilerRun_inputFingerprint_idx"
ON "GmpEvidenceCompilerRun"("inputFingerprint");

CREATE INDEX "GmpEvidenceSnapshot_workspaceId_createdAt_idx"
ON "GmpEvidenceSnapshot"("workspaceId", "createdAt" DESC);

CREATE INDEX "GmpEvidenceSnapshot_projectId_createdAt_idx"
ON "GmpEvidenceSnapshot"("projectId", "createdAt" DESC);

CREATE INDEX "GmpEvidenceSnapshot_siteId_createdAt_idx"
ON "GmpEvidenceSnapshot"("siteId", "createdAt" DESC);

CREATE INDEX "GmpEvidenceSnapshot_snapshotChecksum_idx"
ON "GmpEvidenceSnapshot"("snapshotChecksum");

CREATE INDEX "GmpEvidenceCompiledMetric_evidenceSnapshotId_canonicalMetricKey_idx"
ON "GmpEvidenceCompiledMetric"("evidenceSnapshotId", "canonicalMetricKey");

CREATE INDEX "GmpEvidenceCompiledMetric_projectId_createdAt_idx"
ON "GmpEvidenceCompiledMetric"("projectId", "createdAt" DESC);

CREATE INDEX "GmpEvidenceCompiledMetric_siteId_createdAt_idx"
ON "GmpEvidenceCompiledMetric"("siteId", "createdAt" DESC);

CREATE INDEX "GmpEvidenceCompiledMetric_metricDefinitionId_idx"
ON "GmpEvidenceCompiledMetric"("metricDefinitionId");

CREATE INDEX "GmpEvidenceCompiledMetric_lineageFingerprint_idx"
ON "GmpEvidenceCompiledMetric"("lineageFingerprint");

CREATE INDEX "GmpEvidencePublicationReference_evidenceSnapshotId_createdAt_idx"
ON "GmpEvidencePublicationReference"("evidenceSnapshotId", "createdAt" DESC);

CREATE INDEX "GmpEvidencePublicationReference_projectId_createdAt_idx"
ON "GmpEvidencePublicationReference"("projectId", "createdAt" DESC);

CREATE INDEX "GmpEvidencePublicationReference_siteId_createdAt_idx"
ON "GmpEvidencePublicationReference"("siteId", "createdAt" DESC);

CREATE INDEX "GmpEvidencePublicationReference_publicationRecordId_idx"
ON "GmpEvidencePublicationReference"("publicationRecordId");

CREATE INDEX "GmpEvidencePublicationReference_canonicalUrl_idx"
ON "GmpEvidencePublicationReference"("canonicalUrl");

CREATE INDEX "GmpEvidencePublicationReference_lineageFingerprint_idx"
ON "GmpEvidencePublicationReference"("lineageFingerprint");