CREATE TABLE IF NOT EXISTS "GopRecoveryRecord" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "executionId" TEXT,
  "previousJobStatus" TEXT NOT NULL,
  "newJobStatus" TEXT NOT NULL,
  "previousExecutionStatus" TEXT,
  "newExecutionStatus" TEXT,
  "reason" TEXT NOT NULL,
  "recoveredBy" TEXT NOT NULL,
  "dryRun" BOOLEAN NOT NULL DEFAULT true,
  "safeRecovery" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GopRecoveryRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GopRecoveryRecord_workspaceId_createdAt_idx"
  ON "GopRecoveryRecord"("workspaceId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "GopRecoveryRecord_jobId_createdAt_idx"
  ON "GopRecoveryRecord"("jobId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "GopRecoveryRecord_executionId_createdAt_idx"
  ON "GopRecoveryRecord"("executionId", "createdAt" DESC);
