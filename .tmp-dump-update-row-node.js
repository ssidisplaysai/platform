const fs=require('fs');
const wf=JSON.parse(fs.readFileSync('.tmp-live-workflow.json','utf8'));
const node=(wf.nodes||[]).find(n=>n.name==='Update row in sheet');
fs.writeFileSync('.tmp-update-row-node-after-qa.json',JSON.stringify(node,null,2));
console.log(JSON.stringify(node?.parameters||{},null,2));