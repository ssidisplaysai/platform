-- GEA-0001: Genesis Enterprise Agent Framework v1.0
-- Additive migration only.

CREATE TABLE "GeaAgent" (
  "agentId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "lifecycleState" TEXT NOT NULL,
  "identity" JSONB NOT NULL,
  "capabilities" JSONB NOT NULL,
  "permissions" JSONB NOT NULL,
  "currentVersion" JSONB NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "GeaAgentPlan" (
  "planId" TEXT PRIMARY KEY,
  "agentId" TEXT NOT NULL,
  "planVersion" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "immutableAfterStart" BOOLEAN NOT NULL DEFAULT true,
  "tasks" JSONB NOT NULL,
  "dependencyChecksum" TEXT NOT NULL
);

CREATE TABLE "GeaAgentExecution" (
  "executionId" TEXT PRIMARY KEY,
  "agentId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "projectId" TEXT,
  "state" TEXT NOT NULL,
  "objective" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "planVersion" TEXT NOT NULL,
  "capabilityVersions" JSONB NOT NULL,
  "toolVersions" JSONB NOT NULL,
  "permissionEvaluations" JSONB NOT NULL,
  "timeline" JSONB NOT NULL,
  "retries" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "resultId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "GeaAgentAction" (
  "actionId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "toolKey" TEXT NOT NULL,
  "toolVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "input" JSONB NOT NULL,
  "output" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "GeaAgentResult" (
  "resultId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "outputs" JSONB NOT NULL,
  "producedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "GeaAgentAuditRecord" (
  "auditRecordId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "GeaAgentReplay" (
  "replayId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "replayOfExecutionId" TEXT NOT NULL,
  "deterministicMatch" BOOLEAN NOT NULL,
  "replayChecksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "GeaAgentMemoryReference" (
  "memoryReferenceId" TEXT PRIMARY KEY,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "referenceVersion" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "GeaAgentApproval" (
  "approvalId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "requestedBy" TEXT NOT NULL,
  "decidedBy" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GeaAgent_workspaceId_updatedAt_idx" ON "GeaAgent" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GeaAgent_organizationId_updatedAt_idx" ON "GeaAgent" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GeaAgent_lifecycleState_updatedAt_idx" ON "GeaAgent" ("lifecycleState", "updatedAt" DESC);

CREATE INDEX "GeaAgentPlan_agentId_createdAt_idx" ON "GeaAgentPlan" ("agentId", "createdAt" DESC);
CREATE INDEX "GeaAgentPlan_dependencyChecksum_idx" ON "GeaAgentPlan" ("dependencyChecksum");

CREATE INDEX "GeaAgentExecution_workspaceId_createdAt_idx" ON "GeaAgentExecution" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GeaAgentExecution_agentId_createdAt_idx" ON "GeaAgentExecution" ("agentId", "createdAt" DESC);
CREATE INDEX "GeaAgentExecution_projectId_createdAt_idx" ON "GeaAgentExecution" ("projectId", "createdAt" DESC);
CREATE INDEX "GeaAgentExecution_state_createdAt_idx" ON "GeaAgentExecution" ("state", "createdAt" DESC);

CREATE INDEX "GeaAgentAction_executionId_createdAt_idx" ON "GeaAgentAction" ("executionId", "createdAt" DESC);
CREATE INDEX "GeaAgentAction_toolKey_createdAt_idx" ON "GeaAgentAction" ("toolKey", "createdAt" DESC);
CREATE INDEX "GeaAgentAction_status_createdAt_idx" ON "GeaAgentAction" ("status", "createdAt" DESC);

CREATE INDEX "GeaAgentResult_executionId_producedAt_idx" ON "GeaAgentResult" ("executionId", "producedAt" DESC);
CREATE INDEX "GeaAgentResult_status_producedAt_idx" ON "GeaAgentResult" ("status", "producedAt" DESC);

CREATE INDEX "GeaAgentAuditRecord_executionId_createdAt_idx" ON "GeaAgentAuditRecord" ("executionId", "createdAt" DESC);
CREATE INDEX "GeaAgentAuditRecord_eventType_createdAt_idx" ON "GeaAgentAuditRecord" ("eventType", "createdAt" DESC);

CREATE INDEX "GeaAgentReplay_executionId_createdAt_idx" ON "GeaAgentReplay" ("executionId", "createdAt" DESC);
CREATE INDEX "GeaAgentReplay_replayOfExecutionId_createdAt_idx" ON "GeaAgentReplay" ("replayOfExecutionId", "createdAt" DESC);
CREATE INDEX "GeaAgentReplay_replayChecksum_idx" ON "GeaAgentReplay" ("replayChecksum");

CREATE INDEX "GeaAgentMemoryReference_referenceType_createdAt_idx" ON "GeaAgentMemoryReference" ("referenceType", "createdAt" DESC);
CREATE INDEX "GeaAgentMemoryReference_referenceId_createdAt_idx" ON "GeaAgentMemoryReference" ("referenceId", "createdAt" DESC);

CREATE INDEX "GeaAgentApproval_executionId_createdAt_idx" ON "GeaAgentApproval" ("executionId", "createdAt" DESC);
CREATE INDEX "GeaAgentApproval_state_createdAt_idx" ON "GeaAgentApproval" ("state", "createdAt" DESC);
