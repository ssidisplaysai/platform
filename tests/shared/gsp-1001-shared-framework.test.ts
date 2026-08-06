import {
  createInMemoryStore,
  createSchemaValidator,
  InvariantEngine,
  LifecycleManager,
  ObservationPublisher,
  ObserverRegistry,
  PersistenceCoordinator,
  ProviderRegistry,
  RecoveryCoordinator,
  RuntimeHost,
  ServiceRegistry,
} from "../../src/platform/shared";

describe("GSP-1001 shared framework", () => {
  test("service and provider registries enforce uniqueness", async () => {
    const services = new ServiceRegistry<{ serviceId: string }>();
    services.register({ serviceId: "metrics" });
    expect(services.list()).toHaveLength(1);
    expect(() => services.register({ serviceId: "metrics" })).toThrow("service registration conflict");

    const providers = new ProviderRegistry();
    providers.register({
      providerId: "foundation",
      capability: "registry",
      async inspectHealth() {
        return { status: "HEALTHY" as const, detail: "ok" };
      },
    });
    expect(providers.listProviders()).toHaveLength(1);
    expect(() =>
      providers.register({
        providerId: "foundation",
        capability: "registry",
        async inspectHealth() {
          return { status: "HEALTHY" as const, detail: "ok" };
        },
      }),
    ).toThrow("provider registration conflict");
  });

  test("lifecycle manager starts deterministically and fails closed", async () => {
    const lifecycle = new LifecycleManager();
    const order: string[] = [];

    lifecycle.onBeforeStart("b", async () => {
      order.push("before-b");
    });
    lifecycle.onBeforeStart("a", async () => {
      order.push("before-a");
    });
    lifecycle.onStart("z", async () => {
      order.push("start-z");
    });

    await lifecycle.start();
    expect(order).toEqual(["before-a", "before-b", "start-z"]);
    expect(lifecycle.getState()).toBe("RUNNING");

    const failing = new LifecycleManager();
    failing.onStart("a", async () => {
      throw new Error("boom");
    });

    await expect(failing.start()).rejects.toThrow("lifecycle start failed");
    expect(failing.getState()).toBe("FAILED");
  });

  test("runtime host composes lifecycle and captures snapshot", async () => {
    const host = new RuntimeHost<{ ready: boolean }, { serviceId: string }>({
      runtimeId: "shared-runtime",
      initialState: { ready: false },
    });

    host.lifecycle.onStart("ready", async () => {
      host.setState({ ready: true });
    });

    await host.start();
    const snapshot = host.snapshot();
    expect(host.getRuntimeId()).toBe("shared-runtime");
    expect(snapshot.lifecycle).toBe("RUNNING");
    expect(snapshot.state.ready).toBe(true);
  });

  test("persistence coordinator validates, recovers, and mutates", async () => {
    type Payload = { count: number };
    const initial = { schemaVersion: "1.0.0" as const, payload: { count: 1 } };
    const store = createInMemoryStore<Payload>(initial);
    const validator = createSchemaValidator<Payload>("1.0.0");
    const recovery = new RecoveryCoordinator<Payload>(() => initial, (state) => ({
      ...state,
      payload: { count: state.payload.count + 1 },
    }));

    const coordinator = new PersistenceCoordinator<Payload>({ store, validator, recovery });
    await coordinator.load();
    expect(coordinator.snapshot().payload.count).toBe(2);

    await coordinator.mutate((payload) => {
      payload.count += 3;
    });

    expect(coordinator.snapshot().payload.count).toBe(5);
  });

  test("invariant engine aggregates deterministic validation failures", async () => {
    const engine = new InvariantEngine<{ code: string; version: string }>();
    engine.register({
      ruleId: "b",
      validate(input) {
        return input.version ? [] : ["version required"];
      },
    });
    engine.register({
      ruleId: "a",
      validate(input) {
        return input.code.trim().length > 0 ? [] : ["code required"];
      },
    });

    expect(engine.evaluate({ code: "", version: "" })).toEqual(["code required", "version required"]);
    expect(() => engine.assert({ code: "", version: "1.0.0" })).toThrow("invariant violation");
  });

  test("mission control observation publisher fan-outs to observers", async () => {
    const registry = new ObserverRegistry<{ value: number }>();
    const received: number[] = [];

    registry.register({
      observerId: "obs-b",
      async receiveObservation(observation) {
        received.push(observation.value + 1);
      },
    });
    registry.register({
      observerId: "obs-a",
      async receiveObservation(observation) {
        received.push(observation.value);
      },
    });

    const publisher = new ObservationPublisher(registry);
    await publisher.publish({ value: 10 });

    expect(received).toEqual([10, 11]);
  });
});
