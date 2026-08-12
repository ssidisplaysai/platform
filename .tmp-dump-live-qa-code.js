const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const wf=await (await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers})).json();
  const node=(wf.nodes||[]).find(n=>n.name==='Build Pre-Publish QA Result');
  const jsCode=node?.parameters?.jsCode||'';
  const idx=jsCode.indexOf('function countInternalLinks');
  const snippet=idx>=0?jsCode.slice(Math.max(0,idx-220), Math.min(jsCode.length, idx+780)):jsCode.slice(0,800);
  fs.writeFileSync('.tmp-live-qa-jsCode.txt', jsCode);
  console.log(snippet);
})();