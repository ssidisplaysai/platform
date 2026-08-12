const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const webhook = readEnv('GLW_N8N_PAGE_WEBHOOK_URL');
  const secret = readEnv('GLW_N8N_WEBHOOK_SECRET');
  const origin = new URL(webhook).origin;
  const apiKey = readEnv('GLW_N8N_API_KEY');
  const headers = {'X-N8N-API-KEY':apiKey, Accept:'application/json'};
  const city='Houston', state='Texas', product='Direct View LED Video Walls';
  const citySlug='houston', stateSlug='texas', productSlug='direct-view-led-video-walls';
  const payload = {
    jobId: `glw-dup-val-houston-rerun-${Date.now()}`,
    type:'page_generation', workspaceId:'glw-led-display-warehouse', workspace_id:'glw-led-display-warehouse',
    site:{id:'led-display-warehouse',name:'LED Display Warehouse'},
    page:{pageType:'city_service',page_type:'city_service',productTopic:product,product_topic:product,product,category:product,state,city,citySlug,city_slug:citySlug,hierarchicalSlug:`${productSlug}/${stateSlug}/${citySlug}`,hierarchical_slug:`${productSlug}/${stateSlug}/${citySlug}`,additionalInstructions:'Controlled rerun validation',additional_instructions:'Controlled rerun validation',title:`${product} in ${city}`,targetSlug:'dup-val-houston-rerun',primaryKeyword:'direct view led video walls houston',secondaryKeywords:['duplicate protection'],wordCount:900,tone:'Professional',audience:'Internal QA',callToAction:'Validation only.',status:'draft',publishingMode:'draft'},
    promptData:{tone:'Professional',audience:'Internal QA',callToAction:'Validation only.'},
    seoSettings:{targetSlug:'dup-val-houston-rerun',citySlug,city_slug:citySlug,primaryKeyword:'direct view led video walls houston',secondaryKeywords:['duplicate protection'],category:product},
    publishingSettings:{status:'draft',wordCount:900},
    imageSettings:{generateFeaturedImage:true,style:'editorial'},
    workflowContext:{workspaceId:'glw-led-display-warehouse',pageType:'city_service',productTopic:product,state,city,citySlug,hierarchicalSlug:`${productSlug}/${stateSlug}/${citySlug}`,additionalInstructions:'Controlled rerun validation'},
    callbackUrl:'https://app.ssiai.app/api/glw/jobs/callback',authToken:secret
  };
  const trig = await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify(payload)});
  const t = await trig.text();
  if(!trig.ok) throw new Error(`trigger ${trig.status}: ${t}`);
  const j = JSON.parse(t);
  const id = String(j.executionId||j.id||'');
  if(!id) throw new Error('missing executionId');
  const start = Date.now();
  while(Date.now()-start < 12*60*1000){
    const rs = await fetch(`${origin}/api/v1/executions/${id}`,{headers});
    const status = await rs.json();
    if(status.finished) break;
    await new Promise(r=>setTimeout(r,4000));
  }
  const exRes = await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});
  const ex = await exRes.json();
  const rd = ex?.data?.resultData?.runData || {};
  const pick = (n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json || null;
  const normLookup = pick('Normalize City Lookup Result');
  const normPage = pick('Normalize Published City Page');
  const out = {
    executionId:id,
    status:ex.status,
    lookup:normLookup ? {city_page_found:normLookup.city_page_found,existing_city_page_id:normLookup.existing_city_page_id,city_lookup_failed:normLookup.city_lookup_failed} : null,
    createExecuted:Boolean(rd['Create a post']),
    updateExecuted:Boolean(rd['Update Existing City Page']),
    normalized:normPage ? {id:normPage.normalized_city_page_id,url:normPage.normalized_city_page_url,disposition:normPage.disposition,requested:normPage.requested_publishing_mode,status:normPage.normalized_city_page_status} : null,
    callbackPayload: pick('Send GLW Completion Callback'),
    error: ex?.data?.resultData?.error ? { message: ex.data.resultData.error.message, description: ex.data.resultData.error.description, node: ex.data.resultData.error.node?.name } : null
  };
  fs.writeFileSync('.tmp-houston-rerun-summary.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();