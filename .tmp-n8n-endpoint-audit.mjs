const webhook = (process.env.GLW_N8N_PAGE_WEBHOOK_URL || '').trim();
const apiKey = (process.env.GLW_N8N_API_KEY || '').trim();
if (!webhook || !apiKey) throw new Error('Missing GLW_N8N_PAGE_WEBHOOK_URL or GLW_N8N_API_KEY');
const origin = new URL(webhook).origin;

const endpoints = [
  '/api/v1',
  '/api/v1/health',
  '/api/v1/version',
  '/rest/health',
  '/rest/settings',
  '/rest/system/info',
  '/api/v1/executions?limit=1',
];

const results = [];
for (const ep of endpoints) {
  const url = origin + ep;
  try {
    const res = await fetch(url, { headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' } });
    const text = await res.text();
    results.push({
      endpoint: ep,
      status: res.status,
      contentType: res.headers.get('content-type'),
      bodyPreview: text.slice(0, 400),
      headers: {
        server: res.headers.get('server'),
        via: res.headers.get('via'),
        xPoweredBy: res.headers.get('x-powered-by'),
      },
    });
  } catch (error) {
    results.push({ endpoint: ep, error: error instanceof Error ? error.message : String(error) });
  }
}

console.log(JSON.stringify({ origin, results }, null, 2));