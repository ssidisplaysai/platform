/**
 * BootTests - Genesis Runtime Boot Tests
 *
 * Test suite for the 12-stage Runtime Boot Pipeline.
 *
 * @module tools/genesis/tests/suites/BootTests.mjs
 */

import { TestSuite } from '../TestSuite.mjs';
import { RuntimeBootPipeline } from '../../runtime/RuntimeBootPipeline.mjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../../..');

/**
 * Create and return boot test suite
 */
export default async function createBootTests() {
  const suite = new TestSuite('Runtime Boot', 'Genesis Runtime Boot v1 Pipeline');

  suite.addTest('Boot manifest exists', async () => {
    const manifestPath = join(projectRoot, 'out/generated/modules/module-registry.json');
    if (!existsSync(manifestPath)) {
      throw new Error('Module registry manifest not found - run compile modules first');
    }
  });

  suite.addTest('Boot pipeline initializes', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const manifest = pipeline.getBootManifest();
    if (!manifest.bootId) {
      throw new Error('Boot ID not set');
    }
    if (manifest.status !== 'pending') {
      throw new Error('Initial status should be pending');
    }
  });

  suite.addTest('Boot pipeline discovers modules', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.discoveredModules !== 7) {
      throw new Error(`Expected 7 modules, got ${result.finalState.discoveredModules}`);
    }
  });

  suite.addTest('Boot pipeline discovers APIs', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.discoveredAPIs !== 7) {
      throw new Error(`Expected 7 APIs, got ${result.finalState.discoveredAPIs}`);
    }
  });

  suite.addTest('Boot pipeline discovers workflows', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.discoveredWorkflows !== 7) {
      throw new Error(`Expected 7 workflows, got ${result.finalState.discoveredWorkflows}`);
    }
  });

  suite.addTest('Boot pipeline discovers automations', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.discoveredAutomations !== 7) {
      throw new Error(`Expected 7 automations, got ${result.finalState.discoveredAutomations}`);
    }
  });

  suite.addTest('Boot pipeline discovers AI agents', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.discoveredAgents === 0) {
      throw new Error('Should discover at least one AI agent');
    }
  });

  suite.addTest('Boot pipeline registers modules', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.registeredModules !== 7) {
      throw new Error(`Expected 7 registered modules, got ${result.finalState.registeredModules}`);
    }
  });

  suite.addTest('Boot pipeline registers APIs', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.registeredAPIs !== 7) {
      throw new Error(`Expected 7 registered APIs, got ${result.finalState.registeredAPIs}`);
    }
  });

  suite.addTest('Boot pipeline registers workflows', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.registeredWorkflows === 0) {
      throw new Error('Should register some workflows');
    }
  });

  suite.addTest('Boot pipeline registers automations', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.registeredAutomations === 0) {
      throw new Error('Should register some automations');
    }
  });

  suite.addTest('Boot pipeline registers AI agents', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.registeredAgents === 0) {
      throw new Error('Should register some agents');
    }
  });

  suite.addTest('Boot pipeline completes all 12 stages', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.stageResults.length !== 12) {
      throw new Error(`Expected 12 stages, got ${result.stageResults.length}`);
    }
  });

  suite.addTest('Boot pipeline reaches READY state', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (!result.finalState.ready) {
      throw new Error('Runtime should be ready');
    }
    if (result.finalState.phase !== 'ready') {
      throw new Error('Phase should be ready');
    }
  });

  suite.addTest('Boot discovers total expected items', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.finalState.totalDiscovered < 40) {
      throw new Error(`Expected at least 40 total discovered items, got ${result.finalState.totalDiscovered}`);
    }
  });

  suite.addTest('Boot resolves dependencies', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    const context = pipeline.getContext();
    if (!Array.isArray(context.dependencies)) {
      throw new Error('Dependencies should be an array');
    }
  });

  suite.addTest('Boot completes without critical errors', async () => {
    const pipeline = new RuntimeBootPipeline({
      manifestDiscoveryPath: join(projectRoot, 'out/generated')
    });
    
    const result = await pipeline.boot();
    if (result.status !== 'completed') {
      throw new Error(`Boot status should be completed, got ${result.status}`);
    }
  });

  return suite;
}
