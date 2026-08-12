const fs = require('fs');

function readEnv(name) {
  const line = fs.readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='));
  if (!line) throw new Error('Missing env var: ' + name);
  return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
}

(async () => {
  const webhook = readEnv('GLW_N8N_PAGE_WEBHOOK_URL');
  const apiKey = readEnv('GLW_N8N_API_KEY');
  const origin = new URL(webhook).origin;
  const workflowId = 'bIDXxyWnY22G8zJC';

  const response = await fetch(`${origin}/api/v1/workflows/${workflowId}`, {
    headers: {
      'X-N8N-API-KEY': apiKey,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${text}`);
  }

  const workflow = JSON.parse(text);
  fs.writeFileSync('.tmp-live-workflow.json', JSON.stringify(workflow, null, 2));
  console.log(`saved .tmp-live-workflow.json (nodes=${workflow.nodes?.length ?? 0})`);
})();
