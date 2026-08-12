const fs = require('fs');
function env(name){ const l = fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>x.startsWith(name+'=')); return l ? l.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'') : ''; }
const origin = new URL(env('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
const apiKey = env('GLW_N8N_API_KEY');
(async()=>{
  const r = await fetch(`${origin}/api/v1/executions/47833?includeData=true`, { headers:{'X-N8N-API-KEY':apiKey,'Accept':'application/json'} });
  const ex = await r.json();
  const cb = ex?.data?.resultData?.runData?.['Send GLW Completion Callback']?.[0] || null;
  const inspect = {
    callbackTopLevelKeys: cb ? Object.keys(cb) : null,
    callbackDataKeys: cb?.data ? Object.keys(cb.data) : null,
    callbackSourceKeys: cb?.source ? Object.keys(cb.source) : null,
    callbackExecutionTime: cb?.executionTime ?? null,
    callbackStartTime: cb?.startTime ?? null,
    callbackHintStatusCode: cb?.statusCode ?? cb?.httpCode ?? cb?.responseCode ?? null,
    cbObject: cb,
  };
  fs.writeFileSync('tmp_callback_47833_object.json', JSON.stringify(inspect,null,2));
  console.log(JSON.stringify({keys: inspect.callbackTopLevelKeys, hint: inspect.callbackHintStatusCode, dataKeys: inspect.callbackDataKeys}));
})();
