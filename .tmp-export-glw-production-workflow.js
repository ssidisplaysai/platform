const fs=require('fs');
const path=require('path');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey=readEnv('GLW_N8N_API_KEY');
  const headers={ 'X-N8N-API-KEY': apiKey, Accept:'application/json' };
  const wfRes=await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers});
  if(!wfRes.ok) throw new Error('fetch failed '+wfRes.status+' '+await wfRes.text());
  const wf=await wfRes.json();

  const outDir=path.join('backups','n8n');
  fs.mkdirSync(outDir,{recursive:true});
  const outPath=path.join(outDir,'glw-page-engine-v1.0.json');
  fs.writeFileSync(outPath, JSON.stringify(wf,null,2));

  const content=fs.readFileSync(outPath,'utf8');
  const hasPlainSecret=/"(password|token|api[_-]?key|secret)"\s*:\s*"[^\"]+"/i.test(content);

  console.log(JSON.stringify({saved:outPath,bytes:content.length,containsCredentialNode:Boolean((wf.nodes||[]).find((n)=>n.credentials)),potentialSecretPattern:hasPlainSecret},null,2));
})();