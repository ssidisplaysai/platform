const fs=require('fs');
const wf=JSON.parse(fs.readFileSync('.tmp-live-workflow.json','utf8'));
const getRow=(wf.nodes||[]).find(n=>n.name==='Get row(s) in sheet');
fs.writeFileSync('.tmp-get-row-node-after-qa.json',JSON.stringify(getRow,null,2));
console.log(JSON.stringify(getRow?.parameters||{},null,2));