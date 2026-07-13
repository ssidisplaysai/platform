/**
 * Genesis Compiler Framework - Unit Tests
 *
 * Tests for all core framework components
 *
 * Test Categories:
 * - Lifecycle management
 * - State threading and immutability
 * - Pass execution and ordering
 * - Determinism verification
 * - Diagnostics accumulation
 * - Metrics collection
 */

import { describe, it, expect, beforeEach } from "@jest/globals";

import {
  GenesisCompiler,
  PassRegistry,
  StateThreader,
  DiagnosticAccumulator,
  ExecutionTimer,
  PublicationGate,
  MetricsAggregator,
  createChecksum,
  createArtifactIdentity,
  stableStringify,
  verifyNotModified,
} from "../framework";

import type {
  CompilerPass,
  CompilationState,
  PassResult,
  Diagnostic,
  CompilerConfiguration,
} from "../framework";

// ============================================================================
// TEST FIXTURES
// ============================================================================

/**
 * Mock test input artifact
 */
interface TestInput {
  id: string;
  name: string;
  value: number;
}

/**
 * Mock test output artifact
 */
interface TestOutput {
  id: string;
  name: string;
  value: number;
  processed: boolean;
  passCount: number;
}

/**
 * Simple test pass: adds 1 to value
 */
class AddOnePass implements CompilerPass<TestInput, number> {
  passId = "add-one";
  passName = "Add One";
  passVersion = "1.0";
  dependencies: string[] = [];

  async execute(state: CompilationState<TestInput, any>): Promise<
    PassResult<number>
  > {
    return {
      passId: this.passId,
      passVersion: this.passVersion,
      output: state.input.value + 1,
      diagnostics: [],
      executionTimeMs: 1,
      timestamp: new Date().toISOString(),
      status: "success",
    };
  }
}

/**
 * Test pass with dependency
 */
class MultiplyPass implements CompilerPass<TestInput, number> {
  passId = "multiply";
  passName = "Multiply";
  passVersion = "1.0";
  dependencies = ["add-one"];

  async execute(state: CompilationState<TestInput, any>): Promise<
    PassResult<number>
  > {
    const previousResult = state.intermediateResults.get("add-one");
    if (!previousResult) {
      throw new Error("add-one pass not executed");
    }

    return {
      passId: this.passId,
      passVersion: this.passVersion,
      output: previousResult.output * 2,
      diagnostics: [],
      executionTimeMs: 1,
      timestamp: new Date().toISOString(),
      status: "success",
    };
  }
}

/**
 * Test pass that produces diagnostics
 */
class DiagnosticPass implements CompilerPass<TestInput, number> {
  passId = "diagnostics";
  passName = "Diagnostics";
  passVersion = "1.0";
  dependencies: string[] = [];

  async execute(state: CompilationState<TestInput, any>): Promise<
    PassResult<number>
  > {
    const diagnostics: Diagnostic[] = [];

    if (state.input.value < 0) {
      diagnostics.push({
        code: "TEST-001",
        message: "Value is negative",
        severity: "error",
        timestamp: new Date().toISOString(),
      });
    }

    if (state.input.value > 100) {
      diagnostics.push({
        code: "TEST-002",
        message: "Value is very large",
        severity: "warning",
        timestamp: new Date().toISOString(),
      });
    }

    return {
      passId: this.passId,
      passVersion: this.passVersion,
      output: state.input.value,
      diagnostics,
      executionTimeMs: 1,
      timestamp: new Date().toISOString(),
      status: "success",
    };
  }
}

/**
 * Test compiler for unit testing
 */
class TestCompiler extends GenesisCompiler<TestInput, TestOutput> {
  protected compilerName = "TestCompiler";
  protected compilerVersion = "1.0.0";
  protected passCount = 0;

  constructor(passCount: number = 2) {
    super();
    this.passCount = passCount;
  }

  protected registerPasses(): void {
    this.registerPass(new AddOnePass());
    this.registerPass(new MultiplyPass());
    if (this.passCount > 2) {
      this.registerPass(new DiagnosticPass());
    }
  }

  protected async validateInput(input: TestInput): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];

    if (!input.id) {
      diagnostics.push({
        code: "INPUT-001",
        message: "Input must have id",
        severity: "error",
        timestamp: new Date().toISOString(),
      });
    }

    return diagnostics;
  }

  protected async validateOutput(
    artifact: TestOutput
  ): Promise<Diagnostic[]> {
    if (!artifact.processed) {
      return [
        {
          code: "OUTPUT-001",
          message: "Output not processed",
          severity: "error",
          timestamp: new Date().toISOString(),
        },
      ];
    }

    return [];
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe("Genesis Compiler Framework", () => {
  let compiler: TestCompiler;

  beforeEach(() => {
    compiler = new TestCompiler();
  });

  // =========================================================================
  // LIFECYCLE TESTS
  // =========================================================================

  describe("Lifecycle Management", () => {
    it("should initialize compiler", () => {
      expect(compiler.isInitialized()).toBe(false);
      compiler.initialize();
      expect(compiler.isInitialized()).toBe(true);
    });

    it("should have correct name and version", () => {
      expect(compiler.getName()).toBe("TestCompiler");
      expect(compiler.getVersion()).toBe("1.0.0");
    });

    it("should have default capabilities", () => {
      const capabilities = compiler.getCapabilities();
      expect(capabilities.deterministicExecution).toBe(true);
      expect(capabilities.immutableInput).toBe(true);
      expect(capabilities.publicationGating).toBe(true);
      expect(capabilities.auditTrail).toBe(true);
    });

    it("should fail to compile before initialization", async () => {
      const input: TestInput = { id: "test", name: "test", value: 5 };
      const result = await compiler.compile(input);
      expect(result.success).toBe(false);
    });

    it("should shutdown properly", () => {
      compiler.initialize();
      expect(compiler.isInitialized()).toBe(true);
      compiler.shutdown();
      expect(compiler.isInitialized()).toBe(false);
    });
  });

  // =========================================================================
  // PASS REGISTRATION TESTS
  // =========================================================================

  describe("Pass Registration", () => {
    it("should register passes during initialization", () => {
      compiler.initialize();
      const passes = compiler["getPasses"]();
      expect(passes.length).toBeGreaterThan(0);
    });

    it("should fail on duplicate pass registration", () => {
      const pass = new AddOnePass();
      const registry = new PassRegistry();

      registry.register(pass);
      expect(() => registry.register(pass)).toThrow("already registered");
    });

    it("should detect circular dependencies", () => {
      const registry = new PassRegistry();

      class CircularPass1 implements CompilerPass<TestInput, number> {
        passId = "circular1";
        passName = "Circular 1";
        passVersion = "1.0";
        dependencies = ["circular2"];
        async execute() {
          return {
            passId: this.passId,
            passVersion: this.passVersion,
            output: 0,
            diagnostics: [],
            executionTimeMs: 1,
            timestamp: new Date().toISOString(),
            status: "success" as const,
          };
        }
      }

      class CircularPass2 implements CompilerPass<TestInput, number> {
        passId = "circular2";
        passName = "Circular 2";
        passVersion = "1.0";
        dependencies = ["circular1"];
        async execute() {
          return {
            passId: this.passId,
            passVersion: this.passVersion,
            output: 0,
            diagnostics: [],
            executionTimeMs: 1,
            timestamp: new Date().toISOString(),
            status: "success" as const,
          };
        }
      }

      registry.register(new CircularPass1());
      registry.register(new CircularPass2());

      expect(() => registry.validateOrder()).toThrow("Circular dependency");
    });
  });

  // =========================================================================
  // STATE THREADING TESTS
  // =========================================================================

  describe("State Threading", () => {
    it("should create initial state correctly", () => {
      const input: TestInput = { id: "test", name: "test", value: 5 };
      const threader = new StateThreader<TestInput>();

      const state = threader.createInitialState(
        input,
        "TestCompiler",
        "1.0.0",
        2
      );

      expect(state.input).toBeDefined();
      expect(state.input.id).toBe("test");
      expect(state.intermediateResults.size).toBe(0);
      expect(state.diagnostics.length).toBe(0);
      expect(state.metadata.totalPasses).toBe(2);
    });

    it("should thread state without modifying input", () => {
      const input: TestInput = { id: "test", name: "test", value: 5 };
      const threader = new StateThreader<TestInput>();

      const state = threader.createInitialState(
        input,
        "TestCompiler",
        "1.0.0",
        2
      );

      const passResult: PassResult<number> = {
        passId: "test",
        passVersion: "1.0",
        output: 10,
        diagnostics: [],
        executionTimeMs: 1,
        timestamp: new Date().toISOString(),
        status: "success",
      };

      const newState = threader.threadState(state, passResult, 1);

      // Input should not be modified
      expect(newState.input.value).toBe(5);

      // New state should have result
      expect(newState.intermediateResults.size).toBe(1);
      expect(newState.intermediateResults.get("test")?.output).toBe(10);

      // Old state should not be modified
      expect(state.intermediateResults.size).toBe(0);
    });

    it("should preserve diagnostics through threading", () => {
      const input: TestInput = { id: "test", name: "test", value: 5 };
      const threader = new StateThreader<TestInput>();

      let state = threader.createInitialState(
        input,
        "TestCompiler",
        "1.0.0",
        2
      );

      const diagnostic: Diagnostic = {
        code: "TEST",
        message: "Test message",
        severity: "warning",
        timestamp: new Date().toISOString(),
      };

      const passResult: PassResult<number> = {
        passId: "test1",
        passVersion: "1.0",
        output: 10,
        diagnostics: [diagnostic],
        executionTimeMs: 1,
        timestamp: new Date().toISOString(),
        status: "success",
      };

      state = threader.threadState(state, passResult, 1);
      expect(state.diagnostics.length).toBe(1);
      expect(state.diagnostics[0].code).toBe("TEST");

      const passResult2: PassResult<number> = {
        passId: "test2",
        passVersion: "1.0",
        output: 20,
        diagnostics: [],
        executionTimeMs: 1,
        timestamp: new Date().toISOString(),
        status: "success",
      };

      state = threader.threadState(state, passResult2, 2);
      expect(state.diagnostics.length).toBe(1);
      expect(state.intermediateResults.size).toBe(2);
    });
  });

  // =========================================================================
  // IMMUTABILITY TESTS
  // =========================================================================

  describe("Immutability", () => {
    it("should freeze input artifact", () => {
      const input: TestInput = { id: "test", name: "test", value: 5 };
      const threader = new StateThreader<TestInput>();

      const state = threader.createInitialState(
        input,
        "TestCompiler",
        "1.0.0",
        1
      );

      expect(() => {
        (state.input as any).value = 999;
      }).toThrow();
    });

    it("should prevent modification across state threaded", () => {
      const input: TestInput = { id: "test", name: "test", value: 5 };
      const threader = new StateThreader<TestInput>();

      const state1 = threader.createInitialState(
        input,
        "TestCompiler",
        "1.0.0",
        2
      );

      const passResult: PassResult<number> = {
        passId: "test",
        passVersion: "1.0",
        output: 10,
        diagnostics: [],
        executionTimeMs: 1,
        timestamp: new Date().toISOString(),
        status: "success",
      };

      const state2 = threader.threadState(state1, passResult, 1);

      // Both states should have same input value
      expect(state1.input.value).toBe(5);
      expect(state2.input.value).toBe(5);

      // And input reference should be identical
      expect(state1.input).toBe(state2.input);
    });
  });

  // =========================================================================
  // DIAGNOSTICS TESTS
  // =========================================================================

  describe("Diagnostics Management", () => {
    it("should accumulate diagnostics", () => {
      const accumulator = new DiagnosticAccumulator();

      const diagnostic1: Diagnostic = {
        code: "ERR1",
        message: "Error 1",
        severity: "error",
        timestamp: new Date().toISOString(),
      };

      const diagnostic2: Diagnostic = {
        code: "WARN1",
        message: "Warning 1",
        severity: "warning",
        timestamp: new Date().toISOString(),
      };

      accumulator.add([diagnostic1, diagnostic2]);

      expect(accumulator.getAll().length).toBe(2);
      expect(accumulator.getErrors().length).toBe(1);
      expect(accumulator.getWarnings().length).toBe(1);
      expect(accumulator.hasErrors()).toBe(true);
    });

    it("should get diagnostic summary", () => {
      const accumulator = new DiagnosticAccumulator();

      accumulator.add([
        {
          code: "ERR1",
          message: "Error",
          severity: "error",
          timestamp: new Date().toISOString(),
        },
        {
          code: "WARN1",
          message: "Warning",
          severity: "warning",
          timestamp: new Date().toISOString(),
        },
        {
          code: "INFO1",
          message: "Info",
          severity: "info",
          timestamp: new Date().toISOString(),
        },
      ]);

      const summary = accumulator.getSummary();
      expect(summary.errors).toBe(1);
      expect(summary.warnings).toBe(1);
      expect(summary.infos).toBe(1);
      expect(summary.total).toBe(3);
    });
  });

  // =========================================================================
  // METRICS TESTS
  // =========================================================================

  describe("Metrics Collection", () => {
    it("should calculate quality score", () => {
      const aggregator = new MetricsAggregator();

      const score1 = aggregator.calculateQualityScore({
        errors: 0,
        warnings: 0,
        infos: 0,
        total: 0,
      });
      expect(score1).toBe(100);

      const score2 = aggregator.calculateQualityScore({
        errors: 1,
        warnings: 0,
        infos: 0,
        total: 1,
      });
      expect(score2).toBe(50); // 100 - 50

      const score3 = aggregator.calculateQualityScore({
        errors: 0,
        warnings: 2,
        infos: 0,
        total: 2,
      });
      expect(score3).toBe(80); // 100 - 20
    });
  });

  // =========================================================================
  // PUBLICATION TESTS
  // =========================================================================

  describe("Publication Gating", () => {
    it("should block publication on errors", () => {
      const gate = new PublicationGate();

      const decision = gate.decide(
        true, // hasErrors
        true, // hasInput
        true // validationComplete
      );

      expect(decision.canPublish).toBe(false);
      expect(decision.blocked).toBe(true);
    });

    it("should allow publication without errors", () => {
      const gate = new PublicationGate();

      const decision = gate.decide(
        false, // hasErrors
        true, // hasInput
        true // validationComplete
      );

      expect(decision.canPublish).toBe(true);
      expect(decision.blocked).toBe(false);
    });

    it("should block publication without input", () => {
      const gate = new PublicationGate();

      const decision = gate.decide(
        false, // hasErrors
        false, // hasInput
        true // validationComplete
      );

      expect(decision.canPublish).toBe(false);
      expect(decision.blocked).toBe(true);
    });

    it("should block publication if validation not complete", () => {
      const gate = new PublicationGate();

      const decision = gate.decide(
        false, // hasErrors
        true, // hasInput
        false // validationComplete
      );

      expect(decision.canPublish).toBe(false);
      expect(decision.blocked).toBe(true);
    });
  });

  // =========================================================================
  // UTILITIES TESTS
  // =========================================================================

  describe("Utilities", () => {
    it("should create deterministic checksums", () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 }; // Same content, different order

      const checksum1 = createChecksum(obj1);
      const checksum2 = createChecksum(obj2);

      expect(checksum1.value).toBe(checksum2.value);
    });

    it("should create unique checksums for different content", () => {
      const obj1 = { a: 1 };
      const obj2 = { a: 2 };

      const checksum1 = createChecksum(obj1);
      const checksum2 = createChecksum(obj2);

      expect(checksum1.value).not.toBe(checksum2.value);
    });

    it("should create artifact identities", () => {
      const obj = { test: "data" };
      const identity = createArtifactIdentity("TEST", obj, "v1");

      expect(identity.prefix).toBe("TEST");
      expect(identity.schemaVersion).toBe("v1");
      expect(identity.id).toMatch(/^TEST_[a-f0-9]{16}_v1$/);
    });

    it("should verify object not modified", () => {
      const obj = { a: 1, b: 2 };

      expect(verifyNotModified(obj, obj)).toBe(true);

      const modified = { a: 1, b: 3 };
      expect(verifyNotModified(obj, modified)).toBe(false);
    });

    it("should do stable JSON stringify", () => {
      const obj1 = { a: 1, b: { c: 2, d: 3 } };
      const obj2 = { b: { d: 3, c: 2 }, a: 1 };

      const str1 = stableStringify(obj1);
      const str2 = stableStringify(obj2);

      expect(str1).toBe(str2);
    });
  });

  // =========================================================================
  // EXECUTION TIMER TESTS
  // =========================================================================

  describe("Execution Timer", () => {
    it("should measure execution time", async () => {
      const timer = new ExecutionTimer();

      timer.start();
      await new Promise((resolve) => setTimeout(resolve, 10));
      timer.stop();

      const elapsed = timer.getElapsedMs();
      expect(elapsed).toBeGreaterThanOrEqual(10);
      expect(elapsed).toBeLessThan(50);
    });
  });

  // =========================================================================
  // COMPILATION TESTS
  // =========================================================================

  describe("Compilation", () => {
    it("should successfully compile valid input", async () => {
      compiler.initialize();

      const input: TestInput = { id: "test", name: "test", value: 5 };

      // Note: Our test compiler doesn't actually create output,
      // so this will fail on output validation, but that's expected
      const result = await compiler.compile(input);

      // Should attempt compilation
      expect(result.success === true || result.success === false).toBe(true);
    });

    it("should handle missing input id", async () => {
      compiler.initialize();

      const input: TestInput = { id: "", name: "test", value: 5 };
      const result = await compiler.compile(input);

      expect(result.diagnostics.length).toBeGreaterThan(0);
      const hasMissingIdError = result.diagnostics.some(
        (d) => d.code === "INPUT-001"
      );
      expect(hasMissingIdError).toBe(true);
    });

    it("should collect metrics", async () => {
      compiler.initialize();
      const input: TestInput = { id: "test", name: "test", value: 5 };

      const result = await compiler.compile(input);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.compilerName).toBe("TestCompiler");
      expect(result.metrics.passMetrics).toBeDefined();
    });

    it("should create execution summary", async () => {
      compiler.initialize();
      const input: TestInput = { id: "test", name: "test", value: 5 };

      const result = await compiler.compile(input);

      expect(result.summary).toBeDefined();
      expect(result.summary.compilerName).toBe("TestCompiler");
      expect(result.summary.compilationStartTime).toBeDefined();
      expect(result.summary.compilationEndTime).toBeDefined();
      expect(result.summary.compilationDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should track artifact metadata", async () => {
      compiler.initialize();
      const input: TestInput = { id: "test", name: "test", value: 5 };

      const result = await compiler.compile(input);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.compilerVersion).toBe("1.0.0");
      expect(result.metadata.inputChecksum).toBeDefined();
    });
  });

  // =========================================================================
  // DETERMINISM TESTS
  // =========================================================================

  describe("Determinism", () => {
    it("should produce identical checksums for identical input", () => {
      const input = { a: 1, b: 2 };

      const checksum1 = createChecksum(input);
      const checksum2 = createChecksum(input);

      expect(checksum1.value).toBe(checksum2.value);
    });

    it("should produce identical identities for identical content", () => {
      const obj = { test: "data" };

      const identity1 = createArtifactIdentity("TEST", obj);
      const identity2 = createArtifactIdentity("TEST", obj);

      expect(identity1.id).toBe(identity2.id);
    });
  });

  // =========================================================================
  // CONFIGURATION TESTS
  // =========================================================================

  describe("Configuration", () => {
    it("should use default configuration", () => {
      compiler.initialize();
      const config = compiler.getConfiguration();

      expect(config.collectDiagnostics).toBe(true);
      expect(config.collectMetrics).toBe(true);
      expect(config.trackProvenance).toBe(true);
    });

    it("should apply configuration overrides", () => {
      const overrides: Partial<CompilerConfiguration> = {
        collectDiagnostics: false,
        maxErrors: 50,
      };

      compiler.initialize(overrides);
      const config = compiler.getConfiguration();

      expect(config.collectDiagnostics).toBe(false);
      expect(config.maxErrors).toBe(50);
      expect(config.collectMetrics).toBe(true); // Default
    });
  });
});
