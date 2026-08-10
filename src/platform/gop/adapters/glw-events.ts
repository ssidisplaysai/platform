import type { GenesisApplicationJobRecord, GenesisApplicationJobStatus } from "../contracts";
import type { GenesisEventAppendInput, GenesisEventStore } from "../event-store";
import type { GenesisJobStatus } from "../contracts";

function mapStatus(status: GenesisApplicationJobStatus): GenesisJobStatus {
  return status === "FAILED_QA" ? "FAILED" : status;
}

function stageForStatus(status: GenesisApplicationJobStatus): string {
  switch (status) {
    case "QUEUED":
      return "queued";
    case "STARTING":
      return "worker_start";
    case "RUNNING":
      return "running";
    case "GENERATING_CONTENT":
      return "generate_content";
    case "GENERATING_IMAGE":
      return "generate_image";
    case "UPLOADING_IMAGE":
      return "upload_image";
    case "PUBLISHING":
      return "publishing";
    case "COMPLETE":
      return "completed";
    case "FAILED":
      return "failed";
    case "FAILED_QA":
      return "qa_gate";
    default:
      return "running";
  }
}

function eventTypeForStatus(status: GenesisApplicationJobStatus): string {
  switch (status) {
    case "QUEUED":
      return "QUEUED";
    case "STARTING":
      return "STARTED";
    case "RUNNING":
    case "GENERATING_CONTENT":
    case "GENERATING_IMAGE":
    case "UPLOADING_IMAGE":
    case "PUBLISHING":
      return "STAGE_CHANGED";
    case "COMPLETE":
      return "SUCCEEDED";
    case "FAILED_QA":
    case "FAILED":
      return "FAILED";
    default:
      return "STAGE_CHANGED";
  }
}

export function createGlwEventFromJob(job: GenesisApplicationJobRecord, overrides?: Partial<GenesisEventAppendInput>): GenesisEventAppendInput {
  const eventType = eventTypeForStatus(job.status);

  return {
    jobId: job.id,
    moduleId: "glw.core",
    jobType: job.type,
    type: eventType,
    label: eventType.replaceAll("_", " "),
    stage: stageForStatus(job.status),
    status: mapStatus(job.status),
    message: overrides?.message ?? `GLW job moved to ${job.status}`,
    source: overrides?.source ?? "glw.page-generation",
    occurredAt: job.updatedAt,
    durationMs: job.startedAt && job.completedAt
      ? Math.max(0, new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime())
      : undefined,
    actorId: overrides?.actorId,
    actorName: overrides?.actorName,
    correlationId: overrides?.correlationId ?? job.externalExecutionId ?? undefined,
    causationId: overrides?.causationId,
    idempotencyKey: overrides?.idempotencyKey ?? `${job.id}:${job.status}:${job.updatedAt}`,
    metadata: {
      retryOfJobId: job.retryOfJobId,
      siteId: job.siteId,
      title: job.title,
      workflowExecutionId: job.externalExecutionId,
      ...(overrides?.metadata ?? {}),
    },
  };
}

export async function emitGlwJobLifecycleEvent(
  store: GenesisEventStore | null,
  job: GenesisApplicationJobRecord,
  overrides?: Partial<GenesisEventAppendInput>,
): Promise<void> {
  if (!store) {
    return;
  }

  await store.appendEventIdempotently(createGlwEventFromJob(job, overrides));
}

export async function backfillGlwJobEvents(store: GenesisEventStore | null, job: GenesisApplicationJobRecord): Promise<void> {
  if (!store) {
    return;
  }

  await store.appendEventIdempotently({
    jobId: job.id,
    moduleId: "glw.core",
    jobType: job.type,
    type: "JOB_CREATED",
    label: "Job Created",
    stage: "request_intake",
    status: "QUEUED",
    message: "GLW job record created.",
    source: "glw.page-generation",
    occurredAt: job.createdAt,
    idempotencyKey: `${job.id}:created`,
    metadata: {
      title: job.title,
      siteId: job.siteId,
    },
  });

  await emitGlwJobLifecycleEvent(store, job, {
    idempotencyKey: `${job.id}:status:${job.status}:${job.updatedAt}`,
  });
}
