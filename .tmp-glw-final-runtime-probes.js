const fs=require('fs');
async function get(url){const r=await fetch(url,{redirect:'follow'}); const t=await r.text(); return {status:r.status,text:t,headers:Object.fromEntries(r.headers.entries())};}
function hasWarn(t){return /<b>Warning<\/b>|Warning:\s+Attempt to read property|Fatal error:|Notice:/i.test(String(t));}
(async()=>{
 const pub='https://leddisplaywarehouse.com/direct-view-led-video-walls/texas/austin/';
 const draft='https://leddisplaywarehouse.com/?page_id=19290';
 const health='https://app.ssiai.app/api/glw/health';
 const pages='https://app.ssiai.app/glw/pages';
 const login='https://app.ssiai.app/glw/login';
 const rest='https://leddisplaywarehouse.com/wp-json/wp/v2/pages/19308?context=edit';
 const [p,d,h,pg,lg,r]=await Promise.all([get(pub),get(draft),get(health),get(pages),get(login),get(rest)]);
 const out={
  checkedAt:new Date().toISOString(),
  published:{status:p.status,warning:hasWarn(p.text)},
  draft404:{status:d.status,warning:hasWarn(d.text)},
  health:{status:h.status,warning:hasWarn(h.text)},
  glwPages:{status:pg.status,loginLike:/login|signin|auth/i.test(pg.text.slice(0,500))},
  glwLogin:{status:lg.status},
  rest:{status:r.status,contentType:r.headers['content-type']||null,warning:hasWarn(r.text)}
 };
 fs.writeFileSync('.tmp-glw-final-runtime-probes.json',JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
})();