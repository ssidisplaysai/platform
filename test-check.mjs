import { readFileSync } from 'fs';

const content = readFileSync('tools/genesis/genesis.mjs', 'utf8');
const lines = content.split('\n');

const hasTest = lines.some(l => l.includes('if (command === "test")'));
const hasImport = lines.some(l => l.includes('import { runTests }'));
const hasHelpText = lines.some(l => l.includes('Run automated test suite'));

console.log('File analysis:');
console.log('✓ Has test handler:', hasTest);
console.log('✓ Has import:', hasImport);
console.log('✓ Has help text:', hasHelpText);
console.log('✓ Total lines:', lines.length);

// Find the lines
const testLine = lines.findIndex(l => l.includes('if (command === "test")'));
const importLine = lines.findIndex(l => l.includes('import { runTests }'));
const helpLine = lines.findIndex(l => l.includes('Run automated test suite'));

console.log('\nLine locations:');
console.log(`Import at line ${importLine + 1}`);
console.log(`Test handler at line ${testLine + 1}`);
console.log(`Help text at line ${helpLine + 1}`);

// Show the actual content
console.log('\nImport line:', lines[importLine]);
console.log('Test handler lines:');
console.log(lines[testLine]);
console.log(lines[testLine + 1]);
console.log(lines[testLine + 2]);
