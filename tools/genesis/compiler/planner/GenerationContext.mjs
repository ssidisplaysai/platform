/**
 * GenerationContext
 *
 * Holds the context for generation planning.
 *
 * The context provides information about:
 * - Where artifacts will be written (rootDir)
 * - The definition being planned
 * - Any parsed blueprint (optional)
 * - Planner options
 */

import fs from "fs";

/**
 * Create a generation context.
 *
 * Required:
 * - rootDir: Root directory where artifacts would be written
 * - definition: The definition object being planned
 *
 * Optional:
 * - blueprint: Parsed/validated definition (future use)
 * - options: Planner options
 *
 * @param {Object} input - Context input
 * @returns {Object} Generation context
 * @throws {Error} if required fields are missing or invalid
 */
export function createGenerationContext(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Context input must be a non-null object");
  }

  // Validate rootDir
  if (!input.rootDir || typeof input.rootDir !== "string") {
    throw new Error("Context must have rootDir (string)");
  }

  if (!fs.existsSync(input.rootDir)) {
    throw new Error(`rootDir does not exist: ${input.rootDir}`);
  }

  // Validate definition
  if (!input.definition || typeof input.definition !== "object") {
    throw new Error("Context must have definition (object)");
  }

  if (!input.definition.name || typeof input.definition.name !== "string") {
    throw new Error("Definition must have name (string)");
  }

  // Create context object
  const context = {
    rootDir: input.rootDir,
    definition: input.definition,
    blueprint: input.blueprint || null,
    options: input.options ? { ...input.options } : {},
    createdAt: new Date().toISOString(),
  };

  return context;
}
