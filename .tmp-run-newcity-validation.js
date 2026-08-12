const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
async function wpJson(url){const r=await fetch(url,{headers:{Accept:'application/json'}});const t=await r.text();try{return JSON.parse(t);}catch{return null;}}
(async()=>{
  const webhook=readEnv('GLW_N8N_PAGE_WEBHOOK_URL');
  const secret=readEnv('GLW_N8N_WEBHOOK_SECRET');
  const origin=new URL(webhook).origin;
  const key=readEnv('GLW_N8N_API_KEY');
  const headers={'X-N8N-API-KEY':key,Accept:'application/json'};

  const productSlug='direct-view-led-video-walls';
  const stateSlug='texas';
  const citySlug=`qa-dup-val-${Date.now()}`;
  const productList=await wpJson(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${productSlug}&per_page=1`);
  const productId=Array.isArray(productList)&&productList[0]?.id?Number(productList[0].id):0;
  const stateList=await wpJson(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${stateSlug}&parent=${productId}&per_page=1`);
  const stateId=Array.isArray(stateList)&&stateList[0]?.id?Number(stateList[0].id):0;
  const beforeList=await wpJson(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${citySlug}&parent=${stateId}&per_page=1`);
  const beforeId=Array.isArray(beforeList)&&beforeList[0]?.id?Number(beforeList[0].id):0;

  const payload={
    jobId:`glw-dup-val-newcity-${Date.now()}`,
    type:'page_generation',workspaceId:'glw-led-display-warehouse',workspace_id:'glw-led-display-warehouse',
    site:{id:'led-display-warehouse',name:'LED Display Warehouse'},
    page:{pageType:'city_service',page_type:'city_service',productTopic:'Direct View LED Video Walls',product_topic:'Direct View LED Video Walls',product:'Direct View LED Video Walls',category:'Direct View LED Video Walls',state:'Texas',city:citySlug,citySlug:citySlug,city_slug:citySlug,hierarchicalSlug:`${productSlug}/${stateSlug}/${citySlug}`,hierarchical_slug:`${productSlug}/${stateSlug}/${citySlug}`,additionalInstructions:'Validation new city create',additional_instructions:'Validation new city create',title:`Direct View LED Video Walls in ${citySlug}`,targetSlug:`dup-val-${citySlug}`,primaryKeyword:`direct view led video walls ${citySlug}`,secondaryKeywords:['duplicate protection'],wordCount:900,tone:'Professional',audience:'Internal QA',callToAction:'Validation only.',status:'draft',publishingMode:'draft'},
    promptData:{tone:'Professional',audience:'Internal QA',callToAction:'Validation only.'},
    seoSettings:{targetSlug:`dup-val-${citySlug}`,citySlug:citySlug,city_slug:citySlug,primaryKeyword:`direct view led video walls ${citySlug}`,secondaryKeywords:['duplicate protection'],category:'Direct View LED Video Walls'},
    publishingSettings:{status:'draft',wordCount:900},
    imageSettings:{generateFeaturedImage:true,style:'editorial'},
    workflowContext:{workspaceId:'glw-led-display-warehouse',pageType:'city_service',productTopic:'Direct View LED Video Walls',state:'Texas',city:citySlug,citySlug:citySlug,hierarchicalSlug:`${productSlug}/${stateSlug}/${citySlug}`,additionalInstructions:'Validation new city create'},
    callbackUrl:'https://app.ssiai.app/api/glw/jobs/callback',authToken:secret
  };

  const trig=await fetch(webhook,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`},body:JSON.stringify(payload)});
  const trigText=await trig.text();
  if(!trig.ok) throw new Error(`trigger ${trig.status}: ${trigText}`);
  const trigJson=JSON.parse(trigText);
  const id=String(trigJson.executionId||trigJson.id||'');

  const start=Date.now();
  while(Date.now()-start < 12*60*1000){
    const rs=await fetch(`${origin}/api/v1/executions/${id}`,{headers});
    const s=await rs.json();
    if(s.finished) break;
    await new Promise(r=>setTimeout(r,4000));
  }

  const er=await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers});
  const ex=await er.json();
  const rd=ex?.data?.resultData?.runData||{};
  const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
  const branchSizes=(n)=>Array.isArray(rd[n]?.[0]?.data?.main)?rd[n][0].data.main.map(b=>Array.isArray(b)?b.length:0):null;

  const afterList=await wpJson(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${citySlug}&parent=${stateId}&per_page=1`);
  const afterId=Array.isArray(afterList)&&afterList[0]?.id?Number(afterList[0].id):0;
  const afterUrl=Array.isArray(afterList)&&afterList[0]?.link?afterList[0].link:null;

  const out={
    citySlug,
    executionId:id,
    status:ex.status,
    beforeCityId:beforeId,
    afterCityId:afterId,
    afterCityUrl:afterUrl,
    lookup:first('Normalize City Lookup Result')?{city_page_found:first('Normalize City Lookup Result').city_page_found,existing_city_page_id:first('Normalize City Lookup Result').existing_city_page_id,city_lookup_failed:first('Normalize City Lookup Result').city_lookup_failed}:null,
    cityLookupSuccessfulOutSizes:branchSizes('City Lookup Successful?'),
    cityPageExistsOutSizes:branchSizes('City Page Exists?'),
    createExecuted:Boolean(rd['Create a post']),
    updateExecuted:Boolean(rd['Update Existing City Page']),
    normalized:first('Normalize Published City Page')?{id:first('Normalize Published City Page').normalized_city_page_id,disposition:first('Normalize Published City Page').disposition,url:first('Normalize Published City Page').normalized_city_page_url}:null,
    callbackPayload:first('Send GLW Completion Callback'),
    error:ex?.data?.resultData?.error?{node:ex.data.resultData.error.node?.name,message:ex.data.resultData.error.message,description:ex.data.resultData.error.description}:null
  };
  fs.writeFileSync('.tmp-newcity-validation-summary.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();