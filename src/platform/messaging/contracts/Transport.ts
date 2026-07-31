import type { DeliveryMode, MessageEnvelope } from "./MessageEnvelope";

export type TransportMessage<TPayload = unknown> = {
  topic: string;
  envelope: MessageEnvelope<TPayload>;
  mode: DeliveryMode;
};

export type TransportQueueStats = {
  published: number;
  delivered: number;
  failed: number;
  deadLettered: number;
  inFlight: number;
};

export type TransportHealth = {
  status: "HEALTHY" | "DEGRADED" | "CRITICAL";
  detail: string;
};

export interface Transport {
  publish<TPayload = unknown>(message: TransportMessage<TPayload>): Promise<void>;
  subscribe(subscriber: (message: TransportMessage) => Promise<void>): () => void;
  queueStats(): TransportQueueStats;
  health(): TransportHealth;
}
