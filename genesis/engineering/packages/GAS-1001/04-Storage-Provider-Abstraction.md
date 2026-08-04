# 04 Storage Provider Abstraction

Provider abstraction implemented via:

- AssetStorageProvider
- AssetProviderRegistry
- createDefaultAssetProviderRegistry()

Canonical provider support model:

- FILESYSTEM
- S3_COMPATIBLE
- AZURE_BLOB
- GCS
- OTHER

Runtime default provider:

- providerId: local-filesystem
- providerType: FILESYSTEM
