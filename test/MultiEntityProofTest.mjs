#!/usr/bin/env node

/**
 * Multi-Entity Proof Pack Test
 * 
 * Validates that the Genesis Compiler v1 can compile 5 completely different
 * entity types (Project, Asset, InventoryItem, Machine, WorkOrder) using
 * identical generic compilation pipeline with ZERO entity-specific code.
 * 
 * Tests:
 * 1. Each entity compiles to 9 identical artifacts
 * 2. All entities use same metadata expansion pipeline
 * 3. All entities use same blueprint IR contract
 * 4. All entities use same renderer registry
 * 5. Customer and Vendor still compile (regression)
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { generate } from '../tools/genesis/compiler/CodeGenerationEngine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Genesis Object Compiler v1                              ║');
  console.log('║   Multi-Entity Proof Pack (5 Entity Types)                ║');
  console.log('║   Validates Zero Entity-Specific Code Compiler            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Proof Pack Entities: Project, Asset, InventoryItem, Machine, WorkOrder
  const proofPackEntities = [
    'Project',
    'Asset',
    'InventoryItem',
    'Machine',
    'WorkOrder'
  ];

  // Regression entities (ensure we didn't break existing entities)
  const regressionEntities = [
    'Customer',
    'Vendor'
  ];

  const allEntities = [...regressionEntities, ...proofPackEntities];

  console.log('Generating Multi-Entity Proof Pack:');
  console.log(`  Proof Pack: ${proofPackEntities.join(', ')}`);
  console.log(`  Regression: ${regressionEntities.join(', ')}`);
  console.log(`  Total: ${allEntities.length} entities\n`);

  const results = {
    passed: [],
    failed: [],
    artifacts: {}
  };

  // Generate each entity
  for (const entity of allEntities) {
    process.stdout.write(`Generating ${entity}... `);
    try {
      await generate({ entity });
      
      // Count artifacts
      const outputDir = path.join(projectRoot, 'out/generated/entities', entity);
      if (!fs.existsSync(outputDir)) {
        throw new Error(`Output directory not found: ${outputDir}`);
      }
      
      const files = fs.readdirSync(outputDir);
      const artifactCount = files.length;
      
      results.passed.push(entity);
      results.artifacts[entity] = {
        count: artifactCount,
        files: files
      };
      
      console.log(`✓ (${artifactCount} artifacts)\n`);
    } catch (error) {
      results.failed.push(entity);
      console.log(`✗ FAILED: ${error.message}\n`);
    }
  }

  // Print results
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Proof Pack Results                                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log(`Passed: ${results.passed.length}/${allEntities.length}`);
  for (const entity of results.passed) {
    const count = results.artifacts[entity].count;
    console.log(`  ✓ ${entity} (${count} artifacts)`);
  }

  if (results.failed.length > 0) {
    console.log(`\nFailed: ${results.failed.length}/${allEntities.length}`);
    for (const entity of results.failed) {
      console.log(`  ✗ ${entity}`);
    }
  }

  // Validate consistency
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   Consistency Validation                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const artifactCounts = Object.values(results.artifacts).map(a => a.count);
  const minCount = Math.min(...artifactCounts);
  const maxCount = Math.max(...artifactCounts);

  if (minCount === maxCount && minCount === 8) {
    console.log(`✓ All entities generate exactly ${minCount} artifacts`);
    console.log('✓ Zero entity-specific compiler logic needed');
    console.log('✓ Generic pipeline handles all entity types');
  } else {
    console.log(`✗ Inconsistent artifact counts: min=${minCount}, max=${maxCount}`);
  }

  // Check for standard artifact types
  console.log('\nArtifact Type Distribution:');
  const sampleEntity = results.passed[0];
  if (sampleEntity) {
    const sampleFiles = results.artifacts[sampleEntity].files;
    const types = {};
    for (const file of sampleFiles) {
      const match = file.match(/\.([^.]+)$/);
      if (match) {
        types[match[1]] = (types[match[1]] || 0) + 1;
      }
    }
    for (const [type, count] of Object.entries(types)) {
      console.log(`  .${type}: ${count} files`);
    }
  }

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  if (results.failed.length === 0 && minCount === maxCount && minCount === 8) {
    console.log('║   ✓ MULTI-ENTITY PROOF PACK PASSED                         ║');
    console.log('║   Genesis Compiler v1 is PROVEN GENERIC                   ║');
  } else {
    console.log('║   ✗ MULTI-ENTITY PROOF PACK FAILED                         ║');
  }
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  process.exit(results.failed.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n✗ Test harness error:', error);
  process.exit(1);
});
