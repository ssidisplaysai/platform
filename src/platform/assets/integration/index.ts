export type AssetStorageProvider = {
  providerId: string;
  providerType: "FILESYSTEM" | "S3_COMPATIBLE" | "AZURE_BLOB" | "GCS" | "OTHER";
  inspectHealth(): Promise<{ status: "HEALTHY" | "DEGRADED"; detail: string }>;
};

export type AssetProviderRegistry = {
  getProvider(providerId: string): AssetStorageProvider | undefined;
  listProviders(): AssetStorageProvider[];
};

export function createDefaultAssetProviderRegistry(): AssetProviderRegistry {
  const defaultProvider: AssetStorageProvider = {
    providerId: "local-filesystem",
    providerType: "FILESYSTEM",
    async inspectHealth() {
      return { status: "HEALTHY", detail: "default filesystem provider" };
    },
  };

  return {
    getProvider(providerId: string) {
      return providerId === defaultProvider.providerId ? defaultProvider : undefined;
    },
    listProviders() {
      return [defaultProvider];
    },
  };
}
