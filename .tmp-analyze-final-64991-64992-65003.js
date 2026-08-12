const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const ids=['64991','64992','65003'];
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=readEnv('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const out=[];
 for(const id of ids){
  const ex=await (await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers})).json();
  const rd=ex?.data?.resultData?.runData||{};
  const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
  const qa=first('Build Pre-Publish QA Result')||{};
  out.push({
    executionId:id,
    city:first('Code in JavaScript')?.city || null,
    qaGatePassed:qa.qa_gate_passed,
    qaCallbackStatus:qa.qa_callback_status,
    qaDisposition:qa.qa_disposition,
    checks:qa.qa_checks,
    failureReasons:qa.qa_failure_reasons,
  });
 }
 console.log(JSON.stringify(out,null,2));
})();