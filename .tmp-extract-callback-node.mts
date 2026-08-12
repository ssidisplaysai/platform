const base = process.env.GLW_N8N_BASE_URL ?? process.env.GLW_N8N_PAGE_WEBHOOK_URL?.replace(/\/webhook\/.*$/, "");
const apiKey = process.env.GLW_N8N_API_KEY;
const executionId = "65597";
const response = await fetch(`${base}/api/v1/executions/${executionId}?includeData=true`, { headers: { "X-N8N-API-KEY": apiKey ?? "" } });
const payload = await response.json();
const runData = payload?.data?.resultData?.runData ?? {};
const nodeNames = Object.keys(runData);
const completionNode = nodeNames.find((name) => /Send GLW Completion Callback/i.test(name));
const callbackConfigNode = nodeNames.find((name) => /GLW Callback Configured\?/i.test(name));
const completionNodeData = completionNode ? runData[completionNode] : null;
const callbackConfigNodeData = callbackConfigNode ? runData[callbackConfigNode] : null;
console.log(JSON.stringify({
  completionNode,
  callbackConfigNode,
  completionNodeFirstRun: completionNodeData?.[0]?.[0] ?? null,
  callbackConfigNodeFirstRun: callbackConfigNodeData?.[0]?.[0] ?? null,
}, null, 2));