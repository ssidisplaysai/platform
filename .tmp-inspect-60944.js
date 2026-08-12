const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=readEnv('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const id='60944';
 const res=await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});
 const ex=await res.json();
 const err=ex?.data?.resultData?.error;
 console.log(JSON.stringify({id,status:ex.status,lastNode:ex?.data?.resultData?.lastNodeExecuted,error:err?{message:err.message,description:err.description,node:err.node?.name}:null},null,2));
})();