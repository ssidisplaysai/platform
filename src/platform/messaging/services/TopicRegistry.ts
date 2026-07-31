import type { TopicDefinition } from "../contracts";

export class TopicRegistry {
  private readonly topics = new Map<string, TopicDefinition>();

  register(topic: TopicDefinition): void {
    this.topics.set(topic.name, topic);
  }

  get(name: string): TopicDefinition | undefined {
    return this.topics.get(name);
  }

  has(name: string): boolean {
    return this.topics.has(name);
  }

  list(): TopicDefinition[] {
    return [...this.topics.values()];
  }
}
