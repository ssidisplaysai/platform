import type { GenesisApplicationJobRecord, GenesisJob, GenesisJobEvent } from "../contracts";
import type { GenesisPersistedEvent } from "../event-store";

const statusTimeline = [
  { status: "QUEUED", label: "Queued" },
  { status: "STARTING", label: "Starting" },
  { status: "RUNNING", label: "Running" },
  { status: "GENERATING_CONTENT", label: "Generating Content" },
  { status: "GENERATING_IMAGE", label: "Generating Image" },
  { status: "UPLOADING_IMAGE", label: "Uploading Image" },
  { status: "PUBLISHING", label: "Publishing" },
  { status: "COMPLETE", label: "Complete" },
  { status: "FAILED", label: "Failed" },
] as const;

function buildTimelineEvents(job: GenesisApplicationJobRecord): GenesisJobEvent[] {
  const activeIndex = statusTimeline.findIndex((entry) => entry.status === job.status);
  const visibleTimeline = activeIndex === -1
    ? statusTimeline.slice(0, 1)
    : statusTimeline.slice(0, activeIndex + 1);

  return visibleTimeline.map((entry, index) => ({
    eventId: `${job.id}_timeline_${entry.status.toLowerCase()}`,
    jobId: job.id,
    moduleId: "glw.core",
    jobType: job.type,
    type: entry.status,
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

export function mapGlwJobToInspectorJob(job: GenesisApplicationJobRecord, persistedEvents: GenesisPersistedEvent[] = []): GenesisJob {
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
