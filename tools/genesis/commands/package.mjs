/**
 * package command
 *
 * Package compiled artifacts for distribution.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs package <name> [version] [options]
 *   node tools/genesis/genesis.mjs package genesis-crm 1.0.0
 *   node tools/genesis/genesis.mjs package genesis-crm 1.0.0 --publisher "My Org"
 */

import { PackageCompiler } from "../compiler/PackageCompiler.mjs";

export async function runPackageCommand(args = []) {
  const [packageName, version, ...options] = args;

  if (!packageName) {
    console.error("Missing package name.");
    console.error("Usage: node tools/genesis/genesis.mjs package <name> [version]");
    console.error("Example: node tools/genesis/genesis.mjs package genesis-crm 1.0.0");
    process.exit(1);
  }

  try {
    const packageVersion = version || "1.0.0";
    const packageOptions = {};

    // Parse options
    for (let i = 0; i < options.length; i++) {
      if (options[i] === "--publisher" && options[i + 1]) {
        packageOptions.publisher = options[i + 1];
        i++;
      } else if (options[i] === "--description" && options[i + 1]) {
        packageOptions.description = options[i + 1];
        i++;
      }
    }

    const compiler = new PackageCompiler(packageName, packageVersion, packageOptions);
    const success = await compiler.compile();

    if (!success) {
      console.error("\n✗ Package creation failed");
      if (compiler.errors.length > 0) {
        console.error("\nErrors:");
        compiler.errors.forEach(err => console.error(`  • ${err}`));
      }
      process.exit(1);
    }

    if (compiler.warnings.length > 0) {
      console.warn("\nWarnings:");
      compiler.warnings.forEach(warn => console.warn(`  ⚠️  ${warn}`));
    }
  } catch (error) {
    console.error(`Package creation failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
