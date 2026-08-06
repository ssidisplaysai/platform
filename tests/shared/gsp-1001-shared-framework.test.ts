import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertArray,
  assertObject,
  assertRequiredString,
  assertVersion,
  AuditService,
  compareDeterministicStrings,
  compareSemverVersions,
  deterministicPairs,
  deterministicSort,
  deterministicUnique,
  createInMemoryStore,
  createSchemaValidator,
  FileStore,
  HealthService,
  InvariantEngine,
  LifecycleManager,
  MetricsService,
  normalizeIdentifier,
  normalizeJson,
  normalizeWhitespace,
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

  test("persistence coordinator fails closed before load", async () => {
    type Payload = { count: number };
    const initial = { schemaVersion: "1.0.0" as const, payload: { count: 1 } };
    const coordinator = new PersistenceCoordinator<Payload>({
      store: createInMemoryStore(initial),
      validator: createSchemaValidator<Payload>("1.0.0"),
      recovery: new RecoveryCoordinator<Payload>(() => initial),
    });

    expect(() => coordinator.snapshot()).toThrow("persistence state not loaded");
    await expect(
      coordinator.mutate((payload) => {
        payload.count += 1;
      }),
    ).rejects.toThrow("persistence state not loaded");
  });

  test("persistence coordinator rejects unsupported schema version", async () => {
    type Payload = { count: number };
    const initial = { schemaVersion: "2.0.0" as const, payload: { count: 1 } };
    const coordinator = new PersistenceCoordinator<Payload>({
      store: createInMemoryStore(initial),
      validator: createSchemaValidator<Payload>("1.0.0"),
      recovery: new RecoveryCoordinator<Payload>(() => ({ schemaVersion: "1.0.0", payload: { count: 0 } })),
    });

    await expect(coordinator.load()).rejects.toThrow("unsupported schema version");
  });

  test("persistence coordinator surfaces recovery failure", async () => {
    type Payload = { count: number };
    const initial = { schemaVersion: "1.0.0" as const, payload: { count: 1 } };
    const coordinator = new PersistenceCoordinator<Payload>({
      store: createInMemoryStore(initial),
      validator: createSchemaValidator<Payload>("1.0.0"),
      recovery: new RecoveryCoordinator<Payload>(() => initial, () => {
        throw new Error("recovery failed");
      }),
    });

    await expect(coordinator.load()).rejects.toThrow("recovery failed");
  });

  test("persistence load flow is deterministic", async () => {
    type Payload = { count: number };
    const events: string[] = [];
    const initial = { schemaVersion: "1.0.0" as const, payload: { count: 1 } };
    const store = {
      async load() {
        events.push("load");
        return structuredClone(initial);
      },
      async save() {
        events.push("save");
      },
    };

    const validator = {
      validateOrThrow() {
        events.push("validate");
      },
    };

    const recovery = new RecoveryCoordinator<Payload>(() => initial, (state) => {
      events.push("recover");
      return state;
    });

    const coordinator = new PersistenceCoordinator<Payload>({ store, validator, recovery });
    await coordinator.load();
    expect(events).toEqual(["load", "recover", "validate", "save"]);
  });

  test("file store rejects malformed JSON", async () => {
    type Payload = { count: number };
    const rootDir = await mkdtemp(join(tmpdir(), "gsp-1001-file-store-"));
    const namespace = "shared";
    const fileName = "state.json";
    const filePath = join(rootDir, namespace, fileName);

    try {
      await mkdir(join(rootDir, namespace), { recursive: true });
      await writeFile(filePath, "{bad-json", "utf8");
      const store = new FileStore<Payload>({
        rootDir,
        namespace,
        fileName,
        createDefaultState() {
          return { schemaVersion: "1.0.0", payload: { count: 0 } };
        },
        normalize(raw) {
          return raw as { schemaVersion: "1.0.0"; payload: Payload };
        },
      });

      await expect(store.load()).rejects.toThrow("persisted state is not valid JSON");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
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

  test("observer registry rejects duplicate observers", async () => {
    const registry = new ObserverRegistry<{ value: number }>();
    registry.register({
      observerId: "obs-a",
      async receiveObservation() {},
    });

    expect(() =>
      registry.register({
        observerId: "obs-a",
        async receiveObservation() {},
      }),
    ).toThrow("observer registration conflict");
  });

  test("observation publisher isolates observer failures and reports publish failure", async () => {
    const registry = new ObserverRegistry<{ value: number }>();
    const received: string[] = [];

    registry.register({
      observerId: "obs-a",
      async receiveObservation() {
        received.push("obs-a");
        throw new Error("observer failed");
      },
    });

    registry.register({
      observerId: "obs-b",
      async receiveObservation() {
        received.push("obs-b");
      },
    });

    const publisher = new ObservationPublisher(registry);
    await expect(publisher.publish({ value: 1 })).rejects.toThrow("observation publish failed");
    expect(received).toEqual(["obs-a", "obs-b"]);
  });

  test("observation publisher does not expose mutable payload reference", async () => {
    const registry = new ObserverRegistry<{ value: number }>();
    registry.register({
      observerId: "obs-a",
      async receiveObservation(observation) {
        observation.value = 99;
      },
    });

    const publisher = new ObservationPublisher(registry);
    const payload = { value: 1 };
    await publisher.publish(payload);
    expect(payload.value).toBe(1);
  });

  test("health service reports deterministic ordering and status", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-05T00:00:00.000Z"));
    const health = new HealthService();
    health.register("b", async () => ({ name: "b", status: "WARN", detail: "warn" }));
    health.register("a", async () => ({ name: "a", status: "PASS", detail: "ok" }));

    const snapshot = await health.snapshot();
    expect(snapshot.generatedAt).toBe("2026-08-05T00:00:00.000Z");
    expect(snapshot.status).toBe("DEGRADED");
    expect(snapshot.checks.map((check) => check.name)).toEqual(["a", "b"]);
    jest.useRealTimers();
  });

  test("metrics service counters are stable and snapshot is isolated", async () => {
    const metrics = new MetricsService();
    metrics.increment("events");
    metrics.increment("events", 2);
    metrics.set("errors", 5);

    const snapshot = metrics.snapshot();
    expect(snapshot).toEqual({ events: 3, errors: 5 });

    snapshot.events = 100;
    expect(metrics.snapshot().events).toBe(3);
  });

  test("audit service timestamps are stable and list is immutable", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-08-05T01:00:00.000Z"));
    const audit = new AuditService();
    audit.append({
      eventType: "TEST_EVENT",
      actor: { actorId: "tester", occurredAt: "2026-08-05T01:00:00.000Z" },
      message: "created",
    });

    const entries = audit.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].recordedAt).toBe("2026-08-05T01:00:00.000Z");
    expect(entries[0].auditId.startsWith("shared_audit_")).toBe(true);

    entries[0].message = "mutated";
    expect(audit.list()[0].message).toBe("created");
    jest.useRealTimers();
  });

  test("version utility validates and compares semantic versions deterministically", async () => {
    expect(compareSemverVersions("1.2.0", "1.2.1")).toBeLessThan(0);
    expect(compareSemverVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareSemverVersions("1.0.0-alpha", "1.0.0")).toBeLessThan(0);
    expect(compareSemverVersions("1.0.0-alpha.1", "1.0.0-alpha.beta")).toBeLessThan(0);
    expect(compareSemverVersions("1.0.0-beta.2", "1.0.0-beta.11")).toBeLessThan(0);
    expect(compareSemverVersions("1.0.0-rc.1", "1.0.0")).toBeLessThan(0);
    expect(compareSemverVersions("1.0.0", "1.0.0")).toBe(0);

    expect(() => assertVersion("1.2.3-alpha", "runtime")).not.toThrow();
    expect(() => assertVersion("1.2", "runtime")).toThrow("invalid runtime version");
    expect(() => compareSemverVersions("1.0", "1.0.0")).toThrow("invalid semantic version comparison");
  });

  test("normalization helpers are deterministic and explicit about lossy transforms", async () => {
    expect(normalizeIdentifier("  AbC-123  ")).toBe("abc-123");
    expect(normalizeWhitespace(" a\n  b\t c ")).toBe("a b c");
    expect(normalizeJson({ value: 1, nested: { x: true } })).toEqual({ value: 1, nested: { x: true } });
  });

  test("invariant engine preserves deterministic ordering with duplicate rule ids", async () => {
    const engine = new InvariantEngine<{ value: string }>();
    engine.register({
      ruleId: "dup",
      validate() {
        return ["first"];
      },
    });
    engine.register({
      ruleId: "dup",
      validate() {
        return ["second"];
      },
    });

    expect(engine.evaluate({ value: "x" })).toEqual(["first", "second"]);
  });

  test("common validators fail explicitly on negative paths", async () => {
    expect(() => assertRequiredString("", "name")).toThrow("required string missing: name");
    expect(() => assertRequiredString(1, "name")).toThrow("required string missing: name");
    expect(() => assertArray({}, "items")).toThrow("required array missing: items");
    expect(() => assertObject([], "item")).toThrow("required object missing: item");
    expect(() => assertObject(null, "item")).toThrow("required object missing: item");
  });

  test("deterministic comparator is locale-independent and stable", async () => {
    expect(compareDeterministicStrings("a", "a")).toBe(0);
    expect(compareDeterministicStrings("A", "a")).toBeLessThan(0);
    expect(compareDeterministicStrings("a", "b")).toBeLessThan(0);
    expect(compareDeterministicStrings("z", "aa")).toBeGreaterThan(0);
    expect(compareDeterministicStrings("v10", "v2")).toBeLessThan(0);
    expect(compareDeterministicStrings("delta", "\u00e9clair")).toBeLessThan(0);

    const values = ["v2", "v10", "Alpha", "alpha", "\u00e9clair", "delta"];
    const first = deterministicUnique(values);
    const second = deterministicUnique(values);
    expect(second).toEqual(first);
    expect(values).toEqual(["v2", "v10", "Alpha", "alpha", "\u00e9clair", "delta"]);
  });

  test("deterministic utilities preserve caller-owned arrays and produce stable ordering", async () => {
    const names = ["b", "A", "a", "10", "2"];
    const sorted = deterministicSort(names, (value) => value);
    expect(sorted).toEqual(["10", "2", "A", "a", "b"]);
    expect(names).toEqual(["b", "A", "a", "10", "2"]);

    const unique = deterministicUnique(["b", "A", "b", "2", "10"]);
    expect(unique).toEqual(["10", "2", "A", "b"]);

    const pairs = deterministicPairs({ b: 2, A: 1, a: 3 });
    expect(pairs).toEqual([
      ["A", 1],
      ["a", 3],
      ["b", 2],
    ]);
  });

  test("lifecycle manager stop runs reverse deterministic order", async () => {
    const lifecycle = new LifecycleManager();
    const order: string[] = [];

    lifecycle.onStart("a", async () => {
      order.push("start-a");
    });
    lifecycle.onStop("a", async () => {
      order.push("stop-a");
    });
    lifecycle.onStop("c", async () => {
      order.push("stop-c");
    });
    lifecycle.onStop("b", async () => {
      order.push("stop-b");
    });

    await lifecycle.start();
    await lifecycle.stop();

    expect(order).toEqual(["start-a", "stop-c", "stop-b", "stop-a"]);
    expect(lifecycle.getState()).toBe("STOPPED");
  });

  test("lifecycle manager stop before start is rejected with explicit transition error", async () => {
    const lifecycle = new LifecycleManager();

    await expect(lifecycle.stop()).rejects.toMatchObject({
      name: "LifecycleStopError",
      code: "INVALID_LIFECYCLE_TRANSITION",
    });
    expect(lifecycle.getState()).toBe("CREATED");
  });

  test("lifecycle manager repeated stop is deterministic no-op", async () => {
    const lifecycle = new LifecycleManager();
    let stops = 0;

    lifecycle.onStart("ready", async () => {});
    lifecycle.onStop("cleanup", async () => {
      stops += 1;
    });

    await lifecycle.start();
    await lifecycle.stop();
    await lifecycle.stop();

    expect(stops).toBe(1);
    expect(lifecycle.getState()).toBe("STOPPED");
  });

  test("lifecycle manager stop failure does not skip remaining cleanup", async () => {
    const lifecycle = new LifecycleManager();
    const events: string[] = [];

    lifecycle.onStart("ready", async () => {});
    lifecycle.onStop("a", async () => {
      events.push("a");
    });
    lifecycle.onStop("c", async () => {
      events.push("c");
      throw new Error("failed-c");
    });
    lifecycle.onStop("b", async () => {
      events.push("b");
    });

    await lifecycle.start();
    await expect(lifecycle.stop()).rejects.toMatchObject({
      name: "LifecycleStopError",
      code: "COMPONENT_STOP_FAILURE",
      failures: [{ stepId: "c", reason: "failed-c" }],
    });

    expect(events).toEqual(["c", "b", "a"]);
    expect(lifecycle.getState()).toBe("FAILED");
  });

  test("lifecycle manager aggregates multiple stop failures deterministically", async () => {
    const lifecycle = new LifecycleManager();

    lifecycle.onStart("ready", async () => {});
    lifecycle.onStop("a", async () => {
      throw new Error("failed-a");
    });
    lifecycle.onStop("c", async () => {
      throw new Error("failed-c");
    });
    lifecycle.onStop("b", async () => {});

    await lifecycle.start();

    await expect(lifecycle.stop()).rejects.toMatchObject({
      name: "LifecycleStopError",
      code: "MULTIPLE_COMPONENT_STOP_FAILURES",
      failures: [
        { stepId: "c", reason: "failed-c" },
        { stepId: "a", reason: "failed-a" },
      ],
    });
    expect(lifecycle.getState()).toBe("FAILED");
  });

  test("lifecycle manager supports clean restart after successful stop", async () => {
    const lifecycle = new LifecycleManager();
    let starts = 0;
    let stops = 0;

    lifecycle.onStart("ready", async () => {
      starts += 1;
    });
    lifecycle.onStop("cleanup", async () => {
      stops += 1;
    });

    await lifecycle.start();
    await lifecycle.stop();
    await lifecycle.start();

    expect(starts).toBe(2);
    expect(stops).toBe(1);
    expect(lifecycle.getState()).toBe("RUNNING");
  });

  test("normalization json handling is deterministic and explicit for supported and unsupported values", async () => {
    const input = {
      b: 2,
      a: 1,
      nested: { y: true, x: false },
      list: [1, "x", { ok: true }],
    };
    const copy = structuredClone(input);
    const normalized = normalizeJson(input);

    expect(normalized).toEqual(input);
    expect(input).toEqual(copy);
    expect(Object.keys(normalized)).toEqual(["b", "a", "nested", "list"]);
    expect(Object.keys(normalized.nested)).toEqual(["y", "x"]);

    const lossy = normalizeJson({
      keep: 1,
      removeUndefined: undefined,
      removeFunction: () => "x",
      removeSymbol: Symbol("sym"),
      map: new Map([["a", 1]]),
      set: new Set([1]),
      date: new Date("2026-08-05T00:00:00.000Z"),
    } as unknown as Record<string, unknown>);

    expect(lossy).toEqual({
      keep: 1,
      map: {},
      set: {},
      date: "2026-08-05T00:00:00.000Z",
    });
    expect("removeUndefined" in lossy).toBe(false);
    expect("removeFunction" in lossy).toBe(false);
    expect("removeSymbol" in lossy).toBe(false);

    expect(() => normalizeJson({ value: 1n })).toThrow();

    const circular: Record<string, unknown> = { value: 1 };
    circular.self = circular;
    expect(() => normalizeJson(circular)).toThrow();
  });
});
