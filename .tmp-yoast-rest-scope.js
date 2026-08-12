const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const base='https://leddisplaywarehouse.com';
 const auth='Basic '+Buffer.from(`${readEnv('GLW_ADMIN_EMAIL')}:${readEnv('GLW_ADMIN_PASSWORD')}`).toString('base64');
 const pub=await fetch(base+'/wp-json/wp/v2/pages/2565?context=edit',{headers:{Authorization:auth,Accept:'application/json'}});
 const drf=await fetch(base+'/wp-json/wp/v2/pages/19308?context=edit',{headers:{Authorization:auth,Accept:'application/json'}});
 const pubTxt=await pub.text(); const drfTxt=await drf.text();
 const pubJson=JSON.parse(pubTxt); const drfJson=JSON.parse(drfTxt);
 const marker='wp-rest-yoast-meta/frontend/class-frontend.php';
 const out={
  publishRest:{status:pub.status,containsMarker:pubTxt.includes(marker),hasYoastHead:Boolean(pubJson.yoast_head),yoastHeadVersion:String(pubJson.yoast_head||'').match(/Yoast SEO plugin v[^\s-]+/)?.[0]||null},
  draftRest:{status:drf.status,containsMarker:drfTxt.includes(marker),hasYoastHead:Boolean(drfJson.yoast_head),yoastHeadVersion:String(drfJson.yoast_head||'').match(/Yoast SEO plugin v[^\s-]+/)?.[0]||null,link:drfJson.link||null,statusField:drfJson.status||null},
 };
 fs.writeFileSync('.tmp-yoast-rest-scope.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
})();