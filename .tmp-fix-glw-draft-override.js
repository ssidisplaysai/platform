const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey=readEnv('GLW_N8N_API_KEY');
  const headers={ 'X-N8N-API-KEY': apiKey, Accept:'application/json' };

  const wf=await (await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers})).json();
  const nodes=Array.isArray(wf.nodes)?wf.nodes:[];
  const getRows=nodes.find((n)=>n.name==='Get row(s) in sheet');
  if(!getRows) throw new Error('Get row(s) in sheet node not found');

  const beforeRaw=String(getRows?.parameters?.jsCode||'');
  const before=beforeRaw.replace(/\r\n/g,'\n');
  const oldBlock="if (normalized === 'draft') {\n      return isGlw ? 'publish' : 'draft';\n    }";
  const newBlock="if (normalized === 'draft') {\n      return 'draft';\n    }";
  const found=before.includes(oldBlock);
  const after=found ? before.split(oldBlock).join(newBlock) : before;

  if(!found || after===before){
    throw new Error('Target block not found after newline normalization');
  }

  getRows.parameters = getRows.parameters || {};
  getRows.parameters.jsCode = after;

  const putBody={name:wf.name,nodes,connections:wf.connections||{},settings:wf.settings||{}};
  const putRes=await fetch(`${origin}/api/v1/workflows/${workflowId}`,{
    method:'PUT',
    headers:{...headers,'Content-Type':'application/json'},
    body:JSON.stringify(putBody),
  });
  const putText=await putRes.text();
  if(!putRes.ok) throw new Error('update failed '+putRes.status+' '+putText);

  console.log(JSON.stringify({workflowId,workflowName:wf.name,changed:true},null,2));
})();