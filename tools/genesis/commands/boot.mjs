/**
 * boot command
 *
 * Boots the Genesis Runtime.
 *
 * Usage:
 *   node tools/genesis/genesis.mjs boot
 *
 * Stages:
 *   1. Manifest Discovery - Discover all generated manifests
 *   2. Manifest Validation - Validate all manifests
 *   3. Module Registration - Register modules
 *   4. Object Registration - Register objects
 *   5. Repository Registration - Register repositories
 *   6. Service Registration - Register services
 *   7. API Registration - Register APIs
 *   8. Workflow Registration - Register workflows
 *   9. Automation Registration - Register automations
 *   10. AI Agent Registration - Register AI agents
 *   11. Dependency Resolution - Resolve all dependencies
 *   12. Runtime Ready - Verify runtime is ready
 *
 * Output:
 *   - Boot manifest JSON
 *   - Runtime registry entries
 *   - Runtime ready state
 */

import { runRuntimeBoot } from "../runtime/RuntimeBootRunner.mjs";

export async function runBootCommand() {
  try {
    console.log('\n🚀 Genesis Runtime Boot v1\n');
    
    const result = await runRuntimeBoot();

    if (result.success) {
      console.log(`\n✅ Runtime Boot Successful`);
      console.log(`   Boot Manifest: ${result.manifestPath}\n`);
      return;
    } else {
      console.log(`\n⚠️  Runtime Boot Completed with issues\n`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Runtime Boot Failed: ${error.message}\n`);
    process.exit(1);
  }
}
