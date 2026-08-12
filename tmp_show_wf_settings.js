const fs = require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const webhook=readEnv('GLW_N8N_PAGE_WEBHOOK_URL');
 const apiKey=readEnv('GLW_N8N_API_KEY');
 const origin=new URL(webhook).origin;
 const res=await fetch(`${origin}/api/v1/workflows/bIDXxyWnY22G8zJC`,{headers:{'X-N8N-API-KEY':apiKey,'Accept':'application/json'}});
 const wf=await res.json();
 console.log('settingsKeys=' + Object.keys(wf.settings||{}).join(','));
 console.log(JSON.stringify(wf.settings||{},null,2));
})();
