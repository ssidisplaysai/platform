import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const suitesDir = 'tools/genesis/tests/suites';
const files = readdirSync(suitesDir).filter(f => f.endsWith('.mjs'));

for (const file of files) {
  const filePath = join(suitesDir, file);
  let content = readFileSync(filePath, 'utf8');
  let modified = false;

  // Find all lines with await import(pathToFileURL(join(...))) and fix them
  // Need to find the pattern and add .href) before the final ;
  
  // First pass - find lines that are broken
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line has the problematic pattern
    if (line.includes('await import(pathToFileURL(join(') && !line.includes('.href)')) {
      // Fix it - the line should end with ; or })
      // Find the position where we should insert .href
      const importMatch = line.match(/await import\(pathToFileURL\(join\(.*?\)\);?$/);
      if (importMatch) {
        // Replace the last ) before ; or }) with ).href
        let fixed = line.replace(/\)\);?$/, ').href);');
        lines[i] = fixed;
        modified = true;
        console.log(`Fixed line ${i + 1} in ${file}`);
      }
    }
  }

  if (modified) {
    const newContent = lines.join('\n');
    writeFileSync(filePath, newContent, 'utf8');
    console.log(`✓ Fixed ${file}`);
  }
}
