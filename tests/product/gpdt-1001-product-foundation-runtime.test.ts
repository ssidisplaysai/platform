import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  ProductError,
  createDefaultProductDependencies,
  createGenesisProductRuntime,
  getGenesisProductRuntime,
  type ProductActorContext,
} from "@/platform/product";

function actor(actorId = "svc.product"): ProductActorContext {
  return {
    actorId,
    occurredAt: new Date().toISOString(),
    source: "test",
  };
}

describe("GPDT-1001 Genesis Product Platform foundation runtime", () => {
  it("initializes runtime with deterministic singleton behavior", async () => {
    const runtimeA = await getGenesisProductRuntime();
    const runtimeB = await getGenesisProductRuntime();

    expect(runtimeA).toBe(runtimeB);
    expect(runtimeA.dependencies.providers.getProvider("product-foundation-provider")).toBeDefined();
  });

  it("registers Product and foundation entities and persists across restart", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-1001-product-"));
    try {
      const runtimeA = await createGenesisProductRuntime({ rootDir });

      await runtimeA.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productFamilies: [{ productFamilyId: "pf-2", tenantId: "tenant-a", code: "F2", displayName: "Family 2" }],
          categories: [{ categoryId: "cat-1", tenantId: "tenant-a", code: "C1", displayName: "Category 1" }],
        },
      });

      const created = await runtimeA.registry.registerProduct({
        tenantId: "tenant-a",
        sku: "SKU-002",
        displayName: "Product 2",
        productFamilyId: "pf-2",
        categoryId: "cat-1",
        actor: actor(),
      });

      await runtimeA.registry.registerReferences({
        tenantId: "tenant-a",
        productId: created.productId,
        assetReferences: [{ referenceId: "asset-ref-1", tenantId: "tenant-a", productId: created.productId, assetId: "asset-1" }],
        actor: actor(),
      });

      const runtimeB = await createGenesisProductRuntime({ rootDir });
      const persisted = runtimeB.snapshot();

      expect(persisted.products.length).toBe(1);
      expect(persisted.assetReferences.length).toBe(1);
      expect(runtimeB.metrics.snapshot().recoveryCount).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("enforces deterministic ordering and version-aware lifecycle transitions", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-1001-deterministic-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });

      await runtime.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productFamilies: [{ productFamilyId: "pf-a", tenantId: "tenant-a", code: "A", displayName: "Family A" }],
          categories: [{ categoryId: "cat-a", tenantId: "tenant-a", code: "A", displayName: "Category A" }],
          productVersions: [
            {
              productVersionId: "pv-1",
              tenantId: "tenant-a",
              productId: "seed",
              versionNumber: 1,
              effectiveFrom: new Date().toISOString(),
              lifecycleState: "DRAFT",
            },
          ],
        },
      });

      const b = await runtime.registry.registerProduct({
        tenantId: "tenant-a",
        sku: "SKU-B",
        displayName: "Product B",
        productFamilyId: "pf-a",
        categoryId: "cat-a",
        actor: actor(),
      });

      const a = await runtime.registry.registerProduct({
        tenantId: "tenant-a",
        sku: "SKU-A",
        displayName: "Product A",
        productFamilyId: "pf-a",
        categoryId: "cat-a",
        actor: actor(),
      });

      const products = runtime.snapshot().products;
      expect(products[0]?.productId.localeCompare(products[1]?.productId ?? "")).toBeLessThanOrEqual(0);

      await expect(
        runtime.registry.transitionProductLifecycle({
          tenantId: "tenant-a",
          productId: a.productId,
          lifecycleState: "ACTIVE",
          expectedCurrentVersion: 2,
          actor: actor(),
        }),
      ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });

      await runtime.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productVersions: [
            {
              productVersionId: "pv-2",
              tenantId: "tenant-a",
              productId: a.productId,
              versionNumber: 1,
              effectiveFrom: new Date().toISOString(),
              lifecycleState: "DRAFT",
            },
          ],
        },
      });

      const transitioned = await runtime.registry.transitionProductLifecycle({
        tenantId: "tenant-a",
        productId: a.productId,
        lifecycleState: "ACTIVE",
        expectedCurrentVersion: 1,
        actor: actor(),
      });

      expect(transitioned.lifecycleState).toBe("ACTIVE");
      expect(b.productId).toBeDefined();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("supports health, metrics, and mission control observation", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-1001-observation-"));
    const received: Array<{ productTotal: number; status: string }> = [];

    try {
      const dependencies = createDefaultProductDependencies();
      dependencies.observers.register({
        observerId: "mission-control-test",
        async receiveObservation(input) {
          received.push({ productTotal: input.metrics.productTotal, status: input.health.status });
        },
      });

      const runtime = await createGenesisProductRuntime({ rootDir, dependencies });
      await runtime.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productFamilies: [{ productFamilyId: "pf-1", tenantId: "tenant-a", code: "F1", displayName: "Family 1" }],
          categories: [{ categoryId: "cat-1", tenantId: "tenant-a", code: "C1", displayName: "Category 1" }],
        },
      });

      await runtime.registry.registerProduct({
        tenantId: "tenant-a",
        sku: "SKU-001",
        displayName: "Product 1",
        productFamilyId: "pf-1",
        categoryId: "cat-1",
        actor: actor(),
      });

      const observability = await runtime.observability();
      expect(observability.capability).toBe("platform.product");
      expect(observability.metrics.productTotal).toBe(1);
      expect(observability.health.status).toBe("HEALTHY");

      await runtime.publishMissionControlObservation();
      expect(received.length).toBe(1);
      expect(received[0]?.productTotal).toBe(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("fails closed for corrupt persisted state and enforces boundaries", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-1001-failclosed-"));
    const stateFile = join(rootDir, "product", "product-state.v1.json");

    try {
      await mkdir(join(rootDir, "product"), { recursive: true });
      const corruptPayload = "{\"schemaVersion\":\"2.0.0\",\"products\":[]";
      await writeFile(stateFile, corruptPayload, "utf8");

      await expect(createGenesisProductRuntime({ rootDir })).rejects.toMatchObject({
        name: "ProductError",
        code: "STATE_CORRUPT",
      });

      const persistedAfterFailure = await readFile(stateFile, "utf8");
      expect(persistedAfterFailure).toBe(corruptPayload);

      const cleanRoot = await mkdtemp(join(tmpdir(), "gpdt-1001-boundary-"));
      try {
        const runtime = await createGenesisProductRuntime({ rootDir: cleanRoot });
        await expect(
          runtime.registry.registerFoundationEntities({
            tenantId: "tenant-a",
            actor: actor(),
            entities: { nonFoundationKinds: ["Inventory", "Warehouse"] },
          }),
        ).rejects.toBeInstanceOf(ProductError);
      } finally {
        await rm(cleanRoot, { recursive: true, force: true });
      }
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects provider registration conflicts deterministically", () => {
    const dependencies = createDefaultProductDependencies();
    const before = dependencies.providers.listProviders();

    expect(() => {
      dependencies.providers.register({
        providerId: "product-foundation-provider",
        capability: "observability",
        async inspectHealth() {
          return { status: "DEGRADED", detail: "conflict" };
        },
      });
    }).toThrow("product provider registration conflict: product-foundation-provider");

    expect(dependencies.providers.listProviders().length).toBe(before.length);
  });
});
