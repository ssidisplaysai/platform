import { generate } from '../compiler/CodeGenerationEngine.mjs';

console.log('\n🔄 Regenerating all 7 entities...\n');
const result = await generate();
const successful = result.results.filter(r => r.success);
const failed = result.results.filter(r => !r.success);
console.log(`\n✓ Generated ${successful.length} entities`);
if (failed.length > 0) {
  console.log(`✗ Failed: ${failed.map(f => f.entity).join(', ')}`);
  process.exit(1);
}
