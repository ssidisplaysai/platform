import type {
  NotificationChannel,
  NotificationDefinition,
  ResolvedRecipient,
} from "../contracts";

export type ChannelRoute = {
  channel: NotificationChannel;
  address: string;
};

export class ChannelRouter {
  route(input: {
    definition: NotificationDefinition;
    recipient: ResolvedRecipient;
    candidateChannels: NotificationChannel[];
  }): ChannelRoute[] {
    const routes: ChannelRoute[] = [];

    for (const channel of input.candidateChannels) {
      if (!input.definition.allowedChannels.includes(channel)) {
        continue;
      }

      const address = input.recipient.channels[channel];
      if (!address) {
        continue;
      }

      routes.push({
        channel,
        address,
      });
    }

    return routes;
  }
}
