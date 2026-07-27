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

-- CreateIndex
CREATE UNIQUE INDEX "GopJobEvent_jobId_sequence_key" ON "GopJobEvent"("jobId", "sequence");

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
CREATE UNIQUE INDEX "GopJobEvent_jobId_idempotencyKey_unique_when_not_null"
    ON "GopJobEvent"("jobId", "idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL;
