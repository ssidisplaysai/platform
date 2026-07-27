-- AlterTable
ALTER TABLE "GmpAnalyticsCollection"
ADD COLUMN "workspaceId" TEXT NOT NULL DEFAULT 'glw-led-display-warehouse',
ADD COLUMN "siteId" TEXT,
ADD COLUMN "requestedPeriodStart" TIMESTAMP(3),
ADD COLUMN "requestedPeriodEnd" TIMESTAMP(3),
ADD COLUMN "requestedDimensions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "requestedMetrics" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "collectionMode" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "gopExecutionId" TEXT,
ADD COLUMN "attemptNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "parentCollectionId" TEXT,
ADD COLUMN "sourceCursor" JSONB,
ADD COLUMN "nextCursor" JSONB,
ADD COLUMN "idempotencyKey" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "inputFingerprint" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "adapterKey" TEXT NOT NULL DEFAULT 'fixture.custom',
ADD COLUMN "adapterVersion" TEXT NOT NULL DEFAULT 'v1',
ADD COLUMN "errorCategory" TEXT,
ADD COLUMN "errorSummary" TEXT,
ADD COLUMN "warningCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "observationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rejectedObservationCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "partialFailureCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "forcedRecollection" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GmpAnalyticsObservation"
ADD COLUMN "sourceRecordIdentity" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "observationType" TEXT NOT NULL DEFAULT 'GENERIC',
ADD COLUMN "sourceTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "observationPeriodStart" TIMESTAMP(3),
ADD COLUMN "observationPeriodEnd" TIMESTAMP(3),
ADD COLUMN "dimensions" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "metrics" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "rawPayloadChecksum" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN "rawPayload" JSONB,
ADD COLUMN "rawPayloadReference" JSONB,
ADD COLUMN "providerBatchId" TEXT,
ADD COLUMN "providerCursor" JSONB,
ADD COLUMN "collectionExecutionId" TEXT,
ADD COLUMN "dataQualityStatus" TEXT NOT NULL DEFAULT 'VALID',
ADD COLUMN "diagnosticSummary" TEXT,
ADD COLUMN "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "supersededByObservationId" TEXT,
ADD COLUMN "correctedFromObservationId" TEXT;

-- CreateTable
CREATE TABLE "GmpAnalyticsCollectionEvent" (
    "analyticsCollectionEventId" TEXT NOT NULL,
    "analyticsCollectionId" TEXT NOT NULL,
    "gopExecutionId" TEXT,
    "eventType" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "actorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedObservationCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "cursorSummary" JSONB,
    "errorCategory" TEXT,
    "outcomeSummary" TEXT,
    "safeDiagnostic" TEXT,
    "evidenceReferences" JSONB,
    "eventVersion" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GmpAnalyticsCollectionEvent_pkey" PRIMARY KEY ("analyticsCollectionEventId")
);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_workspaceId_updatedAt_idx" ON "GmpAnalyticsCollection"("workspaceId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_siteId_updatedAt_idx" ON "GmpAnalyticsCollection"("siteId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_gopExecutionId_idx" ON "GmpAnalyticsCollection"("gopExecutionId");

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_parentCollectionId_updatedAt_idx" ON "GmpAnalyticsCollection"("parentCollectionId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_idempotencyKey_idx" ON "GmpAnalyticsCollection"("idempotencyKey");

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollection_inputFingerprint_idx" ON "GmpAnalyticsCollection"("inputFingerprint");

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_sourceRecordIdentity_observedAt_idx" ON "GmpAnalyticsObservation"("sourceRecordIdentity", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsObservation_rawPayloadChecksum_idx" ON "GmpAnalyticsObservation"("rawPayloadChecksum");

-- CreateIndex
CREATE UNIQUE INDEX "GmpAnalyticsObservation_analyticsSourceId_sourceRecordIdentity_sourceTimestamp_rawPayloadChecksum_key" ON "GmpAnalyticsObservation"("analyticsSourceId", "sourceRecordIdentity", "sourceTimestamp", "rawPayloadChecksum");

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollectionEvent_analyticsCollectionId_occurredAt_idx" ON "GmpAnalyticsCollectionEvent"("analyticsCollectionId", "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollectionEvent_gopExecutionId_occurredAt_idx" ON "GmpAnalyticsCollectionEvent"("gopExecutionId", "occurredAt" ASC);

-- CreateIndex
CREATE INDEX "GmpAnalyticsCollectionEvent_eventType_occurredAt_idx" ON "GmpAnalyticsCollectionEvent"("eventType", "occurredAt" DESC);
