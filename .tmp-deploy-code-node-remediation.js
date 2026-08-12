const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey=readEnv('GLW_N8N_API_KEY');
  const headers={ 'X-N8N-API-KEY': apiKey, Accept:'application/json' };
  const jsCode=fs.readFileSync('.tmp-code-node-remediation.js','utf8');

  const wfRes=await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers});
  if(!wfRes.ok) throw new Error('fetch workflow failed '+wfRes.status);
  const wf=await wfRes.json();

  const nodes=Array.isArray(wf.nodes)?wf.nodes:[];
  const node=nodes.find((n)=>n.name==='Code in JavaScript');
  if(!node) throw new Error('Code in JavaScript node not found');
  node.parameters=node.parameters||{};
  node.parameters.jsCode=jsCode;

  const body={ name:wf.name, nodes, connections:wf.connections||{}, settings:wf.settings||{} };
  const put=await fetch(`${origin}/api/v1/workflows/${workflowId}`,{
    method:'PUT',
    headers:{...headers,'Content-Type':'application/json'},
    body: JSON.stringify(body),
  });
  const putText=await put.text();
  if(!put.ok) throw new Error('update workflow failed '+put.status+' '+putText);

  console.log(JSON.stringify({workflowId,updatedNode:'Code in JavaScript',jsCodeLength:jsCode.length},null,2));
})();