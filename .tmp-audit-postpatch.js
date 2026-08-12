const fs=require('fs');
function readEnv(name){
  const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find(l=>l.startsWith(name+'='));
  if(!line) throw new Error('Missing '+name);
  return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');
}
(async()=>{
  const origin = new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey = readEnv('GLW_N8N_API_KEY');
  const wfId='bIDXxyWnY22G8zJC';
  const headers={ 'X-N8N-API-KEY': apiKey, Accept:'application/json' };
  const res=await fetch(`${origin}/api/v1/workflows/${wfId}`,{headers});
  const wf=await res.json();
  const pick=['Find Existing City Page','Normalize City Lookup Result','City Lookup Successful?','City Page Exists?','Update Existing City Page','Normalize Published City Page','Send GLW Completion Callback','Update Yoast SEO','Prepare Image Fields','Set Featured Image','Insert Image Into Page','Update row in sheet','Validation Passed?'];
  const out={};
  for(const name of pick){
    const n=(wf.nodes||[]).find(x=>x.name===name);
    out[name]= n ? { type:n.type, parameters:n.parameters } : null;
  }
  out.connections={
    'Validation Passed?': wf.connections?.['Validation Passed?']?.main || null,
    'Find Existing City Page': wf.connections?.['Find Existing City Page']?.main || null,
    'Normalize City Lookup Result': wf.connections?.['Normalize City Lookup Result']?.main || null,
    'City Lookup Successful?': wf.connections?.['City Lookup Successful?']?.main || null,
    'City Page Exists?': wf.connections?.['City Page Exists?']?.main || null,
    'Create a post': wf.connections?.['Create a post']?.main || null,
    'Update Existing City Page': wf.connections?.['Update Existing City Page']?.main || null,
    'Normalize Published City Page': wf.connections?.['Normalize Published City Page']?.main || null
  };
  fs.writeFileSync('.tmp-duplicate-postpatch-audit.json', JSON.stringify(out,null,2));
  console.log('wrote .tmp-duplicate-postpatch-audit.json');
})();