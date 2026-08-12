const fs = require('fs');
let t = fs.readFileSync('tmp_execution_47810.json','utf8'); if (t.charCodeAt(0)===0xFEFF) t=t.slice(1);
const raw = JSON.parse(t);
const rd = raw?.data?.resultData?.runData || {};
const nodes = new Map((raw?.workflowData?.nodes||[]).map(n=>[n.name,n]));
const events=[];
for (const [name,runs] of Object.entries(rd)) {
  if (!Array.isArray(runs)) continue;
  runs.forEach((run,i)=> events.push({node:name,id:nodes.get(name)?.id,type:nodes.get(name)?.type,start:run?.startTime||run?.startedAt||null,durMs:Number.isFinite(run?.executionTime)?run.executionTime:0,status:run?.error?'FAILED':'SUCCESS',err:run?.error?.message||null}));
}
events.sort((a,b)=>(a.start||0)-(b.start||0));
const fail=events.find(e=>e.status==='FAILED');
const out={
 execution:{id:raw.id,status:raw.status,startedAt:raw.startedAt,stoppedAt:raw.stoppedAt,durationMs:Date.parse(raw.stoppedAt)-Date.parse(raw.startedAt)},
 fail,
 lastNodeExecuted:raw?.data?.resultData?.lastNodeExecuted,
 error:raw?.data?.resultData?.error,
 callbackNode: (raw.workflowData.nodes||[]).find(n=>n.name==='Send GLW Completion Callback')
};
fs.writeFileSync('tmp_execution_47810_forensic.json', JSON.stringify(out,null,2));
console.log('wrote=tmp_execution_47810_forensic.json');
console.log(JSON.stringify({failedNode:fail?.node,failedErr:fail?.err,status:raw.status}));
