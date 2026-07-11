/**
 * RendererRegistryTest
 *
 * Tests the complete plugin-based renderer registry system.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseYAML } from '../tools/genesis/utils/SimpleYAMLParser.mjs';
import { expandAllFields } from '../tools/genesis/compiler/metadata-engine/FieldExpander.mjs';
import { expandAllRelationships } from '../tools/genesis/compiler/metadata-engine/RelationshipExpander.mjs';
import { expandCapabilities } from '../tools/genesis/compiler/metadata-engine/CapabilityExpander.mjs';
import { expandLifecycle } from '../tools/genesis/compiler/metadata-engine/LifecycleExpander.mjs';

import { buildBlueprint } from '../tools/genesis/compiler/ir/BlueprintBuilder.mjs';
import { registerDefaultRenderers, rendererRegistry } from '../tools/genesis/compiler/registry/RendererRegistry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

console.log('🧪 Testing RendererRegistry Plugin System\n');

async function test() {
  try {
    // Register all default renderers
    console.log('📍 Registering default renderers...');
    await registerDefaultRenderers();
    
    const registeredTargets = rendererRegistry.getRegisteredTargets();
    console.log(`   ✓ Registered ${registeredTargets.length} renderers: ${registeredTargets.join(', ')}\n`);
    
    // Load Customer entity definition
    console.log('📍 Loading Customer entity definition...');
    const definitionPath = path.join(projectRoot, 'definitions/entity/Customer.entity.yaml');
    const yamlContent = fs.readFileSync(definitionPath, 'utf-8');
    const rawMetadata = parseYAML(yamlContent);
    console.log('   ✓ Loaded\n');
    
    // Expand metadata
    console.log('📍 Expanding metadata...');
    const expandedFields = expandAllFields(rawMetadata.fields || {});
    const expandedRelationships = expandAllRelationships(rawMetadata.relationships);
    const expandedCapabilities = expandCapabilities(rawMetadata.capabilities);
    const expandedLifecycle = expandLifecycle(rawMetadata.lifecycle);
    console.log('   ✓ Expanded\n');
    
    // Build blueprint
    console.log('📍 Building EnterpriseObjectBlueprint...');
    const blueprint = buildBlueprint(
      'Customer',
      rawMetadata,
      expandedFields,
      expandedRelationships,
      expandedCapabilities,
      expandedLifecycle,
      definitionPath
    );
    console.log('   ✓ Blueprint created\n');
    
    // Test renderAll
    console.log('📍 Testing renderAll() to generate all artifacts...');
    const artifacts = rendererRegistry.renderAll(blueprint);
    
    console.log(`   ✓ Rendered ${artifacts.size} artifacts:\n`);
    for (const [targetId, content] of artifacts) {
      if (content) {
        const lines = content.split('\n').length;
        console.log(`     • ${targetId.padEnd(18)} - ${lines} lines`);
      } else {
        console.log(`     ❌ ${targetId.padEnd(18)} - NULL CONTENT`);
      }
    }
    
    // Verify all required artifacts were rendered
    console.log('\n📍 Verifying all artifacts rendered successfully...');
    const nullArtifacts = Array.from(artifacts.entries())
      .filter(([_, content]) => !content)
      .map(([id, _]) => id);
    
    if (nullArtifacts.length > 0) {
      console.log(`   ❌ Failed to render: ${nullArtifacts.join(', ')}`);
      process.exit(1);
    }
    
    console.log('   ✓ All artifacts rendered\n');
    
    console.log('✅ RendererRegistry Plugin System Test Complete!\n');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
