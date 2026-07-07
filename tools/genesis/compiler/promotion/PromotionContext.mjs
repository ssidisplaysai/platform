/**
 * PromotionContext.mjs
 *
 * Immutable context for promotion operations.
 *
 * Purpose:
 *   - Provides configuration for promotion pipeline
 *   - Validates required context fields
 *   - Freezes to ensure immutability
 */

export class PromotionContext {
  constructor(config) {
    if (!config.entityName) {
      throw new Error("PromotionContext requires entityName");
    }
    if (!config.sourceDirectory) {
      throw new Error("PromotionContext requires sourceDirectory");
    }
    if (!config.targetDirectory) {
      throw new Error("PromotionContext requires targetDirectory");
    }

    this.entityName = config.entityName;
    this.sourceDirectory = config.sourceDirectory;
    this.targetDirectory = config.targetDirectory;
    this.runtime = config.runtime || "simulated";
    this.options = config.options || {};
    this.createdAt = new Date().toISOString();

    // Freeze to enforce immutability
    Object.freeze(this);
  }

  /**
   * Get short name (without namespace)
   */
  getShortName() {
    return this.entityName;
  }

  /**
   * Get target artifact directory
   */
  getTargetArtifactDirectory() {
    return `${this.targetDirectory}/${this.entityName}`;
  }
}

/**
 * Create a promotion context
 */
export function createPromotionContext(config) {
  return new PromotionContext(config);
}
