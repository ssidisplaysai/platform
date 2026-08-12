const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const wf=await (await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers})).json();
  const counts={};
  for(const n of (wf.nodes||[])){counts[n.name]=(counts[n.name]||0)+1;}
  const dups=Object.entries(counts).filter(([,c])=>c>1);
  console.log(JSON.stringify({totalNodes:(wf.nodes||[]).length,duplicateNames:dups},null,2));
})();