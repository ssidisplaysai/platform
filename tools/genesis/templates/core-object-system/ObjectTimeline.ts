export interface ObjectTimeline {
  entries: ObjectTimelineEntry[];
}

export interface ObjectTimelineEntry {
  timelineId: string;
  eventType: string;
  occurredAt: Date;
  description?: string;
  metadata?: Record<string, unknown>;
}
