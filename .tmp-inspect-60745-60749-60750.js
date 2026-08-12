const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
const ids=['60745','60749','60750'];
(async()=>{
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=readEnv('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const out=[];
 for(const id of ids){
  const res=await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});
  const ex=await res.json();
  fs.writeFileSync(`.tmp-exec-${id}.json`, JSON.stringify(ex,null,2));
  const rd=ex?.data?.resultData?.runData||{};
  const req=rd['GLW Page Webhook']?.[0]?.data?.main?.[0]?.[0]?.json?.body||{};
  const city=req?.page?.city||null;
  const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
  const branch=(n)=>Array.isArray(rd[n]?.[0]?.data?.main)?rd[n][0].data.main.map(b=>Array.isArray(b)?b.length:0):null;
  const find=first('Find Existing City Page');
  const norm=first('Normalize City Lookup Result');
  const upd=first('Update Existing City Page');
  const crt=first('Create a post');
  const pub=first('Normalize Published City Page');
  out.push({id,status:ex.status,city,find:{statusCode:find?.statusCode,xWpTotal:find?.headers?.['x-wp-total'],bodyCount:Array.isArray(find?.body)?find.body.length:null},lookup:{city_page_found:norm?.city_page_found,existing_city_page_id:norm?.existing_city_page_id,existing_city_page_status:norm?.existing_city_page_status},cityPageExistsOutSizes:branch('City Page Exists?'),createExecuted:Boolean(crt),updateExecuted:Boolean(upd),createResult:crt?{id:crt.id,slug:crt.slug,status:crt.status,parent:crt.parent}:null,updateResult:upd?{id:upd.id,slug:upd.slug,status:upd.status,parent:upd.parent}:null,normalized:pub?{id:pub.normalized_city_page_id,disposition:pub.disposition,status:pub.normalized_city_page_status,url:pub.normalized_city_page_url}:null});
 }
 fs.writeFileSync('.tmp-execs-60745-60749-60750-summary.json', JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
})();