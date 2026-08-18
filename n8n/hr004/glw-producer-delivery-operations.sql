CREATE TABLE "GlwProducerDeliveryEscalation" (
  "escalationId" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idempotencyKey" text NOT NULL REFERENCES "GlwProducerDelivery" ("idempotencyKey") ON DELETE RESTRICT,
  "deduplicationKey" text NOT NULL UNIQUE,
  "escalationType" text NOT NULL,
  "severity" text NOT NULL CHECK ("severity" IN ('INFORMATIONAL','WARNING','ACTION_REQUIRED','CRITICAL')),
  "escalationState" text NOT NULL DEFAULT 'OPEN' CHECK ("escalationState" IN ('OPEN','ACKNOWLEDGED','RESOLVED','CLOSED')),
  "sourceDeliveryState" text NOT NULL,
  "sourceReasonClass" text,
  "firstObservedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "lastObservedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "occurrenceCount" integer NOT NULL DEFAULT 1 CHECK ("occurrenceCount" >= 1),
  "acknowledgedAt" timestamptz,
  "acknowledgedBy" text,
  "assignedTo" text,
  "resolvedAt" timestamptz,
  "resolvedBy" text,
  "resolutionCode" text,
  "version" integer NOT NULL DEFAULT 1 CHECK ("version" >= 1),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (("acknowledgedAt" IS NULL) = ("acknowledgedBy" IS NULL)),
  CHECK (("resolvedAt" IS NULL) = ("resolvedBy" IS NULL))
);

CREATE TABLE "GlwProducerDeliveryRecoveryAuthorization" (
  "recoveryAuthorizationId" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idempotencyKey" text NOT NULL REFERENCES "GlwProducerDelivery" ("idempotencyKey") ON DELETE RESTRICT,
  "cycleNumber" integer NOT NULL CHECK ("cycleNumber" >= 1),
  "requestId" text NOT NULL UNIQUE,
  "approvalRequestId" text UNIQUE,
  "eligibilityClass" text NOT NULL CHECK ("eligibilityClass" IN ('AUTH_FAILURE','DESTINATION_OR_IDENTITY_FAILURE','ATTEMPT_BUDGET_EXHAUSTED','ELAPSED_BUDGET_EXHAUSTED','TRANSIENT_EXHAUSTION')),
  "recoveryState" text NOT NULL DEFAULT 'REQUESTED'
    CHECK ("recoveryState" IN ('REQUESTED','APPROVED','REJECTED','LEASED','IN_FLIGHT','RETRY_SCHEDULED','ACKNOWLEDGED','DEAD_LETTER','CANCELLED')),
  "requestedBy" text NOT NULL,
  "requestedRole" text NOT NULL,
  "requestedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "requestReason" text NOT NULL CHECK (char_length("requestReason") BETWEEN 8 AND 1000),
  "approvedBy" text,
  "approvedRole" text,
  "approvedAt" timestamptz,
  "approvalReason" text,
  "approvalExpiresAt" timestamptz,
  "originalDeadLetteredAt" timestamptz NOT NULL,
  "originalDeadLetterReason" text NOT NULL,
  "requestBodySha256" text NOT NULL CHECK ("requestBodySha256" ~ '^[0-9a-f]{64}$'),
  "attemptCount" integer NOT NULL DEFAULT 0 CHECK ("attemptCount" BETWEEN 0 AND 12),
  "firstAttemptAt" timestamptz,
  "lastAttemptAt" timestamptz,
  "nextAttemptAt" timestamptz,
  "deliveryDeadlineAt" timestamptz,
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
  "version" integer NOT NULL DEFAULT 1 CHECK ("version" >= 1),
  "createdAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "updatedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE ("idempotencyKey", "cycleNumber"),
  CHECK (("recoveryState" IN ('LEASED','IN_FLIGHT')) = ("leaseToken" IS NOT NULL)),
  CHECK ("approvedBy" IS NULL OR "approvedBy" <> "requestedBy"),
  CHECK ("acknowledgedAt" IS NULL OR "recoveryState" = 'ACKNOWLEDGED'),
  CHECK ("deadLetteredAt" IS NULL OR "recoveryState" = 'DEAD_LETTER')
);

CREATE UNIQUE INDEX "GlwProducerDeliveryRecovery_active_idx"
  ON "GlwProducerDeliveryRecoveryAuthorization" ("idempotencyKey")
  WHERE "recoveryState" IN ('REQUESTED','APPROVED','LEASED','IN_FLIGHT','RETRY_SCHEDULED');
CREATE INDEX "GlwProducerDeliveryRecovery_due_idx"
  ON "GlwProducerDeliveryRecoveryAuthorization" ("recoveryState", "nextAttemptAt", "createdAt");

CREATE TABLE "GlwProducerDeliveryRecoveryAttempt" (
  "recoveryAuthorizationId" uuid NOT NULL REFERENCES "GlwProducerDeliveryRecoveryAuthorization" ("recoveryAuthorizationId") ON DELETE RESTRICT,
  "attemptNumber" integer NOT NULL CHECK ("attemptNumber" BETWEEN 1 AND 12),
  "leaseToken" uuid NOT NULL,
  "workerId" text NOT NULL,
  "requestBodySha256" text NOT NULL CHECK ("requestBodySha256" ~ '^[0-9a-f]{64}$'),
  "startedAt" timestamptz NOT NULL,
  "finishedAt" timestamptz,
  "resultClass" text,
  "httpStatus" integer,
  "receiverOutcome" text,
  "errorClass" text,
  "durationMs" integer CHECK ("durationMs" IS NULL OR "durationMs" >= 0),
  PRIMARY KEY ("recoveryAuthorizationId", "attemptNumber")
);

CREATE TABLE "GlwProducerDeliveryWorkerHeartbeat" (
  "workerId" text PRIMARY KEY,
  "instanceId" text NOT NULL,
  "observedAt" timestamptz NOT NULL DEFAULT clock_timestamp(),
  "lastClaimAt" timestamptz,
  "lastAttemptAt" timestamptz,
  "version" integer NOT NULL DEFAULT 1 CHECK ("version" >= 1)
);

CREATE TABLE "GlwProducerDeliveryOperatorAction" (
  "actionId" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "requestId" text NOT NULL UNIQUE,
  "idempotencyKey" text NOT NULL REFERENCES "GlwProducerDelivery" ("idempotencyKey") ON DELETE RESTRICT,
  "escalationId" uuid REFERENCES "GlwProducerDeliveryEscalation" ("escalationId") ON DELETE RESTRICT,
  "recoveryAuthorizationId" uuid REFERENCES "GlwProducerDeliveryRecoveryAuthorization" ("recoveryAuthorizationId") ON DELETE RESTRICT,
  "actorId" text NOT NULL,
  "actorRole" text NOT NULL,
  "actionType" text NOT NULL CHECK ("actionType" IN (
    'ALERT_CREATED','ALERT_ACKNOWLEDGED','ASSIGNED','COMMENTED','RECOVERY_REQUESTED',
    'RECOVERY_APPROVED','RECOVERY_REJECTED','RECOVERY_AUTHORIZATION_CONSUMED',
    'RECOVERY_EXECUTION_STARTED','RECOVERY_EXECUTION_RESULT','DEAD_LETTER_RESOLVED','MANUAL_CLOSURE'
  )),
  "reason" text NOT NULL CHECK (char_length("reason") BETWEEN 1 AND 1000),
  "priorState" text,
  "newState" text,
  "safeMetadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "correlationId" text,
  "occurredAt" timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX "GlwProducerDeliveryOperatorAction_delivery_idx"
  ON "GlwProducerDeliveryOperatorAction" ("idempotencyKey", "occurredAt");

CREATE FUNCTION "glwProtectDeliveryOperatorAction"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'GLW_DELIVERY_OPERATOR_ACTION_APPEND_ONLY';
END
$$;
CREATE TRIGGER "GlwProducerDeliveryOperatorAction_append_only"
  BEFORE UPDATE OR DELETE ON "GlwProducerDeliveryOperatorAction"
  FOR EACH ROW EXECUTE FUNCTION "glwProtectDeliveryOperatorAction"();

CREATE FUNCTION "glwProtectDeliveryRecoveryIdentity"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."recoveryAuthorizationId" IS DISTINCT FROM OLD."recoveryAuthorizationId"
     OR NEW."idempotencyKey" IS DISTINCT FROM OLD."idempotencyKey"
     OR NEW."cycleNumber" IS DISTINCT FROM OLD."cycleNumber"
     OR NEW."requestId" IS DISTINCT FROM OLD."requestId"
     OR NEW."eligibilityClass" IS DISTINCT FROM OLD."eligibilityClass"
     OR NEW."requestedBy" IS DISTINCT FROM OLD."requestedBy"
     OR NEW."requestedAt" IS DISTINCT FROM OLD."requestedAt"
     OR NEW."originalDeadLetteredAt" IS DISTINCT FROM OLD."originalDeadLetteredAt"
     OR NEW."originalDeadLetterReason" IS DISTINCT FROM OLD."originalDeadLetterReason"
     OR NEW."requestBodySha256" IS DISTINCT FROM OLD."requestBodySha256"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'GLW_DELIVERY_RECOVERY_IMMUTABLE_FIELD';
  END IF;
  IF OLD."recoveryState" IN ('ACKNOWLEDGED','DEAD_LETTER','REJECTED','CANCELLED') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'GLW_DELIVERY_RECOVERY_TERMINAL_STATE';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER "GlwProducerDeliveryRecovery_protect"
  BEFORE UPDATE ON "GlwProducerDeliveryRecoveryAuthorization"
  FOR EACH ROW EXECUTE FUNCTION "glwProtectDeliveryRecoveryIdentity"();

CREATE FUNCTION "glwProtectDeliveryRecoveryAttempt"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."recoveryAuthorizationId" IS DISTINCT FROM OLD."recoveryAuthorizationId"
     OR NEW."attemptNumber" IS DISTINCT FROM OLD."attemptNumber"
     OR NEW."leaseToken" IS DISTINCT FROM OLD."leaseToken"
     OR NEW."workerId" IS DISTINCT FROM OLD."workerId"
     OR NEW."requestBodySha256" IS DISTINCT FROM OLD."requestBodySha256"
     OR NEW."startedAt" IS DISTINCT FROM OLD."startedAt" THEN
    RAISE EXCEPTION 'GLW_DELIVERY_RECOVERY_ATTEMPT_IMMUTABLE_FIELD';
  END IF;
  IF OLD."finishedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'GLW_DELIVERY_RECOVERY_ATTEMPT_FINAL';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER "GlwProducerDeliveryRecoveryAttempt_protect"
  BEFORE UPDATE ON "GlwProducerDeliveryRecoveryAttempt"
  FOR EACH ROW EXECUTE FUNCTION "glwProtectDeliveryRecoveryAttempt"();

CREATE FUNCTION "glwDeliveryEscalationDescriptor"(delivery "GlwProducerDelivery")
RETURNS TABLE ("escalationType" text, severity text, "reasonClass" text)
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF delivery."deliveryStatus" = 'DEAD_LETTER' THEN
    RETURN QUERY SELECT
      CASE
        WHEN COALESCE(delivery."deadLetterReason", delivery."lastResponseOutcome", '') ILIKE '%CONFLICT%' THEN 'SEMANTIC_CONFLICT'
        WHEN delivery."deadLetterReason" = 'ATTEMPT_BUDGET_EXHAUSTED' THEN 'ATTEMPT_EXHAUSTION'
        WHEN delivery."deadLetterReason" = 'ELAPSED_BUDGET_EXHAUSTED' THEN 'DELIVERY_WINDOW_EXHAUSTION'
        ELSE 'DEAD_LETTER'
      END,
      CASE WHEN COALESCE(delivery."deadLetterReason", delivery."lastResponseOutcome", '') ILIKE '%CONFLICT%'
        THEN 'CRITICAL' ELSE 'ACTION_REQUIRED' END,
      COALESCE(delivery."deadLetterReason", delivery."lastErrorClass", delivery."lastResponseOutcome", 'DEAD_LETTER');
    RETURN;
  END IF;
  IF delivery."deliveryStatus" = 'PENDING' AND clock_timestamp() - delivery."createdAt" > interval '5 minutes' THEN
    RETURN QUERY SELECT 'PENDING_BACKLOG', 'ACTION_REQUIRED', 'PENDING_OVER_5_MINUTES';
    RETURN;
  END IF;
  IF delivery."deliveryStatus" = 'PENDING' AND clock_timestamp() - delivery."createdAt" > interval '60 seconds' THEN
    RETURN QUERY SELECT 'PENDING_BACKLOG', 'WARNING', 'PENDING_OVER_60_SECONDS';
    RETURN;
  END IF;
  IF delivery."deliveryStatus" = 'RETRY_SCHEDULED' THEN
    RETURN QUERY SELECT 'RETRY_BACKLOG',
      CASE WHEN delivery."attemptCount" >= 6 OR delivery."nextAttemptAt" < clock_timestamp() - interval '5 minutes'
        THEN 'ACTION_REQUIRED' ELSE 'WARNING' END,
      COALESCE(delivery."lastErrorClass", delivery."lastResponseOutcome", 'RETRY_SCHEDULED');
  END IF;
END
$$;

CREATE FUNCTION "refreshGlwProducerDeliveryEscalations"()
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE created_count integer;
BEGIN
  WITH candidates AS (
    SELECT delivery."idempotencyKey", descriptor."escalationType", descriptor.severity, descriptor."reasonClass",
      delivery."idempotencyKey" || ':' || descriptor."escalationType" || ':' ||
        COALESCE(delivery."deadLetteredAt"::text, delivery."createdAt"::text) AS dedup_key
    FROM "GlwProducerDelivery" AS delivery
    CROSS JOIN LATERAL "glwDeliveryEscalationDescriptor"(delivery) AS descriptor
  ), inserted AS (
    INSERT INTO "GlwProducerDeliveryEscalation" (
      "idempotencyKey", "deduplicationKey", "escalationType", "severity",
      "sourceDeliveryState", "sourceReasonClass"
    )
    SELECT candidate."idempotencyKey", candidate.dedup_key, candidate."escalationType", candidate.severity,
      delivery."deliveryStatus", candidate."reasonClass"
    FROM candidates AS candidate
    JOIN "GlwProducerDelivery" AS delivery USING ("idempotencyKey")
    ON CONFLICT ("deduplicationKey") DO NOTHING
    RETURNING *
  ), audited AS (
    INSERT INTO "GlwProducerDeliveryOperatorAction" (
      "requestId", "idempotencyKey", "escalationId", "actorId", "actorRole", "actionType", "reason", "newState"
    )
    SELECT 'escalation-created:' || inserted."escalationId", inserted."idempotencyKey", inserted."escalationId",
      'system:delivery-observer', 'SYSTEM', 'ALERT_CREATED', inserted."sourceReasonClass", inserted."escalationState"
    FROM inserted
    RETURNING 1
  ) SELECT count(*) INTO created_count FROM audited;

  UPDATE "GlwProducerDeliveryEscalation" AS escalation
  SET "lastObservedAt" = clock_timestamp(), "occurrenceCount" = escalation."occurrenceCount" + 1,
      "updatedAt" = clock_timestamp(), "version" = escalation."version" + 1
  FROM "GlwProducerDelivery" AS delivery
  WHERE escalation."idempotencyKey" = delivery."idempotencyKey"
    AND escalation."escalationState" IN ('OPEN','ACKNOWLEDGED')
    AND delivery."deliveryStatus" <> 'ACKNOWLEDGED';

  UPDATE "GlwProducerDeliveryEscalation" AS escalation
  SET "escalationState" = 'RESOLVED', "resolvedAt" = clock_timestamp(), "resolvedBy" = 'system:delivery-observer',
      "resolutionCode" = 'DELIVERY_ACKNOWLEDGED', "updatedAt" = clock_timestamp(), "version" = escalation."version" + 1
  FROM "GlwProducerDelivery" AS delivery
  WHERE escalation."idempotencyKey" = delivery."idempotencyKey"
    AND escalation."escalationState" IN ('OPEN','ACKNOWLEDGED')
    AND delivery."deliveryStatus" = 'ACKNOWLEDGED';
  RETURN created_count;
END
$$;

CREATE FUNCTION "acknowledgeGlwProducerDeliveryEscalation"(
  escalation_id uuid, expected_version integer, actor_id text, actor_role text, request_id text, reason text
) RETURNS "GlwProducerDeliveryEscalation" LANGUAGE plpgsql AS $$
DECLARE updated "GlwProducerDeliveryEscalation"%ROWTYPE;
BEGIN
  IF actor_role NOT IN ('OPERATOR','RECOVERY_APPROVER','ADMINISTRATOR') THEN RAISE EXCEPTION 'GLW_DELIVERY_FORBIDDEN'; END IF;
  IF reason IS NULL OR char_length(btrim(reason)) < 3 THEN RAISE EXCEPTION 'GLW_DELIVERY_REASON_REQUIRED'; END IF;
  UPDATE "GlwProducerDeliveryEscalation" SET "escalationState"='ACKNOWLEDGED', "acknowledgedAt"=clock_timestamp(),
    "acknowledgedBy"=actor_id, "updatedAt"=clock_timestamp(), "version"="version"+1
  WHERE "escalationId"=escalation_id AND "version"=expected_version AND "escalationState"='OPEN'
  RETURNING * INTO updated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GLW_DELIVERY_STALE_OPERATOR_STATE'; END IF;
  INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","escalationId","actorId","actorRole","actionType","reason","priorState","newState")
  VALUES (request_id,updated."idempotencyKey",updated."escalationId",actor_id,actor_role,'ALERT_ACKNOWLEDGED',reason,'OPEN','ACKNOWLEDGED');
  RETURN updated;
END
$$;

CREATE FUNCTION "assignGlwProducerDeliveryEscalation"(
  escalation_id uuid, expected_version integer, actor_id text, actor_role text, request_id text, assignee text, reason text
) RETURNS "GlwProducerDeliveryEscalation" LANGUAGE plpgsql AS $$
DECLARE updated "GlwProducerDeliveryEscalation"%ROWTYPE;
BEGIN
  IF actor_role NOT IN ('OPERATOR','RECOVERY_APPROVER','ADMINISTRATOR') THEN RAISE EXCEPTION 'GLW_DELIVERY_FORBIDDEN'; END IF;
  UPDATE "GlwProducerDeliveryEscalation" SET "assignedTo"=assignee, "updatedAt"=clock_timestamp(), "version"="version"+1
  WHERE "escalationId"=escalation_id AND "version"=expected_version AND "escalationState" IN ('OPEN','ACKNOWLEDGED') RETURNING * INTO updated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GLW_DELIVERY_STALE_OPERATOR_STATE'; END IF;
  INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","escalationId","actorId","actorRole","actionType","reason","safeMetadata")
  VALUES (request_id,updated."idempotencyKey",updated."escalationId",actor_id,actor_role,'ASSIGNED',reason,jsonb_build_object('assignedTo',assignee));
  RETURN updated;
END
$$;

CREATE FUNCTION "commentGlwProducerDelivery"(
  idempotency_key text, escalation_id uuid, actor_id text, actor_role text, request_id text, reason text
) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE action_id uuid;
BEGIN
  IF actor_role NOT IN ('OPERATOR','RECOVERY_APPROVER','ADMINISTRATOR') THEN RAISE EXCEPTION 'GLW_DELIVERY_FORBIDDEN'; END IF;
  IF char_length(btrim(reason)) < 3 THEN RAISE EXCEPTION 'GLW_DELIVERY_REASON_REQUIRED'; END IF;
  INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","escalationId","actorId","actorRole","actionType","reason")
  VALUES (request_id,idempotency_key,escalation_id,actor_id,actor_role,'COMMENTED',reason) RETURNING "actionId" INTO action_id;
  RETURN action_id;
END
$$;

CREATE FUNCTION "closeGlwProducerDeliveryEscalation"(
  escalation_id uuid, expected_version integer, actor_id text, actor_role text, request_id text, reason text
) RETURNS "GlwProducerDeliveryEscalation" LANGUAGE plpgsql AS $$
DECLARE updated "GlwProducerDeliveryEscalation"%ROWTYPE;
BEGIN
  IF actor_role NOT IN ('OPERATOR','RECOVERY_APPROVER','ADMINISTRATOR') THEN RAISE EXCEPTION 'GLW_DELIVERY_FORBIDDEN'; END IF;
  IF char_length(btrim(reason)) < 8 THEN RAISE EXCEPTION 'GLW_DELIVERY_REASON_REQUIRED'; END IF;
  UPDATE "GlwProducerDeliveryEscalation" SET "escalationState"='CLOSED',"resolvedAt"=clock_timestamp(),"resolvedBy"=actor_id,
    "resolutionCode"='MANUAL_CLOSURE',"updatedAt"=clock_timestamp(),"version"="version"+1
  WHERE "escalationId"=escalation_id AND "version"=expected_version AND "escalationState" IN ('OPEN','ACKNOWLEDGED')
  RETURNING * INTO updated;
  IF NOT FOUND THEN RAISE EXCEPTION 'GLW_DELIVERY_STALE_OPERATOR_STATE'; END IF;
  INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","escalationId","actorId","actorRole","actionType","reason","newState")
  VALUES (request_id,updated."idempotencyKey",updated."escalationId",actor_id,actor_role,'MANUAL_CLOSURE',reason,'CLOSED');
  RETURN updated;
END
$$;

CREATE FUNCTION "glwDeliveryRecoveryEligibility"(delivery "GlwProducerDelivery") RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE reason text := COALESCE(delivery."deadLetterReason", delivery."lastErrorClass", delivery."lastResponseOutcome", '');
BEGIN
  IF delivery."deliveryStatus" <> 'DEAD_LETTER' THEN RETURN NULL; END IF;
  IF reason ILIKE '%CONFLICT%' OR reason = 'VALIDATION_FAILURE' THEN RETURN NULL; END IF;
  IF reason = 'AUTH_FAILURE' THEN RETURN 'AUTH_FAILURE'; END IF;
  IF reason = 'DESTINATION_OR_IDENTITY_FAILURE' THEN RETURN 'DESTINATION_OR_IDENTITY_FAILURE'; END IF;
  IF reason = 'ATTEMPT_BUDGET_EXHAUSTED' THEN RETURN 'ATTEMPT_BUDGET_EXHAUSTED'; END IF;
  IF reason = 'ELAPSED_BUDGET_EXHAUSTED' THEN RETURN 'ELAPSED_BUDGET_EXHAUSTED'; END IF;
  IF delivery."lastHttpStatus" IN (408,425,429) OR delivery."lastHttpStatus" BETWEEN 500 AND 599
     OR delivery."lastErrorClass" IN ('NETWORK','DNS','TLS','TIMEOUT','CONNECTION_RESET','CONNECTION_REFUSED','MALFORMED_HTTP_RESPONSE') THEN
    RETURN 'TRANSIENT_EXHAUSTION';
  END IF;
  RETURN NULL;
END
$$;

CREATE FUNCTION "requestGlwProducerDeliveryRecovery"(
  idempotency_key text, actor_id text, actor_role text, request_id text, reason text
) RETURNS "GlwProducerDeliveryRecoveryAuthorization" LANGUAGE plpgsql AS $$
DECLARE delivery "GlwProducerDelivery"%ROWTYPE; existing "GlwProducerDeliveryRecoveryAuthorization"%ROWTYPE;
  eligibility text; cycle_number integer; created "GlwProducerDeliveryRecoveryAuthorization"%ROWTYPE;
BEGIN
  IF actor_role NOT IN ('OPERATOR','RECOVERY_APPROVER','ADMINISTRATOR') THEN RAISE EXCEPTION 'GLW_DELIVERY_FORBIDDEN'; END IF;
  IF reason IS NULL OR char_length(btrim(reason)) < 8 THEN RAISE EXCEPTION 'GLW_DELIVERY_REASON_REQUIRED'; END IF;
  SELECT * INTO existing FROM "GlwProducerDeliveryRecoveryAuthorization" WHERE "requestId"=request_id;
  IF FOUND THEN RETURN existing; END IF;
  SELECT * INTO delivery FROM "GlwProducerDelivery" WHERE "idempotencyKey"=idempotency_key FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GLW_DELIVERY_NOT_FOUND'; END IF;
  eligibility := "glwDeliveryRecoveryEligibility"(delivery);
  IF eligibility IS NULL THEN RAISE EXCEPTION 'GLW_DELIVERY_RECOVERY_NOT_ELIGIBLE'; END IF;
  IF delivery."leaseToken" IS NOT NULL THEN RAISE EXCEPTION 'GLW_DELIVERY_ACTIVE_LEASE'; END IF;
  IF EXISTS (SELECT 1 FROM "GlwProducerDeliveryRecoveryAuthorization" WHERE "idempotencyKey"=idempotency_key AND "recoveryState" IN ('REQUESTED','APPROVED','LEASED','IN_FLIGHT','RETRY_SCHEDULED')) THEN
    RAISE EXCEPTION 'GLW_DELIVERY_RECOVERY_ALREADY_ACTIVE';
  END IF;
  SELECT COALESCE(max("cycleNumber"),0)+1 INTO cycle_number FROM "GlwProducerDeliveryRecoveryAuthorization" WHERE "idempotencyKey"=idempotency_key;
  INSERT INTO "GlwProducerDeliveryRecoveryAuthorization" (
    "idempotencyKey","cycleNumber","requestId","eligibilityClass","requestedBy","requestedRole","requestReason",
    "originalDeadLetteredAt","originalDeadLetterReason","requestBodySha256"
  ) VALUES (
    idempotency_key,cycle_number,request_id,eligibility,actor_id,actor_role,btrim(reason),
    delivery."deadLetteredAt",COALESCE(delivery."deadLetterReason",delivery."lastErrorClass",delivery."lastResponseOutcome"),delivery."requestBodySha256"
  ) RETURNING * INTO created;
  INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","recoveryAuthorizationId","actorId","actorRole","actionType","reason","newState")
  VALUES ('audit:'||request_id,idempotency_key,created."recoveryAuthorizationId",actor_id,actor_role,'RECOVERY_REQUESTED',reason,'REQUESTED');
  RETURN created;
END
$$;

CREATE FUNCTION "approveGlwProducerDeliveryRecovery"(
  recovery_id uuid, expected_version integer, actor_id text, actor_role text, approval_request_id text, reason text
) RETURNS "GlwProducerDeliveryRecoveryAuthorization" LANGUAGE plpgsql AS $$
DECLARE recovery "GlwProducerDeliveryRecoveryAuthorization"%ROWTYPE; delivery "GlwProducerDelivery"%ROWTYPE;
BEGIN
  IF actor_role NOT IN ('RECOVERY_APPROVER','ADMINISTRATOR') THEN RAISE EXCEPTION 'GLW_DELIVERY_APPROVER_REQUIRED'; END IF;
  IF reason IS NULL OR char_length(btrim(reason)) < 8 THEN RAISE EXCEPTION 'GLW_DELIVERY_REASON_REQUIRED'; END IF;
  SELECT * INTO recovery FROM "GlwProducerDeliveryRecoveryAuthorization" WHERE "recoveryAuthorizationId"=recovery_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'GLW_DELIVERY_RECOVERY_NOT_FOUND'; END IF;
  IF recovery."approvalRequestId"=approval_request_id AND recovery."recoveryState"='APPROVED' THEN RETURN recovery; END IF;
  IF recovery."requestedBy"=actor_id THEN RAISE EXCEPTION 'GLW_DELIVERY_SELF_APPROVAL_FORBIDDEN'; END IF;
  IF recovery."recoveryState"<>'REQUESTED' OR recovery."version"<>expected_version THEN RAISE EXCEPTION 'GLW_DELIVERY_STALE_RECOVERY_STATE'; END IF;
  SELECT * INTO delivery FROM "GlwProducerDelivery" WHERE "idempotencyKey"=recovery."idempotencyKey" FOR UPDATE;
  IF delivery."deliveryStatus"<>'DEAD_LETTER' THEN
    UPDATE "GlwProducerDeliveryRecoveryAuthorization" SET "recoveryState"='CANCELLED',"approvalRequestId"=approval_request_id,
      "approvedBy"=actor_id,"approvedRole"=actor_role,"approvedAt"=clock_timestamp(),"approvalReason"=btrim(reason),
      "updatedAt"=clock_timestamp(),"version"="version"+1
    WHERE "recoveryAuthorizationId"=recovery_id RETURNING * INTO recovery;
    INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","recoveryAuthorizationId","actorId","actorRole","actionType","reason","priorState","newState","safeMetadata")
    VALUES ('audit:'||approval_request_id,recovery."idempotencyKey",recovery_id,actor_id,actor_role,'RECOVERY_REJECTED',
      'Recovery cancelled because the original delivery state changed before approval.','REQUESTED','CANCELLED',
      jsonb_build_object('originalDeliveryState',delivery."deliveryStatus"));
    RETURN recovery;
  END IF;
  IF delivery."leaseToken" IS NOT NULL OR "glwDeliveryRecoveryEligibility"(delivery) IS NULL THEN RAISE EXCEPTION 'GLW_DELIVERY_RECOVERY_NOT_ELIGIBLE'; END IF;
  UPDATE "GlwProducerDeliveryRecoveryAuthorization" SET "recoveryState"='APPROVED',"approvalRequestId"=approval_request_id,
    "approvedBy"=actor_id,"approvedRole"=actor_role,"approvedAt"=clock_timestamp(),"approvalReason"=btrim(reason),
    "approvalExpiresAt"=clock_timestamp()+interval '30 minutes',"nextAttemptAt"=clock_timestamp(),
    "deliveryDeadlineAt"=clock_timestamp()+interval '6 hours',"updatedAt"=clock_timestamp(),"version"="version"+1
  WHERE "recoveryAuthorizationId"=recovery_id RETURNING * INTO recovery;
  INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","recoveryAuthorizationId","actorId","actorRole","actionType","reason","priorState","newState")
  VALUES ('audit:'||approval_request_id,recovery."idempotencyKey",recovery_id,actor_id,actor_role,'RECOVERY_APPROVED',reason,'REQUESTED','APPROVED');
  RETURN recovery;
END
$$;

CREATE FUNCTION "rejectGlwProducerDeliveryRecovery"(
  recovery_id uuid, expected_version integer, actor_id text, actor_role text, approval_request_id text, reason text
) RETURNS "GlwProducerDeliveryRecoveryAuthorization" LANGUAGE plpgsql AS $$
DECLARE recovery "GlwProducerDeliveryRecoveryAuthorization"%ROWTYPE;
BEGIN
  IF actor_role NOT IN ('RECOVERY_APPROVER','ADMINISTRATOR') THEN RAISE EXCEPTION 'GLW_DELIVERY_APPROVER_REQUIRED'; END IF;
  UPDATE "GlwProducerDeliveryRecoveryAuthorization" SET "recoveryState"='REJECTED',"approvalRequestId"=approval_request_id,
    "approvedBy"=actor_id,"approvedRole"=actor_role,"approvedAt"=clock_timestamp(),"approvalReason"=btrim(reason),
    "updatedAt"=clock_timestamp(),"version"="version"+1
  WHERE "recoveryAuthorizationId"=recovery_id AND "version"=expected_version AND "recoveryState"='REQUESTED' AND "requestedBy"<>actor_id
  RETURNING * INTO recovery;
  IF NOT FOUND THEN RAISE EXCEPTION 'GLW_DELIVERY_STALE_RECOVERY_STATE'; END IF;
  INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","recoveryAuthorizationId","actorId","actorRole","actionType","reason","priorState","newState")
  VALUES ('audit:'||approval_request_id,recovery."idempotencyKey",recovery_id,actor_id,actor_role,'RECOVERY_REJECTED',reason,'REQUESTED','REJECTED');
  RETURN recovery;
END
$$;

CREATE FUNCTION "heartbeatGlwProducerDeliveryWorker"(worker_id text, instance_id text, claimed boolean DEFAULT false, attempted boolean DEFAULT false)
RETURNS "GlwProducerDeliveryWorkerHeartbeat" LANGUAGE plpgsql AS $$
DECLARE heartbeat "GlwProducerDeliveryWorkerHeartbeat"%ROWTYPE;
BEGIN
  INSERT INTO "GlwProducerDeliveryWorkerHeartbeat" ("workerId","instanceId","observedAt","lastClaimAt","lastAttemptAt")
  VALUES (worker_id,instance_id,clock_timestamp(),CASE WHEN claimed THEN clock_timestamp() END,CASE WHEN attempted THEN clock_timestamp() END)
  ON CONFLICT ("workerId") DO UPDATE SET "instanceId"=EXCLUDED."instanceId","observedAt"=clock_timestamp(),
    "lastClaimAt"=CASE WHEN claimed THEN clock_timestamp() ELSE "GlwProducerDeliveryWorkerHeartbeat"."lastClaimAt" END,
    "lastAttemptAt"=CASE WHEN attempted THEN clock_timestamp() ELSE "GlwProducerDeliveryWorkerHeartbeat"."lastAttemptAt" END,
    "version"="GlwProducerDeliveryWorkerHeartbeat"."version"+1
  RETURNING * INTO heartbeat;
  RETURN heartbeat;
END
$$;

CREATE FUNCTION "prepareGlwProducerDeliveryWork"(worker_id text, instance_id text)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE created_count integer;
BEGIN
  PERFORM "heartbeatGlwProducerDeliveryWorker"(worker_id,instance_id,false,false);
  created_count := "refreshGlwProducerDeliveryEscalations"();
  RETURN created_count;
END
$$;

CREATE FUNCTION "claimGlwProducerDeliveryWork"(worker_id text, batch_size integer DEFAULT 10, lease_seconds integer DEFAULT 60)
RETURNS TABLE (
  "workKind" text,"recoveryAuthorizationId" uuid,"idempotencyKey" text,"leaseToken" uuid,
  "attemptCount" integer,"requestBodyUtf8" text,"requestBodySha256" text,"leaseExpiresAt" timestamptz
) LANGUAGE plpgsql AS $$
DECLARE normal_count integer;
BEGIN
  IF lease_seconds<>60 OR batch_size<1 THEN RAISE EXCEPTION 'GLW_DELIVERY_INVALID_CLAIM'; END IF;
  RETURN QUERY SELECT 'ORIGINAL'::text,NULL::uuid,normal."idempotencyKey",normal."leaseToken",normal."attemptCount",
    normal."requestBodyUtf8",normal."requestBodySha256",normal."leaseExpiresAt"
  FROM "claimGlwProducerDeliveries"(worker_id,batch_size,lease_seconds) AS normal;
  GET DIAGNOSTICS normal_count = ROW_COUNT;
  IF normal_count>=batch_size THEN RETURN; END IF;

  UPDATE "GlwProducerDeliveryRecoveryAttempt" AS attempt SET "finishedAt"=clock_timestamp(),"resultClass"='UNKNOWN_LEASE_EXPIRED',"errorClass"='WORKER_LEASE_EXPIRED'
  FROM "GlwProducerDeliveryRecoveryAuthorization" AS recovery
  WHERE attempt."recoveryAuthorizationId"=recovery."recoveryAuthorizationId" AND attempt."attemptNumber"=recovery."attemptCount"
    AND attempt."finishedAt" IS NULL AND recovery."recoveryState"='IN_FLIGHT' AND recovery."leaseExpiresAt"<=clock_timestamp();

  UPDATE "GlwProducerDeliveryRecoveryAuthorization" SET "recoveryState"='CANCELLED',"updatedAt"=clock_timestamp(),"version"="version"+1
  WHERE "recoveryState"='APPROVED' AND "approvalExpiresAt"<=clock_timestamp();

  RETURN QUERY
  WITH candidates AS (
    SELECT recovery."recoveryAuthorizationId"
    FROM "GlwProducerDeliveryRecoveryAuthorization" AS recovery
    JOIN "GlwProducerDelivery" AS delivery USING ("idempotencyKey")
    WHERE recovery."attemptCount"<12 AND clock_timestamp()<recovery."deliveryDeadlineAt"
      AND delivery."deliveryStatus"='DEAD_LETTER'
      AND (
        (recovery."recoveryState" IN ('APPROVED','RETRY_SCHEDULED') AND recovery."nextAttemptAt"<=clock_timestamp())
        OR (recovery."recoveryState" IN ('LEASED','IN_FLIGHT') AND recovery."leaseExpiresAt"<=clock_timestamp())
      )
    ORDER BY recovery."nextAttemptAt",recovery."createdAt" FOR UPDATE SKIP LOCKED LIMIT (batch_size-normal_count)
  ), claimed AS (
    UPDATE "GlwProducerDeliveryRecoveryAuthorization" AS recovery
    SET "recoveryState"='LEASED',"leaseOwner"=worker_id,"leaseToken"=gen_random_uuid(),"leaseAcquiredAt"=clock_timestamp(),
      "leaseExpiresAt"=clock_timestamp()+interval '60 seconds',"updatedAt"=clock_timestamp(),"version"="version"+1
    FROM candidates WHERE recovery."recoveryAuthorizationId"=candidates."recoveryAuthorizationId" RETURNING recovery.*
  )
  SELECT 'RECOVERY'::text,claimed."recoveryAuthorizationId",claimed."idempotencyKey",claimed."leaseToken",claimed."attemptCount",
    delivery."requestBodyUtf8",delivery."requestBodySha256",claimed."leaseExpiresAt"
  FROM claimed JOIN "GlwProducerDelivery" AS delivery USING ("idempotencyKey");
END
$$;

CREATE FUNCTION "beginGlwProducerDeliveryWork"(work_kind text, idempotency_key text, recovery_id uuid, lease_token uuid)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE recovery "GlwProducerDeliveryRecoveryAuthorization"%ROWTYPE; next_number integer;
BEGIN
  IF work_kind='ORIGINAL' THEN RETURN "beginGlwProducerDeliveryAttempt"(idempotency_key,lease_token); END IF;
  IF work_kind<>'RECOVERY' OR recovery_id IS NULL THEN RAISE EXCEPTION 'GLW_DELIVERY_INVALID_WORK_KIND'; END IF;
  SELECT * INTO recovery FROM "GlwProducerDeliveryRecoveryAuthorization" WHERE "recoveryAuthorizationId"=recovery_id FOR UPDATE;
  IF NOT FOUND OR recovery."idempotencyKey"<>idempotency_key OR recovery."recoveryState"<>'LEASED' OR recovery."leaseToken"<>lease_token OR recovery."leaseExpiresAt"<=clock_timestamp() THEN
    RAISE EXCEPTION 'GLW_DELIVERY_STALE_RECOVERY_LEASE';
  END IF;
  IF recovery."attemptCount">=12 OR clock_timestamp()>=recovery."deliveryDeadlineAt" THEN RAISE EXCEPTION 'GLW_DELIVERY_RECOVERY_BUDGET_EXHAUSTED'; END IF;
  next_number:=recovery."attemptCount"+1;
  UPDATE "GlwProducerDeliveryRecoveryAuthorization" SET "recoveryState"='IN_FLIGHT',"attemptCount"=next_number,
    "firstAttemptAt"=COALESCE("firstAttemptAt",clock_timestamp()),"lastAttemptAt"=clock_timestamp(),"updatedAt"=clock_timestamp(),"version"="version"+1
  WHERE "recoveryAuthorizationId"=recovery_id;
  INSERT INTO "GlwProducerDeliveryRecoveryAttempt" ("recoveryAuthorizationId","attemptNumber","leaseToken","workerId","requestBodySha256","startedAt")
  VALUES (recovery_id,next_number,lease_token,recovery."leaseOwner",recovery."requestBodySha256",clock_timestamp());
  INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","recoveryAuthorizationId","actorId","actorRole","actionType","reason","newState")
  VALUES ('recovery-consumed:'||recovery_id,idempotency_key,recovery_id,'system:'||recovery."leaseOwner",'SYSTEM','RECOVERY_AUTHORIZATION_CONSUMED','Approved recovery authorization consumed.','IN_FLIGHT');
  INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","recoveryAuthorizationId","actorId","actorRole","actionType","reason","newState")
  VALUES ('recovery-start:'||recovery_id||':'||next_number,idempotency_key,recovery_id,'system:'||recovery."leaseOwner",'SYSTEM','RECOVERY_EXECUTION_STARTED','Approved recovery attempt started.','IN_FLIGHT');
  RETURN next_number;
END
$$;

CREATE FUNCTION "completeGlwProducerDeliveryWork"(
  work_kind text,idempotency_key text,recovery_id uuid,lease_token uuid,attempt_number integer,result_class text,
  http_status integer DEFAULT NULL,error_class text DEFAULT NULL,receiver_outcome text DEFAULT NULL,
  receiver_receipt_id text DEFAULT NULL,duration_ms integer DEFAULT NULL,jitter_fraction double precision DEFAULT 0
) RETURNS text LANGUAGE plpgsql AS $$
DECLARE recovery "GlwProducerDeliveryRecoveryAuthorization"%ROWTYPE; base_seconds double precision; next_at timestamptz; final_state text;
BEGIN
  IF work_kind='ORIGINAL' THEN
    RETURN "completeGlwProducerDeliveryAttempt"(idempotency_key,lease_token,attempt_number,result_class,http_status,error_class,receiver_outcome,receiver_receipt_id,duration_ms,jitter_fraction);
  END IF;
  SELECT * INTO recovery FROM "GlwProducerDeliveryRecoveryAuthorization" WHERE "recoveryAuthorizationId"=recovery_id FOR UPDATE;
  IF NOT FOUND OR recovery."idempotencyKey"<>idempotency_key OR recovery."recoveryState"<>'IN_FLIGHT' OR recovery."leaseToken"<>lease_token OR recovery."attemptCount"<>attempt_number THEN
    RAISE EXCEPTION 'GLW_DELIVERY_STALE_RECOVERY_ATTEMPT';
  END IF;
  IF jitter_fraction<0 OR jitter_fraction>0.2 THEN RAISE EXCEPTION 'GLW_DELIVERY_INVALID_JITTER'; END IF;
  UPDATE "GlwProducerDeliveryRecoveryAttempt" SET "finishedAt"=clock_timestamp(),"resultClass"=result_class,"httpStatus"=http_status,
    "receiverOutcome"=receiver_outcome,"errorClass"=error_class,"durationMs"=duration_ms
  WHERE "recoveryAuthorizationId"=recovery_id AND "attemptNumber"=attempt_number AND "finishedAt" IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'GLW_DELIVERY_RECOVERY_ATTEMPT_ALREADY_FINAL'; END IF;
  IF result_class='ACKNOWLEDGED' THEN final_state:='ACKNOWLEDGED';
  ELSIF result_class='RETRYABLE' AND attempt_number<12 THEN
    base_seconds:=least(15*power(2,attempt_number-1),3600);
    next_at:=clock_timestamp()+make_interval(secs=>base_seconds*(1+jitter_fraction));
    final_state:=CASE WHEN next_at<recovery."deliveryDeadlineAt" THEN 'RETRY_SCHEDULED' ELSE 'DEAD_LETTER' END;
  ELSE final_state:='DEAD_LETTER'; END IF;

  UPDATE "GlwProducerDeliveryRecoveryAuthorization" SET "recoveryState"=final_state,"nextAttemptAt"=CASE WHEN final_state='RETRY_SCHEDULED' THEN next_at ELSE "nextAttemptAt" END,
    "lastHttpStatus"=http_status,"lastErrorClass"=error_class,"lastResponseOutcome"=receiver_outcome,"lastResponseAt"=clock_timestamp(),
    "receiverReceiptId"=receiver_receipt_id,"acknowledgedAt"=CASE WHEN final_state='ACKNOWLEDGED' THEN clock_timestamp() ELSE NULL END,
    "deadLetteredAt"=CASE WHEN final_state='DEAD_LETTER' THEN clock_timestamp() ELSE NULL END,
    "deadLetterReason"=CASE WHEN final_state='DEAD_LETTER' THEN CASE WHEN result_class<>'RETRYABLE' THEN COALESCE(error_class,receiver_outcome,'PERMANENT_RESPONSE') WHEN attempt_number>=12 THEN 'RECOVERY_ATTEMPT_BUDGET_EXHAUSTED' ELSE 'RECOVERY_WINDOW_EXHAUSTED' END ELSE NULL END,
    "leaseOwner"=NULL,"leaseToken"=NULL,"leaseAcquiredAt"=NULL,"leaseExpiresAt"=NULL,"updatedAt"=clock_timestamp(),"version"="version"+1
  WHERE "recoveryAuthorizationId"=recovery_id RETURNING * INTO recovery;

  INSERT INTO "GlwProducerDeliveryOperatorAction" ("requestId","idempotencyKey","recoveryAuthorizationId","actorId","actorRole","actionType","reason","priorState","newState","safeMetadata")
  VALUES ('recovery-result:'||recovery_id||':'||attempt_number,idempotency_key,recovery_id,'system:delivery-worker','SYSTEM','RECOVERY_EXECUTION_RESULT',
    COALESCE(error_class,receiver_outcome,result_class),'IN_FLIGHT',final_state,jsonb_build_object('attemptNumber',attempt_number,'httpStatus',http_status,'resultClass',result_class));
  IF final_state='ACKNOWLEDGED' THEN
    UPDATE "GlwProducerDeliveryEscalation" SET "escalationState"='RESOLVED',"resolvedAt"=clock_timestamp(),"resolvedBy"='system:delivery-worker',
      "resolutionCode"='RECOVERY_ACKNOWLEDGED',"updatedAt"=clock_timestamp(),"version"="version"+1
    WHERE "idempotencyKey"=idempotency_key AND "escalationState" IN ('OPEN','ACKNOWLEDGED');
  END IF;
  RETURN final_state;
END
$$;
