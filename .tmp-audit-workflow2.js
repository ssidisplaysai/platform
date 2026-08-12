const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('./tmp_workflow_before_patch.json','utf8'));
const nodes = wf.nodes || [];

console.log('NODES touching wp-json/wp/v2/pages:');
for (const n of nodes) {
  const p = n.parameters || {};
  const url = p.url || '';
  if (typeof url === 'string' && url.includes('/wp-json/wp/v2/pages')) {
    console.log('\n- '+n.name);
    console.log('  method:', p.method || '(default)');
    console.log('  url:', url);
    if (p.bodyParameters?.parameters) {
      console.log('  bodyFields:', p.bodyParameters.parameters.map(x=>x.name).join(', '));
    }
  }
}

console.log('\nNODES referencing "Create a post" in expressions:');
const textify = (o)=>JSON.stringify(o);
for (const n of nodes) {
  const txt = textify(n.parameters||{});
  if (txt.includes("$('Create a post')") || txt.includes('Create a post')) {
    if (n.name !== 'Create a post') console.log('-', n.name);
  }
}

const phf = nodes.find(n=>n.name==='Prepare Hierarchy Fields');
if (phf) {
  console.log('\nPrepare Hierarchy Fields code:\n');
  console.log(phf.parameters.jsCode);
}

const cps = nodes.find(n=>n.name==='Create a post');
if (cps) {
  console.log('\nCreate a post full parameters:\n');
  console.log(JSON.stringify(cps.parameters, null, 2));
}