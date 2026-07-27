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
CREATE UNIQUE INDEX "GopExecutionSnapshot_executionId_snapshotSequence_key" ON "GopExecutionSnapshot"("executionId", "snapshotSequence");

-- CreateIndex
CREATE INDEX "GopExecutionSnapshot_executionId_createdAt_idx" ON "GopExecutionSnapshot"("executionId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GopExecutionSnapshot_status_createdAt_idx" ON "GopExecutionSnapshot"("status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "GopExecutionSnapshot"
ADD CONSTRAINT "GopExecutionSnapshot_executionId_fkey"
FOREIGN KEY ("executionId") REFERENCES "GopExecution"("executionId") ON DELETE CASCADE ON UPDATE CASCADE;
