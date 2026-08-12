const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('.tmp-live-workflow.json', 'utf8'));
const nodes = wf.nodes || [];
const nodeByName = new Map(nodes.map((n) => [n.name, n]));

const pathNodes = [
  'Prepare Hierarchy Fields',
  'Find Product Parent',
  'Prepare Product Parent',
  'Find State Parent',
  'Prepare State Parent',
  'State Parent Exists?',
  'Validate Parent Before Publish',
  'Create a post',
  'Create State Parent',
  'Validation Passed?',
  'Send GLW Completion Callback',
];

console.log('WORKFLOW', wf.id, wf.name, 'nodes=', nodes.length);
console.log('\nTARGET NODES');
for (const name of pathNodes) {
  const n = nodeByName.get(name);
  console.log('-', name, n ? `type=${n.type}` : 'MISSING');
}

console.log('\nCONNECTIONS (target path outgoing)');
const con = wf.connections || {};
for (const name of pathNodes) {
  const c = con[name];
  if (!c || !c.main) continue;
  const lines = c.main.map((branch, i) => `branch${i}: ${(branch || []).map((x) => x.node).join(', ')}`);
  console.log('-', name, '=>', lines.join(' | '));
}

console.log('\nWP PAGES OPERATIONS');
for (const n of nodes) {
  const p = n.parameters || {};
  const url = p.url;
  if (typeof url === 'string' && url.includes('/wp-json/wp/v2/pages')) {
    console.log('\n- ' + n.name);
    console.log('  method:', p.method || '(default GET)');
    console.log('  url:', url);
    const bp = p.bodyParameters?.parameters;
    if (Array.isArray(bp)) {
      console.log('  body:', bp.map((x) => `${x.name}=${x.value}`).join(' | '));
    }
  }
}

console.log('\nNODES REFERENCING CREATE A POST');
for (const n of nodes) {
  const txt = JSON.stringify(n.parameters || {});
  if (n.name !== 'Create a post' && txt.includes("$('Create a post')")) {
    console.log('-', n.name);
  }
}

const printNode = (name) => {
  const n = nodeByName.get(name);
  if (!n) return;
  console.log(`\nPARAMETERS: ${name}`);
  console.log(JSON.stringify(n.parameters, null, 2));
};

printNode('Prepare Hierarchy Fields');
printNode('Prepare State Parent');
printNode('Create a post');
printNode('Send GLW Completion Callback');
