const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=readEnv('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const id='60969';
 const ex=await (await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers})).json();
 const err=ex?.data?.resultData?.error||null;
 const rd=ex?.data?.resultData?.runData||{};
 const cbNode=rd['Send GLW Completion Callback']?.[0]||null;
 const qa=rd['Build Pre-Publish QA Result']?.[0]?.data?.main?.[0]?.[0]?.json||null;
 const row=rd['Get row(s) in sheet']?.[0]?.data?.main?.[0]?.[0]?.json||null;
 fs.writeFileSync('.tmp-exec-60969.json',JSON.stringify(ex,null,2));
 console.log(JSON.stringify({
   id,
   status: ex.status,
   lastNode: ex?.data?.resultData?.lastNodeExecuted||null,
   error: err?{message:err.message,description:err.description,node:err.node?.name}:null,
   qaJobId: qa?.job_id,
   rowJobId: row?.job_id,
   cbHasData: !!cbNode,
   cbKeys: cbNode ? Object.keys(cbNode) : null,
   cbJson: cbNode?.data?.main?.[0]?.[0]?.json ?? null,
   cbErrorData: cbNode?.error ?? null
 },null,2));
})();