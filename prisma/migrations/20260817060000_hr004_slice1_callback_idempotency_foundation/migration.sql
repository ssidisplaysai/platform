CREATE TYPE "GlwBusinessStatus" AS ENUM (
  'UNKNOWN',
  'IN_PROGRESS',
  'COMPLETE',
  'FAILED',
  'FAILED_QA'
);

CREATE TYPE "GlwCallbackDeliveryStatus" AS ENUM (
  'NOT_READY',
  'PENDING',
  'RETRYING',
  'ACKNOWLEDGED',
  'DEAD_LETTER'
);

CREATE TYPE "GlwCallbackReceiptOutcome" AS ENUM (
  'RECEIVED',
  'APPLIED',
  'ALREADY_APPLIED',
  'CONFLICT',
  'REJECTED'
);

ALTER TABLE "GlwJob"
  ADD COLUMN "operationKey" TEXT,
  ADD COLUMN "businessStatus" "GlwBusinessStatus",
  ADD COLUMN "callbackDeliveryStatus" "GlwCallbackDeliveryStatus",
  ADD COLUMN "terminalReceiptId" TEXT,
  ADD COLUMN "publicationKey" TEXT;

CREATE TABLE "GlwCallbackReceipt" (
  "receiptId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "terminalScopeKey" TEXT NOT NULL,
  "operationKey" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "externalExecutionId" TEXT NOT NULL,
  "callbackType" TEXT NOT NULL,
  "terminalStatus" TEXT NOT NULL,
  "payloadSha256" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "outcome" "GlwCallbackReceiptOutcome" NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  "responseStatus" INTEGER,
  "conflictReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlwCallbackReceipt_pkey" PRIMARY KEY ("receiptId")
);

CREATE UNIQUE INDEX "GlwJob_operationKey_key" ON "GlwJob"("operationKey");
CREATE INDEX "GlwJob_businessStatus_updatedAt_idx" ON "GlwJob"("businessStatus", "updatedAt" DESC);
CREATE INDEX "GlwJob_callbackDeliveryStatus_updatedAt_idx" ON "GlwJob"("callbackDeliveryStatus", "updatedAt" DESC);
CREATE INDEX "GlwJob_publicationKey_idx" ON "GlwJob"("publicationKey");

CREATE UNIQUE INDEX "GlwCallbackReceipt_idempotencyKey_key" ON "GlwCallbackReceipt"("idempotencyKey");
CREATE UNIQUE INDEX "GlwCallbackReceipt_terminalScopeKey_key" ON "GlwCallbackReceipt"("terminalScopeKey");
CREATE INDEX "GlwCallbackReceipt_jobId_receivedAt_idx" ON "GlwCallbackReceipt"("jobId", "receivedAt" DESC);
CREATE INDEX "GlwCallbackReceipt_operationKey_receivedAt_idx" ON "GlwCallbackReceipt"("operationKey", "receivedAt" DESC);
CREATE INDEX "GlwCallbackReceipt_externalExecutionId_receivedAt_idx" ON "GlwCallbackReceipt"("externalExecutionId", "receivedAt" DESC);
CREATE INDEX "GlwCallbackReceipt_outcome_receivedAt_idx" ON "GlwCallbackReceipt"("outcome", "receivedAt" DESC);