/**
 * PromotionStep.mjs (embedded in PromotionPlan.mjs)
 *
 * Represents a single promotion step.
 */

export class PromotionStep {
  constructor(config) {
    this.type = config.type; // e.g., "validate", "copy-definition", "register"
    this.name = config.name; // e.g., "Validate Slice", "Copy Definition"
    this.sourceFile = config.sourceFile || null; // For copy steps
    this.targetFile = config.targetFile || null; // For copy steps
    this.description = config.description || "";
    this.order = config.order;

    Object.freeze(this);
  }
}

/**
 * PromotionPlan.mjs
 *
 * Immutable, ordered plan for promoting an entity.
 *
 * Purpose:
 *   - Contains all promotion steps in order
 *   - Defines what will happen before execution
 *   - Provides structure for promotion engine
 */

export class PromotionPlan {
  constructor(config) {
    this.entityName = config.entityName;
    this.steps = config.steps || [];
    this.createdAt = config.createdAt || new Date().toISOString();

    // Freeze to enforce immutability
    Object.freeze(this.steps);
    Object.freeze(this);
  }

  /**
   * Get total number of steps
   */
  getStepCount() {
    return this.steps.length;
  }

  /**
   * Get steps by type
   */
  getStepsByType(type) {
    return this.steps.filter((step) => step.type === type);
  }

  /**
   * Validate plan structure
   */
  isValid() {
    return (
      this.steps.length > 0 &&
      this.steps.every((step) => step.type && step.name && step.order >= 0)
    );
  }
}

/**
 * Create a promotion plan for an entity
 */
export function createPromotionPlan(config) {
  const entityName = config.entityName;
  const steps = [];
  let order = 0;

  // Step 1: Validate the generated slice
  steps.push(
    new PromotionStep({
      type: "validate",
      name: "Generated Slice Validated",
      description: "Validate that generated slice has all 9 artifacts",
      order: order++,
    })
  );

  // Step 2-8: Copy artifact files
  const artifacts = [
    { name: "Definition", file: "Definition" },
    { name: "Repository", file: "Repository" },
    { name: "Service", file: "Service" },
    { name: "Validator", file: "Validator" },
    { name: "Events", file: "Events" },
    { name: "Permissions", file: "Permissions" },
    { name: "Search", file: "Search" },
  ];

  for (const artifact of artifacts) {
    steps.push(
      new PromotionStep({
        type: "copy-artifact",
        name: `${artifact.name} Promoted`,
        sourceFile: `${entityName}${artifact.file}`,
        description: `Copy ${artifact.name} artifact to runtime directory`,
        order: order++,
      })
    );
  }

  // Step 9: Copy documentation
  steps.push(
    new PromotionStep({
      type: "copy-artifact",
      name: "Documentation Promoted",
      sourceFile: `${entityName}Documentation.md`,
      description: "Copy documentation to runtime directory",
      order: order++,
    })
  );

  // Step 10: Register in runtime
  steps.push(
    new PromotionStep({
      type: "register-runtime",
      name: "Runtime Registered",
      description: "Register entity in Genesis Runtime (simulated)",
      order: order++,
    })
  );

  return new PromotionPlan({
    entityName,
    steps,
  });
}
