/**
 * DefinitionIndex
 *
 * Maintains an in-memory deterministic index of Genesis business definitions.
 *
 * This is an internal data structure used by DefinitionRegistry.
 * The public API is DefinitionRegistry.
 */

export class DefinitionIndex {
  constructor() {
    this.definitions = new Map();
  }

  /**
   * Add a definition to the index.
   *
   * @param {Object} definition - Definition object with at least a name property
   * @throws {Error} if definition has no name
   */
  add(definition) {
    if (!definition || !definition.name) {
      throw new Error("Definition must have a name property");
    }

    this.definitions.set(definition.name, definition);
  }

  /**
   * Get a definition by exact name.
   *
   * @param {string} name - Definition name
   * @returns {Object|undefined} The definition, or undefined if not found
   */
  get(name) {
    return this.definitions.get(name);
  }

  /**
   * Check if a definition exists by exact name.
   *
   * @param {string} name - Definition name
   * @returns {boolean} True if definition exists
   */
  has(name) {
    return this.definitions.has(name);
  }

  /**
   * List all definitions in deterministic order (sorted by name).
   *
   * @returns {Array<Object>} Array of definitions sorted by name
   */
  list() {
    const sorted = Array.from(this.definitions.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    return sorted;
  }

  /**
   * Clear all definitions.
   */
  clear() {
    this.definitions.clear();
  }
}
