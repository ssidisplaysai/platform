const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
async function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function wpJson(url){const r=await fetch(url,{headers:{Accept:'application/json'}}); const t=await r.text(); try{return JSON.parse(t);}catch{return null;}}
async function scopedCity(productSlug,stateSlug,citySlug){
  const p=await wpJson(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${encodeURIComponent(productSlug)}&per_page=1`); const pid=Array.isArray(p)&&p[0]?.id?Number(p[0].id):0;
  const s=await wpJson(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${encodeURIComponent(stateSlug)}&parent=${pid}&per_page=1`); const sid=Array.isArray(s)&&s[0]?.id?Number(s[0].id):0;
  const c=await wpJson(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${encodeURIComponent(citySlug)}&parent=${sid}&per_page=5`);
  const list=Array.isArray(c)?c:[];
  return {productId:pid,stateId:sid,items:list.map(x=>({id:x.id,slug:x.slug,link:x.link,parent:x.parent}))};
}
async function triggerAndInspect({product,state,city,callbackUrl}){
  const webhook=readEnv('GLW_N8N_PAGE_WEBHOOK_URL'); const secret=readEnv('GLW_N8N_WEBHOOK_SECRET');
  const origin=new URL(webhook).origin; const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
  const citySlug=city.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const stateSlug=state.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const productSlug=product.toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const payload={jobId:`glw-dup-val-${citySlug}-${Date.now()}`,type:'page_generation',workspaceId:'glw-led-display-warehouse',workspace_id:'glw-led-display-warehouse',site:{id:'led-display-warehouse',name:'LED Display Warehouse'},page:{pageType:'city_service',page_type:'city_service',productTopic:product,product_topic:product,product,category:product,state,city,citySlug,city_slug:citySlug,hierarchicalSlug:`${productSlug}/${stateSlug}/${citySlug}`,hierarchical_slug:`${productSlug}/${stateSlug}/${citySlug}`,additionalInstructions:'Duplicate protection validation run.',additional_instructions:'Duplicate protection validation run.',title:`${product} in ${city}`,targetSlug:`dup-val-${citySlug}`,primaryKeyword:`${product.toLowerCase()} ${city.toLowerCase()}`,secondaryKeywords:['duplicate protection'],wordCount:900,tone:'Professional',audience:'Internal QA',callToAction:'Validation only.',status:'draft',publishingMode:'draft'},promptData:{tone:'Professional',audience:'Internal QA',callToAction:'Validation only.'},seoSettings:{targetSlug:`dup-val-${citySlug}`,citySlug,city_slug:citySlug,primaryKeyword:`${product.toLowerCase()} ${city.toLowerCase()}`,secondaryKeywords:['duplicate protection'],category:product},publishingSettings:{status:'draft',wordCount:900},imageSettings:{generateFeaturedImage:true,style:'editorial'},workflowContext:{workspaceId:'glw-led-display-warehouse',pageType:'city_service',productTopic:product,state,city,citySlug,hierarchicalSlug:`${productSlug}/${stateSlug}/${citySlug}`,additionalInstructions:'Duplicate protection validation run.'},callbackUrl,authToken:secret};
  const trig=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify(payload)});
  const trigText=await trig.text(); if(!trig.ok) throw new Error(`trigger ${trig.status}: ${trigText}`);
  const tj=JSON.parse(trigText); const id=String(tj.executionId||tj.id||''); if(!id) throw new Error('missing executionId');
  const start=Date.now();
  while(Date.now()-start<15*60*1000){const sr=await fetch(`${origin}/api/v1/executions/${id}`,{headers}); const s=await sr.json(); if(s.finished) break; await sleep(4000);} 
  const er=await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers}); const ex=await er.json();
  const rd=ex?.data?.resultData?.runData||{}; const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null; const branch=(n)=>Array.isArray(rd[n]?.[0]?.data?.main)?rd[n][0].data.main.map(b=>Array.isArray(b)?b.length:0):null;
  return {executionId:id,status:ex.status,lookup:first('Normalize City Lookup Result'),cityLookupSuccessfulOutSizes:branch('City Lookup Successful?'),cityPageExistsOutSizes:branch('City Page Exists?'),createExecuted:Boolean(rd['Create a post']),updateExecuted:Boolean(rd['Update Existing City Page']),normalized:first('Normalize Published City Page'),callback:first('Send GLW Completion Callback'),error:ex?.data?.resultData?.error?{node:ex.data.resultData.error.node?.name,message:ex.data.resultData.error.message,description:ex.data.resultData.error.description}:null};
}
(async()=>{
  const out={};
  out.houstonBefore=await scopedCity('direct-view-led-video-walls','texas','houston');
  out.houstonRun1=await triggerAndInspect({product:'Direct View LED Video Walls',state:'Texas',city:'Houston',callbackUrl:''});
  out.houstonAfter1=await scopedCity('direct-view-led-video-walls','texas','houston');
  out.houstonRun2=await triggerAndInspect({product:'Direct View LED Video Walls',state:'Texas',city:'Houston',callbackUrl:''});
  out.houstonAfter2=await scopedCity('direct-view-led-video-walls','texas','houston');

  const base='qa-dup-fix';
  let newCity='';
  for(let i=0;i<8;i++){const candidate=`${base}-${Date.now()}-${i}`.toLowerCase();const chk=await scopedCity('direct-view-led-video-walls','texas',candidate);if(chk.items.length===0){newCity=candidate;out.newCityBefore=chk;break;}}
  if(!newCity) throw new Error('No absent city found');
  out.newCityName=newCity;
  out.newCityRun=await triggerAndInspect({product:'Direct View LED Video Walls',state:'Texas',city:newCity,callbackUrl:''});
  out.newCityAfter=await scopedCity('direct-view-led-video-walls','texas',newCity);

  out.crossProductHouston=await scopedCity('outdoor-led-displays','texas','houston');
  out.generatedAt=new Date().toISOString();
  fs.writeFileSync('.tmp-duplicate-validation-after-fix.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify({saved:'.tmp-duplicate-validation-after-fix.json',houstonExecs:[out.houstonRun1.executionId,out.houstonRun2.executionId],newCity:newCity,newCityExec:out.newCityRun.executionId},null,2));
})();