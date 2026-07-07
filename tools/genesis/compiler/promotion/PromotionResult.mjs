/**
 * PromotionResult.mjs
 *
 * Immutable result of a promotion operation.
 *
 * Purpose:
 *   - Stores promotion outcome and diagnostics
 *   - Tracks promoted and skipped artifacts
 *   - Records rollback status
 *   - Determines success/failure
 */

export class PromotionResult {
  constructor(config) {
    this.success = config.success;
    this.entityName = config.entityName;
    this.promotedArtifacts = config.promotedArtifacts || [];
    this.skippedArtifacts = config.skippedArtifacts || [];
    this.registeredComponents = config.registeredComponents || [];
    this.diagnostics = config.diagnostics || [];
    this.rollbackPerformed = config.rollbackPerformed || false;
    this.error = config.error || null;
    this.promotedAt = config.promotedAt || new Date().toISOString();

    // Freeze to enforce immutability
    Object.freeze(this.promotedArtifacts);
    Object.freeze(this.skippedArtifacts);
    Object.freeze(this.registeredComponents);
    Object.freeze(this.diagnostics);
    Object.freeze(this);
  }

  /**
   * Get total promoted count
   */
  getPromotedCount() {
    return this.promotedArtifacts.length;
  }

  /**
   * Get total skipped count
   */
  getSkippedCount() {
    return this.skippedArtifacts.length;
  }

  /**
   * Get total registered count
   */
  getRegisteredCount() {
    return this.registeredComponents.length;
  }

  /**
   * Format result for console output
   */
  formatForConsole() {
    const lines = [];

    lines.push("");
    lines.push("Genesis Promotion Engine v0.1");
    lines.push("");
    lines.push("Promoting");
    lines.push("");
    lines.push(this.entityName);
    lines.push("");

    // Show promoted artifacts
    for (const artifact of this.promotedArtifacts) {
      lines.push(`✓ ${artifact}`);
    }

    // Show registered components
    for (const component of this.registeredComponents) {
      lines.push(`✓ ${component}`);
    }

    // Show errors if any
    if (this.error) {
      lines.push("");
      lines.push(`✖ Error: ${this.error}`);
    }

    lines.push("");
    lines.push("Promotion Complete");
    lines.push("");
    lines.push(`Artifacts Promoted: ${this.getPromotedCount()}`);
    lines.push(`Components Registered: ${this.getRegisteredCount()}`);

    if (this.rollbackPerformed) {
      lines.push("Rollback: Performed");
    } else {
      lines.push("Rollback: None");
    }

    lines.push("");

    return lines.join("\n");
  }
}

/**
 * Create a promotion result
 */
export function createPromotionResult(config) {
  return new PromotionResult(config);
}
