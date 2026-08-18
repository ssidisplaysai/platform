CREATE TABLE "GlwProducerDeliveryReconciliationRun" (
  "reconciliationRunId" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "runType" text NOT NULL CHECK ("runType" IN ('SCHEDULED','OPERATOR','ROLLOUT_READINESS','CANARY','CLOSURE')),
  "triggeredBy" text NOT NULL,
  "sourceCommit" text NOT NULL,
  "sourceTree" text NOT NULL,
  "sourceBuild" text,
  "producerSnapshotAt" timestamptz NOT NULL,
  "genesisSnapshotAt" timestamptz NOT NULL,
  "snapshotSkewMs" integer NOT NULL CHECK ("snapshotSkewMs" >= 0),
  "startedAt" timestamptz NOT NULL,
  "completedAt" timestamptz NOT NULL,
  "status" text NOT NULL CHECK ("status" IN ('CLEAN','DISCREPANCIES','INDETERMINATE','FAILED')),
  "producerScannedCount" integer NOT NULL DEFAULT 0 CHECK ("producerScannedCount" >= 0),
  "genesisScannedCount" integer NOT NULL DEFAULT 0 CHECK ("genesisScannedCount" >= 0),
  "discrepancyCount" integer NOT NULL DEFAULT 0 CHECK ("discrepancyCount" >= 0),
  "criticalCount" integer NOT NULL DEFAULT 0 CHECK ("criticalCount" >= 0),
  "autoRepairCount" integer NOT NULL DEFAULT 0 CHECK ("autoRepairCount" >= 0),
  "safeMetrics" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "truncated" boolean NOT NULL DEFAULT false,
  "failureClass" text,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ("completedAt" >= "startedAt"),
  CHECK ("snapshotSkewMs" <= 5000 OR "status" IN ('INDETERMINATE','FAILED')),
  CHECK ("status" <> 'CLEAN' OR ("discrepancyCount" = 0 AND NOT "truncated" AND "snapshotSkewMs" <= 5000))
);

CREATE INDEX "GlwProducerDeliveryReconciliationRun_completed_idx"
  ON "GlwProducerDeliveryReconciliationRun" ("completedAt" DESC);
CREATE INDEX "GlwProducerDeliveryReconciliationRun_status_idx"
  ON "GlwProducerDeliveryReconciliationRun" ("status", "completedAt" DESC);

CREATE TABLE "GlwProducerDeliveryReconciliationDiscrepancy" (
  "discrepancyId" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "reconciliationRunId" uuid NOT NULL REFERENCES "GlwProducerDeliveryReconciliationRun" ("reconciliationRunId") ON DELETE RESTRICT,
  "discrepancyKey" text NOT NULL,
  "discrepancyType" text NOT NULL,
  "severity" text NOT NULL CHECK ("severity" IN ('INFORMATIONAL','WARNING','ACTION_REQUIRED','CRITICAL')),
  "idempotencyKey" text,
  "operationKey" text,
  "publicationKey" text,
  "jobId" text,
  "externalExecutionId" text,
  "recoveryAuthorizationId" uuid,
  "safeExpected" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "safeActual" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "repairAuthority" text NOT NULL,
  "autoRepairEligible" boolean NOT NULL DEFAULT false,
  "autoRepairResult" text,
  "detectedAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("reconciliationRunId", "discrepancyKey")
);

CREATE INDEX "GlwProducerDeliveryReconciliationDiscrepancy_type_idx"
  ON "GlwProducerDeliveryReconciliationDiscrepancy" ("discrepancyType", "severity", "detectedAt" DESC);
CREATE INDEX "GlwProducerDeliveryReconciliationDiscrepancy_identity_idx"
  ON "GlwProducerDeliveryReconciliationDiscrepancy" ("idempotencyKey", "detectedAt" DESC);

CREATE FUNCTION "glwProtectDeliveryReconciliationEvidence"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'GLW_DELIVERY_RECONCILIATION_EVIDENCE_IMMUTABLE';
END
$$;

CREATE TRIGGER "GlwProducerDeliveryReconciliationRun_immutable"
  BEFORE UPDATE OR DELETE ON "GlwProducerDeliveryReconciliationRun"
  FOR EACH ROW EXECUTE FUNCTION "glwProtectDeliveryReconciliationEvidence"();
CREATE TRIGGER "GlwProducerDeliveryReconciliationDiscrepancy_immutable"
  BEFORE UPDATE OR DELETE ON "GlwProducerDeliveryReconciliationDiscrepancy"
  FOR EACH ROW EXECUTE FUNCTION "glwProtectDeliveryReconciliationEvidence"();
