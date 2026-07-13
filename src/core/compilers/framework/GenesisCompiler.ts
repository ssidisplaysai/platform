/**
 * Genesis Compiler Framework - Core Compiler
 *
 * Abstract base class for all deterministic Genesis compilers
 *
 * All compilers must:
 * - Extend this class
 * - Implement abstract methods
 * - Register passes via registerPass()
 * - Call super.initialize()
 */

import {
  CompilerConfiguration,
  CompilerCapabilities,
  CompilerPass,
  CompilationState,
  CompilerResult,
  PassResult,
  Diagnostic,
  CompilerExecutionMetrics,
  CompilerExecutionSummary,
  PublicationDecision,
  ArtifactVersion,
} from "./types";

import {
  DEFAULT_COMPILER_CAPABILITIES,
  buildCompilerConfig,
} from "./CompilerConfiguration";

import {
  PassRegistry,
  StateThreader,
  DiagnosticAccumulator,
  ExecutionTimer,
} from "./CompilerExecutionContext";

import {
  ManifestGenerator,
  MetadataBuilder,
  PublicationGate,
  MetricsAggregator,
} from "./CompilerMetadata";

import {
  createChecksum,
  createArtifactIdentity,
  getCurrentTimestamp,
  stableStringify,
  deepCopy,
} from "./CompilerUtilities";

/**
 * Abstract base class for all Genesis compilers
 *
 * GUARANTEES:
 * - Deterministic execution: identical input → identical output
 * - Immutable input: input artifact never modified
 * - State threading: each pass receives complete state
 * - Diagnostic preservation: all diagnostics accumulated
 * - Publication gating: errors block publication
 *
 * LIFECYCLE:
 * 1. new Compiler()
 * 2. initialize(config)
 * 3. compile(input) → CompilerResult
 * 4. getMetrics(), getDiagnostics(), etc.
 * 5. shutdown()
 */
export abstract class GenesisCompiler<TInput, TArtifact> {
  /**
   * Unique compiler name (must be set by subclass)
   */
  protected abstract compilerName: string;

  /**
   * Compiler version (must be set by subclass)
   */
  protected abstract compilerVersion: string;

  /**
   * Get compiler capabilities (can be overridden)
   */
  protected getCompilerCapabilities(): CompilerCapabilities {
    return { ...DEFAULT_COMPILER_CAPABILITIES };
  }

  // =========================================================================
  // INTERNAL STATE
  // =========================================================================

  private config: CompilerConfiguration = buildCompilerConfig();
  private passRegistry: PassRegistry = new PassRegistry();
  private stateThreader: StateThreader<TInput> = new StateThreader();
  private diagnosticAccumulator: DiagnosticAccumulator =
    new DiagnosticAccumulator();
  private manifestGenerator: ManifestGenerator = new ManifestGenerator();
  private metadataBuilder: MetadataBuilder<TArtifact> = new MetadataBuilder();
  private publicationGate: PublicationGate = new PublicationGate();
  private metricsAggregator: MetricsAggregator = new MetricsAggregator();

  private lastResult?: CompilerResult<TArtifact>;
  private initialized = false;

  // =========================================================================
  // INITIALIZATION
  // =========================================================================

  /**
   * Initialize compiler
   *
   * MUST be called before compile()
   *
   * Steps:
   * 1. Validate passes
   * 2. Determine pass order
   * 3. Set configuration
   * 4. Mark as initialized
   */
  public initialize(
    configOverrides?: Partial<CompilerConfiguration>
  ): void {
    // Build configuration
    this.config = buildCompilerConfig(configOverrides);

    // Allow subclass to register passes
    this.registerPasses();

    // Validate pass registration
    this.passRegistry.validateOrder();

    // Mark as initialized
    this.initialized = true;
  }

  /**
   * Subclass must implement this to register passes
   *
   * Example:
   * ```
   * protected registerPasses(): void {
   *   this.registerPass(new MyPass1());
   *   this.registerPass(new MyPass2());
   * }
   * ```
   */
  protected abstract registerPasses(): void;

  /**
   * Subclass must implement input validation
   *
   * Should return diagnostics, not throw
   */
  protected abstract validateInput(input: TInput): Promise<Diagnostic[]>;

  /**
   * Subclass must implement output validation
   *
   * Should return diagnostics, not throw
   */
  protected abstract validateOutput(
    artifact: TArtifact,
    state: CompilationState<TInput, any>
  ): Promise<Diagnostic[]>;

  /**
   * Get artifact version (can be overridden)
   */
  protected getArtifactVersion(): ArtifactVersion {
    const parts = this.compilerVersion.split(".");
    return {
      major: parseInt(parts[0], 10) || 1,
      minor: parseInt(parts[1], 10) || 0,
      patch: parseInt(parts[2], 10) || 0,
      prerelease: undefined,
      toString() {
        return `${this.major}.${this.minor}.${this.patch}`;
      },
    };
  }

  // =========================================================================
  // COMPILATION
  // =========================================================================

  /**
   * Compile input artifact
   *
   * MAIN ENTRY POINT
   *
   * GUARANTEES:
   * - Input is never modified
   * - Execution is deterministic
   * - All diagnostics are preserved
   * - Result includes metrics and metadata
   */
  public async compile(input: TInput): Promise<CompilerResult<TArtifact>> {
    const timer = new ExecutionTimer();
    timer.start();

    if (!this.initialized) {
      const diagnostic: Diagnostic = {
        code: "COMPILER_NOT_INITIALIZED",
        message:
          "Compiler not initialized. Call initialize() before compile()",
        severity: "error",
        sourceElement: "framework",
        timestamp: new Date().toISOString(),
      };
      this.diagnosticAccumulator.clear();
      this.diagnosticAccumulator.add([diagnostic]);
      timer.stop();
      return this.createFailureResult(
        input,
        "Compiler not initialized",
        timer.getElapsedMs()
      );
    }

    try {
      // Step 1: Input validation
      const inputDiagnostics = await this.validateInput(input);
      this.diagnosticAccumulator.clear();
      this.diagnosticAccumulator.add(inputDiagnostics);

      if (this.config.failFast && this.diagnosticAccumulator.hasErrors()) {
        timer.stop();
        return this.createFailureResult(
          input,
          "Input validation failed",
          timer.getElapsedMs()
        );
      }

      // Step 2: Create initial state
      const orderedPasses = this.passRegistry.getOrderedPasses();
      const state = this.stateThreader.createInitialState(
        input,
        this.compilerName,
        this.compilerVersion,
        orderedPasses.length
      );

      // Step 3: Execute pipeline
      let currentState = state;
      for (let i = 0; i < orderedPasses.length; i++) {
        const pass = orderedPasses[i];

        try {
          const passResult = await this.executePass(pass, currentState);

          // Add diagnostics
          this.diagnosticAccumulator.add(passResult.diagnostics);

          // Thread state
          currentState = this.stateThreader.threadState(
            currentState,
            passResult,
            i + 1
          );

          // Check fail-fast
          if (
            this.config.failFast &&
            this.diagnosticAccumulator.hasErrors()
          ) {
            timer.stop();
            return this.createFailureResult(
              input,
              `Pass ${pass.passId} produced errors`,
              timer.getElapsedMs()
            );
          }

          // Check max errors
          if (
            this.diagnosticAccumulator.getErrors().length > this.config.maxErrors
          ) {
            timer.stop();
            return this.createFailureResult(
              input,
              `Max errors (${this.config.maxErrors}) exceeded`,
              timer.getElapsedMs()
            );
          }
        } catch (error) {
          timer.stop();
          return this.createFailureResult(
            input,
            `Pass ${pass.passId} failed: ${error}`,
            timer.getElapsedMs(),
            error as Error
          );
        }
      }

      // Step 4: Get final output
      const lastPassResult = currentState.intermediateResults.get(
        orderedPasses[orderedPasses.length - 1].passId
      ) as PassResult<TArtifact> | undefined;

      if (!lastPassResult) {
        timer.stop();
        return this.createFailureResult(
          input,
          "No output produced",
          timer.getElapsedMs()
        );
      }

      const artifact = lastPassResult.output;

      // Step 5: Output validation
      const outputDiagnostics = await this.validateOutput(artifact, currentState);
      this.diagnosticAccumulator.add(outputDiagnostics);

      // Step 6: Create result
      timer.stop();
      const result = await this.createSuccessResult(
        input,
        artifact,
        currentState,
        orderedPasses.length,
        timer.getElapsedMs()
      );

      this.lastResult = result;
      return result;
    } catch (error) {
      timer.stop();
      return this.createFailureResult(
        input,
        `Compilation failed: ${error}`,
        timer.getElapsedMs(),
        error as Error
      );
    }
  }

  /**
   * Execute single pass
   *
   * GUARANTEES:
   * - Pass cannot modify input
   * - Pass cannot modify previous outputs
   * - All exceptions are caught
   */
  private async executePass(
    pass: CompilerPass<any, any>,
    state: CompilationState<TInput, any>
  ): Promise<PassResult<any>> {
    const timer = new ExecutionTimer();
    timer.start();

    try {
      const result = await pass.execute(state);
      timer.stop();

      return {
        ...result,
        executionTimeMs: timer.getElapsedMs(),
        timestamp: getCurrentTimestamp(),
        status: result.status || "success",
      };
    } catch (error) {
      timer.stop();

      return {
        passId: pass.passId,
        passVersion: pass.passVersion,
        output: undefined,
        diagnostics: [
          {
            code: "PASS_EXECUTION_ERROR",
            message: `Pass ${pass.passId} failed: ${error}`,
            severity: "error",
            timestamp: getCurrentTimestamp(),
          },
        ],
        executionTimeMs: timer.getElapsedMs(),
        timestamp: getCurrentTimestamp(),
        status: "failed",
        error: error as Error,
      };
    }
  }

  // =========================================================================
  // RESULT CREATION
  // =========================================================================

  /**
   * Create successful compilation result
   */
  private async createSuccessResult(
    input: TInput,
    artifact: TArtifact,
    state: CompilationState<TInput, any>,
    passCount: number,
    totalTimeMs: number
  ): Promise<CompilerResult<TArtifact>> {
    // Create checksums
    const inputChecksum = createChecksum(input);
    const outputChecksum = createChecksum(artifact);

    // Create identity
    const identity = createArtifactIdentity(
      this.compilerName,
      artifact,
      "v1"
    );

    // Create manifest
    const allPassResults = this.stateThreader.getAllPassResults(state);
    const manifest = this.manifestGenerator.generate(
      this.compilerName,
      this.compilerVersion,
      state.metadata.startTime,
      allPassResults,
      this.diagnosticAccumulator.getSummary()
    );

    // Make publication decision
    const publicationDecision = this.publicationGate.decide(
      this.diagnosticAccumulator.hasErrors(),
      !!input,
      true // Validation complete
    );

    // Create metadata
    const metadata = this.metadataBuilder.build(
      this.compilerName,
      this.compilerVersion,
      identity.id,
      this.getArtifactVersion(),
      "1.0",
      state.metadata.startTime,
      manifest,
      inputChecksum,
      artifact,
      publicationDecision
    );

    // Create metrics
    const metrics: CompilerExecutionMetrics = {
      compilerName: this.compilerName,
      compilerVersion: this.compilerVersion,
      totalExecutionTimeMs: totalTimeMs,
      passMetrics: manifest.passHistory,
      diagnosticSummary: this.diagnosticAccumulator.getSummary(),
      qualityScore: this.metricsAggregator.calculateQualityScore(
        this.diagnosticAccumulator.getSummary()
      ),
    };

    // Create summary
    const endTime = getCurrentTimestamp();
    const summary: CompilerExecutionSummary = {
      success: true,
      compilerName: this.compilerName,
      compilerVersion: this.compilerVersion,
      compilationStartTime: state.metadata.startTime,
      compilationEndTime: endTime,
      compilationDurationMs: totalTimeMs,
      passCount,
      passesCompleted: passCount,
      diagnosticSummary: this.diagnosticAccumulator.getSummary(),
      metrics,
      publicationDecision,
    };

    return {
      success: true,
      artifact,
      metadata,
      summary,
      diagnostics: this.diagnosticAccumulator.getAll(),
      metrics,
      provenance: state.provenance,
      lineage: state.lineage,
    };
  }

  /**
   * Create failure compilation result
   */
  private createFailureResult(
    input: TInput,
    errorMessage: string,
    totalTimeMs: number,
    error?: Error
  ): CompilerResult<TArtifact> {
    const inputChecksum = createChecksum(input);
    const startTime = getCurrentTimestamp();

    const metadata = this.metadataBuilder.build(
      this.compilerName,
      this.compilerVersion,
      "unknown",
      this.getArtifactVersion(),
      "1.0",
      startTime,
      {
        compilerName: this.compilerName,
        compilerVersion: this.compilerVersion,
        compilationTimestamp: startTime,
        compilationDurationMs: totalTimeMs,
        passHistory: [],
        diagnosticSummary: this.diagnosticAccumulator.getSummary(),
        checksums: {},
      },
      inputChecksum
    );

    const metrics: CompilerExecutionMetrics = {
      compilerName: this.compilerName,
      compilerVersion: this.compilerVersion,
      totalExecutionTimeMs: totalTimeMs,
      passMetrics: [],
      diagnosticSummary: this.diagnosticAccumulator.getSummary(),
      qualityScore: 0,
    };

    const publicationDecision = this.publicationGate.decide(
      true,
      !!input,
      false
    );

    const summary: CompilerExecutionSummary = {
      success: false,
      compilerName: this.compilerName,
      compilerVersion: this.compilerVersion,
      compilationStartTime: startTime,
      compilationEndTime: getCurrentTimestamp(),
      compilationDurationMs: totalTimeMs,
      passCount: 0,
      passesCompleted: 0,
      failedPassError: errorMessage,
      diagnosticSummary: this.diagnosticAccumulator.getSummary(),
      metrics,
      publicationDecision,
    };

    return {
      success: false,
      metadata,
      summary,
      diagnostics: this.diagnosticAccumulator.getAll(),
      metrics,
      provenance: { entries: [] },
      lineage: { chain: [] },
      error,
    };
  }

  // =========================================================================
  // PASS REGISTRATION
  // =========================================================================

  /**
   * Register a pass
   *
   * Called during registerPasses()
   */
  protected registerPass(pass: CompilerPass<any, any>): void {
    this.passRegistry.register(pass);
  }

  /**
   * Get all passes
   */
  protected getPasses(): CompilerPass<any, any>[] {
    return this.passRegistry.getAllPasses();
  }

  // =========================================================================
  // ACCESSORS
  // =========================================================================

  /**
   * Get last compilation result
   */
  public getLastResult(): CompilerResult<TArtifact> | undefined {
    return this.lastResult;
  }

  /**
   * Get current diagnostics
   */
  public getDiagnostics(): Diagnostic[] {
    return this.diagnosticAccumulator.getAll();
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): CompilerConfiguration {
    return { ...this.config };
  }

  /**
   * Get compiler capabilities
   */
  public getCapabilities(): CompilerCapabilities {
    return this.getCompilerCapabilities();
  }

  /**
   * Get compiler name
   */
  public getName(): string {
    return this.compilerName;
  }

  /**
   * Get compiler version
   */
  public getVersion(): string {
    return this.compilerVersion;
  }

  /**
   * Is compiler initialized?
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  /**
   * Shutdown compiler
   *
   * Cleanup resources
   */
  public shutdown(): void {
    this.passRegistry = new PassRegistry();
    this.diagnosticAccumulator.clear();
    this.initialized = false;
  }

  /**
   * Reset state
   */
  public reset(): void {
    this.lastResult = undefined;
    this.diagnosticAccumulator.clear();
  }
}
