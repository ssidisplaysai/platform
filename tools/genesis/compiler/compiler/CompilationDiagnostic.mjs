/**
 * CompilationDiagnostic
 *
 * Represents a diagnostic message during compilation.
 *
 * Diagnostics can be informational, warnings, or errors.
 * They provide feedback about the compilation process.
 */

/**
 * Create a compilation diagnostic.
 *
 * @param {Object} input - Diagnostic input
 * @returns {Object} Immutable diagnostic object
 * @throws {Error} if required fields are missing
 */
export function createCompilationDiagnostic(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Diagnostic input must be a non-null object");
  }

  // Validate required fields
  if (!input.level || !["info", "warning", "error"].includes(input.level)) {
    throw new Error("Diagnostic must have a valid level (info, warning, or error)");
  }

  if (!input.code || typeof input.code !== "string") {
    throw new Error("Diagnostic must have a code (string)");
  }

  if (!input.message || typeof input.message !== "string") {
    throw new Error("Diagnostic must have a message (string)");
  }

  const diagnostic = {
    level: input.level,
    code: input.code,
    message: input.message,
    stepId: input.stepId || null,
    metadata: input.metadata ? { ...input.metadata } : {},
    timestamp: new Date().toISOString(),
  };

  return Object.freeze(diagnostic);
}
