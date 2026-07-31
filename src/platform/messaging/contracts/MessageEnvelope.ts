export type MessagePriority = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

export type DeliveryMode = "FIRE_AND_FORGET" | "REQUEST_REPLY" | "PUBLISH_SUBSCRIBE" | "BROADCAST" | "POINT_TO_POINT";

export type MessageMetadata = {
  idempotencyKey?: string;
  orderingKey?: string;
  traceId?: string;
  contentType?: string;
  schema?: string;
  retryCount?: number;
  [key: string]: string | number | boolean | null | undefined;
};

export type MessageEnvelope<TPayload = unknown> = {
  messageId: string;
  correlationId: string;
  causationId: string;
  tenant: string;
  workspace: string;
  sourceApplication: string;
  sourceCapability: string;
  timestamp: string;
  version: string;
  priority: MessagePriority;
  headers: Record<string, string>;
  payload: TPayload;
  metadata: MessageMetadata;
};
