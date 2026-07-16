import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import { CompilerCore } from "../../../src/compiler/core/CompilerCore";
import type { EnterpriseRuntimeIR } from "../../../src/compiler/runtime/EnterpriseRuntimeIR";
import {
  DependencyContainer,
  RuntimeKernel,
  RuntimeKernelValidator,
  RuntimeStateMachine,
} from "../../../src/runtime/kernel";

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
      id: "runtime-kernel-fixture",
      sourceType: "markdown",
      origin: fixturePath("sample.md"),
    },
  }, "runtime-kernel-fixture-session");

  if (!result.enterpriseRuntimeIR) {
    throw new Error("Fixture compile did not produce enterpriseRuntimeIR");
  }

  cachedRuntimeIR = result.enterpriseRuntimeIR;
  return cachedRuntimeIR;
}

function cloneRuntimeIR(ir: EnterpriseRuntimeIR): EnterpriseRuntimeIR {
  return JSON.parse(JSON.stringify(ir)) as EnterpriseRuntimeIR;
}

test("1 boot transitions runtime into Running state", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(kernel.state(), "Running");
  assert.equal(context.snapshot().runtimeState, "Running");
});

test("2 boot creates deterministic session id from runtime hash", async () => {
  const ir = await getRuntimeIR();
  const kernel = new RuntimeKernel();
  const context = kernel.boot(ir);
  assert.equal(context.snapshot().sessionId, `session-${ir.deterministicHash.slice(0, 12)}`);
});

test("3 runtime context is deeply immutable", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  const snapshot = context.snapshot();
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.metrics), true);
  assert.equal(Object.isFrozen(snapshot.logger), true);
});

test("4 dependency container is loaded and deterministic", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  const deps = Object.keys(context.snapshot().dependencyContainer);
  const sorted = [...deps].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(deps, sorted);
});

test("5 service registry includes applications and services", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  const kinds = context.snapshot().serviceRegistry.map((entry) => entry.kind);
  assert.equal(kinds.includes("application"), true);
  assert.equal(kinds.includes("service"), true);
});

test("6 module registry includes modules", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(context.snapshot().moduleRegistry.length > 0, true);
});

test("7 plugin registry includes plugin bindings", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(context.snapshot().pluginRegistry.length > 0, true);
});

test("8 workflow registry includes workflow bindings", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(context.snapshot().workflowRegistry.length > 0, true);
});

test("9 scheduler has boot, health, maintenance and workflow jobs", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  const scheduler = context.snapshot().scheduler;
  assert.equal(scheduler.includes("startup:kernel-startup"), true);
  assert.equal(scheduler.includes("health:runtime-health"), true);
  assert.equal(scheduler.includes("maintenance:maintenance-window"), true);
  assert.equal(scheduler.some((entry) => entry.startsWith("workflow:")), true);
});

test("10 lifecycle event history contains ready event", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(context.snapshot().eventDispatcher.some((event) => event.eventType === "RuntimeReady"), true);
});

test("11 diagnostics are sorted deterministically", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  const diagnostics = context.snapshot().diagnostics;
  const sorted = [...diagnostics].sort((a, b) => `${a.code}:${a.message}`.localeCompare(`${b.code}:${b.message}`));
  assert.deepEqual(diagnostics, sorted);
});

test("12 telemetry counters include events and recovery steps", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(context.snapshot().telemetry.counters.events > 0, true);
  assert.equal(context.snapshot().telemetry.counters.recoverySteps > 0, true);
});

test("13 metrics map loaded resources correctly", async () => {
  const ir = await getRuntimeIR();
  const kernel = new RuntimeKernel();
  const context = kernel.boot(ir);
  const metrics = context.snapshot().metrics;
  assert.equal(metrics.loadedServices, ir.enterpriseRuntime.services.length);
  assert.equal(metrics.loadedModules, ir.enterpriseRuntime.modules.length);
  assert.equal(metrics.loadedPlugins, ir.enterpriseRuntime.pluginBindings.length);
  assert.equal(metrics.loadedWorkflows, ir.enterpriseRuntime.workflowBindings.length);
});

test("14 health score is valid", async () => {
  const kernel = new RuntimeKernel();
  const context = kernel.boot(await getRuntimeIR());
  assert.equal(context.snapshot().metrics.healthScore >= 0, true);
  assert.equal(context.snapshot().metrics.healthScore <= 100, true);
});

test("15 shutdown transitions to Stopped", async () => {
  const kernel = new RuntimeKernel();
  kernel.boot(await getRuntimeIR());
  const context = kernel.shutdown("test");
  assert.equal(kernel.state(), "Stopped");
  assert.equal(context.snapshot().runtimeState, "Stopped");
});

test("16 recover from Stopped transitions to Recovered", async () => {
  const kernel = new RuntimeKernel();
  kernel.boot(await getRuntimeIR());
  kernel.shutdown("test");
  const context = kernel.recover();
  assert.equal(kernel.state(), "Recovered");
  assert.equal(context.snapshot().runtimeState, "Recovered");
});

test("17 dispose from Recovered transitions to Disposed", async () => {
  const kernel = new RuntimeKernel();
  kernel.boot(await getRuntimeIR());
  kernel.shutdown("test");
  kernel.recover();
  const context = kernel.dispose();
  assert.equal(kernel.state(), "Disposed");
  assert.equal(context.snapshot().runtimeState, "Disposed");
});

test("18 recovery emits lifecycle events", async () => {
  const kernel = new RuntimeKernel();
  kernel.boot(await getRuntimeIR());
  kernel.shutdown("test");
  const context = kernel.recover();
  const eventTypes = context.snapshot().eventDispatcher.map((event) => event.eventType);
  assert.equal(eventTypes.includes("RuntimeRecovering"), true);
  assert.equal(eventTypes.includes("RuntimeRecovered"), true);
});

test("19 invalid graph cycle prevents boot", async () => {
  const ir = cloneRuntimeIR(await getRuntimeIR());
  ir.enterpriseRuntime.executionGraph.hasCycle = true;
  const kernel = new RuntimeKernel();
  assert.throws(() => kernel.boot(ir), /Runtime validation failed/);
});

test("20 duplicate service runtime id prevents boot", async () => {
  const ir = cloneRuntimeIR(await getRuntimeIR());
  const source = ir.enterpriseRuntime.services[0];
  const mutableServices = ir.enterpriseRuntime.services as unknown as Array<typeof source>;
  mutableServices.push({
    ...source,
    serviceId: `${source.serviceId}-dup`,
    runtimeId: source.runtimeId,
  });
  const kernel = new RuntimeKernel();
  assert.throws(() => kernel.boot(ir), /Runtime validation failed/);
});

test("21 missing module prevents boot", async () => {
  const ir = cloneRuntimeIR(await getRuntimeIR());
  ir.enterpriseRuntime.modules = [];
  const kernel = new RuntimeKernel();
  assert.throws(() => kernel.boot(ir), /Runtime validation failed/);
});

test("22 missing workflow prevents boot", async () => {
  const ir = cloneRuntimeIR(await getRuntimeIR());
  ir.enterpriseRuntime.workflowBindings = [];
  const kernel = new RuntimeKernel();
  assert.throws(() => kernel.boot(ir), /Runtime validation failed/);
});

test("23 missing plugin prevents boot", async () => {
  const ir = cloneRuntimeIR(await getRuntimeIR());
  ir.enterpriseRuntime.pluginBindings = [];
  const kernel = new RuntimeKernel();
  assert.throws(() => kernel.boot(ir), /Runtime validation failed/);
});

test("24 missing configuration binding prevents boot", async () => {
  const ir = cloneRuntimeIR(await getRuntimeIR());
  ir.enterpriseRuntime.configurationBindings = [];
  const kernel = new RuntimeKernel();
  assert.throws(() => kernel.boot(ir), /Runtime validation failed/);
});

test("25 boot is deterministic for telemetry and scheduler", async () => {
  const ir = await getRuntimeIR();
  const first = new RuntimeKernel().boot(ir).snapshot();
  const second = new RuntimeKernel().boot(ir).snapshot();
  assert.deepEqual(first.scheduler, second.scheduler);
  assert.deepEqual(first.telemetry, second.telemetry);
  assert.deepEqual(first.metrics, second.metrics);
});

test("26 repeated kernel boots produce stable dependency container", async () => {
  const ir = await getRuntimeIR();
  const first = new RuntimeKernel().boot(ir).snapshot().dependencyContainer;
  const second = new RuntimeKernel().boot(ir).snapshot().dependencyContainer;
  const third = new RuntimeKernel().boot(ir).snapshot().dependencyContainer;
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
});

test("27 runtime state machine rejects invalid transition", () => {
  const stateMachine = new RuntimeStateMachine();
  const diagnostics = stateMachine.transition("Running");
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].code, "GRT-STATE-001");
  assert.equal(diagnostics[0].blocking, true);
});

test("28 validator fails on missing runtime IR", () => {
  const validator = new RuntimeKernelValidator();
  const result = validator.validate(undefined as unknown as EnterpriseRuntimeIR, {
    nodes: [],
    edges: [],
    hasCycle: false,
  });
  assert.equal(result.valid, false);
  assert.equal(result.diagnostics.some((entry) => entry.code === "GRT-VAL-001"), true);
});

test("29 dependency container detects duplicate registration", () => {
  const container = new DependencyContainer();
  const registration = {
    id: "binding-1",
    providerId: "provider-a",
    contract: "db:primary",
    scope: "singleton" as const,
    lifecycle: "singleton" as const,
    dependencies: [] as const,
    external: false,
  };

  const first = container.register(registration);
  const second = container.register(registration);
  assert.equal(first.length, 0);
  assert.equal(second.some((entry) => entry.code === "GRT-DI-001"), true);
});

test("30 dependency container detects circular dependency", () => {
  const container = new DependencyContainer();
  container.register({
    id: "binding-a",
    providerId: "provider-a",
    contract: "contract-a",
    scope: "scoped",
    lifecycle: "scoped",
    dependencies: ["binding-b"],
    external: false,
  });
  container.register({
    id: "binding-b",
    providerId: "provider-b",
    contract: "contract-b",
    scope: "transient",
    lifecycle: "transient",
    dependencies: ["binding-a"],
    external: false,
  });

  const diagnostics = container.validate();
  assert.equal(diagnostics.some((entry) => entry.code === "GRT-DI-004"), true);
});

test("31 dependency container supports singleton scoped transient external", () => {
  const container = new DependencyContainer();
  const registrations = [
    {
      id: "singleton-binding",
      providerId: "provider-singleton",
      contract: "contract-singleton",
      scope: "singleton" as const,
      lifecycle: "singleton" as const,
      dependencies: [] as const,
      external: false,
    },
    {
      id: "scoped-binding",
      providerId: "provider-scoped",
      contract: "contract-scoped",
      scope: "scoped" as const,
      lifecycle: "scoped" as const,
      dependencies: ["singleton-binding"] as const,
      external: false,
    },
    {
      id: "transient-binding",
      providerId: "provider-transient",
      contract: "contract-transient",
      scope: "transient" as const,
      lifecycle: "transient" as const,
      dependencies: ["scoped-binding"] as const,
      external: false,
    },
    {
      id: "external-binding",
      providerId: "provider-external",
      contract: "contract-external",
      scope: "external" as const,
      lifecycle: "external" as const,
      dependencies: [] as const,
      external: true,
    },
  ] as const;

  for (const registration of registrations) {
    assert.equal(container.register(registration).length, 0);
  }

  const diagnostics = container.validate();
  assert.equal(diagnostics.some((entry) => entry.blocking), false);
  const snapshot = container.snapshot();
  assert.equal(snapshot["singleton-binding"].scope, "singleton");
  assert.equal(snapshot["scoped-binding"].scope, "scoped");
  assert.equal(snapshot["transient-binding"].scope, "transient");
  assert.equal(snapshot["external-binding"].scope, "external");
  assert.equal(snapshot["external-binding"].external, true);
});
