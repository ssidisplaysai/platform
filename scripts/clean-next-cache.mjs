import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const cachePath = path.join(process.cwd(), ".next");
const dryRun = process.argv.includes("--dry-run");

if (!existsSync(cachePath)) {
  console.log(`Next cache is already absent: ${cachePath}`);
} else if (dryRun) {
  console.log(`Would remove Next cache: ${cachePath}`);
} else {
  rmSync(cachePath, { recursive: true, force: true });
  console.log(`Removed Next cache: ${cachePath}`);
}