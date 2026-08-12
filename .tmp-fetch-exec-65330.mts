import fs from "node:fs";

const apiKey = process.env.GLW_N8N_API_KEY?.trim();
const webhookUrl = process.env.GLW_N8N_PAGE_WEBHOOK_URL?.trim();
if (!apiKey || !webhookUrl) {
  throw new Error("Missing GLW_N8N_API_KEY or GLW_N8N_PAGE_WEBHOOK_URL");
}

const origin = new URL(webhookUrl).origin;
const executionId = "65330";
const url = `${origin}/api/v1/executions/${executionId}?includeData=true`;

const response = await fetch(url, {
  method: "GET",
  headers: {
    "X-N8N-API-KEY": apiKey,
    "Accept": "application/json",
  },
});

const text = await response.text();
if (!response.ok) {
  console.log(text);
  throw new Error(`HTTP ${response.status}`);
}

const json = JSON.parse(text);
fs.writeFileSync('.tmp-n8n-execution-65330.json', JSON.stringify(json, null, 2));

const payload = json?.data?.resultData?.runData ?? json?.resultData?.runData ?? json?.data?.runData ?? json?.runData;
const nodeNames = payload && typeof payload === 'object' ? Object.keys(payload) : [];

console.log(JSON.stringify({
  executionId,
  nodeCount: nodeNames.length,
  nodeNames,
}, null, 2));