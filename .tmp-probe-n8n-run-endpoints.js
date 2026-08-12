const fs = require('fs');
function readEnv(name){
  const line = fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'='));
  if(!line) throw new Error('Missing '+name);
  return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');
}
(async()=>{
  const origin = new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey = readEnv('GLW_N8N_API_KEY');
  const headers = { 'X-N8N-API-KEY': apiKey, 'Accept':'application/json', 'Content-Type':'application/json' };
  const tests = [
    { m:'GET', u:'/api/v1/workflows/bIDXxyWnY22G8zJC' },
    { m:'POST', u:'/api/v1/workflows/bIDXxyWnY22G8zJC/run', b:{} },
    { m:'POST', u:'/api/v1/workflows/bIDXxyWnY22G8zJC/execute', b:{} },
    { m:'POST', u:'/api/v1/executions', b:{} },
    { m:'GET', u:'/api/v1/executions?limit=3&workflowId=bIDXxyWnY22G8zJC' }
  ];
  for (const t of tests){
    const res = await fetch(origin+t.u,{ method:t.m, headers, body:t.b?JSON.stringify(t.b):undefined });
    const txt = await res.text();
    console.log('\n--- '+t.m+' '+t.u+' ---');
    console.log('status',res.status);
    console.log(txt.slice(0,500));
  }
})();