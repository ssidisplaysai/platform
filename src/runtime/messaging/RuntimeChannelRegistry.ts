import type { RuntimeChannelDescriptor } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeChannelRegistry {
  private readonly channels = new Map<string, RuntimeChannelDescriptor>();

  register(descriptor: RuntimeChannelDescriptor): void {
    if (!descriptor.channel || descriptor.channel.trim().length === 0) {
      throw new Error("GRT-MSG-CHANNEL-001: channel is required");
    }
    if (this.channels.has(descriptor.channel)) {
      throw new Error(`GRT-MSG-CHANNEL-002: Duplicate channel: ${descriptor.channel}`);
    }
    this.channels.set(descriptor.channel, deepFreeze({ ...descriptor }));
  }

  has(channel: string): boolean {
    return this.channels.has(channel);
  }

  get(channel: string): RuntimeChannelDescriptor {
    const descriptor = this.channels.get(channel);
    if (!descriptor) {
      throw new Error(`GRT-MSG-CHANNEL-003: Unknown channel: ${channel}`);
    }
    return descriptor;
  }

  list(): readonly RuntimeChannelDescriptor[] {
    return Object.freeze([...this.channels.values()].sort((a, b) => a.channel.localeCompare(b.channel)));
  }
}
