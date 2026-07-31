import { randomUUID } from "node:crypto";
import type {
  DeliveryMode,
  MessageEnvelope,
  Publisher,
  PublishInput,
  RequestInput,
  Subscriber,
  SubscriptionDefinition,
  TopicDefinition,
  Transport,
} from "../contracts";
import { InMemoryTransport } from "../transports/InMemoryTransport";
import { AuditWriter } from "./AuditWriter";
import { DeadLetterService } from "./DeadLetterService";
import { DeliveryPipeline, type DuplicateDetector } from "./DeliveryPipeline";
import { MessageHealth, type MessageHealthSnapshot } from "./MessageHealth";
import { MessageMetrics } from "./MessageMetrics";
import { MessageRouter } from "./MessageRouter";
import { RetryService } from "./RetryService";
import { SubscriptionRegistry } from "./SubscriptionRegistry";
import { TopicRegistry } from "./TopicRegistry";

export type MessageCapabilityMetadata = {
  capabilityId: "platform.messaging";
  capabilityName: "Genesis Enterprise Messaging Platform";
  version: string;
  transport: string;
  supportedModes: DeliveryMode[];
  supports: {
    retry: boolean;
    deadLetter: boolean;
    requestReply: boolean;
    duplicateDetectionHook: boolean;
  };
};

export class MessageBus implements Publisher, Subscriber {
  private readonly topicRegistry: TopicRegistry;
  private readonly subscriptionRegistry: SubscriptionRegistry;
  private readonly metrics: MessageMetrics;
  private readonly deadLetterService: DeadLetterService;
  private readonly auditWriter: AuditWriter;
  private readonly health: MessageHealth;
  private readonly pipeline: DeliveryPipeline;
  private readonly router: MessageRouter;
  private readonly transport: Transport;
  private readonly unsubscribeTransport: () => void;

  constructor(options?: {
    transport?: Transport;
    duplicateDetector?: DuplicateDetector;
  }) {
    this.topicRegistry = new TopicRegistry();
    this.subscriptionRegistry = new SubscriptionRegistry();
    this.metrics = new MessageMetrics();
    this.deadLetterService = new DeadLetterService();
    this.auditWriter = new AuditWriter();
    this.health = new MessageHealth();
    this.transport = options?.transport ?? new InMemoryTransport();

    this.pipeline = new DeliveryPipeline(
      new RetryService(),
      this.deadLetterService,
      this.metrics,
      this.auditWriter,
      options?.duplicateDetector,
    );
    this.router = new MessageRouter(this.topicRegistry, this.subscriptionRegistry);

    this.unsubscribeTransport = this.transport.subscribe(async (message) => {
      const subscriptions = this.router.route(message.topic, message.envelope);
      await this.pipeline.deliver(message.topic, message.envelope, subscriptions);
    });
  }

  registerTopic(topic: TopicDefinition): void {
    this.topicRegistry.register(topic);
  }

  subscribe<TPayload = unknown>(definition: SubscriptionDefinition<TPayload>): void {
    if (!this.topicRegistry.has(definition.topic)) {
      this.registerTopic({ name: definition.topic });
    }

    this.subscriptionRegistry.register(definition);
  }

  unsubscribe(subscriptionId: string): void {
    this.subscriptionRegistry.unregister(subscriptionId);
  }

  async publish<TPayload = unknown>(input: PublishInput<TPayload>): Promise<void> {
    this.assertEnvelope(input.envelope);
    if (!this.topicRegistry.has(input.topic)) {
      this.registerTopic({ name: input.topic });
    }

    const mode = input.mode ?? "PUBLISH_SUBSCRIBE";
    this.metrics.trackPublished(input.topic, mode);
    await this.transport.publish({
      topic: input.topic,
      envelope: input.envelope,
      mode,
    });
  }

  async request<TPayload = unknown, TReply = unknown>(input: RequestInput<TPayload>): Promise<MessageEnvelope<TReply>> {
    const replyTopic = `messaging.reply.${input.envelope.messageId}`;
    const timeoutMs = input.timeoutMs ?? 2000;

    this.registerTopic({ name: replyTopic, description: "request_reply_ephemeral" });

    return new Promise<MessageEnvelope<TReply>>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.unsubscribe(subscriptionId);
        reject(new Error(`request_timeout:${replyTopic}`));
      }, timeoutMs);

      const subscriptionId = `reply:${randomUUID()}`;
      this.subscribe<TReply>({
        id: subscriptionId,
        topic: replyTopic,
        subscriberName: "request-reply-handler",
        maxAttempts: 1,
        handler: (envelope) => {
          clearTimeout(timeout);
          this.unsubscribe(subscriptionId);
          resolve(envelope as MessageEnvelope<TReply>);
        },
      });

      void this.publish({
        topic: input.topic,
        mode: "REQUEST_REPLY",
        envelope: {
          ...input.envelope,
          headers: {
            ...input.envelope.headers,
            replyTopic,
          },
        },
      }).catch((error) => {
        clearTimeout(timeout);
        this.unsubscribe(subscriptionId);
        reject(error);
      });
    });
  }

  reply<TReply = unknown>(replyTopic: string, envelope: MessageEnvelope<TReply>): Promise<void> {
    return this.publish({ topic: replyTopic, envelope, mode: "REQUEST_REPLY" });
  }

  getMetrics() {
    return this.metrics.snapshot();
  }

  getQueueStats() {
    return this.transport.queueStats();
  }

  getSubscriberStats() {
    return this.subscriptionRegistry.sizeByTopic();
  }

  getDeadLetters() {
    return this.deadLetterService.list();
  }

  getAuditRecords() {
    return this.auditWriter.list();
  }

  healthSnapshot(): MessageHealthSnapshot {
    return this.health.snapshot({
      transport: this.transport.health(),
      queueStats: this.transport.queueStats(),
      metrics: this.metrics,
      topicRegistry: this.topicRegistry,
      subscriptionRegistry: this.subscriptionRegistry,
      deadLetterService: this.deadLetterService,
    });
  }

  capabilityMetadata(): MessageCapabilityMetadata {
    return {
      capabilityId: "platform.messaging",
      capabilityName: "Genesis Enterprise Messaging Platform",
      version: "1.0.0",
      transport: this.transport.constructor.name,
      supportedModes: ["FIRE_AND_FORGET", "REQUEST_REPLY", "PUBLISH_SUBSCRIBE", "BROADCAST", "POINT_TO_POINT"],
      supports: {
        retry: true,
        deadLetter: true,
        requestReply: true,
        duplicateDetectionHook: true,
      },
    };
  }

  shutdown(): void {
    this.unsubscribeTransport();
  }

  private assertEnvelope(envelope: MessageEnvelope): void {
    const requiredFields = [
      envelope.messageId,
      envelope.correlationId,
      envelope.causationId,
      envelope.tenant,
      envelope.workspace,
      envelope.sourceApplication,
      envelope.sourceCapability,
      envelope.timestamp,
      envelope.version,
    ];

    if (requiredFields.some((value) => !value || String(value).trim().length === 0)) {
      throw new Error("invalid_message_envelope");
    }
  }
}

let singleton: MessageBus | null = null;

export function getGenesisMessageBus(): MessageBus {
  if (!singleton) {
    singleton = new MessageBus();
  }

  return singleton;
}
