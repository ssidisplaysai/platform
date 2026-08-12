const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const origin = new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey = readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':apiKey,Accept:'application/json'};
  const res=await fetch(`${origin}/api/v1/executions?limit=60&workflowId=bIDXxyWnY22G8zJC`,{headers});
  const j=await res.json();
  const hooks=(j.data||[]).filter(x=>x.mode==='webhook').slice(0,8).map(x=>({id:String(x.id),status:x.status,startedAt:x.startedAt,stoppedAt:x.stoppedAt}));
  fs.writeFileSync('.tmp-webhook-executions.json', JSON.stringify(hooks,null,2));
  console.log(JSON.stringify(hooks,null,2));
})();