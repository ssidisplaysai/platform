/**
 * RuntimeBootRunner - Genesis Runtime Boot v1 Runner
 *
 * Executes the Genesis Runtime Boot pipeline and reports results.
 *
 * @module tools/genesis/runtime/RuntimeBootRunner.mjs
 */

import { RuntimeBootPipeline } from './RuntimeBootPipeline.mjs';
import fs from 'fs';
import path from 'path';

/**
 * Run the runtime boot pipeline
 */
export async function runRuntimeBoot() {
  try {
    const config = {
      manifestDiscoveryPath: path.join(process.cwd(), 'out', 'generated'),
      validateManifests: true,
      validateDependencies: true,
      resolveCircularDependencies: true,
      failOnValidationError: false,
      failOnRegistrationError: false,
      timeout: 30000
    };

    const pipeline = new RuntimeBootPipeline(config);
    const bootManifest = await pipeline.boot();

    // Save boot manifest
    const bootManifestPath = path.join(config.manifestDiscoveryPath, 'runtime-boot-manifest.json');
    fs.writeFileSync(bootManifestPath, JSON.stringify(bootManifest, null, 2), 'utf-8');

    // Return results
    return {
      success: bootManifest.finalState.ready,
      bootManifest,
      manifestPath: bootManifestPath
    };
  } catch (error) {
    console.error(`\n❌ Runtime Boot Failed: ${error.message}`);
    throw error;
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  runRuntimeBoot().catch(error => {
    process.exit(1);
  });
}
