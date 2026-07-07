/**
 * PromotionEngine.mjs
 *
 * Orchestrates the promotion pipeline.
 *
 * Purpose:
 *   - Validates generated slices
 *   - Builds promotion plans
 *   - Executes promotion steps
 *   - Manages rollback on failures
 *   - Produces promotion results
 *
 * Pipeline:
 *   Generated Slice → Validation → Promotion Plan → Execute → Result
 */

import { resolve } from "path";
import { existsSync } from "fs";
import { createPromotionPlan } from "./PromotionPlan.mjs";
import { createPromotionContext } from "./PromotionContext.mjs";
import { createPromotionResult } from "./PromotionResult.mjs";
import { validateSliceForPromotion, isReadyForPromotion } from "./PromotionValidator.mjs";
import { registerEntityInRuntime } from "./RuntimeRegistrar.mjs";
import { createRollbackManager } from "./RollbackManager.mjs";

/**
 * Execute a promotion operation
 *
 * @param {string} entityName - Entity name to promote
 * @param {Object} options - Promotion options
 * @returns {PromotionResult} - Promotion result
 */
export async function promoteEntity(entityName, options = {}) {
  const baseDir = options.baseDir || process.cwd();
  const sourceDir = resolve(baseDir, "generated", "genesis", entityName);
  const targetDir = options.targetDir || resolve(baseDir, "src", "core");

  // Create context
  const context = createPromotionContext({
    entityName,
    sourceDirectory: sourceDir,
    targetDirectory: targetDir,
    runtime: "simulated", // Phase 7: Simulated only
    options,
  });

  // Initialize rollback manager
  const rollbackManager = createRollbackManager();

  try {
    // Step 1: Validate the generated slice
    const validationResult = await validateSliceForPromotion(sourceDir, entityName);

    if (!isReadyForPromotion(validationResult)) {
      return createPromotionResult({
        success: false,
        entityName,
        promotedArtifacts: [],
        registeredComponents: [],
        diagnostics: [validationResult.error],
        error: `Validation failed: ${validationResult.error}`,
        rollbackPerformed: false,
      });
    }

    // Step 2: Create promotion plan
    const plan = createPromotionPlan({ entityName });

    // Step 3: Execute promotion
    const promotedArtifacts = [];

    // Simulate promoting each artifact
    const artifacts = [
      "Definition",
      "Repository",
      "Service",
      "Validator",
      "Events",
      "Permissions",
      "Search",
      "Documentation",
      "Tests",
    ];

    for (const artifact of artifacts) {
      // In Phase 7, we simulate the copy operation
      // In future phases, this will actually copy files
      const sourceFile = _getSourceFilePath(sourceDir, entityName, artifact);

      // Verify source file exists
      if (!existsSync(sourceFile)) {
        // This shouldn't happen if validation passed, but just in case
        continue;
      }

      // Simulate successful promotion
      promotedArtifacts.push(`${artifact} Promoted`);
      rollbackManager.recordPromotion(artifact, sourceFile);
    }

    // Step 4: Register in runtime
    const registeredComponents = await registerEntityInRuntime(entityName, context);

    // Step 5: Build success result
    return createPromotionResult({
      success: true,
      entityName,
      promotedArtifacts,
      registeredComponents: registeredComponents.map((c) => `${c} Registered`),
      diagnostics: [],
      rollbackPerformed: false,
    });
  } catch (error) {
    // On error, perform rollback
    await rollbackManager.performRollback();

    return createPromotionResult({
      success: false,
      entityName,
      promotedArtifacts: [],
      registeredComponents: [],
      diagnostics: [error.message],
      error: error.message,
      rollbackPerformed: true,
    });
  }
}

/**
 * Get source file path for an artifact
 */
function _getSourceFilePath(slicePath, entityName, artifactType) {
  let fileName;

  if (artifactType === "Documentation") {
    fileName = `${entityName}${artifactType}.md`;
  } else if (artifactType === "Tests") {
    fileName = `${entityName}.test.ts`;
  } else {
    fileName = `${entityName}${artifactType}.ts`;
  }

  return `${slicePath}/${fileName}`;
}

/**
 * Promote an entity with proper error handling
 */
export async function promoteEntitySafely(entityName, options = {}) {
  try {
    return await promoteEntity(entityName, options);
  } catch (error) {
    console.error(`Promotion failed for ${entityName}: ${error.message}`);
    throw error;
  }
}
