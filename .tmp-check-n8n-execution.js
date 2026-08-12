const fs=require('fs');
function env(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const origin=new URL(env('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=env('GLW_N8N_API_KEY');
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const executionId='65217';
 const res=await fetch(`${origin}/api/v1/executions/${executionId}`,{headers});
 const text=await res.text();
 console.log(JSON.stringify({status:res.status, body:text.slice(0,4000)},null,2));
})();