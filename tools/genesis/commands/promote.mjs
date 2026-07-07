/**
 * promote command
 *
 * Promotes validated generated slices into the Genesis Runtime.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs promote Customer
 *
 * Purpose:
 *   - Validates generated slice
 *   - Promotes artifacts to runtime
 *   - Registers in Genesis Runtime
 *   - Supports rollback on failure
 *
 * Output:
 *   - Promotion status
 *   - Promoted artifacts list
 *   - Registered components
 *   - Rollback status
 *
 * NOTE: Phase 7 is SIMULATION ONLY
 *   - No actual file copying
 *   - No runtime modifications
 *   - Architecture established for future phases
 */

import { promoteEntity } from "../compiler/promotion/PromotionEngine.mjs";

export async function runPromoteCommand(entityName) {
  if (!entityName) {
    console.error("Missing entity name.");
    console.error("Usage: node tools/genesis/genesis.mjs promote <EntityName>");
    console.error("Example: node tools/genesis/genesis.mjs promote Customer");
    process.exit(1);
  }

  try {
    // Promote the entity
    const result = await promoteEntity(entityName);

    // Output result
    console.log(result.formatForConsole());

    // Exit with appropriate code
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error("Promotion failed.");
    console.error(error.message);
    process.exit(1);
  }
}
