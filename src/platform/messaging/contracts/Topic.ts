export type TopicDefinition = {
  name: string;
  description?: string;
  version?: string;
  durable?: boolean;
  allowBroadcast?: boolean;
};
