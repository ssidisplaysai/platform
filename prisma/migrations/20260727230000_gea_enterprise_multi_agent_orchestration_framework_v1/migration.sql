-- GEA-0004: Genesis Enterprise Multi-Agent Orchestration Framework v1.0
-- Additive migration only.

CREATE TABLE "GeaOrchestration" (
  "orchestrationId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "lifecycleState" TEXT NOT NULL,
  "activeWorkflowId" TEXT NOT NULL,
  "activeWorkflowVersionId" TEXT NOT NULL,
  "versions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaOrchestration_workspaceId_updatedAt_idx" ON "GeaOrchestration" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GeaOrchestration_organizationId_updatedAt_idx" ON "GeaOrchestration" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GeaOrchestration_projectId_updatedAt_idx" ON "GeaOrchestration" ("projectId", "updatedAt" DESC);
CREATE INDEX "GeaOrchestration_lifecycleState_updatedAt_idx" ON "GeaOrchestration" ("lifecycleState", "updatedAt" DESC);

CREATE TABLE "GeaWorkflowDefinition" (
  "workflowId" TEXT PRIMARY KEY,
  "orchestrationId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "workflowKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "lifecycleState" TEXT NOT NULL,
  "steps" JSONB NOT NULL,
  "transitions" JSONB NOT NULL,
  "dependencies" JSONB NOT NULL,
  "scheduling" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaWorkflowDefinition_workspaceId_updatedAt_idx" ON "GeaWorkflowDefinition" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GeaWorkflowDefinition_organizationId_updatedAt_idx" ON "GeaWorkflowDefinition" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GeaWorkflowDefinition_orchestrationId_updatedAt_idx" ON "GeaWorkflowDefinition" ("orchestrationId", "updatedAt" DESC);
CREATE INDEX "GeaWorkflowDefinition_workflowKey_idx" ON "GeaWorkflowDefinition" ("workflowKey");
CREATE INDEX "GeaWorkflowDefinition_lifecycleState_updatedAt_idx" ON "GeaWorkflowDefinition" ("lifecycleState", "updatedAt" DESC);

CREATE TABLE "GeaWorkflowVersion" (
  "workflowVersionId" TEXT PRIMARY KEY,
  "workflowId" TEXT NOT NULL,
  "versionTag" TEXT NOT NULL,
  "immutable" BOOLEAN NOT NULL,
  "definitionChecksum" TEXT NOT NULL,
  "publishedBy" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaWorkflowVersion_workflowId_publishedAt_idx" ON "GeaWorkflowVersion" ("workflowId", "publishedAt" DESC);
CREATE INDEX "GeaWorkflowVersion_definitionChecksum_idx" ON "GeaWorkflowVersion" ("definitionChecksum");

CREATE TABLE "GeaOrchestrationExecution" (
  "executionId" TEXT PRIMARY KEY,
  "orchestrationId" TEXT NOT NULL,
  "workflowId" TEXT NOT NULL,
  "workflowVersionId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "initiatedBy" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "coordinationStateByStep" JSONB NOT NULL,
  "contextPackageId" TEXT,
  "toolExecutionIds" JSONB NOT NULL,
  "delegations" JSONB NOT NULL,
  "approvals" JSONB NOT NULL,
  "compensationActions" JSONB NOT NULL,
  "retryCounts" JSONB NOT NULL,
  "timeline" JSONB NOT NULL,
  "immutableLineage" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3)
);

CREATE INDEX "GeaOrchestrationExecution_workspaceId_startedAt_idx" ON "GeaOrchestrationExecution" ("workspaceId", "startedAt" DESC);
CREATE INDEX "GeaOrchestrationExecution_organizationId_startedAt_idx" ON "GeaOrchestrationExecution" ("organizationId", "startedAt" DESC);
CREATE INDEX "GeaOrchestrationExecution_projectId_startedAt_idx" ON "GeaOrchestrationExecution" ("projectId", "startedAt" DESC);
CREATE INDEX "GeaOrchestrationExecution_orchestrationId_startedAt_idx" ON "GeaOrchestrationExecution" ("orchestrationId", "startedAt" DESC);
CREATE INDEX "GeaOrchestrationExecution_workflowId_startedAt_idx" ON "GeaOrchestrationExecution" ("workflowId", "startedAt" DESC);
CREATE INDEX "GeaOrchestrationExecution_state_startedAt_idx" ON "GeaOrchestrationExecution" ("state", "startedAt" DESC);
CREATE INDEX "GeaOrchestrationExecution_immutableLineage_idx" ON "GeaOrchestrationExecution" ("immutableLineage");

CREATE TABLE "GeaOrchestrationDelegation" (
  "delegationId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "fromAgentId" TEXT NOT NULL,
  "toAgentId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "delegatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaOrchestrationDelegation_executionId_delegatedAt_idx" ON "GeaOrchestrationDelegation" ("executionId", "delegatedAt" DESC);
CREATE INDEX "GeaOrchestrationDelegation_toAgentId_delegatedAt_idx" ON "GeaOrchestrationDelegation" ("toAgentId", "delegatedAt" DESC);

CREATE TABLE "GeaOrchestrationApproval" (
  "approvalCheckpointId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "requiredApprovers" JSONB NOT NULL,
  "approvedBy" JSONB NOT NULL,
  "timeoutAt" TIMESTAMP(3),
  "escalationPolicy" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaOrchestrationApproval_executionId_createdAt_idx" ON "GeaOrchestrationApproval" ("executionId", "createdAt" DESC);
CREATE INDEX "GeaOrchestrationApproval_state_createdAt_idx" ON "GeaOrchestrationApproval" ("state", "createdAt" DESC);

CREATE TABLE "GeaOrchestrationCompensation" (
  "compensationActionId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "reversible" BOOLEAN NOT NULL,
  "actionType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaOrchestrationCompensation_executionId_createdAt_idx" ON "GeaOrchestrationCompensation" ("executionId", "createdAt" DESC);
CREATE INDEX "GeaOrchestrationCompensation_status_createdAt_idx" ON "GeaOrchestrationCompensation" ("status", "createdAt" DESC);

CREATE TABLE "GeaOrchestrationSnapshot" (
  "snapshotId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "state" TEXT NOT NULL,
  "coordinationStateByStep" JSONB NOT NULL,
  "approvals" JSONB NOT NULL,
  "retries" JSONB NOT NULL,
  "pendingSteps" JSONB NOT NULL,
  "completedSteps" JSONB NOT NULL,
  "failedSteps" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaOrchestrationSnapshot_executionId_sequence_idx" ON "GeaOrchestrationSnapshot" ("executionId", "sequence");
CREATE INDEX "GeaOrchestrationSnapshot_executionId_createdAt_idx" ON "GeaOrchestrationSnapshot" ("executionId", "createdAt" DESC);

CREATE TABLE "GeaOrchestrationReplay" (
  "replayRecordId" TEXT PRIMARY KEY,
  "executionId" TEXT NOT NULL,
  "replayChecksum" TEXT NOT NULL,
  "determinism" TEXT NOT NULL,
  "nonDeterministicDependencies" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaOrchestrationReplay_executionId_createdAt_idx" ON "GeaOrchestrationReplay" ("executionId", "createdAt" DESC);
CREATE INDEX "GeaOrchestrationReplay_replayChecksum_idx" ON "GeaOrchestrationReplay" ("replayChecksum");

CREATE TABLE "GeaOrchestrationHealth" (
  "healthId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "activeExecutions" INTEGER NOT NULL,
  "pausedExecutions" INTEGER NOT NULL,
  "approvalBacklog" INTEGER NOT NULL,
  "failureRate" DOUBLE PRECISION NOT NULL,
  "replayDriftRate" DOUBLE PRECISION NOT NULL,
  "queueDepth" INTEGER NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL,
  "metrics" JSONB NOT NULL
);

CREATE INDEX "GeaOrchestrationHealth_workspaceId_computedAt_idx" ON "GeaOrchestrationHealth" ("workspaceId", "computedAt" DESC);
CREATE INDEX "GeaOrchestrationHealth_organizationId_computedAt_idx" ON "GeaOrchestrationHealth" ("organizationId", "computedAt" DESC);
CREATE INDEX "GeaOrchestrationHealth_status_computedAt_idx" ON "GeaOrchestrationHealth" ("status", "computedAt" DESC);
