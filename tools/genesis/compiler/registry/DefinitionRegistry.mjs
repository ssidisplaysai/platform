/**
 * DefinitionRegistry
 *
 * Public API for the Genesis Business Compiler Definition Registry.
 *
 * The Definition Registry is the authoritative source of loaded Genesis
 * business definitions. All planning, compilation, validation, and
 * documentation operations must obtain definitions through this registry.
 */

import { DefinitionIndex } from "./DefinitionIndex.mjs";
import { resolveDefinitionName } from "./DefinitionResolver.mjs";

export class DefinitionRegistry {
  constructor() {
    this.index = new DefinitionIndex();
  }

  /**
   * Register a definition.
   *
   * @param {Object} definition - Definition object with at least a name property
   * @throws {Error} if definition is invalid
   */
  register(definition) {
    if (!definition || typeof definition !== "object") {
      throw new Error("Definition must be a non-null object");
    }

    if (!definition.name || typeof definition.name !== "string") {
      throw new Error("Definition must have a name property (string)");
    }

    // Ensure the definition has a canonical name
    const canonicalName = resolveDefinitionName(definition.name);
    const normalizedDefinition = {
      ...definition,
      name: canonicalName,
    };

    this.index.add(normalizedDefinition);
  }

  /**
   * Get a definition by exact canonical name.
   *
   * @param {string} name - Definition name
   * @returns {Object|undefined} The definition, or undefined if not found
   */
  get(name) {
    if (!name || typeof name !== "string") {
      return undefined;
    }

    try {
      const canonicalName = resolveDefinitionName(name);
      return this.index.get(canonicalName);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a definition exists by name.
   *
   * @param {string} name - Definition name
   * @returns {boolean} True if definition exists
   */
  has(name) {
    if (!name || typeof name !== "string") {
      return false;
    }

    try {
      const canonicalName = resolveDefinitionName(name);
      return this.index.has(canonicalName);
    } catch {
      return false;
    }
  }

  /**
   * List all registered definitions in deterministic order (sorted by name).
   *
   * @returns {Array<Object>} Array of definitions sorted by name
   */
  list() {
    return this.index.list();
  }

  /**
   * Clear all registered definitions.
   *
   * Warning: This is primarily for testing. Do not call in production.
   */
  clear() {
    this.index.clear();
  }

  /**
   * Get registry statistics.
   *
   * @returns {Object} Statistics including definition count
   */
  stats() {
    return {
      definitionCount: this.index.list().length,
      definitions: this.index.list().map((d) => ({
        name: d.name,
        type: d.type,
      })),
    };
  }
}

// Export singleton instance
export const registry = new DefinitionRegistry();
