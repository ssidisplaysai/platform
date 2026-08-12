let raw = '';

try {
  raw = $input.first().json.output[0].content[0].text;
} catch (e) {
  raw = '';
}

if (!raw || typeof raw !== 'string') {
  return [{ json: { error: true, message: 'No text found from Message a Model node', raw_output: JSON.stringify($input.first().json) } }];
}

raw = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();

const firstBrace = raw.indexOf('{');
const lastBrace = raw.lastIndexOf('}');

if (firstBrace === -1 || lastBrace === -1) {
  return [{ json: { error: true, message: 'Model returned non-JSON output', raw_output: raw } }];
}

raw = raw.slice(firstBrace, lastBrace + 1);

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  return [{ json: { error: true, message: 'JSON parse failed', parse_error: e.message, raw_output: raw } }];
}

const source = $('Get row(s) in sheet').first().json;

const cleanSlug = (data.slug || source.slug || '')
  .toString()
  .trim()
  .toLowerCase()
  .replace(/^\/+|\/+$/g, '')
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9\/-]+/g, '-')
  .replace(/-+/g, '-');

const pageTitle = data.title || source.page_title || data.seo_title || '';
const focus = data.focus_keyphrase || source.focus_keyword || data.focuskw || data.keyphrase || '';
const city = source.city || '';
const state = source.state || '';
const pageType = source.page_type || '';
const alt = data.image_alt || data.alt_tag || source.alt_text || `${focus} display solution${city ? ' in ' + city : ''}`;
const mediaTitle = data.image_title || `${pageTitle || focus || pageType} Image`.trim();
const mediaDescription = data.image_description || `${alt}. Commercial LED display visual for ${pageTitle || focus || pageType}${city || state ? ' serving ' + [city, state].filter(Boolean).join(', ') : ''}.`;

return [{
  json: {
    source_mode: source.source_mode || 'sheet',
    job_id: source.job_id || '',
    callback_url: source.callback_url || '',
    publishing_mode: source.publishing_mode === 'publish' ? 'publish' : 'draft',
    additional_instructions: source.additional_instructions || '',
    page_type: pageType,
    state,
    city,
    post_title: pageTitle,
    page_title: pageTitle,
    seo_title: data.seo_title || pageTitle || '',
    h1: data.h1 || source.h1 || pageTitle || '',
    slug: cleanSlug,
    meta_description: data.meta_description || data.metadesc || data.description || '',
    focus_keyphrase: focus,
    alt_tag: alt,
    media_title: mediaTitle,
    media_description: mediaDescription,
    image_prompt: data.image_prompt || source.image_prompt || data.prompt || '',
    article_html: data.content || data.article_html || source.body_html || data.html || '',
    excerpt: data.excerpt || data.meta_description || '',
    internal_links: source.internal_links || '',
    source_row_number: source.row_number || '',
    source_status: source.status || ''
  }
}];