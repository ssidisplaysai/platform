import fs from "node:fs";
import { createPrismaGlwJobRepository } from "./platform-gid/src/lib/glw/job-repository";
import { handleJobCallback } from "./platform-gid/src/lib/glw/page-generation-api";

const execution = JSON.parse(fs.readFileSync('.tmp-n8n-execution-65353.json', 'utf8'));
const runData = execution?.data?.resultData?.runData ?? {};
const qa = runData?.['Build Pre-Publish QA Result']?.[0]?.data?.main?.[0]?.[0]?.json;

if (!qa) throw new Error('QA node missing');

const callbackPayload = {
  jobId: String(qa.job_id || qa.jobId || '').trim(),
  executionId: String(execution?.data?.id || '').trim(),
  status: qa.qa_callback_status === 'FAILED_QA' ? 'FAILED' : qa.qa_callback_status,
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

const repo = createPrismaGlwJobRepository();
const before = await repo.findById(callbackPayload.jobId);

const req = new Request('http://localhost/api/glw/jobs/callback', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.GLW_N8N_WEBHOOK_SECRET}`,
  },
  body: JSON.stringify(callbackPayload),
});

const res = await handleJobCallback(req, {
  repository: repo,
  webhookSecret: process.env.GLW_N8N_WEBHOOK_SECRET,
});

const body = await res.json();
const after = await repo.findById(callbackPayload.jobId);

const out = {
  callbackPayload,
  responseStatus: res.status,
  responseJobResult: body?.job?.result ?? null,
  beforeResult: before?.result ?? null,
  afterResult: after?.result ?? null,
};

fs.writeFileSync('.tmp-platform-gid-callback-replay-65353.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));