CREATE TABLE "GlwProducerWorkerCommand" (
  "commandId" text PRIMARY KEY,
  "commandType" text NOT NULL CHECK ("commandType" IN ('WORKER_CYCLE','BEGIN_ATTEMPT','COMPLETE_ATTEMPT')),
  "workerId" text NOT NULL,
  "requestSha256" text NOT NULL CHECK ("requestSha256" ~ '^[0-9a-f]{64}$'),
  "commandStatus" text NOT NULL DEFAULT 'STARTED' CHECK ("commandStatus" IN ('STARTED','COMPLETED')),
  "safeResult" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "completedAt" timestamptz
);

CREATE TABLE "GlwProducerWorkerCommandItem" (
  "commandId" text NOT NULL REFERENCES "GlwProducerWorkerCommand"("commandId") ON DELETE RESTRICT,
  "itemIndex" integer NOT NULL CHECK ("itemIndex" >= 0 AND "itemIndex" < 10),
  "workKind" text NOT NULL CHECK ("workKind" IN ('ORIGINAL','RECOVERY')),
  "recoveryAuthorizationId" uuid,
  "idempotencyKey" text NOT NULL,
  "leaseToken" uuid NOT NULL,
  "attemptCount" integer NOT NULL CHECK ("attemptCount" >= 0 AND "attemptCount" <= 12),
  "leaseExpiresAt" timestamptz NOT NULL,
  PRIMARY KEY ("commandId", "itemIndex")
);

CREATE FUNCTION "glwProtectProducerWorkerCommand"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'GLW_WORKER_COMMAND_APPEND_ONLY'; END IF;
  IF OLD."commandStatus"<>'STARTED' OR NEW."commandStatus"<>'COMPLETED'
     OR NEW."commandId" IS DISTINCT FROM OLD."commandId"
     OR NEW."commandType" IS DISTINCT FROM OLD."commandType"
     OR NEW."workerId" IS DISTINCT FROM OLD."workerId"
     OR NEW."requestSha256" IS DISTINCT FROM OLD."requestSha256"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
     OR NEW."safeResult" IS NULL OR NEW."completedAt" IS NULL THEN
    RAISE EXCEPTION 'GLW_WORKER_COMMAND_IMMUTABLE';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "GlwProducerWorkerCommand_protect"
  BEFORE UPDATE OR DELETE ON "GlwProducerWorkerCommand"
  FOR EACH ROW EXECUTE FUNCTION "glwProtectProducerWorkerCommand"();

CREATE FUNCTION "glwRejectProducerWorkerCommandItemMutation"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'GLW_WORKER_COMMAND_ITEM_APPEND_ONLY';
END
$$;

CREATE TRIGGER "GlwProducerWorkerCommandItem_append_only"
  BEFORE UPDATE OR DELETE ON "GlwProducerWorkerCommandItem"
  FOR EACH ROW EXECUTE FUNCTION "glwRejectProducerWorkerCommandItemMutation"();