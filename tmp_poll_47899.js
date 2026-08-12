const fs = require('fs');
function env(name){ const l = fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>x.startsWith(name+'=')); return l ? l.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'') : ''; }
const origin = new URL(env('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
const apiKey = env('GLW_N8N_API_KEY');
const execId = '47899';
async function getExecution(){
  const r = await fetch(`${origin}/api/v1/executions/${execId}?includeData=true`, { headers:{'X-N8N-API-KEY':apiKey,'Accept':'application/json'} });
  if(!r.ok) throw new Error('status '+r.status);
  return r.json();
}
(async()=>{
  let final = null;
  for(let i=0;i<120;i++){
    const ex = await getExecution();
    if(i===0 || i%4===0) console.log(`poll=${i};status=${ex.status};started=${ex.startedAt};stopped=${ex.stoppedAt||''}`);
    if(ex.status==='success' || ex.status==='error' || ex.finished===true){ final = ex; break; }
    await new Promise(r=>setTimeout(r,5000));
  }
  if(!final) final = await getExecution();
  const rd = final?.data?.resultData?.runData || {};
  const cb = rd['Send GLW Completion Callback']?.[0] || null;
  const item = cb?.data?.main?.[0]?.[0] || null;
  const wpJson = item?.json?.job?.result || null;
  const out = {
    executionId: final.id,
    status: final.status,
    startedAt: final.startedAt,
    stoppedAt: final.stoppedAt,
    lastNodeExecuted: final?.data?.resultData?.lastNodeExecuted || null,
    callbackNodeStatus: cb?.error ? 'FAILED' : (cb ? 'SUCCESS' : 'MISSING'),
    callbackNodeError: cb?.error || null,
    callbackPayloadJob: item?.json?.job || null,
    wordpress: wpJson ? { url: wpJson.wordpressUrl, pageId: wpJson.wordpressPageId, postId: wpJson.wordpressPostId } : null,
  };
  fs.writeFileSync('tmp_execution_47899_result.json', JSON.stringify(out,null,2));
  console.log('wrote=tmp_execution_47899_result.json');
  console.log(JSON.stringify({finalStatus:out.status, callbackNodeStatus:out.callbackNodeStatus, wpPageId:out.wordpress?.pageId || null}));
})();
