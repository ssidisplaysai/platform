const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=readEnv('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const id='60809';
 const res=await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});
 const ex=await res.json();
 fs.writeFileSync('.tmp-exec-60809.json',JSON.stringify(ex,null,2));
 const rd=ex?.data?.resultData?.runData||{};
 const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
 const err=ex?.data?.resultData?.error||null;
 console.log(JSON.stringify({
  id,
  status:ex.status,
  lastNode:ex?.data?.resultData?.lastNodeExecuted||null,
  error:err?{message:err.message,description:err.description,node:err.node?.name}:null,
  qa:first('Build Pre-Publish QA Result'),
  sheet:first('Update row in sheet'),
  callback:first('Send GLW Completion Callback')
 },null,2));
})();