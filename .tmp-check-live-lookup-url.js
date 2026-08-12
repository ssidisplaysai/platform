const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const wfId='bIDXxyWnY22G8zJC';
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const r=await fetch(`${origin}/api/v1/workflows/${wfId}`,{headers});
  const wf=await r.json();
  const node=(wf.nodes||[]).find(n=>n.name==='Find Existing City Page');
  const out={url:node?.parameters?.url||null,auth:node?.parameters?.authentication||null,credType:node?.parameters?.nodeCredentialType||null};
  fs.writeFileSync('.tmp-find-existing-live-url-check.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();