/**
 * CompilerContext - Mutable execution context for compiler passes
 *
 * Each pass receives this context, modifies it, and passes it to the next pass.
 * This enables composition and data flow through the compilation pipeline.
 *
 * @module tools/genesis/compiler/pipeline/CompilerContext
 */

export class CompilerContext {
  /**
   * Create a new compiler context
   *
   * @param {Object} options - Context options
   * @param {string} options.entityName - Entity being compiled
   * @param {Object} [options.definition] - Entity definition
   * @param {Object} [options.blueprint] - Entity blueprint
   * @param {Object} [options.plan] - Compilation plan
   * @param {Array} [options.artifacts] - Generated artifacts
   * @param {Array} [options.diagnostics] - Compilation diagnostics
   * @param {Object} [options.metadata] - Execution metadata
   * @param {Object} [options.options] - Compiler options
   */
  constructor(options = {}) {
    this.entityName = options.entityName || "";
    this.definition = options.definition || null;
    this.blueprint = options.blueprint || null;
    this.plan = options.plan || null;
    this.artifacts = options.artifacts || [];
    this.diagnostics = options.diagnostics || [];
    this.metadata = options.metadata || {};
    this.options = options.options || {};
    this.startTime = Date.now();
  }

  /**
   * Add a diagnostic message
   *
   * @param {string} level - "info", "warning", "error"
   * @param {string} message - Diagnostic message
   * @param {Object} [details] - Additional details
   */
  addDiagnostic(level, message, details = {}) {
    this.diagnostics.push(
      Object.freeze({
        level,
        message,
        details,
        timestamp: Date.now(),
      })
    );
  }

  /**
   * Add an artifact
   *
   * @param {Object} artifact - Artifact object
   */
  addArtifact(artifact) {
    this.artifacts.push(Object.freeze(artifact));
  }

  /**
   * Get all artifacts
   *
   * @returns {Array} Immutable artifacts
   */
  getArtifacts() {
    return Object.freeze([...this.artifacts]);
  }

  /**
   * Get diagnostics at a specific level
   *
   * @param {string} level - "info", "warning", "error"
   * @returns {Array} Filtered diagnostics
   */
  getDiagnosticsAt(level) {
    return this.diagnostics.filter((d) => d.level === level);
  }

  /**
   * Get execution duration
   *
   * @returns {number} Milliseconds elapsed
   */
  getElapsedTime() {
    return Date.now() - this.startTime;
  }

  /**
   * Create a frozen snapshot of context state
   *
   * @returns {Object} Immutable context snapshot
   */
  toJSON() {
    return Object.freeze({
      entityName: this.entityName,
      definition: this.definition,
      blueprint: this.blueprint,
      plan: this.plan,
      artifactCount: this.artifacts.length,
      diagnosticCount: this.diagnostics.length,
      metadata: { ...this.metadata },
      options: { ...this.options },
      elapsedTime: this.getElapsedTime(),
    });
  }
}
