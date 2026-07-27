import type { GenesisJobEvent, GenesisTimelineEntry, GenesisTimelineState } from "./contracts";

function compareEvents(left: GenesisJobEvent, right: GenesisJobEvent): number {
  return left.occurredAt.localeCompare(right.occurredAt) || left.eventId.localeCompare(right.eventId);
}

function stateForEventType(type: string): GenesisTimelineState {
  const normalized = type.trim().toUpperCase();

  if (normalized.includes("FAILED") || normalized.includes("ERROR")) {
    return "failed";
  }

  if (normalized.includes("CANCEL")) {
    return "cancelled";
  }

  if (normalized.includes("ARCHIVE")) {
    return "archived";
  }

  if (normalized.includes("COMPLETE") || normalized.includes("PASSED") || normalized.includes("PUBLISHED") || normalized.includes("SUCCEEDED")) {
    return "complete";
  }

  if (
    normalized.includes("START")
    || normalized.includes("RUN")
    || normalized.includes("PROCESS")
    || normalized.includes("QUEUE")
    || normalized.includes("VALIDATION")
    || normalized.includes("GENERAT")
    || normalized.includes("UPLOAD")
    || normalized.includes("PUBLISH")
    || normalized.includes("AI ")
  ) {
    return "active";
  }

  return "pending";
}

export function createGenesisTimelineFromEvents(events: GenesisJobEvent[]): GenesisTimelineEntry[] {
  return [...events]
    .sort(compareEvents)
    .map((event, index) => ({
      timelineId: `timeline_${event.eventId}`,
      eventId: event.eventId,
      label: event.label,
      state: stateForEventType(event.type),
      occurredAt: event.occurredAt,
      description: typeof event.metadata?.description === "string" ? event.metadata.description : undefined,
      metadata: event.metadata,
      duration: index === 0 ? "--" : undefined,
    }));
}

export function appendGenesisEvent(events: GenesisJobEvent[], event: GenesisJobEvent): GenesisJobEvent[] {
  return [...events, event].sort(compareEvents);
}
