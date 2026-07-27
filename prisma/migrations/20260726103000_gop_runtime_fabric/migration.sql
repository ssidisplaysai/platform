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

-- AddForeignKey
ALTER TABLE "GopExecutionLease"
ADD CONSTRAINT "GopExecutionLease_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "GopExecution"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GopDeadLetter"
ADD CONSTRAINT "GopDeadLetter_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "GopExecution"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;
