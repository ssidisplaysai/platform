import type {
  NotificationChannel,
  NotificationType,
  SuppressionRule,
} from "../contracts";
import type { NotificationPersistence } from "../persistence";

export type SuppressionDecision = {
  suppressed: boolean;
  reason?: string;
};

function isExpired(rule: SuppressionRule, nowIso: string): boolean {
  if (!rule.expiresAt) {
    return false;
  }

  return rule.expiresAt <= nowIso;
}

export class SuppressionService {
  constructor(private readonly persistence: NotificationPersistence) {}

  async upsertRule(rule: SuppressionRule): Promise<void> {
    await this.persistence.suppression.upsert(rule);
  }

  async evaluate(input: {
    tenant: string;
    workspace: string;
    recipientId: string;
    channel: NotificationChannel;
    notificationType: NotificationType;
    nowIso: string;
  }): Promise<SuppressionDecision> {
    const rules = await this.persistence.suppression.list();

    for (const rule of rules) {
      if (!rule.active || isExpired(rule, input.nowIso)) {
        continue;
      }

      if (rule.tenant !== input.tenant) {
        continue;
      }

      if (rule.scope === "WORKSPACE" && rule.workspace !== input.workspace) {
        continue;
      }

      if (rule.scope === "RECIPIENT" && rule.recipientId !== input.recipientId) {
        continue;
      }

      if (rule.scope === "CHANNEL" && rule.channel !== input.channel) {
        continue;
      }

      if (rule.scope === "NOTIFICATION_TYPE" && rule.notificationType !== input.notificationType) {
        continue;
      }

      return {
        suppressed: true,
        reason: rule.reason,
      };
    }

    return {
      suppressed: false,
    };
  }
}
