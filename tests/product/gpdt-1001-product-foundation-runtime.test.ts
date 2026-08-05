import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "@jest/globals";
import {
  ProductError,
  createDefaultProductDependencies,
  createDefaultProductPersistedState,
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

async function registerFoundationAndProducts(
  runtime: Awaited<ReturnType<typeof createGenesisProductRuntime>>,
  productIds: string[],
): Promise<void> {
  await runtime.registry.registerFoundationEntities({
    tenantId: "tenant-a",
    actor: actor(),
    entities: {
      productFamilies: [{ productFamilyId: "pf-1", tenantId: "tenant-a", code: "F1", displayName: "Family 1" }],
      categories: [{ categoryId: "cat-1", tenantId: "tenant-a", code: "C1", displayName: "Category 1" }],
    },
  });

  let counter = 1;
  for (const productId of productIds) {
    await runtime.registry.registerProduct({
      ...productInput({ productId, productCode: `P-${counter.toString().padStart(3, "0")}` }),
    });
    counter += 1;
  }
}

describe("GPDT-1001B-CERT Product condition closure", () => {
  it("initializes runtime singleton deterministically", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-singleton-"));
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
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-unsupported-schema-"));
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
    const malformedRoot = await mkdtemp(join(tmpdir(), "gpdt-cert-malformed-"));
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

    const shapeRoot = await mkdtemp(join(tmpdir(), "gpdt-cert-shape-"));
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
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-required-fields-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await registerFoundationAndProducts(runtime, []);

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
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-immutability-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await registerFoundationAndProducts(runtime, []);

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
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-lifecycle-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await registerFoundationAndProducts(runtime, []);

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

  it("rejects direct BOM self-cycle and preserves atomic state", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-bom-self-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await registerFoundationAndProducts(runtime, ["product-1"]);
      const beforeCount = runtime.snapshot().billOfMaterialDefinitions.length;

      await expect(
        runtime.bomDefinition.defineBom({
          billOfMaterialDefinitionId: "bom-self",
          tenantId: "tenant-a",
          productId: "product-1",
          components: [{ componentProductId: "product-1", quantity: 1 }],
          lifecycleState: "APPROVED",
          versionIdentifier: "v1",
          actor: actor(),
        }),
      ).rejects.toMatchObject({ code: "INVARIANT_VIOLATION" });

      expect(runtime.snapshot().billOfMaterialDefinitions.length).toBe(beforeCount);
      expect(runtime.metrics.snapshot().cycleRejectionCount).toBe(1);
      const rejected = runtime
        .snapshot()
        .audits.find((audit) => audit.eventType === "PRODUCT_BOM_DEFINITION_REJECTED" && audit.productId === "product-1");
      expect(rejected).toBeDefined();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects two-node and multi-level BOM cycles while allowing acyclic hierarchy", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-bom-graph-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await registerFoundationAndProducts(runtime, ["product-1", "product-2", "product-3", "product-4"]);

      await runtime.bomDefinition.defineBom({
        billOfMaterialDefinitionId: "bom-1",
        tenantId: "tenant-a",
        productId: "product-1",
        components: [{ componentProductId: "product-2", quantity: 1 }],
        lifecycleState: "APPROVED",
        versionIdentifier: "v1",
        actor: actor(),
      });

      await runtime.bomDefinition.defineBom({
        billOfMaterialDefinitionId: "bom-2",
        tenantId: "tenant-a",
        productId: "product-2",
        components: [{ componentProductId: "product-3", quantity: 1 }],
        lifecycleState: "APPROVED",
        versionIdentifier: "v1",
        actor: actor(),
      });

      const before = runtime.snapshot().billOfMaterialDefinitions.length;
      await expect(
        runtime.bomDefinition.defineBom({
          billOfMaterialDefinitionId: "bom-cycle-two",
          tenantId: "tenant-a",
          productId: "product-3",
          components: [{ componentProductId: "product-1", quantity: 1 }],
          lifecycleState: "APPROVED",
          versionIdentifier: "v1",
          actor: actor(),
        }),
      ).rejects.toMatchObject({ code: "INVARIANT_VIOLATION" });
      expect(runtime.snapshot().billOfMaterialDefinitions.length).toBe(before);

      await runtime.bomDefinition.defineBom({
        billOfMaterialDefinitionId: "bom-4",
        tenantId: "tenant-a",
        productId: "product-4",
        components: [{ componentProductId: "product-2", quantity: 1 }],
        lifecycleState: "APPROVED",
        versionIdentifier: "v2",
        actor: actor(),
      });
      expect(runtime.snapshot().billOfMaterialDefinitions.length).toBe(before + 1);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects configuration direct and mutual rule cycles", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-config-rule-cycles-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await registerFoundationAndProducts(runtime, ["product-1"]);

      await expect(
        runtime.configuration.defineConfiguration({
          configurationId: "cfg-self",
          tenantId: "tenant-a",
          productId: "product-1",
          lifecycleState: "DRAFT",
          versionIdentifier: "v1",
          rules: [{ configurationRuleId: "r1", expression: "rule:r1", severity: "ERROR" }],
          actor: actor(),
        }),
      ).rejects.toMatchObject({ code: "INVARIANT_VIOLATION" });

      await expect(
        runtime.configuration.defineConfiguration({
          configurationId: "cfg-mutual",
          tenantId: "tenant-a",
          productId: "product-1",
          lifecycleState: "DRAFT",
          versionIdentifier: "v1",
          rules: [
            { configurationRuleId: "r1", expression: "rule:r2", severity: "ERROR" },
            { configurationRuleId: "r2", expression: "rule:r1", severity: "ERROR" },
          ],
          actor: actor(),
        }),
      ).rejects.toMatchObject({ code: "INVARIANT_VIOLATION" });

      expect(runtime.metrics.snapshot().cycleRejectionCount).toBeGreaterThanOrEqual(2);
      const rejected = runtime.snapshot().audits.filter((audit) => audit.eventType === "PRODUCT_CONFIGURATION_REJECTED");
      expect(rejected.length).toBeGreaterThanOrEqual(2);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects multi-node configuration dependency cycles and keeps health coherent", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-config-dependency-cycles-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await registerFoundationAndProducts(runtime, ["product-1"]);

      await runtime.configuration.defineConfiguration({
        configurationId: "cfg-1",
        tenantId: "tenant-a",
        productId: "product-1",
        lifecycleState: "DRAFT",
        versionIdentifier: "v1",
        rules: [{ configurationRuleId: "r1", expression: "config:cfg-2", severity: "ERROR" }],
        actor: actor(),
      });

      const before = runtime.snapshot().configurations.length;
      await expect(
        runtime.configuration.defineConfiguration({
          configurationId: "cfg-2",
          tenantId: "tenant-a",
          productId: "product-1",
          lifecycleState: "DRAFT",
          versionIdentifier: "v1",
          rules: [{ configurationRuleId: "r2", expression: "config:cfg-3", severity: "ERROR" }],
          actor: actor(),
        }),
      ).resolves.toMatchObject({ configurationId: "cfg-2" });

      await expect(
        runtime.configuration.defineConfiguration({
          configurationId: "cfg-3",
          tenantId: "tenant-a",
          productId: "product-1",
          lifecycleState: "DRAFT",
          versionIdentifier: "v1",
          rules: [{ configurationRuleId: "r3", expression: "config:cfg-1", severity: "ERROR" }],
          actor: actor(),
        }),
      ).rejects.toMatchObject({ code: "INVARIANT_VIOLATION" });

      expect(runtime.snapshot().configurations.length).toBe(before + 1);
      const health = await runtime.health.snapshot();
      expect(["HEALTHY", "DEGRADED"]).toContain(health.status);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects replacement cycles and preserves product boundary behavior", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-replacement-cycle-"));
    try {
      const runtime = await createGenesisProductRuntime({ rootDir });
      await registerFoundationAndProducts(runtime, ["product-1", "product-2", "product-3"]);

      await runtime.relationship.defineRelationship({
        productRelationshipId: "rel-1",
        tenantId: "tenant-a",
        sourceProductId: "product-1",
        targetProductId: "product-2",
        kind: "REPLACES",
        actor: actor(),
      });

      await runtime.relationship.defineRelationship({
        productRelationshipId: "rel-2",
        tenantId: "tenant-a",
        sourceProductId: "product-2",
        targetProductId: "product-3",
        kind: "REPLACES",
        actor: actor(),
      });

      const before = runtime.snapshot().productRelationships.length;
      await expect(
        runtime.relationship.defineRelationship({
          productRelationshipId: "rel-3",
          tenantId: "tenant-a",
          sourceProductId: "product-3",
          targetProductId: "product-1",
          kind: "REPLACES",
          actor: actor(),
        }),
      ).rejects.toMatchObject({ code: "INVARIANT_VIOLATION" });

      expect(runtime.snapshot().productRelationships.length).toBe(before);
      const rejection = runtime
        .snapshot()
        .audits.find((audit) => audit.eventType === "PRODUCT_RELATIONSHIP_REJECTED");
      expect(rejection).toBeDefined();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects persisted cyclic BOM state during recovery without destructive repair", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-recovery-bom-cycle-"));
    const stateFile = join(rootDir, "product", "product-state.v1.json");
    try {
      const state = createDefaultProductPersistedState();
      state.products.push(
        {
          productId: "product-a",
          tenantId: "tenant-a",
          productCode: "PA",
          versionIdentifier: "v1",
          productFamilyId: "pf-1",
          categoryId: "cat-1",
          displayName: "A",
          lifecycleState: "ACTIVE",
          metadata: {},
          attributes: [],
          createdAt: new Date().toISOString(),
          createdBy: "svc",
          updatedAt: new Date().toISOString(),
          updatedBy: "svc",
        },
        {
          productId: "product-b",
          tenantId: "tenant-a",
          productCode: "PB",
          versionIdentifier: "v1",
          productFamilyId: "pf-1",
          categoryId: "cat-1",
          displayName: "B",
          lifecycleState: "ACTIVE",
          metadata: {},
          attributes: [],
          createdAt: new Date().toISOString(),
          createdBy: "svc",
          updatedAt: new Date().toISOString(),
          updatedBy: "svc",
        },
      );
      state.billOfMaterialDefinitions.push(
        {
          billOfMaterialDefinitionId: "bom-a",
          tenantId: "tenant-a",
          productId: "product-a",
          components: [{ componentProductId: "product-b", quantity: 1 }],
          lifecycleState: "APPROVED",
          versionIdentifier: "v1",
        },
        {
          billOfMaterialDefinitionId: "bom-b",
          tenantId: "tenant-a",
          productId: "product-b",
          components: [{ componentProductId: "product-a", quantity: 1 }],
          lifecycleState: "APPROVED",
          versionIdentifier: "v1",
        },
      );

      await mkdir(join(rootDir, "product"), { recursive: true });
      const payload = JSON.stringify(state, null, 2);
      await writeFile(stateFile, payload, "utf8");

      await expect(createGenesisProductRuntime({ rootDir })).rejects.toMatchObject({ code: "INVARIANT_VIOLATION" });
      expect(await readFile(stateFile, "utf8")).toBe(payload);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("rejects persisted cyclic configuration state during recovery", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-recovery-config-cycle-"));
    const stateFile = join(rootDir, "product", "product-state.v1.json");
    try {
      const state = createDefaultProductPersistedState();
      state.products.push({
        productId: "product-a",
        tenantId: "tenant-a",
        productCode: "PA",
        versionIdentifier: "v1",
        productFamilyId: "pf-1",
        categoryId: "cat-1",
        displayName: "A",
        lifecycleState: "ACTIVE",
        metadata: {},
        attributes: [],
        createdAt: new Date().toISOString(),
        createdBy: "svc",
        updatedAt: new Date().toISOString(),
        updatedBy: "svc",
      });
      state.configurations.push({
        configurationId: "cfg-a",
        tenantId: "tenant-a",
        productId: "product-a",
        lifecycleState: "DRAFT",
        versionIdentifier: "v1",
        rules: [
          { configurationRuleId: "r1", expression: "rule:r2", severity: "ERROR" },
          { configurationRuleId: "r2", expression: "rule:r1", severity: "ERROR" },
        ],
      });

      await mkdir(join(rootDir, "product"), { recursive: true });
      await writeFile(stateFile, JSON.stringify(state, null, 2), "utf8");

      await expect(createGenesisProductRuntime({ rootDir })).rejects.toMatchObject({ code: "INVARIANT_VIOLATION" });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("captures audit and counters for cycle rejections and keeps Mission Control read-only", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-observability-cycle-"));
    const observations: Array<{ productTotal: number; status: string }> = [];
    try {
      const dependencies = createDefaultProductDependencies();
      dependencies.observers.register({
        observerId: "mission-control-test",
        async receiveObservation(input) {
          observations.push({ productTotal: input.metrics.productTotal, status: input.health.status });
        },
      });

      const runtime = await createGenesisProductRuntime({ rootDir, dependencies });
      await registerFoundationAndProducts(runtime, ["product-1"]);

      await expect(
        runtime.configuration.defineConfiguration({
          configurationId: "cfg-cycle",
          tenantId: "tenant-a",
          productId: "product-1",
          lifecycleState: "DRAFT",
          versionIdentifier: "v1",
          rules: [{ configurationRuleId: "r1", expression: "rule:r1", severity: "ERROR" }],
          actor: actor(),
        }),
      ).rejects.toMatchObject({ code: "INVARIANT_VIOLATION" });

      const beforeProducts = runtime.metrics.snapshot().productTotal;
      await runtime.publishMissionControlObservation();

      expect(runtime.metrics.snapshot().cycleRejectionCount).toBeGreaterThanOrEqual(1);
      expect(runtime.metrics.snapshot().invariantViolationCount).toBeGreaterThanOrEqual(1);
      expect(observations.length).toBe(1);
      expect(observations[0]?.productTotal).toBe(beforeProducts);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  it("maintains deterministic ordering after acyclic updates", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "gpdt-cert-restart-ordering-"));
    try {
      const runtimeA = await createGenesisProductRuntime({ rootDir });
      await registerFoundationAndProducts(runtimeA, ["product-b", "product-a"]);

      await runtimeA.bomDefinition.defineBom({
        billOfMaterialDefinitionId: "bom-a",
        tenantId: "tenant-a",
        productId: "product-a",
        components: [{ componentProductId: "product-b", quantity: 1 }],
        lifecycleState: "APPROVED",
        versionIdentifier: "v1",
        actor: actor(),
      });

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
