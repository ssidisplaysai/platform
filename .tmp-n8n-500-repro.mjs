const webhook = (process.env.GLW_N8N_PAGE_WEBHOOK_URL || '').trim();
const apiKey = (process.env.GLW_N8N_API_KEY || '').trim();
if (!webhook || !apiKey) throw new Error('Missing env');
const origin = new URL(webhook).origin;

const affected = ['41610','46992','60113','60809','60969'];

async function fetchRecentId() {
  const url = `${origin}/api/v1/executions?limit=1`;
  const res = await fetch(url, { headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' } });
  const txt = await res.text();
  let id = null;
  try { id = JSON.parse(txt)?.data?.[0]?.id ?? null; } catch {}
  return id;
}

const recentId = await fetchRecentId();
const ids = recentId ? [recentId, ...affected] : affected;
const variants = [
  { name: 'detail', qs: '' },
  { name: 'detail_includeData_true', qs: '?includeData=true' },
  { name: 'detail_includeData_false', qs: '?includeData=false' },
  { name: 'detail_unflatten', qs: '?unflattenData=true' },
];

const out = { origin, recentId, tests: [] };

for (const id of ids) {
  for (const v of variants) {
    const url = `${origin}/api/v1/executions/${encodeURIComponent(id)}${v.qs}`;
    try {
      const res = await fetch(url, { headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' } });
      const body = await res.text();
      out.tests.push({
        id,
        variant: v.name,
        url,
        status: res.status,
        statusText: res.statusText,
        headers: {
          contentType: res.headers.get('content-type'),
          cfRay: res.headers.get('cf-ray'),
          server: res.headers.get('server'),
          xN8nVersion: res.headers.get('x-n8n-version'),
          xPoweredBy: res.headers.get('x-powered-by'),
          retryAfter: res.headers.get('retry-after'),
        },
        body,
      });
    } catch (error) {
      out.tests.push({ id, variant: v.name, url, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

console.log(JSON.stringify(out, null, 2));