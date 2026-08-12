const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const listRes=await fetch(`${origin}/api/v1/executions?limit=40&workflowId=bIDXxyWnY22G8zJC`,{headers});
  const list=await listRes.json();
  const webhooks=(list.data||[]).filter(x=>x.mode==='webhook').slice(0,20).map(x=>({id:String(x.id),status:x.status,startedAt:x.startedAt,stoppedAt:x.stoppedAt}));
  fs.writeFileSync('.tmp-webhooks-latest-after-fix.json', JSON.stringify(webhooks,null,2));
  console.log(JSON.stringify(webhooks,null,2));
})();