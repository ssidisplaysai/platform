const fs = require('fs');

function readEnv(name) {
  const line = fs.readFileSync('.env', 'utf8').split(/\r?\n/).find((entry) => entry.startsWith(name + '='));
  if (!line) {
    throw new Error('Missing ' + name);
  }
  return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
}

const workflowId = 'bIDXxyWnY22G8zJC';

function createQaPageSnapshotNode(credentials) {
  return {
    parameters: {
      method: 'GET',
      url: "=https://leddisplaywarehouse.com/wp-json/wp/v2/pages/{{ $('Normalize Published City Page').first().json.normalized_city_page_id }}?context=edit",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'wordpressApi',
      sendBody: false,
      options: {
        response: {
          response: {
            fullResponse: true,
            neverError: true,
            responseFormat: 'json',
          },
        },
      },
    },
    id: '7d7349a6-3bf3-47ad-9ecf-6d0d17af90d2',
    name: 'Fetch QA Page Snapshot',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.4,
    position: [6032, 0],
    credentials,
  };
}

function createQaStateSnapshotNode(credentials) {
  return {
    parameters: {
      method: 'GET',
      url: "=https://leddisplaywarehouse.com/wp-json/wp/v2/pages/{{ $('Prepare State Parent').first().json.state_parent_id }}?context=edit",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'wordpressApi',
      sendBody: false,
      options: {
        response: {
          response: {
            fullResponse: true,
            neverError: true,
            responseFormat: 'json',
          },
        },
      },
    },
    id: '2bcb6a09-8784-4bb6-b1cf-c3a76619e8f5',
    name: 'Fetch QA State Snapshot',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.4,
    position: [6288, 0],
    credentials,
  };
}

function createQaFeaturedMediaNode(credentials) {
  return {
    parameters: {
      method: 'GET',
      url: "=https://leddisplaywarehouse.com/wp-json/wp/v2/media/{{ $('Upload Image to WordPress').first().json.id || $('Fetch QA Page Snapshot').first().json.body?.featured_media || 0 }}?context=edit",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'wordpressApi',
      sendBody: false,
      options: {
        response: {
          response: {
            fullResponse: true,
            neverError: true,
            responseFormat: 'json',
          },
        },
      },
    },
    id: '959c3288-d0a5-4484-b389-d7449e895e6f',
    name: 'Fetch QA Featured Media',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.4,
    position: [6544, 0],
    credentials,
  };
}

function createQaDuplicateLookupNode(credentials) {
  return {
    parameters: {
      method: 'GET',
      url: "=https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug={{ $('Prepare State Parent').first().json.city_slug }}&parent={{ $('Prepare State Parent').first().json.state_parent_id }}&per_page=100&status=any&context=edit",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'wordpressApi',
      sendBody: false,
      options: {
        response: {
          response: {
            fullResponse: true,
            neverError: true,
            responseFormat: 'json',
          },
        },
      },
    },
    id: 'e49e7fd5-b408-4386-bcc9-12bd5325846b',
    name: 'QA Duplicate Lookup',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.4,
    position: [6800, 0],
    credentials,
  };
}

function createBuildQaResultNode() {
  const jsCode = String.raw`const normalized = $('Normalize Published City Page').first().json;
const source = $('Prepare State Parent').first().json;
const pageSource = $('Code in JavaScript').first().json;
const pageResponse = $('Fetch QA Page Snapshot').first().json || {};
const stateResponse = $('Fetch QA State Snapshot').first().json || {};
const mediaResponse = $('Fetch QA Featured Media').first().json || {};
const duplicateResponse = $('QA Duplicate Lookup').first().json || {};

function responseStatus(response) {
  return Number(response.statusCode || response.status || 0);
}

function responseBody(response) {
  return response && typeof response === 'object' && response.body !== undefined ? response.body : response;
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeText(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .trim();
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '');
}

function extractPathFromUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return normalizeSlug(url.pathname);
  } catch {
    return '';
  }
}

function countWords(value) {
  const text = stripTags(value);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function findYoastMetaContent(meta, key, prop = 'name') {
  if (!Array.isArray(meta)) {
    return '';
  }
  const match = meta.find((entry) => entry && typeof entry === 'object' && String(entry[prop] || '').toLowerCase() === key.toLowerCase());
  return match && typeof match.content === 'string' ? match.content.trim() : '';
}

function getFocusKeyword(page, sourceData) {
  const pageMeta = page && typeof page.meta === 'object' && page.meta !== null ? page.meta : {};
  const direct = typeof pageMeta._yoast_wpseo_focuskw === 'string' ? pageMeta._yoast_wpseo_focuskw.trim() : '';
  if (direct) {
    return direct;
  }
  const sourceKeyword = String(sourceData.focus_keyphrase || sourceData.primary_keyword || pageSource.focus_keyphrase || pageSource.primaryKeyword || '').trim();
  return sourceKeyword;
}

function getRenderedTitle(page) {
  if (page && page.title && typeof page.title === 'object') {
    return decodeText(page.title.rendered || page.title.raw || '');
  }
  return '';
}

function findHeroImageAttributes(html) {
  const heroMatch = String(html || '').match(/<figure[^>]*page-hero-image[^>]*>[\s\S]*?<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>|<figure[^>]*page-hero-image[^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/i);
  if (heroMatch) {
    const alt = heroMatch[1] || heroMatch[4] || '';
    const src = heroMatch[2] || heroMatch[3] || '';
    return { alt: decodeText(alt), src: String(src || '').trim(), found: true };
  }

  const imgMatch = String(html || '').match(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*>|<img[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/i);
  if (imgMatch) {
    const alt = imgMatch[1] || imgMatch[4] || '';
    const src = imgMatch[2] || imgMatch[3] || '';
    return { alt: decodeText(alt), src: String(src || '').trim(), found: true };
  }

  return { alt: '', src: '', found: false };
}

function countInternalLinks(html) {
  const links = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(String(html || ''))) !== null) {
    const href = String(match[1] || '').trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      continue;
    }
    if (href.startsWith('/')) {
      links.push(href);
      continue;
    }

    // Avoid URL constructor dependency in sandboxed runtimes.
    if (/^https?:\/\/(www\.)?leddisplaywarehouse\.com(\/|$)/i.test(href)) {
      links.push(href);
    }
  }
  return links.length;
}

function normalizeHeadingText(value) {
  return stripTags(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function duplicateHeadingNames(html) {
  const seen = new Set();
  const duplicates = new Set();
  const regex = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let match;
  while ((match = regex.exec(String(html || ''))) !== null) {
    const normalized = normalizeHeadingText(match[1]);
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      duplicates.add(normalized);
    } else {
      seen.add(normalized);
    }
  }

  return Array.from(duplicates.values());
}

function duplicateParagraphCount(html) {
  const counts = new Map();
  const regex = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = regex.exec(String(html || ''))) !== null) {
    const normalized = stripTags(match[1]).toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized.length < 80) {
      continue;
    }

    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  let duplicateCount = 0;
  for (const value of counts.values()) {
    if (value > 1) {
      duplicateCount += value - 1;
    }
  }

  return duplicateCount;
}

function placeholderResourceLabelCount(html) {
  const regex = /<a\b[^>]*>\s*Related\s+resource\s+\d+\s*<\/a>/gi;
  const matches = String(html || '').match(regex);
  return matches ? matches.length : 0;
}

function hasPlaceholder(text) {
  const patterns = [
    /lorem ipsum/i,
    /\bTODO\b/i,
    /coming soon/i,
    /image placeholder/i,
    /\btest\b/i,
    /\bsample\b/i,
    /\{\{/,
    /\}\}/,
  ];
  return patterns.some((pattern) => pattern.test(String(text || '')));
}

const checks = {
  pageExists: 'UNKNOWN',
  hierarchy: 'UNKNOWN',
  slug: 'UNKNOWN',
  title: 'UNKNOWN',
  h1: 'UNKNOWN',
  uniquePrimaryHeading: 'UNKNOWN',
  duplicateSectionHeadings: 'UNKNOWN',
  duplicateSectionContent: 'UNKNOWN',
  placeholderResourceLinks: 'UNKNOWN',
  body: 'UNKNOWN',
  featuredImage: 'UNKNOWN',
  heroImage: 'UNKNOWN',
  seo: 'UNKNOWN',
  internalLinks: 'UNKNOWN',
  imageAlt: 'UNKNOWN',
  duplicateCheck: 'UNKNOWN',
};
const failureReasons = {};

const pageStatus = responseStatus(pageResponse);
const stateStatus = responseStatus(stateResponse);
const mediaStatus = responseStatus(mediaResponse);
const duplicateStatus = responseStatus(duplicateResponse);
const page = responseBody(pageResponse) || {};
const statePage = responseBody(stateResponse) || {};
const media = responseBody(mediaResponse) || {};
const duplicateListRaw = responseBody(duplicateResponse);
const duplicateList = Array.isArray(duplicateListRaw) ? duplicateListRaw : [];

const pageId = Number(page.id || normalized.normalized_city_page_id || 0);
const pageUrl = String(page.link || normalized.normalized_city_page_url || '').trim();
const featuredImageUrl = String(media.source_url || $('Upload Image to WordPress').first().json.guid?.rendered || '').trim();
const renderedTitle = getRenderedTitle(page) || String(pageSource.page_title || '').trim();
const renderedContent = String(page.content && typeof page.content === 'object' ? page.content.rendered || page.content.raw || '' : '').trim();
const bodyText = stripTags(renderedContent);
const desiredHierarchicalSlug = normalizeSlug(source.desired_hierarchical_slug || pageSource.desired_hierarchical_slug || '');
const effectiveHierarchicalSlug = normalizeSlug([
  source.product_slug || '',
  source.state_slug || '',
  page.slug || source.city_slug || '',
].filter(Boolean).join('/'));
const h1Matches = String(renderedContent).match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || [];
const h1Text = h1Matches.length === 1 ? stripTags(h1Matches[0]) : '';
const heroImage = findHeroImageAttributes(renderedContent);
const internalLinkCount = countInternalLinks(renderedContent);
const duplicateHeadingList = duplicateHeadingNames(renderedContent);
const duplicateParagraphs = duplicateParagraphCount(renderedContent);
const placeholderResourceLinks = placeholderResourceLabelCount(renderedContent);
const metaTitle = String(page.yoast_title || page.yoast_head_json?.title || pageSource.seo_title || '').trim();
const metaDescription = findYoastMetaContent(page.yoast_meta, 'description') || String(page.yoast_head_json?.description || pageSource.meta_description || '').trim();
const focusKeyword = getFocusKeyword(page, source);
const stateParentId = Number(source.state_parent_id || 0);
const expectedProductParentId = Number(source.product_parent_id || 0);
const stateActualParentId = Number(statePage.parent || 0);
const forceQaFail = /QA_FORCE_FAIL/i.test(String(source.additional_instructions || pageSource.additional_instructions || pageSource.page_title || ''));

checks.pageExists = pageStatus >= 200 && pageStatus < 300 && pageId > 0 && pageUrl ? 'PASS' : 'FAIL';
if (checks.pageExists === 'FAIL') {
  failureReasons.pageExists = 'Missing published page snapshot. status=' + (pageStatus || 'UNKNOWN') + ' pageId=' + (pageId || 0) + ' url=' + (pageUrl || 'MISSING') + '.';
}

checks.hierarchy = checks.pageExists === 'PASS' && page.parent === stateParentId && stateStatus >= 200 && stateStatus < 300 && stateActualParentId === expectedProductParentId ? 'PASS' : 'FAIL';
if (checks.hierarchy === 'FAIL') {
  failureReasons.hierarchy = 'Hierarchy mismatch. cityParent=' + (page.parent || 0) + ' expectedState=' + stateParentId + '; stateParent=' + stateActualParentId + ' expectedProduct=' + expectedProductParentId + '.';
}

checks.slug = effectiveHierarchicalSlug && desiredHierarchicalSlug && effectiveHierarchicalSlug === desiredHierarchicalSlug ? 'PASS' : 'FAIL';
if (checks.slug === 'FAIL') {
  failureReasons.slug = 'Effective hierarchical slug ' + (effectiveHierarchicalSlug || 'MISSING') + ' does not match expected ' + (desiredHierarchicalSlug || 'MISSING') + '.';
}

checks.title = renderedTitle.length > 10 && !hasPlaceholder(renderedTitle) ? 'PASS' : 'FAIL';
if (checks.title === 'FAIL') {
  failureReasons.title = 'Title invalid. length=' + renderedTitle.length + '. placeholder=' + hasPlaceholder(renderedTitle) + '.';
}

checks.h1 = h1Matches.length === 1 && h1Text.length > 0 && !hasPlaceholder(h1Text) ? 'PASS' : 'FAIL';
if (checks.h1 === 'FAIL') {
  failureReasons.h1 = 'H1 invalid. count=' + h1Matches.length + ' textLength=' + h1Text.length + ' placeholder=' + hasPlaceholder(h1Text) + '.';
}

checks.uniquePrimaryHeading = h1Matches.length === 1 ? 'PASS' : 'FAIL';
if (checks.uniquePrimaryHeading === 'FAIL') {
  failureReasons.uniquePrimaryHeading = 'Expected exactly one primary heading (H1) but found ' + h1Matches.length + '.';
}

checks.duplicateSectionHeadings = duplicateHeadingList.length === 0 ? 'PASS' : 'FAIL';
if (checks.duplicateSectionHeadings === 'FAIL') {
  failureReasons.duplicateSectionHeadings = 'Duplicate section headings detected: ' + duplicateHeadingList.join(', ') + '.';
}

checks.duplicateSectionContent = duplicateParagraphs === 0 ? 'PASS' : 'FAIL';
if (checks.duplicateSectionContent === 'FAIL') {
  failureReasons.duplicateSectionContent = 'Duplicate section paragraph content detected. repeatedParagraphs=' + duplicateParagraphs + '.';
}

checks.placeholderResourceLinks = placeholderResourceLinks === 0 ? 'PASS' : 'FAIL';
if (checks.placeholderResourceLinks === 'FAIL') {
  failureReasons.placeholderResourceLinks = 'Placeholder related-resource labels detected. count=' + placeholderResourceLinks + '.';
}

checks.body = countWords(bodyText) >= 1200 && !hasPlaceholder(renderedContent) && !hasPlaceholder(bodyText) ? 'PASS' : 'FAIL';
if (checks.body === 'FAIL') {
  failureReasons.body = 'Body invalid. wordCount=' + countWords(bodyText) + ' placeholder=' + (hasPlaceholder(renderedContent) || hasPlaceholder(bodyText)) + '.';
}

checks.featuredImage = Number(page.featured_media || 0) > 0 && mediaStatus >= 200 && mediaStatus < 300 && Number(media.id || 0) > 0 ? 'PASS' : 'FAIL';
if (checks.featuredImage === 'FAIL') {
  failureReasons.featuredImage = 'Featured media missing. featured_media=' + (page.featured_media || 0) + ' mediaStatus=' + (mediaStatus || 'UNKNOWN') + ' mediaId=' + (media.id || 0) + '.';
}

checks.heroImage = heroImage.found ? 'PASS' : 'FAIL';
if (checks.heroImage === 'FAIL') {
  failureReasons.heroImage = 'No hero image found inside rendered page content.';
}

checks.seo = metaTitle.length > 0 && metaDescription.length > 0 && String(focusKeyword || '').trim().length > 0 ? 'PASS' : 'FAIL';
if (checks.seo === 'FAIL') {
  failureReasons.seo = 'SEO fields missing. metaTitle=' + (metaTitle ? 'yes' : 'no') + ' metaDescription=' + (metaDescription ? 'yes' : 'no') + ' focusKeyword=' + (focusKeyword ? 'yes' : 'no') + '.';
}

checks.internalLinks = internalLinkCount >= 3 ? 'PASS' : 'FAIL';
if (checks.internalLinks === 'FAIL') {
  failureReasons.internalLinks = 'Expected at least 3 internal links but found ' + internalLinkCount + '.';
}

checks.imageAlt = heroImage.found && heroImage.alt.length > 0 && !hasPlaceholder(heroImage.alt) ? 'PASS' : 'FAIL';
if (checks.imageAlt === 'FAIL') {
  failureReasons.imageAlt = 'Hero image ALT invalid. present=' + heroImage.found + ' altLength=' + heroImage.alt.length + ' placeholder=' + hasPlaceholder(heroImage.alt) + '.';
}

checks.duplicateCheck = duplicateStatus >= 200 && duplicateStatus < 300 && duplicateList.length === 1 && Number(duplicateList[0]?.id || 0) === pageId ? 'PASS' : 'FAIL';
if (checks.duplicateCheck === 'FAIL') {
  const duplicateIds = duplicateList.map((entry) => Number(entry?.id || 0)).filter((id) => id > 0);
  failureReasons.duplicateCheck = 'Duplicate lookup mismatch. status=' + (duplicateStatus || 'UNKNOWN') + ' ids=' + (duplicateIds.join(',') || 'NONE') + ' expected=' + (pageId || 0) + '.';
}

if (forceQaFail) {
  checks.body = 'FAIL';
  failureReasons.body = 'Forced QA failure requested by input token QA_FORCE_FAIL.';
}

const qaFailed = Object.values(checks).some((value) => value === 'FAIL');
const failureSummary = qaFailed
  ? Object.entries(failureReasons).map(([key, value]) => key + ': ' + value).join(' | ')
  : '';
const qaChecksJson = JSON.stringify(checks);
const qaFailureReasonsJson = JSON.stringify(failureReasons);
const sheetNotes = qaFailed
  ? 'QA FAILED. ' + failureSummary + ' qaChecks=' + qaChecksJson + ' qaFailureReasons=' + qaFailureReasonsJson
  : 'Page published automatically. Hero image inserted below H1. Media title, alt text, and description applied. Caption intentionally left blank. QA PASS. qaChecks=' + qaChecksJson;

return [{
  json: {
    ...source,
    ...normalized,
    qa_gate_passed: !qaFailed,
    qa_callback_status: qaFailed ? 'FAILED_QA' : 'COMPLETE',
    qa_disposition: qaFailed ? 'FAILED_QA' : (normalized.disposition || 'UPDATED'),
    qa_wordpress_status: qaFailed ? 'qa_failed' : (normalized.normalized_city_page_status || 'draft'),
    qa_checks: checks,
    qa_failure_reasons: failureReasons,
    qa_failure_summary: failureSummary || 'Pre-publish QA gate failed.',
    qa_checks_json: qaChecksJson,
    qa_failure_reasons_json: qaFailureReasonsJson,
    qa_title: renderedTitle || String(pageSource.page_title || source.page_title || '').trim(),
    qa_page_id: pageId,
    qa_wordpress_url: pageUrl,
    qa_featured_image_url: featuredImageUrl,
    qa_meta_title: metaTitle,
    qa_meta_description: metaDescription,
    qa_focus_keyword: focusKeyword,
    sheet_status: qaFailed ? 'QA Failed' : 'Published',
    sheet_published_date: qaFailed ? '' : new Date().toISOString(),
    sheet_notes: sheetNotes,
  }
}];`;

  return {
    parameters: { jsCode },
    id: '2303f30d-5228-4e01-9eeb-320d74fd3fbf',
    name: 'Build Pre-Publish QA Result',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [7056, 0],
  };
}

function createGlwSheetUpdateTargetNode() {
  return {
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
          version: 3,
        },
        conditions: [
          {
            leftValue: "={{ $('Build Pre-Publish QA Result').first().json.source_mode }}",
            operator: {
              type: 'string',
              operation: 'equals',
            },
            rightValue: 'glw',
          },
        ],
        combinator: 'and',
      },
      options: {},
    },
    id: '227f79e9-97a9-4be7-82ba-513ef890c58f',
    name: 'GLW Sheet Update Target?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position: [7312, 0],
  };
}

function createAppendGlwQaRowNode(templateNode, credentials) {
  const clonedParameters = JSON.parse(JSON.stringify(templateNode.parameters || {}));
  clonedParameters.operation = 'append';
  if (clonedParameters.columns && clonedParameters.columns.matchingColumns) {
    delete clonedParameters.columns.matchingColumns;
  }

  return {
    ...templateNode,
    parameters: clonedParameters,
    id: '10b66447-45c4-4894-b4e0-fbc5364952ce',
    name: 'Append GLW QA Sheet Row',
    position: [7568, -128],
    credentials,
  };
}

function rebuildSheetSchemaFromValue(node, { isUpdate }) {
  if (!node || !node.parameters || !node.parameters.columns || typeof node.parameters.columns.value !== 'object') {
    return;
  }

  const value = node.parameters.columns.value;
  const schema = Object.keys(value).map((key) => ({
    id: key,
    displayName: key,
    required: false,
    defaultMatch: false,
    display: true,
    type: key === 'row_number' ? 'number' : 'string',
    canBeUsedToMatch: true,
    ...(key === 'row_number' ? { readOnly: true } : {}),
  }));

  node.parameters.columns.mappingMode = 'defineBelow';
  node.parameters.columns.schema = schema;
  node.parameters.columns.attemptToConvertTypes = false;
  node.parameters.columns.convertFieldsToString = false;

  if (isUpdate) {
    node.parameters.columns.matchingColumns = ['row_number'];
  } else if (node.parameters.columns.matchingColumns) {
    delete node.parameters.columns.matchingColumns;
  }
}

function normalizeSheetColumnKeys(node) {
  if (!node || !node.parameters || !node.parameters.columns || typeof node.parameters.columns.value !== 'object') {
    return;
  }

  const value = node.parameters.columns.value;

  // Sheet header uses capitalized Status.
  value.Status = value.status || "={{ $('Build Pre-Publish QA Result').first().json.sheet_status }}";
  delete value.status;
}

function upsertNode(nodes, candidate) {
  const index = nodes.findIndex((node) => node.name === candidate.name);
  if (index >= 0) {
    nodes[index] = { ...nodes[index], ...candidate };
  } else {
    nodes.push(candidate);
  }
}

function setMainConnection(connections, sourceName, branches) {
  connections[sourceName] = { main: branches };
}

(async () => {
  const origin = new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey = readEnv('GLW_N8N_API_KEY');
  const headers = { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' };

  const workflowResponse = await fetch(`${origin}/api/v1/workflows/${workflowId}`, { headers });
  if (!workflowResponse.ok) {
    throw new Error(`Unable to fetch workflow: ${workflowResponse.status} ${await workflowResponse.text()}`);
  }
  const workflow = await workflowResponse.json();
  const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];
  const connections = workflow.connections || {};
  const setFeaturedImage = nodes.find((node) => node.name === 'Set Featured Image');
  const updateRowNode = nodes.find((node) => node.name === 'Update row in sheet');
  if (!setFeaturedImage || !setFeaturedImage.credentials || !setFeaturedImage.credentials.wordpressApi) {
    throw new Error('Set Featured Image node or wordpress credentials missing.');
  }
  if (!updateRowNode || !updateRowNode.credentials || !updateRowNode.credentials.googleSheetsOAuth2Api) {
    throw new Error('Update row in sheet node or google sheets credentials missing.');
  }

  const wordpressCredentials = { wordpressApi: setFeaturedImage.credentials.wordpressApi };
  const googleSheetsCredentials = { googleSheetsOAuth2Api: updateRowNode.credentials.googleSheetsOAuth2Api };
  upsertNode(nodes, createQaPageSnapshotNode(wordpressCredentials));
  upsertNode(nodes, createQaStateSnapshotNode(wordpressCredentials));
  upsertNode(nodes, createQaFeaturedMediaNode(wordpressCredentials));
  upsertNode(nodes, createQaDuplicateLookupNode(wordpressCredentials));
  upsertNode(nodes, createBuildQaResultNode());
  upsertNode(nodes, createGlwSheetUpdateTargetNode());
  upsertNode(nodes, createAppendGlwQaRowNode(updateRowNode, googleSheetsCredentials));

  if (!updateRowNode) {
    throw new Error('Update row in sheet node missing.');
  }
  updateRowNode.parameters.columns.value.status = "={{ $('Build Pre-Publish QA Result').first().json.sheet_status }}";
  updateRowNode.parameters.columns.value.live_url = "={{ $('Build Pre-Publish QA Result').first().json.qa_wordpress_url }}";
  updateRowNode.parameters.columns.value.page_id = "={{ $('Build Pre-Publish QA Result').first().json.qa_page_id }}";
  updateRowNode.parameters.columns.value.featured_image_url = "={{ $('Build Pre-Publish QA Result').first().json.qa_featured_image_url }}";
  updateRowNode.parameters.columns.value.published_date = "={{ $('Build Pre-Publish QA Result').first().json.sheet_published_date }}";
  updateRowNode.parameters.columns.value.notes = "={{ $('Build Pre-Publish QA Result').first().json.sheet_notes }}";
  normalizeSheetColumnKeys(updateRowNode);
  rebuildSheetSchemaFromValue(updateRowNode, { isUpdate: true });

  const appendNode = nodes.find((node) => node.name === 'Append GLW QA Sheet Row');
  if (appendNode) {
    normalizeSheetColumnKeys(appendNode);
    rebuildSheetSchemaFromValue(appendNode, { isUpdate: false });
  }

  const callbackNode = nodes.find((node) => node.name === 'Send GLW Completion Callback');
  if (!callbackNode) {
    throw new Error('Send GLW Completion Callback node missing.');
  }
  callbackNode.parameters.jsonBody = "={{ (() => { const qa = $('Build Pre-Publish QA Result').first().json; const callbackStatus = qa.qa_callback_status === 'FAILED_QA' ? 'FAILED' : qa.qa_callback_status; return { jobId: String(qa.job_id || qa.jobId || '').trim(), executionId: String($execution.id || '').trim(), status: callbackStatus, qaCallbackStatus: qa.qa_callback_status, title: qa.qa_title, wordpressUrl: qa.qa_wordpress_url, wordpressPostId: qa.qa_page_id, wordpressPageId: qa.qa_page_id, wordpressStatus: qa.qa_wordpress_status, requestedPublishingMode: $('Normalize Published City Page').first().json.requested_publishing_mode, disposition: qa.qa_disposition, qaChecks: qa.qa_checks, qaFailureReasons: qa.qa_failure_reasons, ...(qa.qa_callback_status === 'FAILED_QA' ? { error: { code: 'FAILED_QA', message: qa.qa_failure_summary, step: 'Pre-Publish QA Gate' } } : {}) }; })() }}";

  setMainConnection(connections, 'Set Featured Image', [[{ node: 'Fetch QA Page Snapshot', type: 'main', index: 0 }]]);
  setMainConnection(connections, 'Fetch QA Page Snapshot', [[{ node: 'Fetch QA State Snapshot', type: 'main', index: 0 }]]);
  setMainConnection(connections, 'Fetch QA State Snapshot', [[{ node: 'Fetch QA Featured Media', type: 'main', index: 0 }]]);
  setMainConnection(connections, 'Fetch QA Featured Media', [[{ node: 'QA Duplicate Lookup', type: 'main', index: 0 }]]);
  setMainConnection(connections, 'QA Duplicate Lookup', [[{ node: 'Build Pre-Publish QA Result', type: 'main', index: 0 }]]);
  setMainConnection(connections, 'Build Pre-Publish QA Result', [[{ node: 'GLW Sheet Update Target?', type: 'main', index: 0 }]]);
  setMainConnection(connections, 'GLW Sheet Update Target?', [
    [{ node: 'GLW Request?', type: 'main', index: 0 }],
    [{ node: 'Update row in sheet', type: 'main', index: 0 }],
  ]);
  setMainConnection(connections, 'Append GLW QA Sheet Row', [[{ node: 'GLW Request?', type: 'main', index: 0 }]]);
  setMainConnection(connections, 'Update row in sheet', [[{ node: 'GLW Request?', type: 'main', index: 0 }]]);
  setMainConnection(connections, 'GLW Request?', [
    [{ node: 'GLW Callback Configured?', type: 'main', index: 0 }],
    [{ node: 'GLW Complete Without Callback', type: 'main', index: 0 }],
  ]);

  const body = {
    name: workflow.name,
    nodes,
    connections,
    settings: workflow.settings || {},
  };

  const putResponse = await fetch(`${origin}/api/v1/workflows/${workflowId}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const putText = await putResponse.text();
  if (!putResponse.ok) {
    throw new Error(`Unable to update workflow: ${putResponse.status} ${putText}`);
  }

  const verifyResponse = await fetch(`${origin}/api/v1/workflows/${workflowId}`, { headers });
  const verifyWorkflow = await verifyResponse.json();
  const names = [
    'Fetch QA Page Snapshot',
    'Fetch QA State Snapshot',
    'Fetch QA Featured Media',
    'QA Duplicate Lookup',
    'Build Pre-Publish QA Result',
    'GLW Sheet Update Target?',
    'Append GLW QA Sheet Row',
    'Update row in sheet',
    'Send GLW Completion Callback',
  ];
  const summary = names.map((name) => {
    const node = (verifyWorkflow.nodes || []).find((entry) => entry.name === name);
    return { name, exists: Boolean(node), type: node?.type || null };
  });
  fs.writeFileSync('.tmp-prepublish-qa-patch-result.json', JSON.stringify({ workflowId, summary }, null, 2));
  console.log(JSON.stringify({ workflowId, summary }, null, 2));
})();
