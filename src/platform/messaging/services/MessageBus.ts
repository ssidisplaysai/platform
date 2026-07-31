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
import { FilePersistenceCoordinator, type PersistenceCoordinator } from "../persistence";
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
    persistence: boolean;
    restartRecovery: boolean;
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
  private readonly persistence: PersistenceCoordinator;
  private readonly ready: Promise<void>;

  constructor(options?: {
    transport?: Transport;
    duplicateDetector?: DuplicateDetector;
    persistence?: PersistenceCoordinator;
  }) {
    this.topicRegistry = new TopicRegistry();
    this.subscriptionRegistry = new SubscriptionRegistry();
    this.metrics = new MessageMetrics();
    this.deadLetterService = new DeadLetterService();
    this.auditWriter = new AuditWriter();
    this.health = new MessageHealth();
    this.transport = options?.transport ?? new InMemoryTransport();
    this.persistence = options?.persistence ?? new FilePersistenceCoordinator();

    this.pipeline = new DeliveryPipeline(
      new RetryService(),
      this.deadLetterService,
      this.metrics,
      this.auditWriter,
      options?.duplicateDetector,
      {
        onRetry: async (input) => {
          await this.persistence.retryStore.append({
            messageId: input.envelope.messageId,
            topic: input.topic,
            subscriptionId: input.subscription.id,
            subscriberName: input.subscription.subscriberName,
            attempt: input.attempt,
            retriedAt: new Date().toISOString(),
            reason: input.reason,
          });
        },
        onDeadLetter: async (input) => {
          await this.persistence.deadLetterStore.append({
            topic: input.topic,
            subscriptionId: input.subscription.id,
            subscriberName: input.subscription.subscriberName,
            envelope: input.envelope,
            reason: input.reason,
            failedAt: new Date().toISOString(),
          });
          await this.persistence.retryStore.clearByMessage(input.envelope.messageId);
        },
      },
    );

    this.router = new MessageRouter(this.topicRegistry, this.subscriptionRegistry);

    this.unsubscribeTransport = this.transport.subscribe(async (message) => {
      const subscriptions = this.router.route(message.topic, message.envelope);
      if (subscriptions.length === 0) {
        this.metrics.trackMissingSubscriber();
        await this.updateDepthMetrics();
        await this.persistOperationalState();
        return;
      }

      await this.pipeline.deliver(message.topic, message.envelope, subscriptions);
      await this.persistence.messageStore.remove(message.envelope.messageId);
      await this.persistence.retryStore.clearByMessage(message.envelope.messageId);
      await this.updateDepthMetrics();
      await this.persistOperationalState();
    });

    this.ready = this.recover();
  }

  private async recover(): Promise<void> {
    const snapshot = await this.persistence.loadRecoverySnapshot();

    if (snapshot.metrics) {
      this.metrics.hydrate(snapshot.metrics);
    }

    if (snapshot.deadLetters.length > 0) {
      this.deadLetterService.restore(snapshot.deadLetters);
    }

    if (snapshot.auditRecords.length > 0) {
      this.auditWriter.restore(snapshot.auditRecords);
    }

    for (const pending of snapshot.pendingMessages) {
      if (!this.topicRegistry.has(pending.topic)) {
        this.registerTopic({ name: pending.topic });
      }
    }

    await this.updateDepthMetrics();
    await this.persistOperationalState();
  }

  async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  registerTopic(topic: TopicDefinition): void {
    this.topicRegistry.register(topic);
  }

  subscribe<TPayload = unknown>(definition: SubscriptionDefinition<TPayload>): void {
    if (!this.topicRegistry.has(definition.topic)) {
      this.registerTopic({ name: definition.topic });
    }

    this.subscriptionRegistry.register(definition);
    void this.replayPendingForTopic(definition.topic);
  }

  unsubscribe(subscriptionId: string): void {
    this.subscriptionRegistry.unregister(subscriptionId);
  }

  async publish<TPayload = unknown>(input: PublishInput<TPayload>): Promise<void> {
    await this.ready;
    this.assertEnvelope(input.envelope);

    if (!this.topicRegistry.has(input.topic)) {
      this.metrics.trackUnknownTopic();
      this.registerTopic({ name: input.topic });
    }

    const mode = input.mode ?? "PUBLISH_SUBSCRIBE";
    this.metrics.trackPublished(input.topic, mode);

    await this.persistence.messageStore.enqueue({
      topic: input.topic,
      mode,
      enqueuedAt: new Date().toISOString(),
      envelope: input.envelope,
    });
    await this.updateDepthMetrics();

    try {
      await this.transport.publish({
        topic: input.topic,
        envelope: input.envelope,
        mode,
      });
    } catch {
      this.metrics.trackTransportFailure();
      throw new Error("transport_publish_failed");
    } finally {
      await this.updateDepthMetrics();
      await this.persistOperationalState();
    }
  }

  async request<TPayload = unknown, TReply = unknown>(input: RequestInput<TPayload>): Promise<MessageEnvelope<TReply>> {
    await this.ready;
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
    const snapshot = this.metrics.snapshot();
    return {
      ...snapshot,
      duplicateRegistrationCount: this.subscriptionRegistry.getDuplicateRegistrationCount(),
    };
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

  async getOperationalReadiness() {
    await this.updateDepthMetrics();
    const retryDepth = await this.persistence.retryStore.depth();
    const deadLetterDepth = await this.persistence.deadLetterStore.depth();
    const oldestPendingMessageAt = await this.persistence.messageStore.oldestPendingTimestamp();

    return {
      queueDepth: this.metrics.snapshot().queueDepth,
      retryDepth,
      deadLetterDepth,
      oldestPendingMessageAt,
      durability: "FILE_PERSISTED",
      multiNodeReadiness: "TRANSPORT_ABSTRACTION_READY",
    } as const;
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
      version: "1.1.0",
      transport: this.transport.constructor.name,
      supportedModes: ["FIRE_AND_FORGET", "REQUEST_REPLY", "PUBLISH_SUBSCRIBE", "BROADCAST", "POINT_TO_POINT"],
      supports: {
        retry: true,
        deadLetter: true,
        requestReply: true,
        duplicateDetectionHook: true,
        persistence: true,
        restartRecovery: true,
      },
    };
  }

  shutdown(): void {
    void this.persistOperationalState();
    this.unsubscribeTransport();
  }

  private async updateDepthMetrics(): Promise<void> {
    const [pending, retryDepth, oldestPending] = await Promise.all([
      this.persistence.messageStore.listPending(),
      this.persistence.retryStore.depth(),
      this.persistence.messageStore.oldestPendingTimestamp(),
    ]);

    this.metrics.updateDepths({
      queueDepth: pending.length,
      retryDepth,
      oldestPendingMessageAt: oldestPending,
    });
  }

  private async persistOperationalState(): Promise<void> {
    try {
      await this.persistence.metricsStore.save(this.metrics.snapshot());
    } catch {
      this.metrics.trackMetricsPersistenceFailure();
    }

    try {
      await this.persistence.auditStore.saveAll(this.auditWriter.list());
    } catch {
      this.metrics.trackAuditFailure();
    }
  }

  private async replayPendingForTopic(topic: string): Promise<void> {
    const pending = await this.persistence.messageStore.listPending();
    const targeted = pending.filter((entry) => entry.topic === topic);
    for (const entry of targeted) {
      await this.transport.publish({
        topic: entry.topic,
        envelope: entry.envelope,
        mode: entry.mode,
      });
    }
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
