import { describe, expect, it } from "@jest/globals";
import { LifecycleStopError } from "@/platform/shared";
import {
  createDefaultInventoryRuntimeDependencies,
  createInventoryRuntime,
  getInventoryRuntimeSingleton,
  initializeInventoryRuntime,
  resetInventoryRuntimeForTests,
  type InventoryIntegrationAdapter,
  type InventoryLifecycleAdapter,
  type InventoryRuntimeAuditRecord,
  type InventoryRuntimeObservation,
  type InventoryRuntimeOptions,
  type InventoryRuntimeServiceRegistration,
} from "@/platform/inventory";

function createOptions(overrides: Partial<InventoryRuntimeOptions> = {}): InventoryRuntimeOptions {
  const audits: InventoryRuntimeAuditRecord[] = [];
  const observations: InventoryRuntimeObservation[] = [];
  const base = createDefaultInventoryRuntimeDependencies();

  return {
    runtimeId: "inventory-runtime-test",
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
    ...overrides,
  };
}

describe("GIDT-1001-S2 Inventory runtime composition", () => {
  it("initializes deterministically and reaches ready state", async () => {
    const runtime = await createInventoryRuntime(createOptions());

    const snapshot = runtime.snapshot();
    expect(snapshot.lifecycle).toBe("RUNNING");
    expect(snapshot.state.phase).toBe("READY");
    expect(snapshot.state.ready).toBe(true);
    expect(snapshot.state.trace).toEqual([
      "01.register-dependency-container",
      "02.register-provider-registry",
      "03.register-service-registry",
      "04.register-bounded-integration-adapters",
      "05.validate-required-registrations",
      "09.start-shared-runtime-lifecycle",
      "10.mark-runtime-ready",
    ]);
    expect(snapshot.state.providerIds).toEqual([
      "inventory.runtime.audit-sink.default",
      "inventory.runtime.clock.default",
      "inventory.runtime.identifier.default",
      "inventory.runtime.metadata.default",
      "inventory.runtime.observation-sink.default",
      "inventory.runtime.tenant-context.default",
    ]);
    expect(snapshot.state.serviceIds).toContain("inventory.runtime.platform-identifier");
    expect((runtime as unknown as { coordinator?: unknown }).coordinator).toBeUndefined();
    await runtime.stop();
  });

  it("rejects missing required providers before ready state", async () => {
    const options = createOptions();
    await expect(
      createInventoryRuntime({
        ...options,
        dependencies: {
          ...options.dependencies,
          observationSinkProvider: undefined as never,
        },
      }),
    ).rejects.toMatchObject({ code: "MISSING_REQUIRED_PROVIDER" });
  });

  it("rejects duplicate provider registration deterministically", async () => {
    const options = createOptions({
      providerRegistrationHooks: [
        ({ host, dependencies }) => {
          host.registerProvider(dependencies.clockProvider);
        },
      ],
    });

    await expect(createInventoryRuntime(options)).rejects.toMatchObject({ code: "DUPLICATE_PROVIDER" });
  });

  it("rejects duplicate service registration deterministically", async () => {
    const duplicate: InventoryRuntimeServiceRegistration = {
      serviceId: "inventory.runtime.platform-identifier",
      contract: "inventory.runtime.platform-identifier",
      description: "duplicate",
      value: "platform.inventory",
    };
    const options = createOptions({
      serviceRegistrationHooks: [
        ({ host }) => {
          host.registerService(duplicate);
        },
      ],
    });

    await expect(createInventoryRuntime(options)).rejects.toMatchObject({ code: "DUPLICATE_SERVICE_REGISTRATION" });
  });

  it("supports explicit singleton initialization and duplicate initialization rejection", async () => {
    await resetInventoryRuntimeForTests();
    const runtime = await initializeInventoryRuntime(createOptions());
    expect(getInventoryRuntimeSingleton()).toBe(runtime);
    await expect(initializeInventoryRuntime(createOptions())).rejects.toMatchObject({ code: "DUPLICATE_INITIALIZATION" });
    await resetInventoryRuntimeForTests();
  });

  it("allows clean singleton initialization after prior failure", async () => {
    await resetInventoryRuntimeForTests();
    await expect(
      initializeInventoryRuntime({
        ...createOptions(),
        integrationAdapters: [
          {
            adapterId: "broken-adapter",
            async register() {
              throw new Error("adapter failure");
            },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "INTEGRATION_REGISTRATION_FAILURE" });

    const runtime = await initializeInventoryRuntime(createOptions());
    expect(runtime.isReady()).toBe(true);
    await resetInventoryRuntimeForTests();
  });

  it("stays fail closed on partial initialization and exposes failure snapshot", async () => {
    const adapter: InventoryIntegrationAdapter = {
      adapterId: "failing-integration",
      async register() {
        throw new Error("integration failed");
      },
    };

    try {
      await createInventoryRuntime({
        ...createOptions(),
        integrationAdapters: [adapter],
      });
      throw new Error("expected runtime creation to fail");
    } catch (error) {
      expect(error).toMatchObject({ code: "INTEGRATION_REGISTRATION_FAILURE" });
      const snapshot = (error as { snapshot?: { state: { ready: boolean; phase: string; trace: string[] } } }).snapshot;
      expect(snapshot?.state.ready).toBe(false);
      expect(snapshot?.state.phase).toBe("FAILED");
      expect(snapshot?.state.trace).toContain("04.register-bounded-integration-adapters");
    }
  });

  it("registers lifecycle adapters deterministically and shuts down in reverse order", async () => {
    const order: string[] = [];
    const adapterA: InventoryLifecycleAdapter = {
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
    const adapterB: InventoryLifecycleAdapter = {
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

    const runtime = await createInventoryRuntime(createOptions({ lifecycleAdapters: [adapterA, adapterB] }));
    expect(order.slice(0, 2)).toEqual(["start-a", "start-b"]);
    await runtime.stop();
    expect(order).toEqual(["start-a", "start-b", "stop-b", "stop-a"]);
  });

  it("propagates lifecycle stop failures without swallowing them", async () => {
    const failingAdapter: InventoryLifecycleAdapter = {
      adapterId: "failing-stop",
      register({ lifecycle }) {
        lifecycle.onStop("a.failing-stop", async () => {
          throw new Error("stop failed");
        });
      },
    };

    const runtime = await createInventoryRuntime(createOptions({ lifecycleAdapters: [failingAdapter] }));
    await expect(runtime.stop()).rejects.toBeInstanceOf(LifecycleStopError);
  });

  it("supports explicit test reset and leaves no hidden business state", async () => {
    await resetInventoryRuntimeForTests();
    const runtime = await initializeInventoryRuntime(createOptions());
    expect(runtime.services.list().every((service) => service.serviceId.startsWith("inventory.runtime."))).toBe(true);
    await resetInventoryRuntimeForTests();
    expect(() => getInventoryRuntimeSingleton()).toThrow("inventory runtime has not been initialized");
  });
});
