import { randomUUID } from "node:crypto";
import type {
  DeliveryResult,
  NotificationChannel,
  ProviderCapability,
  RenderedNotification,
} from "../contracts";

export type NotificationProviderRequest = {
  requestId: string;
  recipientId: string;
  address: string;
  message: RenderedNotification;
  metadata?: Record<string, string>;
};

export interface NotificationProvider {
  readonly capability: ProviderCapability;
  send(request: NotificationProviderRequest): Promise<DeliveryResult>;
}

export type InMemoryProviderBehavior = {
  shouldFail?: (request: NotificationProviderRequest) => boolean;
  failureReason?: string;
  retryable?: boolean;
};

class InMemoryProvider implements NotificationProvider {
  readonly capability: ProviderCapability;

  constructor(
    private readonly channel: NotificationChannel,
    private readonly behavior: InMemoryProviderBehavior = {},
  ) {
    this.capability = {
      providerName: `in-memory-${channel.toLowerCase()}`,
      supportedChannels: [channel],
      maxPayloadBytes: 512 * 1024,
      supportsHtml: true,
      supportsUnicode: true,
    };
  }

  async send(request: NotificationProviderRequest): Promise<DeliveryResult> {
    if (this.behavior.shouldFail?.(request)) {
      return {
        status: "FAILED",
        providerName: this.capability.providerName,
        channel: this.channel,
        retryable: this.behavior.retryable ?? true,
        reason: this.behavior.failureReason ?? "simulated_failure",
      };
    }

    return {
      status: "DELIVERED",
      providerName: this.capability.providerName,
      channel: this.channel,
      retryable: false,
      externalId: `${this.channel.toLowerCase()}_${randomUUID()}`,
      deliveredAt: new Date().toISOString(),
    };
  }
}

export type NotificationProviderRegistry = {
  getProvider(channel: NotificationChannel): NotificationProvider | null;
  listProviders(): NotificationProvider[];
};

export function createInMemoryProviderRegistry(options?: {
  email?: InMemoryProviderBehavior;
  sms?: InMemoryProviderBehavior;
  push?: InMemoryProviderBehavior;
  webhook?: InMemoryProviderBehavior;
  inApp?: InMemoryProviderBehavior;
}): NotificationProviderRegistry {
  const providers = new Map<NotificationChannel, NotificationProvider>([
    ["EMAIL", new InMemoryProvider("EMAIL", options?.email)],
    ["SMS", new InMemoryProvider("SMS", options?.sms)],
    ["PUSH", new InMemoryProvider("PUSH", options?.push)],
    ["WEBHOOK", new InMemoryProvider("WEBHOOK", options?.webhook)],
    ["IN_APP", new InMemoryProvider("IN_APP", options?.inApp)],
  ]);

  return {
    getProvider(channel) {
      return providers.get(channel) ?? null;
    },

    listProviders() {
      return Array.from(providers.values());
    },
  };
}
