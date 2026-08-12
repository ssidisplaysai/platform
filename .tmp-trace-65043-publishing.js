const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const id='65043';
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=readEnv('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const ex=await (await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers})).json();
 const rd=ex?.data?.resultData?.runData||{};
 const first=(n)=>rd[n]?.[0]?.data?.main?.[0]?.[0]?.json||null;
 const out={
  executionId:id,
  getRows:{
   source_mode:first('Get row(s) in sheet')?.source_mode,
   publishing_mode:first('Get row(s) in sheet')?.publishing_mode,
   callback_url:first('Get row(s) in sheet')?.callback_url,
   city:first('Get row(s) in sheet')?.city,
   raw_status:first('Get row(s) in sheet')?.status,
  },
  prepareStateParent:{
   publishing_mode:first('Prepare State Parent')?.publishing_mode,
   city_slug:first('Prepare State Parent')?.city_slug,
  },
  createPostStatusParam:(rd['Create a post']?.[0]?.data?.main?.[0]?.[0]?.json?.status)||null,
  updateExistingStatusParam:(rd['Update Existing City Page']?.[0]?.data?.main?.[0]?.[0]?.json?.status)||null,
  normalizePublished:{
   requested_publishing_mode:first('Normalize Published City Page')?.requested_publishing_mode,
   normalized_city_page_status:first('Normalize Published City Page')?.normalized_city_page_status,
   normalized_city_page_url:first('Normalize Published City Page')?.normalized_city_page_url,
  },
  qa:{
   callback_status:first('Build Pre-Publish QA Result')?.qa_callback_status,
   wordpress_status:first('Build Pre-Publish QA Result')?.qa_wordpress_status,
   wordpress_url:first('Build Pre-Publish QA Result')?.qa_wordpress_url,
  }
 };
 fs.writeFileSync('.tmp-exec-65043-publishing-trace.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
})();