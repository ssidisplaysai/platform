const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const res=await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers});
  const wf=await res.json();
  const node=(wf.nodes||[]).find(n=>n.name==='Append GLW QA Sheet Row');
  console.log(JSON.stringify({exists:!!node,type:node?.type,parameters:node?.parameters},null,2));
})();