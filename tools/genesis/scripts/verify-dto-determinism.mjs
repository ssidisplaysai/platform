import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { generate } from '../compiler/CodeGenerationEngine.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');

async function getFileHashes(dir, pattern) {
  const hashes = {};
  const files = fs.readdirSync(dir, { recursive: true });
  for (const file of files) {
    if (file.endsWith(pattern)) {
      const fullPath = path.join(dir, file);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      hashes[file] = hash;
    }
  }
  return hashes;
}

console.log('\n🔍 Verifying DTORenderer Determinism...\n');

// First generation
console.log('Generation 1...');
await generate();
const hash1 = await getFileHashes(path.join(projectRoot, 'out/generated/entities'), '.dtos.ts');

// Clear and regenerate
console.log('Generation 2...');
const entityDir = path.join(projectRoot, 'out/generated/entities');
fs.rmSync(entityDir, { recursive: true, force: true });
await generate();
const hash2 = await getFileHashes(path.join(projectRoot, 'out/generated/entities'), '.dtos.ts');

// Compare
console.log('\nResults:');
let allMatch = true;
const entities = ['Asset', 'Customer', 'InventoryItem', 'Machine', 'Project', 'Vendor', 'WorkOrder'];
for (const entity of entities) {
  const pattern = `${entity}.dtos.ts`;
  const files = Object.keys(hash1).filter(f => f.endsWith(pattern));
  if (files.length === 0) {
    console.log(`✗ ${entity}: File not found`);
    allMatch = false;
  } else {
    const file = files[0];
    if (hash1[file] === hash2[file]) {
      console.log(`✓ ${entity}: Deterministic`);
    } else {
      console.log(`✗ ${entity}: Hash mismatch`);
      allMatch = false;
    }
  }
}

if (allMatch) {
  console.log('\n✓ All *.dtos.ts artifacts are byte-for-byte identical\n');
  process.exit(0);
} else {
  console.log('\n✗ Determinism verification failed\n');
  process.exit(1);
}
