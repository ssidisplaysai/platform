import type { NotificationDefinition } from "../contracts";
import type { NotificationPersistence } from "../persistence";

export class NotificationRegistry {
  constructor(private readonly persistence: NotificationPersistence) {}

  async register(definition: NotificationDefinition): Promise<void> {
    await this.persistence.definitions.upsert(definition);
  }

  async findById(notificationId: string): Promise<NotificationDefinition | null> {
    return this.persistence.definitions.findById(notificationId);
  }

  async list(): Promise<NotificationDefinition[]> {
    return this.persistence.definitions.list();
  }
}
