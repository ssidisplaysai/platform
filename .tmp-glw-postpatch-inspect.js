const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey=readEnv('GLW_N8N_API_KEY');
  const headers={ 'X-N8N-API-KEY': apiKey, Accept:'application/json' };
  const wf=await (await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers})).json();
  const nodes=wf.nodes||[];
  const norm=nodes.find((n)=>n.name==='Normalize Published City Page');
  const getRows=nodes.find((n)=>n.name==='Get row(s) in sheet');
  const conn=wf.connections||{};
  console.log(JSON.stringify({
    getRowsTail:String(getRows?.parameters?.jsCode||'').slice(-180),
    normalizeHead:String(norm?.parameters?.jsCode||'').slice(0,600),
    scheduleConn:conn['Schedule Trigger']?.main || null,
    manualConn:conn['When clicking ‘Execute workflow’']?.main || null,
  },null,2));
})();