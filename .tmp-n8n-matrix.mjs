const webhook = (process.env.GLW_N8N_PAGE_WEBHOOK_URL || '').trim();
const apiKey = (process.env.GLW_N8N_API_KEY || '').trim();
const origin = new URL(webhook).origin;

const affected = ['41610','41688','41741','46992','60113','60809','60815','60834','60915','60919','60948','60951','60969'];

async function getRecent(){
  const r=await fetch(`${origin}/api/v1/executions?limit=1`,{headers:{'X-N8N-API-KEY':apiKey,Accept:'application/json'}});
  const j=await r.json();
  return j?.data?.[0]?.id ?? null;
}
const recent = await getRecent();
const ids = recent ? [recent, ...affected] : affected;
const variants = [
  ['', 'detail'],
  ['?includeData=true', 'includeData=true'],
  ['?includeData=false', 'includeData=false'],
];
const rows=[];
for (const id of ids){
  for (const [qs,name] of variants){
    const url=`${origin}/api/v1/executions/${id}${qs}`;
    const res=await fetch(url,{headers:{'X-N8N-API-KEY':apiKey,Accept:'application/json'}});
    const txt=await res.text();
    rows.push({id,variant:name,status:res.status,body:txt.slice(0,140)});
  }
}
console.log(JSON.stringify({origin,recent,rows},null,2));