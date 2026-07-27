import type { GlwJobRecord } from "@/lib/glw/jobs";
import { getGlwJobOperatorSnapshot } from "@/lib/glw/jobs";
import type { GenesisJob, GenesisJobEvent } from "../contracts";
import type { GenesisPersistedEvent } from "../event-store";

function buildTimelineEvents(job: GlwJobRecord): GenesisJobEvent[] {
  const snapshot = getGlwJobOperatorSnapshot(job);

  return snapshot.timeline.map((entry, index) => ({
    eventId: `${job.id}_timeline_${entry.key}`,
    jobId: job.id,
    moduleId: "glw.core",
    jobType: job.type,
    type: entry.label.toUpperCase().replaceAll(" ", "_"),
    label: entry.label,
    stage: entry.label.toLowerCase().replaceAll(" ", "_"),
    status: job.status,
    message: entry.label,
    source: "glw.projected-timeline",
    occurredAt: job.updatedAt,
    sequence: index + 1,
    durationMs: undefined,
    correlationId: job.externalExecutionId ?? undefined,
  }));
}

function mapPersistedEvent(event: GenesisPersistedEvent): GenesisJobEvent {
  return {
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
  };
}

export function mapGlwJobToInspectorJob(job: GlwJobRecord, persistedEvents: GenesisPersistedEvent[] = []): GenesisJob {
  const events = persistedEvents.length > 0
    ? persistedEvents.map(mapPersistedEvent)
    : buildTimelineEvents(job);

  return {
    jobId: job.id,
    type: job.type,
    applicationId: "glw",
    moduleId: "glw.core",
    status: job.status,
    priority: "NORMAL",
    input: job.input,
    result: job.result,
    error: job.error,
    events,
    artifacts: [],
    notifications: [],
    context: {
      correlationId: job.externalExecutionId ?? undefined,
      moduleId: "glw.core",
      applicationId: "glw",
    },
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    updatedAt: job.updatedAt,
  };
}
