import type {
  RecipientReference,
  RecipientResolutionResult,
  ResolvedRecipient,
} from "../contracts";

function resolveChannels(reference: RecipientReference): ResolvedRecipient["channels"] {
  const channels: ResolvedRecipient["channels"] = {};

  if (reference.email) {
    channels.EMAIL = reference.email;
  }
  if (reference.phoneNumber) {
    channels.SMS = reference.phoneNumber;
  }
  if (reference.pushToken) {
    channels.PUSH = reference.pushToken;
  }
  if (reference.webhookUrl) {
    channels.WEBHOOK = reference.webhookUrl;
  }
  channels.IN_APP = reference.recipientId;

  return channels;
}

export class RecipientResolver {
  resolve(recipients: RecipientReference[]): RecipientResolutionResult {
    const resolved: ResolvedRecipient[] = [];
    const unresolved: RecipientResolutionResult["unresolved"] = [];

    for (const reference of recipients) {
      if (!reference.recipientId || !reference.tenant || !reference.workspace) {
        unresolved.push({
          reference,
          reason: "NOT_FOUND",
        });
        continue;
      }

      const channels = resolveChannels(reference);
      const hasAnyAddress = Object.values(channels).some((value) => Boolean(value));
      if (!hasAnyAddress) {
        unresolved.push({
          reference,
          reason: "MISSING_CHANNEL",
        });
        continue;
      }

      resolved.push({
        recipientId: reference.recipientId,
        tenant: reference.tenant,
        workspace: reference.workspace,
        actorId: reference.actorId,
        channels,
        preferredLocale: reference.attributes?.locale,
      });
    }

    return { resolved, unresolved };
  }
}
