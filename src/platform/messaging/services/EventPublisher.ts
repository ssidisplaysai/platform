import type { MessageEnvelope, PublishInput, RequestInput } from "../contracts";
import { MessageBus } from "./MessageBus";

export class EventPublisher {
  constructor(private readonly bus: MessageBus) {}

  publish<TPayload = unknown>(input: PublishInput<TPayload>): Promise<void> {
    return this.bus.publish(input);
  }

  request<TPayload = unknown, TReply = unknown>(input: RequestInput<TPayload>): Promise<MessageEnvelope<TReply>> {
    return this.bus.request<TPayload, TReply>(input);
  }

  reply<TReply = unknown>(replyTopic: string, envelope: MessageEnvelope<TReply>): Promise<void> {
    return this.bus.reply(replyTopic, envelope);
  }
}
