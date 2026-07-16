export type RuntimeEnvelopeType = "Command" | "Event" | "Query" | "Reply";

export type RuntimeMessagingLogLevel = "Trace" | "Debug" | "Info" | "Warning" | "Error" | "Critical";

export type RuntimePublisherKind =
  | "RuntimeObject"
  | "RuntimeService"
  | "Workflow"
  | "Scheduler"
  | "Agent"
  | "Policy"
  | "System"
  | "EnterpriseApplication";

export type RuntimeSubscriberKind = "RuntimeService" | "Workflow" | "Scheduler" | "Agent" | "Policy" | "System";

export type RuntimeDeliveryStatus = "Delivered" | "Rejected" | "DeadLettered" | "Replayed";

export type RuntimePrimitive = string | number | boolean | null;

export type RuntimeEnvelopePayload = Readonly<Record<string, unknown>>;

export type RuntimeEnvelopeMetadata = Readonly<Record<string, RuntimePrimitive>>;

export interface RuntimeChannelDescriptor {
  channel: string;
  description?: string;
}

export interface RuntimeTopicDescriptor {
  channel: string;
  topic: string;
  description?: string;
}

export interface RuntimePublishIntent {
  channel: string;
  topic: string;
  envelopeType: RuntimeEnvelopeType;
  publisherKind: RuntimePublisherKind;
  publisherId: string;
  payload: RuntimeEnvelopePayload;
  correlationId?: string;
  causationId?: string;
  schemaVersion: string;
  metadata?: RuntimeEnvelopeMetadata;
}

export interface RuntimeObjectPublishIntent {
  channel: string;
  topic: string;
  envelopeType: RuntimeEnvelopeType;
  payload: RuntimeEnvelopePayload;
  correlationId?: string;
  causationId?: string;
  schemaVersion: string;
  metadata?: RuntimeEnvelopeMetadata;
}

export interface RuntimeEnvelopeRecord {
  messageId: string;
  runtimeInstanceId: string;
  runtimeId: string;
  channel: string;
  topic: string;
  envelopeType: RuntimeEnvelopeType;
  publisherKind: RuntimePublisherKind;
  publisherId: string;
  payload: RuntimeEnvelopePayload;
  correlationId: string;
  causationId?: string;
  sequence: number;
  schemaVersion: string;
  metadata: RuntimeEnvelopeMetadata;
}

export interface RuntimeCommandEnvelope extends RuntimeEnvelopeRecord {
  envelopeType: "Command";
}

export interface RuntimeEventEnvelope extends RuntimeEnvelopeRecord {
  envelopeType: "Event";
}

export interface RuntimeQueryEnvelope extends RuntimeEnvelopeRecord {
  envelopeType: "Query";
}

export interface RuntimeReplyEnvelope extends RuntimeEnvelopeRecord {
  envelopeType: "Reply";
}

export type RuntimeEnvelopeSnapshot =
  | RuntimeCommandEnvelope
  | RuntimeEventEnvelope
  | RuntimeQueryEnvelope
  | RuntimeReplyEnvelope;

export interface RuntimeSubscriptionDescriptor {
  subscriptionId: string;
  channel: string;
  topicPattern: string;
  subscriberKind: RuntimeSubscriberKind;
  subscriberId: string;
  acceptedEnvelopeTypes: readonly RuntimeEnvelopeType[];
  version: string;
  deliveryPolicy?: "accept" | "reject";
  metadata?: Readonly<Record<string, RuntimePrimitive>>;
}

export interface RuntimeDeliveryRecord {
  messageId: string;
  subscriptionId: string;
  subscriberKind: RuntimeSubscriberKind;
  subscriberId: string;
  status: RuntimeDeliveryStatus;
  reason?: string;
}

export interface RuntimeMessageRecord {
  envelope: RuntimeEnvelopeSnapshot;
  deliveries: readonly RuntimeDeliveryRecord[];
  deadLettered: boolean;
}

export interface RuntimePublishResult {
  envelope: RuntimeEnvelopeSnapshot;
  deliveries: readonly RuntimeDeliveryRecord[];
  deadLettered: boolean;
}

export interface RuntimeReplayCursor {
  cursorId: string;
  lastSequence: number;
}

export interface RuntimeReplayResult {
  mode: "sequence" | "cursor" | "correlation" | "topic";
  replayed: readonly RuntimePublishResult[];
}

export interface RuntimeMessagingDiagnostic {
  sequence: number;
  runtimeInstanceId: string;
  level: RuntimeMessagingLogLevel;
  code: string;
  message: string;
  messageId?: string;
  subscriptionId?: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface RuntimeMessagingEvidenceEntry {
  sequence: number;
  runtimeInstanceId: string;
  messageId?: string;
  type:
    | "ChannelRegistered"
    | "TopicRegistered"
    | "SubscriptionRegistered"
    | "EnvelopePublished"
    | "EnvelopeRouted"
    | "EnvelopeDelivered"
    | "EnvelopeRejected"
    | "EnvelopeDeadLettered"
    | "ReplayCursorSaved"
    | "ReplayStarted"
    | "EnvelopeReplayed"
    | "SnapshotPersisted"
    | "ObjectDispatchPublished";
  details: Readonly<Record<string, unknown>>;
}

export interface RuntimeMessagingMetrics {
  channelCount: number;
  topicCount: number;
  subscriptionCount: number;
  messageCount: number;
  deadLetterCount: number;
  replayCursorCount: number;
  diagnosticsCount: number;
  evidenceCount: number;
  deliveryCount: number;
}

export interface RuntimeMessagingTelemetrySnapshot {
  counters: Readonly<Record<string, number>>;
  metrics: RuntimeMessagingMetrics;
}

export interface RuntimeRoutingTableEntry {
  channel: string;
  topicPattern: string;
  subscriptionIds: readonly string[];
}

export interface RuntimeMessagingSnapshot {
  runtimeInstanceId: string;
  runtimeId: string;
  messages: readonly RuntimeMessageRecord[];
  deadLetters: readonly RuntimeMessageRecord[];
  channels: readonly RuntimeChannelDescriptor[];
  topics: readonly RuntimeTopicDescriptor[];
  subscriptions: readonly RuntimeSubscriptionDescriptor[];
  routingTable: readonly RuntimeRoutingTableEntry[];
  replayCursors: readonly RuntimeReplayCursor[];
  diagnostics: readonly RuntimeMessagingDiagnostic[];
  evidence: readonly RuntimeMessagingEvidenceEntry[];
  telemetry: RuntimeMessagingTelemetrySnapshot;
}

export interface RuntimeMessagingSnapshotRecord {
  revision: number;
  snapshot: RuntimeMessagingSnapshot;
}

export interface RuntimeObjectDispatchPublishResult {
  dispatchResult: {
    objectId: string;
    capabilityId: string;
    success: boolean;
    permissionGranted: boolean;
    diagnosticsCode?: string;
    stateTransition?: { from: string; to: string };
    output: Readonly<Record<string, unknown>>;
  };
  publishResult?: RuntimePublishResult;
}
