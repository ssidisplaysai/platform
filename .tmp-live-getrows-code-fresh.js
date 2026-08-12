const input = $input.first().json;
const body =
  input.body && typeof input.body === 'object'
    ? input.body
    : input;

const isGlw = Boolean(
  body.jobId ||
  body.type === 'page_generation' ||
  body.page ||
  body.workflowContext ||
  body.publishingSettings
);

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizePublishingMode(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;

    const normalized = String(value).trim().toLowerCase();

    if (normalized === 'publish' || normalized === 'published') {
      return 'publish';
    }

    if (normalized === 'draft') {
      return 'draft';
    }
  }

  return isGlw ? 'publish' : 'draft';
}

if (!isGlw) {
  return [
    {
      json: {
        ...input,
        source_mode: 'sheet',
        publishing_mode: normalizePublishingMode(
          input.publishing_mode,
          input.publishingMode,
          input.status
        ),
        job_id: '',
        callback_url: ''
      }
    }
  ];
}

const page = body.page || {};
const site = body.site || {};
const publishingSettings =
  body.publishingSettings &&
  typeof body.publishingSettings === 'object'
    ? body.publishingSettings
    : {};

const workflowContext =
  body.workflowContext &&
  typeof body.workflowContext === 'object'
    ? body.workflowContext
    : {};

const seoSettings =
  body.seoSettings &&
  typeof body.seoSettings === 'object'
    ? body.seoSettings
    : {};

const product = String(
  page.product ||
  page.productTopic ||
  workflowContext.productTopic ||
  page.category ||
  seoSettings.category ||
  ''
).trim();

const category = String(
  page.category ||
  seoSettings.category ||
  page.product ||
  page.productTopic ||
  workflowContext.productTopic ||
  ''
).trim();

const state = String(
  page.state ||
  workflowContext.state ||
  ''
).trim();

const city = String(
  page.city ||
  workflowContext.city ||
  ''
).trim();

const focusKeyword = String(
  page.primaryKeyword ||
  seoSettings.primaryKeyword ||
  ''
).trim();

const jobId = String(
  body.jobId ||
  body.job_id ||
  ''
).trim();

const callbackUrl = String(
  body.callbackUrl ||
  body.callback_url ||
  ''
).trim();

if (!jobId) {
  throw new Error('GLW request is missing jobId.');
}

if (!product) {
  throw new Error(
    'GLW request is missing page.product, page.productTopic, workflowContext.productTopic, or page.category.'
  );
}

if (!focusKeyword) {
  throw new Error(
    'GLW request is missing page.primaryKeyword or seoSettings.primaryKeyword.'
  );
}

if (site.id && site.id !== 'led-display-warehouse') {
  throw new Error(`Unsupported GLW site: ${site.id}`);
}

const productSlug = slugify(
  page.productSlug ||
  page.targetSlug ||
  seoSettings.targetSlug ||
  product
);

const stateSlug = slugify(
  page.stateSlug ||
  state
);

const citySlug = slugify(
  page.citySlug ||
  seoSettings.citySlug ||
  seoSettings.city_slug ||
  workflowContext.citySlug ||
  city
);

const hierarchicalSlug = String(
  page.hierarchicalSlug ||
  page.hierarchical_slug ||
  seoSettings.hierarchicalSlug ||
  workflowContext.hierarchicalSlug ||
  ''
).trim();

const slugParts = hierarchicalSlug
  ? hierarchicalSlug
      .split('/')
      .map((part) => slugify(part))
      .filter(Boolean)
  : [productSlug, stateSlug, citySlug].filter(Boolean);

const requestedTitle = String(
  page.pageTitle ||
  page.page_title ||
  page.title ||
  ''
).trim();

const requestedH1 = String(
  page.h1 ||
  ''
).trim();

const wordCount = Number(
  publishingSettings.wordCount ||
  page.wordCount ||
  page.word_count ||
  1500
);

const additionalInstructions = String(
  page.additionalInstructions ||
  page.additional_instructions ||
  workflowContext.additionalInstructions ||
  workflowContext.additional_instructions ||
  ''
).trim();

const publishingMode = normalizePublishingMode(
  body.publishing_mode,
  body.publishingMode,
  publishingSettings.status,
  page.publishingMode,
  page.publishing_mode,
  page.status
);

return [
  {
    json: {
      source_mode: 'glw',
      job_id: jobId,
      callback_url: callbackUrl,

      publishing_mode: publishingMode,

      site_id: site.id || 'led-display-warehouse',
      site_name: site.name || 'LED Display Warehouse',

      page_type: String(
        page.page_type ||
        page.pageType ||
        workflowContext.pageType ||
        product
      ).trim(),

      category,
      state,
      city,
      focus_keyword: focusKeyword,

      slug: slugParts.join('/'),

      page_title: requestedTitle,
      h1: requestedH1,

      internal_links: '',

      word_count:
        Number.isFinite(wordCount) && wordCount > 0
          ? wordCount
          : 1500,

      additional_instructions: additionalInstructions,

      status: 'Ready',
      row_number: ''
    }
  }
];