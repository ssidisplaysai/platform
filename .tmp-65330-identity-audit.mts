import fs from "node:fs";

const data = JSON.parse(fs.readFileSync('.tmp-n8n-execution-65330.json','utf8'));
const runData = data?.data?.resultData?.runData ?? {};

function firstNodeJson(name) {
  const node = runData?.[name]?.[0]?.data?.main?.[0]?.[0]?.json;
  return node ?? null;
}

const webhook = firstNodeJson('GLW Page Webhook');
const normalized = firstNodeJson('Get row(s) in sheet');
const prepared = firstNodeJson('Prepare Hierarchy Fields');

const out = {
  executionId: data?.data?.id ?? data?.id,
  incomingIdentity: {
    page_city: webhook?.body?.page?.city,
    page_citySlug: webhook?.body?.page?.citySlug,
    page_city_slug: webhook?.body?.page?.city_slug,
    page_targetSlug: webhook?.body?.page?.targetSlug,
    page_slug: webhook?.body?.page?.slug,
    page_hierarchicalSlug: webhook?.body?.page?.hierarchicalSlug,
    page_hierarchical_slug: webhook?.body?.page?.hierarchical_slug,
    workflowContext_city: webhook?.body?.workflowContext?.city,
    workflowContext_citySlug: webhook?.body?.workflowContext?.citySlug,
    workflowContext_hierarchicalSlug: webhook?.body?.workflowContext?.hierarchicalSlug,
    seoSettings_citySlug: webhook?.body?.seoSettings?.citySlug,
    seoSettings_targetSlug: webhook?.body?.seoSettings?.targetSlug,
  },
  normalizedEnteringPrepareHierarchy: {
    city: normalized?.city,
    city_slug: normalized?.city_slug,
    slug: normalized?.slug,
    product_slug: prepared?.product_slug,
    state_slug: prepared?.state_slug,
    hierarchical_slug: prepared?.hierarchical_slug,
  },
  prepareHierarchyKeyOutputs: {
    product_slug: prepared?.product_slug,
    state_slug: prepared?.state_slug,
    city_slug: prepared?.city_slug,
    desired_hierarchical_slug: prepared?.desired_hierarchical_slug,
  }
};

fs.writeFileSync('.tmp-65330-identity-audit.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));