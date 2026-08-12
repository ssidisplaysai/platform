const fs = require('fs');
function env(name){ const l = fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>x.startsWith(name+'=')); return l ? l.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'') : ''; }
const origin = new URL(env('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
const apiKey = env('GLW_N8N_API_KEY');
const execId = '47833';
async function getExecution(){
  const r = await fetch(`${origin}/api/v1/executions/${execId}?includeData=true`, { headers:{'X-N8N-API-KEY':apiKey,'Accept':'application/json'} });
  if(!r.ok) throw new Error('status '+r.status);
  return r.json();
}
(async()=>{
  let lastStatus = null;
  let final = null;
  for(let i=0;i<90;i++){
    const ex = await getExecution();
    if(ex.status !== lastStatus){
      console.log(`poll=${i};status=${ex.status};started=${ex.startedAt};stopped=${ex.stoppedAt||''}`);
      lastStatus = ex.status;
    }
    if(ex.status === 'success' || ex.status === 'error' || ex.finished === true){ final = ex; break; }
    await new Promise(r=>setTimeout(r,5000));
  }
  if(!final) final = await getExecution();
  const rd = final?.data?.resultData?.runData || {};
  const cbRuns = rd['Send GLW Completion Callback'] || [];
  const cb = cbRuns[0] || null;
  const wpRuns = rd['Set Featured Image'] || [];
  const wp = wpRuns[0] || null;
  const wpJson = wp?.data?.main?.[0]?.[0]?.json || null;
  const out = {
    executionId: final.id,
    status: final.status,
    startedAt: final.startedAt,
    stoppedAt: final.stoppedAt,
    durationMs: final.startedAt && final.stoppedAt ? (Date.parse(final.stoppedAt)-Date.parse(final.startedAt)) : null,
    callbackNode: {
      status: cb?.error ? 'FAILED' : (cb ? 'SUCCESS' : 'MISSING'),
      executionTimeMs: cb?.executionTime ?? null,
      error: cb?.error?.message || null,
      httpCode: cb?.error?.httpCode || null,
      responseCode: cb?.data?.main?.[0]?.[0]?.json?.statusCode ?? cb?.data?.main?.[0]?.[0]?.statusCode ?? null,
      responseBody: cb?.data?.main?.[0]?.[0]?.json ?? null,
    },
    wordpress: {
      pageId: wpJson?.id ?? null,
      url: wpJson?.link ?? null,
      featuredMediaId: wpJson?.featured_media ?? null,
    },
    lastNodeExecuted: final?.data?.resultData?.lastNodeExecuted || null,
    error: final?.data?.resultData?.error || null,
  };
  fs.writeFileSync('tmp_execution_47833_result.json', JSON.stringify(out,null,2));
  console.log('wrote=tmp_execution_47833_result.json');
  console.log(JSON.stringify({finalStatus:out.status, callbackStatus:out.callbackNode.status, responseCode:out.callbackNode.responseCode, lastNode:out.lastNodeExecuted}));
})();
