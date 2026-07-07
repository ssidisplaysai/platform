/**
 * CompilerPass - Base class for compiler pipeline passes
 *
 * All compiler passes extend this class and implement the execute() method.
 * This provides a consistent interface for the compilation pipeline.
 *
 * @module tools/genesis/compiler/pipeline/CompilerPass
 */

import { CompilerPassResult } from "./CompilerPassResult.mjs";

export class CompilerPass {
  /**
   * Create a new compiler pass
   *
   * @param {Object} options - Pass options
   * @param {string} options.name - Unique pass name
   * @param {string} options.description - Pass description
   * @param {number} [options.order] - Execution order (default: 100)
   */
  constructor(options = {}) {
    if (!options.name) {
      throw new Error("CompilerPass requires a name");
    }
    if (!options.description) {
      throw new Error("CompilerPass requires a description");
    }

    this.name = options.name;
    this.description = options.description;
    this.order = options.order ?? 100;
  }

  /**
   * Execute the pass
   *
   * Subclasses must implement this method.
   *
   * @param {CompilerContext} context - Compiler context
   * @returns {Promise<CompilerContext>} Updated context
   * @throws {Error} If implementation not provided
   */
  async execute(context) {
    throw new Error(`Pass ${this.name} must implement execute(context)`);
  }

  /**
   * Optional: Validate that the pass can run
   *
   * Subclasses may override this to check prerequisites.
   *
   * @param {CompilerContext} context - Compiler context
   * @returns {Object} {isValid: boolean, error?: string}
   */
  validate(context) {
    return { isValid: true };
  }

  /**
   * Get pass metadata
   *
   * @returns {Object} Immutable pass metadata
   */
  getMetadata() {
    return Object.freeze({
      name: this.name,
      description: this.description,
      order: this.order,
    });
  }

  /**
   * Create a success result for this pass
   *
   * @param {number} duration - Execution duration
   * @param {Array} [diagnostics] - Diagnostics
   * @param {Object} [metadata] - Metadata
   * @returns {CompilerPassResult}
   */
  success(duration, diagnostics = [], metadata = {}) {
    return CompilerPassResult.success(
      this.name,
      duration,
      diagnostics,
      metadata
    );
  }

  /**
   * Create a failure result for this pass
   *
   * @param {string} error - Error message
   * @param {number} [duration] - Execution duration
   * @param {Array} [diagnostics] - Diagnostics
   * @returns {CompilerPassResult}
   */
  failure(error, duration = 0, diagnostics = []) {
    return CompilerPassResult.failure(this.name, error, duration, diagnostics);
  }
}
