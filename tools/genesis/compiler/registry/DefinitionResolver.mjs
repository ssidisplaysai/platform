/**
 * DefinitionResolver
 *
 * Resolves logical definition names to canonical names.
 *
 * Handles variations in how definitions might be named:
 * - Customer → Customer (no change)
 * - CustomerDefinition → Customer (remove Definition suffix)
 * - customer → Customer (normalize case)
 * - CUSTOMER → Customer (normalize case)
 */

/**
 * Resolve a definition name to its canonical form.
 *
 * Normalization rules:
 * 1. Remove trailing "Definition" if present (case-insensitive)
 * 2. Trim whitespace
 * 3. Uppercase first letter, lowercase rest of first word
 *
 * @param {string} input - Input definition name
 * @returns {string} Canonical definition name
 * @throws {Error} if input is not a string or is empty
 */
export function resolveDefinitionName(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("Definition name must be a non-empty string");
  }

  let name = input.trim();

  // Remove trailing "Definition" (case-insensitive)
  if (name.toLowerCase().endsWith("definition")) {
    name = name.slice(0, -10).trim();
  }

  // Uppercase first letter, handle empty string edge case
  if (!name) {
    throw new Error("Definition name cannot be empty after normalization");
  }

  const firstChar = name.charAt(0).toUpperCase();
  const rest = name.slice(1).toLowerCase();

  return firstChar + rest;
}
