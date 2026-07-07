/**
 * CompilerPassResult - Result object returned from each compiler pass
 *
 * Provides pass execution metadata and status information.
 *
 * @module tools/genesis/compiler/pipeline/CompilerPassResult
 */

export class CompilerPassResult {
  /**
   * Create a new compiler pass result
   *
   * @param {Object} options - Result options
   * @param {boolean} options.success - Whether pass succeeded
   * @param {string} options.passName - Name of the pass
   * @param {Array} [options.diagnostics] - Pass diagnostics
   * @param {number} [options.duration] - Execution time in ms
   * @param {Object} [options.metadata] - Pass metadata
   * @param {string} [options.error] - Error message if failed
   */
  constructor(options = {}) {
    this.success = options.success ?? true;
    this.passName = options.passName || "Unknown";
    this.diagnostics = options.diagnostics || [];
    this.duration = options.duration || 0;
    this.metadata = options.metadata || {};
    this.error = options.error || null;
  }

  /**
   * Create a successful result
   *
   * @param {string} passName - Name of pass
   * @param {number} duration - Execution duration
   * @param {Array} [diagnostics] - Diagnostics
   * @param {Object} [metadata] - Metadata
   * @returns {CompilerPassResult}
   */
  static success(passName, duration, diagnostics = [], metadata = {}) {
    return new CompilerPassResult({
      success: true,
      passName,
      duration,
      diagnostics,
      metadata,
    });
  }

  /**
   * Create a failed result
   *
   * @param {string} passName - Name of pass
   * @param {string} error - Error message
   * @param {number} [duration] - Execution duration
   * @param {Array} [diagnostics] - Diagnostics
   * @returns {CompilerPassResult}
   */
  static failure(passName, error, duration = 0, diagnostics = []) {
    return new CompilerPassResult({
      success: false,
      passName,
      error,
      duration,
      diagnostics,
    });
  }

  /**
   * Get result as frozen object
   *
   * @returns {Object} Immutable result
   */
  toJSON() {
    return Object.freeze({
      success: this.success,
      passName: this.passName,
      duration: this.duration,
      diagnosticCount: this.diagnostics.length,
      error: this.error,
      metadata: { ...this.metadata },
    });
  }
}
