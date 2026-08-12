DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'GlwDailyPublishPlanStatus'
  ) THEN
    CREATE TYPE "GlwDailyPublishPlanStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAUSED', 'EXECUTING', 'COMPLETE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'GlwDailyPublishCandidateAction'
  ) THEN
    CREATE TYPE "GlwDailyPublishCandidateAction" AS ENUM (
      'CREATE_STATE',
      'CREATE_CITY',
      'UPDATE_CITY',
      'SKIP_EXISTING',
      'BLOCKED_PARENT',
      'BLOCKED_DUPLICATE',
      'BLOCKED_QA',
      'BLOCKED_SITE'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'GlwDailyPublishCandidateApprovalStatus'
  ) THEN
    CREATE TYPE "GlwDailyPublishCandidateApprovalStatus" AS ENUM (
      'PENDING',
      'APPROVED',
      'EXCLUDED',
      'BLOCKED',
      'QUEUED',
      'SKIPPED_ALREADY_QUEUED'
    );
  END IF;
END $$;

ALTER TYPE "GlwJobStatus" ADD VALUE IF NOT EXISTS 'FAILED_QA';

CREATE TABLE IF NOT EXISTS "GlwDailyPublishPlan" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL,
  "status" "GlwDailyPublishPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "dailyPageLimit" INTEGER NOT NULL,
  "hourlyPageLimit" INTEGER NOT NULL,
  "maxConcurrentJobs" INTEGER NOT NULL,
  "retryLimit" INTEGER NOT NULL,
  "minimumDelaySeconds" INTEGER NOT NULL,
  "summaryJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlwDailyPublishPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GlwDailyPublishCandidate" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productSlug" TEXT NOT NULL,
  "stateName" TEXT NOT NULL,
  "stateSlug" TEXT NOT NULL,
  "cityName" TEXT,
  "citySlug" TEXT,
  "canonicalPath" TEXT NOT NULL,
  "desiredAction" "GlwDailyPublishCandidateAction" NOT NULL,
  "priority" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "existingWordPressId" TEXT,
  "existingStatus" TEXT,
  "parentProductId" TEXT,
  "parentStateId" TEXT,
  "approvalStatus" "GlwDailyPublishCandidateApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "queueJobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlwDailyPublishCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GlwPublishingControl" (
  "siteId" TEXT NOT NULL,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "pausedAt" TIMESTAMP(3),
  "pausedBy" TEXT,
  "publishingEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlwPublishingControl_pkey" PRIMARY KEY ("siteId")
);

CREATE INDEX IF NOT EXISTS "GlwDailyPublishPlan_siteId_generatedAt_idx"
  ON "GlwDailyPublishPlan"("siteId", "generatedAt" DESC);

CREATE INDEX IF NOT EXISTS "GlwDailyPublishPlan_status_generatedAt_idx"
  ON "GlwDailyPublishPlan"("status", "generatedAt" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "GlwDailyPublishCandidate_planId_canonicalPath_key"
  ON "GlwDailyPublishCandidate"("planId", "canonicalPath");

CREATE INDEX IF NOT EXISTS "GlwDailyPublishCandidate_siteId_desiredAction_idx"
  ON "GlwDailyPublishCandidate"("siteId", "desiredAction");

CREATE INDEX IF NOT EXISTS "GlwDailyPublishCandidate_approvalStatus_priority_idx"
  ON "GlwDailyPublishCandidate"("approvalStatus", "priority");

CREATE INDEX IF NOT EXISTS "GlwDailyPublishCandidate_queueJobId_idx"
  ON "GlwDailyPublishCandidate"("queueJobId");

CREATE INDEX IF NOT EXISTS "GlwPublishingControl_paused_updatedAt_idx"
  ON "GlwPublishingControl"("paused", "updatedAt" DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'GlwDailyPublishCandidate_planId_fkey'
  ) THEN
    ALTER TABLE "GlwDailyPublishCandidate"
      ADD CONSTRAINT "GlwDailyPublishCandidate_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "GlwDailyPublishPlan"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
