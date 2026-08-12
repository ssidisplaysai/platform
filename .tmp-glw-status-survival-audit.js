const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
function getStatusParam(node){
  const params=node?.parameters||{};
  const pairs=params.bodyParameters?.parameters;
  if(!Array.isArray(pairs)) return null;
  const match=pairs.find((p)=>String(p?.name||'').toLowerCase()==='status');
  return match ? String(match.value ?? '') : null;
}
(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey=readEnv('GLW_N8N_API_KEY');
  const headers={ 'X-N8N-API-KEY': apiKey, Accept:'application/json' };
  const wf=await (await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers})).json();
  const names=['Create a post','Update Existing City Page','Update Yoast SEO','Insert Image Into Page','Set Featured Image'];
  const rows=[];
  for(const name of names){
    const node=(wf.nodes||[]).find((n)=>n.name===name);
    rows.push({name, type:node?.type||null, hasStatus:getStatusParam(node)!==null, statusValue:getStatusParam(node)});
  }
  const allWithStatus=(wf.nodes||[])
    .map((node)=>({name:node.name,type:node.type,statusValue:getStatusParam(node)}))
    .filter((entry)=>entry.statusValue!==null);
  const output={workflowId,workflowName:wf.name,targetNodes:rows,nodesSendingStatus:allWithStatus};
  fs.writeFileSync('.tmp-glw-status-survival-audit.json',JSON.stringify(output,null,2));
  console.log(JSON.stringify(output,null,2));
})();