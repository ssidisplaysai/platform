-- GEA-0003: Genesis Enterprise Memory & Context Framework v1.0
-- Additive migration only.

CREATE TABLE "GeaMemorySource" (
  "memorySourceId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceVersion" TEXT NOT NULL,
  "authoritative" BOOLEAN NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GeaMemorySource_workspaceId_updatedAt_idx" ON "GeaMemorySource" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GeaMemorySource_organizationId_updatedAt_idx" ON "GeaMemorySource" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GeaMemorySource_sourceType_updatedAt_idx" ON "GeaMemorySource" ("sourceType", "updatedAt" DESC);
CREATE INDEX "GeaMemorySource_sourceId_updatedAt_idx" ON "GeaMemorySource" ("sourceId", "updatedAt" DESC);

CREATE TABLE "GeaMemoryReference" (
  "memoryReferenceId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "registryIdentity" TEXT NOT NULL,
  "referenceType" TEXT NOT NULL,
  "referenceId" TEXT NOT NULL,
  "referenceVersion" TEXT NOT NULL,
  "source" JSONB NOT NULL,
  "memoryVersion" JSONB NOT NULL,
  "capabilityKey" TEXT,
  "permissionAction" TEXT,
  "authorityState" TEXT NOT NULL,
  "immutable" BOOLEAN NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GeaMemoryReference_workspaceId_updatedAt_idx" ON "GeaMemoryReference" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GeaMemoryReference_organizationId_updatedAt_idx" ON "GeaMemoryReference" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GeaMemoryReference_projectId_updatedAt_idx" ON "GeaMemoryReference" ("projectId", "updatedAt" DESC);
CREATE INDEX "GeaMemoryReference_registryIdentity_idx" ON "GeaMemoryReference" ("registryIdentity");
CREATE INDEX "GeaMemoryReference_referenceType_updatedAt_idx" ON "GeaMemoryReference" ("referenceType", "updatedAt" DESC);
CREATE INDEX "GeaMemoryReference_referenceId_updatedAt_idx" ON "GeaMemoryReference" ("referenceId", "updatedAt" DESC);

CREATE TABLE "GeaMemoryVersion" (
  "memoryVersionId" TEXT PRIMARY KEY,
  "memoryReferenceId" TEXT NOT NULL,
  "versionTag" TEXT NOT NULL,
  "checksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaMemoryVersion_memoryReferenceId_createdAt_idx" ON "GeaMemoryVersion" ("memoryReferenceId", "createdAt" DESC);
CREATE INDEX "GeaMemoryVersion_checksum_idx" ON "GeaMemoryVersion" ("checksum");

CREATE TABLE "GeaMemoryCollection" (
  "memoryCollectionId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "lifecycleState" TEXT NOT NULL,
  "memoryReferenceIds" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "GeaMemoryCollection_workspaceId_updatedAt_idx" ON "GeaMemoryCollection" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GeaMemoryCollection_organizationId_updatedAt_idx" ON "GeaMemoryCollection" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GeaMemoryCollection_lifecycleState_updatedAt_idx" ON "GeaMemoryCollection" ("lifecycleState", "updatedAt" DESC);

CREATE TABLE "GeaMemorySnapshot" (
  "memorySnapshotId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "memoryCollectionId" TEXT,
  "memoryReferenceIds" JSONB NOT NULL,
  "snapshotChecksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaMemorySnapshot_workspaceId_createdAt_idx" ON "GeaMemorySnapshot" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GeaMemorySnapshot_organizationId_createdAt_idx" ON "GeaMemorySnapshot" ("organizationId", "createdAt" DESC);
CREATE INDEX "GeaMemorySnapshot_projectId_createdAt_idx" ON "GeaMemorySnapshot" ("projectId", "createdAt" DESC);
CREATE INDEX "GeaMemorySnapshot_snapshotChecksum_idx" ON "GeaMemorySnapshot" ("snapshotChecksum");

CREATE TABLE "GeaContextPackage" (
  "contextPackageId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "agentId" TEXT,
  "lifecycleState" TEXT NOT NULL,
  "contextVersion" TEXT NOT NULL,
  "sections" JSONB NOT NULL,
  "dependencies" JSONB NOT NULL,
  "assembly" JSONB NOT NULL,
  "policy" JSONB NOT NULL,
  "timeline" JSONB NOT NULL,
  "packageChecksum" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "deterministic" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaContextPackage_workspaceId_createdAt_idx" ON "GeaContextPackage" ("workspaceId", "createdAt" DESC);
CREATE INDEX "GeaContextPackage_organizationId_createdAt_idx" ON "GeaContextPackage" ("organizationId", "createdAt" DESC);
CREATE INDEX "GeaContextPackage_projectId_createdAt_idx" ON "GeaContextPackage" ("projectId", "createdAt" DESC);
CREATE INDEX "GeaContextPackage_agentId_createdAt_idx" ON "GeaContextPackage" ("agentId", "createdAt" DESC);
CREATE INDEX "GeaContextPackage_cacheKey_idx" ON "GeaContextPackage" ("cacheKey");
CREATE INDEX "GeaContextPackage_packageChecksum_idx" ON "GeaContextPackage" ("packageChecksum");

CREATE TABLE "GeaContextValidation" (
  "contextValidationId" TEXT PRIMARY KEY,
  "contextPackageId" TEXT NOT NULL,
  "validationStatus" TEXT NOT NULL,
  "issues" JSONB NOT NULL,
  "validatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaContextValidation_contextPackageId_validatedAt_idx" ON "GeaContextValidation" ("contextPackageId", "validatedAt" DESC);
CREATE INDEX "GeaContextValidation_validationStatus_validatedAt_idx" ON "GeaContextValidation" ("validationStatus", "validatedAt" DESC);

CREATE TABLE "GeaContextReplay" (
  "contextReplayId" TEXT PRIMARY KEY,
  "contextPackageId" TEXT NOT NULL,
  "replayChecksum" TEXT NOT NULL,
  "deterministicPossible" BOOLEAN NOT NULL,
  "deterministicMatch" BOOLEAN,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaContextReplay_contextPackageId_createdAt_idx" ON "GeaContextReplay" ("contextPackageId", "createdAt" DESC);
CREATE INDEX "GeaContextReplay_replayChecksum_idx" ON "GeaContextReplay" ("replayChecksum");

CREATE TABLE "GeaContextCache" (
  "contextCacheId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "contextPackageId" TEXT NOT NULL,
  "sourceVersionFingerprint" TEXT NOT NULL,
  "cacheStatus" TEXT NOT NULL,
  "hitCount" INTEGER NOT NULL,
  "lastHitAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaContextCache_workspaceId_updatedAt_idx" ON "GeaContextCache" ("workspaceId", "updatedAt" DESC);
CREATE INDEX "GeaContextCache_organizationId_updatedAt_idx" ON "GeaContextCache" ("organizationId", "updatedAt" DESC);
CREATE INDEX "GeaContextCache_cacheKey_idx" ON "GeaContextCache" ("cacheKey");
CREATE INDEX "GeaContextCache_cacheStatus_updatedAt_idx" ON "GeaContextCache" ("cacheStatus", "updatedAt" DESC);

CREATE TABLE "GeaContextHealth" (
  "contextHealthId" TEXT PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "assemblyLatencyMs" INTEGER NOT NULL,
  "cacheUtilization" DOUBLE PRECISION NOT NULL,
  "validationFailures" INTEGER NOT NULL,
  "authorizationFailures" INTEGER NOT NULL,
  "missingReferences" INTEGER NOT NULL,
  "staleReferences" INTEGER NOT NULL,
  "versionDrift" INTEGER NOT NULL,
  "healthStatus" TEXT NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "GeaContextHealth_workspaceId_computedAt_idx" ON "GeaContextHealth" ("workspaceId", "computedAt" DESC);
CREATE INDEX "GeaContextHealth_organizationId_computedAt_idx" ON "GeaContextHealth" ("organizationId", "computedAt" DESC);
CREATE INDEX "GeaContextHealth_healthStatus_computedAt_idx" ON "GeaContextHealth" ("healthStatus", "computedAt" DESC);
