import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import { CompilerCore } from "../../../src/compiler/core/CompilerCore";
import type { EnterpriseRuntimeIR } from "../../../src/compiler/runtime/EnterpriseRuntimeIR";
import { EnterpriseHost } from "../../../src/runtime/host";

function fixturePath(...segments: string[]): string {
  return resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures", ...segments);
}

let cachedRuntimeIR: EnterpriseRuntimeIR | undefined;

async function getRuntimeIR(): Promise<EnterpriseRuntimeIR> {
  if (cachedRuntimeIR) {
    return cachedRuntimeIR;
  }

  const core = new CompilerCore();
  const result = await core.compile({
    source: {
      id: "runtime-host-fixture",
      sourceType: "markdown",
      origin: fixturePath("sample.md"),
    },
  }, "runtime-host-fixture-session");

  if (!result.enterpriseRuntimeIR) {
    throw new Error("Fixture compile did not produce enterpriseRuntimeIR");
  }

  cachedRuntimeIR = result.enterpriseRuntimeIR;
  return cachedRuntimeIR;
}

function createHost(): EnterpriseHost {
  const host = new EnterpriseHost({
    hostId: "genesis-host-001",
    version: "1.0.0",
    defaultEnvironmentId: "prod",
    defaultProfileId: "standard",
  });

  host.bootstrap(
    {
      id: "prod",
      displayName: "Production",
      region: "us-east-1",
      variables: { STAGE: "prod" },
    },
    {
      id: "standard",
      displayName: "Standard",
      limits: { cpu: 4, memoryGb: 16 },
      featureFlags: { orchestration: true },
    },
  );

  host.registerEnvironment({
    id: "dr",
    displayName: "Disaster Recovery",
    region: "us-west-2",
    variables: { STAGE: "dr" },
  });

  host.registerProfile({
    id: "high-availability",
    displayName: "High Availability",
    limits: { cpu: 8, memoryGb: 32 },
    featureFlags: { orchestration: true, crashRecovery: true },
  });

  return host;
}

test("1 host bootstrap sets running state", () => {
  const host = createHost();
  assert.equal(host.snapshot().hostState, "Running");
});

test("2 runtime instance creation is deterministic", async () => {
  const host = createHost();
  const ir = await getRuntimeIR();
  const first = host.createRuntimeInstance(ir);
  const second = host.createRuntimeInstance(ir);
  assert.equal(first, "runtime-instance-0001");
  assert.equal(second, "runtime-instance-0002");
});

test("3 activate runtime transitions to Running", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  const summary = host.activateRuntime(instance);
  assert.equal(summary.state, "Running");
});

test("4 deactivate runtime transitions to Stopped", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  const summary = host.deactivateRuntime(instance);
  assert.equal(summary.state, "Stopped");
});

test("5 restart runtime returns Running", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  const summary = host.restartRuntime(instance);
  assert.equal(summary.state, "Running");
});

test("6 suspend and resume runtime", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  assert.equal(host.suspendRuntime(instance).state, "Suspended");
  assert.equal(host.resumeRuntime(instance).state, "Running");
});

test("7 dispose runtime", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  assert.equal(host.disposeRuntime(instance).state, "Disposed");
});

test("8 host orchestrate startup handles multiple runtimes", async () => {
  const host = createHost();
  const ir = await getRuntimeIR();
  const first = host.createRuntimeInstance(ir);
  const second = host.createRuntimeInstance(ir, { environmentId: "dr", profileId: "high-availability" });
  const started = host.orchestrateStartup([second, first]);
  assert.equal(started.length, 2);
  assert.equal(started[0].instanceId, first);
  assert.equal(started[1].instanceId, second);
});

test("9 host orchestrate shutdown handles multiple runtimes", async () => {
  const host = createHost();
  const ir = await getRuntimeIR();
  const first = host.createRuntimeInstance(ir);
  const second = host.createRuntimeInstance(ir);
  host.orchestrateStartup();
  const stopped = host.orchestrateShutdown([second, first]);
  assert.equal(stopped.length, 2);
  assert.equal(stopped.every((runtime) => runtime.state === "Stopped"), true);
});

test("10 runtime crash and recovery", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  host.crashRuntime(instance, "simulated-crash");
  const recovered = host.recoverRuntime(instance);
  assert.equal(recovered.state, "Recovered");
});

test("11 supervision recovers failed runtimes", async () => {
  const host = createHost();
  const ir = await getRuntimeIR();
  const first = host.createRuntimeInstance(ir);
  const second = host.createRuntimeInstance(ir);
  host.activateRuntime(first);
  host.activateRuntime(second);
  host.crashRuntime(first, "boom");
  host.crashRuntime(second, "boom");
  const recovered = host.superviseRuntimes();
  assert.equal(recovered.length, 2);
  assert.equal(recovered.every((runtime) => runtime.state === "Recovered"), true);
});

test("12 runtime persistence and restoration", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  const persisted = host.persistRuntimeState(instance);
  assert.equal(persisted.revision, 1);
  const restored = host.restoreRuntimeState(instance);
  assert.equal(restored.persistedRevision, 1);
});

test("13 environment and profile selection is preserved", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR(), {
    environmentId: "dr",
    profileId: "high-availability",
  });
  const running = host.activateRuntime(instance);
  assert.equal(running.environmentId, "dr");
  assert.equal(running.profileId, "high-availability");
});

test("14 host snapshot is immutable", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  const snapshot = host.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.telemetry), true);
  assert.equal(Object.isFrozen(snapshot.runtimes), true);
});

test("15 deterministic snapshot for repeated operations", async () => {
  const ir = await getRuntimeIR();

  const firstHost = createHost();
  const firstInstance = firstHost.createRuntimeInstance(ir);
  firstHost.activateRuntime(firstInstance);
  firstHost.persistRuntimeState(firstInstance);
  const firstSnapshot = firstHost.snapshot();

  const secondHost = createHost();
  const secondInstance = secondHost.createRuntimeInstance(ir);
  secondHost.activateRuntime(secondInstance);
  secondHost.persistRuntimeState(secondInstance);
  const secondSnapshot = secondHost.snapshot();

  assert.deepEqual(firstSnapshot.runtimes, secondSnapshot.runtimes);
  assert.deepEqual(firstSnapshot.telemetry, secondSnapshot.telemetry);
});

test("16 diagnostics capture crashes", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  host.crashRuntime(instance, "diagnostic-crash");
  const errors = host.snapshot().diagnostics.filter((entry) => entry.level === "Error");
  assert.equal(errors.length > 0, true);
});

test("17 telemetry tracks restart and recovery", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  host.restartRuntime(instance);
  host.crashRuntime(instance, "recover-me");
  host.recoverRuntime(instance);
  const counters = host.snapshot().telemetry.counters;
  assert.equal((counters["runtime.restart"] ?? 0) > 0, true);
  assert.equal((counters["runtime.recovered"] ?? 0) > 0, true);
});

test("18 health aggregation is bounded", async () => {
  const host = createHost();
  const ir = await getRuntimeIR();
  host.activateRuntime(host.createRuntimeInstance(ir));
  host.activateRuntime(host.createRuntimeInstance(ir));
  const health = host.snapshot().telemetry.metrics.aggregateHealthScore;
  assert.equal(health >= 0, true);
  assert.equal(health <= 100, true);
});

test("19 event sequencing is monotonic", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  host.suspendRuntime(instance);
  host.resumeRuntime(instance);
  const events = host.snapshot().events.map((event) => event.sequence);
  const sorted = [...events].sort((a, b) => a - b);
  assert.deepEqual(events, sorted);
});

test("20 host shutdown moves to Stopped", () => {
  const host = createHost();
  const snapshot = host.shutdownHost();
  assert.equal(snapshot.hostState, "Stopped");
});

test("21 host dispose moves to Disposed", () => {
  const host = createHost();
  const snapshot = host.disposeHost();
  assert.equal(snapshot.hostState, "Disposed");
});

test("22 isolate runtime instances by namespace", async () => {
  const host = createHost();
  const ir = await getRuntimeIR();
  const first = host.createRuntimeInstance(ir);
  const second = host.createRuntimeInstance(ir, { environmentId: "dr", profileId: "high-availability" });
  const firstRunning = host.activateRuntime(first);
  const secondRunning = host.activateRuntime(second);
  assert.equal(firstRunning.isolation.namespace === secondRunning.isolation.namespace, false);
});

test("23 unknown environment fails creation", async () => {
  const host = createHost();
  await assert.rejects(async () => {
    host.createRuntimeInstance(await getRuntimeIR(), { environmentId: "missing" });
  });
});

test("24 unknown profile fails creation", async () => {
  const host = createHost();
  await assert.rejects(async () => {
    host.createRuntimeInstance(await getRuntimeIR(), { profileId: "missing" });
  });
});

test("25 duplicate environment registration fails", () => {
  const host = createHost();
  assert.throws(() => {
    host.registerEnvironment({
      id: "prod",
      displayName: "Dup",
      region: "us-east-1",
      variables: { STAGE: "dup" },
    });
  });
});

test("26 duplicate profile registration fails", () => {
  const host = createHost();
  assert.throws(() => {
    host.registerProfile({
      id: "standard",
      displayName: "Dup",
      limits: { cpu: 1, memoryGb: 1 },
      featureFlags: { orchestration: false },
    });
  });
});

test("27 cannot activate without host bootstrap", async () => {
  const host = new EnterpriseHost({
    hostId: "host-cold",
    version: "1.0.0",
    defaultEnvironmentId: "prod",
    defaultProfileId: "standard",
  });
  await assert.rejects(async () => {
    host.createRuntimeInstance(await getRuntimeIR());
  });
});

test("28 cannot suspend stopped runtime", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  assert.throws(() => host.suspendRuntime(instance));
});

test("29 cannot resume running runtime", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  assert.throws(() => host.resumeRuntime(instance));
});

test("30 persist increments revision deterministically", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  assert.equal(host.persistRuntimeState(instance).revision, 1);
  assert.equal(host.persistRuntimeState(instance).revision, 2);
});

test("31 restoration without persisted state fails", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  assert.throws(() => host.restoreRuntimeState(instance));
});

test("32 orchestrated startup deterministic ordering", async () => {
  const host = createHost();
  const ir = await getRuntimeIR();
  const ids = [host.createRuntimeInstance(ir), host.createRuntimeInstance(ir), host.createRuntimeInstance(ir)];
  const started = host.orchestrateStartup([ids[2], ids[1], ids[0]]);
  assert.deepEqual(started.map((entry) => entry.instanceId), [...ids].sort((a, b) => a.localeCompare(b)));
});

test("33 orchestrated shutdown deterministic ordering", async () => {
  const host = createHost();
  const ir = await getRuntimeIR();
  const ids = [host.createRuntimeInstance(ir), host.createRuntimeInstance(ir), host.createRuntimeInstance(ir)];
  host.orchestrateStartup();
  const stopped = host.orchestrateShutdown([ids[2], ids[1], ids[0]]);
  assert.deepEqual(stopped.map((entry) => entry.instanceId), [...ids].sort((a, b) => a.localeCompare(b)));
});

test("34 host metrics reflect multi-runtime counts", async () => {
  const host = createHost();
  const ir = await getRuntimeIR();
  const one = host.createRuntimeInstance(ir);
  const two = host.createRuntimeInstance(ir);
  host.activateRuntime(one);
  host.activateRuntime(two);
  host.suspendRuntime(two);
  const metrics = host.snapshot().telemetry.metrics;
  assert.equal(metrics.hostedRuntimeCount, 2);
  assert.equal(metrics.activeRuntimeCount, 1);
  assert.equal(metrics.suspendedRuntimeCount, 1);
});

test("35 dispose host after runtime lifecycle", async () => {
  const host = createHost();
  const instance = host.createRuntimeInstance(await getRuntimeIR());
  host.activateRuntime(instance);
  host.shutdownRuntime(instance);
  const snapshot = host.disposeHost();
  assert.equal(snapshot.hostState, "Disposed");
});
