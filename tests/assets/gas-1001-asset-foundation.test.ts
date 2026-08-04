import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import { AssetError, createGenesisAssetRuntime, type AssetActorContext } from "@/platform/assets";

function actor(actorId = "svc.assets"): AssetActorContext {
  return {
    actorId,
    occurredAt: new Date().toISOString(),
    source: "test",
  };
}

describe("GAS-1001 Genesis Asset Platform foundation", () => {
  it("registers assets, versions, metadata, integrity, relationships, and collections", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gas-1001-assets-"));
    try {
      const runtime = await createGenesisAssetRuntime({ rootDir });
      const image = await runtime.registry.registerAsset({
        tenantId: "tenant-a",
        type: "IMAGE",
        displayName: "Hero Image",
        actor: actor(),
        provider: { providerId: "local-filesystem", providerType: "FILESYSTEM" },
        metadata: { purpose: "marketing" },
        tags: ["Campaign", "Hero"],
        initialVersion: {
          storageKey: "images/hero-v1.png",
          sizeBytes: 1024,
          mimeType: "image/png",
          checksumAlgorithm: "SHA256",
          checksumDigest: "abc123",
        },
      });

      const imageV2 = await runtime.registry.addVersion({
        tenantId: "tenant-a",
        assetId: image.assetId,
        actor: actor(),
        storageKey: "images/hero-v2.png",
        sizeBytes: 2048,
        mimeType: "image/png",
        checksumAlgorithm: "SHA256",
        checksumDigest: "def456",
      });
      expect(imageV2.versions).toHaveLength(2);

      const metadataUpdated = await runtime.registry.updateMetadata({
        tenantId: "tenant-a",
        assetId: image.assetId,
        actor: actor(),
        metadata: { purpose: "homepage", locale: "en-US" },
        tags: ["Homepage", "Hero"],
      });
      expect(metadataUpdated.tags).toEqual(["homepage", "hero"]);

      const valid = await runtime.registry.verifyIntegrity({
        tenantId: "tenant-a",
        assetId: image.assetId,
        expectedDigest: "def456",
        actor: actor(),
      });
      expect(valid.valid).toBe(true);

      const invalid = await runtime.registry.verifyIntegrity({
        tenantId: "tenant-a",
        assetId: image.assetId,
        expectedDigest: "mismatch",
        actor: actor(),
      });
      expect(invalid.valid).toBe(false);

      const code = await runtime.registry.registerAsset({
        tenantId: "tenant-a",
        type: "SOURCE_CODE",
        displayName: "Renderer",
        actor: actor(),
        provider: { providerId: "local-filesystem", providerType: "FILESYSTEM" },
        initialVersion: {
          storageKey: "src/renderer.ts",
          sizeBytes: 512,
          mimeType: "text/typescript",
          checksumAlgorithm: "SHA256",
          checksumDigest: "xyz999",
        },
      });

      const relationship = await runtime.registry.linkAssets({
        tenantId: "tenant-a",
        fromAssetId: image.assetId,
        toAssetId: code.assetId,
        relationshipType: "RELATED",
        actor: actor(),
      });
      expect(relationship.relationshipId.length).toBeGreaterThan(0);

      const collection = await runtime.registry.createCollection({
        tenantId: "tenant-a",
        name: "Launch Assets",
        actor: actor(),
      });
      const updatedCollection = await runtime.registry.addAssetToCollection({
        tenantId: "tenant-a",
        collectionId: collection.collectionId,
        assetId: image.assetId,
        actor: actor(),
      });
      expect(updatedCollection.assetIds).toContain(image.assetId);

      const observability = await runtime.observability();
      expect(observability.capability).toBe("platform.assets");
      expect(observability.metrics.assetsTotal).toBe(2);
      expect(observability.metrics.integrityFailures).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("enforces retention and lifecycle soft-delete/restore semantics", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gas-1001-retention-"));
    try {
      const runtime = await createGenesisAssetRuntime({ rootDir });
      const asset = await runtime.registry.registerAsset({
        tenantId: "tenant-a",
        type: "DOCUMENT",
        displayName: "Retention Policy",
        actor: actor(),
        provider: { providerId: "local-filesystem", providerType: "FILESYSTEM" },
        retention: { legalHold: true, policyId: "policy-1" },
        initialVersion: {
          storageKey: "docs/policy.pdf",
          sizeBytes: 4096,
          mimeType: "application/pdf",
          checksumAlgorithm: "SHA256",
          checksumDigest: "ret111",
        },
      });

      await expect(runtime.registry.softDelete({
        tenantId: "tenant-a",
        assetId: asset.assetId,
        actor: actor(),
      })).rejects.toBeInstanceOf(AssetError);

      await runtime.registry.setRetention({
        tenantId: "tenant-a",
        assetId: asset.assetId,
        legalHold: false,
        actor: actor(),
      });

      const archived = await runtime.registry.archive({
        tenantId: "tenant-a",
        assetId: asset.assetId,
        actor: actor(),
      });
      expect(archived.lifecycle.status).toBe("ARCHIVED");

      const deleted = await runtime.registry.softDelete({
        tenantId: "tenant-a",
        assetId: asset.assetId,
        actor: actor(),
      });
      expect(deleted.lifecycle.status).toBe("SOFT_DELETED");

      const restored = await runtime.registry.restore({
        tenantId: "tenant-a",
        assetId: asset.assetId,
        actor: actor(),
      });
      expect(restored.lifecycle.status).toBe("ACTIVE");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("persists canonical state across runtime restart", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gas-1001-persist-"));
    try {
      const runtimeA = await createGenesisAssetRuntime({ rootDir });
      const created = await runtimeA.registry.registerAsset({
        tenantId: "tenant-a",
        type: "BINARY_PACKAGE",
        displayName: "package.tgz",
        actor: actor(),
        provider: { providerId: "local-filesystem", providerType: "FILESYSTEM" },
        initialVersion: {
          storageKey: "packages/package.tgz",
          sizeBytes: 10240,
          mimeType: "application/gzip",
          checksumAlgorithm: "SHA512",
          checksumDigest: "pkg777",
        },
      });

      const runtimeB = await createGenesisAssetRuntime({ rootDir });
      const found = runtimeB.registry.getAsset(created.assetId);

      expect(found?.assetId).toBe(created.assetId);
      expect(runtimeB.snapshot("tenant-a").length).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
