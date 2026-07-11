import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';

const suitesDir = 'tools/genesis/tests/suites';
const files = readdirSync(suitesDir).filter(f => f.endsWith('.mjs'));

for (const file of files) {
  const filePath = join(suitesDir, file);
  let content = readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if file already has pathToFileURL imported
  if (!content.includes('pathToFileURL')) {
    // Add pathToFileURL to imports
    content = content.replace(
      "import { fileURLToPath } from 'url';",
      "import { fileURLToPath, pathToFileURL } from 'url';"
    );
    if (!content.includes('pathToFileURL')) {
      // If not found, add it after fileURLToPath import if that doesn't exist either
      if (!content.includes("from 'url'")) {
        content = content.replace(
          "import { dirname, join } from 'path';",
          "import { fileURLToPath, pathToFileURL } from 'url';\nimport { dirname, join } from 'path';"
        );
      }
    }
    modified = true;
  }

  // Replace all instances of `await import(join(...))` with `await import(pathToFileURL(join(...)).href)`
  const oldPattern = /await import\(join\(/g;
  const newPattern = 'await import(pathToFileURL(join(';
  
  if (oldPattern.test(content)) {
    // This is more complex - we need to find matching parentheses
    let newContent = '';
    let i = 0;
    while (i < content.length) {
      if (content.substr(i, 20) === 'await import(join(') {
        newContent += 'await import(pathToFileURL(join(';
        i += 18;
        
        // Find the matching closing parenthesis
        let parenCount = 1;
        let endIdx = i;
        while (endIdx < content.length && parenCount > 0) {
          if (content[endIdx] === '(') parenCount++;
          if (content[endIdx] === ')') parenCount--;
          if (parenCount > 0) newContent += content[endIdx];
          endIdx++;
        }
        // Add )).href instead of just )
        newContent += ').href';
        i = endIdx;
        modified = true;
      } else {
        newContent += content[i];
        i++;
      }
    }
    
    if (modified) {
      content = newContent;
    }
  }

  if (modified) {
    writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Fixed ${file}`);
  }
}

console.log('All test suites updated');
