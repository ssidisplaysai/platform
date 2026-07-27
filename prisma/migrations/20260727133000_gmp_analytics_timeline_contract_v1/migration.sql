-- GMP-0006B closure: timeline contract hardening (additive)
ALTER TABLE "GmpAnalyticsCollectionEvent"
ADD COLUMN "parentCollectionId" TEXT,
ADD COLUMN "retryOfCollectionId" TEXT,
ADD COLUMN "attemptNumber" INTEGER,
ADD COLUMN "batchNumber" INTEGER,
ADD COLUMN "pageNumber" INTEGER,
ADD COLUMN "safeOutcomeSummary" TEXT,
ADD COLUMN "timelineContractVersion" TEXT;

CREATE INDEX "GmpAnalyticsCollectionEvent_parentCollectionId_occurredAt_idx"
ON "GmpAnalyticsCollectionEvent" ("parentCollectionId", "occurredAt" ASC);

CREATE INDEX "GmpAnalyticsCollectionEvent_retryOfCollectionId_occurredAt_idx"
ON "GmpAnalyticsCollectionEvent" ("retryOfCollectionId", "occurredAt" ASC);
