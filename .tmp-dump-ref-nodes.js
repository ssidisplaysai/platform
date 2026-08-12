const fs = require('fs');
const wf = JSON.parse(fs.readFileSync('.tmp-live-workflow.json','utf8'));
const names = ['Update row in sheet','Update Yoast SEO','Prepare Image Fields','Set Featured Image','Insert Image Into Page','Send GLW Completion Callback'];
for (const name of names) {
  const n = (wf.nodes||[]).find(x=>x.name===name);
  console.log('\n=== '+name+' ===');
  if (!n) { console.log('MISSING'); continue; }
  console.log('type:', n.type);
  console.log(JSON.stringify(n.parameters || {}, null, 2));
}