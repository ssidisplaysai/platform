import { deterministicSort } from "../utilities";

export type SharedProvider = {
  providerId: string;
  capability: string;
  inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }>;
};

export class ProviderRegistry {
  private readonly providers = new Map<string, SharedProvider>();

  register(provider: SharedProvider): void {
    if (!provider.providerId || this.providers.has(provider.providerId)) {
      throw new Error(`provider registration conflict: ${provider.providerId}`);
    }
    this.providers.set(provider.providerId, provider);
  }

  getProvider(providerId: string): SharedProvider | undefined {
    return this.providers.get(providerId);
  }

  listProviders(): SharedProvider[] {
    return deterministicSort([...this.providers.values()], (provider) => provider.providerId);
  }
}
