import type { RuntimeSnapshot } from "../contracts";
import { LifecycleManager } from "./LifecycleManager";
import { ProviderRegistry, type SharedProvider } from "./ProviderRegistry";
import { ServiceRegistry } from "./ServiceRegistry";

export type RuntimeHostOptions<TState> = {
  runtimeId: string;
  initialState: TState;
};

export class RuntimeHost<TState, TService extends { serviceId: string }> {
  readonly lifecycle = new LifecycleManager();
  readonly services = new ServiceRegistry<TService>();
  readonly providers = new ProviderRegistry();

  private readonly runtimeId: string;
  private startedAt?: string;
  private state: TState;

  constructor(options: RuntimeHostOptions<TState>) {
    this.runtimeId = options.runtimeId;
    this.state = options.initialState;
  }

  getRuntimeId(): string {
    return this.runtimeId;
  }

  setState(next: TState): void {
    this.state = next;
  }

  getState(): TState {
    return this.state;
  }

  registerService(service: TService): void {
    this.services.register(service);
  }

  registerProvider(provider: SharedProvider): void {
    this.providers.register(provider);
  }

  async start(): Promise<void> {
    await this.lifecycle.start();
    this.startedAt = new Date().toISOString();
  }

  async stop(): Promise<void> {
    await this.lifecycle.stop();
  }

  snapshot(): RuntimeSnapshot<TState> {
    return {
      lifecycle: this.lifecycle.getState(),
      startedAt: this.startedAt,
      state: structuredClone(this.state),
    };
  }
}
