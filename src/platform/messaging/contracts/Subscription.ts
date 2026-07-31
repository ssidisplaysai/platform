import type { MessageEnvelope } from "./MessageEnvelope";

export type MessageHandler<TPayload = unknown> = (envelope: MessageEnvelope<TPayload>) => Promise<void> | void;

export type SubscriptionDefinition<TPayload = unknown> = {
  id: string;
  topic: string;
  subscriberName: string;
  handler: MessageHandler<TPayload>;
  maxAttempts?: number;
};
