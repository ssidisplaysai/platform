/**
 * CompilationResult
 *
 * The result of a compilation.
 *
 * Contains artifacts and diagnostics.
 */

/**
 * Create a compilation result.
 *
 * @param {Object} input - Result input
 * @returns {Object} Immutable compilation result
 * @throws {Error} if required fields are missing
 */
export function createCompilationResult(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Result input must be a non-null object");
  }

  // Validate required fields
  if (typeof input.success !== "boolean") {
    throw new Error("Result must have success (boolean)");
  }

  if (!input.mode || typeof input.mode !== "string") {
    throw new Error("Result must have mode (string)");
  }

  if (!input.planId || typeof input.planId !== "string") {
    throw new Error("Result must have planId (string)");
  }

  if (!Array.isArray(input.artifacts)) {
    throw new Error("Result must have artifacts (array)");
  }

  if (!Array.isArray(input.diagnostics)) {
    throw new Error("Result must have diagnostics (array)");
  }

  const result = {
    success: input.success,
    mode: input.mode,
    planId: input.planId,
    artifacts: Object.freeze([...input.artifacts]),
    diagnostics: Object.freeze([...input.diagnostics]),
    completedAt: new Date().toISOString(),
  };

  // Freeze the entire result
  return Object.freeze(result);
}
