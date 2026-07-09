/**
 * compileModules command
 *
 * Compiles module manifests from module metadata and object registration data.
 * Uses the ModuleCompiler for metadata-driven module manifest generation.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs compile modules
 *
 * Output:
 *   - Generated module manifests in out/generated/modules/
 *   - Module registry summary
 *
 * @module tools/genesis/commands/compileModules
 */

import ModuleCompiler from '../compiler/compiler/ModuleCompiler.mjs';

/**
 * Run the compile modules command
 *
 * @param {Object} options - Command options
 * @returns {Promise<void>}
 */
export async function runCompileModulesCommand(options = []) {
  try {
    const compiler = new ModuleCompiler();
    const result = await compiler.compileModules();

    if (result.failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`\nModule compilation failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
