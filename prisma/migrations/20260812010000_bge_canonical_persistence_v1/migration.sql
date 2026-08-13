CREATE TABLE "BgeCanonicalObject" (
  "objectId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "canonicalStatus" TEXT NOT NULL,
  "currentVersionId" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "deprecatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BgeCanonicalObject_pkey" PRIMARY KEY ("objectId")
);

CREATE TABLE "BgeCanonicalObjectVersion" (
  "versionId" TEXT NOT NULL,
  "objectId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorDisplayName" TEXT,
  "evidenceIds" JSONB NOT NULL,
  "policyIds" JSONB NOT NULL,
  "payload" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "rollbackOfVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  CONSTRAINT "BgeCanonicalObjectVersion_pkey" PRIMARY KEY ("versionId")
);

CREATE TABLE "BgeCanonicalRelationship" (
  "relationshipId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL,
  "sourceObjectId" TEXT NOT NULL,
  "targetObjectId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdByActorType" TEXT NOT NULL,
  "createdByActorId" TEXT NOT NULL,
  "createdByDisplayName" TEXT,
  "evidenceIds" JSONB NOT NULL,
  "policyIds" JSONB NOT NULL,
  "effectiveAt" TIMESTAMP(3),
  "deprecatedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BgeCanonicalRelationship_pkey" PRIMARY KEY ("relationshipId")
);

CREATE TABLE "BgeCanonicalProposal" (
  "proposalId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "objectType" TEXT NOT NULL,
  "objectId" TEXT,
  "operation" TEXT NOT NULL,
  "patch" JSONB,
  "relationship" JSONB,
  "evidenceIds" JSONB NOT NULL,
  "policyIds" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "initiatorActorType" TEXT NOT NULL,
  "initiatorActorId" TEXT NOT NULL,
  "initiatorDisplayName" TEXT,
  "status" TEXT NOT NULL,
  "confidenceScore" DECIMAL(10,6),
  "confidenceReference" TEXT,
  "expiresAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BgeCanonicalProposal_pkey" PRIMARY KEY ("proposalId")
);

CREATE TABLE "BgeCanonicalApproval" (
  "approvalId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "proposalId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "approverActorType" TEXT NOT NULL,
  "approverActorId" TEXT NOT NULL,
  "approverDisplayName" TEXT,
  "policyIds" JSONB NOT NULL,
  "resultingObjectId" TEXT,
  "resultingVersionId" TEXT,
  "resultingRelationshipId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "decidedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BgeCanonicalApproval_pkey" PRIMARY KEY ("approvalId")
);

CREATE UNIQUE INDEX "BgeCanonicalRelationship_tenantId_idempotencyKey_key" ON "BgeCanonicalRelationship"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "BgeCanonicalProposal_tenantId_idempotencyKey_key" ON "BgeCanonicalProposal"("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "BgeCanonicalApproval_proposalId_key" ON "BgeCanonicalApproval"("proposalId");
CREATE UNIQUE INDEX "BgeCanonicalApproval_tenantId_idempotencyKey_key" ON "BgeCanonicalApproval"("tenantId", "idempotencyKey");

CREATE INDEX "BgeCanonicalObject_tenantId_objectType_updatedAt_idx" ON "BgeCanonicalObject"("tenantId", "objectType", "updatedAt" DESC);
CREATE INDEX "BgeCanonicalObject_tenantId_canonicalStatus_updatedAt_idx" ON "BgeCanonicalObject"("tenantId", "canonicalStatus", "updatedAt" DESC);
CREATE INDEX "BgeCanonicalObjectVersion_tenantId_objectId_createdAt_idx" ON "BgeCanonicalObjectVersion"("tenantId", "objectId", "createdAt" DESC);
CREATE INDEX "BgeCanonicalObjectVersion_rollbackOfVersionId_idx" ON "BgeCanonicalObjectVersion"("rollbackOfVersionId");
CREATE INDEX "BgeCanonicalRelationship_tenantId_relationshipType_createdAt_idx" ON "BgeCanonicalRelationship"("tenantId", "relationshipType", "createdAt" DESC);
CREATE INDEX "BgeCanonicalRelationship_tenantId_sourceObjectId_targetObjectId_status_idx" ON "BgeCanonicalRelationship"("tenantId", "sourceObjectId", "targetObjectId", "status");
CREATE INDEX "BgeCanonicalProposal_tenantId_status_createdAt_idx" ON "BgeCanonicalProposal"("tenantId", "status", "createdAt" DESC);
CREATE INDEX "BgeCanonicalProposal_tenantId_objectId_createdAt_idx" ON "BgeCanonicalProposal"("tenantId", "objectId", "createdAt" DESC);
CREATE INDEX "BgeCanonicalApproval_tenantId_decidedAt_idx" ON "BgeCanonicalApproval"("tenantId", "decidedAt" DESC);

ALTER TABLE "BgeCanonicalObject"
  ADD CONSTRAINT "BgeCanonicalObject_currentVersionId_fkey"
  FOREIGN KEY ("currentVersionId") REFERENCES "BgeCanonicalObjectVersion"("versionId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BgeCanonicalObjectVersion"
  ADD CONSTRAINT "BgeCanonicalObjectVersion_objectId_fkey"
  FOREIGN KEY ("objectId") REFERENCES "BgeCanonicalObject"("objectId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BgeCanonicalRelationship"
  ADD CONSTRAINT "BgeCanonicalRelationship_sourceObjectId_fkey"
  FOREIGN KEY ("sourceObjectId") REFERENCES "BgeCanonicalObject"("objectId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BgeCanonicalRelationship"
  ADD CONSTRAINT "BgeCanonicalRelationship_targetObjectId_fkey"
  FOREIGN KEY ("targetObjectId") REFERENCES "BgeCanonicalObject"("objectId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BgeCanonicalProposal"
  ADD CONSTRAINT "BgeCanonicalProposal_objectId_fkey"
  FOREIGN KEY ("objectId") REFERENCES "BgeCanonicalObject"("objectId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BgeCanonicalApproval"
  ADD CONSTRAINT "BgeCanonicalApproval_proposalId_fkey"
  FOREIGN KEY ("proposalId") REFERENCES "BgeCanonicalProposal"("proposalId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BgeCanonicalApproval"
  ADD CONSTRAINT "BgeCanonicalApproval_resultingObjectId_fkey"
  FOREIGN KEY ("resultingObjectId") REFERENCES "BgeCanonicalObject"("objectId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BgeCanonicalApproval"
  ADD CONSTRAINT "BgeCanonicalApproval_resultingVersionId_fkey"
  FOREIGN KEY ("resultingVersionId") REFERENCES "BgeCanonicalObjectVersion"("versionId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BgeCanonicalApproval"
  ADD CONSTRAINT "BgeCanonicalApproval_resultingRelationshipId_fkey"
  FOREIGN KEY ("resultingRelationshipId") REFERENCES "BgeCanonicalRelationship"("relationshipId") ON DELETE SET NULL ON UPDATE CASCADE;