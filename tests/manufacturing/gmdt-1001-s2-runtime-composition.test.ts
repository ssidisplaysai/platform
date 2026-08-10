import { describe, expect, it } from "@jest/globals";
import { LifecycleStopError } from "@/platform/shared";
import {
  createDefaultManufacturingRuntimeDependencies,
  createManufacturingRuntime,
  getManufacturingRuntime,
  initializeManufacturingRuntime,
  resetManufacturingRuntimeForTests,
  type ManufacturingIntegrationRegistration,
  type ManufacturingLifecycleAdapter,
  type ManufacturingProductIntegrationPort,
  type ManufacturingInventoryIntegrationPort,
  type ManufacturingRuntimeAuditRecord,
  type ManufacturingRuntimeObservation,
  type ManufacturingRuntimeOptions,
  type ManufacturingRuntimeServiceRegistration,
} from "@/platform/manufacturing";

function createProductPort(calls: { count: number }): ManufacturingProductIntegrationPort {
  return {
    async validateProductReference() {
      calls.count += 1;
      return { valid: true };
    },
    async validateVariantReference() {
      calls.count += 1;
      return { valid: true };
    },
    async validateProductVersionReference() {
      calls.count += 1;
      return { valid: true };
    },
    async validateBomReference() {
      calls.count += 1;
      return { valid: true };
    },
    async validateRoutingReference() {
      calls.count += 1;
      return { valid: true };
    },
    async validateConfigurationReference() {
      calls.count += 1;
      return { valid: true };
    },
  };
}

function createInventoryPort(calls: { count: number }): ManufacturingInventoryIntegrationPort {
  return {
    async queryAvailability() {
      calls.count += 1;
      return { valid: true };
    },
    async requestReservation() {
      calls.count += 1;
      return { accepted: true, referenceId: "reservation-1" };
    },
    async requestAllocation() {
      calls.count += 1;
      return { accepted: true, referenceId: "allocation-1" };
    },
    async releaseReservation() {
      calls.count += 1;
      return { accepted: true, referenceId: "release-res-1" };
    },
    async releaseAllocation() {
      calls.count += 1;
      return { accepted: true, referenceId: "release-alloc-1" };
    },
    async requestMaterialIssue() {
      calls.count += 1;
      return { accepted: true, referenceId: "issue-1" };
    },
    async requestMaterialReturn() {
      calls.count += 1;
      return { accepted: true, referenceId: "return-1" };
    },
    async requestFinishedGoodsReceipt() {
      calls.count += 1;
      return { accepted: true, referenceId: "receipt-1" };
    },
    async requestWriteOff() {
      calls.count += 1;
      return { accepted: true, referenceId: "writeoff-1" };
    },
    async validateInventoryMovement() {
      calls.count += 1;
      return { valid: true };
    },
    async validateLot() {
      calls.count += 1;
      return { valid: true };
    },
    async validateSerial() {
      calls.count += 1;
      return { valid: true };
    },
  };
}

function createOptions(overrides: Partial<ManufacturingRuntimeOptions> = {}): ManufacturingRuntimeOptions {
  const audits: ManufacturingRuntimeAuditRecord[] = [];
  const observations: ManufacturingRuntimeObservation[] = [];
  const productCalls = { count: 0 };
  const inventoryCalls = { count: 0 };
  const base = createDefaultManufacturingRuntimeDependencies();

  return {
    runtimeId: "manufacturing-runtime-test",
    dependencies: {
      ...base,
      auditSinkProvider: {
        ...base.auditSinkProvider,
        async recordAudit(record) {
          audits.push(record);
        },
      },
      observationSinkProvider: {
        ...base.observationSinkProvider,
        async publishObservation(observation) {
          observations.push(observation);
        },
      },
    },
    productIntegration: {
      integrationId: "product-port",
      port: createProductPort(productCalls),
    },
    inventoryIntegration: {
      integrationId: "inventory-port",
      port: createInventoryPort(inventoryCalls),
    },
    ...overrides,
  };
}

describe("GMDT-1001-S2 Manufacturing runtime composition", () => {
  it("constructs runtime deterministically and reaches ready state", async () => {
    const runtime = await createManufacturingRuntime(createOptions());

    const snapshot = runtime.snapshot();
    expect(snapshot.lifecycle).toBe("RUNNING");
    expect(snapshot.state.phase).toBe("READY");
    expect(snapshot.state.ready).toBe(true);
    expect(snapshot.state.trace).toEqual([
      "01.validate-manufacturing-runtime-options",
      "02.create-shared-runtime-host",
      "03.initialize-manufacturing-lifecycle-manager",
      "04.establish-manufacturing-dependency-container",
      "05.register-required-mechanical-providers",
      "06.register-runtime-level-service-tokens",
      "07.register-bounded-product-integration-port",
      "08.register-bounded-inventory-integration-port",
      "09.register-future-external-reference-integration-points",
      "09a.register-slice3-foundation-services",
      "09b.register-slice4-routing-operation-services",
      "09c.register-slice5-product-material-services",
      "09d.register-slice6-inventory-material-execution-services",
      "09e.register-slice7-production-output-result-services",
      "09f.register-slice8-resource-downtime-traceability-services",
      "09g.register-slice9-reference-validation-observability-services",
      "10.validate-required-registrations",
      "11.start-shared-lifecycle",
      "12.establish-manufacturing-readiness",
      "13.mark-runtime-ready",
    ]);
    expect(snapshot.state.serviceIds).toContain("manufacturing.runtime");
    expect(snapshot.state.serviceIds).toContain("manufacturing.integration.product-port");
    expect(snapshot.state.serviceIds).toContain("manufacturing.integration.inventory-port");
    await runtime.stop();
  });

  it("rejects invalid options and missing providers", async () => {
    await expect(createManufacturingRuntime(undefined as never)).rejects.toMatchObject({
      code: "INVALID_RUNTIME_OPTIONS",
    });

    const options = createOptions();
    await expect(
      createManufacturingRuntime({
        ...options,
        dependencies: {
          ...options.dependencies,
          tenantContextProvider: undefined as never,
        },
      }),
    ).rejects.toMatchObject({ code: "MISSING_REQUIRED_PROVIDER" });
  });

  it("registers required providers and rejects duplicates", async () => {
    const options = createOptions({
      providerRegistrationHooks: [
        ({ host, dependencies }) => {
          host.registerProvider(dependencies.clockProvider);
        },
      ],
    });

    await expect(createManufacturingRuntime(options)).rejects.toMatchObject({ code: "DUPLICATE_PROVIDER" });
  });

  it("registers runtime services deterministically and rejects duplicates", async () => {
    const duplicate: ManufacturingRuntimeServiceRegistration = {
      serviceId: "manufacturing.platform-identifier",
      contract: "manufacturing.platform-identifier",
      description: "duplicate",
      value: "platform.manufacturing",
    };

    await expect(
      createManufacturingRuntime(
        createOptions({
          serviceRegistrationHooks: [
            ({ host }) => {
              host.registerService(duplicate);
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_SERVICE_REGISTRATION" });
  });

  it("registers integration ports and rejects missing or duplicate required integrations", async () => {
    await expect(
      createManufacturingRuntime(
        createOptions({
          productIntegration: undefined,
        }),
      ),
    ).rejects.toMatchObject({ code: "MISSING_REQUIRED_INTEGRATION" });

    await expect(
      createManufacturingRuntime(
        createOptions({
          inventoryIntegration: undefined,
        }),
      ),
    ).rejects.toMatchObject({ code: "MISSING_REQUIRED_INTEGRATION" });

    await expect(
      createManufacturingRuntime(
        createOptions({
          integrationRegistrationHooks: [
            ({ registerIntegration }) => {
              registerIntegration({
                integrationId: "product-port-duplicate",
                integrationType: "PRODUCT",
                port: createProductPort({ count: 0 }),
              });
            },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: "DUPLICATE_INTEGRATION_REGISTRATION" });
  });

  it("keeps integration lookup deterministic and does not call foreign ports during startup", async () => {
    const productCalls = { count: 0 };
    const inventoryCalls = { count: 0 };
    const runtime = await createManufacturingRuntime(
      createOptions({
        productIntegration: {
          integrationId: "product-port",
          port: createProductPort(productCalls),
        },
        inventoryIntegration: {
          integrationId: "inventory-port",
          port: createInventoryPort(inventoryCalls),
        },
      }),
    );

    expect(productCalls.count).toBe(0);
    expect(inventoryCalls.count).toBe(0);
    expect(runtime.snapshot().state.integrationIds).toEqual(["INVENTORY:inventory-port", "PRODUCT:product-port"]);
    await runtime.stop();
  });

  it("supports explicit singleton lifecycle and duplicate initialization rejection", async () => {
    await resetManufacturingRuntimeForTests();
    const runtime = await initializeManufacturingRuntime(createOptions());
    expect(getManufacturingRuntime()).toBe(runtime);

    await expect(initializeManufacturingRuntime(createOptions())).rejects.toMatchObject({
      code: "DUPLICATE_INITIALIZATION",
    });
    await resetManufacturingRuntimeForTests();
  });

  it("does not poison singleton on failed initialization and allows clean retry", async () => {
    await resetManufacturingRuntimeForTests();

    await expect(
      initializeManufacturingRuntime(
        createOptions({
          productIntegration: {
            integrationId: "broken-product-port",
            port: {
              async validateProductReference() {
                return { valid: true };
              },
            } as never,
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "INTEGRATION_REGISTRATION_FAILURE" });

    const runtime = await initializeManufacturingRuntime(createOptions());
    expect(runtime.isReady()).toBe(true);
    await resetManufacturingRuntimeForTests();
  });

  it("starts lifecycle deterministically and stops in reverse order", async () => {
    const order: string[] = [];
    const adapterB: ManufacturingLifecycleAdapter = {
      adapterId: "b.adapter",
      register({ lifecycle }) {
        lifecycle.onStart("b.start", async () => {
          order.push("start-b");
        });
        lifecycle.onStop("b.stop", async () => {
          order.push("stop-b");
        });
      },
    };
    const adapterA: ManufacturingLifecycleAdapter = {
      adapterId: "a.adapter",
      register({ lifecycle }) {
        lifecycle.onStart("a.start", async () => {
          order.push("start-a");
        });
        lifecycle.onStop("a.stop", async () => {
          order.push("stop-a");
        });
      },
    };

    const runtime = await createManufacturingRuntime(createOptions({ lifecycleAdapters: [adapterB, adapterA] }));
    expect(order.slice(0, 2)).toEqual(["start-a", "start-b"]);
    await runtime.stop();
    expect(order).toEqual(["start-a", "start-b", "stop-b", "stop-a"]);
  });

  it("propagates lifecycle stop failure and rejects unsupported shutdown state", async () => {
    const failingAdapter: ManufacturingLifecycleAdapter = {
      adapterId: "failing-stop",
      register({ lifecycle }) {
        lifecycle.onStop("a.failing-stop", async () => {
          throw new Error("stop failed");
        });
      },
    };

    const runtime = await createManufacturingRuntime(createOptions({ lifecycleAdapters: [failingAdapter] }));
    await expect(runtime.stop()).rejects.toBeInstanceOf(LifecycleStopError);
    await expect(runtime.stop()).rejects.toMatchObject({ code: "INVALID_RUNTIME_STATE" });
  });

  it("does not register forbidden future services or persistence tokens", async () => {
    const runtime = await createManufacturingRuntime(createOptions());
    const ids = runtime.services.list().map((service) => service.serviceId);

    expect(ids).toContain("manufacturing.service.work-order");
    expect(ids).toContain("manufacturing.service.production-run");
    expect(ids).toContain("manufacturing.service.production-batch");
    expect(ids).toContain("manufacturing.query.foundation");
    expect(ids).toContain("manufacturing.service.execution-routing");
    expect(ids).toContain("manufacturing.service.operation-execution");
    expect(ids).toContain("manufacturing.query.routing");
    expect(ids).toContain("manufacturing.service.product-reference");
    expect(ids).toContain("manufacturing.service.material-requirement");
    expect(ids).toContain("manufacturing.query.material");
    expect(ids).toContain("manufacturing.service.production-output");
    expect(ids).toContain("manufacturing.service.scrap");
    expect(ids).toContain("manufacturing.service.rework");
    expect(ids).toContain("manufacturing.service.yield");
    expect(ids).toContain("manufacturing.service.wip");
    expect(ids).toContain("manufacturing.query.production-result");
    expect(ids).toContain("manufacturing.service.work-center");
    expect(ids).toContain("manufacturing.service.production-cell");
    expect(ids).toContain("manufacturing.service.machine-assignment");
    expect(ids).toContain("manufacturing.service.tool-assignment");
    expect(ids).toContain("manufacturing.service.labor-assignment");
    expect(ids).toContain("manufacturing.service.resource-readiness");
    expect(ids).toContain("manufacturing.service.downtime");
    expect(ids).toContain("manufacturing.service.execution-exception");
    expect(ids).toContain("manufacturing.service.traceability");
    expect(ids).toContain("manufacturing.query.resource");
    expect(ids).toContain("manufacturing.query.traceability");
    expect(ids).toContain("manufacturing.service.reference-validation");
    expect(ids).toContain("manufacturing.service.work-order-reference-validator");
    expect(ids).toContain("manufacturing.service.audit");
    expect(ids).toContain("manufacturing.service.metrics");
    expect(ids).toContain("manufacturing.service.health");
    expect(ids).toContain("manufacturing.service.observation-publisher");
    expect(ids).toContain("manufacturing.query.observation");
    expect(ids.some((serviceId) => serviceId.includes("persistence"))).toBe(false);
    expect((runtime as unknown as { persistence?: unknown }).persistence).toBeUndefined();
    await runtime.stop();
  });

  it("registers future external-reference validator ports deterministically", async () => {
    const runtime = await createManufacturingRuntime(
      createOptions({
        externalReferenceIntegrations: [
          {
            integrationId: "external-validator-b",
            integrationType: "EXTERNAL_REFERENCE_VALIDATOR",
            externalReferenceFamilies: ["KNOWLEDGE"],
            port: {
              async validateExternalReference() {
                return { valid: true };
              },
            },
          },
          {
            integrationId: "external-validator-a",
            integrationType: "EXTERNAL_REFERENCE_VALIDATOR",
            externalReferenceFamilies: ["DOCUMENT"],
            port: {
              async validateExternalReference() {
                return { valid: true };
              },
            },
          },
        ] as readonly ManufacturingIntegrationRegistration[],
      }),
    );

    expect(runtime.snapshot().state.integrationIds).toEqual([
      "EXTERNAL_REFERENCE_VALIDATOR:external-validator-a",
      "EXTERNAL_REFERENCE_VALIDATOR:external-validator-b",
      "INVENTORY:inventory-port",
      "PRODUCT:product-port",
    ]);
    await runtime.stop();
  });
});
