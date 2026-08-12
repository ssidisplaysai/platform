const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=readEnv('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const id='60951';
 const ex=await (await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers})).json();
 const rd=ex?.data?.resultData?.runData||{};
 const names=['Build Pre-Publish QA Result','GLW Request?','GLW Callback Configured?','Send GLW Completion Callback','Get row(s) in sheet','Code in JavaScript','Normalize Published City Page'];
 const out={};
 for(const n of names){
  const item=rd[n]?.[0]?.data?.main?.[0]?.[0]?.json ?? null;
  out[n]=item;
 }
 fs.writeFileSync('.tmp-exec-60951-nodes.json',JSON.stringify(out,null,2));
 console.log(Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v?Object.keys(v).slice(0,25):null])));
})();