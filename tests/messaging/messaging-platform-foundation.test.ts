import { describe, expect, it } from "@jest/globals";
import type {
  AuditStore,
  DeliveryMode,
  DeadLetterStore,
  MessageEnvelope,
  MessageStore,
  MetricsStore,
  PersistenceCoordinator,
  RetryStore,
  Transport,
  TransportMessage,
} from "@/platform/messaging";
import { MessageBus } from "@/platform/messaging";

type MemoryPersistenceFlags = {
  failMetricsSave?: boolean;
  failAuditSave?: boolean;
};

type MemoryPersistenceState = {
  pending: Array<{ topic: string; mode: DeliveryMode; enqueuedAt: string; envelope: MessageEnvelope }>;
  retries: Array<{ messageId: string; topic: string; subscriptionId: string; subscriberName: string; attempt: number; retriedAt: string; reason: string }>;
  deadLetters: Array<{ topic: string; subscriptionId: string; subscriberName: string; envelope: MessageEnvelope; reason: string; failedAt: string }>;
  audit: Array<{ messageId: string; topic: string; subscriberName: string; status: "DELIVERED" | "DEAD_LETTERED"; correlationId: string; causationId: string; occurredAt: string }>;
  metrics: any | null;
};

function createMemoryPersistence(flags?: MemoryPersistenceFlags): { coordinator: PersistenceCoordinator; state: MemoryPersistenceState } {
  const state: MemoryPersistenceState = {
    pending: [],
    retries: [],
    deadLetters: [],
    audit: [],
    metrics: null,
  };

  const messageStore: MessageStore = {
    enqueue: async (record) => {
      state.pending = state.pending.filter((item) => item.envelope.messageId !== record.envelope.messageId);
      state.pending.push(record as MemoryPersistenceState["pending"][number]);
    },
    remove: async (messageId) => {
      state.pending = state.pending.filter((item) => item.envelope.messageId !== messageId);
    },
    listPending: async () => state.pending.map((item) => ({ ...item, envelope: { ...item.envelope, headers: { ...item.envelope.headers }, metadata: { ...item.envelope.metadata } } })),
    oldestPendingTimestamp: async () => {
      if (state.pending.length === 0) {
        return null;
      }

      return [...state.pending].sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt))[0].enqueuedAt;
    },
  };

  const retryStore: RetryStore = {
    append: async (record) => {
      state.retries.push({ ...record });
    },
    clearByMessage: async (messageId) => {
      state.retries = state.retries.filter((item) => item.messageId !== messageId);
    },
    list: async () => state.retries.map((item) => ({ ...item })),
    depth: async () => state.retries.length,
  };

  const deadLetterStore: DeadLetterStore = {
    append: async (entry) => {
      state.deadLetters.push({ ...entry, envelope: { ...entry.envelope, headers: { ...entry.envelope.headers }, metadata: { ...entry.envelope.metadata } } });
    },
    list: async () => state.deadLetters.map((entry) => ({ ...entry, envelope: { ...entry.envelope, headers: { ...entry.envelope.headers }, metadata: { ...entry.envelope.metadata } } })),
    depth: async () => state.deadLetters.length,
  };

  const auditStore: AuditStore = {
    saveAll: async (records) => {
      if (flags?.failAuditSave) {
        throw new Error("audit_store_failure");
      }

      state.audit = records.map((record) => ({ ...record }));
    },
    list: async () => state.audit.map((record) => ({ ...record })),
  };

  const metricsStore: MetricsStore = {
    save: async (snapshot) => {
      if (flags?.failMetricsSave) {
        throw new Error("metrics_store_failure");
      }

      state.metrics = { ...snapshot };
    },
    load: async () => (state.metrics ? { ...state.metrics } : null),
  };

  const coordinator: PersistenceCoordinator = {
    messageStore,
    retryStore,
    deadLetterStore,
    auditStore,
    metricsStore,
    loadRecoverySnapshot: async () => ({
      pendingMessages: await messageStore.listPending(),
      retryRecords: await retryStore.list(),
      deadLetters: await deadLetterStore.list(),
      auditRecords: await auditStore.list(),
      metrics: await metricsStore.load(),
    }),
  };

  return { coordinator, state };
}

function envelope<TPayload = unknown>(overrides?: Partial<MessageEnvelope<TPayload>>): MessageEnvelope<TPayload> {
  return {
    messageId: `msg-${Math.random().toString(36).slice(2, 8)}`,
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
    metadata: { orderingKey: "order-1", idempotencyKey: "idem-1" },
    ...overrides,
  };
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("GMP-1001B messaging platform hardening", () => {
  it("validates required envelope fields", async () => {
    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    await expect(bus.publish({ topic: "topic.invalid", envelope: envelope({ messageId: "" }) })).rejects.toThrow("invalid_message_envelope");
  });

  it("tracks unknown topics and missing subscribers safely", async () => {
    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    await bus.publish({ topic: "topic.unknown", envelope: envelope() });

    const metrics = bus.getMetrics();
    expect(metrics.unknownTopicCount).toBe(1);
    expect(metrics.missingSubscriberCount).toBe(1);
    expect(metrics.queueDepth).toBe(1);
  });

  it("records duplicate registration attempts", async () => {
    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    const handler = () => undefined;
    bus.subscribe({ id: "sub-duplicate", topic: "topic.orders", subscriberName: "orders", handler });
    bus.subscribe({ id: "sub-duplicate", topic: "topic.orders", subscriberName: "orders", handler });

    expect(bus.getMetrics().duplicateRegistrationCount).toBe(1);
  });

  it("handles request timeout deterministically", async () => {
    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    await expect(
      bus.request({
        topic: "topic.request.timeout",
        timeoutMs: 30,
        envelope: envelope({ payload: { action: "ping" } }),
      }),
    ).rejects.toThrow("request_timeout");
  });

  it("routes retry exhaustion to durable dead-letter", async () => {
    const { coordinator, state } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    bus.subscribe({
      id: "sub-fail",
      topic: "topic.deadletter",
      subscriberName: "worker",
      maxAttempts: 2,
      handler: () => {
        throw new Error("fatal");
      },
    });

    await bus.publish({ topic: "topic.deadletter", envelope: envelope({ messageId: "msg-dead" }) });

    expect(bus.getDeadLetters()).toHaveLength(1);
    expect(state.deadLetters).toHaveLength(1);
    expect(state.retries.length).toBe(0);
  });

  it("captures non-Error exceptions into dead-letter reason", async () => {
    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    bus.subscribe({
      id: "sub-non-error",
      topic: "topic.non-error",
      subscriberName: "worker",
      maxAttempts: 1,
      handler: () => {
        throw "boom";
      },
    });

    await bus.publish({ topic: "topic.non-error", envelope: envelope({ messageId: "msg-non-error" }) });

    const deadLetter = bus.getDeadLetters()[0];
    expect(deadLetter.reason).toBe("delivery_failed");
  });

  it("tracks transport failures", async () => {
    class FailingTransport implements Transport {
      async publish(): Promise<void> {
        throw new Error("transport_failed");
      }

      subscribe(): () => void {
        return () => undefined;
      }

      queueStats() {
        return { published: 0, delivered: 0, failed: 1, deadLettered: 0, inFlight: 0 };
      }

      health() {
        return { status: "DEGRADED" as const, detail: "failing" };
      }
    }

    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator, transport: new FailingTransport() });
    await bus.waitUntilReady();

    await expect(bus.publish({ topic: "topic.transport.failure", envelope: envelope() })).rejects.toThrow("transport_publish_failed");
    expect(bus.getMetrics().transportFailureCount).toBe(1);
  });

  it("tracks audit persistence failures", async () => {
    const { coordinator } = createMemoryPersistence({ failAuditSave: true });
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    bus.subscribe({
      id: "sub-audit",
      topic: "topic.audit",
      subscriberName: "audit-worker",
      handler: () => undefined,
    });

    await bus.publish({ topic: "topic.audit", envelope: envelope({ messageId: "msg-audit" }) });

    expect(bus.getMetrics().auditFailureCount).toBeGreaterThan(0);
  });

  it("tracks metrics persistence failures", async () => {
    const { coordinator } = createMemoryPersistence({ failMetricsSave: true });
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    bus.subscribe({
      id: "sub-metrics",
      topic: "topic.metrics",
      subscriberName: "metrics-worker",
      handler: () => undefined,
    });

    await bus.publish({ topic: "topic.metrics", envelope: envelope({ messageId: "msg-metrics" }) });

    expect(bus.getMetrics().metricsPersistenceFailureCount).toBeGreaterThan(0);
  });

  it("recovers pending messages after restart once subscriber is present", async () => {
    class FailingTransport implements Transport {
      async publish(): Promise<void> {
        throw new Error("down");
      }

      subscribe(): () => void {
        return () => undefined;
      }

      queueStats() {
        return { published: 0, delivered: 0, failed: 1, deadLettered: 0, inFlight: 0 };
      }

      health() {
        return { status: "DEGRADED" as const, detail: "down" };
      }
    }

    const { coordinator, state } = createMemoryPersistence();
    const firstBus = new MessageBus({ persistence: coordinator, transport: new FailingTransport() });
    await firstBus.waitUntilReady();

    await expect(firstBus.publish({ topic: "topic.recovery", envelope: envelope({ messageId: "msg-recover" }) })).rejects.toThrow();
    expect(state.pending.length).toBe(1);

    const recovered: string[] = [];
    const secondBus = new MessageBus({ persistence: coordinator });
    await secondBus.waitUntilReady();
    secondBus.subscribe({
      id: "sub-recovery",
      topic: "topic.recovery",
      subscriberName: "recovery-worker",
      handler: (incoming) => {
        recovered.push(incoming.messageId);
      },
    });

    await pause(20);

    expect(recovered).toContain("msg-recover");
    expect(state.pending.length).toBe(0);
  });

  it("supports concurrent publishing and subscriptions", async () => {
    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    let deliveryCount = 0;
    bus.subscribe({ id: "sub-a", topic: "topic.concurrent", subscriberName: "a", handler: () => { deliveryCount += 1; } });
    bus.subscribe({ id: "sub-b", topic: "topic.concurrent", subscriberName: "b", handler: () => { deliveryCount += 1; } });

    await Promise.all(
      Array.from({ length: 10 }).map((_, index) => bus.publish({ topic: "topic.concurrent", envelope: envelope({ messageId: `msg-${index}` }) })),
    );

    expect(deliveryCount).toBe(20);
  });

  it("preserves correlation, causation, and idempotency metadata", async () => {
    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    const seen: Array<{ correlationId: string; causationId: string; idempotencyKey?: string }> = [];
    bus.subscribe({
      id: "sub-correlation",
      topic: "topic.correlation",
      subscriberName: "corr-worker",
      handler: (incoming) => {
        seen.push({
          correlationId: incoming.correlationId,
          causationId: incoming.causationId,
          idempotencyKey: incoming.metadata.idempotencyKey,
        });
      },
    });

    await bus.publish({
      topic: "topic.correlation",
      envelope: envelope({
        correlationId: "corr-x",
        causationId: "cause-x",
        metadata: { idempotencyKey: "idem-x", orderingKey: "order-x" },
      }),
    });

    expect(seen[0]).toEqual({
      correlationId: "corr-x",
      causationId: "cause-x",
      idempotencyKey: "idem-x",
    });
  });

  it("supports duplicate delivery suppression hooks", async () => {
    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({
      persistence: coordinator,
      duplicateDetector: () => true,
    });
    await bus.waitUntilReady();

    let delivered = 0;
    bus.subscribe({
      id: "sub-idem",
      topic: "topic.idem",
      subscriberName: "idem-worker",
      handler: () => {
        delivered += 1;
      },
    });

    await bus.publish({ topic: "topic.idem", envelope: envelope({ messageId: "msg-idem" }) });

    expect(delivered).toBe(0);
    expect(bus.getMetrics().duplicateSuppressedCount).toBe(1);
  });

  it("captures operational readiness statistics", async () => {
    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

    bus.subscribe({ id: "sub-ready", topic: "topic.ready", subscriberName: "ready-worker", handler: () => undefined });
    await bus.publish({ topic: "topic.ready", envelope: envelope({ messageId: "msg-ready" }) });

    const readiness = await bus.getOperationalReadiness();
    expect(readiness.durability).toBe("FILE_PERSISTED");
    expect(readiness.multiNodeReadiness).toBe("TRANSPORT_ABSTRACTION_READY");
  });

  it("supports request/reply success path", async () => {
    const { coordinator } = createMemoryPersistence();
    const bus = new MessageBus({ persistence: coordinator });
    await bus.waitUntilReady();

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
      envelope: envelope({ messageId: "msg-request", payload: { action: "ping" } }),
    });

    expect(response.payload.ok).toBe("reply");
    expect(response.correlationId).toBe("corr-1");
    expect(response.causationId).toBe("msg-request");
  });
});
