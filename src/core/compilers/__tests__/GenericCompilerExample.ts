/**
 * Generic Compiler Example
 *
 * Demonstrates how to create a minimal compiler using GenesisCompiler framework
 *
 * This is a simple example compiler that:
 * 1. Takes generic JSON input
 * 2. Applies generic transformation passes
 * 3. Produces generic JSON output
 * 4. Requires NO domain-specific logic
 *
 * All infrastructure is inherited from GenesisCompiler
 */

import {
  GenesisCompiler,
  CompilerPass,
  CompilationState,
  PassResult,
  Diagnostic,
  getCurrentTimestamp,
} from "../framework";

// ============================================================================
// GENERIC INPUT/OUTPUT TYPES
// ============================================================================

/**
 * Generic input: just any JSON object
 */
interface GenericInput {
  [key: string]: any;
}

/**
 * Generic output: just any JSON object
 */
interface GenericOutput {
  [key: string]: any;
  _metadata?: {
    generatedAt: string;
    passCount: number;
  };
}

// ============================================================================
// GENERIC PASSES
// ============================================================================

/**
 * Generic pass 1: Add timestamp
 */
class AddTimestampPass implements CompilerPass<GenericInput, GenericOutput> {
  passId = "add-timestamp";
  passName = "Add Timestamp";
  passVersion = "1.0";
  dependencies: string[] = [];

  async execute(state: CompilationState<GenericInput, any>): Promise<
    PassResult<GenericOutput>
  > {
    const output: GenericOutput = {
      ...state.input,
      timestamp: getCurrentTimestamp(),
    };

    return {
      passId: this.passId,
      passVersion: this.passVersion,
      output,
      diagnostics: [],
      executionTimeMs: 1,
      timestamp: new Date().toISOString(),
      status: "success",
    };
  }
}

/**
 * Generic pass 2: Add metadata
 */
class AddMetadataPass implements CompilerPass<GenericInput, GenericOutput> {
  passId = "add-metadata";
  passName = "Add Metadata";
  passVersion = "1.0";
  dependencies = ["add-timestamp"];

  async execute(state: CompilationState<GenericInput, any>): Promise<
    PassResult<GenericOutput>
  > {
    // Get previous output
    const previousResult = state.intermediateResults.get("add-timestamp");
    if (!previousResult) {
      throw new Error("add-timestamp pass not executed");
    }

    const output: GenericOutput = {
      ...previousResult.output,
      _metadata: {
        generatedAt: getCurrentTimestamp(),
        passCount: state.intermediateResults.size + 1,
      },
    };

    return {
      passId: this.passId,
      passVersion: this.passVersion,
      output,
      diagnostics: [],
      executionTimeMs: 1,
      timestamp: new Date().toISOString(),
      status: "success",
    };
  }
}

// ============================================================================
// GENERIC COMPILER
// ============================================================================

/**
 * Generic compiler that transforms input to output
 *
 * EXAMPLE USAGE:
 *
 * ```typescript
 * const compiler = new GenericCompiler();
 * compiler.initialize();
 *
 * const input = { name: "test", value: 42 };
 * const result = await compiler.compile(input);
 *
 * if (result.success) {
 *   console.log("Output:", result.artifact);
 *   console.log("Quality:", result.metrics.qualityScore);
 * }
 * ```
 *
 * NO DOMAIN-SPECIFIC LOGIC:
 * - This compiler has no knowledge of business logic
 * - It just applies generic passes
 * - Subclasses can add business logic
 * - All infrastructure is inherited
 */
export class GenericCompiler extends GenesisCompiler<
  GenericInput,
  GenericOutput
> {
  protected compilerName = "GenericCompiler";
  protected compilerVersion = "1.0.0";

  /**
   * Register passes - only generic passes here
   */
  protected registerPasses(): void {
    this.registerPass(new AddTimestampPass());
    this.registerPass(new AddMetadataPass());
  }

  /**
   * Validate input - only generic checks
   */
  protected async validateInput(
    input: GenericInput
  ): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];

    // Check if input is object
    if (!input || typeof input !== "object") {
      diagnostics.push({
        code: "GENERIC-001",
        message: "Input must be a valid object",
        severity: "error",
        timestamp: getCurrentTimestamp(),
      });
    }

    return diagnostics;
  }

  /**
   * Validate output - only generic checks
   */
  protected async validateOutput(
    artifact: GenericOutput
  ): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];

    // Check if output is object
    if (!artifact || typeof artifact !== "object") {
      diagnostics.push({
        code: "GENERIC-002",
        message: "Output must be a valid object",
        severity: "error",
        timestamp: getCurrentTimestamp(),
      });
    }

    // Check if metadata was added
    if (!artifact._metadata) {
      diagnostics.push({
        code: "GENERIC-003",
        message: "Output missing _metadata",
        severity: "warning",
        timestamp: getCurrentTimestamp(),
      });
    }

    return diagnostics;
  }
}

// ============================================================================
// EXAMPLE USAGE
// ============================================================================

/**
 * Example: Using the generic compiler
 *
 * This shows how minimal the usage is:
 * 1. Create compiler
 * 2. Initialize
 * 3. Compile
 * 4. Get results
 *
 * Everything else is handled by the framework
 */
export async function exampleUsage() {
  // Create compiler
  const compiler = new GenericCompiler();

  // Initialize with default config
  compiler.initialize();

  // Prepare input
  const input: GenericInput = {
    name: "Example Project",
    description: "This is a generic example",
    tags: ["example", "generic"],
    value: 42,
  };

  // Compile
  const result = await compiler.compile(input);

  // Check result
  if (result.success) {
    console.log("✅ Compilation successful");
    console.log("Output:", result.artifact);
    console.log("Quality Score:", result.metrics.qualityScore);
    console.log("Execution Time:", result.metrics.totalExecutionTimeMs, "ms");
    console.log("Passes Completed:", result.summary.passesCompleted);
    console.log("Diagnostics:", result.diagnostics.length);
    console.log("Can Publish:", result.metadata.published);
  } else {
    console.log("❌ Compilation failed");
    console.log("Error:", result.error?.message);
    console.log("Diagnostics:", result.diagnostics);
  }

  // Cleanup
  compiler.shutdown();
}

/**
 * Example: Creating a specialized compiler
 *
 * This shows how to extend GenericCompiler with domain logic
 * WITHOUT modifying the framework code
 */
export class DomainSpecificCompiler extends GenericCompiler {
  protected compilerName = "DomainSpecificCompiler";
  protected compilerVersion = "2.0.0";

  /**
   * Can add domain-specific passes here
   */
  protected registerPasses(): void {
    // Call parent to get generic passes
    super.registerPasses();

    // Add domain-specific passes
    // this.registerPass(new DomainSpecificPass());
  }

  /**
   * Can add domain-specific validation here
   */
  protected async validateInput(
    input: GenericInput
  ): Promise<Diagnostic[]> {
    // Call parent validation
    const diagnostics = await super.validateInput(input);

    // Add domain-specific validation
    if (!input.id) {
      diagnostics.push({
        code: "DOMAIN-001",
        message: "Input must have id (domain requirement)",
        severity: "error",
        timestamp: getCurrentTimestamp(),
      });
    }

    return diagnostics;
  }
}

// ============================================================================
// TEST
// ============================================================================

/**
 * Simple test of generic compiler
 */
export async function testGenericCompiler() {
  console.log("Testing Generic Compiler...");

  const compiler = new GenericCompiler();
  compiler.initialize();

  const input: GenericInput = {
    id: "test-001",
    name: "Test Input",
    value: 123,
  };

  const result = await compiler.compile(input);

  // Verify result
  if (result.success) {
    console.log("✅ Generic compiler works!");
    console.log("  Passes:", result.summary.passesCompleted);
    console.log("  Quality:", result.metrics.qualityScore);
    console.log("  Artifact has timestamp:", !!result.artifact?.timestamp);
    console.log("  Artifact has metadata:", !!result.artifact?._metadata);
  } else {
    console.log("❌ Generic compiler failed!");
    console.log("  Error:", result.error?.message);
  }

  compiler.shutdown();
}
