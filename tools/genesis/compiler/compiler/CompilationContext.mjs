/**
 * CompilationContext
 *
 * Holds context for compilation operations.
 *
 * The context specifies what should be compiled and how.
 */

/**
 * Create a compilation context.
 *
 * @param {Object} input - Context input
 * @returns {Object} Compilation context
 * @throws {Error} if required fields are missing
 */
export function createCompilationContext(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Context input must be a non-null object");
  }

  // Validate required fields
  if (!input.rootDir || typeof input.rootDir !== "string") {
    throw new Error("Context must have rootDir (string)");
  }

  if (!input.plan || typeof input.plan !== "object") {
    throw new Error("Context must have plan (object)");
  }

  // Validate plan has required fields
  if (!input.plan.steps || !Array.isArray(input.plan.steps)) {
    throw new Error("Plan must have steps (array)");
  }

  // Determine mode (default to dry-run)
  let mode = input.mode || "dry-run";
  if (!["dry-run", "write"].includes(mode)) {
    throw new Error("Mode must be dry-run or write");
  }

  const context = {
    rootDir: input.rootDir,
    plan: input.plan,
    mode: mode,
    options: input.options ? { ...input.options } : {},
    createdAt: new Date().toISOString(),
  };

  return context;
}
