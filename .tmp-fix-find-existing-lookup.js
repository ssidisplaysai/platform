const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
 const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
 const key=readEnv('GLW_N8N_API_KEY');
 const wfId='bIDXxyWnY22G8zJC';
 const headers={'X-N8N-API-KEY':key,Accept:'application/json'};
 const wfRes=await fetch(`${origin}/api/v1/workflows/${wfId}`,{headers});
 const wf=await wfRes.json();
 const node=(wf.nodes||[]).find(n=>n.name==='Find Existing City Page');
 if(!node) throw new Error('Find Existing City Page node missing');
 const oldUrl=node.parameters?.url||'';
 const newUrl="=https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug={{ $('Prepare State Parent').first().json.city_slug }}&parent={{ $('Prepare State Parent').first().json.state_parent_id }}&per_page=1&status=any&context=edit";
 node.parameters.url=newUrl;
 const body={name:wf.name,nodes:wf.nodes,connections:wf.connections,settings:wf.settings||{}};
 const put=await fetch(`${origin}/api/v1/workflows/${wfId}`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const t=await put.text();
 if(!put.ok) throw new Error(`PUT failed ${put.status} ${t}`);
 const verifyRes=await fetch(`${origin}/api/v1/workflows/${wfId}`,{headers});
 const verify=await verifyRes.json();
 const vNode=(verify.nodes||[]).find(n=>n.name==='Find Existing City Page');
 const out={workflowId:wfId,node:'Find Existing City Page',oldUrl,newUrl:vNode?.parameters?.url||null};
 fs.writeFileSync('.tmp-find-existing-lookup-fix.json', JSON.stringify(out,null,2));
 console.log(JSON.stringify(out,null,2));
})();