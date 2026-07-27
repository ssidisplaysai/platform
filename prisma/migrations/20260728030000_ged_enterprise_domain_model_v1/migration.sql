CREATE TABLE "GedEntityDefinition" (
    "enterpriseEntityId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "entityCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pluralName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "stewardshipArea" TEXT NOT NULL,
    "lifecyclePreset" TEXT NOT NULL,
    "lifecycle" JSONB NOT NULL,
    "authorizationBoundary" TEXT NOT NULL,
    "consumerAgents" JSONB NOT NULL,
    "relationshipKeys" JSONB NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "immutableLineage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GedEntityDefinition_pkey" PRIMARY KEY ("enterpriseEntityId")
);

CREATE TABLE "GedRelationshipDefinition" (
    "enterpriseRelationshipId" TEXT NOT NULL,
    "relationshipKey" TEXT NOT NULL,
    "sourceEntityKey" TEXT NOT NULL,
    "targetEntityKey" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "cardinality" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "authorizationBoundary" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "immutableLineage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GedRelationshipDefinition_pkey" PRIMARY KEY ("enterpriseRelationshipId")
);

CREATE TABLE "GedEntityVersion" (
    "enterpriseEntityVersionId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "definitionSnapshot" JSONB NOT NULL,
    "immutableLineage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GedEntityVersion_pkey" PRIMARY KEY ("enterpriseEntityVersionId")
);

CREATE TABLE "GedValidationResult" (
    "enterpriseValidationId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "immutableLineage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GedValidationResult_pkey" PRIMARY KEY ("enterpriseValidationId")
);

CREATE TABLE "GedHealthSnapshot" (
    "enterpriseHealthId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalEntities" INTEGER NOT NULL,
    "totalRelationships" INTEGER NOT NULL,
    "validationIssueCount" INTEGER NOT NULL,
    "duplicateOwnershipCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GedHealthSnapshot_pkey" PRIMARY KEY ("enterpriseHealthId")
);

CREATE TABLE "GedAuditLineage" (
    "enterpriseAuditLineageId" TEXT NOT NULL,
    "entityKey" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "relatedEntityKeys" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "immutableLineage" TEXT NOT NULL,

    CONSTRAINT "GedAuditLineage_pkey" PRIMARY KEY ("enterpriseAuditLineageId")
);

CREATE UNIQUE INDEX "GedEntityDefinition_entityKey_key" ON "GedEntityDefinition"("entityKey");
CREATE UNIQUE INDEX "GedEntityDefinition_entityCode_key" ON "GedEntityDefinition"("entityCode");
CREATE INDEX "GedEntityDefinition_stewardshipArea_updatedAt_idx" ON "GedEntityDefinition"("stewardshipArea", "updatedAt" DESC);
CREATE INDEX "GedEntityDefinition_authorizationBoundary_updatedAt_idx" ON "GedEntityDefinition"("authorizationBoundary", "updatedAt" DESC);

CREATE UNIQUE INDEX "GedRelationshipDefinition_relationshipKey_key" ON "GedRelationshipDefinition"("relationshipKey");
CREATE INDEX "GedRelationshipDefinition_sourceEntityKey_updatedAt_idx" ON "GedRelationshipDefinition"("sourceEntityKey", "updatedAt" DESC);
CREATE INDEX "GedRelationshipDefinition_targetEntityKey_updatedAt_idx" ON "GedRelationshipDefinition"("targetEntityKey", "updatedAt" DESC);
CREATE INDEX "GedRelationshipDefinition_authorizationBoundary_updatedAt_idx" ON "GedRelationshipDefinition"("authorizationBoundary", "updatedAt" DESC);

CREATE UNIQUE INDEX "GedEntityVersion_entityKey_version_key" ON "GedEntityVersion"("entityKey", "version");
CREATE INDEX "GedEntityVersion_entityKey_createdAt_idx" ON "GedEntityVersion"("entityKey", "createdAt" DESC);

CREATE INDEX "GedValidationResult_status_createdAt_idx" ON "GedValidationResult"("status", "createdAt" DESC);

CREATE INDEX "GedHealthSnapshot_status_generatedAt_idx" ON "GedHealthSnapshot"("status", "generatedAt" DESC);

CREATE INDEX "GedAuditLineage_entityKey_occurredAt_idx" ON "GedAuditLineage"("entityKey", "occurredAt" DESC);
CREATE INDEX "GedAuditLineage_eventType_occurredAt_idx" ON "GedAuditLineage"("eventType", "occurredAt" DESC);

ALTER TABLE "GedEntityVersion"
  ADD CONSTRAINT "GedEntityVersion_entityKey_fkey"
  FOREIGN KEY ("entityKey") REFERENCES "GedEntityDefinition"("entityKey") ON DELETE CASCADE ON UPDATE CASCADE;
