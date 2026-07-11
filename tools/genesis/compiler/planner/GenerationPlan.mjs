/**
 * GenerationPlan
 *
 * An immutable, deterministic plan that describes what artifacts need to be generated.
 *
 * A plan is created by the Planner and executed by the Compiler.
 * Plans are deterministic: the same input always produces the same plan.
 */

/**
 * Create a generation plan.
 *
 * A plan must have:
 * - id: Unique plan identifier
 * - name: Human-readable plan name
 * - subject: What is being planned (e.g., "Customer")
 * - subjectType: Type of subject (e.g., "entity")
 * - steps: Array of GenerationStep objects
 *
 * Optional:
 * - metadata: Additional context
 *
 * @param {Object} input - Plan input
 * @returns {Object} Immutable generation plan
 * @throws {Error} if required fields are missing or invalid
 */
export function createGenerationPlan(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Plan input must be a non-null object");
  }

  // Validate required fields
  if (!input.id || typeof input.id !== "string") {
    throw new Error("Plan must have an id (string)");
  }

  if (!input.name || typeof input.name !== "string") {
    throw new Error("Plan must have a name (string)");
  }

  if (!input.subject || typeof input.subject !== "string") {
    throw new Error("Plan must have a subject (string)");
  }

  if (!input.subjectType || typeof input.subjectType !== "string") {
    throw new Error("Plan must have a subjectType (string)");
  }

  if (!Array.isArray(input.steps)) {
    throw new Error("Plan must have steps (array)");
  }

  // Create plan object
  const plan = {
    id: input.id,
    name: input.name,
    subject: input.subject,
    subjectType: input.subjectType,
    steps: Object.freeze([...input.steps]),
    metadata: input.metadata ? { ...input.metadata } : {},
    createdAt: new Date().toISOString(),
  };

  // Freeze the entire plan to make it immutable
  return Object.freeze(plan);
}
