import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const suitesDir = 'tools/genesis/tests/suites';
const files = readdirSync(suitesDir).filter(f => f.endsWith('.mjs'));

for (const file of files) {
  const filePath = join(suitesDir, file);
  let content = readFileSync(filePath, 'utf8');

  // Replace patterns like:
  // const { X } = await import(join(projectRoot, '...'))
  // with:
  // const { X } = await import(pathToFileURL(join(projectRoot, '...')).href)
  
  // Also handle patterns like:
  // await import(join(...))
  
  // Simple approach: replace all `await import(join(` with `await import(pathToFileURL(join(`
  // and add `.href)` before the final `;`
  
  let newContent = content.replace(/await import\(join\(/g, 'await import(pathToFileURL(join(');
  
  // This won't work perfectly because we need to know where the closing paren is
  // Let's try a different approach - use a more sophisticated regex
  
  // Pattern: await import(join(...))
  // Replace with: await import(pathToFileURL(join(...)).href)
  newContent = newContent.replace(/await import\(join\(([^)]*)\)\)/g, 'await import(pathToFileURL(join($1)).href)');
  
  if (newContent !== content) {
    writeFileSync(filePath, newContent, 'utf8');
    console.log(`✓ Fixed ${file}`);
  } else {
    console.log(`- No changes needed for ${file}`);
  }
}
