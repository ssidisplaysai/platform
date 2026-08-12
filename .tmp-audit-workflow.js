const fs = require('fs');
const path = './tmp_workflow_before_patch.json';
const wf = JSON.parse(fs.readFileSync(path,'utf8'));
const targets = [
  'Prepare Hierarchy Fields',
  'Find Product Parent',
  'Prepare Product Parent',
  'Find State Parent',
  'Prepare State Parent',
  'State Parent Exists?',
  'Validate Parent Before Publish',
  'Create a post'
];
const nodes = wf.nodes || [];
const map = new Map(nodes.map(n=>[n.name,n]));
console.log('WORKFLOW:', wf.id, wf.name);
console.log('\nTARGET NODES:');
for (const name of targets) {
  const n = map.get(name);
  if (!n) { console.log('-', name, 'MISSING'); continue; }
  console.log('-', name, '| type:', n.type, '| id:', n.id);
}
console.log('\nWORDPRESS NODES:');
for (const n of nodes) {
  if ((n.type||'').toLowerCase().includes('wordpress')) {
    const op = n.parameters?.operation || n.parameters?.resource || n.parameters?.requestMethod || null;
    console.log('-', n.name, '| type:', n.type, '| op:', op);
  }
}
console.log('\nCONNECTIONS (outgoing):');
const con = wf.connections || {};
for (const name of targets) {
  const c = con[name];
  if (!c || !c.main) { console.log('-', name, '-> (none)'); continue; }
  const outs = c.main.map((branch,i)=>`branch${i}:${(branch||[]).map(x=>x.node).join(',')}`);
  console.log('-', name, '->', outs.join(' | '));
}

function brief(val){
  const txt = JSON.stringify(val);
  return txt.length>600 ? txt.slice(0,600)+'...[truncated]' : txt;
}
for (const name of targets) {
  const n = map.get(name);
  if (!n) continue;
  console.log(`\nPARAMS: ${name}`);
  console.log(brief(n.parameters));
}