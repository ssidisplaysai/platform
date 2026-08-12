const fs = require('fs');

function readEnv(name) {
  const line = fs.readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='));
  if (!line) throw new Error('Missing ' + name);
  return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
}

const WEBHOOK_URL = readEnv('GLW_N8N_PAGE_WEBHOOK_URL');
const SECRET = readEnv('GLW_N8N_WEBHOOK_SECRET');
const ORIGIN = new URL(WEBHOOK_URL).origin;
const API_KEY = readEnv('GLW_N8N_API_KEY');
const N8N_HEADERS = { 'X-N8N-API-KEY': API_KEY, Accept: 'application/json' };

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function getJsonOrNull(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const text = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(text), raw: null };
  } catch {
    return { ok: false, status: res.status, data: null, raw: text.slice(0, 400) };
  }
}

async function triggerGlw({ product, state, city, mode = 'draft' }) {
  const now = Date.now();
  const citySlug = city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const stateSlug = state.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const productSlug = product.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const payload = {
    jobId: `glw-dup-val-${citySlug}-${now}`,
    type: 'page_generation',
    workspaceId: 'glw-led-display-warehouse',
    workspace_id: 'glw-led-display-warehouse',
    site: { id: 'led-display-warehouse', name: 'LED Display Warehouse' },
    page: {
      pageType: 'city_service', page_type: 'city_service',
      productTopic: product, product_topic: product,
      product, category: product,
      state, city, citySlug, city_slug: citySlug,
      hierarchicalSlug: `${productSlug}/${stateSlug}/${citySlug}`,
      hierarchical_slug: `${productSlug}/${stateSlug}/${citySlug}`,
      additionalInstructions: 'Controlled duplicate-protection validation run.',
      additional_instructions: 'Controlled duplicate-protection validation run.',
      title: `${product} in ${city}, ${state} (Validation)`,
      targetSlug: `dup-validation-${citySlug}`,
      primaryKeyword: `${product.toLowerCase()} ${city.toLowerCase()}`,
      secondaryKeywords: ['duplicate protection validation', 'canonical parent scoped lookup'],
      wordCount: 900, tone: 'Professional', audience: 'Internal QA', callToAction: 'Validation only.',
      status: mode, publishingMode: mode
    },
    promptData: { tone: 'Professional', audience: 'Internal QA', callToAction: 'Validation only.' },
    seoSettings: {
      targetSlug: `dup-validation-${citySlug}`, citySlug, city_slug: citySlug,
      primaryKeyword: `${product.toLowerCase()} ${city.toLowerCase()}`,
      secondaryKeywords: ['duplicate protection validation'], category: product
    },
    publishingSettings: { status: mode, wordCount: 900 },
    imageSettings: { generateFeaturedImage: true, style: 'editorial' },
    workflowContext: {
      workspaceId: 'glw-led-display-warehouse', pageType: 'city_service', productTopic: product,
      state, city, citySlug, hierarchicalSlug: `${productSlug}/${stateSlug}/${citySlug}`,
      additionalInstructions: 'Controlled duplicate-protection validation run.'
    },
    callbackUrl: 'https://app.ssiai.app/api/glw/jobs/callback',
    authToken: SECRET
  };

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SECRET}` }, body: JSON.stringify(payload)
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(`Webhook trigger failed (${res.status}): ${text}`);
  const executionId = String(body.executionId || body.id || '').trim();
  if (!executionId) throw new Error('Webhook response missing executionId: ' + text);
  return { executionId, city, product };
}

async function waitForExecution(executionId, timeoutMs = 12 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const statusRes = await fetch(`${ORIGIN}/api/v1/executions/${executionId}`, { headers: N8N_HEADERS });
    const txt = await statusRes.text();
    if (!statusRes.ok) throw new Error(`Execution status fetch failed ${statusRes.status}: ${txt.slice(0,200)}`);
    const status = JSON.parse(txt);
    if (status.finished) return status;
    await sleep(4000);
  }
  throw new Error(`Execution ${executionId} timed out`);
}

async function fetchExecutionData(executionId) {
  const res = await fetch(`${ORIGIN}/api/v1/executions/${executionId}?includeData=true`, { headers: N8N_HEADERS });
  const text = await res.text();
  if (!res.ok) throw new Error(`Execution data fetch failed ${res.status}: ${text.slice(0,200)}`);
  return JSON.parse(text);
}

function firstNodeItem(exec, nodeName) {
  const nodeRuns = exec?.data?.resultData?.runData?.[nodeName];
  if (!Array.isArray(nodeRuns) || nodeRuns.length === 0) return null;
  const main = nodeRuns[0]?.data?.main;
  if (!Array.isArray(main) || !Array.isArray(main[0]) || !main[0][0]) return null;
  return main[0][0].json ?? null;
}

function nodeExecuted(exec, nodeName) {
  return Array.isArray(exec?.data?.resultData?.runData?.[nodeName]) && exec.data.resultData.runData[nodeName].length > 0;
}

function extractSummary(exec, label) {
  const lookup = firstNodeItem(exec, 'Normalize City Lookup Result');
  const normalized = firstNodeItem(exec, 'Normalize Published City Page');
  const setFeatured = firstNodeItem(exec, 'Set Featured Image');
  const callbackResp = firstNodeItem(exec, 'Send GLW Completion Callback');
  return {
    label,
    executionId: String(exec.id),
    workflowStatus: exec.status,
    createExecuted: nodeExecuted(exec, 'Create a post'),
    updateExecuted: nodeExecuted(exec, 'Update Existing City Page'),
    lookup,
    normalized,
    wordpressUrl: setFeatured?.link || normalized?.normalized_city_page_url || null,
    callbackResponse: callbackResp || null,
    runNodes: Object.keys(exec?.data?.resultData?.runData || {})
  };
}

async function getPageByScopedSlug(productSlug, stateSlug, citySlug) {
  const productResp = await getJsonOrNull(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${encodeURIComponent(productSlug)}&per_page=1`);
  if (!productResp.data || !Array.isArray(productResp.data)) {
    return { productId: 0, stateId: 0, cityId: 0, cityUrl: null, error: { stage: 'product', status: productResp.status, raw: productResp.raw } };
  }
  const productId = productResp.data[0]?.id ? Number(productResp.data[0].id) : 0;
  if (!productId) return { productId: 0, stateId: 0, cityId: 0, cityUrl: null };

  const stateResp = await getJsonOrNull(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${encodeURIComponent(stateSlug)}&parent=${productId}&per_page=1`);
  if (!stateResp.data || !Array.isArray(stateResp.data)) {
    return { productId, stateId: 0, cityId: 0, cityUrl: null, error: { stage: 'state', status: stateResp.status, raw: stateResp.raw } };
  }
  const stateId = stateResp.data[0]?.id ? Number(stateResp.data[0].id) : 0;
  if (!stateId) return { productId, stateId: 0, cityId: 0, cityUrl: null };

  const cityResp = await getJsonOrNull(`https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug=${encodeURIComponent(citySlug)}&parent=${stateId}&per_page=1`);
  if (!cityResp.data || !Array.isArray(cityResp.data)) {
    return { productId, stateId, cityId: 0, cityUrl: null, error: { stage: 'city', status: cityResp.status, raw: cityResp.raw } };
  }
  const city = cityResp.data[0] || null;
  return { productId, stateId, cityId: city?.id ? Number(city.id) : 0, cityUrl: city?.link || null };
}

(async () => {
  const out = {};
  const beforeHouston = await getPageByScopedSlug('direct-view-led-video-walls', 'texas', 'houston');
  out.beforeHouston = beforeHouston;
  if (!beforeHouston.cityId) throw new Error('Houston canonical page not found: ' + JSON.stringify(beforeHouston.error || {}));

  const r1 = await triggerGlw({ product: 'Direct View LED Video Walls', state: 'Texas', city: 'Houston', mode: 'draft' });
  await waitForExecution(r1.executionId);
  out.houstonRun1 = extractSummary(await fetchExecutionData(r1.executionId), 'Houston run #1');
  out.afterHouston1 = await getPageByScopedSlug('direct-view-led-video-walls', 'texas', 'houston');

  const r2 = await triggerGlw({ product: 'Direct View LED Video Walls', state: 'Texas', city: 'Houston', mode: 'draft' });
  await waitForExecution(r2.executionId);
  out.houstonRun2 = extractSummary(await fetchExecutionData(r2.executionId), 'Houston run #2');
  out.afterHouston2 = await getPageByScopedSlug('direct-view-led-video-walls', 'texas', 'houston');

  const cands = [`qa-dup-val-${Date.now()}`, `qa-dup-val-${Date.now()+1}`, `qa-dup-val-${Date.now()+2}`];
  let city = null;
  for (const c of cands) {
    const check = await getPageByScopedSlug('direct-view-led-video-walls', 'texas', c);
    if (!check.cityId && !check.error) { city = c; break; }
  }
  if (!city) throw new Error('No clean absent city candidate found');
  out.newCityChosen = city;
  out.beforeNewCity = await getPageByScopedSlug('direct-view-led-video-walls', 'texas', city);

  const r3 = await triggerGlw({ product: 'Direct View LED Video Walls', state: 'Texas', city, mode: 'draft' });
  await waitForExecution(r3.executionId);
  out.newCityRun = extractSummary(await fetchExecutionData(r3.executionId), 'New city run');
  out.afterNewCity = await getPageByScopedSlug('direct-view-led-video-walls', 'texas', city);

  out.crossProductLookup = await getPageByScopedSlug('outdoor-led-displays', 'texas', 'houston');
  out.generatedAt = new Date().toISOString();

  fs.writeFileSync('.tmp-duplicate-controlled-validation-results.json', JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ saved: '.tmp-duplicate-controlled-validation-results.json', executions: [out.houstonRun1.executionId, out.houstonRun2.executionId, out.newCityRun.executionId], newCity: city }, null, 2));
})();