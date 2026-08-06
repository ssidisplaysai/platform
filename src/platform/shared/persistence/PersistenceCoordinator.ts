import type { PersistedEnvelope, SharedStore } from "./types";
import type { SchemaValidator } from "./SchemaValidator";
import { RecoveryCoordinator } from "./RecoveryCoordinator";

type PersistenceCoordinatorOptions<TPayload> = {
  store: SharedStore<TPayload>;
  validator: SchemaValidator<TPayload>;
  recovery: RecoveryCoordinator<TPayload>;
};

export class PersistenceCoordinator<TPayload> {
  private state!: PersistedEnvelope<TPayload>;

  constructor(private readonly options: PersistenceCoordinatorOptions<TPayload>) {}

  async load(): Promise<void> {
    const loaded = await this.options.store.load();
    const recovered = this.options.recovery.recover(loaded);
    this.options.validator.validateOrThrow(recovered);
    this.state = recovered;
    await this.options.store.save(this.state);
  }

  private ensureLoaded(): PersistedEnvelope<TPayload> {
    if (!this.state) {
      throw new Error("persistence state not loaded");
    }
    return this.state;
  }

  snapshot(): PersistedEnvelope<TPayload> {
    return structuredClone(this.ensureLoaded());
  }

  async mutate(mutator: (payload: TPayload) => void): Promise<void> {
    const next = this.snapshot();
    mutator(next.payload);
    this.options.validator.validateOrThrow(next);
    await this.options.store.save(next);
    this.state = next;
  }
}
