const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=readEnv('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const listRes=await fetch(`${origin}/api/v1/executions?limit=120&workflowId=bIDXxyWnY22G8zJC`,{headers});
 const list=await listRes.json();
 const hooks=(list.data||[]).filter(x=>x.mode==='webhook').map(x=>String(x.id));
 const details=[];
 for(const id of hooks.slice(0,20)){
   const r=await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});
   const ex=await r.json();
   const rd=ex?.data?.resultData?.runData||{};
   const req=rd['GLW Page Webhook']?.[0]?.data?.main?.[0]?.[0]?.json?.body||{};
   const city=req?.page?.city||null;
   const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
   const pub=first('Normalize Published City Page');
   const crt=first('Create a post');
   const upd=first('Update Existing City Page');
   if(city){
     details.push({id,status:ex.status,city,create:Boolean(crt),update:Boolean(upd),normalized:pub?{id:pub.normalized_city_page_id,disposition:pub.disposition}:null});
   }
 }
 fs.writeFileSync('.tmp-webhook-city-map-latest.json', JSON.stringify(details,null,2));
 console.log(JSON.stringify(details,null,2));
})();