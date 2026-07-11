/**
 * RollbackManager.mjs
 *
 * Manages promotion rollback on failures.
 *
 * Purpose:
 *   - Tracks what was promoted
 *   - Provides rollback capability
 *   - Simulates rollback operations
 *   - Ensures reversibility
 */

export class RollbackRecord {
  constructor(config) {
    this.step = config.step;        // What was promoted
    this.targetFile = config.targetFile; // Where it was copied
    this.timestamp = config.timestamp || new Date().toISOString();

    Object.freeze(this);
  }
}

/**
 * Rollback manager for promotion operations
 */
export class RollbackManager {
  constructor() {
    this.records = [];
    this.rolledBack = false;
  }

  /**
   * Record a promotion for potential rollback
   */
  recordPromotion(step, targetFile) {
    this.records.push(
      new RollbackRecord({
        step,
        targetFile,
      })
    );
  }

  /**
   * Perform rollback (simulated)
   */
  async performRollback() {
    if (this.rolledBack) {
      return {
        success: false,
        message: "Rollback already performed",
      };
    }

    // Simulate removing promoted files
    const removedCount = this.records.length;

    // Clear records
    this.records = [];
    this.rolledBack = true;

    return {
      success: true,
      message: `Rolled back ${removedCount} promoted artifacts`,
      removedCount,
    };
  }

  /**
   * Get rollback status
   */
  getStatus() {
    return {
      recordedPromotions: this.records.length,
      isRolledBack: this.rolledBack,
      canRollback: !this.rolledBack && this.records.length > 0,
    };
  }

  /**
   * Get promotion records
   */
  getRecords() {
    return [...this.records]; // Return copy
  }
}

/**
 * Create a rollback manager
 */
export function createRollbackManager() {
  return new RollbackManager();
}
