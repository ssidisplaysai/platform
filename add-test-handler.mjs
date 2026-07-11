import { readFileSync, writeFileSync } from 'fs';

const filePath = 'tools/genesis/genesis.mjs';
let content = readFileSync(filePath, 'utf8');

// Add test handler after promote block
const searchText = '  if (command === "promote") {\r\n    const [entityName] = args;\r\n    await runPromoteCommand(entityName);\r\n    return;\r\n  }\r\n\r\n  if (command === "scaffold") {';

const replaceText = `  if (command === "promote") {
    const [entityName] = args;
    await runPromoteCommand(entityName);
    return;
  }

  if (command === "test") {
    await runTests();
    return;
  }

  if (command === "scaffold") {`;

if (content.includes(searchText)) {
  content = content.replace(searchText, replaceText);
  writeFileSync(filePath, content, 'utf8');
  console.log('✓ Test handler added');
} else {
  console.log('✗ Search text not found');
  console.log('Trying alternative approach...');
  
  // Alternative: find promote and insert after it
  const lines = content.split('\n');
  let promoteEndIdx = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('if (command === "promote")')) {
      // Find the closing brace of this if block
      let braceCount = 0;
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes('{')) braceCount++;
        if (lines[j].includes('}')) braceCount--;
        if (braceCount === 0 && j > i) {
          promoteEndIdx = j;
          break;
        }
      }
      break;
    }
  }
  
  if (promoteEndIdx !== -1) {
    const testHandler = '  if (command === "test") {\n    await runTests();\n    return;\n  }\n';
    lines.splice(promoteEndIdx + 2, 0, testHandler);
    writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log('✓ Test handler added via alternative method');
  } else {
    console.log('✗ Could not find insertion point');
  }
}
