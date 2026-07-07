/**
 * GeneratedSliceReport.mjs
 *
 * Immutable validation report for generated entity slices.
 *
 * Purpose:
 *   - Stores validation results
 *   - Tracks checked files and issues
 *   - Provides summary information
 *   - Supports success/failure determination
 */

export class GeneratedSliceReport {
  constructor(config) {
    this.entityName = config.entityName;
    this.slicePath = config.slicePath;
    this.checkedFiles = config.checkedFiles || [];
    this.foundFiles = config.foundFiles || [];
    this.missingFiles = config.missingFiles || [];
    this.validatedAt = config.validatedAt || new Date().toISOString();

    // Freeze to enforce immutability
    Object.freeze(this);
  }

  /**
   * Get total files checked
   */
  getTotalChecks() {
    return this.checkedFiles.length;
  }

  /**
   * Get total files found
   */
  getFoundCount() {
    return this.foundFiles.length;
  }

  /**
   * Get total files missing
   */
  getMissingCount() {
    return this.missingFiles.length;
  }

  /**
   * Determine if validation passed
   */
  isHealthy() {
    return this.missingFiles.length === 0;
  }

  /**
   * Get exit code (0 = success, 1 = failure)
   */
  getExitCode() {
    return this.isHealthy() ? 0 : 1;
  }

  /**
   * Format report for console output
   */
  formatForConsole() {
    const lines = [];

    // Header
    lines.push("");
    lines.push("Genesis Generated Slice Validator v0.1");
    lines.push("");
    lines.push("Validating Generated Slice");
    lines.push("");
    lines.push(this.entityName);
    lines.push("");

    // Validation results - show found files
    for (const foundFile of this.foundFiles) {
      if (typeof foundFile === "object" && foundFile.artifactType) {
        lines.push(`✓ ${foundFile.artifactType}`);
      } else {
        // Fallback for string paths
        const baseName = foundFile.split("/").pop();
        lines.push(`✓ ${baseName.replace(".ts", "").replace(".md", "")}`);
      }
    }

    // Show missing files
    for (const file of this.missingFiles) {
      const baseName = file.split(/[\\/]/).pop();
      lines.push(`✖ Missing: ${baseName}`);
    }

    lines.push("");
    lines.push("Validation Complete");
    lines.push("");
    lines.push(`${this.getFoundCount()} Checks Passed`);
    lines.push(`${this.getMissingCount()} Issues Found`);
    lines.push("");

    return lines.join("\n");
  }
}

/**
 * Create a new validation report
 */
export function createGeneratedSliceReport(config) {
  return new GeneratedSliceReport(config);
}
