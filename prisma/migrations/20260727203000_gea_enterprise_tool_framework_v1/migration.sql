-- GEA-0002: Genesis Enterprise Tool Framework v1.0
-- Additive migration only.

CREATE TABLE "GeaToolDefinition" (
  "toolId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "toolKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "lifecycleState" TEXT NOT NULL,
  "definition" JSONB NOT NULL,
  "activeVersionTag" TEXT NOT NULL,
  "versions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "GeaToolDefinition_workspaceId_toolKey_key" ON "GeaToolDefinition" ("workspaceId", "toolKey");
CREATE INDEX "GeaToolDefinition_workspaceId_updatedAt_idx" ON "GeaToolDefinition" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GeaToolDefinition_organizationId_updatedAt_idx" ON "GeaToolDefinition" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GeaToolDefinition_category_updatedAt_idx" ON "GeaToolDefinition" ("category", "updatedAt" DESC);
CREATE INDEX "GeaToolDefinition_lifecycleState_updatedAt_idx" ON "GeaToolDefinition" ("lifecycleState", "updatedAt" DESC);

CREATE TABLE "GeaToolExecution" (
  "executionId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT,
  "organizationId" TEXT,
  "toolId" TEXT NOT NULL,
  "toolVersionId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "mode" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "output" JSONB,
  "warnings" JSONB NOT NULL,
  "error" TEXT,
  "durationMs" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "authorization" JSONB NOT NULL,
  "timeline" JSONB NOT NULL,
  "immutableLineage" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GeaToolExecution_workspaceId_startedAt_idx" ON "GeaToolExecution" ("workspaceId", "startedAt" DESC);
CREATE INDEX "GeaToolExecution_projectId_startedAt_idx" ON "GeaToolExecution" ("projectId", "startedAt" DESC);
CREATE INDEX "GeaToolExecution_toolId_startedAt_idx" ON "GeaToolExecution" ("toolId", "startedAt" DESC);
CREATE INDEX "GeaToolExecution_agentId_startedAt_idx" ON "GeaToolExecution" ("agentId", "startedAt" DESC);
CREATE INDEX "GeaToolExecution_state_startedAt_idx" ON "GeaToolExecution" ("state", "startedAt" DESC);
CREATE INDEX "GeaToolExecution_immutableLineage_idx" ON "GeaToolExecution" ("immutableLineage");

CREATE TABLE "GeaToolExecutionTimeline" (
  "timelineEventId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaToolExecutionTimeline_executionId_sequence_idx" ON "GeaToolExecutionTimeline" ("executionId", "sequence");
CREATE INDEX "GeaToolExecutionTimeline_executionId_createdAt_idx" ON "GeaToolExecutionTimeline" ("executionId", "createdAt" DESC);

CREATE TABLE "GeaToolReplay" (
  "replayId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "toolVersionId" TEXT NOT NULL,
  "inputContractVersion" TEXT NOT NULL,
  "agentVersion" TEXT NOT NULL,
  "permissionEvaluation" JSONB NOT NULL,
  "runtimeVersion" TEXT NOT NULL,
  "deterministicSupported" BOOLEAN NOT NULL,
  "deterministicMatch" BOOLEAN,
  "replayChecksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaToolReplay_executionId_createdAt_idx" ON "GeaToolReplay" ("executionId", "createdAt" DESC);
CREATE INDEX "GeaToolReplay_toolVersionId_createdAt_idx" ON "GeaToolReplay" ("toolVersionId", "createdAt" DESC);
CREATE INDEX "GeaToolReplay_replayChecksum_idx" ON "GeaToolReplay" ("replayChecksum");

CREATE TABLE "GeaToolHealth" (
  "healthId" TEXT PRIMARY KEY,
  "toolId" TEXT NOT NULL,
  "toolVersionId" TEXT,
  "availability" DOUBLE PRECISION NOT NULL,
  "latencyMs" INTEGER NOT NULL,
  "successRate" DOUBLE PRECISION NOT NULL,
  "failureRate" DOUBLE PRECISION NOT NULL,
  "version" TEXT NOT NULL,
  "lastSuccessfulExecution" TEXT,
  "lastFailure" TEXT,
  "healthStatus" TEXT NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GeaToolHealth_toolId_computedAt_idx" ON "GeaToolHealth" ("toolId", "computedAt" DESC);
CREATE INDEX "GeaToolHealth_healthStatus_computedAt_idx" ON "GeaToolHealth" ("healthStatus", "computedAt" DESC);

CREATE TABLE "GeaToolValidation" (
  "validationId" TEXT PRIMARY KEY,
  "toolVersionId" TEXT NOT NULL,
  "validationStatus" TEXT NOT NULL,
  "issues" JSONB NOT NULL,
  "validatedBy" TEXT NOT NULL,
  "validatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GeaToolValidation_toolVersionId_validatedAt_idx" ON "GeaToolValidation" ("toolVersionId", "validatedAt" DESC);
CREATE INDEX "GeaToolValidation_validationStatus_validatedAt_idx" ON "GeaToolValidation" ("validationStatus", "validatedAt" DESC);

CREATE TABLE "GeaToolLifecycleEvent" (
  "lifecycleEventId" TEXT PRIMARY KEY,
  "toolId" TEXT NOT NULL,
  "previousState" TEXT,
  "nextState" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaToolLifecycleEvent_toolId_createdAt_idx" ON "GeaToolLifecycleEvent" ("toolId", "createdAt" DESC);
CREATE INDEX "GeaToolLifecycleEvent_nextState_createdAt_idx" ON "GeaToolLifecycleEvent" ("nextState", "createdAt" DESC);

CREATE TABLE "GeaToolPolicyHistory" (
  "policyRecordId" TEXT PRIMARY KEY,
  "toolVersionId" TEXT NOT NULL,
  "previousPolicyChecksum" TEXT,
  "nextPolicyChecksum" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "changedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GeaToolPolicyHistory_toolVersionId_changedAt_idx" ON "GeaToolPolicyHistory" ("toolVersionId", "changedAt" DESC);
CREATE INDEX "GeaToolPolicyHistory_nextPolicyChecksum_idx" ON "GeaToolPolicyHistory" ("nextPolicyChecksum");
