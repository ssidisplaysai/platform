/**
 * RuntimeBootPipeline Tests - Genesis Runtime Boot v1 Test Suite
 *
 * Tests the 12-stage boot pipeline to ensure all stages execute correctly
 * and the runtime reaches READY state.
 *
 * @module tools/genesis/runtime/RuntimeBootPipeline.test.mjs
 */

import { RuntimeBootPipeline } from './RuntimeBootPipeline.mjs';
import assert from 'assert';

/**
 * Test Suite: RuntimeBootPipeline
 */
export const tests = [
  {
    name: 'Boot pipeline initializes correctly',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const manifest = pipeline.getBootManifest();
      assert(manifest.bootId, 'Boot ID should be set');
      assert(manifest.status === 'pending', 'Initial status should be pending');
      assert(manifest.stages, 'Stages should be defined');
    }
  },

  {
    name: 'Boot pipeline discovers manifests',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.status === 'completed', 'Boot should complete');
      assert(result.finalState.ready !== undefined, 'Final state should have ready flag');
      assert(result.finalState.totalDiscovered > 0, 'Should discover manifests');
    }
  },

  {
    name: 'Boot discovers modules',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.discoveredModules > 0, 'Should discover modules');
      assert(result.finalState.discoveredModules === 7, 'Should discover 7 modules');
    }
  },

  {
    name: 'Boot discovers APIs',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.discoveredAPIs > 0, 'Should discover APIs');
      assert(result.finalState.discoveredAPIs === 7, 'Should discover 7 API contracts');
    }
  },

  {
    name: 'Boot discovers workflows',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.discoveredWorkflows > 0, 'Should discover workflows');
      assert(result.finalState.discoveredWorkflows === 7, 'Should discover 7 workflow contracts');
    }
  },

  {
    name: 'Boot discovers automations',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.discoveredAutomations > 0, 'Should discover automations');
      assert(result.finalState.discoveredAutomations === 7, 'Should discover 7 automation contracts');
    }
  },

  {
    name: 'Boot discovers AI agents',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.discoveredAgents > 0, 'Should discover AI agents');
      assert(result.finalState.discoveredAgents === 7, 'Should discover 7 agent contracts');
    }
  },

  {
    name: 'Boot registers modules',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.registeredModules > 0, 'Should register modules');
      assert(result.finalState.registeredModules === 7, 'Should register 7 modules');
    }
  },

  {
    name: 'Boot registers APIs',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.registeredAPIs > 0, 'Should register APIs');
      assert(result.finalState.registeredAPIs === 7, 'Should register 7 APIs');
    }
  },

  {
    name: 'Boot registers workflows',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.registeredWorkflows > 0, 'Should register workflows');
    }
  },

  {
    name: 'Boot registers automations',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.registeredAutomations > 0, 'Should register automations');
    }
  },

  {
    name: 'Boot registers AI agents',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.registeredAgents > 0, 'Should register AI agents');
    }
  },

  {
    name: 'Boot completes all stages',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.stageResults.length === 12, 'Should have 12 stage results');
      assert(result.stageResults.every(s => s.status !== 'pending'), 'No stage should be pending');
    }
  },

  {
    name: 'Boot reaches READY state',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.ready === true, 'Runtime should be ready');
      assert(result.finalState.phase === 'ready', 'Phase should be ready');
    }
  },

  {
    name: 'Boot discovers expected totals',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.totalDiscovered >= 50, 'Should discover at least 50 items');
    }
  },

  {
    name: 'Boot resolves dependencies',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.dependenciesResolved >= 0, 'Should resolve some dependencies');
    }
  },

  {
    name: 'Boot has no critical errors',
    fn: async () => {
      const pipeline = new RuntimeBootPipeline({
        manifestDiscoveryPath: 'out/generated'
      });
      
      const result = await pipeline.boot();
      assert(result.finalState.ready === true, 'Ready flag should be true on success');
      assert(result.status === 'completed', 'Boot status should be completed');
    }
  }
];

/**
 * Run tests
 */
export async function runTests() {
  console.log('\n📋 Runtime Boot Pipeline Tests\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      await test.fn();
      console.log(`  ✓ ${test.name}`);
      passed++;
    } catch (error) {
      console.log(`  ✗ ${test.name}`);
      console.log(`    Error: ${error.message}`);
      failed++;
    }
  }
  
  console.log(`\n  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log();
  
  return { passed, failed, total: tests.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}
