const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
async function fetchExec(id){
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const res=await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers:{'X-N8N-API-KEY':key,Accept:'application/json'}});
  return res.json();
}
function summarize(ex,id){
  const rd=ex?.data?.resultData?.runData||{};
  const inItem = rd['Find Existing City Page']?.[0]?.source?.[0] || null;
  const outItem = rd['Find Existing City Page']?.[0]?.data?.main?.[0]?.[0]?.json || null;
  const prep = rd['Prepare State Parent']?.[0]?.data?.main?.[0]?.[0]?.json || null;
  const norm = rd['Normalize City Lookup Result']?.[0]?.data?.main?.[0]?.[0]?.json || null;
  return {
    executionId:id,
    status:ex.status,
    prepared:{city_slug:prep?.city_slug,state_parent_id:prep?.state_parent_id,publishing_mode:prep?.publishing_mode,state_parent_slug:prep?.state_parent_slug},
    findExistingNodeRunMeta: rd['Find Existing City Page']?.[0] ? {
      executionStatus: rd['Find Existing City Page'][0].executionStatus,
      executionTime: rd['Find Existing City Page'][0].executionTime,
      source: rd['Find Existing City Page'][0].source
    } : null,
    findExistingRawOutput: outItem,
    normalized:{city_page_found:norm?.city_page_found,existing_city_page_id:norm?.existing_city_page_id,existing_city_page_status:norm?.existing_city_page_status,existing_city_page_url:norm?.existing_city_page_url}
  };
}
(async()=>{
  const ids=['60725','60726'];
  const out=[];
  for(const id of ids){
    const ex=await fetchExec(id);
    fs.writeFileSync(`.tmp-exec-${id}.json`, JSON.stringify(ex,null,2));
    out.push(summarize(ex,id));
  }
  fs.writeFileSync('.tmp-find-existing-runtime-60725-60726.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();