import fs from "node:fs";

const apiKey = process.env.GLW_N8N_API_KEY?.trim();
const webhookUrl = process.env.GLW_N8N_PAGE_WEBHOOK_URL?.trim();
const callbackSecret = process.env.GLW_N8N_WEBHOOK_SECRET?.trim();
if (!apiKey || !webhookUrl || !callbackSecret) throw new Error('Missing required env');

const origin = new URL(webhookUrl).origin;
const executionId = '65353';
const res = await fetch(`${origin}/api/v1/executions/${executionId}?includeData=true`, {
  headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
});
const txt = await res.text();
if (!res.ok) throw new Error(`n8n HTTP ${res.status}`);
const json = JSON.parse(txt);
const runData = json?.data?.resultData?.runData ?? {};

const qa = runData?.['Build Pre-Publish QA Result']?.[0]?.data?.main?.[0]?.[0]?.json ?? null;
if (!qa) throw new Error('Missing QA node json');

const callbackPayload = {
  jobId: String(qa.job_id || qa.jobId || '').trim(),
  executionId: executionId,
  status: qa.qa_callback_status === 'FAILED_QA' ? 'FAILED' : qa.qa_callback_status,
  qaCallbackStatus: qa.qa_callback_status,
  title: qa.qa_title,
  wordpressUrl: qa.qa_wordpress_url,
  wordpressPostId: qa.qa_page_id,
  wordpressPageId: qa.qa_page_id,
  wordpressStatus: qa.qa_wordpress_status,
  requestedPublishingMode: qa.requested_publishing_mode,
  disposition: qa.qa_disposition,
  qaChecks: qa.qa_checks,
  qaFailureReasons: qa.qa_failure_reasons,
};

const callbackRes = await fetch('http://localhost:3000/api/glw/jobs/callback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${callbackSecret}`,
  },
  body: JSON.stringify(callbackPayload),
});

const callbackJson = await callbackRes.json();

const out = {
  replayStatus: callbackRes.status,
  callbackPayload,
  responseResult: callbackJson?.job?.result ?? null,
};

fs.writeFileSync('.tmp-65353-callback-replay-after-fix.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));