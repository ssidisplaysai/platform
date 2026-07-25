-- AlterTable
ALTER TABLE "GlwJob" ADD COLUMN "retryOfJobId" TEXT;

-- CreateIndex
CREATE INDEX "GlwJob_retryOfJobId_idx" ON "GlwJob"("retryOfJobId");
