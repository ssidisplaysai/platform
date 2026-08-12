import fs from "node:fs";

const apiKey = process.env.GLW_N8N_API_KEY?.trim();
const webhookUrl = process.env.GLW_N8N_PAGE_WEBHOOK_URL?.trim();
if (!apiKey || !webhookUrl) throw new Error('Missing n8n env');
const origin = new URL(webhookUrl).origin;
const executionId = '65353';

const res = await fetch(`${origin}/api/v1/executions/${executionId}?includeData=true`, {
  headers: { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' },
});
const txt = await res.text();
if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt.slice(0,400)}`);
const json = JSON.parse(txt);
fs.writeFileSync('.tmp-n8n-execution-65353.json', JSON.stringify(json, null, 2));

const rd = json?.data?.resultData?.runData ?? {};
const get = (name) => rd?.[name]?.[0]?.data?.main ?? null;
const first = (name) => rd?.[name]?.[0]?.data?.main?.[0]?.[0]?.json ?? null;

const out = {
  executionId,
  webhook: first('GLW Page Webhook'),
  getRows: first('Get row(s) in sheet'),
  prepareHierarchy: first('Prepare Hierarchy Fields'),
  findExistingCityPageMain: get('Find Existing City Page'),
  normalizeLookup: first('Normalize City Lookup Result'),
  cityPageExistsMain: get('City Page Exists?'),
  createPost: first('Create a post'),
  updateExisting: first('Update Existing City Page'),
  normalizePublished: first('Normalize Published City Page'),
  qaResult: first('Build Pre-Publish QA Result'),
  callbackNodeOutput: first('Send GLW Completion Callback'),
};
fs.writeFileSync('.tmp-65353-trace.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({
  executionId,
  foundExistingCityPage: !!(out.normalizeLookup?.city_page_found),
  existingCityPageId: out.normalizeLookup?.existing_city_page_id ?? null,
  createdPageId: out.createPost?.id ?? null,
  updatedPageId: out.updateExisting?.id ?? null,
  normalizedPageUrl: out.normalizePublished?.normalized_city_page_url ?? null,
  disposition: out.qaResult?.qa_disposition ?? null,
  wordpressStatus: out.qaResult?.qa_wordpress_status ?? null,
  requestedPublishingMode: out.normalizePublished?.requested_publishing_mode ?? null,
  qaChecksKeys: out.qaResult?.qa_checks ? Object.keys(out.qaResult.qa_checks) : [],
  callbackResultKeys: out.callbackNodeOutput?.job?.result ? Object.keys(out.callbackNodeOutput.job.result) : []
}, null, 2));