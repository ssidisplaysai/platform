/**
 * CompilerPipeline - Main orchestrator for compiler passes
 *
 * Executes registered compiler passes in order, managing context flow
 * and diagnostics collection.
 *
 * @module tools/genesis/compiler/pipeline/CompilerPipeline
 */

import { CompilerContext } from "./CompilerContext.mjs";
import { globalPassRegistry } from "./CompilerPassRegistry.mjs";

export class CompilerPipeline {
  /**
   * Create a new compiler pipeline
   *
   * @param {Object} [options] - Pipeline options
   * @param {CompilerPassRegistry} [options.registry] - Pass registry (default: global)
   * @param {boolean} [options.stopOnFailure] - Stop on first failure (default: true)
   */
  constructor(options = {}) {
    this.registry =
      options.registry || globalPassRegistry;
    this.stopOnFailure = options.stopOnFailure ?? true;
  }

  /**
   * Execute the compiler pipeline
   *
   * Runs all registered passes in order, passing context through each.
   *
   * @param {CompilerContext} context - Initial compiler context
   * @returns {Promise<Object>} Pipeline result with context and results
   */
  async execute(context) {
    if (!(context instanceof CompilerContext)) {
      throw new Error(
        "Pipeline.execute() requires a CompilerContext instance"
      );
    }

    const pipelineStart = Date.now();
    const passResults = [];
    let currentContext = context;
    let pipelineFailed = false;

    const passes = this.registry.list();

    for (const pass of passes) {
      const passStart = Date.now();

      try {
        // Validate pass can run
        const validation = pass.validate(currentContext);
        if (!validation.isValid) {
          const result = pass.failure(
            validation.error || "Validation failed",
            0
          );
          passResults.push(result);

          if (this.stopOnFailure) {
            pipelineFailed = true;
            break;
          }
          continue;
        }

        // Execute pass
        const result = await pass.execute(currentContext);

        if (!(result instanceof CompilerContext)) {
          throw new Error(
            `Pass ${pass.name} must return a CompilerContext instance`
          );
        }

        currentContext = result;

        // Record success
        const duration = Date.now() - passStart;
        passResults.push(pass.success(duration));
      } catch (error) {
        const duration = Date.now() - passStart;
        const diagnostics = [
          {
            level: "error",
            message: error.message,
            stack: error.stack,
          },
        ];

        passResults.push(
          pass.failure(error.message, duration, diagnostics)
        );

        if (this.stopOnFailure) {
          pipelineFailed = true;
          currentContext.addDiagnostic(
            "error",
            `Pipeline stopped: ${pass.name} failed with ${error.message}`
          );
          break;
        }
      }
    }

    const pipelineDuration = Date.now() - pipelineStart;

    return Object.freeze({
      success: !pipelineFailed,
      context: currentContext,
      results: passResults,
      duration: pipelineDuration,
      passCount: passes.length,
      failedCount: passResults.filter((r) => !r.success).length,
    });
  }

  /**
   * Get pipeline metadata
   *
   * @returns {Object} Immutable pipeline metadata
   */
  getMetadata() {
    return Object.freeze({
      stopOnFailure: this.stopOnFailure,
      registry: this.registry.getMetadata(),
    });
  }
}
