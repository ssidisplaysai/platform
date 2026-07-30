-- GID-1002B: Durable authentication hardening

CREATE TABLE "IdentitySessionRecord" (
  "sessionId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "identityId" TEXT NOT NULL,
  "authenticationContextId" TEXT NOT NULL,
  "issuedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "revocationReasonCode" TEXT,
  "revokedByPrincipalId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IdentitySessionRecord_pkey" PRIMARY KEY ("sessionId")
);

CREATE UNIQUE INDEX "IdentitySessionRecord_tokenHash_key" ON "IdentitySessionRecord"("tokenHash");
CREATE INDEX "IdentitySessionRecord_principalId_issuedAt_idx" ON "IdentitySessionRecord"("principalId", "issuedAt" DESC);
CREATE INDEX "IdentitySessionRecord_active_expiresAt_idx" ON "IdentitySessionRecord"("active", "expiresAt" DESC);
CREATE INDEX "IdentitySessionRecord_revokedAt_updatedAt_idx" ON "IdentitySessionRecord"("revokedAt", "updatedAt" DESC);

CREATE TABLE "IdentityAuthenticationAudit" (
  "auditId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "principalId" TEXT,
  "workspaceId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "actorPrincipalId" TEXT,
  "correlationId" TEXT,
  "causationId" TEXT,
  "outcome" TEXT NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IdentityAuthenticationAudit_pkey" PRIMARY KEY ("auditId")
);

CREATE INDEX "IdentityAuthenticationAudit_occurredAt_idx" ON "IdentityAuthenticationAudit"("occurredAt" DESC);
CREATE INDEX "IdentityAuthenticationAudit_eventType_occurredAt_idx" ON "IdentityAuthenticationAudit"("eventType", "occurredAt" DESC);
CREATE INDEX "IdentityAuthenticationAudit_principalId_occurredAt_idx" ON "IdentityAuthenticationAudit"("principalId", "occurredAt" DESC);
CREATE INDEX "IdentityAuthenticationAudit_outcome_occurredAt_idx" ON "IdentityAuthenticationAudit"("outcome", "occurredAt" DESC);
