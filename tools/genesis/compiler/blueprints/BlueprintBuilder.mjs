/**
 * BlueprintBuilder.mjs
 *
 * Builds blueprints from GEDL definitions.
 *
 * Purpose:
 *   - Orchestrates YAML loading and validation
 *   - Creates immutable Blueprint objects
 *   - Manages blueprint caching
 *   - Provides blueprint discovery
 */

import { createBlueprint } from "./Blueprint.mjs";
import { validateGEDLDefinition, isValidForBlueprint } from "./BlueprintValidator.mjs";
import { loadEntityDefinition } from "./BlueprintLoader.mjs";

/**
 * Build a blueprint from a GEDL definition
 *
 * @param {string} entityName - Entity name
 * @param {string} definitionRoot - Root directory for definitions
 * @returns {Blueprint} - Blueprint object
 */
export async function buildBlueprint(entityName, definitionRoot) {
  // Load YAML definition
  const definition = loadEntityDefinition(entityName, definitionRoot);

  // Validate definition
  const validationResult = validateGEDLDefinition(definition);

  if (!isValidForBlueprint(validationResult)) {
    const errors = validationResult.errors.join("\n  ");
    throw new Error(`Invalid GEDL definition for ${entityName}:\n  ${errors}`);
  }

  // Create blueprint
  const blueprint = createBlueprint({
    entity: definition.entity,
    displayName: definition.displayName,
    pluralName: definition.pluralName,
    description: definition.description,
    fields: definition.fields || {},
    relationships: definition.relationships || {},
    capabilities: definition.capabilities || {},
    lifecycle: definition.lifecycle || {},
    metadata: definition.metadata || {},
    source: definition.source,
  });

  return blueprint;
}

/**
 * Build multiple blueprints
 *
 * @param {string[]} entityNames - Array of entity names
 * @param {string} definitionRoot - Root directory for definitions
 * @returns {Object} - Blueprints indexed by entity name
 */
export async function buildBlueprints(entityNames, definitionRoot) {
  const blueprints = {};

  for (const entityName of entityNames) {
    try {
      blueprints[entityName] = await buildBlueprint(entityName, definitionRoot);
    } catch (error) {
      console.warn(`Could not build blueprint for ${entityName}: ${error.message}`);
    }
  }

  return blueprints;
}

/**
 * Blueprint cache manager
 */
export class BlueprintCache {
  constructor() {
    this.blueprints = new Map();
  }

  /**
   * Get blueprint from cache
   */
  get(entityName) {
    return this.blueprints.get(entityName) || null;
  }

  /**
   * Add blueprint to cache
   */
  add(entityName, blueprint) {
    this.blueprints.set(entityName, blueprint);
  }

  /**
   * Check if blueprint is cached
   */
  has(entityName) {
    return this.blueprints.has(entityName);
  }

  /**
   * Get all cached blueprints
   */
  getAll() {
    return Array.from(this.blueprints.values());
  }

  /**
   * Clear cache
   */
  clear() {
    this.blueprints.clear();
  }

  /**
   * Get cache size
   */
  size() {
    return this.blueprints.size;
  }
}

/**
 * Create a blueprint cache
 */
export function createBlueprintCache() {
  return new BlueprintCache();
}
