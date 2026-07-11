/**
 * GenerationStep
 *
 * Represents one planned artifact or action in a generation plan.
 *
 * A step is immutable and describes what needs to be created, not HOW to create it.
 * The actual creation is handled by the Compiler in Phase 3.
 */

/**
 * Create a generation step.
 *
 * A step must have:
 * - id: Unique stable identifier
 * - type: Artifact type (e.g., "entity-definition", "repository", "service")
 * - name: Human-readable name
 *
 * Optional fields:
 * - description: What this step does
 * - targetPath: Where the artifact would be written
 * - dependencies: Array of step IDs this depends on
 * - metadata: Additional context
 *
 * @param {Object} input - Step input
 * @returns {Object} Immutable generation step
 * @throws {Error} if required fields are missing
 */
export function createGenerationStep(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Step input must be a non-null object");
  }

  // Validate required fields
  if (!input.id || typeof input.id !== "string") {
    throw new Error("Step must have an id (string)");
  }

  if (!input.type || typeof input.type !== "string") {
    throw new Error("Step must have a type (string)");
  }

  if (!input.name || typeof input.name !== "string") {
    throw new Error("Step must have a name (string)");
  }

  const step = {
    id: input.id,
    type: input.type,
    name: input.name,
    description: input.description || null,
    targetPath: input.targetPath || null,
    dependencies: Array.isArray(input.dependencies) ? [...input.dependencies] : [],
    metadata: input.metadata ? { ...input.metadata } : {},
  };

  // Freeze the step to make it immutable
  return Object.freeze(step);
}
