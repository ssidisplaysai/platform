const fs=require('fs');

function readEnv(name){
  const line=fs.readFileSync('.env','utf8').split(/\r?\n/).find((entry)=>entry.startsWith(name+'='));
  if(!line) throw new Error('Missing '+name);
  return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g,'');
}

function mustNode(nodes,name){
  const node=nodes.find((n)=>n.name===name);
  if(!node) throw new Error('Missing node: '+name);
  return node;
}

function patchGetRowsJs(code){
  let next=String(code||'');
  next=next.replace("return 'draft';","return isGlw ? 'publish' : 'draft';");
  return next;
}

function patchNormalizePublishedCityPageJs(code){
  const replacement = String.raw`const page = $input.first().json;
const source = $('Prepare State Parent').first().json;
const lookup = $('Normalize City Lookup Result').first().json;

const pageId = Number(page.id || lookup.existing_city_page_id || 0);
if (!pageId) {
  throw new Error('Missing city page ID after create/update branch.');
}

function normalizeMode(value, fallback) {
  const normalized = String(value || fallback || '').trim().toLowerCase();
  return normalized === 'publish' ? 'publish' : 'draft';
}

function normalizeHierarchicalPath(value) {
  return String(value || '')
    .trim()
    .split('/')
    .map((segment) => String(segment || '').trim())
    .filter(Boolean)
    .join('/')
    .toLowerCase();
}

function hasQueryPageId(urlString) {
  try {
    const url = new URL(String(urlString || ''));
    return url.searchParams.has('page_id');
  } catch {
    return false;
  }
}

function canonicalFromSlug(urlString, hierarchicalSlug) {
  const normalizedPath = normalizeHierarchicalPath(hierarchicalSlug);
  if (!normalizedPath) {
    return '';
  }

  try {
    const url = new URL(String(urlString || ''));
    return url.origin + '/' + normalizedPath + '/';
  } catch {
    return '';
  }
}

const pageStatus = normalizeMode(page.status || lookup.existing_city_page_status, source.publishing_mode || 'draft');
const requestedMode = normalizeMode(source.publishing_mode || 'draft', 'draft');
const disposition = lookup.city_page_found ? 'UPDATED' : 'CREATED';

const hierarchicalSlug = source.slug || source.desired_hierarchical_slug || [source.product_slug, source.state_slug, source.city_slug].filter(Boolean).join('/');
const rawPageUrl = String(page.link || lookup.existing_city_page_url || '').trim();
const canonicalFromResponse = pageStatus === 'publish' && hasQueryPageId(rawPageUrl)
  ? canonicalFromSlug(rawPageUrl, hierarchicalSlug)
  : '';
const pageUrl = canonicalFromResponse || rawPageUrl;

return [{
  json: {
    ...source,
    ...lookup,
    normalized_city_page_id: pageId,
    normalized_city_page_url: pageUrl,
    normalized_city_page_status: pageStatus,
    requested_publishing_mode: requestedMode,
    disposition
  }
}];`;

  const marker = "const page = $input.first().json;";
  if (String(code||'').includes(marker)) {
    return replacement;
  }

  return code;
}

function removeConnection(connections, fromNode, toNode){
  if(!connections[fromNode] || !Array.isArray(connections[fromNode].main)) return false;
  let changed=false;
  connections[fromNode].main = connections[fromNode].main.map((branch)=>{
    if(!Array.isArray(branch)) return branch;
    const filtered = branch.filter((edge)=>edge && edge.node!==toNode);
    if(filtered.length!==branch.length) changed=true;
    return filtered;
  });
  return changed;
}

function ensureCallbackAuthorizationHeader(node, secret) {
  const parameters = node.parameters || {};
  const headerParameters = parameters.headerParameters && typeof parameters.headerParameters === 'object'
    ? parameters.headerParameters
    : { parameters: [] };

  const existing = Array.isArray(headerParameters.parameters)
    ? headerParameters.parameters
    : [];

  const authHeader = existing.find((entry) => entry && String(entry.name || '').toLowerCase() === 'authorization');
  const token = String(secret || '').trim();
  const authValue = token ? `Bearer ${token}` : 'Bearer';

  if (authHeader) {
    authHeader.value = authValue;
  } else {
    existing.push({ name: 'Authorization', value: authValue });
  }

  headerParameters.parameters = existing;
  parameters.headerParameters = headerParameters;
  node.parameters = parameters;
}

(async()=>{
  const workflowId='bIDXxyWnY22G8zJC';
  const origin=new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey=readEnv('GLW_N8N_API_KEY');
  const callbackSecret=readEnv('GLW_N8N_WEBHOOK_SECRET');
  const headers={ 'X-N8N-API-KEY': apiKey, Accept:'application/json' };

  const wfRes=await fetch(`${origin}/api/v1/workflows/${workflowId}`,{headers});
  if(!wfRes.ok) throw new Error('fetch workflow failed '+wfRes.status+' '+await wfRes.text());
  const wf=await wfRes.json();

  const nodes=Array.isArray(wf.nodes)?wf.nodes:[];
  const connections=wf.connections||{};

  const getRows = mustNode(nodes,'Get row(s) in sheet');
  const normalizePage = mustNode(nodes,'Normalize Published City Page');
  const completionCallback = mustNode(nodes,'Send GLW Completion Callback');
  const failureCallback = mustNode(nodes,'Send GLW Failure Callback');

  getRows.parameters = getRows.parameters || {};
  normalizePage.parameters = normalizePage.parameters || {};

  const beforeGetRows = String(getRows.parameters.jsCode||'');
  const beforeNormalize = String(normalizePage.parameters.jsCode||'');

  getRows.parameters.jsCode = patchGetRowsJs(beforeGetRows);
  normalizePage.parameters.jsCode = patchNormalizePublishedCityPageJs(beforeNormalize);
  ensureCallbackAuthorizationHeader(completionCallback, callbackSecret);
  ensureCallbackAuthorizationHeader(failureCallback, callbackSecret);

  const removedSchedule = removeConnection(connections,'Schedule Trigger','Sheet Queue Rows');
  const removedManual = removeConnection(connections,'When clicking �Execute workflow�','Sheet Queue Rows');

  const body={
    name: wf.name,
    nodes,
    connections,
    settings: wf.settings || {},
  };

  const put=await fetch(`${origin}/api/v1/workflows/${workflowId}`,{
    method:'PUT',
    headers:{...headers,'Content-Type':'application/json'},
    body: JSON.stringify(body),
  });
  const putText=await put.text();
  if(!put.ok) throw new Error('update workflow failed '+put.status+' '+putText);

  const summary={
    workflowId,
    workflowName:wf.name,
    getRowsChanged: beforeGetRows!==String(getRows.parameters.jsCode||''),
    normalizePageChanged: beforeNormalize!==String(normalizePage.parameters.jsCode||''),
    completionCallbackAuthAdded: completionCallback.parameters?.headerParameters?.parameters?.some((entry)=>String(entry.name||'').toLowerCase()==='authorization'),
    failureCallbackAuthAdded: failureCallback.parameters?.headerParameters?.parameters?.some((entry)=>String(entry.name||'').toLowerCase()==='authorization'),
    removedScheduleConnection: removedSchedule,
    removedManualConnection: removedManual,
  };

  fs.writeFileSync('.tmp-glw-production-freeze-workflow-patch.json', JSON.stringify(summary,null,2));
  console.log(JSON.stringify(summary,null,2));
})();