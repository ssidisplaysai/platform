import {
  createDigest,
  PolicyCapabilityDispatchAdapter,
  PolicyDecisionEvidenceAdapter,
  PolicyExecutionIntentAdapter,
  PolicyHostOperationAdapter,
  PolicyMessagingPublishAdapter,
  PolicyPermissionBridgeAdapter,
  PolicyReplayVerificationAdapter,
  PolicySchedulingPlanAdapter,
  PolicyServiceLifecycleAdapter,
  PolicyWorkflowTransitionAdapter,
  RuntimePolicyCompiler,
  RuntimePolicyConflictResolver,
  RuntimePolicyDecision,
  RuntimePolicyDefinition,
  RuntimePolicyDiagnostics,
  RuntimePolicyEvaluator,
  RuntimePolicyEvidence,
  RuntimePolicyFactCompiler,
  RuntimePolicyFactCompilationError,
  RuntimePolicyFactIR,
  RuntimePolicyIR,
  RuntimePolicyManager,
  RuntimePolicyReplay,
  RuntimePolicyResolver,
  RuntimePolicySnapshotStore,
  type RuntimePolicyCompilerConfig,
  type RuntimePolicyDefinition as RuntimePolicyDefinitionRecord,
  type RuntimePolicyEvaluationContext,
  type RuntimePolicyFact as RuntimePolicyFactRecord,
  type RuntimePolicyFactIR as RuntimePolicyFactIRRecord,
  type RuntimePolicyIR as RuntimePolicyIRRecord,
} from "../../../src/runtime/policy";
import { RuntimeKernel } from "../../../src/runtime/kernel";
import { EnterpriseHost } from "../../../src/runtime/host";
import { RuntimeServiceManager } from "../../../src/runtime/services";
import { RuntimeObjectManager } from "../../../src/runtime/objects";
import { RuntimeMessagingManager } from "../../../src/runtime/messaging";
import { RuntimeSchedulingManager } from "../../../src/runtime/scheduling";
import { RuntimeWorkflowManager } from "../../../src/runtime/workflows";

const COMPILER_CONFIG: RuntimePolicyCompilerConfig = {
  compilerId: "grt-policy-compiler",
  compilerVersion: "8.0.0",
  schemaVersion: "grt.policy.schema.v1",
  runtimeExecutionContextId: "ctx-a",
};

function makeConfig(contextId: string): RuntimePolicyCompilerConfig {
  return {
    ...COMPILER_CONFIG,
    runtimeExecutionContextId: contextId,
  };
}

function makeDefinition(overrides: Partial<RuntimePolicyDefinitionRecord> = {}): RuntimePolicyDefinitionRecord {
  return {
    policyDefinitionId: "policy-def-1",
    name: "AccessPolicy",
    version: "1.0.0",
    lifecycleState: "Active",
    schemaVersion: COMPILER_CONFIG.schemaVersion,
    conflictStrategy: "deny-overrides",
    policySetIds: ["set-a"],
    dependencyPolicyIds: [],
    metadata: { team: "runtime", tier: "core" },
    rules: [
      {
        ruleId: "rule-explicit-1",
        name: "deny-suspended",
        effect: "Deny",
        priority: 1,
        target: { targetType: "Capability", targetId: "cap:publish", selector: { area: "messages" }, metadata: { env: "prod" } },
        conditions: [
          { factKey: "user.state", operator: "Equals", expectedValue: "Suspended" },
        ],
        obligations: [
          { obligationType: "requireAudit", payload: { level: "high" } },
        ],
        dependencyRuleIds: [],
        metadata: { risk: "high" },
      },
      {
        ruleId: "rule-explicit-2",
        name: "allow-active",
        effect: "Permit",
        priority: 2,
        target: { targetType: "Capability", targetId: "cap:publish", selector: { area: "messages" }, metadata: { env: "prod" } },
        conditions: [
          { factKey: "user.state", operator: "Equals", expectedValue: "Active" },
        ],
        obligations: [
          { obligationType: "requireEvidence", payload: { kind: "policy-decision" } },
        ],
        dependencyRuleIds: ["rule-explicit-1"],
        metadata: { risk: "low" },
      },
    ],
    ...overrides,
  };
}

function makeContext(contextId: string, runtimePolicyId = "runtime-policy-id"): RuntimePolicyEvaluationContext {
  return {
    requestId: `req-${contextId}`,
    executionContextId: contextId,
    policyRuntimeId: runtimePolicyId,
    schemaVersion: COMPILER_CONFIG.schemaVersion,
    metadata: { source: "test" },
  };
}

function makeFact(overrides: Partial<RuntimePolicyFactRecord> = {}): RuntimePolicyFactRecord {
  return {
    factKey: "user.state",
    factType: "String",
    factValue: "Active",
    sourceKind: "Runtime",
    sourceId: "runtime-engine",
    sourceVersion: "1",
    sourceDigest: "digest-runtime-engine",
    confidence: 1,
    provenanceReferences: ["b-ref", "a-ref"],
    metadata: { source: "runtime" },
    ...overrides,
  };
}

function compileDefinition(
  definition: RuntimePolicyDefinitionRecord,
  config: RuntimePolicyCompilerConfig = COMPILER_CONFIG,
) {
  return new RuntimePolicyCompiler(config).compile(definition);
}

function successfulCompilation(definition = makeDefinition(), config: RuntimePolicyCompilerConfig = COMPILER_CONFIG) {
  const result = compileDefinition(definition, config);
  expect(result.success).toBe(true);
  expect(result.runtimePolicyIr).toBeDefined();
  expect(result.certificate).toBeDefined();
  return result;
}

function compileFacts(facts: RuntimePolicyFactRecord[], schema = COMPILER_CONFIG.schemaVersion): RuntimePolicyFactIRRecord[] {
  const factCompiler = new RuntimePolicyFactCompiler();
  return factCompiler.compileMany(facts, schema);
}

describe("GRT-0008 Runtime Policy Validation", () => {
  describe("Domain 1 - Policy Definitions", () => {
    test("1.1 valid policy definition compilation succeeds", () => {
      const result = compileDefinition(makeDefinition());
      expect(result.success).toBe(true);
      expect(result.validationResult).toBe("Valid");
    });

    test("1.2 immutable policy definition snapshots are deeply frozen", () => {
      const immutable = RuntimePolicyDefinition.immutable(makeDefinition()).snapshot();
      expect(Object.isFrozen(immutable)).toBe(true);
      expect(Object.isFrozen(immutable.rules)).toBe(true);
      expect(Object.isFrozen(immutable.rules[0].target)).toBe(true);
    });

    test("1.3 deterministic definition identity via digest", () => {
      const one = RuntimePolicyDefinition.immutable(makeDefinition()).snapshot();
      const two = RuntimePolicyDefinition.immutable(makeDefinition()).snapshot();
      expect(createDigest(one)).toBe(createDigest(two));
    });

    test("1.4 required field validation rejects empty name", () => {
      const result = compileDefinition(makeDefinition({ name: "" }));
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("GRT-POL-VAL-001");
    });

    test("1.5 unsupported schema is rejected", () => {
      const result = compileDefinition(makeDefinition({ schemaVersion: "unsupported.v99" }));
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("GRT-POL-VAL-003");
    });

    test("1.6 invalid lifecycle is rejected", () => {
      const invalid = makeDefinition({ lifecycleState: "InvalidLifecycle" as never });
      const result = compileDefinition(invalid);
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("GRT-POL-VAL-004");
    });

    test("1.7 invalid conflict strategy is rejected", () => {
      const invalid = makeDefinition({ conflictStrategy: "random-wins" as never });
      const result = compileDefinition(invalid);
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("GRT-POL-VAL-005");
    });

    test("1.8 invalid rule effect is rejected", () => {
      const invalid = makeDefinition({
        rules: [{ ...makeDefinition().rules[0], effect: "Allow" as never }],
      });
      const result = compileDefinition(invalid);
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("GRT-POL-VAL-006");
    });

    test("1.9 invalid obligation is rejected", () => {
      const invalid = makeDefinition({
        rules: [{ ...makeDefinition().rules[0], obligations: [{ obligationType: "", payload: {} }] }],
      });
      const result = compileDefinition(invalid);
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("GRT-POL-VAL-011");
    });

    test("1.10 no executable callbacks are allowed in definitions", () => {
      const invalid = makeDefinition({ metadata: { callback: (() => "x") as never } });
      const result = compileDefinition(invalid);
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("GRT-POL-VAL-012");
    });
  });

  describe("Domain 2 - Compiler Pass Architecture", () => {
    test("2.1 exact deterministic pass order is preserved", () => {
      const result = successfulCompilation();
      expect(result.passResults.map((entry) => entry.passName)).toEqual([
        "DefinitionValidation",
        "CanonicalOrdering",
        "Normalization",
        "DependencyResolution",
        "ConflictAnalysis",
        "DeterministicOptimization",
        "IdentityAssignment",
        "PolicyIRGeneration",
        "CompilationCertification",
      ]);
    });

    test("2.2 pass outputs are immutable", () => {
      const result = successfulCompilation();
      expect(Object.isFrozen(result.passResults)).toBe(true);
      expect(Object.isFrozen(result.passResults[0])).toBe(true);
    });

    test("2.3 deterministic pass-result identities across runs", () => {
      const one = successfulCompilation();
      const two = successfulCompilation();
      expect(one.passResults).toEqual(two.passResults);
    });

    test("2.5 completed pass results are preserved on failure", () => {
      const failing = makeDefinition({
        rules: [{ ...makeDefinition().rules[0], dependencyRuleIds: ["missing-rule-id"] }],
      });
      const result = compileDefinition(failing);
      expect(result.success).toBe(false);
      expect(result.passResults.length).toBeGreaterThanOrEqual(4);
      expect(result.failedPassName).toBe("DependencyResolution");
    });

    test("2.6 deterministic failure digest for repeated dependency failures", () => {
      const failing = makeDefinition({
        rules: [{ ...makeDefinition().rules[0], dependencyRuleIds: ["missing-rule-id"] }],
      });
      const one = compileDefinition(failing);
      const two = compileDefinition(failing);
      expect(one.failureDigest).toBe(two.failureDigest);
    });

    test("2.7 compiler does not perform runtime evaluation", () => {
      const evaluatorSpy = jest.spyOn(RuntimePolicyEvaluator.prototype, "evaluate");
      successfulCompilation();
      expect(evaluatorSpy).not.toHaveBeenCalled();
      evaluatorSpy.mockRestore();
    });
  });

  describe("Domain 3 - Compiler Failure Contract", () => {
    test("3.1 invalid definitions return invalid result instead of uncaught exceptions", () => {
      const result = compileDefinition(makeDefinition({ rules: [] }));
      expect(result.success).toBe(false);
      expect(result.validationResult).toBe("Invalid");
      expect(result.failureDigest).toBeDefined();
      expect(result.compilerId).toBe(COMPILER_CONFIG.compilerId);
      expect(result.compilerVersion).toBe(COMPILER_CONFIG.compilerVersion);
      expect(Object.isFrozen(result)).toBe(true);
    });

    test("3.2 initialization exceptions are converted", () => {
      const immutableSpy = jest.spyOn(RuntimePolicyDefinition, "immutable").mockImplementation(() => {
        throw new Error("boom-init");
      });
      const result = compileDefinition(makeDefinition());
      expect(result.success).toBe(false);
      expect(result.validationResult).toBe("Invalid");
      expect(result.failureReason).toContain("GRT-POL");
      immutableSpy.mockRestore();
    });

    test("3.3 internal pass exceptions are converted to invalid compilation results", () => {
      const compiler = new RuntimePolicyCompiler(COMPILER_CONFIG) as unknown as { passes: Array<{ execute: (state: unknown, ctx: unknown) => unknown }> };
      const original = compiler.passes[2].execute;
      compiler.passes[2].execute = () => {
        throw new Error("pass-fault");
      };
      const result = (compiler as unknown as RuntimePolicyCompiler).compile(makeDefinition());
      expect(result.success).toBe(false);
      expect(result.failedPassName).toBe("Normalization");
      compiler.passes[2].execute = original;
    });

    test("3.4 finalization exceptions are converted", () => {
      const compiler = new RuntimePolicyCompiler(COMPILER_CONFIG) as unknown as { passes: Array<{ execute: (state: unknown, ctx: unknown) => unknown }> };
      const lastIndex = compiler.passes.length - 1;
      const original = compiler.passes[lastIndex].execute;
      compiler.passes[lastIndex].execute = () => {
        throw new Error("finalization-fault");
      };
      const result = (compiler as unknown as RuntimePolicyCompiler).compile(makeDefinition());
      expect(result.success).toBe(false);
      expect(result.failedPassName).toBe("CompilationCertification");
      compiler.passes[lastIndex].execute = original;
    });

    test("3.5 invalid result ordering is deterministic", () => {
      const failing = makeDefinition({ rules: [] });
      const one = compileDefinition(failing);
      const two = compileDefinition(failing);
      expect(one).toEqual(two);
    });

    test("3.6 failure outputs include diagnostics, evidence, and pass results", () => {
      const result = compileDefinition(makeDefinition({ rules: [] }));
      expect((result.diagnostics?.length ?? 0) > 0).toBe(true);
      expect((result.evidence?.length ?? 0) > 0).toBe(true);
      expect((result.passResults?.length ?? 0) > 0).toBe(true);
    });
  });

  describe("Domain 4 - Runtime Policy IR", () => {
    test("4.1 RuntimePolicyIR is the executable representation", () => {
      const result = successfulCompilation();
      expect(result.runtimePolicyIr?.runtimePolicyIrId.startsWith("runtime-policy-ir-")).toBe(true);
    });

    test("4.2 authored policy name and version are absent from runtime IR payload", () => {
      const result = successfulCompilation();
      const serialized = JSON.stringify(result.runtimePolicyIr);
      expect(serialized.includes('"name"')).toBe(false);
      expect(serialized.includes('"version"')).toBe(false);
    });

    test("4.3 authored rule names are absent from runtime IR rules", () => {
      const result = successfulCompilation();
      const rule = result.runtimePolicyIr!.rules[0] as unknown as Record<string, unknown>;
      expect(Object.prototype.hasOwnProperty.call(rule, "name")).toBe(false);
    });

    test("4.4 runtime IR is immutable and serializable", () => {
      const result = successfulCompilation();
      expect(Object.isFrozen(result.runtimePolicyIr)).toBe(true);
      expect(() => JSON.stringify(result.runtimePolicyIr)).not.toThrow();
    });

    test("4.6 semantically equivalent authoring order produces identical IR digests", () => {
      const base = makeDefinition();
      const reordered = makeDefinition({ rules: [...base.rules].reverse() });
      const one = successfulCompilation(base).runtimePolicyIr!.runtimePolicyIrDigest;
      const two = successfulCompilation(reordered).runtimePolicyIr!.runtimePolicyIrDigest;
      expect(one).toBe(two);
    });
  });

  describe("Domain 5 - Rule Identity", () => {
    test("5.1 rule identity is deterministic", () => {
      const one = successfulCompilation().runtimePolicyIr!.rules.map((rule) => rule.ruleId);
      const two = successfulCompilation().runtimePolicyIr!.rules.map((rule) => rule.ruleId);
      expect(one).toEqual(two);
    });

    test("5.2 semantically different rule content produces different identity", () => {
      const base = makeDefinition({ rules: [{ ...makeDefinition().rules[0], ruleId: undefined }] });
      const changed = makeDefinition({ rules: [{ ...makeDefinition().rules[0], ruleId: undefined, effect: "Conditional" }] });
      const a = successfulCompilation(base).runtimePolicyIr!.rules[0].ruleId;
      const b = successfulCompilation(changed).runtimePolicyIr!.rules[0].ruleId;
      expect(a).not.toBe(b);
    });

    test("5.3 identity does not rely on human-readable rule name alone", () => {
      const baseRules = makeDefinition().rules;
      const source = makeDefinition({
        rules: [
          { ...baseRules[0], ruleId: undefined },
          { ...baseRules[1], ruleId: undefined, name: `${baseRules[1].name}-unique`, dependencyRuleIds: [] },
        ],
      });
      const renamed = makeDefinition({
        rules: source.rules.map((rule) => ({ ...rule, ruleId: undefined, name: `${rule.name}-alias` })),
      });
      const originalIds = successfulCompilation(source).runtimePolicyIr!.rules.map((rule) => rule.ruleId);
      const renamedIds = successfulCompilation(renamed).runtimePolicyIr!.rules.map((rule) => rule.ruleId);
      expect(originalIds).not.toEqual(renamedIds);
    });

    test("5.4 canonical ordering precedes identity generation", () => {
      const source = makeDefinition();
      const reversed = makeDefinition({ rules: [...source.rules].reverse() });
      const a = successfulCompilation(source).runtimePolicyIr!.rules.map((rule) => rule.ruleId);
      const b = successfulCompilation(reversed).runtimePolicyIr!.rules.map((rule) => rule.ruleId);
      expect(a).toEqual(b);
    });

    test("5.5 duplicate explicit rule ids are rejected", () => {
      const bad = makeDefinition({
        rules: [
          { ...makeDefinition().rules[0], ruleId: "dup" },
          { ...makeDefinition().rules[1], ruleId: "dup" },
        ],
      });
      const result = compileDefinition(bad);
      expect(result.success).toBe(false);
      expect(result.failureReason).toContain("GRT-POL-VAL-010");
    });
  });

  describe("Domain 6 - Compilation Certificate", () => {
    test("6.1 certificate is emitted for successful compilation", () => {
      const result = successfulCompilation();
      expect(result.certificate).toBeDefined();
      expect(result.certificate!.validationResult).toBe("Valid");
    });

    test("6.2 certificate identity is deterministic", () => {
      const one = successfulCompilation().certificate!.certificateId;
      const two = successfulCompilation().certificate!.certificateId;
      expect(one).toBe(two);
    });

    test("6.3 certificate captures exact policy and IR digests", () => {
      const result = successfulCompilation();
      expect(result.certificate!.policyDefinitionDigest).toBe(result.runtimePolicyIr!.policyDefinitionDigest);
      expect(result.certificate!.runtimePolicyIrDigest).toBe(result.runtimePolicyIr!.runtimePolicyIrDigest);
    });

    test("6.4 all nine passes are present including certification", () => {
      const result = successfulCompilation();
      expect(result.certificate!.passResults).toHaveLength(9);
      expect(result.certificate!.passResults.some((entry) => entry.passName === "CompilationCertification")).toBe(true);
    });

    test("6.5 certificate is immutable and serializable", () => {
      const cert = successfulCompilation().certificate!;
      expect(Object.isFrozen(cert)).toBe(true);
      expect(() => JSON.stringify(cert)).not.toThrow();
    });

    test("6.6 certificate changes if definition changes", () => {
      const one = successfulCompilation(makeDefinition()).certificate!.certificateId;
      const two = successfulCompilation(makeDefinition({ version: "1.0.1" })).certificate!.certificateId;
      expect(one).not.toBe(two);
    });
  });

  describe("Domain 7 - Fact Source and Fact IR", () => {
    test.each([
      ["String", "value"],
      ["Number", 7],
      ["Boolean", true],
      ["Null", null],
      ["Json", { a: 1, b: "x" }],
    ] as const)("7.x valid %s fact compiles", (factType, factValue) => {
      const compiler = new RuntimePolicyFactCompiler();
      const result = compiler.compile(makeFact({ factType, factValue }), COMPILER_CONFIG.schemaVersion);
      expect(result.factIr.canonicalType).toBe(factType);
      expect(Object.isFrozen(result.factIr)).toBe(true);
    });

    test("7.6 fact compilation is deterministic", () => {
      const compiler = new RuntimePolicyFactCompiler();
      const one = compiler.compile(makeFact(), COMPILER_CONFIG.schemaVersion).factIr;
      const two = compiler.compile(makeFact(), COMPILER_CONFIG.schemaVersion).factIr;
      expect(one).toEqual(two);
    });

    test("7.7 raw RuntimePolicyFact cannot be sent directly to evaluator", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const evaluator = new RuntimePolicyEvaluator();
      expect(() => evaluator.evaluate({
        runtimePolicyIr: ir,
        facts: [makeFact() as unknown as RuntimePolicyFactIRRecord],
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      })).toThrow();
    });

    test("7.8 unsupported fact type is rejected with typed deterministic failure", () => {
      const compiler = new RuntimePolicyFactCompiler();
      expect(() => compiler.compile(makeFact({ factType: "Unknown" as never }), COMPILER_CONFIG.schemaVersion)).toThrow(RuntimePolicyFactCompilationError);
      try {
        compiler.compile(makeFact({ factType: "Unknown" as never }), COMPILER_CONFIG.schemaVersion);
      } catch (error) {
        const typed = error as RuntimePolicyFactCompilationError;
        expect(typed.code).toBe("GRT-POL-FACT-001");
        expect(typed.factKey).toBe("user.state");
        expect(typed.factType).toBe("Unknown");
      }
    });

    test.each([
      ["String", 42],
      ["Number", "42"],
      ["Boolean", "true"],
      ["Null", "null"],
      ["Json", ["array-not-object"]],
    ] as const)("7.9 invalid %s value is rejected", (factType, factValue) => {
      const compiler = new RuntimePolicyFactCompiler();
      expect(() => compiler.compile(makeFact({ factType, factValue } as Partial<RuntimePolicyFactRecord>), COMPILER_CONFIG.schemaVersion)).toThrow(RuntimePolicyFactCompilationError);
    });

    test("7.10 serializable Fact IR", () => {
      const compiler = new RuntimePolicyFactCompiler();
      const factIr = compiler.compile(makeFact(), COMPILER_CONFIG.schemaVersion).factIr;
      expect(() => JSON.stringify(factIr)).not.toThrow();
    });
  });

  describe("Domain 8 - Fact Provenance", () => {
    test("8.1 canonical provenance is preserved and frozen", () => {
      const factIr = new RuntimePolicyFactCompiler().compile(makeFact(), COMPILER_CONFIG.schemaVersion).factIr;
      expect(factIr.provenance.sourceKind).toBe("Runtime");
      expect(Object.isFrozen(factIr.provenance)).toBe(true);
      expect(factIr.provenance.provenanceReferences).toEqual(["a-ref", "b-ref"]);
    });

    test("8.2 identical provenance produces identical digest", () => {
      const compiler = new RuntimePolicyFactCompiler();
      const one = compiler.compile(makeFact(), COMPILER_CONFIG.schemaVersion).factIr.provenanceDigest;
      const two = compiler.compile(makeFact(), COMPILER_CONFIG.schemaVersion).factIr.provenanceDigest;
      expect(one).toBe(two);
    });

    test("8.3 changed provenance changes digest", () => {
      const compiler = new RuntimePolicyFactCompiler();
      const one = compiler.compile(makeFact(), COMPILER_CONFIG.schemaVersion).factIr.provenanceDigest;
      const two = compiler.compile(makeFact({ sourceDigest: "digest-changed" }), COMPILER_CONFIG.schemaVersion).factIr.provenanceDigest;
      expect(one).not.toBe(two);
    });

    test("8.4 replay retains provenance-equivalent outcomes", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const facts = compileFacts([makeFact({ factValue: "Active" })]);
      const replay = new RuntimePolicyReplay();
      const decision = replay.replay(ir, facts, makeContext("ctx-a", ir.runtimePolicyIrId));
      const verification = replay.verify(ir, facts, makeContext("ctx-a", ir.runtimePolicyIrId), decision);
      expect(verification.matched).toBe(true);
    });
  });

  describe("Domain 9 - Policy Resolver", () => {
    test("9.1 resolver accepts RuntimePolicyIR candidates and resolves deterministically", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const resolution = new RuntimePolicyResolver().resolve({
        policyRuntimeId: ir.runtimePolicyIrId,
        policyIrCandidates: [ir],
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(resolution.runtimePolicyIr.runtimePolicyIrId).toBe(ir.runtimePolicyIrId);
      expect(resolution.selectedBy).toBe("ExactRuntimeId");
    });

    test("9.2 resolver performs no rule evaluation", () => {
      const evaluatorSpy = jest.spyOn(RuntimePolicyEvaluator.prototype, "evaluate");
      const ir = successfulCompilation().runtimePolicyIr!;
      new RuntimePolicyResolver().resolve({
        policyRuntimeId: "missing",
        policyIrCandidates: [ir],
        context: makeContext("ctx-a", "missing"),
      });
      expect(evaluatorSpy).not.toHaveBeenCalled();
      evaluatorSpy.mockRestore();
    });

    test("9.3 resolver mutates no candidates", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const before = JSON.stringify(ir);
      new RuntimePolicyResolver().resolve({
        policyRuntimeId: "missing",
        policyIrCandidates: [ir],
        context: makeContext("ctx-a", "missing"),
      });
      expect(JSON.stringify(ir)).toBe(before);
    });

    test("9.4 duplicate runtime policy candidates are rejected", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      expect(() => new RuntimePolicyResolver().resolve({
        policyRuntimeId: ir.runtimePolicyIrId,
        policyIrCandidates: [ir, ir],
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      })).toThrow("GRT-POL-RES-002");
    });

    test("9.5 manager rejects foreign candidates through context partition assertion", () => {
      const a = new RuntimePolicyManager(makeConfig("ctx-a"));
      const b = new RuntimePolicyManager(makeConfig("ctx-b"));
      const aResult = a.compileAndRegister(makeDefinition({ policyDefinitionId: "pa" }));
      expect(aResult.success).toBe(true);
      expect(() => b.replayDecision(
        aResult.runtimePolicyIr!,
        compileFacts([makeFact()]),
        makeContext("ctx-b", aResult.runtimePolicyIr!.runtimePolicyIrId),
      )).toThrow("GRT-POL-REPLAY-CTX-001");
    });
  });

  describe("Domain 10 - Policy Evaluator", () => {
    test("10.1 evaluator is synchronous and deterministic", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const facts = compileFacts([makeFact({ factValue: "Active" })]);
      const evaluator = new RuntimePolicyEvaluator();
      const one = evaluator.evaluate({ runtimePolicyIr: ir, facts, context: makeContext("ctx-a", ir.runtimePolicyIrId) });
      const two = evaluator.evaluate({ runtimePolicyIr: ir, facts, context: makeContext("ctx-a", ir.runtimePolicyIrId) });
      expect(one).toEqual(two);
    });

    test("10.2 evaluation is pure with no input mutation", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const facts = compileFacts([makeFact({ factValue: "Active" })]);
      const context = makeContext("ctx-a", ir.runtimePolicyIrId);
      const before = JSON.stringify({ ir, facts, context });
      new RuntimePolicyEvaluator().evaluate({ runtimePolicyIr: ir, facts, context });
      expect(JSON.stringify({ ir, facts, context })).toBe(before);
    });

    test("10.3 decisions are immutable", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const decision = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Active" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(Object.isFrozen(decision)).toBe(true);
      expect(Object.isFrozen(decision.trace)).toBe(true);
    });

    test("10.4 no external lookups during evaluation", () => {
      const fetchSpy = jest.fn();
      (globalThis as unknown as { fetch?: unknown }).fetch = fetchSpy;
      const ir = successfulCompilation().runtimePolicyIr!;
      new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Active" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    test("10.5 matched policies and rules are canonical", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const decision = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Active" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(decision.matchedPolicyIds).toEqual([...decision.matchedPolicyIds].sort((a, b) => a.localeCompare(b)));
      expect(decision.matchedRuleIds).toEqual([...decision.matchedRuleIds].sort((a, b) => a.localeCompare(b)));
    });
  });

  describe("Domain 11 - Decision Outcomes", () => {
    test("11.1 Permit outcome", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const decision = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Active" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(decision.decision).toBe("Permit");
    });

    test("11.2 Deny outcome", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const decision = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Suspended" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(decision.decision).toBe("Deny");
    });

    test("11.3 Conditional outcome", () => {
      const definition = makeDefinition({
        rules: [{ ...makeDefinition().rules[0], effect: "Conditional", conditions: [{ factKey: "flag", operator: "Exists" }] }],
      });
      const ir = successfulCompilation(definition).runtimePolicyIr!;
      const decision = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factKey: "flag", factValue: "x" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(decision.decision).toBe("Conditional");
    });

    test("11.4 NotApplicable outcome", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const decision = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factKey: "other", factValue: "none" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(decision.decision).toBe("NotApplicable");
    });

    test("11.5 Indeterminate outcome for only-one-applicable with conflicting matches", () => {
      const definition = makeDefinition({
        conflictStrategy: "only-one-applicable",
        rules: [
          { ...makeDefinition().rules[0], effect: "Permit", conditions: [{ factKey: "x", operator: "Exists" }] },
          { ...makeDefinition().rules[1], effect: "Deny", conditions: [{ factKey: "x", operator: "Exists" }] },
        ],
      });
      const ir = successfulCompilation(definition).runtimePolicyIr!;
      const decision = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factKey: "x", factValue: "v" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(decision.decision).toBe("Indeterminate");
    });
  });

  describe("Domain 12 - Conflict Resolution", () => {
    test.each([
      ["deny-overrides", ["Permit", "Deny"], "Deny"],
      ["permit-overrides", ["Permit", "Deny"], "Permit"],
      ["first-applicable", ["Conditional", "Deny"], "Conditional"],
      ["only-one-applicable", ["Permit", "Deny"], "Indeterminate"],
      ["only-one-applicable", ["Permit"], "Permit"],
    ] as const)("12.x strategy %s resolves deterministically", (strategy, effects, expected) => {
      const decision = new RuntimePolicyConflictResolver().resolve({
        strategy: strategy as never,
        effects: effects as never,
      });
      expect(decision).toBe(expected);
    });
  });

  describe("Domain 13 - Obligations", () => {
    test("13.1 obligations are emitted as immutable descriptors", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const decision = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Active" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(Array.isArray(decision.obligations)).toBe(true);
      expect(Object.isFrozen(decision.obligations)).toBe(true);
    });

    test("13.2 obligations are output-only and never execute", () => {
      const spy = jest.fn();
      const definition = makeDefinition({
        rules: [{ ...makeDefinition().rules[0], obligations: [{ obligationType: "requireReview", payload: { fn: spy } as never }] }],
      });
      const result = compileDefinition(definition);
      expect(result.success).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    });

    test("13.3 canonical obligation ordering in IR", () => {
      const definition = makeDefinition({
        rules: [{
          ...makeDefinition().rules[0],
          obligations: [
            { obligationType: "z-last", payload: {} },
            { obligationType: "a-first", payload: {} },
          ],
        }],
      });
      const obligations = successfulCompilation(definition).runtimePolicyIr!.rules[0].obligations.map((o) => o.obligationType);
      expect(obligations).toEqual(["a-first", "z-last"]);
    });

    test("13.4 adapters receive obligation projections", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const decision = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Active" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      const projection = new PolicyCapabilityDispatchAdapter().toDispatchIntent(decision);
      expect(projection.obligations).toEqual(decision.obligations);
      expect(Object.isFrozen(projection)).toBe(true);
    });
  });

  describe("Domain 14 - Decision Trace", () => {
    test("14.1 trace contains conflict-resolution and finalization phases", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const decision = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Active" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      const phases = decision.trace.steps.map((step) => step.phase);
      expect(phases.includes("ConflictResolution")).toBe(true);
      expect(phases.includes("Decision")).toBe(true);
    });

    test("14.2 trace ordering is deterministic", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const facts = compileFacts([makeFact({ factValue: "Active" })]);
      const one = new RuntimePolicyEvaluator().evaluate({ runtimePolicyIr: ir, facts, context: makeContext("ctx-a", ir.runtimePolicyIrId) }).trace;
      const two = new RuntimePolicyEvaluator().evaluate({ runtimePolicyIr: ir, facts, context: makeContext("ctx-a", ir.runtimePolicyIrId) }).trace;
      expect(one).toEqual(two);
    });

    test("14.3 trace is immutable and serializable", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const trace = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Active" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      }).trace;
      expect(Object.isFrozen(trace)).toBe(true);
      expect(() => JSON.stringify(trace)).not.toThrow();
    });

    test("14.4 changed facts change trace digest", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const a = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Active" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      const b = new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Suspended" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
      expect(createDigest(a.trace)).not.toBe(createDigest(b.trace));
    });

    test("14.5 replay produces equivalent trace", () => {
      const ir = successfulCompilation().runtimePolicyIr!;
      const facts = compileFacts([makeFact({ factValue: "Active" })]);
      const replay = new RuntimePolicyReplay();
      const decision = replay.replay(ir, facts, makeContext("ctx-a", ir.runtimePolicyIrId));
      const result = replay.verify(ir, facts, makeContext("ctx-a", ir.runtimePolicyIrId), decision);
      expect(result.matched).toBe(true);
    });
  });

  describe("Domain 15 - Execution Context Isolation", () => {
    test("15.1 separate managers maintain context-local registrations", () => {
      const a = new RuntimePolicyManager(makeConfig("ctx-a"));
      const b = new RuntimePolicyManager(makeConfig("ctx-b"));
      a.compileAndRegister(makeDefinition({ policyDefinitionId: "pa" }));
      b.compileAndRegister(makeDefinition({ policyDefinitionId: "pb" }));
      expect(a.listPolicies()).toHaveLength(1);
      expect(b.listPolicies()).toHaveLength(1);
      expect(a.listPolicies()[0].runtimePolicyIrId).not.toBe(b.listPolicies()[0].runtimePolicyIrId);
    });

    test("15.2 mismatched runtimeExecutionContextId is rejected", () => {
      const manager = new RuntimePolicyManager(makeConfig("ctx-a"));
      const result = manager.compileAndRegister(makeDefinition());
      expect(() => manager.evaluate(
        result.runtimePolicyIr!.runtimePolicyIrId,
        [makeFact()],
        makeContext("ctx-b", result.runtimePolicyIr!.runtimePolicyIrId),
      )).toThrow("GRT-POL-CTX-002");
    });

    test("15.3 foreign RuntimePolicyIR rejected on replay", () => {
      const a = new RuntimePolicyManager(makeConfig("ctx-a"));
      const b = new RuntimePolicyManager(makeConfig("ctx-b"));
      const aResult = a.compileAndRegister(makeDefinition({ policyDefinitionId: "pa" }));
      expect(() => b.replayDecision(
        aResult.runtimePolicyIr!,
        compileFacts([makeFact()]),
        makeContext("ctx-b", aResult.runtimePolicyIr!.runtimePolicyIrId),
      )).toThrow("GRT-POL-REPLAY-CTX-001");
    });

    test("15.4 digest-matching assumptions cannot bypass local membership", () => {
      const a = new RuntimePolicyManager(makeConfig("ctx-a"));
      const b = new RuntimePolicyManager(makeConfig("ctx-b"));
      const shared = makeDefinition({ policyDefinitionId: "shared" });
      const aResult = a.compileAndRegister(shared);
      b.compileAndRegister(shared);
      expect(() => b.replayDecision(
        aResult.runtimePolicyIr!,
        compileFacts([makeFact()]),
        makeContext("ctx-b", aResult.runtimePolicyIr!.runtimePolicyIrId),
      )).toThrow(/GRT-POL-REPLAY-CTX-/);
    });

    test("15.5 context-local diagnostics/evidence/telemetry isolation", () => {
      const a = new RuntimePolicyManager(makeConfig("ctx-a"));
      const b = new RuntimePolicyManager(makeConfig("ctx-b"));
      const aResult = a.compileAndRegister(makeDefinition({ policyDefinitionId: "pa" }));
      b.compileAndRegister(makeDefinition({ policyDefinitionId: "pb" }));
      a.evaluate(aResult.runtimePolicyIr!.runtimePolicyIrId, [makeFact()], makeContext("ctx-a", aResult.runtimePolicyIr!.runtimePolicyIrId));
      expect(a.evidenceLog().length).toBeGreaterThan(0);
      expect(b.evidenceLog().length).toBeGreaterThan(0);
      expect((a.telemetrySnapshot().counters["policy.evaluated"] ?? 0)).toBeGreaterThan(
        b.telemetrySnapshot().counters["policy.evaluated"] ?? 0,
      );
    });

    test("15.6 no global mutable registry leakage", () => {
      const a = new RuntimePolicyManager(makeConfig("ctx-a"));
      const b = new RuntimePolicyManager(makeConfig("ctx-b"));
      a.compileAndRegister(makeDefinition({ policyDefinitionId: "pa" }));
      expect(b.listPolicies()).toEqual([]);
    });
  });

  describe("Domain 16 - Snapshot Store", () => {
    test("16.1 store binds to runtimeExecutionContextId", () => {
      const store = new RuntimePolicySnapshotStore("ctx-a");
      const record = store.save("ctx-a", "ir-1", {
        runtimePolicyIr: successfulCompilation().runtimePolicyIr!,
        certificate: successfulCompilation().certificate!,
        diagnostics: Object.freeze([]),
        evidence: Object.freeze([]),
        telemetry: { counters: Object.freeze({}) },
      });
      expect(record.runtimeExecutionContextId).toBe("ctx-a");
      expect(record.revision).toBe(1);
    });

    test("16.2 mismatched save is rejected", () => {
      const store = new RuntimePolicySnapshotStore("ctx-a");
      expect(() => store.save("ctx-b", "ir-1", {
        runtimePolicyIr: successfulCompilation().runtimePolicyIr!,
        certificate: successfulCompilation().certificate!,
        diagnostics: Object.freeze([]),
        evidence: Object.freeze([]),
        telemetry: { counters: Object.freeze({}) },
      })).toThrow("GRT-POL-SNAPSHOT-CTX-001");
    });

    test("16.3 mismatched loadLatest is rejected", () => {
      const store = new RuntimePolicySnapshotStore("ctx-a");
      expect(() => store.loadLatest("ctx-b", "ir-1")).toThrow("GRT-POL-SNAPSHOT-CTX-001");
    });

    test("16.4 mismatched history is rejected", () => {
      const store = new RuntimePolicySnapshotStore("ctx-a");
      expect(() => store.history("ctx-b", "ir-1")).toThrow("GRT-POL-SNAPSHOT-CTX-001");
    });

    test("16.5 revisions increase deterministically", () => {
      const store = new RuntimePolicySnapshotStore("ctx-a");
      const compilation = successfulCompilation();
      store.save("ctx-a", compilation.runtimePolicyIr!.runtimePolicyIrId, {
        runtimePolicyIr: compilation.runtimePolicyIr!,
        certificate: compilation.certificate!,
        diagnostics: compilation.diagnostics,
        evidence: compilation.evidence,
        telemetry: { counters: Object.freeze({ count: 1 }) },
      });
      const next = store.save("ctx-a", compilation.runtimePolicyIr!.runtimePolicyIrId, {
        runtimePolicyIr: compilation.runtimePolicyIr!,
        certificate: compilation.certificate!,
        diagnostics: compilation.diagnostics,
        evidence: compilation.evidence,
        telemetry: { counters: Object.freeze({ count: 2 }) },
      });
      expect(next.revision).toBe(2);
    });

    test("16.6 snapshot history is immutable and ordered", () => {
      const store = new RuntimePolicySnapshotStore("ctx-a");
      const compilation = successfulCompilation();
      store.save("ctx-a", compilation.runtimePolicyIr!.runtimePolicyIrId, {
        runtimePolicyIr: compilation.runtimePolicyIr!,
        certificate: compilation.certificate!,
        diagnostics: compilation.diagnostics,
        evidence: compilation.evidence,
        telemetry: { counters: Object.freeze({ count: 1 }) },
      });
      const history = store.history("ctx-a", compilation.runtimePolicyIr!.runtimePolicyIrId);
      expect(Object.isFrozen(history)).toBe(true);
      expect(history[0].revision).toBe(1);
    });
  });

  describe("Domain 17 - Evidence", () => {
    test("17.1 append-only and monotonic sequencing", () => {
      const evidence = new RuntimePolicyEvidence();
      evidence.append("A", { x: 1 });
      evidence.append("B", { y: 2 });
      const all = evidence.all();
      expect(all[0].sequence).toBe(1);
      expect(all[1].sequence).toBe(2);
    });

    test("17.2 evidence entries are immutable and deterministic", () => {
      const evidence = new RuntimePolicyEvidence();
      const one = evidence.append("A", { x: 1 });
      expect(Object.isFrozen(one)).toBe(true);
      expect(evidence.all()).toEqual([one]);
    });

    test("17.3 manager emits registration/evaluation evidence", () => {
      const manager = new RuntimePolicyManager(makeConfig("ctx-a"));
      const result = manager.compileAndRegister(makeDefinition());
      manager.evaluate(result.runtimePolicyIr!.runtimePolicyIrId, [makeFact()], makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId));
      const types = manager.evidenceLog().map((entry) => entry.type);
      expect(types.includes("PolicyCompiled")).toBe(true);
      expect(types.includes("PolicyResolved")).toBe(true);
      expect(types.includes("PolicyEvaluated")).toBe(true);
    });

    test("17.4 replay emits replay evidence", () => {
      const manager = new RuntimePolicyManager(makeConfig("ctx-a"));
      const result = manager.compileAndRegister(makeDefinition());
      const facts = compileFacts([makeFact()]);
      manager.replayDecision(result.runtimePolicyIr!, facts, makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId));
      expect(manager.evidenceLog().some((entry) => entry.type === "PolicyReplayed")).toBe(true);
    });
  });

  describe("Domain 18 - Diagnostics", () => {
    test("18.1 diagnostics are monotonic and immutable", () => {
      const diagnostics = new RuntimePolicyDiagnostics();
      const one = diagnostics.log("Error", "E1", "first");
      const two = diagnostics.log("Warning", "W1", "second");
      expect(one.sequence).toBe(1);
      expect(two.sequence).toBe(2);
      expect(Object.isFrozen(one)).toBe(true);
    });

    test("18.2 invalid definition emits stable diagnostic code", () => {
      const result = compileDefinition(makeDefinition({ rules: [] }));
      expect(result.diagnostics.some((entry) => entry.code === "GRT-POL-VAL-002" || entry.code === "GRT-POL-COMP-003")).toBe(true);
    });

    test("18.3 unsupported fact emits deterministic typed diagnostic", () => {
      const compiler = new RuntimePolicyFactCompiler();
      try {
        compiler.compile(makeFact({ factType: "Nope" as never }), COMPILER_CONFIG.schemaVersion);
      } catch (error) {
        const typed = error as RuntimePolicyFactCompilationError;
        expect(typed.diagnostic.code).toBe("GRT-POL-FACT-001");
      }
    });

    test("18.4 replay mismatch emits replay diagnostic", () => {
      const manager = new RuntimePolicyManager(makeConfig("ctx-a"));
      const result = manager.compileAndRegister(makeDefinition());
      const injected = { ...result.runtimePolicyIr!, runtimePolicyIrDigest: "tampered" } as RuntimePolicyIRRecord;
      expect(() => manager.replayDecision(injected, compileFacts([makeFact()]), makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId))).toThrow("GRT-POL-REPLAY-CTX-002");
    });
  });

  describe("Domain 19 - Telemetry", () => {
    test("19.2 manager increments compile/register/evaluate counters", () => {
      const manager = new RuntimePolicyManager(makeConfig("ctx-a"));
      const result = manager.compileAndRegister(makeDefinition());
      manager.evaluate(result.runtimePolicyIr!.runtimePolicyIrId, [makeFact()], makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId));
      const counters = manager.telemetrySnapshot().counters;
      expect((counters["policy.compiled"] ?? 0) >= 1).toBe(true);
      expect((counters["policy.registered"] ?? 0) >= 1).toBe(true);
      expect((counters["policy.evaluated"] ?? 0) >= 1).toBe(true);
    });

    test("19.3 decision outcome counters increment deterministically", () => {
      const manager = new RuntimePolicyManager(makeConfig("ctx-a"));
      const result = manager.compileAndRegister(makeDefinition());
      manager.evaluate(result.runtimePolicyIr!.runtimePolicyIrId, [makeFact({ factValue: "Active" })], makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId));
      const counters = manager.telemetrySnapshot().counters;
      expect((counters["policy.permit"] ?? 0) >= 1).toBe(true);
    });

    test("19.4 replay failure increments policy.replay.failed", () => {
      const manager = new RuntimePolicyManager(makeConfig("ctx-a"));
      const result = manager.compileAndRegister(makeDefinition());
      const injected = { ...result.runtimePolicyIr!, runtimePolicyIrDigest: "tampered" } as RuntimePolicyIRRecord;
      expect(() => manager.replayDecision(injected, compileFacts([makeFact()]), makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId))).toThrow();
      expect((manager.telemetrySnapshot().counters["policy.replay.failed"] ?? 0) >= 1).toBe(true);
    });
  });

  describe("Domain 20 - Replay", () => {
    test("20.1 identical replay preserves decision identity, digest, and trace", () => {
      const result = successfulCompilation();
      const facts = compileFacts([makeFact({ factValue: "Active" })]);
      const replay = new RuntimePolicyReplay();
      const baseline = replay.replay(result.runtimePolicyIr!, facts, makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId));
      const verification = replay.verify(result.runtimePolicyIr!, facts, makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId), baseline);
      expect(verification.matched).toBe(true);
      expect(verification.leftDecisionDigest).toBe(verification.rightDecisionDigest);
      expect(verification.leftTraceDigest).toBe(verification.rightTraceDigest);
      expect(verification.leftFactsDigest).toBe(verification.rightFactsDigest);
    });

    test("20.2 replay mismatch when deterministic artifact changes", () => {
      const result = successfulCompilation();
      const facts = compileFacts([makeFact({ factValue: "Active" })]);
      const replay = new RuntimePolicyReplay();
      const baseline = replay.replay(result.runtimePolicyIr!, facts, makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId));
      const mismatch = replay.verify(result.runtimePolicyIr!, compileFacts([makeFact({ factValue: "Suspended" })]), makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId), baseline);
      expect(mismatch.matched).toBe(false);
    });

    test("20.3 manager rejects injected RuntimePolicyIR not registered in context", () => {
      const manager = new RuntimePolicyManager(makeConfig("ctx-a"));
      const result = manager.compileAndRegister(makeDefinition());
      const injected = { ...result.runtimePolicyIr!, runtimePolicyIrId: "injected" } as RuntimePolicyIRRecord;
      expect(() => manager.replayDecision(injected, compileFacts([makeFact()]), makeContext("ctx-a", "injected"))).toThrow("GRT-POL-REPLAY-CTX-001");
    });

    test("20.4 manager rejects digest mismatch replays", () => {
      const manager = new RuntimePolicyManager(makeConfig("ctx-a"));
      const result = manager.compileAndRegister(makeDefinition());
      const tampered = { ...result.runtimePolicyIr!, runtimePolicyIrDigest: "digest-tampered" } as RuntimePolicyIRRecord;
      expect(() => manager.replayDecision(tampered, compileFacts([makeFact()]), makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId))).toThrow("GRT-POL-REPLAY-CTX-002");
    });
  });

  describe("Domain 21 - Adapters", () => {
    function sampleDecision(): RuntimePolicyDecision {
      const ir = successfulCompilation().runtimePolicyIr!;
      return new RuntimePolicyEvaluator().evaluate({
        runtimePolicyIr: ir,
        facts: compileFacts([makeFact({ factValue: "Active" })]),
        context: makeContext("ctx-a", ir.runtimePolicyIrId),
      });
    }

    test.each([
      ["capability", (decision: RuntimePolicyDecision) => new PolicyCapabilityDispatchAdapter().toDispatchIntent(decision)],
      ["permission", (decision: RuntimePolicyDecision) => new PolicyPermissionBridgeAdapter().toPermissionResult(decision)],
      ["workflow", (decision: RuntimePolicyDecision) => new PolicyWorkflowTransitionAdapter().toWorkflowTransitionGuard(decision)],
      ["execution", (decision: RuntimePolicyDecision) => new PolicyExecutionIntentAdapter().toExecutionIntentConstraint(decision)],
      ["scheduling", (decision: RuntimePolicyDecision) => new PolicySchedulingPlanAdapter().toSchedulingDirective(decision)],
      ["messaging", (decision: RuntimePolicyDecision) => new PolicyMessagingPublishAdapter().toMessagingDirective(decision)],
      ["service", (decision: RuntimePolicyDecision) => new PolicyServiceLifecycleAdapter().toServiceLifecycleGuard(decision)],
      ["host", (decision: RuntimePolicyDecision) => new PolicyHostOperationAdapter().toHostOperationGuard(decision)],
      ["decision-evidence", (decision: RuntimePolicyDecision) => new PolicyDecisionEvidenceAdapter().toEvidenceLink(decision)],
    ] as const)("21.x %s adapter returns immutable additive projection", (_, projector) => {
      const decision = sampleDecision();
      const before = JSON.stringify(decision);
      const projection = projector(decision);
      expect(Object.isFrozen(projection)).toBe(true);
      expect(JSON.stringify(decision)).toBe(before);
    });

    test("21.10 replay verification adapter projects replay result immutably", () => {
      const result = successfulCompilation();
      const facts = compileFacts([makeFact({ factValue: "Active" })]);
      const replay = new RuntimePolicyReplay();
      const baseline = replay.replay(result.runtimePolicyIr!, facts, makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId));
      const verified = replay.verify(result.runtimePolicyIr!, facts, makeContext("ctx-a", result.runtimePolicyIr!.runtimePolicyIrId), baseline);
      const projection = new PolicyReplayVerificationAdapter().toVerificationProjection(verified);
      expect(Object.isFrozen(projection)).toBe(true);
      expect(projection.matched).toBe(true);
    });
  });

  describe("Domain 22 - Public Export Surface", () => {
    test("22.1 core contracts are publicly exported and constructible", () => {
      expect(typeof RuntimePolicyCompiler).toBe("function");
      expect(typeof RuntimePolicyManager).toBe("function");
      expect(typeof RuntimePolicyIR).toBe("function");
      expect(typeof RuntimePolicyFactIR).toBe("function");
      expect(typeof RuntimePolicyReplay).toBe("function");
    });

    test("22.2 evaluator public surface requires RuntimePolicyIR and RuntimePolicyFactIR request shape", () => {
      const manager = new RuntimePolicyManager(makeConfig("ctx-a"));
      expect((manager as unknown as Record<string, unknown>).evaluateDefinition).toBeUndefined();
    });
  });

  describe("Domain 23 - Frozen Milestone Non-Regression", () => {
    test("23.1 GRT-0001 kernel behavior remains available", () => {
      expect(typeof RuntimeKernel).toBe("function");
      expect(typeof RuntimeKernel.prototype.boot).toBe("function");
    });

    test("23.2 GRT-0002 host behavior remains available", () => {
      expect(typeof EnterpriseHost).toBe("function");
      expect(typeof EnterpriseHost.prototype.bootstrap).toBe("function");
    });

    test("23.3 GRT-0003 services behavior remains available", () => {
      expect(typeof RuntimeServiceManager).toBe("function");
      expect(typeof RuntimeServiceManager.prototype.createExecutionContext).toBe("function");
    });

    test("23.5 GRT-0006/0007 behavior remains available for scheduling and workflows", () => {
      expect(typeof RuntimeObjectManager).toBe("function");
      expect(typeof RuntimeMessagingManager).toBe("function");
      expect(typeof RuntimeSchedulingManager).toBe("function");
      expect(typeof RuntimeWorkflowManager).toBe("function");
    });
  });
});
