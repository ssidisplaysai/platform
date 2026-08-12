const webhook = (process.env.GLW_N8N_PAGE_WEBHOOK_URL || '').trim();
const apiKey = (process.env.GLW_N8N_API_KEY || '').trim();
const origin = new URL(webhook).origin;

const endpoints = [
  '/rest/settings',
  '/api/v1/executions?limit=1',
  '/api/v1/workflows?limit=1',
  '/api/v1/workflows/bIDXxyWnY22G8zJC',
  '/api/v1/credentials?limit=1',
  '/api/v1/users',
];

const out=[];
for (const ep of endpoints){
  const res = await fetch(origin+ep,{headers:{'X-N8N-API-KEY':apiKey,Accept:'application/json'}});
  const txt = await res.text();
  out.push({ep,status:res.status,body:txt.slice(0,220)});
}

let settingsParsed=null;
try{
  const r=await fetch(origin+'/rest/settings',{headers:{'X-N8N-API-KEY':apiKey,Accept:'application/json'}});
  const j=await r.json();
  settingsParsed={
    settingsMode:j?.data?.settingsMode ?? null,
    userManagement:j?.data?.userManagement ?? null,
    publicApi:j?.data?.publicApi ?? null,
    enterprise:j?.data?.enterprise ?? null,
    version:j?.data?.version ?? j?.data?.n8nVersion ?? null,
  };
}catch{}

console.log(JSON.stringify({origin,out,settingsParsed},null,2));