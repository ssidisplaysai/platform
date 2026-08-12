const base = process.env.GLW_N8N_BASE_URL ?? process.env.GLW_N8N_PAGE_WEBHOOK_URL?.replace(/\/webhook\/.*$/, "");
const apiKey = process.env.GLW_N8N_API_KEY;
const executionId = "65597";
const response = await fetch(`${base}/api/v1/executions/${executionId}`, {
  headers: { "X-N8N-API-KEY": apiKey ?? "" },
});
const text = await response.text();
console.log(JSON.stringify({ status: response.status, body: text.slice(0, 4000) }, null, 2));