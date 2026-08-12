const base = process.env.GLW_N8N_BASE_URL ?? process.env.GLW_N8N_PAGE_WEBHOOK_URL?.replace(/\/webhook\/.*$/, "");
const apiKey = process.env.GLW_N8N_API_KEY;
const executionId = "65597";
const response = await fetch(`${base}/api/v1/executions/${executionId}?includeData=true`, {
  headers: { "X-N8N-API-KEY": apiKey ?? "" },
});
const text = await response.text();
const needles = ["wordpressStatus", "requestedPublishingMode", "disposition", "qaChecks", "qaFailureReasons", "wordpressPostId", "wordpressUrl", "featuredImageUrl"];
const hits = Object.fromEntries(needles.map((needle) => [needle, text.includes(needle)]));
console.log(JSON.stringify({ status: response.status, hits }, null, 2));