const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
async function wpFetch(path){
  const base='https://leddisplaywarehouse.com';
  const auth='Basic '+Buffer.from(`${readEnv('GLW_ADMIN_EMAIL')}:${readEnv('GLW_ADMIN_PASSWORD')}`).toString('base64');
  const res=await fetch(base+path,{headers:{Authorization:auth,Accept:'application/json'}});
  const text=await res.text();
  let body=null; try{ body=JSON.parse(text);}catch{ body=text; }
  return {status:res.status,headers:Object.fromEntries(res.headers.entries()),body};
}
(async()=>{
  const plugin=await wpFetch('/wp-json/wp/v2/plugins?search=yoast');
  const settings=await wpFetch('/wp-json/wp/v2/settings');
  const draft=await wpFetch('/wp-json/wp/v2/pages/19308?context=edit');
  const publish=await wpFetch('/wp-json/wp/v2/pages/2565?context=edit');
  const out={
    pluginStatus:plugin.status,
    pluginSample:Array.isArray(plugin.body)?plugin.body.slice(0,5):plugin.body,
    settingsStatus:settings.status,
    settingsKeys:settings.body&&typeof settings.body==='object'?Object.keys(settings.body).slice(0,40):null,
    debugRelated:settings.body&&typeof settings.body==='object'?{
      blog_public:settings.body.blog_public,
      timezone_string:settings.body.timezone_string,
      url:settings.body.url,
      email:settings.body.email,
    }:null,
    draftStatus:draft.status,
    draftYoastKeys:draft.body&&typeof draft.body==='object'?Object.keys(draft.body).filter((k)=>k.toLowerCase().includes('yoast')||k.toLowerCase().includes('meta')):null,
    draftLink:draft.body?.link ?? null,
    draftRendered:draft.body?.content?.rendered?.slice?.(0,200) ?? null,
    publishStatus:publish.status,
    publishYoastKeys:publish.body&&typeof publish.body==='object'?Object.keys(publish.body).filter((k)=>k.toLowerCase().includes('yoast')||k.toLowerCase().includes('meta')):null,
    publishLink:publish.body?.link ?? null,
  };
  fs.writeFileSync('.tmp-yoast-investigation.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify(out,null,2));
})();