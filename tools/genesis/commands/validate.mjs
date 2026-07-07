/**
 * validate command
 *
 * Validates sandbox-generated entity slices.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs validate generated Customer
 *
 * Purpose:
 *   - Checks for all 9 required artifact files
 *   - Ensures generated slice structure is complete
 *   - Validates file existence only (no content validation)
 *   - Never modifies files or integrates into runtime
 *
 * Output:
 *   - Validation report with per-file status
 *   - Summary of checks passed/issues found
 *   - Exit code 0 (healthy) or 1 (issues)
 */

import { validateGeneratedSlice } from "../validators/generated-slice/GeneratedSliceValidator.mjs";

export async function runValidateCommand(target, entityName) {
  // Validate arguments
  if (target !== "generated" && target !== "generated-slice") {
    console.error("Invalid validation target.");
    console.error("Usage: node tools/genesis/genesis.mjs validate generated <EntityName>");
    console.error("Example: node tools/genesis/genesis.mjs validate generated Customer");
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
