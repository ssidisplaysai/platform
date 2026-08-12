const fs=require('fs');
function readEnv(name){const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'=')); if(!line) throw new Error('Missing '+name); return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');}
(async()=>{
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey=readEnv('GLW_N8N_API_KEY');
  const wfId='bIDXxyWnY22G8zJC';
  const headers={'X-N8N-API-KEY':apiKey,Accept:'application/json'};

  const wfRes=await fetch(`${origin}/api/v1/workflows/${wfId}`,{headers});
  if(!wfRes.ok) throw new Error(`fetch ${wfRes.status}`);
  const wf=await wfRes.json();

  const node=(wf.nodes||[]).find(n=>n.name==='City Page Exists?');
  if(!node) throw new Error('City Page Exists? node not found');

  const before = JSON.parse(JSON.stringify(node.parameters));

  node.parameters = {
    ...node.parameters,
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'strict',
        version: 3
      },
      conditions: [
        {
          leftValue: '={{ $json.city_page_found === true }}',
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true
          }
        }
      ],
      combinator: 'and'
    },
    options: {}
  };

  const body={name:wf.name,nodes:wf.nodes,connections:wf.connections,settings:wf.settings||{}};
  const putRes=await fetch(`${origin}/api/v1/workflows/${wfId}`,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});
  const putText=await putRes.text();
  if(!putRes.ok) throw new Error(`put ${putRes.status} ${putText}`);

  const verifyRes=await fetch(`${origin}/api/v1/workflows/${wfId}`,{headers});
  const verify=await verifyRes.json();
  const afterNode=(verify.nodes||[]).find(n=>n.name==='City Page Exists?');

  const out={
    workflowId:wfId,
    changedNode:'City Page Exists?',
    before,
    after:afterNode?.parameters || null
  };
  fs.writeFileSync('.tmp-city-page-exists-fix.json', JSON.stringify(out,null,2));
  console.log(JSON.stringify({patched:true,workflowId:wfId,node:'City Page Exists?'},null,2));
})();