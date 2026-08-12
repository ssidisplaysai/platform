import fs from "node:fs";
import { createPrismaGlwJobRepository } from "./platform-gid/src/lib/glw/job-repository";
import { applyGlwJobCallback } from "./platform-gid/src/lib/glw/page-generation";

const execution = JSON.parse(fs.readFileSync('.tmp-n8n-execution-65353.json', 'utf8'));
const runData = execution?.data?.resultData?.runData ?? {};
const qa = runData?.['Build Pre-Publish QA Result']?.[0]?.data?.main?.[0]?.[0]?.json;
const executionId = String(execution?.data?.id ?? execution?.id ?? '').trim();
if (!qa || !executionId) throw new Error('Missing QA or execution id');

const payload = {
  jobId: String(qa.job_id || qa.jobId || '').trim(),
  executionId,
  status: 'COMPLETE' as const,
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
const updated = await applyGlwJobCallback(payload, repo);
const after = await repo.findById(payload.jobId);

console.log(JSON.stringify({
  payload,
  updatedResult: updated.result,
  afterResult: after?.result ?? null,
}, null, 2));