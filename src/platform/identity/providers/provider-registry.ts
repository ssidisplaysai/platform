import type { CredentialReference } from "../contracts";
import type { CredentialProvider } from "./credential-provider";

export class AuthenticationProviderRegistry {
  private readonly providers = new Map<string, CredentialProvider>();

  register(provider: CredentialProvider): void {
    this.providers.set(provider.providerId, provider);
  }

  get(providerId: string): CredentialProvider | null {
    return this.providers.get(providerId) ?? null;
  }

  resolveForCredential(providerId: string | undefined, credential: CredentialReference): CredentialProvider | null {
    if (providerId) {
      const selected = this.get(providerId);
      if (selected && selected.supports(credential)) {
        return selected;
      }
    }

    for (const provider of this.providers.values()) {
      if (provider.supports(credential)) {
        return provider;
      }
    }

    return null;
  }

  healthSummary() {
    return Array.from(this.providers.values()).map((provider) => ({
      providerId: provider.providerId,
      ...provider.health(),
    }));
  }
}
