const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const workflowId='bIDXxyWnY22G8zJC';
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const apiKey=readEnv('GLW_N8N_API_KEY');
 const headers={ 'X-N8N-API-KEY': apiKey, Accept:'application/json' };
 const wf=await (await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers})).json();
 const code=String((wf.nodes||[]).find((n)=>n.name==='Get row(s) in sheet')?.parameters?.jsCode||'');
 fs.writeFileSync('.tmp-live-getrows-code-fresh.js',code);
 const token="normalized === 'draft'";
 const idx=code.indexOf(token);
 console.log(JSON.stringify({idx,len:code.length,name:wf.name},null,2));
 if(idx>=0){
   const seg=code.slice(Math.max(0,idx-80),Math.min(code.length,idx+200));
   console.log(seg);
   console.log('---json---');
   console.log(JSON.stringify(seg));
 }
})();