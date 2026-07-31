import { describe, expect, it } from "@jest/globals";
import type { MessageEnvelope, Transport, TransportMessage } from "@/platform/messaging";
import { MessageBus } from "@/platform/messaging";

function envelope<TPayload = unknown>(overrides?: Partial<MessageEnvelope<TPayload>>): MessageEnvelope<TPayload> {
  return {
    messageId: "msg-1",
    correlationId: "corr-1",
    causationId: "cause-1",
    tenant: "tenant-1",
    workspace: "workspace-1",
    sourceApplication: "glw",
    sourceCapability: "gmp",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    priority: "NORMAL",
    headers: {},
    payload: { ok: true } as TPayload,
    metadata: { orderingKey: "order-1" },
    ...overrides,
  };
}

describe("GMP-1001 messaging platform foundation", () => {
  it("validates required envelope fields", async () => {
    const bus = new MessageBus();

    await expect(bus.publish({
      topic: "topic.invalid",
      envelope: envelope({ messageId: "" }),
    })).rejects.toThrow("invalid_message_envelope");
  });

  it("registers topics and subscriptions and delivers published messages", async () => {
    const bus = new MessageBus();
    const received: MessageEnvelope[] = [];

    bus.registerTopic({ name: "topic.orders.created" });
    bus.subscribe({
      id: "sub-1",
      topic: "topic.orders.created",
      subscriberName: "orders-read-model",
      handler: (incoming) => {
        received.push(incoming);
      },
    });

    await bus.publish({
      topic: "topic.orders.created",
      mode: "PUBLISH_SUBSCRIBE",
      envelope: envelope(),
    });

    expect(received).toHaveLength(1);
    expect(received[0].messageId).toBe("msg-1");
  });

  it("retries transient subscriber failures", async () => {
    const bus = new MessageBus();
    let attempts = 0;

    bus.subscribe({
      id: "sub-retry",
      topic: "topic.retry",
      subscriberName: "retry-worker",
      maxAttempts: 3,
      handler: () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("transient");
        }
      },
    });

    await bus.publish({
      topic: "topic.retry",
      envelope: envelope({ messageId: "msg-retry" }),
      mode: "POINT_TO_POINT",
    });

    expect(attempts).toBe(2);
    expect(bus.getMetrics().retriedCount).toBe(1);
  });

  it("routes failed deliveries to dead letter queue", async () => {
    const bus = new MessageBus();

    bus.subscribe({
      id: "sub-dead",
      topic: "topic.dead",
      subscriberName: "dead-worker",
      maxAttempts: 2,
      handler: () => {
        throw new Error("fatal");
      },
    });

    await bus.publish({
      topic: "topic.dead",
      envelope: envelope({ messageId: "msg-dead" }),
      mode: "FIRE_AND_FORGET",
    });

    const deadLetters = bus.getDeadLetters();
    expect(deadLetters).toHaveLength(1);
    expect(deadLetters[0].reason).toContain("fatal");
    expect(bus.getMetrics().deadLetterCount).toBe(1);
  });

  it("supports request/reply abstraction", async () => {
    const bus = new MessageBus();

    bus.subscribe({
      id: "sub-request",
      topic: "topic.request",
      subscriberName: "request-handler",
      handler: async (incoming) => {
        const replyTopic = incoming.headers.replyTopic;
        if (!replyTopic) {
          throw new Error("missing_reply_topic");
        }

        await bus.reply(replyTopic, envelope({
          messageId: "msg-reply",
          correlationId: incoming.correlationId,
          causationId: incoming.messageId,
          payload: { ok: "reply" },
        }));
      },
    });

    const response = await bus.request<{ action: string }, { ok: string }>({
      topic: "topic.request",
      envelope: envelope({
        messageId: "msg-request",
        payload: { action: "ping" },
      }),
    });

    expect(response.payload.ok).toBe("reply");
    expect(response.correlationId).toBe("corr-1");
    expect(response.causationId).toBe("msg-request");
  });

  it("exposes health, queue, and subscriber statistics", async () => {
    const bus = new MessageBus();

    bus.subscribe({
      id: "sub-health",
      topic: "topic.health",
      subscriberName: "health-worker",
      handler: () => undefined,
    });

    await bus.publish({
      topic: "topic.health",
      envelope: envelope({ messageId: "msg-health" }),
      mode: "BROADCAST",
    });

    expect(bus.healthSnapshot().status).toBeDefined();
    expect(bus.getQueueStats().published).toBeGreaterThanOrEqual(1);
    expect(bus.getSubscriberStats()["topic.health"]).toBe(1);
    expect(bus.capabilityMetadata().capabilityId).toBe("platform.messaging");
  });

  it("supports duplicate detection hooks", async () => {
    const bus = new MessageBus({
      duplicateDetector: () => true,
    });

    let delivered = 0;
    bus.subscribe({
      id: "sub-duplicate",
      topic: "topic.duplicate",
      subscriberName: "dup-worker",
      handler: () => {
        delivered += 1;
      },
    });

    await bus.publish({
      topic: "topic.duplicate",
      envelope: envelope({ messageId: "msg-duplicate" }),
    });

    expect(delivered).toBe(0);
    expect(bus.getMetrics().duplicateSuppressedCount).toBe(1);
  });

  it("honors transport abstraction contracts", async () => {
    class TestTransport implements Transport {
      private subscriber: ((message: TransportMessage) => Promise<void>) | null = null;
      private count = 0;

      async publish<TPayload = unknown>(message: TransportMessage<TPayload>): Promise<void> {
        this.count += 1;
        await this.subscriber?.(message as TransportMessage);
      }

      subscribe(subscriber: (message: TransportMessage) => Promise<void>): () => void {
        this.subscriber = subscriber;
        return () => {
          this.subscriber = null;
        };
      }

      queueStats() {
        return {
          published: this.count,
          delivered: this.count,
          failed: 0,
          deadLettered: 0,
          inFlight: 0,
        };
      }

      health() {
        return {
          status: "HEALTHY" as const,
          detail: "test-transport",
        };
      }
    }

    const bus = new MessageBus({ transport: new TestTransport() });
    let observedCorrelation = "";
    let observedCausation = "";

    bus.subscribe({
      id: "sub-transport",
      topic: "topic.transport",
      subscriberName: "transport-worker",
      handler: (incoming) => {
        observedCorrelation = incoming.correlationId;
        observedCausation = incoming.causationId;
      },
    });

    await bus.publish({
      topic: "topic.transport",
      envelope: envelope({
        correlationId: "corr-transport",
        causationId: "cause-transport",
      }),
    });

    expect(observedCorrelation).toBe("corr-transport");
    expect(observedCausation).toBe("cause-transport");
  });
});
