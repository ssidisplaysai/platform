import type { PersistedEnvelope, SharedStore } from "../persistence";

export function createInMemoryStore<TPayload>(initial: PersistedEnvelope<TPayload>): SharedStore<TPayload> {
  let state = structuredClone(initial);
  return {
    async load(): Promise<PersistedEnvelope<TPayload>> {
      return structuredClone(state);
    },
    async save(next: PersistedEnvelope<TPayload>): Promise<void> {
      state = structuredClone(next);
    },
  };
}

export function fixedClock(isoTimestamp: string): () => string {
  return () => isoTimestamp;
}
