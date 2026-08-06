import type { PersistedEnvelope } from "./types";

export class RecoveryCoordinator<TPayload> {
  constructor(
    private readonly createDefaultState: () => PersistedEnvelope<TPayload>,
    private readonly onRecovered?: (state: PersistedEnvelope<TPayload>) => PersistedEnvelope<TPayload>,
  ) {}

  recover(state: PersistedEnvelope<TPayload>): PersistedEnvelope<TPayload> {
    const base = state ?? this.createDefaultState();
    return this.onRecovered ? this.onRecovered(base) : base;
  }
}
