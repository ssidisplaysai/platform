import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type {
  GenesisEventAppendInput,
  GenesisEventStore,
  GenesisPersistedEvent,
} from "../event-store";
import type { GenesisJobStatus, GenesisJobType, GenesisTimelineEntry } from "../contracts";
import { createGenesisTimelineFromEvents } from "../event-engine";

function isTerminalStatus(status: GenesisJobStatus | null): boolean {
  return status === "COMPLETE" || status === "FAILED" || status === "TIMED_OUT" || status === "CANCELLED" || status === "ARCHIVED";
}

function progressForStatus(status: GenesisJobStatus | null): number {
  if (!status) {
    return 0;
  }

  if (isTerminalStatus(status)) {
    return 100;
  }

  const statusOrder: Record<GenesisJobStatus, number> = {
    QUEUED: 1,
    STARTING: 2,
    RUNNING: 3,
    GENERATING_CONTENT: 4,
    GENERATING_IMAGE: 5,
    UPLOADING_IMAGE: 6,
    VALIDATION_STARTED: 7,
    VALIDATION_PASSED: 8,
    PUBLISHING: 9,
    COMPLETE: 10,
    FAILED: 10,
    CANCELLED: 10,
    TIMED_OUT: 10,
    ARCHIVED: 10,
  };

  return Math.round((statusOrder[status] / 10) * 100);
}

function validateEventInput(input: GenesisEventAppendInput): void {
  if (!input.jobId || !input.moduleId || !input.jobType || !input.type || !input.occurredAt) {
    throw new Error("Invalid event input: required event fields are missing.");
  }

  if (input.metadata !== undefined && input.metadata !== null && typeof input.metadata !== "object") {
    throw new Error("Invalid event metadata: metadata must be an object when provided.");
  }
}

function toEvent(row: {
  eventId: string;
  jobId: string;
  moduleId: string;
  jobType: string;
  eventType: string;
  stage: string | null;
  status: string | null;
  message: string | null;
  source: string | null;
  occurredAt: Date;
  sequence: number;
  durationMs: number | null;
  metadata: unknown;
  actorId: string | null;
  actorName: string | null;
  correlationId: string | null;
  causationId: string | null;
  idempotencyKey: string | null;
  createdAt: Date;
}): GenesisPersistedEvent {
  return {
    eventId: row.eventId,
    jobId: row.jobId,
    moduleId: row.moduleId,
    jobType: row.jobType as GenesisJobType,
    eventType: row.eventType,
    stage: row.stage,
    status: row.status as GenesisJobStatus | null,
    message: row.message,
    source: row.source,
    occurredAt: row.occurredAt.toISOString(),
    sequence: row.sequence,
    durationMs: row.durationMs,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    actorId: row.actorId,
    actorName: row.actorName,
    correlationId: row.correlationId,
    causationId: row.causationId,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
  };
}

export function createPrismaGenesisEventStore(prisma: PrismaClient): GenesisEventStore {
  return {
    async appendEvent(input: GenesisEventAppendInput): Promise<GenesisPersistedEvent> {
      validateEventInput(input);
      const eventId = input.eventId ?? randomUUID();

      const inserted = await prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${input.jobId}))
        `;

        const latestRows = await transaction.$queryRaw<Array<{
          sequence: number;
          status: string | null;
          correlationId: string | null;
        }>>`
          SELECT "sequence", "status", "correlationId"
          FROM "GopJobEvent"
          WHERE "jobId" = ${input.jobId}
          ORDER BY "sequence" DESC
          LIMIT 1
        `;

        const latest = latestRows[0] ?? null;

        if (latest?.status && isTerminalStatus(latest.status as GenesisJobStatus) && input.status && !isTerminalStatus(input.status)) {
          throw new Error(`Rejected late non-terminal event for terminal job ${input.jobId}.`);
        }

        if (latest?.correlationId && input.correlationId && latest.correlationId !== input.correlationId) {
          throw new Error(`Correlation mismatch for job ${input.jobId}.`);
        }

        const sequence = input.sequence ?? ((latest?.sequence ?? 0) + 1);

        const rows = await transaction.$queryRaw<Array<{
        eventId: string;
        jobId: string;
        moduleId: string;
        jobType: string;
        eventType: string;
        stage: string | null;
        status: string | null;
        message: string | null;
        source: string | null;
        occurredAt: Date;
        sequence: number;
        durationMs: number | null;
        metadata: unknown;
        actorId: string | null;
        actorName: string | null;
        correlationId: string | null;
        causationId: string | null;
        idempotencyKey: string | null;
        createdAt: Date;
      }>>`
        INSERT INTO "GopJobEvent" (
          "eventId",
          "jobId",
          "moduleId",
          "jobType",
          "eventType",
          "stage",
          "status",
          "message",
          "source",
          "occurredAt",
          "sequence",
          "durationMs",
          "metadata",
          "actorId",
          "actorName",
          "correlationId",
          "causationId",
          "idempotencyKey"
        ) VALUES (
          ${eventId},
          ${input.jobId},
          ${input.moduleId},
          ${input.jobType},
          ${input.type},
          ${input.stage ?? null},
          ${input.status ?? null},
          ${input.message ?? null},
          ${input.source ?? null},
          ${new Date(input.occurredAt)},
          ${sequence},
          ${input.durationMs ?? null},
          CAST(${JSON.stringify(input.metadata ?? null)} AS JSONB),
          ${input.actorId ?? null},
          ${input.actorName ?? null},
          ${input.correlationId ?? null},
          ${input.causationId ?? null},
          ${input.idempotencyKey ?? null}
        )
        RETURNING *
      `;

        return rows;
      });

      return toEvent(inserted[0]);
    },

    async appendEventIdempotently(input: GenesisEventAppendInput): Promise<GenesisPersistedEvent> {
      if (input.idempotencyKey) {
        const existingWithKey = await prisma.$queryRaw<Array<{
          eventId: string;
          jobId: string;
          moduleId: string;
          jobType: string;
          eventType: string;
          stage: string | null;
          status: string | null;
          message: string | null;
          source: string | null;
          occurredAt: Date;
          sequence: number;
          durationMs: number | null;
          metadata: unknown;
          actorId: string | null;
          actorName: string | null;
          correlationId: string | null;
          causationId: string | null;
          idempotencyKey: string | null;
          createdAt: Date;
        }>>`
          SELECT *
          FROM "GopJobEvent"
          WHERE "jobId" = ${input.jobId}
            AND "idempotencyKey" = ${input.idempotencyKey}
          ORDER BY "sequence" DESC
          LIMIT 1
        `;

        if (existingWithKey[0]) {
          return toEvent(existingWithKey[0]);
        }
      }

      try {
        return await this.appendEvent(input);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("duplicate key")) {
          throw error;
        }

        if (input.eventId) {
          const existingById = await prisma.$queryRaw<Array<{
            eventId: string;
            jobId: string;
            moduleId: string;
            jobType: string;
            eventType: string;
            stage: string | null;
            status: string | null;
            message: string | null;
            source: string | null;
            occurredAt: Date;
            sequence: number;
            durationMs: number | null;
            metadata: unknown;
            actorId: string | null;
            actorName: string | null;
            correlationId: string | null;
            causationId: string | null;
            idempotencyKey: string | null;
            createdAt: Date;
          }>>`
            SELECT *
            FROM "GopJobEvent"
            WHERE "eventId" = ${input.eventId}
            LIMIT 1
          `;

          if (existingById[0]) {
            return toEvent(existingById[0]);
          }
        }

        throw error;
      }
    },

    async listEventsForJob(jobId: string): Promise<GenesisPersistedEvent[]> {
      const rows = await prisma.$queryRaw<Array<{
        eventId: string;
        jobId: string;
        moduleId: string;
        jobType: string;
        eventType: string;
        stage: string | null;
        status: string | null;
        message: string | null;
        source: string | null;
        occurredAt: Date;
        sequence: number;
        durationMs: number | null;
        metadata: unknown;
        actorId: string | null;
        actorName: string | null;
        correlationId: string | null;
        causationId: string | null;
        idempotencyKey: string | null;
        createdAt: Date;
      }>>`
        SELECT *
        FROM "GopJobEvent"
        WHERE "jobId" = ${jobId}
        ORDER BY "sequence" ASC
      `;

      return rows.map(toEvent);
    },

    async listEventsAfterSequence(jobId: string, sequence: number): Promise<GenesisPersistedEvent[]> {
      const rows = await prisma.$queryRaw<Array<{
        eventId: string;
        jobId: string;
        moduleId: string;
        jobType: string;
        eventType: string;
        stage: string | null;
        status: string | null;
        message: string | null;
        source: string | null;
        occurredAt: Date;
        sequence: number;
        durationMs: number | null;
        metadata: unknown;
        actorId: string | null;
        actorName: string | null;
        correlationId: string | null;
        causationId: string | null;
        idempotencyKey: string | null;
        createdAt: Date;
      }>>`
        SELECT *
        FROM "GopJobEvent"
        WHERE "jobId" = ${jobId}
          AND "sequence" > ${sequence}
        ORDER BY "sequence" ASC
      `;

      return rows.map(toEvent);
    },

    async getLatestEvent(jobId: string): Promise<GenesisPersistedEvent | null> {
      const rows = await prisma.$queryRaw<Array<{
        eventId: string;
        jobId: string;
        moduleId: string;
        jobType: string;
        eventType: string;
        stage: string | null;
        status: string | null;
        message: string | null;
        source: string | null;
        occurredAt: Date;
        sequence: number;
        durationMs: number | null;
        metadata: unknown;
        actorId: string | null;
        actorName: string | null;
        correlationId: string | null;
        causationId: string | null;
        idempotencyKey: string | null;
        createdAt: Date;
      }>>`
        SELECT *
        FROM "GopJobEvent"
        WHERE "jobId" = ${jobId}
        ORDER BY "sequence" DESC
        LIMIT 1
      `;

      return rows[0] ? toEvent(rows[0]) : null;
    },

    async replayTimeline(jobId: string): Promise<GenesisTimelineEntry[]> {
      const events = await this.listEventsForJob(jobId);
      return createGenesisTimelineFromEvents(events.map((event) => ({
        eventId: event.eventId,
        jobId: event.jobId,
        moduleId: event.moduleId,
        jobType: event.jobType,
        type: event.eventType,
        label: event.eventType.replaceAll("_", " "),
        stage: event.stage ?? undefined,
        status: event.status ?? undefined,
        message: event.message ?? undefined,
        source: event.source ?? undefined,
        occurredAt: event.occurredAt,
        sequence: event.sequence,
        durationMs: event.durationMs ?? undefined,
        actorId: event.actorId ?? undefined,
        actorName: event.actorName ?? undefined,
        correlationId: event.correlationId ?? undefined,
        causationId: event.causationId ?? undefined,
        idempotencyKey: event.idempotencyKey ?? undefined,
        metadata: event.metadata ?? undefined,
      })));
    },

    async summarizeProgress(jobId: string): Promise<{ status: GenesisJobStatus | null; progressPercent: number; terminal: boolean }> {
      const latest = await this.getLatestEvent(jobId);
      const status = latest?.status ?? null;

      return {
        status,
        progressPercent: progressForStatus(status),
        terminal: isTerminalStatus(status),
      };
    },

    async hasTerminalState(jobId: string): Promise<boolean> {
      const latest = await this.getLatestEvent(jobId);
      return isTerminalStatus(latest?.status ?? null);
    },
  };
}
