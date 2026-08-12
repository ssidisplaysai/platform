import fs from "node:fs";

const data = JSON.parse(fs.readFileSync('.tmp-n8n-execution-65330.json', 'utf8'));
const runData = data?.data?.resultData?.runData ?? data?.resultData?.runData ?? data?.data?.runData ?? data?.runData ?? {};

function firstJson(nodeName: string) {
  const nodeRuns = runData?.[nodeName];
  if (!Array.isArray(nodeRuns) || nodeRuns.length === 0) return null;
  const firstRun = nodeRuns[0];
  if (!Array.isArray(firstRun) || firstRun.length === 0) return null;
  const item = firstRun[0];
  return item?.json ?? null;
}

function firstParam(nodeName: string) {
  const nodeRuns = runData?.[nodeName];
  if (!Array.isArray(nodeRuns) || nodeRuns.length === 0) return null;
  const firstRun = nodeRuns[0];
  if (!Array.isArray(firstRun) || firstRun.length === 0) return null;
  const item = firstRun[0];
  return item?.pairedItem ?? null;
}

const prepareHierarchy = firstJson('Prepare Hierarchy Fields');
const findExisting = firstJson('Find Existing City Page');
const normalizeLookup = firstJson('Normalize City Lookup Result');
const cityExists = firstJson('City Page Exists?');
const updatePage = firstJson('Update Existing City Page');
const wpResponse = firstJson('Normalize Published City Page');
const callback = firstJson('Send GLW Completion Callback');

const output = {
  executionId: data?.data?.id ?? data?.id,
  status: data?.data?.status ?? data?.status,
  plannerCandidate: null,
  glwJobWebhookPayload: firstJson('GLW Page Webhook'),
  prepareHierarchyFields: prepareHierarchy,
  findExistingCityPage: findExisting,
  normalizeCityLookupResult: normalizeLookup,
  cityPageExistsBranch: cityExists,
  updateExistingCityPage: updatePage,
  normalizedPublishedCityPage: wpResponse,
  completionCallbackPayload: callback,
};

fs.writeFileSync('.tmp-publish-trace-65330.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));