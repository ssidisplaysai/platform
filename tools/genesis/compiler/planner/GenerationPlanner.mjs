/**
 * GenerationPlanner
 *
 * Creates deterministic, immutable generation plans for business definitions.
 *
 * The planner converts a definition into a plan that describes what artifacts
 * need to be created. It does not create artifacts—the Compiler does that.
 */

import { createGenerationStep } from "./GenerationStep.mjs";
import { createGenerationPlan } from "./GenerationPlan.mjs";

/**
 * Plan entity generation.
 *
 * Given a definition and context, creates an ordered generation plan
 * that describes all artifacts needed for the entity.
 *
 * @param {Object} context - Generation context (from createGenerationContext)
 * @returns {Object} Immutable generation plan
 * @throws {Error} if context is invalid
 */
export function planEntity(context) {
  if (!context || typeof context !== "object") {
    throw new Error("Context is required");
  }

  const { definition, rootDir } = context;

  if (!definition || !definition.name) {
    throw new Error("Context must have a valid definition with name");
  }

  const entityName = definition.name;

  // Create ordered generation steps for a complete entity
  const steps = [
    createGenerationStep({
      id: "entity-definition",
      type: "entity-definition",
      name: `${entityName} Definition`,
      description: `Entity definition for ${entityName}`,
      targetPath: `src/domain/definitions/${entityName}.definition.ts`,
      metadata: { entityName },
    }),

    createGenerationStep({
      id: "repository",
      type: "repository",
      name: `${entityName} Repository`,
      description: `Data access layer for ${entityName}`,
      targetPath: `src/core/repositories/${entityName}Repository.ts`,
      dependencies: ["entity-definition"],
      metadata: { entityName },
    }),

    createGenerationStep({
      id: "service",
      type: "service",
      name: `${entityName} Service`,
      description: `Business logic service for ${entityName}`,
      targetPath: `src/core/services/${entityName}Service.ts`,
      dependencies: ["repository"],
      metadata: { entityName },
    }),

    createGenerationStep({
      id: "validator",
      type: "validator",
      name: `${entityName} Validator`,
      description: `Validation rules for ${entityName}`,
      targetPath: `src/core/validators/${entityName}Validator.ts`,
      dependencies: ["entity-definition"],
      metadata: { entityName },
    }),

    createGenerationStep({
      id: "events",
      type: "events",
      name: `${entityName} Events`,
      description: `Domain events for ${entityName}`,
      targetPath: `src/domain/events/${entityName}Events.ts`,
      dependencies: ["entity-definition"],
      metadata: { entityName },
    }),

    createGenerationStep({
      id: "permissions",
      type: "permissions",
      name: `${entityName} Permissions`,
      description: `Permission rules for ${entityName}`,
      targetPath: `src/core/permissions/${entityName}Permissions.ts`,
      dependencies: ["entity-definition"],
      metadata: { entityName },
    }),

    createGenerationStep({
      id: "search",
      type: "search",
      name: `${entityName} Search`,
      description: `Search configuration for ${entityName}`,
      targetPath: `src/core/search/${entityName}Search.ts`,
      dependencies: ["entity-definition"],
      metadata: { entityName },
    }),

    createGenerationStep({
      id: "documentation",
      type: "documentation",
      name: `${entityName} Documentation`,
      description: `Documentation for ${entityName}`,
      targetPath: `docs/entities/${entityName}.md`,
      dependencies: ["entity-definition"],
      metadata: { entityName },
    }),

    createGenerationStep({
      id: "tests",
      type: "tests",
      name: `${entityName} Tests`,
      description: `Test suite for ${entityName}`,
      targetPath: `src/__tests__/${entityName}.test.ts`,
      dependencies: ["service", "validator"],
      metadata: { entityName },
    }),
  ];

  // Create the immutable plan
  const plan = createGenerationPlan({
    id: `plan-${entityName.toLowerCase()}-${Date.now()}`,
    name: `Generate ${entityName}`,
    subject: entityName,
    subjectType: "entity",
    steps: steps,
    metadata: {
      entityName,
      rootDir,
      version: "0.1",
    },
  });

  return plan;
}
