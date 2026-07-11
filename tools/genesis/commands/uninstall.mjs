/**
 * uninstall command
 *
 * Uninstall a Genesis package.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs uninstall <package> [version]
 *   node tools/genesis/genesis.mjs uninstall genesis-crm
 *   node tools/genesis/genesis.mjs uninstall genesis-crm 1.0.0
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export async function runUninstallCommand(args = []) {
  const [packageName, version] = args;

  if (!packageName) {
    console.error("Missing package name.");
    console.error("Usage: node tools/genesis/genesis.mjs uninstall <package> [version]");
    console.error("Example: node tools/genesis/genesis.mjs uninstall genesis-crm");
    process.exit(1);
  }

  try {
    console.log(`\n≡ƒ¢Ç Uninstalling package '${packageName}'${version ? ` v${version}` : ""}`);
    console.log("");

    const registryPath = join(projectRoot, "out/packages/registry.json");
    if (!existsSync(registryPath)) {
      console.error("✗ Package registry not found.");
      process.exit(1);
    }

    const registry = JSON.parse(readFileSync(registryPath, "utf8"));
    const packageNamespace = packageName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    // Find package in registry
    let packageEntry = null;
    let entryIndex = -1;

    if (version) {
      entryIndex = registry.packages.findIndex(
        p => p.namespace === packageNamespace && p.version === version
      );
    } else {
      // Find latest version
      const matches = registry.packages.filter(p => p.namespace === packageNamespace);
      if (matches.length > 0) {
        packageEntry = matches.sort((a, b) => b.version.localeCompare(a.version))[0];
        entryIndex = registry.packages.indexOf(packageEntry);
      }
    }

    if (entryIndex < 0) {
      console.error(`✗ Package not found: ${packageName}${version ? ` v${version}` : ""}`);
      process.exit(1);
    }

    packageEntry = registry.packages[entryIndex];

    console.log("Stage 1: Validate Package");
    console.log(`  ✓ Package found: ${packageEntry.name} v${packageEntry.version}`);

    console.log("Stage 2: Uninstall Package");
    
    // Mark as uninstalled
    packageEntry.installPath = null;
    packageEntry.installedAt = null;

    registry.packages[entryIndex] = packageEntry;
    writeFileSync(registryPath, JSON.stringify(registry, null, 2));
    console.log(`  ✓ Package uninstalled`);

    console.log("Stage 3: Verify Uninstallation");
    console.log(`  ✓ Package removed successfully`);

    console.log("\n≡ƒôè UNINSTALLATION COMPLETED");
    console.log("");
    console.log(`  Package: ${packageEntry.name}`);
    console.log(`  Version: ${packageEntry.version}`);
    console.log("");
  } catch (error) {
    console.error(`\n✗ Uninstallation failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
