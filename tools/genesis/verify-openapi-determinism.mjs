/**
 * Verify OpenAPI Renderer Determinism
 *
 * Regenerate all 7 entities twice and verify all
 * OpenAPI YAML files are byte-for-byte identical.
 */

import { createHash } from 'crypto';
import { readdirSync, readFileSync, rmSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// From tools/genesis/verify-openapi-determinism.mjs, go up 2 levels to platform/
const projectRoot = resolve(join(__dirname, '..', '..'));
const outDir = join(projectRoot, 'out/generated/entities');

const codeGenPath = pathToFileURL(join(projectRoot, 'tools/genesis/compiler/CodeGenerationEngine.mjs')).href;
const { generate } = await import(codeGenPath);

function computeHashes(basePath) {
  const hashes = {};
  const entities = readdirSync(basePath);
  
  for (const entity of entities) {
    const openApiPath = join(basePath, entity, `${entity}.openapi.yaml`);
    try {
      const content = readFileSync(openApiPath, 'utf8');
      hashes[entity] = createHash('sha256').update(content).digest('hex');
    } catch (err) {
      // Skip if file doesn't exist
    }
  }
  
  return hashes;
}

async function verify() {
  console.log('🧪 OpenAPI Renderer Determinism Verification');
  console.log('━'.repeat(50));
  
  // Generation 1
  console.log('\n📝 Generation 1...');
  await generate();
  const hashes1 = computeHashes(outDir);
  const count1 = Object.keys(hashes1).length;
  console.log(`✓ Generated ${count1} OpenAPI documents`);
  
  // Clear generated directory
  console.log('\n🗑️  Clearing generated artifacts...');
  rmSync(outDir, { recursive: true, force: true });
  
  // Generation 2
  console.log('\n📝 Generation 2...');
  await generate();
  const hashes2 = computeHashes(outDir);
  const count2 = Object.keys(hashes2).length;
  console.log(`✓ Generated ${count2} OpenAPI documents`);
  
  // Compare
  console.log('\n🔍 Comparing hashes...\n');
  
  const entities = Object.keys(hashes1).sort();
  let identical = 0;
  let different = 0;
  
  for (const entity of entities) {
    const hash1 = hashes1[entity];
    const hash2 = hashes2[entity];
    const match = hash1 === hash2;
    
    if (match) {
      console.log(`✓ ${entity}.openapi.yaml`);
      identical++;
    } else {
      console.log(`✗ ${entity}.openapi.yaml`);
      console.log(`  Gen1: ${hash1}`);
      console.log(`  Gen2: ${hash2}`);
      different++;
    }
  }
  
  console.log('\n' + '━'.repeat(50));
  console.log(`Results: ${identical}/${entities.length} byte-identical`);
  
  if (different === 0) {
    console.log('✅ OpenAPI documents are deterministic!');
    process.exit(0);
  } else {
    console.log('❌ OpenAPI documents are NOT deterministic');
    process.exit(1);
  }
}

verify().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
