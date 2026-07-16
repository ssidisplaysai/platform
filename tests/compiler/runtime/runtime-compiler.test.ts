import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";
import { CompilerCore } from "../../../src/compiler/core/CompilerCore";
import { RuntimeCompiler } from "../../../src/compiler/runtime/RuntimeCompiler";
import { RuntimeIdentityFactory } from "../../../src/compiler/runtime/RuntimeIdentity";
import { RuntimeValidator } from "../../../src/compiler/runtime/RuntimeValidator";
import type { SolutionIR } from "../../../src/compiler/solution/SolutionIR";

function fixturePath(...segments: string[]): string {
  return resolve(process.cwd(), "tests", "compiler", "discovery", "fixtures", ...segments);
}

let cachedSolutionIR: SolutionIR | undefined;

async function getSolutionIR(): Promise<SolutionIR> {
  if (cachedSolutionIR) {
    return cachedSolutionIR;
  }

  const core = new CompilerCore();
  const result = await core.compile({
    source: {
      id: "runtime-fixture",
      sourceType: "markdown",
      origin: fixturePath("sample.md"),
    },
  }, "runtime-fixture-session");

  if (!result.solutionIR) {
    throw new Error("Fixture compile did not produce solutionIR");
  }

  cachedSolutionIR = result.solutionIR;
  return cachedSolutionIR;
}

function cloneSolutionIR(ir: SolutionIR): SolutionIR {
  return JSON.parse(JSON.stringify(ir)) as SolutionIR;
}

async function compileRuntime(inputOverride?: SolutionIR) {
  const compiler = new RuntimeCompiler();
  const source = inputOverride ?? (await getSolutionIR());
  return compiler.compile(source, {
    compilerVersion: "1.0.0",
    pipelineVersion: "1.0.0",
    passVersion: "1.0.0",
    compiledAt: "2026-01-01T00:00:00.000Z",
  });
}

test("1 deterministic Runtime IR compilation", async () => {
  const first = await compileRuntime();
  const second = await compileRuntime();
  assert.equal(first.deterministicHash, second.deterministicHash);
});

test("2 stable runtime identities", async () => {
  const result = await compileRuntime();
  assert.equal(RuntimeIdentityFactory.isValid(result.enterpriseRuntime.runtimeId), true);
  assert.equal(result.enterpriseRuntime.modules.every((entry) => RuntimeIdentityFactory.isValid(entry.runtimeId)), true);
});

test("3 module activation projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.modules.length > 0, true);
});

test("4 application activation projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.applications.length > 0, true);
});

test("5 service activation projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.services.length > 0, true);
});

test("6 API activation projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.apis.length > 0, true);
});

test("7 database binding projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.databaseBindings.length > 0, true);
});

test("8 storage binding projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.storageBindings.length > 0, true);
});

test("9 messaging projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.messagingBindings.length > 0, true);
});

test("10 workflow registration", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.workflowBindings.length > 0, true);
});

test("11 integration binding", async () => {
  const result = await compileRuntime();
  assert.equal(Array.isArray(result.enterpriseRuntime.integrationBindings), true);
});

test("12 scheduler registration", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.schedulerBindings.length > 0, true);
});

test("13 event registration", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.eventBindings.length > 0, true);
});

test("14 authentication projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.authenticationBindings.length > 0, true);
});

test("15 authorization projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.authorizationBindings.length > 0, true);
});

test("16 configuration projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.configurationBindings.length > 0, true);
});

test("17 secret-reference projection without secret resolution", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.secretReferences.length > 0, true);
  assert.equal(result.enterpriseRuntime.secretReferences.every((entry) => entry.resolutionPolicy === "deferred"), true);
});

test("18 environment projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.environments.length > 0, true);
});

test("19 deployment-target projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.deploymentTargets.length > 0, true);
});

test("20 monitoring projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.monitoringBindings.length > 0, true);
});

test("21 telemetry projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.telemetryBindings.length > 0, true);
});

test("22 logging projection", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.loggingBindings.length > 0, true);
});

test("23 dependency-injection binding", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.dependencyBindings.length > 0, true);
});

test("24 provider binding", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.providerBindings.length > 0, true);
});

test("25 plugin binding", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.pluginBindings.length > 0, true);
});

test("26 agent binding", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.agentBindings.length > 0, true);
});

test("27 activation plan order", async () => {
  const result = await compileRuntime();
  const phases = result.enterpriseRuntime.activationPlan.phases.map((entry) => entry.phase);
  assert.deepEqual(phases, [
    "Configuration",
    "Secrets Resolution Preparation",
    "Provider Registration",
    "Infrastructure Binding",
    "Storage Binding",
    "Messaging Binding",
    "Authentication Binding",
    "Authorization Binding",
    "Service Registration",
    "API Registration",
    "Workflow Registration",
    "Scheduler Registration",
    "Event Registration",
    "Agent Registration",
    "Monitoring Registration",
    "Health Verification",
    "Runtime Ready",
  ]);
});

test("28 shutdown plan", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.shutdownPlan.orderedSteps.length > 0, true);
});

test("29 recovery plan", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.recoveryPlan.orderedSteps.length > 0, true);
});

test("30 execution graph construction", async () => {
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.executionGraph.nodes.length > 0, true);
  assert.equal(result.enterpriseRuntime.executionGraph.edges.length > 0, true);
});

test("31 cycle detection", async () => {
  const ir = await compileRuntime();
  const mutated = JSON.parse(JSON.stringify(ir));
  mutated.enterpriseRuntime.executionGraph = {
    nodes: [
      { nodeId: "n-a", runtimeObjectId: "a", objectType: "service" },
      { nodeId: "n-b", runtimeObjectId: "b", objectType: "service" },
    ],
    edges: [
      { edgeId: "e1", from: "n-a", to: "n-b", edgeType: "requires" },
      { edgeId: "e2", from: "n-b", to: "n-a", edgeType: "requires" },
    ],
    hasCycle: true,
    orphanNodeIds: [],
    violations: [],
  };
  const diagnostics = new RuntimeValidator().validate(mutated);
  assert.equal(diagnostics.some((entry) => entry.code === "RUN-VAL-018"), true);
});

test("32 missing-provider failure", async () => {
  const source = cloneSolutionIR(await getSolutionIR());
  source.enterpriseSolution.databases = [];
  await assert.rejects(async () => {
    await compileRuntime(source);
  });
});

test("33 ambiguous-provider failure", async () => {
  const source = cloneSolutionIR(await getSolutionIR());
  const duplicateDb = {
    ...source.enterpriseSolution.databases[0],
    identity: {
      ...source.enterpriseSolution.databases[0].identity,
      id: `${source.enterpriseSolution.databases[0].identity.id}-dup`,
    },
  };
  (source.enterpriseSolution.databases as unknown as Array<typeof duplicateDb>).push(duplicateDb);
  await assert.rejects(async () => {
    await compileRuntime(source);
  });
});

test("34 blocking-conflict failure", async () => {
  const source = cloneSolutionIR(await getSolutionIR());
  source.enterpriseSolution.modules[0].conflicts = [
    {
      id: "conflict-1",
      conflictType: "runtime dependency conflict",
      status: "blocking",
      blocking: true,
      relatedIds: [source.enterpriseSolution.modules[0].identity.id],
    },
  ];
  await assert.rejects(async () => {
    await compileRuntime(source);
  });
});

test("35 provenance preservation", async () => {
  const source = await getSolutionIR();
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.provenance.sourceKnowledgeId, source.enterpriseSolution.provenance.sourceKnowledgeId);
});

test("36 lineage preservation", async () => {
  const source = await getSolutionIR();
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.lineage.sourceKnowledgeId, source.enterpriseSolution.lineage.sourceKnowledgeId);
});

test("37 confidence propagation", async () => {
  const source = await getSolutionIR();
  const result = await compileRuntime();
  assert.equal(result.enterpriseRuntime.confidence.current, source.enterpriseSolution.confidence.current);
});

test("38 temporal validity", async () => {
  const result = await compileRuntime();
  assert.equal(Boolean(result.enterpriseRuntime.temporalValidity.validFrom), true);
});

test("39 deep immutability", async () => {
  const result = await compileRuntime();
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.enterpriseRuntime), true);
  assert.equal(Object.isFrozen(result.enterpriseRuntime.services), true);
});

test("40 deterministic serialization", async () => {
  const first = await compileRuntime();
  const second = await compileRuntime();
  assert.equal(first.deterministicSerialization, second.deterministicSerialization);
});

test("41 repeated compile equality", async () => {
  const first = await compileRuntime();
  const second = await compileRuntime();
  const third = await compileRuntime();
  assert.deepEqual(first, second);
  assert.deepEqual(second, third);
});

test("42 diagnostics", async () => {
  const result = await compileRuntime();
  assert.equal(result.diagnostics.length > 0, true);
  assert.equal(result.diagnostics.every((entry) => Boolean(entry.code) && Boolean(entry.category)), true);
});

test("43 metrics", async () => {
  const result = await compileRuntime();
  assert.equal(result.metrics.runtimeServiceCount, result.enterpriseRuntime.services.length);
  assert.equal(result.metrics.executionGraphNodeCount, result.enterpriseRuntime.executionGraph.nodes.length);
});

test("44 compiler-kernel integration", async () => {
  const core = new CompilerCore();
  const result = await core.compile({
    source: {
      id: "runtime-core-int",
      sourceType: "markdown",
      origin: fixturePath("sample.md"),
    },
  }, "runtime-core-int-session");

  const passIds = result.manifest.passManifests.map((entry) => entry.id);
  assert.equal(passIds.includes("runtime-pass"), true);
  assert.equal(Boolean(result.enterpriseRuntimeIR), true);
});

test("45 end-to-end Solution IR to Runtime IR", async () => {
  const source = await getSolutionIR();
  const compiler = new RuntimeCompiler();
  const result = compiler.compileWithResult(source, { compiledAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(result.success, true);
  assert.equal(result.enterpriseRuntimeIR.compiledFromSolutionHash, source.deterministicHash);
});
