/**
 * PromotionValidator.mjs
 *
 * Validates generated slices before promotion.
 *
 * Purpose:
 *   - Ensures only validated slices are promoted
 *   - Checks all 9 required artifacts exist
 *   - Prevents promotion of incomplete slices
 *   - Blocks promotion if validation fails
 */

import { existsSync } from "fs";
import { join } from "path";

const REQUIRED_ARTIFACTS = [
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

  return join(slicePath, fileName);
}

/**
 * Validate a generated slice for promotion
 *
 * @param {string} slicePath - Path to generated slice
 * @param {string} entityName - Entity name
 * @returns {Object} - Validation result with { isValid, missingArtifacts }
 */
export async function validateSliceForPromotion(slicePath, entityName) {
  // Check if directory exists
  if (!existsSync(slicePath)) {
    return {
      isValid: false,
      missingArtifacts: REQUIRED_ARTIFACTS.map(
        (artifactType) =>
          getArtifactPath(slicePath, entityName, artifactType).split(/[\\/]/).pop()
      ),
      error: `Generated slice directory not found: ${slicePath}`,
    };
  }

  // Check for each required artifact
  const missingArtifacts = [];

  for (const artifactType of REQUIRED_ARTIFACTS) {
    const filePath = getArtifactPath(slicePath, entityName, artifactType);

    if (!existsSync(filePath)) {
      missingArtifacts.push(filePath.split(/[\\/]/).pop());
    }
  }

  // Validation passes if no artifacts are missing
  const isValid = missingArtifacts.length === 0;

  return {
    isValid,
    missingArtifacts,
    error: isValid ? null : `Missing ${missingArtifacts.length} artifact(s)`,
  };
}

/**
 * Check if a slice is ready for promotion
 */
export function isReadyForPromotion(validationResult) {
  return validationResult.isValid && validationResult.missingArtifacts.length === 0;
}
