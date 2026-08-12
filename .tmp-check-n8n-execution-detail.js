const fs=require('fs');
function env(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const origin=new URL(env('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=env('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 for (const suffix of ['', '?includeData=true', '?includeData=true&binaryData=false']) {
   const res=await fetch(`${origin}/api/v1/executions/65217${suffix}`,{headers});
   const text=await res.text();
   console.log('SUFFIX', suffix || '(none)');
   console.log(text.slice(0,8000));
   console.log('---');
 }
})();