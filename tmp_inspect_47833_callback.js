const fs = require('fs');
function env(name){ const l = fs.readFileSync('.env','utf8').split(/\r?\n/).find(x=>x.startsWith(name+'=')); return l ? l.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'') : ''; }
const origin = new URL(env('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
const apiKey = env('GLW_N8N_API_KEY');
const execId = '47833';
(async()=>{
  const r = await fetch(`${origin}/api/v1/executions/${execId}?includeData=true`, { headers:{'X-N8N-API-KEY':apiKey,'Accept':'application/json'} });
  const ex = await r.json();
  const cb = ex?.data?.resultData?.runData?.['Send GLW Completion Callback']?.[0] || null;
  const item = cb?.data?.main?.[0]?.[0] || null;
  const summary = {
    executionStatus: ex?.status,
    callbackHasError: !!cb?.error,
    callbackError: cb?.error || null,
    itemKeys: item ? Object.keys(item) : null,
    jsonKeys: item?.json ? Object.keys(item.json) : null,
    pairedItemKeys: item?.pairedItem ? Object.keys(item.pairedItem) : null,
    itemPreview: item,
  };
  fs.writeFileSync('tmp_callback_47833_raw.json', JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary));
})();
