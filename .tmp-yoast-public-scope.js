const fs=require('fs');
(async()=>{
  const marker='wp-rest-yoast-meta/frontend/class-frontend.php';
  const draftUrl='https://leddisplaywarehouse.com/?page_id=19308';
  const pubUrl='https://leddisplaywarehouse.com/direct-view-led-video-walls/texas/austin/';
  const dr=await fetch(draftUrl,{redirect:'follow'}); const dt=await dr.text();
  const pr=await fetch(pubUrl,{redirect:'follow'}); const pt=await pr.text();
  const idx=dt.indexOf(marker);
  const snippet=idx>=0?dt.slice(Math.max(0,idx-220),Math.min(dt.length,idx+260)):null;
  const out={
    draft:{status:dr.status,containsMarker:idx>=0,containsWarning:/Warning:/i.test(dt),containsNotice:/Notice:/i.test(dt),snippet},
    publish:{status:pr.status,containsMarker:pt.includes(marker),containsWarning:/Warning:/i.test(pt),containsNotice:/Notice:/i.test(pt)}
  };
  fs.writeFileSync('.tmp-yoast-public-scope.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();