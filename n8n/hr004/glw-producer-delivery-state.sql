CREATE TABLE "GlwProducerDelivery" (
  "idempotencyKey" text PRIMARY KEY REFERENCES "GlwProducerOutbox" ("idempotencyKey") ON DELETE RESTRICT,
  "operationKey" text NOT NULL,
  "publicationKey" text,
  "requestBodyUtf8" text NOT NULL,
  "requestBodySha256" text NOT NULL CHECK ("requestBodySha256" ~ '^[0-9a-f]{64}$'),
  "deliveryStatus" text NOT NULL DEFAULT 'PENDING'
    CHECK ("deliveryStatus" IN ('PENDING','LEASED','IN_FLIGHT','RETRY_SCHEDULED','ACKNOWLEDGED','DEAD_LETTER')),
  "attemptCount" integer NOT NULL DEFAULT 0 CHECK ("attemptCount" BETWEEN 0 AND 12),
  "firstAttemptAt" timestamptz,
  "lastAttemptAt" timestamptz,
  "nextAttemptAt" timestamptz NOT NULL,
  "deliveryDeadlineAt" timestamptz NOT NULL,
  "leaseOwner" text,
  "leaseToken" uuid,
  "leaseAcquiredAt" timestamptz,
  "leaseExpiresAt" timestamptz,
  "lastHttpStatus" integer,
  "lastErrorClass" text,
  "lastResponseOutcome" text,
  "lastResponseAt" timestamptz,
  "receiverReceiptId" text,
  "acknowledgedAt" timestamptz,
  "deadLetteredAt" timestamptz,
  "deadLetterReason" text,
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (("deliveryStatus" IN ('LEASED','IN_FLIGHT')) = ("leaseToken" IS NOT NULL)),
  CHECK ("acknowledgedAt" IS NULL OR "deliveryStatus" = 'ACKNOWLEDGED'),
  CHECK ("deadLetteredAt" IS NULL OR "deliveryStatus" = 'DEAD_LETTER')
);

CREATE TABLE "GlwProducerDeliveryAttempt" (
  "idempotencyKey" text NOT NULL REFERENCES "GlwProducerDelivery" ("idempotencyKey") ON DELETE RESTRICT,
  "attemptNumber" integer NOT NULL CHECK ("attemptNumber" BETWEEN 1 AND 12),
  "leaseToken" uuid NOT NULL,
  "workerId" text NOT NULL,
  "requestBodySha256" text NOT NULL,
  "startedAt" timestamptz NOT NULL,
  "finishedAt" timestamptz,
  "resultClass" text,
  "httpStatus" integer,
  "receiverOutcome" text,
  "errorClass" text,
  "durationMs" integer CHECK ("durationMs" IS NULL OR "durationMs" >= 0),
  PRIMARY KEY ("idempotencyKey", "attemptNumber")
);

CREATE INDEX "GlwProducerDelivery_due_idx"
  ON "GlwProducerDelivery" ("deliveryStatus", "nextAttemptAt", "createdAt");
CREATE INDEX "GlwProducerDelivery_lease_expiry_idx"
  ON "GlwProducerDelivery" ("leaseExpiresAt")
  WHERE "deliveryStatus" IN ('LEASED','IN_FLIGHT');

CREATE FUNCTION "glwDeliveryEnvelope"(outbox "GlwProducerOutbox") RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT (
    CASE WHEN outbox."canonicalPayload" ? 'callbackVersion'
      THEN outbox."canonicalPayload"
      ELSE outbox."canonicalPayload" || jsonb_build_object(
        'callbackVersion', outbox."callbackVersion",
        'operationKey', outbox."operationKey",
        'idempotencyKey', outbox."idempotencyKey",
        'terminalScopeKey', outbox."terminalScopeKey",
        'callbackType', outbox."callbackType",
        'payloadSha256', outbox."payloadSha256"
      )
    END
  )::text
$$;

CREATE FUNCTION "glwInitializeDelivery"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE body text;
BEGIN
  body := "glwDeliveryEnvelope"(NEW);
  INSERT INTO "GlwProducerDelivery" (
    "idempotencyKey", "operationKey", "publicationKey", "requestBodyUtf8", "requestBodySha256",
    "deliveryStatus", "nextAttemptAt", "deliveryDeadlineAt", "createdAt", "updatedAt"
  ) VALUES (
    NEW."idempotencyKey", NEW."operationKey", NEW."publicationKey", body,
    encode(sha256(convert_to(body, 'UTF8')), 'hex'),
    'PENDING', NEW."createdAt", NEW."createdAt" + interval '6 hours', NEW."createdAt", clock_timestamp()
  ) ON CONFLICT ("idempotencyKey") DO NOTHING;
  RETURN NEW;
END
$$;

CREATE TRIGGER "GlwProducerOutbox_initialize_delivery"
  AFTER INSERT ON "GlwProducerOutbox"
  FOR EACH ROW EXECUTE FUNCTION "glwInitializeDelivery"();

INSERT INTO "GlwProducerDelivery" (
  "idempotencyKey", "operationKey", "publicationKey", "requestBodyUtf8", "requestBodySha256",
  "deliveryStatus", "nextAttemptAt", "deliveryDeadlineAt", "createdAt", "updatedAt"
)
SELECT outbox."idempotencyKey", outbox."operationKey", outbox."publicationKey",
       "glwDeliveryEnvelope"(outbox),
       encode(sha256(convert_to("glwDeliveryEnvelope"(outbox), 'UTF8')), 'hex'),
       'PENDING', outbox."createdAt", outbox."createdAt" + interval '6 hours', outbox."createdAt", clock_timestamp()
FROM "GlwProducerOutbox" AS outbox
ON CONFLICT ("idempotencyKey") DO NOTHING;

CREATE FUNCTION "glwProtectDelivery"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."operationKey" IS DISTINCT FROM OLD."operationKey"
     OR NEW."publicationKey" IS DISTINCT FROM OLD."publicationKey"
     OR NEW."requestBodyUtf8" IS DISTINCT FROM OLD."requestBodyUtf8"
     OR NEW."requestBodySha256" IS DISTINCT FROM OLD."requestBodySha256"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'GLW_DELIVERY_IMMUTABLE_FIELD';
  END IF;
  IF OLD."deliveryStatus" IN ('ACKNOWLEDGED','DEAD_LETTER') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'GLW_DELIVERY_TERMINAL_STATE';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "GlwProducerDelivery_protect"
  BEFORE UPDATE ON "GlwProducerDelivery"
  FOR EACH ROW EXECUTE FUNCTION "glwProtectDelivery"();

CREATE FUNCTION "claimGlwProducerDeliveries"(
  worker_id text,
  batch_size integer DEFAULT 10,
  lease_seconds integer DEFAULT 60
) RETURNS TABLE (
  "idempotencyKey" text,
  "leaseToken" uuid,
  "attemptCount" integer,
  "requestBodyUtf8" text,
  "requestBodySha256" text,
  "leaseExpiresAt" timestamptz
) LANGUAGE plpgsql AS $$
BEGIN
  IF worker_id IS NULL OR btrim(worker_id) = '' OR batch_size < 1 OR lease_seconds <> 60 THEN
    RAISE EXCEPTION 'GLW_DELIVERY_INVALID_CLAIM';
  END IF;

  UPDATE "GlwProducerDeliveryAttempt" AS attempt
  SET "finishedAt" = clock_timestamp(), "resultClass" = 'UNKNOWN_LEASE_EXPIRED',
      "errorClass" = 'WORKER_LEASE_EXPIRED'
  FROM "GlwProducerDelivery" AS delivery
  WHERE attempt."idempotencyKey" = delivery."idempotencyKey"
    AND attempt."attemptNumber" = delivery."attemptCount"
    AND attempt."finishedAt" IS NULL
    AND delivery."deliveryStatus" = 'IN_FLIGHT'
    AND delivery."leaseExpiresAt" <= clock_timestamp();

    UPDATE "GlwProducerDelivery" AS delivery
  SET "deliveryStatus" = 'DEAD_LETTER', "deadLetteredAt" = clock_timestamp(),
      "deadLetterReason" = CASE WHEN delivery."attemptCount" >= 12 THEN 'ATTEMPT_BUDGET_EXHAUSTED' ELSE 'ELAPSED_BUDGET_EXHAUSTED' END,
      "leaseOwner" = NULL, "leaseToken" = NULL, "leaseAcquiredAt" = NULL, "leaseExpiresAt" = NULL,
      "updatedAt" = clock_timestamp()
  WHERE delivery."deliveryStatus" NOT IN ('ACKNOWLEDGED','DEAD_LETTER')
    AND (delivery."attemptCount" >= 12 OR clock_timestamp() >= delivery."deliveryDeadlineAt")
    AND (delivery."leaseExpiresAt" IS NULL OR delivery."leaseExpiresAt" <= clock_timestamp());

  RETURN QUERY
  WITH candidates AS (
    SELECT delivery."idempotencyKey"
    FROM "GlwProducerDelivery" AS delivery
    WHERE delivery."attemptCount" < 12
      AND clock_timestamp() < delivery."deliveryDeadlineAt"
      AND (
        (delivery."deliveryStatus" IN ('PENDING','RETRY_SCHEDULED') AND delivery."nextAttemptAt" <= clock_timestamp())
        OR (delivery."deliveryStatus" IN ('LEASED','IN_FLIGHT') AND delivery."leaseExpiresAt" <= clock_timestamp())
      )
    ORDER BY delivery."nextAttemptAt", delivery."createdAt"
    FOR UPDATE SKIP LOCKED
    LIMIT batch_size
  ), claimed AS (
    UPDATE "GlwProducerDelivery" AS delivery
    SET "deliveryStatus" = 'LEASED', "leaseOwner" = worker_id, "leaseToken" = gen_random_uuid(),
        "leaseAcquiredAt" = clock_timestamp(), "leaseExpiresAt" = clock_timestamp() + interval '60 seconds',
        "updatedAt" = clock_timestamp()
    FROM candidates
    WHERE delivery."idempotencyKey" = candidates."idempotencyKey"
    RETURNING delivery.*
  )
  SELECT claimed."idempotencyKey", claimed."leaseToken", claimed."attemptCount",
         claimed."requestBodyUtf8", claimed."requestBodySha256", claimed."leaseExpiresAt"
  FROM claimed;
END
$$;

CREATE FUNCTION "renewGlwProducerDeliveryLease"(idempotency_key text, lease_token uuid)
RETURNS timestamptz LANGUAGE plpgsql AS $$
DECLARE expires_at timestamptz;
BEGIN
  UPDATE "GlwProducerDelivery"
  SET "leaseExpiresAt" = clock_timestamp() + interval '60 seconds', "updatedAt" = clock_timestamp()
  WHERE "idempotencyKey" = idempotency_key AND "leaseToken" = lease_token
    AND "deliveryStatus" IN ('LEASED','IN_FLIGHT') AND "leaseExpiresAt" > clock_timestamp()
  RETURNING "leaseExpiresAt" INTO expires_at;
  IF expires_at IS NULL THEN RAISE EXCEPTION 'GLW_DELIVERY_STALE_LEASE'; END IF;
  RETURN expires_at;
END
$$;

CREATE FUNCTION "beginGlwProducerDeliveryAttempt"(idempotency_key text, lease_token uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE delivery "GlwProducerDelivery"%ROWTYPE; next_number integer;
BEGIN
  SELECT * INTO delivery FROM "GlwProducerDelivery"
  WHERE "idempotencyKey" = idempotency_key FOR UPDATE;
  IF NOT FOUND OR delivery."deliveryStatus" <> 'LEASED' OR delivery."leaseToken" <> lease_token
     OR delivery."leaseExpiresAt" <= clock_timestamp() THEN
    RAISE EXCEPTION 'GLW_DELIVERY_STALE_LEASE';
  END IF;
  IF delivery."attemptCount" >= 12 OR clock_timestamp() >= delivery."deliveryDeadlineAt" THEN
    RAISE EXCEPTION 'GLW_DELIVERY_BUDGET_EXHAUSTED';
  END IF;
  next_number := delivery."attemptCount" + 1;
  UPDATE "GlwProducerDelivery"
  SET "deliveryStatus" = 'IN_FLIGHT', "attemptCount" = next_number,
      "firstAttemptAt" = COALESCE("firstAttemptAt", clock_timestamp()), "lastAttemptAt" = clock_timestamp(),
      "updatedAt" = clock_timestamp()
  WHERE "idempotencyKey" = idempotency_key;
  INSERT INTO "GlwProducerDeliveryAttempt" (
    "idempotencyKey", "attemptNumber", "leaseToken", "workerId", "requestBodySha256", "startedAt"
  ) VALUES (
    idempotency_key, next_number, lease_token, delivery."leaseOwner", delivery."requestBodySha256", clock_timestamp()
  );
  RETURN next_number;
END
$$;

CREATE FUNCTION "completeGlwProducerDeliveryAttempt"(
  idempotency_key text,
  lease_token uuid,
  attempt_number integer,
  result_class text,
  http_status integer DEFAULT NULL,
  error_class text DEFAULT NULL,
  receiver_outcome text DEFAULT NULL,
  receiver_receipt_id text DEFAULT NULL,
  duration_ms integer DEFAULT NULL,
  jitter_fraction double precision DEFAULT 0
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE delivery "GlwProducerDelivery"%ROWTYPE; base_seconds double precision; next_at timestamptz; final_state text;
BEGIN
  SELECT * INTO delivery FROM "GlwProducerDelivery"
  WHERE "idempotencyKey" = idempotency_key FOR UPDATE;
  IF NOT FOUND OR delivery."deliveryStatus" <> 'IN_FLIGHT' OR delivery."leaseToken" <> lease_token
     OR delivery."attemptCount" <> attempt_number THEN
    RAISE EXCEPTION 'GLW_DELIVERY_STALE_ATTEMPT';
  END IF;
  IF jitter_fraction < 0 OR jitter_fraction > 0.2 THEN RAISE EXCEPTION 'GLW_DELIVERY_INVALID_JITTER'; END IF;

  UPDATE "GlwProducerDeliveryAttempt"
  SET "finishedAt" = clock_timestamp(), "resultClass" = result_class, "httpStatus" = http_status,
      "receiverOutcome" = receiver_outcome, "errorClass" = error_class, "durationMs" = duration_ms
  WHERE "idempotencyKey" = idempotency_key AND "attemptNumber" = attempt_number AND "finishedAt" IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'GLW_DELIVERY_ATTEMPT_ALREADY_FINAL'; END IF;

  IF result_class = 'ACKNOWLEDGED' THEN
    final_state := 'ACKNOWLEDGED';
    UPDATE "GlwProducerDelivery" SET "deliveryStatus" = final_state, "lastHttpStatus" = http_status,
      "lastErrorClass" = NULL, "lastResponseOutcome" = receiver_outcome, "lastResponseAt" = clock_timestamp(),
      "receiverReceiptId" = receiver_receipt_id, "acknowledgedAt" = clock_timestamp(),
      "leaseOwner" = NULL, "leaseToken" = NULL, "leaseAcquiredAt" = NULL, "leaseExpiresAt" = NULL,
      "updatedAt" = clock_timestamp() WHERE "idempotencyKey" = idempotency_key;
  ELSIF result_class = 'RETRYABLE' AND attempt_number < 12 THEN
    base_seconds := least(15 * power(2, attempt_number - 1), 3600);
    next_at := clock_timestamp() + make_interval(secs => base_seconds * (1 + jitter_fraction));
    IF next_at < delivery."deliveryDeadlineAt" THEN
      final_state := 'RETRY_SCHEDULED';
      UPDATE "GlwProducerDelivery" SET "deliveryStatus" = final_state, "nextAttemptAt" = next_at,
        "lastHttpStatus" = http_status, "lastErrorClass" = error_class,
        "lastResponseOutcome" = receiver_outcome, "lastResponseAt" = clock_timestamp(),
        "leaseOwner" = NULL, "leaseToken" = NULL, "leaseAcquiredAt" = NULL, "leaseExpiresAt" = NULL,
        "updatedAt" = clock_timestamp() WHERE "idempotencyKey" = idempotency_key;
    ELSE
      final_state := 'DEAD_LETTER';
    END IF;
  ELSE
    final_state := 'DEAD_LETTER';
  END IF;

  IF final_state = 'DEAD_LETTER' THEN
    UPDATE "GlwProducerDelivery" SET "deliveryStatus" = final_state, "lastHttpStatus" = http_status,
      "lastErrorClass" = error_class, "lastResponseOutcome" = receiver_outcome, "lastResponseAt" = clock_timestamp(),
      "deadLetteredAt" = clock_timestamp(),
      "deadLetterReason" = CASE
        WHEN result_class <> 'RETRYABLE' THEN COALESCE(error_class, receiver_outcome, 'PERMANENT_RESPONSE')
        WHEN attempt_number >= 12 THEN 'ATTEMPT_BUDGET_EXHAUSTED'
        ELSE 'ELAPSED_BUDGET_EXHAUSTED' END,
      "leaseOwner" = NULL, "leaseToken" = NULL, "leaseAcquiredAt" = NULL, "leaseExpiresAt" = NULL,
      "updatedAt" = clock_timestamp() WHERE "idempotencyKey" = idempotency_key;
  END IF;
  RETURN final_state;
END
$$;