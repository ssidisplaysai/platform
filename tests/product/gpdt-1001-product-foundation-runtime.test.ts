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

function productInput(overrides: Partial<{
  productId: string;
  productCode: string;
  versionIdentifier: string;
  displayName: string;
}> = {}) {
  return {
    tenantId: "tenant-a",
    productId: overrides.productId ?? "product-1",
    productCode: overrides.productCode ?? "P-001",
    versionIdentifier: overrides.versionIdentifier ?? "v1",
    displayName: overrides.displayName ?? "Product One",
    lifecycleState: "DRAFT" as const,
    metadata: { owner: "product" },
    productFamilyId: "pf-1",
    categoryId: "cat-1",
    actor: actor(),
  };
}

describe("GPDT-1001R Product conformance remediation", () => {
  it("initializes runtime singleton deterministically", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-r-singleton-"));
    const previousRoot = process.env.GENESIS_DATA_ROOT;
    process.env.GENESIS_DATA_ROOT = rootDir;
    try {
      const runtimeA = await getGenesisProductRuntime();
      const runtimeB = await getGenesisProductRuntime();
      expect(runtimeA).toBe(runtimeB);
    } finally {
      process.env.GENESIS_DATA_ROOT = previousRoot;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects valid JSON with unsupported schema version", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-r-unsupported-schema-"));
    const stateFile = join(rootDir, "product", "product-state.v1.json");

    try {
      await mkdir(join(rootDir, "product"), { recursive: true });
      await writeFile(
        stateFile,
        JSON.stringify({ schemaVersion: "9.9.9", products: [], variants: [] }, null, 2),
        "utf8",
      );

      await expect(createGenesisProductRuntime({ rootDir })).rejects.toMatchObject({ code: "STATE_CORRUPT" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects malformed JSON and invalid payload shape fail-closed", async () => {
    const malformedRoot = await mkdtemp(join(tmpdir(), "gpdt-r-malformed-"));
    const malformedStateFile = join(malformedRoot, "product", "product-state.v1.json");

    try {
      await mkdir(join(malformedRoot, "product"), { recursive: true });
      const malformedPayload = "{\"schemaVersion\":\"1.1.0\",\"products\":[]";
      await writeFile(malformedStateFile, malformedPayload, "utf8");

      await expect(createGenesisProductRuntime({ rootDir: malformedRoot })).rejects.toMatchObject({ code: "STATE_CORRUPT" });
      expect(await readFile(malformedStateFile, "utf8")).toBe(malformedPayload);
    } finally {
      await rm(malformedRoot, { recursive: true, force: true });
    }

    const shapeRoot = await mkdtemp(join(tmpdir(), "gpdt-r-shape-"));
    const shapeStateFile = join(shapeRoot, "product", "product-state.v1.json");
    try {
      await mkdir(join(shapeRoot, "product"), { recursive: true });
      await writeFile(shapeStateFile, JSON.stringify({ schemaVersion: "1.1.0", products: {} }, null, 2), "utf8");
      await expect(createGenesisProductRuntime({ rootDir: shapeRoot })).rejects.toMatchObject({ code: "STATE_CORRUPT" });
    } finally {
      await rm(shapeRoot, { recursive: true, force: true });
    }
  });

  it("enforces required ProductCode and VersionIdentifier", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-r-required-fields-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await runtime.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productFamilies: [{ productFamilyId: "pf-1", tenantId: "tenant-a", code: "F1", displayName: "Family 1" }],
          categories: [{ categoryId: "cat-1", tenantId: "tenant-a", code: "C1", displayName: "Category 1" }],
        },
      });

      await expect(
        runtime.registry.registerProduct({ ...productInput({ productCode: "" }) }),
      ).rejects.toMatchObject({ code: "PRODUCT_INVALID" });

      await expect(
        runtime.registry.registerProduct({ ...productInput({ productId: "product-2", versionIdentifier: "" }) }),
      ).rejects.toMatchObject({ code: "PRODUCT_INVALID" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("enforces ProductCode uniqueness and immutable identity fields", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-r-immutability-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await runtime.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productFamilies: [{ productFamilyId: "pf-1", tenantId: "tenant-a", code: "F1", displayName: "Family 1" }],
          categories: [{ categoryId: "cat-1", tenantId: "tenant-a", code: "C1", displayName: "Category 1" }],
        },
      });

      const created = await runtime.registry.registerProduct(productInput());
      await expect(
        runtime.registry.registerProduct({ ...productInput({ productId: "product-2", productCode: "p-001" }) }),
      ).rejects.toMatchObject({ code: "PRODUCT_DUPLICATE" });

      await expect(
        runtime.catalog.reviseMetadata({
          tenantId: "tenant-a",
          productId: created.productId,
          metadata: { owner: "updated" },
          actor: actor(),
          immutable: { productCode: "CHANGED-CODE" },
        }),
      ).rejects.toMatchObject({ code: "IMMUTABLE_FIELD" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("enforces legal lifecycle transitions and rejects skipping", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-r-lifecycle-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await runtime.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productFamilies: [{ productFamilyId: "pf-1", tenantId: "tenant-a", code: "F1", displayName: "Family 1" }],
          categories: [{ categoryId: "cat-1", tenantId: "tenant-a", code: "C1", displayName: "Category 1" }],
        },
      });

      const created = await runtime.registry.registerProduct(productInput());

      await expect(
        runtime.registry.transitionProductLifecycle({
          tenantId: "tenant-a",
          productId: created.productId,
          lifecycleState: "ACTIVE",
          expectedVersionIdentifier: "v1",
          actor: actor(),
        }),
      ).rejects.toMatchObject({ code: "LIFECYCLE_TRANSITION_INVALID" });

      await runtime.registry.transitionProductLifecycle({
        tenantId: "tenant-a",
        productId: created.productId,
        lifecycleState: "PROPOSED",
        expectedVersionIdentifier: "v1",
        actor: actor(),
      });

      await runtime.registry.transitionProductLifecycle({
        tenantId: "tenant-a",
        productId: created.productId,
        lifecycleState: "APPROVED",
        expectedVersionIdentifier: "v1",
        actor: actor(),
      });

      await runtime.registry.transitionProductLifecycle({
        tenantId: "tenant-a",
        productId: created.productId,
        lifecycleState: "ACTIVE",
        expectedVersionIdentifier: "v1",
        actor: actor(),
      });

      const transitioned = await runtime.registry.transitionProductLifecycle({
        tenantId: "tenant-a",
        productId: created.productId,
        lifecycleState: "DEPRECATED",
        expectedVersionIdentifier: "v1",
        actor: actor(),
      });

      expect(transitioned.lifecycleState).toBe("DEPRECATED");
      expect(runtime.metrics.snapshot().auditEvents).toBeGreaterThanOrEqual(5);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("exposes dedicated service boundaries with working minimum behavior", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-r-services-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await runtime.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productFamilies: [{ productFamilyId: "pf-1", tenantId: "tenant-a", code: "F1", displayName: "Family 1" }],
          categories: [{ categoryId: "cat-1", tenantId: "tenant-a", code: "C1", displayName: "Category 1" }],
        },
      });

      await runtime.catalog.createProduct(productInput());

      await runtime.variant.createVariant({
        productVariantId: "var-1",
        tenantId: "tenant-a",
        productId: "product-1",
        sku: "VAR-1",
        displayName: "Variant 1",
        lifecycleState: "DRAFT",
        versionIdentifier: "v1",
        attributes: [],
        createdAt: new Date().toISOString(),
        createdBy: "svc.product",
        updatedAt: new Date().toISOString(),
        updatedBy: "svc.product",
        actor: actor(),
      });

      await runtime.configuration.defineConfiguration({
        configurationId: "cfg-1",
        tenantId: "tenant-a",
        productId: "product-1",
        lifecycleState: "DRAFT",
        versionIdentifier: "v1",
        rules: [],
        actor: actor(),
      });

      await runtime.pricingDefinition.definePricing({
        pricingDefinitionId: "price-1",
        tenantId: "tenant-a",
        productId: "product-1",
        currency: "USD",
        amount: 99,
        lifecycleState: "APPROVED",
        versionIdentifier: "v1",
        actor: actor(),
      });

      await runtime.bomDefinition.defineBom({
        billOfMaterialDefinitionId: "bom-1",
        tenantId: "tenant-a",
        productId: "product-1",
        components: [{ componentProductId: "product-1", quantity: 1 }],
        lifecycleState: "APPROVED",
        versionIdentifier: "v1",
        actor: actor(),
      });

      await runtime.relationship.defineRelationship({
        productRelationshipId: "rel-1",
        tenantId: "tenant-a",
        sourceProductId: "product-1",
        targetProductId: "product-1",
        kind: "COMPATIBLE_WITH",
        actor: actor(),
      });

      await runtime.bundleKit.defineBundle({
        productBundleId: "bundle-1",
        tenantId: "tenant-a",
        code: "B1",
        lifecycleState: "DRAFT",
        versionIdentifier: "v1",
        componentProductIds: ["product-1"],
        actor: actor(),
      });

      await runtime.bundleKit.defineKit({
        productKitId: "kit-1",
        tenantId: "tenant-a",
        code: "K1",
        lifecycleState: "DRAFT",
        versionIdentifier: "v1",
        componentProductIds: ["product-1"],
        actor: actor(),
      });

      expect(runtime.query.listProducts("tenant-a").length).toBe(1);
      expect(runtime.metrics.snapshot().variantTotal).toBe(1);
      expect(runtime.metrics.snapshot().bundleTotal).toBe(1);
      expect(runtime.metrics.snapshot().kitTotal).toBe(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects invalid mandatory references and increments observability counters without partial mutation", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-r-reference-failure-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await runtime.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productFamilies: [{ productFamilyId: "pf-1", tenantId: "tenant-a", code: "F1", displayName: "Family 1" }],
          categories: [{ categoryId: "cat-1", tenantId: "tenant-a", code: "C1", displayName: "Category 1" }],
        },
      });

      await runtime.registry.registerProduct(productInput());
      const beforeReferences = runtime.snapshot().assetReferences.length;
      const beforeInvalidCount = runtime.metrics.snapshot().invalidReferenceCount;

      await expect(
        runtime.references.registerReferences({
          tenantId: "tenant-a",
          productId: "product-1",
          actor: actor(),
          assetReferences: [{ referenceId: "ref-1", tenantId: "tenant-a", productId: "product-1", assetId: "" }],
        }),
      ).rejects.toBeInstanceOf(ProductError);

      const after = runtime.snapshot();
      expect(after.assetReferences.length).toBe(beforeReferences);
      expect(runtime.metrics.snapshot().invalidReferenceCount).toBe(beforeInvalidCount + 1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("captures audit and rejection evidence with deterministic provider and observer conflict handling", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-r-observability-"));
    const observations: Array<{ productTotal: number; status: string }> = [];
    try {
      const dependencies = createDefaultProductDependencies();
      dependencies.observers.register({
        observerId: "mission-control-test",
        async receiveObservation(input) {
          observations.push({ productTotal: input.metrics.productTotal, status: input.health.status });
        },
      });

      expect(() => {
        dependencies.observers.register({
          observerId: "mission-control-test",
          async receiveObservation() {
            return;
          },
        });
      }).toThrow("mission control observer registration conflict: mission-control-test");

      expect(() => {
        dependencies.providers.register({
          providerId: "product-foundation-provider",
          capability: "observability",
          async inspectHealth() {
            return { status: "DEGRADED", detail: "duplicate" };
          },
        });
      }).toThrow("product provider registration conflict: product-foundation-provider");

      const runtime = await createGenesisProductRuntime({ rootDir, dependencies });
      await runtime.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productFamilies: [{ productFamilyId: "pf-1", tenantId: "tenant-a", code: "F1", displayName: "Family 1" }],
          categories: [{ categoryId: "cat-1", tenantId: "tenant-a", code: "C1", displayName: "Category 1" }],
        },
      });
      await runtime.registry.registerProduct(productInput());

      await expect(
        runtime.registry.transitionProductLifecycle({
          tenantId: "tenant-a",
          productId: "product-1",
          lifecycleState: "PROPOSED",
          expectedVersionIdentifier: "v99",
          actor: actor(),
        }),
      ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });

      expect(runtime.metrics.snapshot().versionConflictCount).toBeGreaterThanOrEqual(1);
      expect(runtime.metrics.snapshot().auditEvents).toBeGreaterThanOrEqual(3);

      await runtime.publishMissionControlObservation();
      expect(observations.length).toBe(1);
      expect(observations[0]?.productTotal).toBe(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("maintains restart continuity and deterministic ordering across implemented collections", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-r-restart-ordering-"));
    try {
      const runtimeA = await createGenesisProductRuntime({ rootDir });
      await runtimeA.registry.registerFoundationEntities({
        tenantId: "tenant-a",
        actor: actor(),
        entities: {
          productFamilies: [
            { productFamilyId: "pf-b", tenantId: "tenant-a", code: "FB", displayName: "Family B" },
            { productFamilyId: "pf-a", tenantId: "tenant-a", code: "FA", displayName: "Family A" },
          ],
          categories: [
            { categoryId: "cat-b", tenantId: "tenant-a", code: "CB", displayName: "Category B" },
            { categoryId: "cat-a", tenantId: "tenant-a", code: "CA", displayName: "Category A" },
          ],
        },
      });

      await runtimeA.registry.registerProduct({ ...productInput({ productId: "product-b", productCode: "B-001" }), productFamilyId: "pf-b", categoryId: "cat-b" });
      await runtimeA.registry.registerProduct({ ...productInput({ productId: "product-a", productCode: "A-001" }), productFamilyId: "pf-a", categoryId: "cat-a" });

      const runtimeB = await createGenesisProductRuntime({ rootDir });
      const snapshot = runtimeB.snapshot();

      expect(snapshot.products[0]?.productId).toBe("product-a");
      expect(snapshot.products[1]?.productId).toBe("product-b");
      expect(runtimeB.metrics.snapshot().recoveryCount).toBeGreaterThanOrEqual(1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
