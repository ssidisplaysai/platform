const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const wf=await (await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers})).json();
  const node=(wf.nodes||[]).find(n=>n.name==='Code in JavaScript');
  const jsCode=node?.parameters?.jsCode||'';
  fs.writeFileSync('.tmp-live-code-in-javascript.js', jsCode);
  console.log(JSON.stringify({found:!!node, type:node?.type, len:jsCode.length, head:jsCode.slice(0,1200)},null,2));
})();