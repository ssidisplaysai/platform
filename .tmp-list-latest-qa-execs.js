const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const listRes=await fetch(`${origin}/api/v1/executions?limit=20&workflowId=bIDXxyWnY22G8zJC`,{headers});
  const list=await listRes.json();
  const out=[];
  for(const item of (list.data||[]).filter((entry)=>entry.mode==='webhook').slice(0,8)){
    const id=String(item.id);
    const res=await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});
    const ex=await res.json();
    const rd=ex?.data?.resultData?.runData||{};
    const body=rd['GLW Page Webhook']?.[0]?.data?.main?.[0]?.[0]?.json?.body||{};
    const qa=rd['Build Pre-Publish QA Result']?.[0]?.data?.main?.[0]?.[0]?.json||null;
    const cb=rd['Send GLW Completion Callback']?.[0]?.data?.main?.[0]?.[0]?.json||null;
    out.push({id,status:ex.status,city:body?.page?.city||null,jobId:body?.jobId||body?.job_id||body?.page?.targetSlug||null,qaPassed:qa?.qa_gate_passed??null,qaCallbackStatus:qa?.qa_callback_status??null,callbackStatus:cb?.status??null,lastNode:ex?.data?.resultData?.lastNodeExecuted||null});
  }
  fs.writeFileSync('.tmp-latest-qa-executions.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();