const fs=require('fs');
function env(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const origin=new URL(env('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=env('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const listRes=await fetch(`${origin}/api/v1/workflows?limit=250`,{headers});
 if(!listRes.ok) throw new Error('list failed '+listRes.status+' '+await listRes.text());
 const listJson=await listRes.json();
 const workflows=Array.isArray(listJson.data)?listJson.data:(Array.isArray(listJson)?listJson:[]);
 const detail=[];
 for(const wf of workflows){
   const id=String(wf.id||''); if(!id) continue;
   const res=await fetch(`${origin}/api/v1/workflows/${id}`,{headers});
   if(!res.ok) continue;
   const full=await res.json();
   const webhookPaths=(full.nodes||[])
     .filter((n)=>String(n.name||'').toLowerCase().includes('webhook') || String(n.type||'').includes('webhook'))
     .map((n)=>({name:n.name,path:n.parameters?.path||null,httpMethod:n.parameters?.httpMethod||n.parameters?.method||null}));
   const hasGlwPath=webhookPaths.some((w)=>w.path==='glw-page-generation');
   detail.push({id,name:full.name,active:!!full.active,hasGlwPath,webhookPaths});
 }
 const glw=detail.filter((d)=>d.hasGlwPath);
 const out={totalWorkflows:detail.length,glwPathWorkflows:glw,activeGlwPathWorkflows:glw.filter((d)=>d.active)};
 fs.writeFileSync('.tmp-n8n-workflow-freeze-verification.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
})();