const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function fetchWithRetry(url, init={}, maxAttempts=8){
  let lastErr;
  for(let attempt=1; attempt<=maxAttempts; attempt++){
    try { return await fetch(url, init); }
    catch(err){ lastErr=err; if(attempt===maxAttempts) break; await sleep(1200*attempt); }
  }
  throw lastErr;
}
(async()=>{
  const city='qa-dup-rel-1786148763196-0';
  const product='Direct View LED Video Walls';
  const state='Texas';
  const webhook=readEnv('GLW_N8N_PAGE_WEBHOOK_URL');
  const secret=readEnv('GLW_N8N_WEBHOOK_SECRET');
  const origin=new URL(webhook).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const citySlug=city;
  const stateSlug='texas';
  const productSlug='direct-view-led-video-walls';
  const payload={jobId:`glw-dup-rel-${citySlug}-${Date.now()}`,type:'page_generation',workspaceId:'glw-led-display-warehouse',workspace_id:'glw-led-display-warehouse',site:{id:'led-display-warehouse',name:'LED Display Warehouse'},page:{pageType:'city_service',page_type:'city_service',productTopic:product,product_topic:product,product,category:product,state,city,citySlug,city_slug:citySlug,hierarchicalSlug:`${productSlug}/${stateSlug}/${citySlug}`,hierarchical_slug:`${productSlug}/${stateSlug}/${citySlug}`,additionalInstructions:'Duplicate lookup reliability validation.',additional_instructions:'Duplicate lookup reliability validation.',title:`${product} in ${city}`,targetSlug:`dup-rel-${citySlug}`,primaryKeyword:`${product.toLowerCase()} ${city.toLowerCase()}`,secondaryKeywords:['duplicate lookup reliability'],wordCount:900,tone:'Professional',audience:'Internal QA',callToAction:'Validation only.',status:'draft',publishingMode:'draft'},promptData:{tone:'Professional',audience:'Internal QA',callToAction:'Validation only.'},seoSettings:{targetSlug:`dup-rel-${citySlug}`,citySlug,city_slug:citySlug,primaryKeyword:`${product.toLowerCase()} ${city.toLowerCase()}`,secondaryKeywords:['duplicate lookup reliability'],category:product},publishingSettings:{status:'draft',wordCount:900},imageSettings:{generateFeaturedImage:true,style:'editorial'},workflowContext:{workspaceId:'glw-led-display-warehouse',pageType:'city_service',productTopic:product,state,city,citySlug,hierarchicalSlug:`${productSlug}/${stateSlug}/${citySlug}`,additionalInstructions:'Duplicate lookup reliability validation.'},callbackUrl:'',authToken:secret};
  const trig=await fetchWithRetry(webhook,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify(payload)});
  const text=await trig.text(); if(!trig.ok) throw new Error(`trigger ${trig.status}: ${text}`);
  const tj=JSON.parse(text); const id=String(tj.executionId||tj.id||'');
  const started=Date.now();
  while(Date.now()-started<15*60*1000){const sr=await fetchWithRetry(`${origin}/api/v1/executions/${id}`,{headers});const s=await sr.json();if(s.finished) break;await sleep(3500);} 
  const er=await fetchWithRetry(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});const ex=await er.json();
  const rd=ex?.data?.resultData?.runData||{};
  const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
  const find=first('Find Existing City Page');
  const norm=first('Normalize City Lookup Result');
  const crt=first('Create a post');
  const upd=first('Update Existing City Page');
  const pub=first('Normalize Published City Page');
  const out={id,status:ex.status,city,find:{xWpTotal:find?.headers?.['x-wp-total'],bodyCount:Array.isArray(find?.body)?find.body.length:null},lookup:{city_page_found:norm?.city_page_found,existing_city_page_id:norm?.existing_city_page_id},createExecuted:Boolean(crt),updateExecuted:Boolean(upd),createResult:crt?{id:crt.id,slug:crt.slug,status:crt.status,parent:crt.parent}:null,updateResult:upd?{id:upd.id,slug:upd.slug,status:upd.status,parent:upd.parent}:null,normalized:pub?{id:pub.normalized_city_page_id,disposition:pub.disposition}:null};
  fs.writeFileSync('.tmp-newcity-extra-run.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();