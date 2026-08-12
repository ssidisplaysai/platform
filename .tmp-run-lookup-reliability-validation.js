const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function fetchWithRetry(url, init={}, maxAttempts=6){
  let lastErr;
  for(let attempt=1; attempt<=maxAttempts; attempt++){
    try {
      return await fetch(url, init);
    } catch (err) {
      lastErr=err;
      if(attempt===maxAttempts) break;
      await sleep(1200*attempt);
    }
  }
  throw lastErr;
}
async function wpJson(url){const r=await fetchWithRetry(url,{headers:{Accept:'application/json'}});const t=await r.text();try{return JSON.parse(t);}catch{return null;}}
async function scoped(productSlug,stateSlug,citySlug){
  const p=await wpJson(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${encodeURIComponent(productSlug)}&per_page=1`); const pid=Array.isArray(p)&&p[0]?.id?Number(p[0].id):0;
  const s=await wpJson(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${encodeURIComponent(stateSlug)}&parent=${pid}&per_page=1`); const sid=Array.isArray(s)&&s[0]?.id?Number(s[0].id):0;
  const c=await wpJson(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${encodeURIComponent(citySlug)}&parent=${sid}&per_page=10`);
  return {productId:pid,stateId:sid,items:Array.isArray(c)?c.map(x=>({id:x.id,slug:x.slug,status:x.status,link:x.link,parent:x.parent})):[]};
}
async function triggerRun({product,state,city}){
  const webhook=readEnv('GLW_N8N_PAGE_WEBHOOK_URL'); const secret=readEnv('GLW_N8N_WEBHOOK_SECRET');
  const origin=new URL(webhook).origin; const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const citySlug=city.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const stateSlug=state.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const productSlug=product.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const payload={jobId:`glw-dup-rel-${citySlug}-${Date.now()}`,type:'page_generation',workspaceId:'glw-led-display-warehouse',workspace_id:'glw-led-display-warehouse',site:{id:'led-display-warehouse',name:'LED Display Warehouse'},page:{pageType:'city_service',page_type:'city_service',productTopic:product,product_topic:product,product,category:product,state,city,citySlug,city_slug:citySlug,hierarchicalSlug:`${productSlug}/${stateSlug}/${citySlug}`,hierarchical_slug:`${productSlug}/${stateSlug}/${citySlug}`,additionalInstructions:'Duplicate lookup reliability validation.',additional_instructions:'Duplicate lookup reliability validation.',title:`${product} in ${city}`,targetSlug:`dup-rel-${citySlug}`,primaryKeyword:`${product.toLowerCase()} ${city.toLowerCase()}`,secondaryKeywords:['duplicate lookup reliability'],wordCount:900,tone:'Professional',audience:'Internal QA',callToAction:'Validation only.',status:'draft',publishingMode:'draft'},promptData:{tone:'Professional',audience:'Internal QA',callToAction:'Validation only.'},seoSettings:{targetSlug:`dup-rel-${citySlug}`,citySlug,city_slug:citySlug,primaryKeyword:`${product.toLowerCase()} ${city.toLowerCase()}`,secondaryKeywords:['duplicate lookup reliability'],category:product},publishingSettings:{status:'draft',wordCount:900},imageSettings:{generateFeaturedImage:true,style:'editorial'},workflowContext:{workspaceId:'glw-led-display-warehouse',pageType:'city_service',productTopic:product,state,city,citySlug,hierarchicalSlug:`${productSlug}/${stateSlug}/${citySlug}`,additionalInstructions:'Duplicate lookup reliability validation.'},callbackUrl:'',authToken:secret};
  const trig=await fetchWithRetry(webhook,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify(payload)});
  const text=await trig.text(); if(!trig.ok) throw new Error(`trigger ${trig.status}: ${text}`);
  const tj=JSON.parse(text); const id=String(tj.executionId||tj.id||''); if(!id) throw new Error('missing executionId');
  const started=Date.now();
  while(Date.now()-started<15*60*1000){const sr=await fetchWithRetry(`${origin}/api/v1/executions/${id}`,{headers});const s=await sr.json();if(s.finished) break;await sleep(4000);} 
  const er=await fetchWithRetry(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});const ex=await er.json();
  const rd=ex?.data?.resultData?.runData||{};
  const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
  const branch=(n)=>Array.isArray(rd[n]?.[0]?.data?.main)?rd[n][0].data.main.map(b=>Array.isArray(b)?b.length:0):null;
  const findOut=first('Find Existing City Page');
  const norm=first('Normalize City Lookup Result');
  const normPub=first('Normalize Published City Page');
  const upd=first('Update Existing City Page');
  const crt=first('Create a post');
  return {
    executionId:id,
    status:ex.status,
    findExisting:{statusCode:findOut?.statusCode,xWpTotal:findOut?.headers?.['x-wp-total'],xWpTotalPages:findOut?.headers?.['x-wp-totalpages'],bodyCount:Array.isArray(findOut?.body)?findOut.body.length:null},
    lookup:{city_page_found:norm?.city_page_found,existing_city_page_id:norm?.existing_city_page_id,existing_city_page_status:norm?.existing_city_page_status,existing_city_page_slug:norm?.existing_city_page_slug},
    cityLookupSuccessfulOutSizes:branch('City Lookup Successful?'),
    cityPageExistsOutSizes:branch('City Page Exists?'),
    createExecuted:Boolean(crt),
    updateExecuted:Boolean(upd),
    createResult:crt?{id:crt.id,status:crt.status,slug:crt.slug,parent:crt.parent,link:crt.link}:null,
    updateResult:upd?{id:upd.id,status:upd.status,slug:upd.slug,parent:upd.parent,link:upd.link}:null,
    normalized:normPub?{id:normPub.normalized_city_page_id,url:normPub.normalized_city_page_url,status:normPub.normalized_city_page_status,disposition:normPub.disposition}:null,
    error:ex?.data?.resultData?.error?{node:ex.data.resultData.error.node?.name,message:ex.data.resultData.error.message,description:ex.data.resultData.error.description}:null
  };
}
(async()=>{
  const out={};
  out.lookupNode=JSON.parse(fs.readFileSync('.tmp-find-existing-city-node.json','utf8'));

  out.houstonBefore=await scoped('direct-view-led-video-walls','texas','houston');
  out.houstonRuns=[];
  for(let i=1;i<=4;i++) out.houstonRuns.push(await triggerRun({product:'Direct View LED Video Walls',state:'Texas',city:'Houston'}));
  out.houstonAfter=await scoped('direct-view-led-video-walls','texas','houston');

  let newCity='';
  for(let i=0;i<20;i++){
    const c=`qa-dup-rel-${Date.now()}-${i}`.toLowerCase();
    const chk=await scoped('direct-view-led-video-walls','texas',c);
    if(chk.items.length===0){newCity=c; out.newCityBefore=chk; break;}
  }
  if(!newCity) throw new Error('Could not find absent new city');
  out.newCity=newCity;
  out.newCityRuns=[];
  for(let i=1;i<=4;i++) out.newCityRuns.push(await triggerRun({product:'Direct View LED Video Walls',state:'Texas',city:newCity}));
  out.newCityAfter=await scoped('direct-view-led-video-walls','texas',newCity);

  out.crossProductHouston=await scoped('outdoor-led-displays','texas','houston');
  out.generatedAt=new Date().toISOString();
  fs.writeFileSync('.tmp-duplicate-lookup-reliability-validation.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify({saved:'.tmp-duplicate-lookup-reliability-validation.json',houstonExecutions:out.houstonRuns.map(r=>r.executionId),newCity,newCityExecutions:out.newCityRuns.map(r=>r.executionId)},null,2));
})();