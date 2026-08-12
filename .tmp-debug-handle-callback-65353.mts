import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function mockModule(id, exportsValue) { const resolved = require.resolve(id); require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: exportsValue, children: [], paths: [] }; }
mockModule('server-only', {});
mockModule('next/headers', { cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }) });

const execution = JSON.parse(fs.readFileSync('.tmp-n8n-execution-65353.json', 'utf8'));
const runData = execution?.data?.resultData?.runData ?? {};
const qa = runData?.['Build Pre-Publish QA Result']?.[0]?.data?.main?.[0]?.[0]?.json;

const { createPrismaGlwJobRepository } = await import('./platform-gid/src/lib/glw/job-repository');
const { handleJobCallback } = await import('./platform-gid/src/lib/glw/page-generation-api');

const payload = {
  jobId: String(qa?.job_id || qa?.jobId || '').trim(),
  executionId: String(execution?.data?.id || '').trim(),
  status: qa?.qa_callback_status === 'FAILED_QA' ? 'FAILED' : qa?.qa_callback_status,
  title: qa?.qa_title,
  wordpressUrl: qa?.qa_wordpress_url,
  wordpressPostId: qa?.qa_page_id,
  wordpressPageId: qa?.qa_page_id,
  wordpressStatus: qa?.qa_wordpress_status,
  requestedPublishingMode: qa?.requested_publishing_mode,
  disposition: qa?.qa_disposition,
  qaChecks: qa?.qa_checks,
  qaFailureReasons: qa?.qa_failure_reasons,
};

const repo = createPrismaGlwJobRepository();
const req = new Request('http://localhost/api/glw/jobs/callback', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GLW_N8N_WEBHOOK_SECRET}` },
  body: JSON.stringify(payload),
});
const res = await handleJobCallback(req, { repository: repo, webhookSecret: process.env.GLW_N8N_WEBHOOK_SECRET });
const body = await res.json();
console.log(JSON.stringify({ payload, responseStatus: res.status, responseBody: body }, null, 2));