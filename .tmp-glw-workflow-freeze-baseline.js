const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}

(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const productionName='Master SEO Page Engine v1.0 - PRODUCTION';
  const developmentCopyName='Master SEO Page Engine v1 - DEVELOPMENT (inactive baseline copy)';

  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey=readEnv('GLW_N8N_API_KEY');
  const headers={ 'X-N8N-API-KEY': apiKey, Accept:'application/json' };

  const current=await (await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers})).json();
  const nodes=Array.isArray(current.nodes)?current.nodes:[];
  const connections=current.connections||{};
  const settings=current.settings||{};
  const wasName=current.name;

  if(wasName!==productionName){
    const renameRes=await fetch(`${origin}/api/v1/workflows/${workflowId}`,{
      method:'PUT',
      headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({name:productionName,nodes,connections,settings}),
    });
    if(!renameRes.ok) throw new Error('rename failed '+renameRes.status+' '+await renameRes.text());
  }

  const listRes=await fetch(`${origin}/api/v1/workflows?limit=250`,{headers});
  if(!listRes.ok) throw new Error('list failed '+listRes.status+' '+await listRes.text());
  const listJson=await listRes.json();
  const workflows=Array.isArray(listJson.data)?listJson.data:(Array.isArray(listJson)?listJson:[]);

  let developmentCopy=workflows.find((w)=>String(w.name||'')===developmentCopyName) || null;
  if(!developmentCopy){
    const createRes=await fetch(`${origin}/api/v1/workflows`,{
      method:'POST',
      headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({name:developmentCopyName,nodes,connections,settings}),
    });
    const createText=await createRes.text();
    if(!createRes.ok) throw new Error('create copy failed '+createRes.status+' '+createText);
    developmentCopy=JSON.parse(createText);
  }

  const refreshed=await (await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers})).json();

  const summary={
    productionWorkflow:{
      id:workflowId,
      name:refreshed.name,
      active:refreshed.active ?? null,
      webhookPath:(refreshed.nodes||[]).find((n)=>n.name==='GLW Page Webhook')?.parameters?.path ?? null,
    },
    developmentWorkflow:{
      id:String(developmentCopy?.id || developmentCopy?.data?.id || ''),
      name:developmentCopy?.name || developmentCopy?.data?.name || developmentCopyName,
      active:developmentCopy?.active ?? developmentCopy?.data?.active ?? false,
    },
    renamedFrom:wasName,
  };

  fs.writeFileSync('.tmp-glw-workflow-freeze-baseline.json',JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
})();