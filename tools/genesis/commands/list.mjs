/**
 * list command
 *
 * List Genesis packages.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs list packages
 *   node tools/genesis/genesis.mjs list packages --installed
 *   node tools/genesis/genesis.mjs list packages --available
 */

import { readFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = join(__dirname, "../../../");

export async function runListCommand(args = []) {
  const [target, ...options] = args;

  if (target !== "packages") {
    console.error("Unknown list target. Use: list packages");
    process.exit(1);
  }

  try {
    const registryPath = join(projectRoot, "out/packages/registry.json");
    if (!existsSync(registryPath)) {
      console.log("No packages found.");
      return;
    }

    const registry = JSON.parse(readFileSync(registryPath, "utf8"));

    // Filter based on options
    let packages = registry.packages || [];

    if (options.includes("--installed")) {
      packages = packages.filter(p => p.installPath !== null);
    } else if (options.includes("--available")) {
      packages = packages.filter(p => p.installPath === null);
    }

    if (packages.length === 0) {
      console.log("No packages found.");
      return;
    }

    console.log("\nGenesis Packages\n");
    console.log(
      "Name".padEnd(30) +
      "Version".padEnd(12) +
      "Publisher".padEnd(20) +
      "Status"
    );
    console.log("-".repeat(80));

    for (const pkg of packages) {
      const status = pkg.installPath ? "✓ Installed" : "Available";
      console.log(
        pkg.name.padEnd(30) +
        pkg.version.padEnd(12) +
        pkg.publisher.padEnd(20) +
        status
      );
    }

    console.log("");
    console.log(`Total: ${packages.length} packages`);

    const installed = packages.filter(p => p.installPath !== null);
    if (installed.length > 0) {
      console.log(`Installed: ${installed.length}`);
    }
    console.log("");
  } catch (error) {
    console.error(`\n✗ List failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}
