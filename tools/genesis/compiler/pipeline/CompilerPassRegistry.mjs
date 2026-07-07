/**
 * CompilerPassRegistry - Registry for managing compiler passes
 *
 * Maintains a registry of all available compiler passes and determines
 * execution order.
 *
 * @module tools/genesis/compiler/pipeline/CompilerPassRegistry
 */

export class CompilerPassRegistry {
  constructor() {
    this.passes = new Map();
  }

  /**
   * Register a compiler pass
   *
   * @param {CompilerPass} pass - Compiler pass instance
   * @throws {Error} If pass name already registered
   */
  register(pass) {
    if (!pass || !pass.name) {
      throw new Error("Invalid compiler pass: must have a name");
    }

    if (this.passes.has(pass.name)) {
      throw new Error(`Compiler pass already registered: ${pass.name}`);
    }

    this.passes.set(pass.name, pass);
  }

  /**
   * Get a registered pass by name
   *
   * @param {string} passName - Name of pass
   * @returns {CompilerPass|null} Pass or null if not found
   */
  get(passName) {
    return this.passes.get(passName) || null;
  }

  /**
   * Check if a pass is registered
   *
   * @param {string} passName - Name of pass
   * @returns {boolean}
   */
  has(passName) {
    return this.passes.has(passName);
  }

  /**
   * List all registered passes in execution order
   *
   * @returns {Array<CompilerPass>} Sorted by order property
   */
  list() {
    const passes = Array.from(this.passes.values());
    return passes.sort((a, b) => a.order - b.order);
  }

  /**
   * Get count of registered passes
   *
   * @returns {number}
   */
  count() {
    return this.passes.size;
  }

  /**
   * Clear all registered passes
   *
   * Used primarily in testing.
   */
  clear() {
    this.passes.clear();
  }

  /**
   * Get registry metadata
   *
   * @returns {Object} Immutable registry metadata
   */
  getMetadata() {
    return Object.freeze({
      passCount: this.passes.size,
      passes: this.list().map((p) => ({
        name: p.name,
        description: p.description,
        order: p.order,
      })),
    });
  }
}

/**
 * Global compiler pass registry instance
 * @type {CompilerPassRegistry}
 */
export const globalPassRegistry = new CompilerPassRegistry();
