/**
 * validate command
 *
 * Validates generated entity slices or module manifests.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs validate generated Customer
 *   node tools/genesis/genesis.mjs validate modules
 *
 * Purpose:
 *   - Entity slices: Checks for required artifact files and completeness
 *   - Module manifests: Validates manifest structure, schema, and consistency
 *
 * Output:
 *   - Validation report with per-item status
 *   - Summary of checks passed/issues found
 *   - Exit code 0 (healthy) or 1 (issues)
 */

import { validateGeneratedSlice } from "../validators/generated-slice/GeneratedSliceValidator.mjs";
import { runValidateModulesCommand } from "./validateModules.mjs";

export async function runValidateCommand(target, entityName) {
  // Route to appropriate validator
  if (target === 'modules') {
    await runValidateModulesCommand();
    return;
  }

  // Validate arguments for entity validation
  if (target !== "generated" && target !== "generated-slice") {
    console.error("Invalid validation target.");
    console.error("Usage:");
    console.error("  node tools/genesis/genesis.mjs validate generated <EntityName>");
    console.error("  node tools/genesis/genesis.mjs validate modules");
    console.error("Examples:");
    console.error("  node tools/genesis/genesis.mjs validate generated Customer");
    console.error("  node tools/genesis/genesis.mjs validate modules");
    process.exit(1);
  }

  if (!entityName) {
    console.error("Missing entity name.");
    console.error("Usage: node tools/genesis/genesis.mjs validate generated <EntityName>");
    console.error("Example: node tools/genesis/genesis.mjs validate generated Customer");
    process.exit(1);
  }

  try {
    // Validate the generated slice
    const report = await validateGeneratedSlice(entityName);

    // Output report
    console.log(report.formatForConsole());

    // Exit with appropriate code
    process.exit(report.getExitCode());
  } catch (error) {
    console.error("Validation failed.");
    console.error(error.message);
    process.exit(1);
  }
}
