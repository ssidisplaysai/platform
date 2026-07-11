/**
 * GeneratedSliceValidator.mjs
 *
 * Validates sandbox-generated entity slices.
 *
 * Purpose:
 *   - Checks for existence of 9 required artifact files
 *   - Validates file structure under generated/genesis/{Entity}/
 *   - Never modifies runtime or production code
 *   - Only validates generated artifacts
 *
 * Constraints:
 *   - Does not move files into src/core
 *   - Does not integrate into runtime
 *   - No CRM implementation
 *   - No production entity integration
 */

import { existsSync } from "fs";
import { join, resolve } from "path";
import { createGeneratedSliceReport } from "./GeneratedSliceReport.mjs";

/**
 * Expected artifact files for each entity
 */
const EXPECTED_ARTIFACTS = [
  "Definition",      // {Entity}Definition.ts
  "Repository",      // {Entity}Repository.ts
  "Service",         // {Entity}Service.ts
  "Validator",       // {Entity}Validator.ts
  "Events",          // {Entity}Events.ts
  "Permissions",     // {Entity}Permissions.ts
  "Search",          // {Entity}Search.ts
  "Documentation",   // {Entity}Documentation.md
  "Tests",           // {Entity}.test.ts
];

/**
 * Get the file path for an artifact type
 */
function getArtifactPath(slicePath, entityName, artifactType) {
  let fileName;

  if (artifactType === "Documentation") {
    fileName = `${entityName}${artifactType}.md`;
  } else if (artifactType === "Tests") {
    fileName = `${entityName}.test.ts`;
  } else {
    fileName = `${entityName}${artifactType}.ts`;
  }

  return { fileName, filePath: join(slicePath, fileName) };
}

/**
 * Validate a generated entity slice
 *
 * @param {string} entityName - The entity name (e.g., "Customer")
 * @param {Object} options - Validation options
 * @returns {GeneratedSliceReport} - Validation report
 */
export async function validateGeneratedSlice(entityName, options = {}) {
  // Resolve paths
  const baseDir = options.baseDir || process.cwd();
  const slicePath = resolve(baseDir, "generated", "genesis", entityName);

  // Check if slice directory exists
  if (!existsSync(slicePath)) {
    const missingPaths = EXPECTED_ARTIFACTS.map((artifactType) =>
      getArtifactPath(slicePath, entityName, artifactType).filePath
    );
    const report = createGeneratedSliceReport({
      entityName,
      slicePath,
      checkedFiles: EXPECTED_ARTIFACTS,
      foundFiles: [],
      missingFiles: missingPaths,
    });

    return report;
  }

  // Check for each expected artifact
  const foundFiles = [];
  const missingFiles = [];

  for (const artifactType of EXPECTED_ARTIFACTS) {
    const { filePath } = getArtifactPath(slicePath, entityName, artifactType);

    if (existsSync(filePath)) {
      foundFiles.push({ artifactType, filePath });
    } else {
      missingFiles.push(filePath);
    }
  }

  // Create report
  const report = createGeneratedSliceReport({
    entityName,
    slicePath,
    checkedFiles: EXPECTED_ARTIFACTS,
    foundFiles,
    missingFiles,
  });

  return report;
}

/**
 * Validate multiple generated slices
 *
 * @param {string[]} entityNames - Array of entity names
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} - Reports indexed by entity name
 */
export async function validateGeneratedSlices(entityNames, options = {}) {
  const reports = {};

  for (const entityName of entityNames) {
    reports[entityName] = await validateGeneratedSlice(entityName, options);
  }

  return reports;
}
