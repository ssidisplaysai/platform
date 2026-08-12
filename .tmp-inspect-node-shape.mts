const base = process.env.GLW_N8N_BASE_URL ?? process.env.GLW_N8N_PAGE_WEBHOOK_URL?.replace(/\/webhook\/.*$/, "");
const apiKey = process.env.GLW_N8N_API_KEY;
const executionId = "65597";
const response = await fetch(`${base}/api/v1/executions/${executionId}?includeData=true`, { headers: { "X-N8N-API-KEY": apiKey ?? "" } });
const payload = await response.json();
const runData = payload?.data?.resultData?.runData ?? {};
for (const name of Object.keys(runData).filter((n) => /GLW Callback|Send GLW Completion Callback/i.test(n))) {
  const entry = runData[name];
  console.log(JSON.stringify({ node: name, type: typeof entry, isArray: Array.isArray(entry), length: Array.isArray(entry) ? entry.length : null, entry0Type: Array.isArray(entry) ? typeof entry[0] : null, entry0IsArray: Array.isArray(entry) ? Array.isArray(entry[0]) : null, first: Array.isArray(entry) ? entry[0] : entry }, null, 2));
}