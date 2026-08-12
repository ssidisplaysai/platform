const base = process.env.GLW_N8N_BASE_URL ?? process.env.GLW_N8N_PAGE_WEBHOOK_URL?.replace(/\/webhook\/.*$/, "");
const apiKey = process.env.GLW_N8N_API_KEY;
const executionId = "65597";
const response = await fetch(`${base}/api/v1/executions/${executionId}?includeData=true`, { headers: { "X-N8N-API-KEY": apiKey ?? "" } });
const payload = await response.json();
const runData = payload?.data?.resultData?.runData ?? {};
for (const name of ["GLW Callback Configured?", "Send GLW Completion Callback"]) {
  const entry = runData[name];
  const first = entry?.[0]?.[0]?.json ?? null;
  console.log(JSON.stringify({ node: name, keys: first ? Object.keys(first) : [], sample: first ? Object.fromEntries(Object.entries(first).slice(0, 20)) : null }, null, 2));
}