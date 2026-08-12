const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const ids=['64962','64963','64964'];
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const out=[];
  for(const id of ids){
    const ex=await (await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers})).json();
    const rd=ex?.data?.resultData?.runData||{};
    const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
    out.push({
      id,
      status: ex.status,
      lastNode: ex?.data?.resultData?.lastNodeExecuted||null,
      city: first('Code in JavaScript')?.city ?? null,
      jobId: first('Get row(s) in sheet')?.job_id ?? null,
      qaPassed: first('Build Pre-Publish QA Result')?.qa_gate_passed ?? null,
      qaCb: first('Build Pre-Publish QA Result')?.qa_callback_status ?? null,
      cbError: ex?.data?.resultData?.error?.description ?? null,
    });
  }
  console.log(JSON.stringify(out,null,2));
})();