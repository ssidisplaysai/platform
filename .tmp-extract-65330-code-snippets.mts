import fs from "node:fs";

const data = JSON.parse(fs.readFileSync('.tmp-65330-node-code.json','utf8'));

function extractLines(name, code, patterns) {
  const lines = String(code || '').split('\n');
  const hits = [];
  lines.forEach((line, idx) => {
    if (patterns.some((p) => line.includes(p))) {
      const start = Math.max(0, idx - 2);
      const end = Math.min(lines.length - 1, idx + 2);
      for (let i = start; i <= end; i++) {
        hits.push({ line: i + 1, text: lines[i] });
      }
      hits.push({ line: -1, text: '---' });
    }
  });
  return { name, hits };
}

const prepare = extractLines('Prepare Hierarchy Fields', data.prepareHierarchyCode, [
  'const pageTypeValue',
  'const focusKeywordValue',
  'const stateSlug =',
  'const citySlug =',
  'if (isGlw && !citySlug)',
  'const desiredHierarchicalSlug =',
  'product_slug: finalProductSlug',
  'state_slug: finalStateSlug',
  'city_slug: finalCitySlug',
]);

const getRows = extractLines('Get row(s) in sheet', data.getRowsCode, [
  'const citySlug =',
  'const hierarchicalSlug =',
  'const slugParts =',
  'slug: slugParts.join',
  'city,',
]);

const out = { prepare, getRows };
fs.writeFileSync('.tmp-65330-node-code-snippets.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));