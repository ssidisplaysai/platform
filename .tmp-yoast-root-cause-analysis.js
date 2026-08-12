const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
async function getExec(id){
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=readEnv('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 return (await (await fetch(`${origin}/api/v1/executions/${id}?includeData=true`,{headers})).json());
}
function first(rd,name){return rd?.[name]?.[0]?.data?.main?.[0]?.[0]?.json||null;}
async function fetchText(url){
 try{const r=await fetch(url,{redirect:'follow'}); return {status:r.status,text:await r.text()};}
 catch(e){return {status:null,text:String(e)};}
}
(async()=>{
 const pub=await getExec('65047');
 const drf=await getExec('65057');
 const prd=pub?.data?.resultData?.runData||{};
 const drd=drf?.data?.resultData?.runData||{};
 const pubQa=first(prd,'Build Pre-Publish QA Result')||{};
 const drfQa=first(drd,'Build Pre-Publish QA Result')||{};
 const pubYoast=first(prd,'Update Yoast SEO')||{};
 const drfYoast=first(drd,'Update Yoast SEO')||{};
 const pubUrl=String(pubQa.qa_wordpress_url||'');
 const drfUrl=String(drfQa.qa_wordpress_url||'');
 const pubHtml=await fetchText(pubUrl);
 const drfHtml=await fetchText(drfUrl);
 const marker='wp-rest-yoast-meta/frontend/class-frontend.php';
 const out={
  yoastVersionEvidence:[
    String(pubYoast.yoast_head||'').match(/Yoast SEO plugin v[^\s-]+/)?.[0]||null,
    String(drfYoast.yoast_head||'').match(/Yoast SEO plugin v[^\s-]+/)?.[0]||null,
  ],
  publishExec:{id:'65047',wpStatus:pubQa.qa_wordpress_status,url:pubUrl,yoastTitle:pubYoast.yoast_title||null,yoastMetaPresent:Array.isArray(pubYoast.yoast_meta),warningInYoastHead:marker && String(pubYoast.yoast_head||'').includes(marker)},
  draftExec:{id:'65057',wpStatus:drfQa.qa_wordpress_status,url:drfUrl,yoastTitle:drfYoast.yoast_title||null,yoastMetaPresent:Array.isArray(drfYoast.yoast_meta),warningInYoastHead:marker && String(drfYoast.yoast_head||'').includes(marker)},
  publicFetch:{
    publishStatus:pubHtml.status,
    draftStatus:drfHtml.status,
    publishContainsWarningPath:String(pubHtml.text).includes(marker),
    draftContainsWarningPath:String(drfHtml.text).includes(marker),
    publishContainsPhpWarning:/Warning:|Fatal error:|Notice:/i.test(String(pubHtml.text)),
    draftContainsPhpWarning:/Warning:|Fatal error:|Notice:/i.test(String(drfHtml.text)),
  },
  notes:{
    wpSettingsViaRestUnauthorized:true,
    pluginListViaRestUnauthorized:true
  }
 };
 fs.writeFileSync('.tmp-yoast-root-cause-analysis.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
})();