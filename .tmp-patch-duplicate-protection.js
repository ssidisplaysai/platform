const fs = require('fs');

function readEnv(name) {
  const line = fs.readFileSync('.env', 'utf8').split(/\r?\n/).find((l) => l.startsWith(name + '='));
  if (!line) throw new Error('Missing ' + name);
  return line.split('=').slice(1).join('=').trim().replace(/^"|"$/g, '');
}

function byName(nodes, name) {
  const node = (nodes || []).find((n) => n.name === name);
  if (!node) throw new Error('Missing node: ' + name);
  return node;
}

function setMainConnection(connections, sourceName, branchIndex, targets) {
  if (!connections[sourceName]) connections[sourceName] = {};
  if (!connections[sourceName].main) connections[sourceName].main = [];
  while (connections[sourceName].main.length <= branchIndex) {
    connections[sourceName].main.push([]);
  }
  connections[sourceName].main[branchIndex] = targets.map((name) => ({ node: name, type: 'main', index: 0 }));
}

function upsertNode(nodes, node) {
  const index = nodes.findIndex((n) => n.name === node.name);
  if (index >= 0) {
    nodes[index] = { ...nodes[index], ...node, id: nodes[index].id };
    return nodes[index];
  }
  nodes.push(node);
  return node;
}

(async () => {
  const origin = new URL(readEnv('GLW_N8N_PAGE_WEBHOOK_URL')).origin;
  const apiKey = readEnv('GLW_N8N_API_KEY');
  const wfId = 'bIDXxyWnY22G8zJC';
  const headers = { 'X-N8N-API-KEY': apiKey, Accept: 'application/json' };

  const wfRes = await fetch(`${origin}/api/v1/workflows/${wfId}`, { headers });
  if (!wfRes.ok) throw new Error(`Fetch workflow failed: ${wfRes.status} ${await wfRes.text()}`);
  const wf = await wfRes.json();

  fs.writeFileSync('.tmp-live-workflow-before-duplicate-patch.json', JSON.stringify(wf, null, 2));

  const nodes = wf.nodes || [];
  const connections = wf.connections || {};

  const wpCred = byName(nodes, 'Create a post').credentials || byName(nodes, 'Find State Parent').credentials;

  upsertNode(nodes, {
    id: 'd6a995ec-bd7f-43f2-b56b-duplicate-city-lookup',
    name: 'Find Existing City Page',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.4,
    position: [3600, -208],
    parameters: {
      method: 'GET',
      url: "=https://leddisplaywarehouse.com/wp-json/wp/v2/pages?slug={{ $('Prepare State Parent').first().json.city_slug }}&parent={{ $('Prepare State Parent').first().json.state_parent_id }}&per_page=1",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'wordpressApi',
      sendBody: false,
      options: {
        response: {
          response: {
            fullResponse: true,
            neverError: true,
            responseFormat: 'json'
          }
        }
      }
    },
    credentials: wpCred
  });

  upsertNode(nodes, {
    id: 'ec7eb79c-0328-4b48-96b5-normalize-city-lookup',
    name: 'Normalize City Lookup Result',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [3856, -208],
    parameters: {
      jsCode: "const response = $input.first().json;\nconst source = $('Prepare State Parent').first().json;\n\nconst statusCode = Number(response.statusCode || response.status || 0);\nconst body = response.body;\n\nif (!Number.isFinite(statusCode) || statusCode < 200 || statusCode >= 300) {\n  return [{\n    json: {\n      ...source,\n      city_lookup_failed: true,\n      city_page_found: false,\n      existing_city_page_id: 0,\n      existing_city_page_url: '',\n      existing_city_page_status: '',\n      existing_city_page_slug: source.city_slug || '',\n      valid: false,\n      validation_error_code: 'CITY_LOOKUP_FAILED',\n      validation_error_message: `City lookup failed with status ${statusCode || 'UNKNOWN'} for slug=${source.city_slug || ''} parent=${source.state_parent_id || ''}.`,\n      validation_error_node: 'Find Existing City Page'\n    }\n  }];\n}\n\nlet list = [];\nif (Array.isArray(body)) {\n  list = body;\n} else if (Array.isArray(response.data)) {\n  list = response.data;\n} else if (Array.isArray(response)) {\n  list = response;\n} else if (body && typeof body === 'object' && body.id) {\n  list = [body];\n} else if (response && typeof response === 'object' && response.id) {\n  list = [response];\n}\n\nconst cityPage = list.find((p) => p && p.id) || {};\nconst id = Number(cityPage.id || 0);\n\nreturn [{\n  json: {\n    ...source,\n    city_lookup_failed: false,\n    city_page_found: id > 0,\n    existing_city_page_id: id,\n    existing_city_page_url: cityPage.link || '',\n    existing_city_page_status: cityPage.status || '',\n    existing_city_page_slug: cityPage.slug || source.city_slug || ''\n  }\n}];"
    }
  });

  upsertNode(nodes, {
    id: '7d6dcfed-b61d-4ebf-98f7-city-lookup-success',
    name: 'City Lookup Successful?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position: [4112, -208],
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
          version: 3
        },
        conditions: [
          {
            leftValue: '={{ !$json.city_lookup_failed }}',
            operator: {
              type: 'boolean',
              operation: 'true',
              singleValue: true
            }
          }
        ],
        combinator: 'and'
      },
      options: {}
    }
  });

  upsertNode(nodes, {
    id: '2478e208-b6ab-450e-b5d0-city-page-exists',
    name: 'City Page Exists?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position: [4368, -208],
    parameters: {
      conditions: {
        options: {
          caseSensitive: true,
          leftValue: '',
          typeValidation: 'strict',
          version: 3
        },
        conditions: [
          {
            leftValue: '={{ $json.existing_city_page_id }}',
            operator: {
              type: 'number',
              operation: 'larger'
            },
            rightValue: 0
          }
        ],
        combinator: 'and'
      },
      options: {}
    }
  });

  upsertNode(nodes, {
    id: '9dd9eb1f-4a30-4d11-93c8-update-existing-city-page',
    name: 'Update Existing City Page',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.4,
    position: [4624, -320],
    parameters: {
      method: 'POST',
      url: "=https://leddisplaywarehouse.com/wp-json/wp/v2/pages/{{ $('Normalize City Lookup Result').first().json.existing_city_page_id }}",
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'wordpressApi',
      sendBody: true,
      bodyParameters: {
        parameters: [
          { name: 'title', value: "={{ $('Code in JavaScript').first().json.post_title }}" },
          { name: 'content', value: "={{ $('Code in JavaScript').first().json.article_html }}" },
          { name: 'slug', value: "={{ $('Normalize City Lookup Result').first().json.existing_city_page_slug || $('Prepare State Parent').first().json.city_slug }}" },
          { name: 'parent', value: "={{ $('Prepare State Parent').first().json.state_parent_id }}" },
          { name: 'status', value: "={{ $('Prepare State Parent').first().json.publishing_mode === 'publish' ? 'publish' : 'draft' }}" },
          { name: 'excerpt', value: "={{ $('Code in JavaScript').first().json.excerpt }}" }
        ]
      },
      options: {}
    },
    credentials: wpCred
  });

  upsertNode(nodes, {
    id: 'f1189ece-5d79-46ff-96be-normalize-published-page',
    name: 'Normalize Published City Page',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [4880, -160],
    parameters: {
      jsCode: "const page = $input.first().json;\nconst source = $('Prepare State Parent').first().json;\nconst lookup = $('Normalize City Lookup Result').first().json;\n\nconst pageId = Number(page.id || lookup.existing_city_page_id || 0);\nif (!pageId) {\n  throw new Error('Missing city page ID after create/update branch.');\n}\n\nconst pageUrl = String(page.link || lookup.existing_city_page_url || '');\nconst pageStatus = String(page.status || source.publishing_mode || 'draft').toLowerCase() === 'publish' ? 'publish' : 'draft';\nconst requestedMode = String(source.publishing_mode || 'draft').toLowerCase() === 'publish' ? 'publish' : 'draft';\nconst disposition = lookup.city_page_found ? 'UPDATED' : 'CREATED';\n\nreturn [{\n  json: {\n    ...source,\n    ...lookup,\n    normalized_city_page_id: pageId,\n    normalized_city_page_url: pageUrl,\n    normalized_city_page_status: pageStatus,\n    requested_publishing_mode: requestedMode,\n    disposition\n  }\n}];"
    }
  });

  byName(nodes, 'Update Yoast SEO').parameters.bodyParameters.parameters = [
    {
      name: 'post_id',
      value: "={{ $('Normalize Published City Page').first().json.normalized_city_page_id }}"
    },
    {
      name: 'metadesc',
      value: "=\n{{ $('Code in JavaScript').first().json.meta_description }}"
    },
    {
      name: 'title',
      value: "={{ $('Code in JavaScript').first().json.seo_title }}"
    },
    {
      name: 'focuskw',
      value: "={{ $('Code in JavaScript').first().json.focus_keyphrase }}"
    }
  ];

  const prepareImage = byName(nodes, 'Prepare Image Fields');
  const postIdAssignment = prepareImage.parameters.assignments.assignments.find((a) => a.name === 'post_id');
  if (!postIdAssignment) throw new Error('Prepare Image Fields missing post_id assignment');
  postIdAssignment.value = "={{ $('Normalize Published City Page').item.json.normalized_city_page_id }}";

  byName(nodes, 'Set Featured Image').parameters.url = "=https://leddisplaywarehouse.com/wp-json/wp/v2/pages/{{ $('Normalize Published City Page').first().json.normalized_city_page_id }}";
  byName(nodes, 'Insert Image Into Page').parameters.url = "=https://leddisplaywarehouse.com/wp-json/wp/v2/pages/{{ $('Normalize Published City Page').first().json.normalized_city_page_id }}";

  const updateSheet = byName(nodes, 'Update row in sheet');
  updateSheet.parameters.columns.value.page_id = "={{ $('Normalize Published City Page').item.json.normalized_city_page_id }}";

  const complete = byName(nodes, 'Send GLW Completion Callback');
  complete.parameters.jsonBody = "={{ { jobId: $('Get row(s) in sheet').first().json.job_id, executionId: $execution.id, status: 'COMPLETE', title: $('Code in JavaScript').first().json.page_title, wordpressUrl: $('Set Featured Image').first().json.link || $('Normalize Published City Page').first().json.normalized_city_page_url, wordpressPostId: $('Normalize Published City Page').first().json.normalized_city_page_id, wordpressStatus: $('Normalize Published City Page').first().json.normalized_city_page_status, requestedPublishingMode: $('Normalize Published City Page').first().json.requested_publishing_mode, disposition: $('Normalize Published City Page').first().json.disposition } }}";

  setMainConnection(connections, 'Validation Passed?', 0, ['Find Existing City Page']);
  setMainConnection(connections, 'Find Existing City Page', 0, ['Normalize City Lookup Result']);
  setMainConnection(connections, 'Normalize City Lookup Result', 0, ['City Lookup Successful?']);
  setMainConnection(connections, 'City Lookup Successful?', 0, ['City Page Exists?']);
  setMainConnection(connections, 'City Lookup Successful?', 1, ['Send GLW Failure Callback']);
  setMainConnection(connections, 'City Page Exists?', 0, ['Update Existing City Page']);
  setMainConnection(connections, 'City Page Exists?', 1, ['Create a post']);
  setMainConnection(connections, 'Create a post', 0, ['Normalize Published City Page']);
  setMainConnection(connections, 'Update Existing City Page', 0, ['Normalize Published City Page']);
  setMainConnection(connections, 'Normalize Published City Page', 0, ['Update Yoast SEO']);

  const body = {
    name: wf.name,
    nodes,
    connections,
    settings: wf.settings || {}
  };

  fs.writeFileSync('.tmp-live-workflow-after-duplicate-patch-proposed.json', JSON.stringify(body, null, 2));

  const putRes = await fetch(`${origin}/api/v1/workflows/${wfId}`, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const putText = await putRes.text();
  if (!putRes.ok) {
    throw new Error(`Update failed: ${putRes.status} ${putText}`);
  }

  const verifyRes = await fetch(`${origin}/api/v1/workflows/${wfId}`, { headers });
  const verify = await verifyRes.json();

  const result = {
    workflowId: wfId,
    patched: true,
    nodesPresent: [
      'Find Existing City Page',
      'Normalize City Lookup Result',
      'City Lookup Successful?',
      'City Page Exists?',
      'Update Existing City Page',
      'Normalize Published City Page'
    ].map((name) => Boolean((verify.nodes || []).find((n) => n.name === name))),
    validationTrueBranch: verify.connections?.['Validation Passed?']?.main?.[0]?.map((e) => e.node) || [],
    createNext: verify.connections?.['Create a post']?.main?.[0]?.map((e) => e.node) || [],
    updateNext: verify.connections?.['Update Existing City Page']?.main?.[0]?.map((e) => e.node) || [],
    normalizeNext: verify.connections?.['Normalize Published City Page']?.main?.[0]?.map((e) => e.node) || []
  };

  fs.writeFileSync('.tmp-duplicate-patch-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
})();