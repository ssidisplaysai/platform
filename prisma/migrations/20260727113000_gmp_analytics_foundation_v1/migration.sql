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
    "projectId" TEXT NOT NULL,
    "analyticsSourceId" TEXT NOT NULL,
    "collectionStatus" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "collectionWindowStart" TIMESTAMP(3),
    "collectionWindowEnd" TIMESTAMP(3),
    "eligibilityVersion" TEXT NOT NULL,
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
    "releasedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmpEvidenceCompilerVersion_pkey" PRIMARY KEY ("evidenceCompilerVersionId")
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

-- CreateIndex
CREATE INDEX "GmpAnalyticsSource_projectId_updatedAt_idx" ON "GmpAnalyticsSource"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsSource_siteId_updatedAt_idx" ON "GmpAnalyticsSource"("siteId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsSource_sourceStatus_updatedAt_idx" ON "GmpAnalyticsSource"("sourceStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsSource_connectionStatus_updatedAt_idx" ON "GmpAnalyticsSource"("connectionStatus", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpAnalyticsSourceCapability_analyticsSourceId_capabilityKey_key" ON "GmpAnalyticsSourceCapability"("analyticsSourceId", "capabilityKey");

-- CreateIndex
CREATE INDEX "GmpAnalyticsSourceCapability_analyticsSourceId_updatedAt_idx" ON "GmpAnalyticsSourceCapability"("analyticsSourceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_projectId_updatedAt_idx" ON "GmpAnalyticsCollection"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_analyticsSourceId_updatedAt_idx" ON "GmpAnalyticsCollection"("analyticsSourceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_collectionStatus_updatedAt_idx" ON "GmpAnalyticsCollection"("collectionStatus", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_projectId_observedAt_idx" ON "GmpAnalyticsObservation"("projectId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_analyticsSourceId_observedAt_idx" ON "GmpAnalyticsObservation"("analyticsSourceId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_analyticsCollectionId_observedAt_idx" ON "GmpAnalyticsObservation"("analyticsCollectionId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_observationKey_observedAt_idx" ON "GmpAnalyticsObservation"("observationKey", "observedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GmpMetricDefinition_projectId_metricKey_key" ON "GmpMetricDefinition"("projectId", "metricKey");

-- CreateIndex
CREATE INDEX "GmpMetricDefinition_projectId_updatedAt_idx" ON "GmpMetricDefinition"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpMetricDefinition_active_updatedAt_idx" ON "GmpMetricDefinition"("active", "updatedAt" DESC);

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
CREATE UNIQUE INDEX "GmpEvidenceCompilerVersion_projectId_compilerName_compilerVersion_key" ON "GmpEvidenceCompilerVersion"("projectId", "compilerName", "compilerVersion");

-- CreateIndex
CREATE INDEX "GmpEvidenceCompilerVersion_projectId_updatedAt_idx" ON "GmpEvidenceCompilerVersion"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsAttributionRegistry_projectId_updatedAt_idx" ON "GmpAnalyticsAttributionRegistry"("projectId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsRecommendationRegistry_projectId_updatedAt_idx" ON "GmpAnalyticsRecommendationRegistry"("projectId", "updatedAt" DESC);
