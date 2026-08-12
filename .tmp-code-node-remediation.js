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

function countWords(value) {
  const text = stripTags(value);
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function extractInternalLinks(html) {
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
    try {
      const url = new URL(href);
      if (url.hostname.toLowerCase() === 'leddisplaywarehouse.com') {
        links.push(href);
      }
    } catch {
      // ignore malformed links
    }
  }
  return links;
}

function parseLinkCandidates(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,|]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function toAnchor(url, label) {
  return `<a href="${url}">${label}</a>`;
}

function titleFromSlug(value) {
  return String(value || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .trim();
}

function labelFromInternalUrl(url) {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').map((segment) => segment.trim()).filter(Boolean);
    const tail = segments[segments.length - 1] || segments[segments.length - 2] || '';
    const label = titleFromSlug(tail);
    return label || 'Related Resource';
  } catch {
    return 'Related Resource';
  }
}

function replacePlaceholderResourceLabels(html) {
  return String(html || '').replace(
    /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi,
    (full, pre, href, post, text) => {
      const existingText = stripTags(text).trim();
      if (!/^related\s+resource\s+\d+$/i.test(existingText)) {
        return full;
      }

      const replacementLabel = labelFromInternalUrl(href);
      return `<a${pre}href="${href}"${post}>${replacementLabel}</a>`;
    },
  );
}

function normalizeHeading(value) {
  return stripTags(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function collectHeadings(html) {
  const headings = new Set();
  const regex = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  let match;
  while ((match = regex.exec(String(html || ''))) !== null) {
    const normalized = normalizeHeading(match[1]);
    if (normalized) {
      headings.add(normalized);
    }
  }
  return headings;
}

function dedupeLongParagraphs(html) {
  const seen = new Set();
  return String(html || '').replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (full, content) => {
    const normalized = stripTags(content).toLowerCase().replace(/\s+/g, ' ').trim();
    if (normalized.length < 80) {
      return full;
    }

    if (seen.has(normalized)) {
      return '';
    }

    seen.add(normalized);
    return full;
  });
}

function buildExpansionSection(topic, cityName, stateName, variant) {
  const location = [cityName, stateName].filter(Boolean).join(', ');
  const headline = topic || 'commercial LED video walls';
  const headingTemplates = [
    `Planning a Reliable ${headline} Project${location ? ' in ' + location : ''}`,
    `Site Engineering Priorities for ${headline}${location ? ' in ' + location : ''}`,
    `Operational Readiness for ${headline}${location ? ' in ' + location : ''}`,
    `Content and Control Strategy for ${headline}${location ? ' in ' + location : ''}`,
  ];
  const selectedHeading = headingTemplates[variant % headingTemplates.length];
  const leadPhrases = [
    'Field planning baseline:',
    'Deployment quality checkpoint:',
    'Operations continuity standard:',
    'Content governance control:',
  ];
  const lead = leadPhrases[variant % leadPhrases.length];

  return `
<section>
  <h2>${selectedHeading}</h2>
  <p>${lead} successful LED projects begin with a site plan that connects viewing distance, pixel pitch, content type, and daily operating conditions. Teams should define who will use the display, what messages will run most often, and how frequently creative assets will change. This prevents over-specification and keeps hardware, controls, and installation effort aligned with business outcomes.</p>
  <p>${lead} before fabrication, installers should verify access paths, power availability, rigging constraints, and service clearance. These checkpoints reduce deployment risk and help maintain predictable commissioning schedules. A disciplined pre-install checklist also improves long-term maintenance by ensuring replacement parts, cable paths, and controller access remain practical after handoff.</p>
  <p>${lead} content strategy is equally important. Operators should prepare scene templates for promotions, wayfinding, and proof-of-performance loops so the display is useful from day one. Standardized content dimensions, contrast-safe typography, and brightness profiles improve readability across indoor and outdoor conditions while protecting panel life and reducing rework for design teams.</p>
  <p>${lead} establish an operations rhythm with preventive inspections, calibration windows, and measurable service targets. Monitoring cabinet health, signal integrity, and thermal behavior over time helps teams detect issues early and keep uptime high. This operating model turns the display from a one-time install into a dependable communications platform that consistently supports revenue, branding, and customer experience goals.</p>
</section>`;
}

function ensureMinimumBodyContent(html, context) {
  let output = dedupeLongParagraphs(String(html || '').trim());

  if (!output) {
    output = `<p>${context.pageTitle || context.focus || 'Commercial LED display'} overview.</p>`;
  }

  let words = countWords(output);
  let variant = 0;
  const existingHeadings = collectHeadings(output);
  while (words < 1225 && variant < 8) {
    const candidate = buildExpansionSection(context.focus || context.pageTitle || 'LED display', context.city, context.state, variant);
    const headingMatch = candidate.match(/<h2>([\s\S]*?)<\/h2>/i);
    const normalizedHeading = headingMatch ? normalizeHeading(headingMatch[1]) : '';

    if (normalizedHeading && !existingHeadings.has(normalizedHeading)) {
      output += candidate;
      existingHeadings.add(normalizedHeading);
    }

    words = countWords(output);
    variant += 1;
  }

  return output;
}

function ensureMinimumInternalLinks(html, candidates) {
  const normalizedHtml = replacePlaceholderResourceLabels(html);
  const existing = extractInternalLinks(normalizedHtml);
  if (existing.length >= 3) {
    return normalizedHtml;
  }

  const fallback = [
    'https://leddisplaywarehouse.com/direct-view-led-video-walls/',
    'https://leddisplaywarehouse.com/outdoor-led-displays/',
    'https://leddisplaywarehouse.com/contact-us/',
    'https://leddisplaywarehouse.com/custom-led-displays/',
  ];

  const merged = [...candidates, ...fallback]
    .map((url) => String(url || '').trim())
    .filter((url) => /^https:\/\/leddisplaywarehouse\.com\//i.test(url));

  const unique = [];
  for (const url of merged) {
    if (!unique.includes(url)) {
      unique.push(url);
    }
  }

  const existingSet = new Set(existing);
  const missing = unique.filter((url) => !existingSet.has(url));
  const needed = Math.max(3 - existing.length, 0);
  const selected = missing.slice(0, needed > 0 ? needed : 3);
  if (selected.length === 0) {
    return normalizedHtml;
  }

  const anchors = selected
    .map((url) => `<li>${toAnchor(url, labelFromInternalUrl(url))}</li>`)
    .join('');

  return normalizedHtml + `\n<section><h2>Related Resources</h2><ul>${anchors}</ul></section>`;
}

const linkCandidates = parseLinkCandidates(source.internal_links);
const rawArticleHtml = data.content || data.article_html || source.body_html || data.html || '';
let remediatedArticleHtml = ensureMinimumBodyContent(rawArticleHtml, {
  pageTitle,
  focus,
  city,
  state,
});
remediatedArticleHtml = ensureMinimumInternalLinks(remediatedArticleHtml, linkCandidates);

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
    article_html: remediatedArticleHtml,
    excerpt: data.excerpt || data.meta_description || '',
    internal_links: source.internal_links || '',
    source_row_number: source.row_number || '',
    source_status: source.status || ''
  }
}];