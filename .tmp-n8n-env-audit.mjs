const webhook = (process.env.GLW_N8N_PAGE_WEBHOOK_URL || '').trim();
const apiKey = (process.env.GLW_N8N_API_KEY || '').trim();
const origin = webhook ? new URL(webhook).origin : null;
console.log(JSON.stringify({
  hasWebhook: Boolean(webhook),
  origin,
  hasApiKey: Boolean(apiKey),
  authMethod: apiKey ? 'X-N8N-API-KEY' : 'none'
}, null, 2));