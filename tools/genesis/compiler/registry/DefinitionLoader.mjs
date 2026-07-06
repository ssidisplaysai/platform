/**
 * DefinitionLoader
 *
 * Loads Genesis business definitions from configured root directories.
 *
 * The loader scans specified roots deterministically and returns lightweight
 * definition records. It does not recursively scan the entire project—only
 * the provided root directories.
 *
 * For Phase 1, this loads candidate files and returns definition records.
 * Future phases will parse and validate these candidates into actual definitions.
 */

import fs from "fs";
import path from "path";

/**
 * Load definitions from configured root directories.
 *
 * @param {Array<string>} roots - Array of root directory paths to scan
 * @returns {Array<Object>} Array of lightweight definition records
 */
export function loadDefinitionsFromRoots(roots) {
  if (!Array.isArray(roots)) {
    return [];
  }

  const candidates = [];
  const fileExtensions = [".ts", ".js", ".mjs", ".json", ".md"];

  for (const root of roots) {
    if (!root || typeof root !== "string") {
      continue;
    }

    // Ignore roots that do not exist
    if (!fs.existsSync(root)) {
      continue;
    }

    // Check if root is a directory
    const stats = fs.statSync(root);
    if (!stats.isDirectory()) {
      continue;
    }

    // Scan the root directory (non-recursive for Phase 1)
    try {
      const entries = fs.readdirSync(root, { withFileTypes: true });

      // Process entries in deterministic order (sorted)
      const sortedEntries = entries.sort((a, b) => a.name.localeCompare(b.name));

      for (const entry of sortedEntries) {
        // Skip directories
        if (entry.isDirectory()) {
          continue;
        }

        // Check file extension
        const ext = path.extname(entry.name);
        if (!fileExtensions.includes(ext)) {
          continue;
        }

        // Extract definition name from filename
        const baseName = path.basename(entry.name, ext);
        const fullPath = path.join(root, entry.name);

        // Create a lightweight definition record
        const record = {
          name: baseName,
          type: "definition-candidate",
          sourcePath: fullPath,
          metadata: {
            extension: ext,
          },
        };

        candidates.push(record);
      }
    } catch (error) {
      // Silently skip roots that cannot be read
      continue;
    }
  }

  // Return candidates in deterministic order
  return candidates.sort((a, b) => a.name.localeCompare(b.name));
}
