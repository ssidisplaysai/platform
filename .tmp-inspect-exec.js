const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const origin = new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey = readEnv('GLW_N8N_API_KEY');
  const headers = {'X-N8N-API-KEY':apiKey, Accept:'application/json'};
  const id='60703';
  const res=await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});
  const exec=await res.json();
  fs.writeFileSync(`.tmp-exec-${id}.json`, JSON.stringify(exec,null,2));
  const runData=exec?.data?.resultData?.runData||{};
  const nodes=Object.keys(runData);
  const req = runData['GLW Page Webhook']?.[0]?.data?.main?.[0]?.[0]?.json?.body || null;
  const norm = runData['Normalize City Lookup Result']?.[0]?.data?.main?.[0]?.[0]?.json || null;
  const pub = runData['Normalize Published City Page']?.[0]?.data?.main?.[0]?.[0]?.json || null;
  const cb = runData['Send GLW Completion Callback']?.[0]?.data?.main?.[0]?.[0]?.json || null;
  const err = exec?.data?.resultData?.error || null;
  console.log(JSON.stringify({id,status:exec.status,startedAt:exec.startedAt,nodesCount:nodes.length,city:req?.page?.city||req?.city||null,product:req?.page?.productTopic||req?.page?.product||null,lookup:norm?{city_page_found:norm.city_page_found,existing_city_page_id:norm.existing_city_page_id,city_lookup_failed:norm.city_lookup_failed}:null,normalized:pub?{id:pub.normalized_city_page_id,url:pub.normalized_city_page_url,status:pub.normalized_city_page_status,disposition:pub.disposition}:null,createExecuted:Boolean(runData['Create a post']),updateExecuted:Boolean(runData['Update Existing City Page']),callback:cb,error:err?{message:err.message,description:err.description,name:err.name,node:err.node?.name}:null},null,2));
})();