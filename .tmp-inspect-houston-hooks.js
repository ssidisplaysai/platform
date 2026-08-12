const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
function summarize(exec){
  const rd=exec?.data?.resultData?.runData||{};
  const pick=(n)=>rd[n]?.[0]?.data?.main||null;
  const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
  const req = rd['GLW Page Webhook']?.[0]?.data?.main?.[0]?.[0]?.json?.body || null;
  return {
    id:String(exec.id), status:exec.status, city:req?.page?.city||null, product:req?.page?.productTopic||null,
    lookup:first('Normalize City Lookup Result') ? {city_page_found:first('Normalize City Lookup Result').city_page_found, existing_city_page_id:first('Normalize City Lookup Result').existing_city_page_id, city_lookup_failed:first('Normalize City Lookup Result').city_lookup_failed} : null,
    cityLookupSuccessfulOutSizes: Array.isArray(pick('City Lookup Successful?')) ? pick('City Lookup Successful?').map(b=>Array.isArray(b)?b.length:0) : null,
    cityPageExistsOutSizes: Array.isArray(pick('City Page Exists?')) ? pick('City Page Exists?').map(b=>Array.isArray(b)?b.length:0) : null,
    createExecuted:Boolean(rd['Create a post']), updateExecuted:Boolean(rd['Update Existing City Page']),
    normalized:first('Normalize Published City Page') ? {id:first('Normalize Published City Page').normalized_city_page_id, disposition:first('Normalize Published City Page').disposition, url:first('Normalize Published City Page').normalized_city_page_url} : null,
    error: exec?.data?.resultData?.error ? {node:exec.data.resultData.error.node?.name, message:exec.data.resultData.error.message, description:exec.data.resultData.error.description} : null,
    runNodes:Object.keys(rd)
  };
}
(async()=>{
  const origin = new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey = readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':apiKey,Accept:'application/json'};
  const ids=['60703','60706'];
  const out=[];
  for(const id of ids){
    const res=await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});
    const ex=await res.json();
    fs.writeFileSync(`.tmp-exec-${id}.json`, JSON.stringify(ex,null,2));
    out.push(summarize(ex));
  }
  fs.writeFileSync('.tmp-houston-webhook-summaries.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();