/**
 * Genesis Compiler Framework - Execution Context
 *
 * Manages compilation state and pass execution
 */

import {
  CompilationState,
  CompilationStateMetadata,
  CompilerPass,
  Diagnostic,
  LineageEntry,
  LineageIndex,
  PassResult,
  ProvenanceEntry,
  ProvenanceIndex,
} from "./types";
import {
  getCurrentTimestamp,
  stableStringify,
  verifyNotModified,
} from "./CompilerUtilities";

/**
 * State threading - manages immutable compilation state through pipeline
 *
 * Creates new state objects, never modifies existing ones
 */
export class StateThreader<TInput> {
  /**
   * Create initial compilation state
   */
  public createInitialState(
    input: TInput,
    compilerName: string,
    compilerVersion: string,
    totalPasses: number
  ): CompilationState<TInput, any> {
    // Store original JSON for later verification
    const originalJson = stableStringify(input);

    // Create initial state
    const state: CompilationState<TInput, any> = {
      input: Object.freeze(JSON.parse(originalJson)) as Readonly<TInput>,
      intermediateResults: new Map(),
      diagnostics: [],
      currentPass: null,
      metadata: {
        compilerName,
        compilerVersion,
        startTime: getCurrentTimestamp(),
        currentPassIndex: 0,
        totalPasses,
      },
      provenance: {
        entries: [],
      },
      lineage: {
        chain: [],
      },
    };

    return state;
  }

  /**
   * Thread state: create new state with pass result added
   *
   * GUARANTEES:
   * - Input artifact is never modified
   * - Previous pass results are never modified
   * - Returns new state object
   */
  public threadState<TInput>(
    previousState: CompilationState<TInput, any>,
    passResult: PassResult<any>,
    passIndex: number
  ): CompilationState<TInput, any> {
    // Verify input was not modified
    const inputStillValid = verifyNotModified(
      previousState.input,
      previousState.input
    );
    if (!inputStillValid) {
      throw new Error("INVARIANT VIOLATION: Input artifact was modified");
    }

    // Create new intermediate results map
    const newIntermediateResults = new Map(previousState.intermediateResults);
    newIntermediateResults.set(passResult.passId, passResult);

    // Create new diagnostics array
    const newDiagnostics = [...previousState.diagnostics];
    newDiagnostics.push(...passResult.diagnostics);

    // Create new provenance entries
    const newProvenanceEntries = [...previousState.provenance.entries];

    // Create new lineage entries
    const newLineageChain = [...previousState.lineage.chain];

    // Create new state (immutable threading)
    const newState: CompilationState<TInput, any> = {
      input: previousState.input, // SAME REFERENCE (immutable)
      intermediateResults: newIntermediateResults,
      diagnostics: newDiagnostics,
      currentPass: passResult.passId,
      metadata: {
        ...previousState.metadata,
        currentPassIndex: passIndex,
      },
      provenance: {
        entries: newProvenanceEntries,
      },
      lineage: {
        chain: newLineageChain,
      },
    };

    return newState;
  }

  /**
   * Get pass result by ID
   */
  public getPassResult<TOutput>(
    state: CompilationState<TInput, any>,
    passId: string
  ): PassResult<TOutput> | undefined {
    return state.intermediateResults.get(passId) as PassResult<TOutput>;
  }

  /**
   * Get all pass results in order
   */
  public getAllPassResults(
    state: CompilationState<TInput, any>
  ): PassResult<any>[] {
    const results: PassResult<any>[] = [];

    for (const result of Array.from(state.intermediateResults.values())) {
      results.push(result);
    }

    return results;
  }

  /**
   * Get diagnostics from specific pass
   */
  public getPassDiagnostics(
    state: CompilationState<TInput, any>,
    passId: string
  ): Diagnostic[] {
    const passResult = state.intermediateResults.get(passId);
    if (!passResult) {
      return [];
    }
    return passResult.diagnostics;
  }

  /**
   * Get all diagnostics by severity
   */
  public getDiagnosticsBySeverity(
    state: CompilationState<TInput, any>,
    severity: "error" | "warning" | "info"
  ): Diagnostic[] {
    return state.diagnostics.filter((d) => d.severity === severity);
  }

  /**
   * Check if there are any errors
   */
  public hasErrors(state: CompilationState<TInput, any>): boolean {
    return this.getDiagnosticsBySeverity(state, "error").length > 0;
  }
}

/**
 * Pass registry - manages pass registration and ordering
 *
 * Validates pass dependencies and provides topological sort
 */
export class PassRegistry {
  private passes: Map<string, CompilerPass<any, any>> = new Map();

  /**
   * Register a pass
   *
   * VALIDATES:
   * - Pass has unique ID
   * - Pass dependencies are valid
   */
  public register(pass: CompilerPass<any, any>): void {
    // Check for duplicate
    if (this.passes.has(pass.passId)) {
      throw new Error(
        `Pass registration failed: ${pass.passId} already registered`
      );
    }

    // Validate pass
    if (!pass.passId || !pass.passName) {
      throw new Error(
        `Pass registration failed: Pass must have passId and passName`
      );
    }

    // Store pass
    this.passes.set(pass.passId, pass);
  }

  /**
   * Get pass by ID
   */
  public getPass(passId: string): CompilerPass<any, any> {
    const pass = this.passes.get(passId);
    if (!pass) {
      throw new Error(`Pass not found: ${passId}`);
    }
    return pass;
  }

  /**
   * Get all passes
   */
  public getAllPasses(): CompilerPass<any, any>[] {
    return Array.from(this.passes.values());
  }

  /**
   * Get ordered passes using topological sort
   *
   * ENSURES:
   * - Dependencies are satisfied (each pass comes after its dependencies)
   * - All passes are included
   */
  public getOrderedPasses(): CompilerPass<any, any>[] {
    const ordered: CompilerPass<any, any>[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (passId: string) => {
      if (visited.has(passId)) {
        return; // Already processed
      }

      if (visiting.has(passId)) {
        throw new Error(`Circular dependency detected in passes: ${passId}`);
      }

      visiting.add(passId);

      const pass = this.passes.get(passId);
      if (!pass) {
        throw new Error(`Pass not found: ${passId}`);
      }

      // Visit dependencies first
      for (const depId of pass.dependencies) {
        if (this.passes.has(depId)) {
          visit(depId);
        } else {
          throw new Error(
            `Dependency not found: Pass ${passId} depends on ${depId}`
          );
        }
      }

      visiting.delete(passId);
      visited.add(passId);
      ordered.push(pass);
    };

    // Visit all passes
    for (const pass of Array.from(this.passes.values())) {
      visit(pass.passId);
    }

    return ordered;
  }

  /**
   * Validate all passes can be ordered
   */
  public validateOrder(): void {
    this.getOrderedPasses(); // Will throw if circular or missing dependencies
  }
}

/**
 * Diagnostic accumulator - collects diagnostics throughout compilation
 */
export class DiagnosticAccumulator {
  private diagnostics: Diagnostic[] = [];

  /**
   * Add diagnostics
   */
  public add(diagnostics: Diagnostic[]): void {
    this.diagnostics.push(...diagnostics);
  }

  /**
   * Get all diagnostics
   */
  public getAll(): Diagnostic[] {
    return [...this.diagnostics];
  }

  /**
   * Get errors only
   */
  public getErrors(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === "error");
  }

  /**
   * Get warnings only
   */
  public getWarnings(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === "warning");
  }

  /**
   * Get infos only
   */
  public getInfos(): Diagnostic[] {
    return this.diagnostics.filter((d) => d.severity === "info");
  }

  /**
   * Has errors?
   */
  public hasErrors(): boolean {
    return this.getErrors().length > 0;
  }

  /**
   * Get summary
   */
  public getSummary() {
    return {
      errors: this.getErrors().length,
      warnings: this.getWarnings().length,
      infos: this.getInfos().length,
      total: this.diagnostics.length,
    };
  }

  /**
   * Clear all diagnostics
   */
  public clear(): void {
    this.diagnostics = [];
  }
}

/**
 * Execution timer - tracks execution timing
 */
export class ExecutionTimer {
  private startTime?: number;
  private endTime?: number;

  /**
   * Start timing
   */
  public start(): void {
    this.startTime = performance.now();
  }

  /**
   * Stop timing
   */
  public stop(): void {
    this.endTime = performance.now();
  }

  /**
   * Get elapsed time in milliseconds
   */
  public getElapsedMs(): number {
    if (!this.startTime || !this.endTime) {
      throw new Error("Timer not started or stopped");
    }
    return this.endTime - this.startTime;
  }

  /**
   * Get current elapsed time (whether stopped or not)
   */
  public getCurrentElapsedMs(): number {
    if (!this.startTime) {
      throw new Error("Timer not started");
    }
    const now = performance.now();
    if (this.endTime) {
      return this.endTime - this.startTime;
    }
    return now - this.startTime;
  }
}
