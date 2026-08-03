import type { TemplateDefinition } from "../contracts";
import type { NotificationPersistence } from "../persistence";

export class TemplateRegistry {
  constructor(private readonly persistence: NotificationPersistence) {}

  async register(template: TemplateDefinition): Promise<void> {
    await this.persistence.templates.upsert(template);
  }

  async findById(templateId: string): Promise<TemplateDefinition | null> {
    return this.persistence.templates.findById(templateId);
  }

  async list(): Promise<TemplateDefinition[]> {
    return this.persistence.templates.list();
  }
}
