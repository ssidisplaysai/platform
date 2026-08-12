const base = process.env.GLW_N8N_BASE_URL ?? process.env.GLW_N8N_PAGE_WEBHOOK_URL?.replace(/\/webhook\/.*$/, "");
const apiKey = process.env.GLW_N8N_API_KEY;
const executionId = "65597";
const response = await fetch(`${base}/api/v1/executions/${executionId}?includeData=true`, {
  headers: { "X-N8N-API-KEY": apiKey ?? "" },
});
const text = await response.text();
const match = text.match(/"content":\[\{"type":"output_text"[\s\S]*?"text":"([\s\S]*?)"\}\]/);
console.log(JSON.stringify({ hasMatch: Boolean(match), snippet: match ? match[1].slice(0, 2000) : null }, null, 2));