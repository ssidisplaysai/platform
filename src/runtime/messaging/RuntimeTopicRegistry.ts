import type { RuntimeTopicDescriptor } from "./types";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child as T);
    }
  }
  return value;
}

export class RuntimeTopicRegistry {
  private readonly topics = new Map<string, RuntimeTopicDescriptor>();

  register(descriptor: RuntimeTopicDescriptor): void {
    if (!descriptor.channel || descriptor.channel.trim().length === 0) {
      throw new Error("GRT-MSG-TOPIC-001: channel is required");
    }
    if (!descriptor.topic || descriptor.topic.trim().length === 0) {
      throw new Error("GRT-MSG-TOPIC-002: topic is required");
    }
    const key = `${descriptor.channel}:${descriptor.topic}`;
    if (this.topics.has(key)) {
      throw new Error(`GRT-MSG-TOPIC-003: Duplicate topic: ${key}`);
    }
    this.topics.set(key, deepFreeze({ ...descriptor }));
  }

  has(channel: string, topic: string): boolean {
    return this.topics.has(`${channel}:${topic}`);
  }

  list(): readonly RuntimeTopicDescriptor[] {
    return Object.freeze(
      [...this.topics.values()].sort((a, b) => `${a.channel}:${a.topic}`.localeCompare(`${b.channel}:${b.topic}`)),
    );
  }
}
