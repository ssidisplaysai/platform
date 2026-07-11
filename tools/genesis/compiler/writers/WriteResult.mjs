/**
 * WriteResult
 *
 * Represents the result of writing artifacts to the file system.
 *
 * Fields:
 * - success: whether all writes were successful
 * - mode: "dry-run" or "write"
 * - written: count of artifacts written
 * - skipped: count of artifacts skipped (already exist, not forced)
 * - artifacts: array of artifact records after write attempt
 * - diagnostics: array of diagnostic messages
 * - completedAt: ISO timestamp
 */

export function createWriteResult(input) {
  const {
    success,
    mode,
    written = 0,
    skipped = 0,
    artifacts = [],
    diagnostics = [],
  } = input;

  // Validate required fields
  if (success === undefined) throw new Error("WriteResult: success is required");
  if (!mode) throw new Error("WriteResult: mode is required");
  if (!Array.isArray(artifacts)) throw new Error("WriteResult: artifacts must be an array");
  if (!Array.isArray(diagnostics)) throw new Error("WriteResult: diagnostics must be an array");

  const result = {
    success,
    mode,
    written,
    skipped,
    artifacts: Object.freeze([...artifacts]),
    diagnostics: Object.freeze([...diagnostics]),
    completedAt: new Date().toISOString(),
  };

  // Freeze the result to ensure immutability
  return Object.freeze(result);
}
