import type { JsonSchemaVersion, PersistedEnvelope } from "./types";

export type SchemaValidator<TPayload> = {
  validateOrThrow(state: PersistedEnvelope<TPayload>): void;
};

export function createSchemaValidator<TPayload>(schemaVersion: JsonSchemaVersion): SchemaValidator<TPayload> {
  return {
    validateOrThrow(state: PersistedEnvelope<TPayload>): void {
      if (!state || typeof state !== "object") {
        throw new Error("persisted state must be an object");
      }
      if (state.schemaVersion !== schemaVersion) {
        throw new Error(`unsupported schema version: ${state.schemaVersion}`);
      }
      if (!("payload" in state)) {
        throw new Error("persisted state payload missing");
      }
    },
  };
}
