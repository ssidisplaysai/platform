const fs = require('fs');
function readEnv(name) {
  const line = fs.readFileSync('.env','utf8').split(/\r?\n/).find(l => l.startsWith(name + '='));
  if (!line) throw new Error('Missing ' + name);
  return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');
}
(async () => {
  const origin = new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey = readEnv('GLW_N8N_API_KEY');
  const wfId = 'bIDXxyWnY22G8zJC';
  const headers = { 'X-N8N-API-KEY': apiKey, 'Accept':'application/json' };
  const wfRes = await fetch(`${origin}/api/v1/workflows/${wfId}`, { headers });
  const wf = await wfRes.json();
  const completion = wf.nodes.find(n => n.name === 'Send GLW Completion Callback');
  const failure = wf.nodes.find(n => n.name === 'Send GLW Failure Callback');
  completion.parameters.authentication = 'genericCredentialType';
  completion.parameters.genericAuthType = 'httpHeaderAuth';
  completion.credentials = completion.credentials || {};
  completion.credentials.httpHeaderAuth = failure.credentials.httpHeaderAuth;

  const body = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: {} };
  const putRes = await fetch(`${origin}/api/v1/workflows/${wfId}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type':'application/json' },
    body: JSON.stringify(body),
  });
  const txt = await putRes.text();
  if (!putRes.ok) throw new Error(`${putRes.status} ${txt}`);

  const verifyRes = await fetch(`${origin}/api/v1/workflows/${wfId}`, { headers });
  const verify = await verifyRes.json();
  const v = verify.nodes.find(n => n.name === 'Send GLW Completion Callback');
  fs.writeFileSync('tmp_workflow_patch_result.json', JSON.stringify({
    authentication: v?.parameters?.authentication,
    genericAuthType: v?.parameters?.genericAuthType,
    credential: v?.credentials?.httpHeaderAuth || null,
  }, null, 2));
  console.log('patched=true');
  console.log('auth=' + v?.parameters?.authentication);
  console.log('generic=' + v?.parameters?.genericAuthType);
})();
