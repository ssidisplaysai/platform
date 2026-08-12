const fs=require('fs');
async function fetchText(url,opts={}){try{const r=await fetch(url,{redirect:'follow',...opts}); const t=await r.text(); return {ok:r.ok,status:r.status,headers:Object.fromEntries(r.headers.entries()),text:t};}catch(e){return {ok:false,status:null,headers:{},text:String(e)}}}
(async()=>{
  const draftUrl='https://leddisplaywarehouse.com/?page_id=19308';
  const publishUrl='https://leddisplaywarehouse.com/direct-view-led-video-walls/texas/austin/';
  const canonicalUrl='https://leddisplaywarehouse.com/direct-view-led-video-walls/texas/austin/';
  const restUrl='https://leddisplaywarehouse.com/wp-json/wp/v2/pages/19308?context=edit';
  const marker='wp-rest-yoast-meta/frontend/class-frontend.php';

  const draft=await fetchText(draftUrl);
  const publish=await fetchText(publishUrl);
  const canonical=await fetchText(canonicalUrl);
  const rest=await fetchText(restUrl);

  const out={
    checkedAt:new Date().toISOString(),
    draft:{status:draft.status,hasPhpWarning:/<b>Warning<\/b>|Warning:/i.test(draft.text),containsYoastWarningPath:draft.text.includes(marker)},
    publish:{status:publish.status,hasPhpWarning:/<b>Warning<\/b>|Warning:/i.test(publish.text),containsYoastWarningPath:publish.text.includes(marker)},
    canonical:{status:canonical.status,hasPhpWarning:/<b>Warning<\/b>|Warning:/i.test(canonical.text),containsYoastWarningPath:canonical.text.includes(marker)},
    rest:{status:rest.status,contentType:rest.headers['content-type']||null,hasPhpWarning:/<b>Warning<\/b>|Warning:/i.test(rest.text),sample:rest.text.slice(0,220)},
    server:{publishServer:publish.headers['server']||null,publishCfCache:publish.headers['cf-cache-status']||null}
  };
  fs.writeFileSync('.tmp-prod-hardening-verification-before.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();