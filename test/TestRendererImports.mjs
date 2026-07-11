/**
 * Test each renderer import individually
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

async function testImports() {
  const renderers = [
    'RepositoryRenderer.mjs',
    'ServiceRenderer.mjs',
    'ValidatorRenderer.mjs',
    'PermissionsRenderer.mjs',
    'EventsRenderer.mjs',
    'SearchRenderer.mjs',
    'DocumentationRenderer.mjs',
    'TestRenderer.mjs',
  ];

  for (const renderer of renderers) {
    try {
      console.log(`Testing ${renderer}...`);
      const fullPath = path.join(projectRoot, 'tools/genesis/compiler/renderers', renderer);
      const { pathToFileURL } = await import('url');
      const mod = await import(pathToFileURL(fullPath).href);
      console.log(`  ✓ OK - exports:`, Object.keys(mod).join(', '));
    } catch (e) {
      console.error(`  ❌ FAILED:`, e.message);
      console.error(e.stack);
      process.exit(1);
    }
  }

  console.log('\n✅ All renderer imports successful!');
}

testImports();
