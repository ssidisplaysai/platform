CREATE TABLE "GlwProducerOperation" (
  "operationKey" text PRIMARY KEY,
  "jobId" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "GlwProducerPublication" (
  "publicationKey" text PRIMARY KEY,
  "operationKey" text NOT NULL UNIQUE REFERENCES "GlwProducerOperation" ("operationKey"),
  "wordpressPageId" text,
  "wordpressUrl" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "GlwProducerCompletion" (
  "operationKey" text PRIMARY KEY REFERENCES "GlwProducerOperation" ("operationKey"),
  "publicationKey" text UNIQUE REFERENCES "GlwProducerPublication" ("publicationKey"),
  "idempotencyKey" text NOT NULL UNIQUE,
  "terminalScopeKey" text NOT NULL UNIQUE,
  "jobId" text NOT NULL,
  "externalExecutionId" text NOT NULL,
  "callbackVersion" text NOT NULL CHECK ("callbackVersion" = '2'),
  "callbackType" text NOT NULL CHECK ("callbackType" = 'PAGE_GENERATION_TERMINAL'),
  "terminalStatus" text NOT NULL CHECK ("terminalStatus" IN ('COMPLETE', 'FAILED_QA', 'FAILED')),
  "canonicalPayload" jsonb NOT NULL,
  "payloadSha256" text NOT NULL CHECK ("payloadSha256" ~ '^[0-9a-f]{64}$'),
  "businessWorkStatus" text NOT NULL CHECK ("businessWorkStatus" IN ('COMPLETE', 'FAILED_QA', 'FAILED')),
  "qaContractVersion" integer,
  "qaSummary" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  CHECK ("terminalStatus" = "businessWorkStatus")
);

CREATE TABLE "GlwProducerOutbox" (
  "idempotencyKey" text PRIMARY KEY,
  "terminalScopeKey" text NOT NULL UNIQUE,
  "operationKey" text NOT NULL UNIQUE REFERENCES "GlwProducerCompletion" ("operationKey") DEFERRABLE INITIALLY DEFERRED,
  "publicationKey" text,
  "jobId" text NOT NULL,
  "externalExecutionId" text NOT NULL,
  "callbackVersion" text NOT NULL CHECK ("callbackVersion" = '2'),
  "callbackType" text NOT NULL CHECK ("callbackType" = 'PAGE_GENERATION_TERMINAL'),
  "terminalStatus" text NOT NULL,
  "canonicalPayload" jsonb NOT NULL,
  "payloadSha256" text NOT NULL CHECK ("payloadSha256" ~ '^[0-9a-f]{64}$'),
  "deliveryStatus" text NOT NULL DEFAULT 'PENDING' CHECK ("deliveryStatus" = 'PENDING'),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "GlwProducerOutbox_pending_createdAt_idx"
  ON "GlwProducerOutbox" ("deliveryStatus", "createdAt");

CREATE FUNCTION "glwRejectImmutableProducerWrite"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'GLW_PRODUCER_IMMUTABLE_RECORD';
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'GLW_PRODUCER_IMMUTABLE_RECORD';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "GlwProducerOperation_immutable"
  BEFORE UPDATE OR DELETE ON "GlwProducerOperation"
  FOR EACH ROW EXECUTE FUNCTION "glwRejectImmutableProducerWrite"();
CREATE TRIGGER "GlwProducerPublication_immutable"
  BEFORE UPDATE OR DELETE ON "GlwProducerPublication"
  FOR EACH ROW EXECUTE FUNCTION "glwRejectImmutableProducerWrite"();
CREATE TRIGGER "GlwProducerCompletion_immutable"
  BEFORE UPDATE OR DELETE ON "GlwProducerCompletion"
  FOR EACH ROW EXECUTE FUNCTION "glwRejectImmutableProducerWrite"();
CREATE TRIGGER "GlwProducerOutbox_immutable"
  BEFORE UPDATE OR DELETE ON "GlwProducerOutbox"
  FOR EACH ROW EXECUTE FUNCTION "glwRejectImmutableProducerWrite"();

CREATE FUNCTION "glwRequireCompletionOutboxPair"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME = 'GlwProducerCompletion' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "GlwProducerOutbox"
      WHERE "operationKey" = NEW."operationKey"
        AND "idempotencyKey" = NEW."idempotencyKey"
    ) THEN
      RAISE EXCEPTION 'GLW_PRODUCER_COMPLETION_OUTBOX_REQUIRED';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM "GlwProducerCompletion"
      WHERE "operationKey" = NEW."operationKey"
        AND "idempotencyKey" = NEW."idempotencyKey"
    ) THEN
      RAISE EXCEPTION 'GLW_PRODUCER_OUTBOX_COMPLETION_REQUIRED';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE CONSTRAINT TRIGGER "GlwProducerCompletion_requires_outbox"
  AFTER INSERT ON "GlwProducerCompletion"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "glwRequireCompletionOutboxPair"();
CREATE CONSTRAINT TRIGGER "GlwProducerOutbox_requires_completion"
  AFTER INSERT ON "GlwProducerOutbox"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "glwRequireCompletionOutboxPair"();

CREATE FUNCTION "enqueueGlwProducerCompletion"(
  operation_key text,
  publication_key text,
  job_id text,
  external_execution_id text,
  terminal_status text,
  idempotency_key text,
  terminal_scope_key text,
  canonical_payload jsonb,
  payload_sha256 text,
  wordpress_page_id text DEFAULT NULL,
  wordpress_url text DEFAULT NULL,
  qa_contract_version integer DEFAULT NULL,
  qa_summary jsonb DEFAULT NULL
) RETURNS TABLE (outcome text, "operationKey" text, "idempotencyKey" text)
LANGUAGE plpgsql AS $$
DECLARE
  existing "GlwProducerCompletion"%ROWTYPE;
BEGIN
  IF current_setting('transaction_isolation') <> 'serializable' THEN
    RAISE EXCEPTION 'GLW_PRODUCER_SERIALIZABLE_REQUIRED';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(operation_key, 0));

    SELECT completion.* INTO existing FROM "GlwProducerCompletion" AS completion
    WHERE completion."operationKey" = operation_key
      OR completion."idempotencyKey" = idempotency_key
      OR completion."terminalScopeKey" = terminal_scope_key
    ORDER BY CASE WHEN completion."operationKey" = operation_key THEN 0 ELSE 1 END
  LIMIT 1;

  IF FOUND THEN
    IF existing."operationKey" = operation_key
       AND existing."publicationKey" IS NOT DISTINCT FROM publication_key
       AND existing."idempotencyKey" = idempotency_key
       AND existing."terminalScopeKey" = terminal_scope_key
       AND existing."jobId" = job_id
       AND existing."externalExecutionId" = external_execution_id
       AND existing."terminalStatus" = terminal_status
       AND existing."canonicalPayload" = canonical_payload
       AND existing."payloadSha256" = payload_sha256 THEN
      RETURN QUERY SELECT 'ALREADY_ENQUEUED', existing."operationKey", existing."idempotencyKey";
      RETURN;
    END IF;
    RAISE EXCEPTION 'GLW_PRODUCER_COMPLETION_CONFLICT';
  END IF;

  INSERT INTO "GlwProducerOperation" ("operationKey", "jobId")
  VALUES (operation_key, job_id);
  INSERT INTO "GlwProducerPublication" (
    "publicationKey", "operationKey", "wordpressPageId", "wordpressUrl"
  ) VALUES (
    publication_key, operation_key, wordpress_page_id, wordpress_url
  );
  INSERT INTO "GlwProducerCompletion" (
    "operationKey", "publicationKey", "idempotencyKey", "terminalScopeKey", "jobId",
    "externalExecutionId", "callbackVersion", "callbackType", "terminalStatus",
    "canonicalPayload", "payloadSha256", "businessWorkStatus", "qaContractVersion", "qaSummary"
  ) VALUES (
    operation_key, publication_key, idempotency_key, terminal_scope_key, job_id,
    external_execution_id, '2', 'PAGE_GENERATION_TERMINAL', terminal_status,
    canonical_payload, payload_sha256, terminal_status, qa_contract_version, qa_summary
  );
  INSERT INTO "GlwProducerOutbox" (
    "idempotencyKey", "terminalScopeKey", "operationKey", "publicationKey", "jobId",
    "externalExecutionId", "callbackVersion", "callbackType", "terminalStatus",
    "canonicalPayload", "payloadSha256"
  ) VALUES (
    idempotency_key, terminal_scope_key, operation_key, publication_key, job_id,
    external_execution_id, '2', 'PAGE_GENERATION_TERMINAL', terminal_status,
    canonical_payload, payload_sha256
  );

  RETURN QUERY SELECT 'ENQUEUED', operation_key, idempotency_key;
END
$$;