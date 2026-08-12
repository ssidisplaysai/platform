const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('.tmp-live-workflow.json','utf8'));
const con = wf.connections || {};
for (const name of ['Create State Parent','Prepare Created State Parent','Merge State Parent Paths','Validate Parent Before Publish','Validation Passed?']) {
  const c = con[name];
  if (!c || !c.main) { console.log(name+': (none)'); continue; }
  const outs = c.main.map((b,i)=>`branch${i}: ${(b||[]).map(x=>x.node).join(', ')}`);
  console.log(name+': '+outs.join(' | '));
}
const pcs = (wf.nodes||[]).find(n=>n.name==='Prepare Created State Parent');
const msp = (wf.nodes||[]).find(n=>n.name==='Merge State Parent Paths');
if (pcs) {
  console.log('\nPrepare Created State Parent type='+pcs.type);
  console.log(JSON.stringify(pcs.parameters,null,2));
}
if (msp) {
  console.log('\nMerge State Parent Paths type='+msp.type);
  console.log(JSON.stringify(msp.parameters,null,2));
}