import type { Transport, TransportHealth, TransportMessage, TransportQueueStats } from "../contracts";

export class InMemoryTransport implements Transport {
  private readonly subscribers = new Set<(message: TransportMessage) => Promise<void>>();
  private readonly stats: TransportQueueStats = {
    published: 0,
    delivered: 0,
    failed: 0,
    deadLettered: 0,
    inFlight: 0,
  };

  async publish<TPayload = unknown>(message: TransportMessage<TPayload>): Promise<void> {
    this.stats.published += 1;
    this.stats.inFlight += 1;

    try {
      for (const subscriber of this.subscribers) {
        await subscriber(message);
      }
      this.stats.delivered += 1;
    } catch (error) {
      this.stats.failed += 1;
      throw error;
    } finally {
      this.stats.inFlight = Math.max(0, this.stats.inFlight - 1);
    }
  }

  subscribe(subscriber: (message: TransportMessage) => Promise<void>): () => void {
    this.subscribers.add(subscriber);
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  queueStats(): TransportQueueStats {
    return { ...this.stats };
  }

  health(): TransportHealth {
    return {
      status: "HEALTHY",
      detail: `inMemorySubscribers=${this.subscribers.size}`,
    };
  }
}
