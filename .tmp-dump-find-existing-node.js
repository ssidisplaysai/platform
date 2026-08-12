const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const wfId='bIDXxyWnY22G8zJC';
  const wfRes=await fetch(`${origin}/api/v1/workflows/${wfId}`,{headers});
  const wf=await wfRes.json();
  const node=(wf.nodes||[]).find(n=>n.name==='Find Existing City Page');
  const out={
    workflowId:wfId,
    nodeName:'Find Existing City Page',
    nodeType:node?.type,
    parameters:node?.parameters||null,
    credentials:Object.keys(node?.credentials||{})
  };
  fs.writeFileSync('.tmp-find-existing-city-node.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();