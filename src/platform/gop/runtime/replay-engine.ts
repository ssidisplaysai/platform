import type { GenesisExecution, GenesisExecutionSnapshot, GenesisExecutionStatus } from "../contracts";
import type { GenesisPersistedEvent } from "../event-store";

function mapEventStatusToExecutionStatus(status: string | null): GenesisExecutionStatus {
  switch (status) {
    case "QUEUED":
      return "QUEUED";
    case "STARTING":
      return "DISPATCHED";
    case "RUNNING":
    case "GENERATING_CONTENT":
    case "GENERATING_IMAGE":
    case "UPLOADING_IMAGE":
    case "VALIDATION_STARTED":
    case "VALIDATION_PASSED":
    case "PUBLISHING":
      return "RUNNING";
    case "COMPLETE":
      return "SUCCEEDED";
    case "FAILED":
      return "FAILED";
    case "CANCELLED":
      return "CANCELLED";
    case "TIMED_OUT":
      return "TIMED_OUT";
    case "ARCHIVED":
      return "ARCHIVED";
    default:
      return "RUNNING";
  }
}

export function replayExecutionFromSnapshotAndEvents(input: {
  baseExecution: GenesisExecution;
  snapshot?: GenesisExecutionSnapshot | null;
  events: GenesisPersistedEvent[];
  untilSequence?: number;
}): GenesisExecution {
  const start = input.snapshot?.state ?? input.baseExecution;
  const events = input.untilSequence === undefined
    ? input.events
    : input.events.filter((event) => event.sequence <= input.untilSequence);

  const sorted = [...events].sort((left, right) => left.sequence - right.sequence);

  return sorted.reduce<GenesisExecution>((current, event) => {
    const status = mapEventStatusToExecutionStatus(event.status);
    const updated: GenesisExecution = {
      ...current,
      status,
      currentState: event.stage ?? current.currentState,
      currentNodeId: event.stage ? `n_${event.stage}` : current.currentNodeId,
      output: status === "SUCCEEDED" ? (current.output ?? {}) : current.output,
      correlationId: event.correlationId ?? current.correlationId,
      causationId: event.causationId ?? current.causationId,
      timing: {
        ...current.timing,
        startedAt: current.timing.startedAt ?? event.occurredAt,
        completedAt:
          status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED" || status === "TIMED_OUT"
            ? (current.timing.completedAt ?? event.occurredAt)
            : current.timing.completedAt,
      },
      metrics: {
        ...current.metrics,
        nodeCompleted: Math.max(current.metrics.nodeCompleted, sorted.findIndex((entry) => entry.eventId === event.eventId) + 1),
      },
      metadata: {
        ...(current.metadata ?? {}),
        replayedFromEventSequence: event.sequence,
      },
    };

    return updated;
  }, start);
}
