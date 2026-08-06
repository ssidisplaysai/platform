export type JsonSchemaVersion = `${number}.${number}.${number}`;

export type PersistedEnvelope<TPayload> = {
  schemaVersion: JsonSchemaVersion;
  payload: TPayload;
};

export type SharedStore<TPayload> = {
  load(): Promise<PersistedEnvelope<TPayload>>;
  save(state: PersistedEnvelope<TPayload>): Promise<void>;
};
