import type {
  ChannelPreference,
  NotificationChannel,
  NotificationDefinition,
  NotificationPriority,
  QuietHoursPolicy,
  ResolvedRecipient,
} from "../contracts";

export type PreferenceDecision = {
  channels: NotificationChannel[];
  deferredUntil?: string;
  rejected: boolean;
  rejectionReason?: string;
};

function isQuietHours(policy: QuietHoursPolicy, now: Date): boolean {
  if (!policy.enabled) {
    return false;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: policy.timezone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");

  if (policy.startHour === policy.endHour) {
    return false;
  }

  if (policy.startHour < policy.endHour) {
    return hour >= policy.startHour && hour < policy.endHour;
  }

  return hour >= policy.startHour || hour < policy.endHour;
}

export class PreferencePolicy {
  decide(input: {
    recipient: ResolvedRecipient;
    definition: NotificationDefinition;
    preference?: ChannelPreference;
    quietHours?: QuietHoursPolicy;
    priority: NotificationPriority;
    now: Date;
  }): PreferenceDecision {
    const preference = input.preference ?? {};
    const disabled = new Set(preference.disabledChannels ?? []);
    const enabled = new Set(preference.enabledChannels ?? input.definition.allowedChannels);

    let channels = input.definition.allowedChannels.filter((channel) => {
      if (!input.recipient.channels[channel]) {
        return false;
      }
      if (disabled.has(channel)) {
        return false;
      }
      return enabled.has(channel);
    });

    if (preference.preferredOrder && preference.preferredOrder.length > 0) {
      const order = preference.preferredOrder;
      channels = channels.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }

    if (channels.length === 0) {
      return {
        channels: [],
        rejected: true,
        rejectionReason: "NO_ELIGIBLE_CHANNEL",
      };
    }

    const quietHours = input.quietHours;
    if (quietHours && isQuietHours(quietHours, input.now)) {
      const isCritical = input.priority === "CRITICAL";
      if (!quietHours.allowCritical || !isCritical) {
        const deferred = new Date(input.now.getTime() + 60 * 60 * 1000).toISOString();
        return {
          channels,
          rejected: false,
          deferredUntil: deferred,
        };
      }
    }

    return {
      channels,
      rejected: false,
    };
  }
}
