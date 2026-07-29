import { randomUUID } from "node:crypto";
import type { GenesisJobEvent, GenesisJobStatus, GenesisJobType, GenesisTimelineEntry } from "./contracts";
import { createGenesisTimelineFromEvents } from "./event-engine";

export type GenesisPersistedEvent = {
  eventId: string;
  jobId: string;
  moduleId: string;
  jobType: GenesisJobType;
  eventType: string;
  stage: string | null;
  status: GenesisJobStatus | null;
  message: string | null;
  source: string | null;
  occurredAt: string;
  sequence: number;
  durationMs: number | null;
  metadata: Record<string, unknown> | null;
  actorId: string | null;
  actorName: string | null;
  correlationId: string | null;
  causationId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
};

export type GenesisEventAppendInput = Omit<GenesisJobEvent, "sequence" | "eventId"> & {
  eventId?: string;
  sequence?: number;
};

export type GenesisEventStore = {
  appendEvent(input: GenesisEventAppendInput): Promise<GenesisPersistedEvent>;
  appendEventIdempotently(input: GenesisEventAppendInput): Promise<GenesisPersistedEvent>;
  listEventsForJob(jobId: string): Promise<GenesisPersistedEvent[]>;
  listEventsAfterSequence(jobId: string, sequence: number): Promise<GenesisPersistedEvent[]>;
  getLatestEvent(jobId: string): Promise<GenesisPersistedEvent | null>;
  replayTimeline(jobId: string): Promise<GenesisTimelineEntry[]>;
  summarizeProgress(jobId: string): Promise<{ status: GenesisJobStatus | null; progressPercent: number; terminal: boolean }>;
  hasTerminalState(jobId: string): Promise<boolean>;
};

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

export function createInMemoryGenesisEventStore(initialEvents: GenesisPersistedEvent[] = []): GenesisEventStore {
  const events = [...initialEvents].sort((left, right) => left.sequence - right.sequence);

  const listForJob = (jobId: string) => events.filter((event) => event.jobId === jobId).sort((left, right) => left.sequence - right.sequence);

  return {
    async appendEvent(input: GenesisEventAppendInput) {
      validateEventInput(input);
      const current = listForJob(input.jobId);

      const latest = current.length > 0 ? current[current.length - 1] : null;
      if (latest?.status && isTerminalStatus(latest.status) && input.status && !isTerminalStatus(input.status)) {
        throw new Error(`Rejected late non-terminal event for terminal job ${input.jobId}.`);
      }

      if (latest?.correlationId && input.correlationId && latest.correlationId !== input.correlationId) {
        throw new Error(`Correlation mismatch for job ${input.jobId}.`);
      }

      const sequence = input.sequence ?? (current.length > 0 ? current[current.length - 1].sequence + 1 : 1);
      const event: GenesisPersistedEvent = {
        eventId: input.eventId ?? randomUUID(),
        jobId: input.jobId,
        moduleId: input.moduleId,
        jobType: input.jobType,
        eventType: input.type,
        stage: input.stage ?? null,
        status: input.status ?? null,
        message: input.message ?? null,
        source: input.source ?? null,
        occurredAt: input.occurredAt,
        sequence,
        durationMs: input.durationMs ?? null,
        metadata: input.metadata ?? null,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        correlationId: input.correlationId ?? null,
        causationId: input.causationId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdAt: new Date().toISOString(),
      };

      const duplicate = events.find((entry) => entry.eventId === event.eventId);
      if (duplicate) {
        throw new Error(`duplicate key for eventId ${event.eventId}`);
      }

      events.push(event);
      return event;
    },

    async appendEventIdempotently(input: GenesisEventAppendInput) {
      if (input.idempotencyKey) {
        const existing = events.find((entry) => entry.jobId === input.jobId && entry.idempotencyKey === input.idempotencyKey);
        if (existing) {
          return existing;
        }
      }

      if (input.eventId) {
        const existing = events.find((entry) => entry.eventId === input.eventId);
        if (existing) {
          return existing;
        }
      }

      return this.appendEvent(input);
    },

    async listEventsForJob(jobId: string) {
      return listForJob(jobId);
    },

    async listEventsAfterSequence(jobId: string, sequence: number) {
      return listForJob(jobId).filter((event) => event.sequence > sequence);
    },

    async getLatestEvent(jobId: string) {
      const current = listForJob(jobId);
      return current.length > 0 ? current[current.length - 1] : null;
    },

    async replayTimeline(jobId: string) {
      const current = listForJob(jobId);
      return createGenesisTimelineFromEvents(current.map((event) => ({
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

    async summarizeProgress(jobId: string) {
      const latest = await this.getLatestEvent(jobId);
      const status = latest?.status ?? null;
      return {
        status,
        progressPercent: progressForStatus(status),
        terminal: isTerminalStatus(status),
      };
    },

    async hasTerminalState(jobId: string) {
      const latest = await this.getLatestEvent(jobId);
      return isTerminalStatus(latest?.status ?? null);
    },
  };
}
