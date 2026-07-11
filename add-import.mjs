import { readFileSync, writeFileSync } from 'fs';

const filePath = 'tools/genesis/genesis.mjs';
let content = readFileSync(filePath, 'utf8');

// Add import for runTests after other imports
const searchText = 'import { runPromoteCommand } from "./commands/promote.mjs";';
const replaceText = `import { runPromoteCommand } from "./commands/promote.mjs";
import { runTests } from "./tests/TestRunner.mjs";`;

if (content.includes(searchText)) {
  content = content.replace(searchText, replaceText);
  writeFileSync(filePath, content, 'utf8');
  console.log('✓ runTests import added');
} else {
  console.log('✗ Could not find import section');
}
