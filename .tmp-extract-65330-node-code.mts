import fs from "node:fs";

const data = JSON.parse(fs.readFileSync('.tmp-n8n-execution-65330.json','utf8'));
const nodes = data?.workflowData?.nodes ?? [];

function nodeByName(name) {
  return nodes.find((n) => n?.name === name) ?? null;
}

const prepare = nodeByName('Prepare Hierarchy Fields');
const getRows = nodeByName('Get row(s) in sheet');

const out = {
  prepareHierarchyCode: prepare?.parameters?.jsCode ?? null,
  getRowsCode: getRows?.parameters?.jsCode ?? null,
};

fs.writeFileSync('.tmp-65330-node-code.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  prepareHierarchyCodeLength: out.prepareHierarchyCode?.length ?? 0,
  getRowsCodeLength: out.getRowsCode?.length ?? 0,
  file: '.tmp-65330-node-code.json'
}, null, 2));