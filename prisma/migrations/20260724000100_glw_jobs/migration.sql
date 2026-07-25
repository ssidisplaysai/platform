-- CreateEnum
CREATE TYPE "GlwJobType" AS ENUM ('PAGE_GENERATION', 'BLOG_GENERATION');

-- CreateEnum
CREATE TYPE "GlwJobStatus" AS ENUM ('QUEUED', 'STARTING', 'RUNNING', 'GENERATING_CONTENT', 'GENERATING_IMAGE', 'UPLOADING_IMAGE', 'PUBLISHING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "GlwJob" (
    "id" TEXT NOT NULL,
    "type" "GlwJobType" NOT NULL,
    "status" "GlwJobStatus" NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB,
    "error" JSONB,
    "externalExecutionId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlwJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GlwJob_type_createdAt_idx" ON "GlwJob"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GlwJob_siteId_createdAt_idx" ON "GlwJob"("siteId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GlwJob_status_createdAt_idx" ON "GlwJob"("status", "createdAt" DESC);
